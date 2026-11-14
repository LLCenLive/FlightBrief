// Tests v2.1 : events VATSIM + IVAO (format commun, terrains géolocalisés, réseau en panne) : node --test
const test = require('node:test');
const assert = require('node:assert');
const E = require('../events');

const LOOKUP = i => ({ LFPG: { name: 'Paris CDG', lat: 49, lon: 2.5 }, EGLL: { name: 'Heathrow', lat: 51.5, lon: -0.5 } })[i] || null;
const soon = h => new Date(Date.now() + h * 3600000).toISOString();
const VAT = { data: [
  { id: 1, type: 'Event', name: 'Paris Overload', link: 'https://my.vatsim.net/events/1', banner: 'https://x/b.png', organisers: [{ region: 'EMEA', division: 'EUD', subdivision: 'FRA' }],
    airports: [{ icao: 'LFPG' }], routes: [{ departure: 'LFPG', arrival: 'EGLL', route: 'DCT' }], start_time: soon(-1), end_time: soon(2), description: '**Bienvenue** <br>à tous' },
  { id: 2, type: 'Controller Examination', name: 'Exam', airports: [{ icao: 'LFPG' }], routes: [], start_time: soon(1), end_time: soon(2) }
] };
const IVO = [{ id: 9, title: 'Brest Overload', startDate: soon(3), endDate: soon(6), airports: ['LFRB', 'LFRR'], divisions: ['FR'], infoUrl: 'javascript:alert(1)', imageUrl: 'https://x/i.png', description: '<p>Hello &amp; welcome</p>', eventType: 'division_event', routes: null }];

test('VATSIM : format commun, examens écartés, routes et terrains géolocalisés, texte nettoyé', () => {
  const ev = E.normVatsim(VAT, LOOKUP);
  assert.strictEqual(ev.length, 1);
  const e = ev[0];
  assert.deepStrictEqual([e.id, e.network, e.name, e.link, e.organisers[0]], ['vatsim-1', 'vatsim', 'Paris Overload', 'https://my.vatsim.net/events/1', 'EUD / FRA']);
  assert.deepStrictEqual(e.airports.map(a => [a.icao, a.name, a.lat]), [['LFPG', 'Paris CDG', 49], ['EGLL', 'Heathrow', 51.5]]);
  assert.deepStrictEqual(e.routes, [{ dep: 'LFPG', arr: 'EGLL', route: 'DCT' }]);
  assert.strictEqual(e.description, 'Bienvenue\nà tous');
});

test('IVAO : terrains en texte, lien non https refusé, HTML retiré', () => {
  const e = E.normIvao(IVO, LOOKUP)[0];
  assert.deepStrictEqual([e.id, e.network, e.link, e.banner, e.type, e.description], ['ivao-9', 'ivao', null, 'https://x/i.png', 'division event', 'Hello & welcome']);
  assert.deepStrictEqual(e.airports.map(a => [a.icao, a.lat]), [['LFRB', null], ['LFRR', null]]);
});

test('fetchEvents : les deux réseaux triés par date, un réseau en panne garde ses events connus', async () => {
  E._reset();
  let ivaoUp = true;
  const fetchFn = async url => /vatsim/.test(url) ? { ok: true, json: async () => VAT }
    : ivaoUp ? { ok: true, json: async () => IVO } : { ok: false, status: 503 };
  const d = await E.fetchEvents(fetchFn, { lookupAirport: LOOKUP });
  assert.deepStrictEqual(d.events.map(e => e.id), ['vatsim-1', 'ivao-9']);
  ivaoUp = false;
  const d2 = await E.fetchEvents(fetchFn, { lookupAirport: LOOKUP, force: true });
  assert.strictEqual(d2.status.ivao.ok, false);
  assert.deepStrictEqual(d2.events.map(e => e.id), ['vatsim-1', 'ivao-9']);
});
