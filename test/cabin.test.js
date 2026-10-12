// Tests du moteur « À bord » et des fichiers JSON annexes : node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Cabin } = require('../cabin');
const { writeJsonSafe, readJsonSafe } = require('../backups');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fb-test-'));
const APS = { LFPG: { lat: 49.0097, lon: 2.5479, name: 'CDG' }, LFBO: { lat: 43.629, lon: 1.364, name: 'Blagnac' } };

function fly(file, said) {
  let phase = 'climb';
  const c = new Cabin({
    file, rendererDir: path.join(__dirname, '..', 'renderer'), say: t => said.push(t), reply: () => {}, alert: () => {},
    lookupAirport: i => APS[i], getBriefing: () => ({ dep: 'LFPG', arr: 'LFBO', callsign: 'AFR23', aircraft: 'A320' }), getPhase: () => phase
  });
  c.openBoarding(false);
  c.onMessage({ user: 'kero', displayName: 'Kero', text: '!embarquer' });
  let lat = 49.0097, lon = 2.5479;
  for (let i = 0; i < 600; i++) {
    lat += (43.629 - 49.0097) / 600; lon += (1.364 - 2.5479) / 600;
    c.onTick({ lat, lon, phase: 'airborne', altFt: 30000, gsKt: 450, headingDeg: 190, onGround: false }, 'cruise');
  }
  c.onLanded({ icao: 'LFBO' });
  return c;
}

test('le message d\'arrivée annonce le vrai cumul de miles', () => {
  const said = [], c = fly(path.join(tmp(), 'cabin.json'), said);
  const total = c.data.viewers.kero.miles;
  assert.match(said.find(s => s.includes('Plus gros cumul')), new RegExp(`\\(${total.toLocaleString('fr-FR')} miles\\)`));
});

test('cabin.json corrompu : les miles reviennent du .bak au lieu d\'être perdus', () => {
  const dir = tmp(), file = path.join(dir, 'cabin.json');
  const c = fly(file, []);
  c._save(true); c._save(true); // deux écritures -> un .bak existe
  fs.writeFileSync(file, '{"viewers":{"kero":'); // coupure de courant
  const back = readJsonSafe(file);
  assert.ok(back.viewers.kero.miles > 0);
  assert.ok(fs.readdirSync(dir).some(n => n.includes('corrompu')), 'le fichier abîmé est mis de côté');
});

test('writeJsonSafe / readJsonSafe : aller-retour', () => {
  const file = path.join(tmp(), 'x.json');
  assert.strictEqual(readJsonSafe(file), null);
  writeJsonSafe(file, { a: 1 });
  assert.deepStrictEqual(readJsonSafe(file), { a: 1 });
});
