// Import d'historique CSV (Little Navmap, Volanta, tableur français) : node --test
const test = require('node:test');
const assert = require('node:assert');
const I = require('../renderer/logimport');

test('Little Navmap : colonnes détectées, durée calculée depuis les heures réelles', () => {
  const csv = 'Aircraft Name,Aircraft Type,Aircraft Registration,Flightplan Number,Departure Ident,Departure Name,Departure Time Real,Destination Ident,Destination Name,Destination Time Real,Distance Flown nm,Description\n'
    + '"Fenix A320",A320,F-HBNA,AFR23F,LFPG,"Paris, CDG",2026-05-01 08:00:00,LFBO,Toulouse,2026-05-01 09:15:00,340,Vol test\n';
  const p = I.parseCsv(csv), map = I.detectColumns(p.headers);
  const { flights } = I.toFlights(p, map, [], 'lnm.csv');
  assert.strictEqual(flights.length, 1);
  const f = flights[0];
  assert.deepStrictEqual([f.date, f.dep, f.arr, f.callsign, f.durationMin, f.distanceNm], ['2026-05-01', 'LFPG', 'LFBO', 'AFR23F', 75, 340]);
  assert.strictEqual(f.aircraft, 'Fenix A320');
});

test('tableur français (point-virgule, jj/mm/aaaa, durée hh:mm, taux) + doublons', () => {
  const csv = 'Date;Départ;Arrivée;Avion;Durée;Taux au toucher\n13/02/2026;LFPG;LFML;A320;1:20;-145\n13/02/2026;LFPG;LFML;A320;1:20;-145\n2026-02-14;LFML;;A320;1:10;\n';
  const p = I.parseCsv(csv); assert.strictEqual(p.sep, ';');
  const map = I.detectColumns(p.headers);
  const existing = [{ date: '2026-01-01', dep: 'LFBO', arr: 'LFPG' }];
  const r = I.toFlights(p, map, existing, 'x');
  assert.strictEqual(r.flights.length, 1);
  assert.deepStrictEqual([r.flights[0].date, r.flights[0].durationMin, r.flights[0].landingRateFpm], ['2026-02-13', 80, -145]);
  assert.deepStrictEqual(r.skipped, { duplicate: 1, invalid: 1 });
});

test('dates américaines repérées sur le fichier, durées décimales en heures', () => {
  const csv = 'Flight Date,From,To,Flight Time (hours)\n05/02/2026,KJFK,KBOS,1.2\n05/25/2026,KBOS,KJFK,1.1\n';
  const p = I.parseCsv(csv), r = I.toFlights(p, I.detectColumns(p.headers), [], 'v');
  assert.deepStrictEqual(r.flights.map(f => [f.date, f.durationMin]), [['2026-05-02', 72], ['2026-05-25', 66]]);
});
