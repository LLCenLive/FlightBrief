// Détection décollage / atterrissage du tracker : node --test
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { FlightTracker } = require('../tracker');

// Rejoue une suite d'échantillons (1 par seconde) dans le tracker, horloge simulée.
function run(segments) {
  const t = new FlightTracker(path.join(__dirname, '..', 'renderer'));
  const realNow = Date.now;
  let now = Date.parse('2026-10-14T12:00:00Z');
  Date.now = () => now;
  const ends = [];
  t.on('flight-end', r => ends.push(r));
  try {
    for (const seg of segments) {
      if (seg.sys !== undefined) t._sys = seg.sys;
      for (let i = 0; i < seg.n; i++) {
        if (t._sys) t._sys.ts = now;
        const f = seg.n > 1 ? i / (seg.n - 1) : 0;
        const lat = seg.from.lat + (seg.to.lat - seg.from.lat) * f;
        const lon = seg.from.lon + (seg.to.lon - seg.from.lon) * f;
        t._processTelemetry({ lat, lon, altFt: seg.alt || 0, iasKt: seg.gs, gsKt: seg.gs, vsFpm: seg.vs || 0, headingDeg: 0, bankDeg: 0, pitchDeg: 0, onGround: seg.ground ? 1 : 0, fuelLbs: 1000, comFreqMhz: 122.8, title: 'TBM 850' });
        now += 1000;
      }
    }
    const autoEnds = ends.length; // vols clôturés tout seuls, avant l'arrêt manuel ci-dessous
    return { tracker: t, ends, autoEnds, stop: t.stopTracking() };
  } finally { Date.now = realNow; }
}

const LEMD = { lat: 40.4888, lon: -3.5875 }, LEPP = { lat: 42.775, lon: -1.650 };

test('roulage rapide (> 40 kt au sol) puis vrai vol : pas de faux atterrissage au départ', () => {
  const { ends, stop } = run([
    { n: 30, from: LEMD, to: LEMD, gs: 15, ground: true },
    { n: 3, from: LEMD, to: LEMD, gs: 42, ground: true },      // pointe de vitesse au roulage
    { n: 120, from: LEMD, to: LEMD, gs: 15, ground: true },    // > 90 s encore au sol
    { n: 20, from: LEMD, to: LEMD, gs: 90, ground: true },     // course au décollage
    { n: 3000, from: LEMD, to: LEPP, gs: 250, alt: 20000 },    // vol
    { n: 20, from: LEPP, to: LEPP, gs: 20, ground: true }      // atterrissage + roulage
  ]);
  assert.deepStrictEqual(stop, { ok: true });
  const r = ends[0];
  assert.strictEqual(r.depGuess.icao, 'LEMD');
  assert.strictEqual(r.arrGuess.icao, 'LEPP');
  assert.strictEqual(r.bounceCount, 0);
  assert.ok(r.durationMin >= 49, 'durée en vol complète');
  const lifts = r.path.filter(p => p.phase === 'liftoff');
  assert.strictEqual(lifts.length, 1, 'un seul décollage');
  assert.strictEqual(lifts[0].gsKt, 90, 'le décollage retenu est la vraie course au décollage');
});

test('vol normal toujours enregistré', () => {
  const { ends, stop } = run([
    { n: 30, from: LEMD, to: LEMD, gs: 15, ground: true },
    { n: 20, from: LEMD, to: LEMD, gs: 90, ground: true },
    { n: 600, from: LEMD, to: LEPP, gs: 250, alt: 10000 },
    { n: 20, from: LEPP, to: LEPP, gs: 20, ground: true }
  ]);
  assert.deepStrictEqual(stop, { ok: true });
  assert.strictEqual(ends.length, 1);
  assert.strictEqual(ends[0].bounceCount, 0);
});

const FLIGHT = [
  { n: 30, from: LEMD, to: LEMD, gs: 15, ground: true },
  { n: 20, from: LEMD, to: LEMD, gs: 90, ground: true },
  { n: 600, from: LEMD, to: LEPP, gs: 250, alt: 10000 },
  { n: 15, from: LEPP, to: LEPP, gs: 20, ground: true }
];

test('fin de vol : arrêt moteurs allumés (point d\'attente) → le vol continue', () => {
  const { autoEnds } = run([...FLIGHT, { n: 120, from: LEPP, to: LEPP, gs: 0, ground: true, sys: { eng1: 1, engines: 1, parkBrake: 0 } }]);
  assert.strictEqual(autoEnds, 0, 'pas de clôture tant que les moteurs tournent');
});

test('fin de vol : moteurs coupés → clôture en quelques secondes', () => {
  const { autoEnds } = run([...FLIGHT,
    { n: 60, from: LEPP, to: LEPP, gs: 0, ground: true, sys: { eng1: 1, engines: 1, parkBrake: 1 } },
    { n: 8, from: LEPP, to: LEPP, gs: 0, ground: true, sys: { eng1: 0, engines: 1, parkBrake: 1 } }]);
  assert.strictEqual(autoEnds, 1);
});

test('fin de vol : frein de parc serré 3 min moteurs allumés → clôture (filet de sécurité)', () => {
  const { autoEnds } = run([...FLIGHT, { n: 190, from: LEPP, to: LEPP, gs: 0, ground: true, sys: { eng1: 1, engines: 1, parkBrake: 1 } }]);
  assert.strictEqual(autoEnds, 1);
});

test('fin de vol : sans infos systèmes → 25 s d\'immobilité comme avant', () => {
  const { autoEnds } = run([...FLIGHT, { n: 30, from: LEPP, to: LEPP, gs: 0, ground: true, sys: null }]);
  assert.strictEqual(autoEnds, 1);
});

test('vol trop court : proposé (flight-rejected) au lieu d\'être effacé', () => {
  const t = new FlightTracker(path.join(__dirname, '..', 'renderer'));
  const realNow = Date.now; let now = Date.parse('2026-10-14T12:00:00Z'); Date.now = () => now;
  const rejected = [];
  t.on('flight-rejected', d => rejected.push(d));
  try {
    const tick = (o) => { t._processTelemetry({ lat: LEMD.lat, lon: LEMD.lon, altFt: o.alt || 0, iasKt: o.gs, gsKt: o.gs, vsFpm: 0, headingDeg: 0, bankDeg: 0, pitchDeg: 0, onGround: o.ground ? 1 : 0, fuelLbs: 1000, comFreqMhz: 122.8, title: 'C172' }); now += 1000; };
    for (let i = 0; i < 20; i++) tick({ gs: 15, ground: true });
    for (let i = 0; i < 60; i++) tick({ gs: 80, alt: 500 });   // 1 min en l'air
    for (let i = 0; i < 5; i++) tick({ gs: 10, ground: true });
    const r = t.stopTracking();
    assert.strictEqual(r.reason, 'too_short');
    assert.strictEqual(rejected.length, 1);
    assert.ok(rejected[0].result && Array.isArray(rejected[0].result.path) && rejected[0].result.path.length > 0);
  } finally { Date.now = realNow; }
});
