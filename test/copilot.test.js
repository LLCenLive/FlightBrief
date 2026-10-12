// Copilote vocal : un vol complet simulé, du roulage à la décélération : node --test
const test = require('node:test');
const assert = require('node:assert');
const { create, DEFAULTS } = require('../renderer/copilot');

function flight(groups, extra) {
  let clock = 0; const cp = create(() => clock), said = [];
  const cfg = { ...DEFAULTS, enabled: true, groups: { ...DEFAULTS.groups, ...groups } };
  const ctx = { cfg, airliner: true, airbus: true, cruiseAltFt: 36000, eta: '14:58', arr: 'Toulouse', todMin: null, ...extra };
  const sys = (o) => ({ gearDown: 1, flapsIdx: 2, landingLight: 1, seatbelts: 1, baroMb: 1018, ...o });
  const T = (o, s) => { clock += 1000; said.push(...cp.tick({ phase: 'airborne', onGround: false, gsKt: 250, iasKt: 250, bankDeg: 0, fuelLbs: 10000, ...o, sys: sys(s) }, ctx)); };
  const G = (o) => { clock += 1000; said.push(...cp.tick({ phase: 'ground', onGround: true, gsKt: 10, iasKt: 10, fuelLbs: 12000, ...o, sys: sys({}) }, ctx)); };
  G({ gsKt: 12, iasKt: 12 }); G({ gsKt: 70, iasKt: 70 }); G({ gsKt: 90, iasKt: 90 });       // roulage, 80 kt
  T({ altFt: 600, vsFpm: 2000, aglFt: 500 }, { gearDown: 1 });                               // vario positif, train sorti
  T({ altFt: 5400, vsFpm: 2000, aglFt: 5000 }, { gearDown: 0, flapsIdx: 0 });                // transition : standard
  T({ altFt: 9900, vsFpm: 2000, aglFt: 9500 }, { gearDown: 0, flapsIdx: 0, baroMb: 1013.25 });
  T({ altFt: 10100, vsFpm: 2000, aglFt: 9700 }, { gearDown: 0, flapsIdx: 0, baroMb: 1013.25 }); // FL100
  T({ altFt: 34900, vsFpm: 1500, aglFt: 34000 }, { gearDown: 0, flapsIdx: 0, baroMb: 1013.25 });
  T({ altFt: 35100, vsFpm: 1500, aglFt: 34200 }, { gearDown: 0, flapsIdx: 0, baroMb: 1013.25 }); // 1000 avant le niveau
  clock += 200000; T({ altFt: 36000, vsFpm: 0, aglFt: 35000 }, { gearDown: 0, flapsIdx: 0, baroMb: 1013.25 }); // niveau atteint
  ctx.todMin = 1.5; T({ altFt: 36000, vsFpm: 0, aglFt: 35000 }, { gearDown: 0, flapsIdx: 0, baroMb: 1013.25 }); ctx.todMin = null;
  T({ altFt: 10200, vsFpm: -2000, iasKt: 300, aglFt: 9800 }, { gearDown: 0, flapsIdx: 0, baroMb: 1013.25, landingLight: 0 });
  T({ altFt: 9900, vsFpm: -2000, iasKt: 300, aglFt: 9500 }, { gearDown: 0, flapsIdx: 0, baroMb: 1013.25, landingLight: 0 }); // FL100 : vitesse, phares
  T({ altFt: 5800, vsFpm: -1500, aglFt: 5400 }, { gearDown: 0, flapsIdx: 0, baroMb: 1013.25 }); // QNH
  T({ altFt: 1500, vsFpm: -800, iasKt: 150, aglFt: 1100 }, { gearDown: 1, flapsIdx: 3 });
  T({ altFt: 1350, vsFpm: -800, iasKt: 145, aglFt: 950 }, { gearDown: 1, flapsIdx: 3 });     // 1000 stabilisé
  T({ altFt: 850, vsFpm: -750, iasKt: 140, aglFt: 480 }, { gearDown: 1, flapsIdx: 3 });       // 500
  T({ altFt: 680, vsFpm: -700, iasKt: 140, aglFt: 290 }, { gearDown: 1, flapsIdx: 3 });       // approche des minimums
  T({ altFt: 580, vsFpm: -700, iasKt: 140, aglFt: 190 }, { gearDown: 1, flapsIdx: 3 });       // minimums
  [120, 95, 48, 39, 29, 19, 9].forEach(agl => said.push(...cp.fast({ agl, vs: -700 }, ctx)));
  said.push(...cp.landed({ fpm: -142, grade: 'doux' }, ctx));
  clock += 30000; G({ gsKt: 70, iasKt: 70 }); G({ gsKt: 55, iasKt: 55 }); clock += 30000; G({ gsKt: 20, iasKt: 20 });
  return said;
}

