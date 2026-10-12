// Prédiction Twitch suivant les paris d'atterrissage, contre une fausse API Helix : node --test
const test = require('node:test');
const assert = require('node:assert');
const { Prediction, SCOPE, bucketOf } = require('../predictions');

function fakeTwitch({ scopes = [SCOPE], status = 200 } = {}) {
  const calls = [];
  const auth = { data: { userId: '42', scopes }, clientId: () => 'cid', ensureToken: async () => 'tok' };
  const fetch = async (url, o) => {
    const body = JSON.parse(o.body);
    calls.push({ method: o.method, body });
    const data = o.method === 'POST' ? [{ id: 'p1', outcomes: body.outcomes.map((x, i) => ({ id: 'o' + i, title: x.title })) }] : [];
    return { ok: status < 300, status, json: async () => (status < 300 ? { data } : { message: 'nope' }) };
  };
  const logs = [];
  return { calls, logs, p: new Prediction({ fetch, getAuth: () => auth, tr: s => s, log: t => logs.push(t) }) };
}

test('tranches de taux de toucher', () => {
  assert.deepStrictEqual([0, 99, 100, 199, 200, 349, 350, 599, 600, 2500, -150].map(bucketOf), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 1]);
});

test('vol complet : ouverture, verrouillage, résultat sur la bonne tranche', async () => {
  const { p, calls } = fakeTwitch();
  p.open(); p.lock(); await p.resolve(-142);
  assert.deepStrictEqual(calls.map(c => c.body.status || c.method), ['POST', 'LOCKED', 'RESOLVED']);
  assert.strictEqual(calls[0].body.broadcaster_id, '42');
  assert.strictEqual(calls[0].body.outcomes.length, 5);
  assert.ok(calls[0].body.outcomes.every(o => o.title.length <= 25) && calls[0].body.title.length <= 45);
  assert.strictEqual(calls[2].body.winning_outcome_id, 'o1'); // 142 ft/min -> « Doux (100-199) »
  assert.strictEqual(p.state, 'resolved');
});

test('vol interrompu : la prédiction est annulée (points remboursés)', async () => {
  const { p, calls } = fakeTwitch();
  p.open(); await p.cancel();
  assert.strictEqual(calls[1].body.status, 'CANCELED');
  await p.cancel(); // rien à annuler : aucun appel de plus
  assert.strictEqual(calls.length, 2);
});

test('sans le droit « predictions » : message clair, aucun appel à Twitch', async () => {
  const { p, calls, logs } = fakeTwitch({ scopes: ['channel:manage:broadcast'] });
  await p.open();
  assert.strictEqual(calls.length, 0);
  assert.strictEqual(p.state, 'error');
  assert.match(logs[0], /Reconnecte le compte de ta chaîne/);
});

test('chaîne non affiliée : erreur Twitch remontée', async () => {
  const { p } = fakeTwitch({ status: 403 });
  await p.open();
  assert.match(p.error, /Affiliée ou Partenaire/);
});

test('le bot signale ouverture / verrouillage / résultat / annulation des paris', () => {
  const { FlightBot } = require('../twitch');
  const os = require('os'), path = require('path'), fs = require('fs');
  const chat = { on() {}, say() { return true; } };
  const bot = new FlightBot(chat, { statsFile: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fb-')), 'bets.json'), getContext: () => ({}) });
  const seen = [];
  bot.on('bet', (w, d) => seen.push(d ? `${w}:${d.fpm}` : w));
  bot.onFlightTick('descent', 5000, -1500);   // ouverture auto
  bot.onFlightTick('approach', 800, -700);    // verrouillage auto sous 1000 ft
  bot.resolveBets({ fpm: -142 });
  bot.onFlightStart(); bot.openBets('manuel'); bot.onFlightStart(); // nouveau vol avec paris ouverts -> annulation
  assert.deepStrictEqual(seen, ['open', 'lock', 'resolve:142', 'open', 'cancel']);
});
