/* =========================================================
   FlightBrief — calculs partagés (appli PC + compagnon mobile)
   ---------------------------------------------------------
   Fonctions PURES (aucun accès au DOM, à Electron ou au réseau) :
   chargées à la fois par renderer/index.html (appli de bureau) et
   par renderer/mobile/index.html (compagnon téléphone servi en local),
   pour que les stats du Hangar et des tours soient calculées exactement
   de la même manière des deux côtés.
   ========================================================= */
(function(root){
  'use strict';

  function up(s){ return String(s || '').trim().toUpperCase(); }
  function low(s){ return String(s || '').trim().toLowerCase(); }

  function haversineNm(lat1, lon1, lat2, lon2){
    const R = 3440.065; // rayon terrestre en NM
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // Points intermédiaires d'un grand cercle (pour tracer une étape non trackée
  // sur une carte Leaflet avec sa vraie courbure plutôt qu'une ligne droite).
  function greatCirclePoints(a, b, n){
    n = n || 32;
    const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
    const lat1 = toRad(a.lat), lon1 = toRad(a.lon), lat2 = toRad(b.lat), lon2 = toRad(b.lon);
    const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2-lat1)/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2-lon1)/2) ** 2));
    if(!d) return [[a.lat, a.lon], [b.lat, b.lon]];
    const pts = [];
    for(let i = 0; i <= n; i++){
      const f = i / n;
      const A = Math.sin((1-f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
      const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
      const z = A * Math.sin(lat1) + B * Math.sin(lat2);
      pts.push([toDeg(Math.atan2(z, Math.sqrt(x*x + y*y))), toDeg(Math.atan2(y, x))]);
    }
    return pts;
  }

  /* ---------------- Accès aux données d'un vol du logbook ---------------- */
  function flightLandingRate(f){
    const td = f && f.trackData;
    if(!td) return null;
    const v = td.landingRateFpm != null ? td.landingRateFpm : td.landingRate;
    return (v == null || isNaN(v)) ? null : Number(v);
  }
  function flightTrackedDistance(f){
    const d = f && f.trackData && f.trackData.distanceNm;
    return (d == null || isNaN(d) || d <= 0) ? null : Number(d);
  }
  // Distance d'un vol : mesurée (vol tracké) sinon orthodromie départ -> arrivée si les
  // coordonnées sont connues (lookup : OACI -> {lat, lon} | null).
  function flightDistance(f, lookup){
    const tracked = flightTrackedDistance(f);
    if(tracked != null) return { nm: tracked, estimated: false };
    if(lookup && f && f.dep && f.arr){
      const a = lookup(up(f.dep)), b = lookup(up(f.arr));
      if(a && b) return { nm: Math.round(haversineNm(a.lat, a.lon, b.lat, b.lon)), estimated: true };
    }
    return { nm: null, estimated: false };
  }
  // Classement façon "landing rate" des communautés simu (valeur absolue en ft/min).
  const LANDING_GRADES = [
    { key:'butter', label:'Beurre (< 100)', max:100, color:'#39e88f' },
    { key:'smooth', label:'Doux (100–240)', max:240, color:'#54d6e8' },
    { key:'firm',   label:'Ferme (240–400)', max:400, color:'#ffb020' },
    { key:'hard',   label:'Dur (> 400)', max:Infinity, color:'#ff5c5c' }
  ];
  function landingGrade(fpm){
    if(fpm == null) return null;
    const a = Math.abs(fpm);
    return LANDING_GRADES.find(g => a < g.max) || LANDING_GRADES[LANDING_GRADES.length - 1];
  }
  function fmtFpm(v){
    if(v == null || isNaN(v)) return '—';
    const a = Math.round(Math.abs(v));
    return (a === 0 ? '0' : '−' + a) + ' ft/min';
  }
  function fmtHm(min){
    min = Math.round(min || 0);
    return Math.floor(min / 60) + 'h' + String(min % 60).padStart(2, '0');
  }
  function fmtNm(nm){
    return nm == null ? '—' : Math.round(nm).toLocaleString('fr-FR') + ' NM';
  }
  function fmtDateFr(iso){
    if(!iso) return '—';
    const s = String(iso).slice(0, 10);
    const [y, m, d] = s.split('-');
    return (y && m && d) ? `${d}/${m}/${y}` : s;
  }
  function daysBetween(isoA, isoB){
    if(!isoA || !isoB) return null;
    const a = new Date(String(isoA).slice(0,10) + 'T00:00:00Z'), b = new Date(String(isoB).slice(0,10) + 'T00:00:00Z');
    if(isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  /* =========================================================
     HANGAR — association vols <-> avions + statistiques par avion
     ========================================================= */
  // Mots-clés de reconnaissance d'un avion : ceux saisis par l'utilisateur + nom +
  // code OACI (+ immatriculation des fiches créées en v1.3.0). Un vol est associé automatiquement si le champ "Appareil" du
  // logbook (ou le nom de l'avion détecté dans le simulateur) contient l'un d'eux.
  function hangarMatchKeys(a){
    const keys = String(a.matchKeys || '').split(/[,;\n]/).map(low).filter(Boolean);
    [a.name, a.icaoType, a.registration].forEach(k => { const v = low(k); if(v) keys.push(v); });
    return Array.from(new Set(keys)).filter(k => k.length >= 2);
  }

  // Retourne { [aircraftId]: { aircraft, flights:[], autoCount }, _unassigned:[] }.
  // Priorité : lien explicite (f.aircraftId) > meilleure correspondance textuelle
  // (mot-clé le plus long, pour départager "A320" et "A320neo Air France").
  function assignFlightsToHangar(hangar, logbook){
    const res = { _unassigned: [] };
    (hangar || []).forEach(a => { res[a.id] = { aircraft: a, flights: [], autoCount: 0 }; });
    const keyed = (hangar || []).map(a => ({ a, keys: hangarMatchKeys(a) }));
    (logbook || []).forEach(f => {
      if(f.aircraftId && res[f.aircraftId]){ res[f.aircraftId].flights.push(f); return; }
      const hay = low(f.aircraft) + ' | ' + low(f.trackData && f.trackData.simAircraft);
      let best = null, bestLen = 0;
      keyed.forEach(({ a, keys }) => keys.forEach(k => {
        if(k.length > bestLen && hay.includes(k)){ best = a; bestLen = k.length; }
      }));
      if(best){ res[best.id].flights.push(f); res[best.id].autoCount++; }
      else res._unassigned.push(f);
    });
    return res;
  }

  // Suggestion d'avion du hangar pour un texte libre (champ Appareil, titre simu).
  function suggestHangarAircraft(hangar, ...texts){
    const hay = texts.map(low).join(' | ');
    if(!hay.replace(/[\s|]/g, '')) return null;
    let best = null, bestLen = 0;
    (hangar || []).forEach(a => hangarMatchKeys(a).forEach(k => {
      if(k.length > bestLen && hay.includes(k)){ best = a; bestLen = k.length; }
    }));
    return best;
  }

  function aircraftStats(flights, lookup){
    flights = flights || [];
    const s = {
      flights: flights.length, totalMin: 0, avgMin: null,
      distanceNm: 0, distanceEstimatedCount: 0, avgDistanceNm: null,
      trackedCount: 0, landingCount: 0, avgLandingFpm: null, bestLanding: null, worstLanding: null,
      bounceTotal: 0, flightsWithBounce: 0,
      maxAltFt: null, maxIasKt: null,
      fuelTotalLbs: 0, fuelMin: 0, fuelPerHourLbs: null,
      firstDate: null, lastDate: null, lastFlight: null,
      vfr: 0, ifr: 0, grades: {}, airports: {}
    };
    LANDING_GRADES.forEach(g => { s.grades[g.key] = 0; });
    let landingSum = 0, distCount = 0;
    flights.forEach(f => {
      s.totalMin += f.durationMin || 0;
      if(f.rules === 'VFR') s.vfr++; else if(f.rules === 'IFR') s.ifr++;
      const dist = flightDistance(f, lookup);
      if(dist.nm != null){ s.distanceNm += dist.nm; distCount++; if(dist.estimated) s.distanceEstimatedCount++; }
      const td = f.trackData;
      if(td){
        s.trackedCount++;
        if(td.maxAltFt != null) s.maxAltFt = Math.max(s.maxAltFt || 0, td.maxAltFt);
        if(td.maxIasKt != null) s.maxIasKt = Math.max(s.maxIasKt || 0, td.maxIasKt);
        if(td.bounceCount){ s.bounceTotal += td.bounceCount; s.flightsWithBounce++; }
        if(td.fuelUsedLbs != null && f.durationMin){ s.fuelTotalLbs += td.fuelUsedLbs; s.fuelMin += f.durationMin; }
      }
      const lr = flightLandingRate(f);
      if(lr != null){
        s.landingCount++;
        landingSum += Math.abs(lr);
        if(s.bestLanding == null || Math.abs(lr) < Math.abs(s.bestLanding.fpm)) s.bestLanding = { fpm: lr, flight: f };
        if(s.worstLanding == null || Math.abs(lr) > Math.abs(s.worstLanding.fpm)) s.worstLanding = { fpm: lr, flight: f };
        const g = landingGrade(lr); if(g) s.grades[g.key]++;
      }
      if(f.date){
        if(!s.firstDate || f.date < s.firstDate) s.firstDate = f.date;
        if(!s.lastDate || f.date >= s.lastDate){ s.lastDate = f.date; s.lastFlight = f; }
      }
      [f.dep, f.arr].forEach(icao => { const k = up(icao); if(k) s.airports[k] = (s.airports[k] || 0) + 1; });
    });
    s.avgMin = s.flights ? s.totalMin / s.flights : null;
    s.avgDistanceNm = distCount ? s.distanceNm / distCount : null;
    s.avgLandingFpm = s.landingCount ? -(landingSum / s.landingCount) : null;
    s.fuelPerHourLbs = s.fuelMin ? s.fuelTotalLbs / (s.fuelMin / 60) : null;
    return s;
  }

  /* =========================================================
     TOURS — association étapes <-> vols du logbook + statistiques
     ========================================================= */
  function tourIsComplete(t){
    return !!(t && Array.isArray(t.legs) && t.legs.length && t.legs.every(l => l.done));
  }

  // Associe chaque étape à un vol du logbook : lien mémorisé (leg.flightId) si le vol
  // existe encore, sinon meilleur candidat même départ/arrivée (priorité aux vols liés
  // à la carrière du tour, puis à ceux effectués avant la validation de l'étape).
  // Un vol n'est jamais associé à deux étapes.
  function tourLegFlights(career, tour, logbook){
    logbook = logbook || [];
    const used = new Set();
    const out = tour.legs.map(leg => {
      const f = leg.flightId ? logbook.find(x => x.id === leg.flightId) : null;
      if(f){ used.add(f.id); return f; }
      return null;
    });
    tour.legs.forEach((leg, i) => {
      if(out[i]) return;
      const doneDay = leg.doneAt ? String(leg.doneAt).slice(0, 10) : null;
      let best = null, bestScore = -1;
      logbook.forEach(f => {
        if(used.has(f.id) || up(f.dep) !== up(leg.dep) || up(f.arr) !== up(leg.arr)) return;
        let score = 0;
        if(career && f.careerId === career.id) score += 4;
        if(doneDay && f.date && f.date <= doneDay) score += 2;
        // À score égal : le plus récent (avant validation) l'emporte.
        if(score > bestScore || (score === bestScore && best && (f.date || '') > (best.date || ''))){ best = f; bestScore = score; }
      });
      if(best && (leg.done || bestScore >= 4)){ out[i] = best; used.add(best.id); }
    });
    return out;
  }

  function tourStats(career, tour, logbook, lookup){
    const legFlights = tourLegFlights(career, tour, logbook);
    let totalMin = 0, distanceNm = 0, estimated = 0, landingSum = 0, landingCount = 0, missingDistance = 0;
    const aircraft = {}, dates = [];
    const legs = tour.legs.map((leg, i) => {
      const f = legFlights[i];
      let dist = f ? flightDistance(f, lookup) : { nm: null, estimated: false };
      if(dist.nm == null && lookup){
        const a = lookup(up(leg.dep)), b = lookup(up(leg.arr));
        if(a && b) dist = { nm: Math.round(haversineNm(a.lat, a.lon, b.lat, b.lon)), estimated: true };
      }
      if(dist.nm != null){ distanceNm += dist.nm; if(dist.estimated) estimated++; } else missingDistance++;
      if(f){
        totalMin += f.durationMin || 0;
        if(f.aircraft) aircraft[f.aircraft] = (aircraft[f.aircraft] || 0) + 1;
        if(f.date) dates.push(f.date);
        const lr = flightLandingRate(f);
        if(lr != null){ landingSum += Math.abs(lr); landingCount++; }
      }
      if(leg.doneAt) dates.push(String(leg.doneAt).slice(0, 10));
      return { index: i, leg, flight: f, distanceNm: dist.nm, distanceEstimated: dist.estimated, landingFpm: f ? flightLandingRate(f) : null };
    });
    dates.sort();
    const firstFlightDate = legFlights.filter(Boolean).map(f => f.date).filter(Boolean).sort()[0] || null;
    const startDate = tour.startedAt ? String(tour.startedAt).slice(0,10) : (firstFlightDate || dates[0] || null);
    const doneAts = tour.legs.map(l => l.doneAt).filter(Boolean).sort();
    const lastFlightDate = legFlights.filter(Boolean).map(f => f.date).filter(Boolean).sort().pop() || null;
    const completedAt = tour.completedAt || doneAts[doneAts.length - 1] || lastFlightDate || null;
    const elapsedDays = daysBetween(startDate, completedAt);
    return {
      legs, legCount: tour.legs.length, doneCount: tour.legs.filter(l => l.done).length,
      linkedCount: legFlights.filter(Boolean).length,
      totalMin, distanceNm, distanceEstimatedCount: estimated, missingDistance,
      avgLandingFpm: landingCount ? -(landingSum / landingCount) : null, landingCount,
      startDate, completedAt, elapsedDays: elapsedDays == null ? null : elapsedDays + 1,
      aircraft
    };
  }

  const api = {
    up, low, haversineNm, greatCirclePoints,
    flightLandingRate, flightTrackedDistance, flightDistance,
    LANDING_GRADES, landingGrade, fmtFpm, fmtHm, fmtNm, fmtDateFr, daysBetween,
    hangarMatchKeys, assignFlightsToHangar, suggestHangarAircraft, aircraftStats,
    tourIsComplete, tourLegFlights, tourStats
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FBShared = api;
})(typeof window !== 'undefined' ? window : globalThis);
