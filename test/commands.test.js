// Tests des commandes personnalisables et des alertes du chat (v2.0) : node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Commands = require('../commands');
const { FlightBot, mergeConfig } = require('../twitch');
const { Cabin } = require('../cabin');
const { EventEmitter } = require('events');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fb-test-'));

test("noms d'origine reconnus dans les trois langues, accents compris", () => {
  assert.strictEqual(Commands.resolve('!eta', null).key, 'eta');
  assert.strictEqual(Commands.resolve('!Bet 180', null).key, 'pari');
  assert.deepStrictEqual(Commands.resolve('!bet 180', null).args, ['180']);
  assert.strictEqual(Commands.resolve('!Arrivée 21:47', null).key, 'arrival');
  assert.strictEqual(Commands.resolve('!miciudad Madrid', null).rest, 'Madrid');
  assert.strictEqual(Commands.resolve('eta', null), null);
  assert.strictEqual(Commands.resolve('!inconnue', null), null);
});

test('une commande renommée répond à son nouveau nom, plus à ses noms d\'origine', () => {
  const cfg = mergeConfig({ cmdNames: { top: '!Podium', miles: 'points' } });
  assert.strictEqual(cfg.cmdNames.top, 'podium');
  assert.strictEqual(Commands.resolve('!podium', cfg).key, 'top');
  assert.strictEqual(Commands.resolve('!top', cfg), null);
  assert.strictEqual(Commands.resolve('!leaderboard', cfg), null);
  assert.strictEqual(Commands.resolve('!points', cfg).key, 'miles');
  assert.strictEqual(Commands.resolve('!millas', cfg), null);
  assert.strictEqual(Commands.resolve('!eta', cfg).key, 'eta');
});

test("un nom choisi l'emporte sur l'alias d'origine d'une autre commande", () => {
  const cfg = mergeConfig({ cmdNames: { eta: 'arrivee' } });
  assert.strictEqual(Commands.resolve('!arrivee', cfg).key, 'eta');
  assert.strictEqual(Commands.resolve('!arrival', cfg).key, 'arrival');
  assert.deepStrictEqual(Commands.conflicts(cfg), { arrivee: ['eta', 'arrival'] });
});

test('commande désactivée ou filtrée par groupe : ignorée', () => {
  const cfg = mergeConfig({ commands: { miles: false } });
  assert.strictEqual(Commands.resolve('!miles', cfg), null);
  assert.strictEqual(Commands.resolve('!eta', cfg, 'cabin'), null);
  assert.strictEqual(Commands.resolve('!embarquer', cfg, 'cabin').key, 'board');
});

test('renameInText remplace les noms d\'origine (toutes langues) dans les messages', () => {
  const cfg = mergeConfig({ cmdNames: { pari: 'paris', board: 'go' } });
  assert.strictEqual(Commands.renameInText('Devine le taux de toucher : !pari 180', cfg), 'Devine le taux de toucher : !paris 180');
  assert.strictEqual(Commands.renameInText('Type !board to get on board · !bet 180', cfg), 'Type !go to get on board · !paris 180');
  assert.strictEqual(Commands.renameInText('!embarquement !pari', cfg), '!embarquement !paris'); // mot plus long : intact
  assert.strictEqual(Commands.renameInText('!pari', mergeConfig(null)), '!pari');
});

test('délai par commande : réglage du streamer, sinon défaut du catalogue ou délai général', () => {
  const cfg = mergeConfig({ cooldownSec: 15, cmdCooldowns: { eta: 45, miles: '5', top: '' } });
  assert.strictEqual(Commands.cooldownOf('eta', cfg, cfg.cooldownSec), 45);
  assert.strictEqual(Commands.cooldownOf('top', cfg, cfg.cooldownSec), 15);
  assert.strictEqual(Commands.cooldownOf('miles', cfg, 30), 5);
  assert.strictEqual(Commands.cooldownOf('pax', cfg, 99), 20);
  assert.strictEqual(Commands.cooldownOf('cityset', cfg, 10), 10);
});

function makeBot(cfg, ctxOver) {
  const chat = new EventEmitter();
  chat.said = []; chat.say = t => { chat.said.push(t); return true; }; chat.canSpeak = () => true;
  const bot = new FlightBot(chat, { statsFile: path.join(tmp(), 'bets.json'), fetchMetar: async () => null, getContext: () => ({ connected: true, telemetry: {}, briefing: {} }), ...ctxOver });
  bot.setConfig(cfg);
  return { bot, chat };
}

