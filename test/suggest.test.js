// « Où voler aujourd'hui ? » sur les vraies données d'aéroports : node --test
const test = require('node:test');
const assert = require('node:assert');
const { suggest } = require('../suggest');
const raw = require('../renderer/data/airports.json');
const runways = require('../renderer/data/runways.json');
const airports = raw.map(r => ({ icao: r[0], name: r[1], lat: r[2], lon: r[3] }));
const LFPG = airports.find(a => a.icao === 'LFPG');

test('1 h 30 en A320 depuis CDG : terrains à bonne distance, pistes longues, directions variées', () => {
  const r = suggest(airports, runways, { from: LFPG, minutes: 90, profile: 'medium', visited: new Set(), random: () => 0.5 });
  assert.strictEqual(r.list.length, 3);
  r.list.forEach(c => {
    assert.ok(c.distanceNm >= r.targetNm * 0.75 && c.distanceNm <= r.targetNm * 1.1, c.icao + ' distance');
    assert.ok(c.runwayFt >= 5900, c.icao + ' piste');
  });
  const b = r.list.map(c => c.bearing);
  assert.ok(Math.abs(((b[0] - b[1] + 540) % 360) - 180) >= 60);
});

test('les terrains déjà visités passent après les nouveaux', () => {
  const first = suggest(airports, runways, { from: LFPG, minutes: 90, profile: 'medium', random: () => 0.5 }).list.map(c => c.icao);
  const r = suggest(airports, runways, { from: LFPG, minutes: 90, profile: 'medium', visited: new Set(first), random: () => 0.5 });
  assert.ok(r.list.every(c => !first.includes(c.icao) && c.isNew));
});

test('avion léger, 45 min : courtes distances', () => {
  const r = suggest(airports, runways, { from: LFPG, minutes: 45, profile: 'light', random: () => 0.5 });
  assert.ok(r.list.length === 3 && r.list.every(c => c.distanceNm < 80));
});

test('event VATSIM à l\'arrivée et ATC en ligne passent en tête', () => {
  const now = Date.UTC(2026, 9, 12, 18, 0);
  const events = new Map([['EGLL', { name: 'Heathrow Overload', start: now, end: now + 4 * 3600000 }]]);
  const atc = new Map([['EDDF', { nets: ['vatsim'], facs: ['TWR', 'APP'] }]]);
  const r = suggest(airports, runways, { from: LFPG, minutes: 60, profile: 'medium', random: () => 0.5, events, atc, preferAtc: true, now });
  const ic = r.list.map(c => c.icao);
  assert.ok(ic.includes('EGLL'), 'EGLL (event, plus proche que la fenêtre normale) proposé : ' + ic);
  assert.ok(ic.includes('EDDF'), 'EDDF (ATC en ligne) proposé : ' + ic);
  assert.strictEqual(r.list.find(c => c.icao === 'EGLL').event.name, 'Heathrow Overload');
});

test('mode « mes terrains préférés » : les plus fréquentés d\'abord', () => {
  const r = suggest(airports, runways, { from: LFPG, minutes: 90, profile: 'medium', random: () => 0.5, mode: 'fav', favCounts: { LFBO: 12, LEBL: 4 } });
  assert.deepStrictEqual(r.list.slice(0, 2).map(c => c.icao).sort(), ['LEBL', 'LFBO']);
});
