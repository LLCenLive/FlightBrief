// Tests des amis sur la carte (positions par CID / VID) et de !vatsim / !ivao (v2.0) : node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findPilots, indexVatsimPilots, indexIvaoPilots } = require('../atc');
const { Cabin } = require('../cabin');
const { mergeConfig } = require('../twitch');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fb-test-'));
const VATSIM = { general: {}, controllers: [], atis: [], pilots: [
  { cid: 1234567, callsign: 'afr23', latitude: 46.1, longitude: 2.2, altitude: 35000, groundspeed: 452, heading: 190, flight_plan: { departure: 'LFPG', arrival: 'LFBO', aircraft_short: 'A20N' } },
  { cid: 7654321, callsign: 'EZY12', latitude: 45, longitude: 5, altitude: 12000, groundspeed: 300, heading: 90, flight_plan: null }
] };
const IVAO = { clients: { atcs: [], pilots: [{ userId: 654321, callsign: 'DLH4', lastTrack: { latitude: 50, longitude: 8, altitude: 8000, groundSpeed: 250, heading: 270 }, flightPlan: { departureId: 'EDDF', arrivalId: 'EDDM', aircraftId: 'A321' } }] } };

function fakeFetch() {
  const calls = [];
  const fn = async url => {
    calls.push(url);
    if (/vatsim-data/.test(url)) return { ok: true, json: async () => VATSIM };
    if (/whazzup/.test(url)) return { ok: true, json: async () => IVAO };
    return { ok: false, status: 404, text: async () => '', json: async () => ({}) }; // VATSpy : pas utile ici
  };
  fn.calls = calls;
  return fn;
}

test('index des pilotes VATSIM et IVAO', () => {
  const v = indexVatsimPilots(VATSIM.pilots).get('1234567');
  assert.deepStrictEqual(v, { network: 'vatsim', id: '1234567', callsign: 'AFR23', lat: 46.1, lon: 2.2, altFt: 35000, gsKt: 452, hdg: 190, dep: 'LFPG', arr: 'LFBO', aircraft: 'A20N' });
  assert.strictEqual(indexVatsimPilots(VATSIM.pilots).get('7654321').dep, '');
  const i = indexIvaoPilots(IVAO.clients.pilots).get('654321');
  assert.strictEqual(i.callsign, 'DLH4');
  assert.strictEqual(i.arr, 'EDDM');
});

test('findPilots : seuls les pilotes demandés et en ligne, sans doublon', async () => {
  const r = await findPilots(fakeFetch(), { cacheDir: tmp(), lookupAirport: () => null }, [
    { network: 'vatsim', id: '1234567', label: 'Kéro' }, { network: 'vatsim', id: '1234567', label: 'doublon' },
    { network: 'vatsim', id: '999999' }, { network: 'ivao', id: '654321', label: 'Lulu', viewer: true }, { network: 'vatsim', id: 'abc' }
  ]);
  assert.deepStrictEqual(r.pilots.map(p => [p.network, p.id, p.label, p.viewer]), [['vatsim', '1234567', 'Kéro', false], ['ivao', '654321', 'Lulu', true]]);
});

test('chat : !vatsim enregistre le CID, !vatsim retirer l\'efface, CID invalide refusé', () => {
  const replies = [];
  const c = new Cabin({
    file: path.join(tmp(), 'cabin.json'), rendererDir: path.join(__dirname, '..', 'renderer'), say: () => {}, reply: t => replies.push(t), alert: () => {},
    lookupAirport: () => null, getBriefing: () => ({}), getPhase: () => null, getCommandConfig: () => mergeConfig(null)
  });
  const msg = text => c.onMessage({ user: 'kero', displayName: 'Kero', text });
  msg('!vatsim 1234567');
  assert.match(replies.pop(), /CID VATSIM 1234567 enregistré/);
  msg('!ivao 6543');
  assert.deepStrictEqual(c.netIds(), [{ network: 'vatsim', id: '1234567', label: 'Kero', viewer: true }, { network: 'ivao', id: '6543', label: 'Kero', viewer: true }]);
  c.cooldowns.clear();
  msg('!vatsim pilote');
  assert.match(replies.pop(), /de 3 à 9 chiffres/);
  c.cooldowns.clear();
  msg('!vatsim retirer');
  assert.match(replies.pop(), /effacé/);
  assert.deepStrictEqual(c.netIds().map(x => x.network), ['ivao']);
  assert.ok(!JSON.stringify(c.publicExport()).includes('6543')); // jamais publié sur le carnet public
  clearTimeout(c._saveTimer);
});