test('bot : commande renommée + délai propre, et !fb liste les noms choisis', async () => {
  const { bot, chat } = makeBot({ prefixMessages: false, cmdNames: { route: 'plan' }, cmdCooldowns: { route: 0 } }, {
    getContext: () => ({ connected: true, telemetry: {}, briefing: { dep: 'LFPG', arr: 'LFBO' } })
  });
  chat.emit('message', { user: 'a', displayName: 'A', text: '!route' });
  chat.emit('message', { user: 'a', displayName: 'A', text: '!plan' });
  chat.emit('message', { user: 'a', displayName: 'A', text: '!plan' });
  await new Promise(r => setImmediate(r));
  assert.strictEqual(chat.said.length, 2);
  assert.match(chat.said[0], /LFPG → LFBO/);
  chat.emit('message', { user: 'a', displayName: 'A', text: '!fb' });
  await new Promise(r => setImmediate(r));
  assert.match(chat.said[2], /!plan/);
  assert.match(chat.said[2], /À bord : !embarquer/);
});

test('alerte METAR : rien au premier METAR lu, annonce dans le chat seulement quand il change', async () => {
  let metar = 'LFBO 291000Z 27010KT CAVOK 15/08 Q1018';
  const alerts = [];
  const { bot, chat } = makeBot({ prefixMessages: false, alerts: { metar: true } }, {
    fetchMetar: async () => metar, getContext: () => ({ connected: true, telemetry: {}, briefing: { arr: 'lfbo' } })
  });
  bot.on('alert', a => alerts.push(a));
  assert.strictEqual(await bot.checkArrivalMetar(), null);
  assert.strictEqual(await bot.checkArrivalMetar(), null);
  metar = 'LFBO 291030Z 28015G25KT 9999 SHRA 14/09 Q1016';
  assert.match(await bot.checkArrivalMetar(), /Nouveau METAR à LFBO : LFBO 291030Z/);
  assert.strictEqual(chat.said.length, 1);
  assert.strictEqual(alerts.length, 0);
  bot.onLanded();
  metar = 'LFBO 291100Z 00000KT CAVOK 16/08 Q1017';
  assert.strictEqual(await bot.checkArrivalMetar(), null);
});

test('alerte METAR désactivée par défaut', async () => {
  const { bot } = makeBot({}, { fetchMetar: async () => 'X', getContext: () => ({ connected: true, telemetry: {}, briefing: { arr: 'LFBO' } }) });
  assert.strictEqual(await bot.checkArrivalMetar(), null);
});

test('excès de vitesse au roulage : 10 s au-dessus de la limite, pas pendant la décélération après atterrissage', () => {
  const { bot, chat } = makeBot({ prefixMessages: false, alerts: { taxiSpeed: true, taxiSpeedKt: 30 } });
  let t = 1e9;
  const tick = (gs, phase, onGround = true) => bot.onTaxiTick({ gsKt: gs, phase, onGround }, t += 1000);
  tick(10, 'ground');
  for (let i = 0; i < 9; i++) assert.strictEqual(tick(35, 'ground'), null);
  assert.match(tick(36, 'ground') || tick(36, 'ground'), /36 kt \(limite 30 kt\)/);
  for (let i = 0; i < 30; i++) tick(36, 'ground'); // pas de nouvelle alerte avant 2 min
  assert.strictEqual(chat.said.length, 1);
  tick(140, 'airborne', false);
  for (let i = 0; i < 20; i++) assert.strictEqual(tick(80 - i, 'landed'), null); // décélération sur la piste
  t += 180000;
  tick(20, 'landed');
  for (let i = 0; i < 11; i++) tick(38, 'landed');
  assert.strictEqual(chat.said.length, 2);
});

test('cabine : noms et délais des commandes repris de la config du bot', () => {
  const replies = [];
  let cfg = mergeConfig({ cmdNames: { board: 'go' } });
  const c = new Cabin({
    file: path.join(tmp(), 'cabin.json'), rendererDir: path.join(__dirname, '..', 'renderer'), say: () => {}, reply: t => replies.push(t), alert: () => {},
    lookupAirport: () => null, getBriefing: () => ({ dep: 'LFPG', arr: 'LFBO' }), getPhase: () => 'taxi_out', getCommandConfig: () => cfg
  });
  c.openBoarding(false);
  c.onMessage({ user: 'kero', displayName: 'Kero', text: '!embarquer' });
  assert.ok(!c.flight.pax.has('kero'));
  c.onMessage({ user: 'kero', displayName: 'Kero', text: '!go' });
  assert.ok(c.flight.pax.has('kero'));
  cfg = mergeConfig({ cmdCooldowns: { miles: 0 } });
  c.onMessage({ user: 'kero', displayName: 'Kero', text: '!miles' });
  c.onMessage({ user: 'kero', displayName: 'Kero', text: '!miles' });
  assert.strictEqual(replies.filter(r => /miles/.test(r)).length, 2);
});
