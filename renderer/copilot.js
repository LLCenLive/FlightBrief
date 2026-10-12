/* =========================================================
   FlightBrief — copilote vocal : moteur d'annonces (v1.7)
   ---------------------------------------------------------
   Reçoit la télémétrie du tracker (1 Hz) et, en courte finale, la hauteur sol rapide
   (~10 Hz), et renvoie les phrases à dire. Aucune synthèse vocale ici : v17.js s'en charge.
   Catégories activables une à une : décollage, montée & croisière, descente & approche,
   alertes, atterrissage, annonces cabine. Phrases en français, traduites à l'oral par i18n.js.
   ========================================================= */
(function (root) {
  const GROUPS = ['takeoff', 'climb', 'approach', 'alerts', 'landing', 'cabin'];
  const DEFAULTS = { enabled: false, volume: 80, rate: 1, voice: '', ta: 5000, minimums: 200, groups: { takeoff: true, climb: true, approach: true, alerts: true, landing: true, cabin: false } };
  const isStd = mb => mb != null && Math.abs(mb - 1013.25) < 0.6;
  const fl = ft => ft >= 10000 ? `niveau ${Math.round(ft / 100)}` : `${Math.round(ft / 100) * 100} pieds`;

  function create(nowFn) {
    const now = nowFn || (() => Date.now());
    let st;
    const reset = () => { st = { last: {}, once: new Set(), prevAgl: null, prevAlt: null, prevIas: null, airborneAt: null, landedAt: null, fuel0: null, taxiing: false }; };
    reset();
    const cool = (k, sec) => { const n = now(); if (st.last[k] && n - st.last[k] < sec * 1000) return false; st.last[k] = n; return true; };
    const once = k => { if (st.once.has(k)) return false; st.once.add(k); return true; };
    const crossDown = (prev, cur, h) => prev != null && cur != null && prev > h && cur <= h;
    const crossUp = (prev, cur, h) => prev != null && cur != null && prev < h && cur >= h;

    // t : télémétrie ; ctx : { cfg, airliner, airbus, cruiseAltFt, todMin, todState, eta, arr, dep }
    function tick(t, ctx) {
      const out = [], c = ctx.cfg, g = c.groups || {}, s = t.sys || {}, say = x => out.push(x);
      const air = t.phase === 'airborne' && !t.onGround;
      const alt = t.altFt, vs = t.vsFpm || 0, agl = t.aglFt, ias = t.iasKt || 0;
      if (st.fuel0 == null && t.fuelLbs > 0) st.fuel0 = t.fuelLbs;

      if (!air) {
        // Au sol : roulage, course au décollage, décélération après l'atterrissage.
        if (g.cabin && !st.landedAt && t.gsKt > 5 && !st.taxiing && once('cabin-welcome')) { st.taxiing = true; say('Mesdames et messieurs, bienvenue à bord. Merci d\'attacher vos ceintures, nous allons rouler vers la piste.'); }
        if (g.takeoff && !st.landedAt && crossUp(st.prevIas, ias, 80) && once('80kt')) say('Quatre-vingts nœuds.');
        if (g.landing && st.landedAt && crossDown(st.prevIas, ias, 60) && once('60kt')) say('Soixante nœuds.');
        if (g.cabin && st.landedAt && t.gsKt < 30 && now() - st.landedAt > 20000 && once('cabin-arrival')) say(ctx.arr ? `Mesdames et messieurs, bienvenue à ${ctx.arr}. Merci d'avoir voyagé avec nous.` : "Mesdames et messieurs, bienvenue à destination. Merci d'avoir voyagé avec nous.");
        st.prevIas = ias; st.prevAgl = null; st.prevAlt = alt;
        return out;
      }
      if (!st.airborneAt) st.airborneAt = now();
      const flying = now() - st.airborneAt, climbing = vs > 300, descending = vs < -300;

      // Décollage
      if (g.takeoff) {
        if (climbing && flying < 60000 && once('posrate')) say('Vario positif.');
        if (ctx.airliner && s.gearDown === 1 && climbing && agl != null && agl > 400 && flying < 180000 && once('gearup')) say('Train toujours sorti.');
      }
      // Montée & croisière
      if (g.climb) {
        if (s.baroMb != null) {
          if (alt < c.ta - 500) st.once.delete('std');
          if (climbing && alt > c.ta + 200 && !isStd(s.baroMb) && once('std')) say('Altitude de transition : calage standard.');
        }
        if (climbing && crossUp(st.prevAlt, alt, 10000) && once('fl100up')) say('Niveau 100.');
        if (ctx.cruiseAltFt > 3000) {
          if (climbing && crossUp(st.prevAlt, alt, ctx.cruiseAltFt - 1000) && once('1000togo')) say('Mille pieds avant le niveau.');
          if (Math.abs(alt - ctx.cruiseAltFt) < 150 && Math.abs(vs) < 300 && flying > 120000 && once('cruise')) {
            say(`${fl(ctx.cruiseAltFt).replace(/^./, m => m.toUpperCase())} atteint.`);
            if (g.cabin) say(ctx.eta ? `Ici le commandant. Nous sommes à notre altitude de croisière, arrivée prévue à ${ctx.eta}.` : 'Ici le commandant. Nous sommes à notre altitude de croisière. Bon vol à tous.');
          }
        }
        if (ctx.todMin != null && ctx.todMin > 0 && ctx.todMin <= 2 && ctx.todState !== 'passed' && once('tod')) say('Début de descente dans deux minutes.');
      }
      // Descente & approche
      if (g.approach) {
        if (s.baroMb != null) {
          if (alt > c.ta + 1500) st.once.delete('qnh');
          if (descending && alt < c.ta + 1000 && isStd(s.baroMb) && once('qnh')) say('Niveau de transition : calage QNH.');
        }
        if (descending && crossDown(st.prevAlt, alt, 10000) && once('fl100down')) {
          const todo = [];
          if (ias > 260) todo.push('vitesse 250');
          if (s.landingLight === 0) todo.push('phares');
          if (ctx.airliner && s.seatbelts === 0) todo.push('consignes ceintures');
          say(todo.length ? `Niveau 100 : ${todo.join(', ')}.` : 'Niveau 100.');
          if (g.cabin) say(ctx.arr ? `Nous avons commencé notre descente vers ${ctx.arr}. Merci de regagner vos sièges et d'attacher vos ceintures.` : 'Nous avons commencé notre descente. Merci de regagner vos sièges et d\'attacher vos ceintures.');
        }
        if (agl != null && descending) {
          if (crossDown(st.prevAgl, agl, 1000)) {
            const why = [];
            if (vs < -1100) why.push('taux de descente');
            if (s.gearDown === 0) why.push('train');
            if (ctx.airliner && s.flapsIdx === 0) why.push('volets');
            say(why.length ? `Mille. Instable : ${why.join(', ')}.` : 'Mille. Stabilisé.');
          } else if (crossDown(st.prevAgl, agl, 500)) say(vs < -1100 || s.gearDown === 0 ? 'Cinq cents. Instable, remise de gaz.' : 'Cinq cents.');
          else if (c.minimums > 0 && crossDown(st.prevAgl, agl, c.minimums + 100)) say('Approche des minimums.');
          else if (c.minimums > 0 && crossDown(st.prevAgl, agl, c.minimums)) say('Minimums.');
        }
      }
      // Alertes (façon GPWS)
      if (g.alerts && agl != null) {
        if (((agl < 2500 && vs < -2000) || (agl < 1000 && vs < -1300)) && cool('sink', 8)) say('Taux de descente !');
        if (s.gearDown === 0 && agl < 800 && descending && cool('gear', 15)) say('Attention, train non sorti !');
      }
      if (g.alerts) {
        if (Math.abs(t.bankDeg || 0) > 35 && cool('bank', 8)) say('Inclinaison !');
        if (alt < 10000 && ias > 265 && cool('spd', 120)) say('Vitesse : 250 nœuds maximum sous le niveau 100.');
        if (st.fuel0 > 0 && t.fuelLbs > 0 && t.fuelLbs < st.fuel0 * 0.1 && once('lowfuel')) say('Carburant bas.');
      }
      st.prevAgl = agl; st.prevAlt = alt; st.prevIas = ias;
      return out;
    }

    // Hauteur sol rapide en courte finale : 100, 50, 40, 30, 20, 10 (et « Retard » sur Airbus).
    function fast(sample, ctx) {
      const out = [], c = ctx.cfg;
      if (!(c.groups || {}).landing || sample.agl == null) return out;
      const prev = st.fastAgl; st.fastAgl = sample.agl;
      if (prev == null) return out;
      for (const h of [100, 50, 40, 30, 20, 10]) {
        if (prev > h && sample.agl <= h && once('ra' + h)) out.push(h === 20 && ctx.airbus ? 'Vingt. Retard.' : ({ 100: 'Cent.', 50: 'Cinquante.', 40: 'Quarante.', 30: 'Trente.', 20: 'Vingt.', 10: 'Dix.' })[h]);
      }
      return out;
    }

    function landed(info, ctx) {
      st.landedAt = now();
      if (!((ctx.cfg.groups || {}).landing) || info == null || info.fpm == null) return [];
      return [`Toucher : ${Math.abs(Math.round(info.fpm))} pieds par minute${info.grade ? ', ' + info.grade : ''}.`];
    }

    // Point de situation à la demande (bouton, Stream Deck) : morceaux traduits un à un à l'oral.
    function brief(t, ctx) {
      if (!t || t.altFt == null) return ['Pas de vol en cours'];
      const parts = [t.onGround ? 'Au sol' : `${fl(t.altFt).replace(/^./, m => m.toUpperCase())}`, `vitesse sol ${Math.round(t.gsKt || 0)} nœuds`];
      if (ctx.remainingNm != null) parts.push(`${Math.round(ctx.remainingNm)} milles nautiques restants`);
      if (ctx.eta) parts.push(`arrivée prévue à ${ctx.eta}`);
      return parts;
    }

    return { tick, fast, landed, brief, reset };
  }

  const api = { create, GROUPS, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FBCopilot = api;
})(typeof window !== 'undefined' ? window : globalThis);