test('vol complet : toutes les annonces, dans l\'ordre', () => {
  assert.deepStrictEqual(flight({ cabin: true }), [
    "Mesdames et messieurs, bienvenue à bord. Merci d'attacher vos ceintures, nous allons rouler vers la piste.",
    'Quatre-vingts nœuds.', 'Vario positif.', 'Train toujours sorti.', 'Altitude de transition : calage standard.', 'Niveau 100.',
    'Mille pieds avant le niveau.', 'Niveau 360 atteint.', 'Ici le commandant. Nous sommes à notre altitude de croisière, arrivée prévue à 14:58.',
    'Début de descente dans deux minutes.', 'Niveau 100 : vitesse 250, phares.',
    "Nous avons commencé notre descente vers Toulouse. Merci de regagner vos sièges et d'attacher vos ceintures.",
    'Vitesse : 250 nœuds maximum sous le niveau 100.', 'Niveau de transition : calage QNH.',
    'Mille. Stabilisé.', 'Cinq cents.', 'Approche des minimums.', 'Minimums.',
    'Cent.', 'Cinquante.', 'Quarante.', 'Trente.', 'Vingt. Retard.', 'Dix.',
    'Toucher : 142 pieds par minute, doux.', 'Soixante nœuds.', "Mesdames et messieurs, bienvenue à Toulouse. Merci d'avoir voyagé avec nous."
  ]);
});

test('catégories coupées : rien de ce groupe', () => {
  const said = flight({ takeoff: false, approach: false, landing: false, cabin: false });
  assert.ok(!said.some(x => /Quatre-vingts|Vario|Mille\. |Minimums|Retard|Toucher|Soixante|Mesdames/.test(x)), said.join(' | '));
  assert.ok(said.includes('Niveau 100.'));
});

test('approche instable et alertes', () => {
  let clock = 0; const cp = create(() => clock);
  const ctx = { cfg: { ...DEFAULTS, groups: { ...DEFAULTS.groups } }, airliner: true };
  const T = (o, s) => { clock += 1000; return cp.tick({ phase: 'airborne', onGround: false, iasKt: 160, fuelLbs: 5000, ...o, sys: { gearDown: 0, flapsIdx: 0, ...s } }, ctx); };
  T({ altFt: 2000, vsFpm: -1500, aglFt: 1200 });
  const r = T({ altFt: 1800, vsFpm: -1500, aglFt: 980 });
  assert.deepStrictEqual(r, ['Mille. Instable : taux de descente, train, volets.', 'Taux de descente !']);
  assert.deepStrictEqual(T({ altFt: 1500, vsFpm: -2500, aglFt: 700, bankDeg: 40 }), ['Attention, train non sorti !', 'Inclinaison !']);
});

test('point de situation', () => {
  const cp = create();
  assert.deepStrictEqual(cp.brief({ altFt: 35000, gsKt: 452, onGround: false }, { remainingNm: 212, eta: '14:58' }), ['Niveau 350', 'vitesse sol 452 nœuds', '212 milles nautiques restants', 'arrivée prévue à 14:58']);
});
