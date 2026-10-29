// Tests de l'appli EFB de MSFS 2024 : paquet Community et API locale (v2.0) : node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const Efb = require('../efb-package');
const { startLiveOverlayServer } = require('../server');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fb-test-'));
const SRC = path.join(__dirname, '..', 'efb');

test('paquet Community : fichiers, manifest et layout cohérents', () => {
  const dest = path.join(tmp(), Efb.PACKAGE);
  const r = Efb.writePackage(SRC, dest, '1.9.0', Date.UTC(2026, 9, 29));
  const layout = JSON.parse(fs.readFileSync(path.join(dest, 'layout.json'), 'utf-8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf-8'));
  const paths = layout.content.map(c => c.path).sort();
  assert.deepStrictEqual(paths, ['ContentInfo/llcenlive-efb-flightbrief/thumbnail.jpg', 'html_ui/efb_ui/efb_apps/FlightBriefEfb/Assets/app-icon.png', 'html_ui/efb_ui/efb_apps/FlightBriefEfb/FlightBriefEfb.js']);
  assert.strictEqual(r.files, 3);
  layout.content.forEach(c => assert.strictEqual(c.size, fs.statSync(path.join(dest, c.path)).size));
  assert.strictEqual(layout.content[0].date, Efb.fileTime(Date.UTC(2026, 9, 29)));
  assert.strictEqual(manifest.content_type, 'MISC');
  assert.strictEqual(manifest.package_version, '1.9.0');
  assert.strictEqual(Efb.installedVersion(path.dirname(dest)), '1.9.0');
});

test("le nom interne de l'appli correspond au fichier, au dossier et au paquet du SDK", () => {
  const js = fs.readFileSync(path.join(SRC, 'PackageSources', Efb.APP, Efb.APP + '.js'), 'utf-8');
  assert.match(js, new RegExp(`var INTERNAL_NAME = '${Efb.APP}'`));
  const xml = fs.readFileSync(path.join(SRC, 'PackageDefinitions', Efb.PACKAGE + '.xml'), 'utf-8');
  assert.ok(xml.includes(`PackageSources\\${Efb.APP}\\`) && xml.includes(`efb_apps\\${Efb.APP}\\`));
});

test('dossier Community : lu dans UserCfg.opt (Steam, puis Microsoft Store)', () => {
  assert.strictEqual(Efb.communityFromUserCfg('Foo 1\nInstalledPackagesPath "D:\\MSFS2024"\n'), path.join('D:\\MSFS2024', 'Community'));
  assert.strictEqual(Efb.communityFromUserCfg('rien'), null);
  const env = { APPDATA: 'C:\\U\\AppData\\Roaming', LOCALAPPDATA: 'C:\\U\\AppData\\Local', USERPROFILE: 'C:\\U' };
  const store = path.join(env.LOCALAPPDATA, 'Packages', 'Microsoft.Limitless_8wekyb3d8bbwe', 'LocalCache', 'UserCfg.opt');
  const f = Efb.findCommunity(env, p => { if (p === store) return 'InstalledPackagesPath "C:\\U\\AppData\\Local\\MSFS"'; throw new Error('absent'); });
  assert.strictEqual(f.edition, 'store');
  assert.ok(Efb.underAppData(f.community, env));
  assert.ok(!Efb.underAppData('D:\\MSFS2024\\Community', env));
  assert.strictEqual(Efb.findCommunity(env, () => { throw new Error('absent'); }), null);
});

function get(port, p, headers, method) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: method || 'GET', headers: headers || {} }, res => {
      let s = ''; res.on('data', d => s += d); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: s }));
    });
    req.on('error', reject); req.end();
  });
}

