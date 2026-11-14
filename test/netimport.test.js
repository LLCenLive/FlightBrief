// Tests v2.1 : import des vols VATSIM / IVAO, export CSV du logbook, attitude au toucher : node --test
const test = require('node:test');
const assert = require('node:assert');
const { vatsimFlights, ivaoFlights, importVatsim, importIvao, aircraftType } = require('../netimport');
const FBImport = require('../renderer/logimport');
const { attitudeFromFast, crabFromPath } = require('../tracker');

const CONNS = { items: [
  { id: 3, type: 1, callsign: 'AFR23', start: '2026-11-10T10:00:00Z', end: null },                 // en cours : ignorée
  { id: 2, type: 1, callsign: 'AFR23', start: '2026-11-09T08:00:00Z', end: '2026-11-09T09:20:00Z' },
  { id: 1, type: 2, callsign: 'LFPG_TWR', start: '2026-11-08T08:00:00Z', end: '2026-11-08T10:00:00Z' }, // ATC
  { id: 0, type: 1, callsign: 'EZY1', start: '2026-11-07T08:00:00Z', end: '2026-11-07T09:00:00Z' }       // pas de plan de vol
], count: 4 };
const FPS = [
  { id: 11, connection_id: 0, callsign: 'AFR23', flight_type: 'I', aircraft: 'H/A20N/L', dep: 'LFPG', arr: 'LFBO', route: 'DCT', filed: '2026-11-09T07:55:00Z' },
  { id: 10, connection_id: 0, callsign: 'AFR23', flight_type: 'V', aircraft: 'C172/L-G', dep: 'LFPN', arr: 'LFPN', filed: '2026-10-01T07:55:00Z' }
];

test('aircraftType : code OACI tiré du champ plan de vol', () => {
  assert.strictEqual(aircraftType('B77L/H-SDE1E2E3FGHIJ2J3J4J5M1RWXY/LB1D1'), 'B77L');
  assert.strictEqual(aircraftType('H/A20N/L'), 'A20N');
  assert.strictEqual(aircraftType('C172'), 'C172');
});

test('VATSIM : connexions pilote terminées rapprochées du plan de vol (indicatif + horaire)', () => {
  const f = vatsimFlights(CONNS, FPS, '1234567');
  assert.strictEqual(f.length, 1);
  assert.deepStrictEqual([f[0].date, f[0].callsign, f[0].dep, f[0].arr, f[0].aircraft, f[0].rules, f[0].durationMin, f[0].network], ['2026-11-09', 'AFR23', 'LFPG', 'LFBO', 'A20N', 'IFR', 80, 'VATSIM']);
});

test('VATSIM : appel réseau, CID invalide refusé', async () => {
  const calls = [];
  const fetchFn = async url => { calls.push(url); return { ok: true, status: 200, json: async () => /flight_?plans/.test(url) ? FPS : CONNS }; };
  const r = await importVatsim(fetchFn, '1234567');
  assert.ok(r.ok);
  assert.strictEqual(r.flights.length, 1);
  assert.ok(calls.some(u => /members\/1234567\/history/.test(u)));
  assert.strictEqual((await importVatsim(fetchFn, 'abc')).ok, false);
});

test('IVAO : clé obligatoire, sessions pilote converties', async () => {
  assert.strictEqual((await importIvao(async () => ({}), '123456', '')).code, 'auth');
  const sessions = { items: [
    { id: 9, callsign: 'DLH4', connectionType: 'PILOT', createdAt: '2026-11-01T10:00:00Z', time: 5400, flightPlans: [{ departureId: 'EDDF', arrivalId: 'EDDM', aircraftId: 'A321', flightRules: 'I' }] },
    { id: 8, callsign: 'EDDF_TWR', connectionType: 'ATC', createdAt: '2026-11-01T08:00:00Z', time: 3600 }
  ], pages: 1 };
  let hdr = null;
  const r = await importIvao(async (url, o) => { hdr = o.headers; return { ok: true, status: 200, json: async () => sessions }; }, '123456', 'KEY');
  assert.ok(r.ok);
  assert.strictEqual(hdr.apiKey, 'KEY');
  assert.deepStrictEqual(r.flights.map(f => [f.dep, f.arr, f.durationMin, f.rules, f.network]), [['EDDF', 'EDDM', 90, 'IFR', 'IVAO']]);
  const denied = await importIvao(async () => ({ ok: false, status: 401 }), '123456', 'BAD');
  assert.strictEqual(denied.code, 'auth');
  assert.strictEqual(ivaoFlights({ items: [] }).length, 0);
});

test('export CSV ré-importable tel quel et dédoublonnage', () => {
  const flights = [{ id: 'a', date: '2026-11-01', callsign: 'AFR1', dep: 'LFPG', arr: 'LFBO', aircraft: 'A320; neo', rules: 'IFR', durationMin: 65, network: 'VATSIM', remarks: 'test "q"', distanceNm: 300, landingRateFpm: -120 }];
  const csv = FBImport.toCsv(flights, {});
  const parsed = FBImport.parseCsv(csv);
  const back = FBImport.toFlights(parsed, FBImport.detectColumns(parsed.headers), [], 'x').flights[0];
  assert.deepStrictEqual([back.date, back.dep, back.arr, back.aircraft, back.rules, back.durationMin, back.distanceNm, back.landingRateFpm, back.remarks], ['2026-11-01', 'LFPG', 'LFBO', 'A320; neo', 'IFR', 65, 300, -120, 'test "q"']);
  const d = FBImport.dedupe([{ id: 'x', date: '2026-11-01', dep: 'lfpg', arr: 'LFBO' }, { id: 'y', date: '2026-11-02', dep: 'LFPG', arr: 'LFBO' }], flights);
  assert.deepStrictEqual([d.flights.map(f => f.id), d.skipped.duplicate], [['y'], 1]);
});

test('attitude au toucher : assiette nez haut positive, crabe depuis la vitesse « avion »', () => {
  const a = attitudeFromFast({ pitch: -4.2, vbx: 10, vbz: 200 });
  assert.strictEqual(a.pitchDeg, 4.2);
  assert.ok(Math.abs(a.crabDeg - 2.9) < 0.05);
  assert.strictEqual(attitudeFromFast({ pitch: 1, vbx: 0, vbz: 2 }).crabDeg, undefined); // trop lent : pas de crabe
  // Repli 1 Hz : route plein nord, nez au 355 → trajectoire 5° à droite du nez.
  assert.strictEqual(crabFromPath({ lat: 45, lon: 2 }, { lat: 45.01, lon: 2, hdg: 355 }), 5);
});
