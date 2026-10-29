// Tests du duty free et des turbulences « À bord » (v2.0) : node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const DutyFree = require('../dutyfree');
const { Cabin } = require('../cabin');
const { mergeConfig } = require('../twitch');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fb-test-'));

function makeCabin(cfg) {
  const said = [], replies = [], alerts = [];
  const c = new Cabin({
    file: path.join(tmp(), 'cabin.json'), rendererDir: path.join(__dirname, '..', 'renderer'),
    say: t => said.push(t), reply: t => replies.push(t), alert: a => alerts.push(a),
    lookupAirport: () => null, getBriefing: () => ({ dep: 'LFPG', arr: 'LFBO' }), getPhase: () => 'cruise', getCommandConfig: () => mergeConfig(null)
  });
  c.setConfig(cfg || {});
  return { c, said, replies, alerts };
}
const msg = (user, text) => ({ user, displayName: user, text });

test('duty free : achat sur le solde, sans toucher au statut ni au classement', () => {
  const v = { name: 'Kero', miles: 1000 };
  const r = DutyFree.buy(v, 'canard', 1);
  assert.ok(r.ok);
  assert.strictEqual(r.price, 400);
  assert.strictEqual(v.miles, 1000);
  assert.strictEqual(DutyFree.balance(v), 600);
  assert.deepStrictEqual(DutyFree.look(v), { badge: '🦆', title: null, color: null });
  assert.strictEqual(DutyFree.deco(v), '🦆 Kero');
});

test('duty free : solde insuffisant, article inconnu, alias EN, multiplicateur de prix', () => {
  const v = { name: 'Kero', miles: 500 };
  assert.deepStrictEqual(DutyFree.buy(v, 'diamant', 1), { ok: false, error: 'funds', item: DutyFree.get('diamant'), price: 2500, balance: 500 });
  assert.strictEqual(DutyFree.buy(v, 'licorne', 1).error, 'unknown');
  assert.strictEqual(DutyFree.buy(v, 'Duck', 0.5).price, 200);
  assert.strictEqual(DutyFree.balance(v), 300);
});

test('duty free : un article acheté se remet gratuitement, un par rayon', () => {
  const v = { name: 'Kero', miles: 5000 };
  DutyFree.buy(v, 'canard'); DutyFree.buy(v, 'ovni'); DutyFree.buy(v, 'copilote');
  assert.strictEqual(DutyFree.look(v).badge, '🛸');
  const r = DutyFree.buy(v, 'canard');
  assert.strictEqual(r.kind, 'equip');
  assert.strictEqual(r.price, 0);
  assert.strictEqual(DutyFree.look(v).badge, '🦆');
  assert.strictEqual(DutyFree.look(v).title, 'Copilote');
  assert.strictEqual(DutyFree.unequip(v, 'titre'), 'title');
  assert.strictEqual(DutyFree.look(v).title, null);
});

test('chat : !dutyfree et !acheter', () => {
  const { c, replies, alerts } = makeCabin();
  c.viewer('kero', 'Kero').miles = 900;
  c.onMessage(msg('kero', '!dutyfree badges'));
  assert.match(replies.pop(), /🦆 canard 400/);
  c.onMessage(msg('kero', '!acheter canard'));
  assert.match(replies.pop(), /s'offre 🦆 Canard en plastique .*solde 500/);
  assert.strictEqual(alerts.pop().type, 'cabin-dutyfree');
  c.cooldowns.clear(); // délai anti-spam de !acheter (5 s)
  c.onMessage(msg('kero', '!acheter dragon'));
  assert.match(replies.pop(), /coûte 1\s?500 miles, ton solde est de 500/u);
  c.onMessage(msg('kero', '!miles'));
  assert.match(replies.pop(), /🦆 Kero/);
});

test('duty free désactivé : les commandes ne répondent pas', () => {
  const { c, replies } = makeCabin({ dutyFree: { enabled: false } });
  c.viewer('kero', 'Kero').miles = 900;
  c.onMessage(msg('kero', '!dutyfree'));
  c.onMessage(msg('kero', '!acheter canard'));
  assert.strictEqual(replies.length, 0);
});

function boardTwo(c) {
  c.openBoarding(false);
  c.onMessage(msg('kero', '!embarquer'));
  c.onMessage(msg('lulu', '!embarquer'));
  c.viewer('kero').miles = 300;
  c.viewer('lulu').miles = 300;
}

test('turbulences : !ceinture à temps protège, les autres passagers actifs perdent des miles', () => {
  const { c, said, alerts } = makeCabin({ turbulence: { enabled: true, penalty: 50, answerSec: 30 } });
  boardTwo(c);
  assert.ok(c.startTurbulence('manual'));
  assert.match(said.pop(), /tapez !ceinture dans les 30 s, sinon 50 miles/);
  c.onMessage(msg('kero', '!ceinture'));
  c.onMessage(msg('intrus', '!ceinture')); // pas à bord : ignoré
  const r = c.endTurbulence();
  assert.deepStrictEqual(r.safe, ['kero']);
  assert.deepStrictEqual(r.hit, [{ name: 'lulu', loss: 50 }]);
  assert.strictEqual(c.data.viewers.kero.miles, 300);
  assert.strictEqual(c.data.viewers.lulu.miles, 250);
  assert.match(said.pop(), /Ceintures bouclées : kero\. 😵 Sans ceinture \(−50 miles\) : lulu\./);
  assert.strictEqual(alerts.pop().type, 'cabin-turbulence-result');
  clearTimeout(c._saveTimer);
});

test("turbulences : jamais sous les miles déjà dépensés au duty free", () => {
  const { c } = makeCabin({ turbulence: { enabled: true, penalty: 50 } });
  boardTwo(c);
  c.viewer('lulu').spent = 280;
  c.startTurbulence('manual');
  c.endTurbulence();
  assert.strictEqual(c.data.viewers.lulu.miles, 280);
  assert.strictEqual(DutyFree.balance(c.data.viewers.lulu), 0);
  clearTimeout(c._saveTimer);
});

test("turbulences : désactivées par défaut, pas d'alerte sans passager actif, annulation sans pénalité", () => {
  const off = makeCabin();
  boardTwo(off.c);
  assert.strictEqual(off.c.startTurbulence('manual'), false);
  const { c } = makeCabin({ turbulence: { enabled: true } });
  c.openBoarding(false);
  assert.strictEqual(c.startTurbulence('manual'), false);
  boardTwo(c);
  assert.ok(c.startTurbulence('manual'));
  c.abort();
  assert.strictEqual(c.data.viewers.lulu.miles, 300);
  assert.strictEqual(c.turb, null);
});

test('turbulences : détectées sur les secousses réelles, pas sur un virage serré', () => {
  const { c } = makeCabin({ turbulence: { enabled: true, auto: true, sensitivity: 'medium' } });
  boardTwo(c);
  const f = c.flight;
  f.airborne = true;
  let now = 1e12;
  const tick = g => c._checkTurbulence({ gForce: g, aglFt: 30000 }, 'cruise', now += 1000);
  [1.4, 1.45, 1.4, 1.38, 1.0].forEach(tick); // virage à 45° : G > 1 seulement
  assert.strictEqual(c.turb, null);
  [1.1, 0.6, 1.4].forEach(tick);
  assert.ok(c.turb);
  assert.strictEqual(c.turb.reason, 'auto');
  c.endTurbulence(true);
  [0.5, 1.5].forEach(tick); // moins de 10 min après : pas de nouvelle alerte
  assert.strictEqual(c.turb, null);
});