test("API locale de l'EFB : page avec code d'appairage, données et actions protégées", async () => {
  const actions = [];
  const server = startLiveOverlayServer(0, () => ({}), () => ({ events: [] }), {
    efb: { token: () => 'tok123', lang: () => 'en', state: async () => ({ ok: true, dep: 'LFPG' }), action: a => { actions.push(a); return { ok: true }; } }
  });
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  try {
    const page = await get(port, '/efb');
    assert.strictEqual(page.status, 200);
    assert.ok(page.body.includes("token: 'tok123'") && page.body.includes("lang: 'en'"));
    assert.strictEqual((await get(port, '/efb/efb.js')).status, 200);
    assert.strictEqual((await get(port, '/api/efb/state')).status, 401);
    const st = await get(port, '/api/efb/state', { 'X-FlightBrief-Efb': 'tok123' });
    assert.deepStrictEqual(JSON.parse(st.body), { ok: true, dep: 'LFPG' });
    assert.strictEqual(st.headers['access-control-allow-origin'], undefined); // illisible depuis un autre site
    assert.strictEqual((await get(port, '/api/efb/action?a=shot', { 'X-FlightBrief-Efb': 'tok123' })).status, 405); // GET refusé
    assert.strictEqual((await get(port, '/api/efb/action?a=shot', { 'X-FlightBrief-Efb': 'faux' }, 'POST')).status, 401);
    assert.strictEqual((await get(port, '/api/efb/action?a=shot', { 'X-FlightBrief-Efb': 'tok123' }, 'POST')).status, 200);
    assert.deepStrictEqual(actions, ['shot']);
    const ping = await get(port, '/api/ping');
    assert.strictEqual(ping.headers['access-control-allow-origin'], '*');
  } finally { server.close(); }
});

const EfbData = require('../efb-data');
const DB = {
  careers: [{ id: 'c1', name: 'AF Virtual', type: 'VA', ranks: [{ name: 'Élève', hours: 0 }, { name: 'Copilote', hours: 2 }, { name: 'CDB', hours: 5 }],
    tours: [{ name: 'Tour', legs: [{ dep: 'LFPG', arr: 'LFBO', done: true }, { dep: 'LFBO', arr: 'LFMN', done: false }] }] }],
  logbook: [
    { id: 'a', date: '2026-10-01', dep: 'LFPG', arr: 'LFBO', durationMin: 75, careerId: 'c1', network: 'VATSIM', pirep: 'ok', trackData: { landingRateFpm: -140, distanceNm: 318, bounceCount: 0, touchdown: { gForce: 1.1 } } },
    { id: 'b', date: '2026-10-20', dep: 'LFBO', arr: 'LFMN', durationMin: 65, careerId: 'c1', network: 'IVAO' }
  ],
  ofp: { dep: 'LFPG', arr: 'EGLL', planHtml: '<div><pre>FUEL&nbsp;PLAN<br>TRIP 0110 &amp; 2850</pre></div><script>x</script>' }
};

test('EFB Logbook : vols récents d\'abord, stats, note d\'atterrissage, sans tracé', () => {
  const r = EfbData.logbook(DB, () => null);
  assert.deepStrictEqual(r.flights.map(f => f.id), ['b', 'a']);
  assert.strictEqual(r.stats.flights, 2);
  assert.strictEqual(r.stats.hours, '2h20');
  assert.strictEqual(r.stats.nm, 318);
  const a = r.flights[1];
  assert.strictEqual(a.career, 'AF Virtual');
  assert.ok(a.score && a.score.letter);
  assert.strictEqual(a.tracked, true);
  assert.ok(!('trackData' in a) && !('path' in a));
});

test('EFB Carrière : grade, progression et tour', () => {
  const c = EfbData.careers(DB).careers[0];
  assert.strictEqual(c.hours, 2.3);
  assert.strictEqual(c.rank, 'Copilote');
  assert.deepStrictEqual(c.next, { name: 'CDB', hours: 5 });
  assert.strictEqual(c.pct, 47);
  assert.deepStrictEqual(c.tours[0], { name: 'Tour', done: 1, total: 2, next: { dep: 'LFBO', arr: 'LFMN' }, stops: ['LFPG', 'LFBO', 'LFMN'] });
});

test('EFB OFP : texte brut, sans balises', () => {
  const o = EfbData.ofpText(DB).ofp;
  assert.strictEqual(o.text, 'FUEL PLAN\nTRIP 0110 & 2850\nx');
  assert.strictEqual(EfbData.ofpText({}).ofp, null);
});
