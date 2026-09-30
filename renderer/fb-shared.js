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
  // Distance d'un vol : mesurée (vol tracké), sinon saisie à la main, sinon orthodromie départ -> arrivée si les
  // coordonnées sont connues (lookup : OACI -> {lat, lon} | null).
  function flightDistance(f, lookup){
    const tracked = flightTrackedDistance(f);
    if(tracked != null) return { nm: tracked, estimated: false };
    // Vol ajouté à la main : distance saisie (ou estimée via le bouton « Estimer »).
    const manual = f && f.distanceNm != null && !isNaN(f.distanceNm) && Number(f.distanceNm) > 0 ? Number(f.distanceNm) : null;
    if(manual != null) return { nm: manual, estimated: false, manual: true };
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
  /* ---------------- Seuils de toucher PAR CATÉGORIE d'avion ----------------
     Réglés par l'utilisateur (Hangar → « Seuils de toucher »), en ft/min, valeur absolue :
     beurre < butter ≤ doux < smooth ≤ ferme < firm ≤ dur.
     Catégories du hangar : light / medium / heavy / jumbo ; « none » = avion sans catégorie
     ou vol non rattaché au hangar. Stocké dans userProfile.landingThresholds sous la forme
     { light:{butter,smooth,firm}, medium:{…}, heavy:{…}, jumbo:{…}, none:{…} }.
     LANDING_GRADES (sans catégorie) reste l'échelle par défaut, modifiée sur place. */
  const LANDING_CATEGORIES = ['light', 'medium', 'heavy', 'jumbo', 'none'];
  const DEFAULT_LANDING_THRESHOLDS = {
    light:  { butter: 80,  smooth: 180, firm: 300 },
    medium: { butter: 100, smooth: 240, firm: 400 },
    heavy:  { butter: 120, smooth: 280, firm: 450 },
    jumbo:  { butter: 140, smooth: 300, firm: 500 },
    none:   { butter: 100, smooth: 240, firm: 400 }
  };
  function catKey(cat){ return LANDING_CATEGORIES.includes(cat) ? cat : 'none'; }
  function normLandingThresholds(t, cat){
    const d = DEFAULT_LANDING_THRESHOLDS[catKey(cat)], n = v => { v = Math.round(Number(v)); return isFinite(v) && v > 0 ? v : null; };
    let b = n(t && t.butter) || d.butter, s = n(t && t.smooth) || d.smooth, f = n(t && t.firm) || d.firm;
    if(s <= b) s = b + 1;
    if(f <= s) f = s + 1;
    return { butter: b, smooth: s, firm: f };
  }
  function buildGrades(x){
    return [
      { key:'butter', label:`Beurre (< ${x.butter})`, max:x.butter, color:'#39e88f' },
      { key:'smooth', label:`Doux (${x.butter}–${x.smooth})`, max:x.smooth, color:'#54d6e8' },
      { key:'firm',   label:`Ferme (${x.smooth}–${x.firm})`, max:x.firm, color:'#ffb020' },
      { key:'hard',   label:`Dur (> ${x.firm})`, max:Infinity, color:'#ff5c5c' }
    ];
  }
  let _thresholds = {}, _gradesByCat = {};
  // Accepte aussi l'ancien format à un seul jeu de seuils ({butter, smooth, firm}).
  function setLandingThresholds(all){
    const legacy = all && all.butter != null ? all : null;
    _thresholds = {}; _gradesByCat = {};
    LANDING_CATEGORIES.forEach(c => {
      const src = legacy ? (c === 'none' || c === 'medium' ? legacy : null) : (all && all[c]);
      _thresholds[c] = normLandingThresholds(src, c);
      _gradesByCat[c] = buildGrades(_thresholds[c]);
    });
    buildGrades(_thresholds.none).forEach((g, i) => Object.assign(LANDING_GRADES[i], g));
    return JSON.parse(JSON.stringify(_thresholds));
  }
  function getLandingThresholds(){ return JSON.parse(JSON.stringify(_thresholds)); }
  function landingGradesFor(cat){ return _gradesByCat[catKey(cat)] || LANDING_GRADES; }
  // Catégorie d'un vol (celle de l'avion du hangar associé) : fournie par l'appli via
  // setFlightCategoryResolver, puisque l'association dépend du hangar.
  let _catResolver = () => null;
  function setFlightCategoryResolver(fn){ _catResolver = typeof fn === 'function' ? fn : () => null; }
  function flightCategory(f){ try{ return _catResolver(f) || null; }catch(e){ return null; } }
  function landingGrade(fpm, cat){
    if(fpm == null) return null;
    const a = Math.abs(fpm), grades = landingGradesFor(cat);
    return grades.find(g => a < g.max) || grades[grades.length - 1];
  }
  function flightLandingGrade(f){ return landingGrade(flightLandingRate(f), flightCategory(f)); }
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

  // cat : catégorie de l'avion (échelle de toucher). Non fournie → catégorie de chaque vol.
  function aircraftStats(flights, lookup, cat){
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
        const g = landingGrade(lr, cat !== undefined ? cat : flightCategory(f)); if(g) s.grades[g.key]++;
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

  /* ---------------- Schéma de piste vue du dessus ----------------
     Piste à l'échelle en longueur (la largeur est exagérée pour rester lisible), avec les
     marquages d'une piste aux instruments (standard FAA / OACI), aux deux extrémités :
       - seuil « touches de piano » (0 → 150 ft) ;
       - marques de zone de toucher tous les 500 ft : 3 bandes à 500 ft, point d'aiming
         (grosses bandes) à 1 000 ft, 3 bandes à 1 500 ft, 2 à 2 000 ft, 2 à 2 500 ft, 1 à 3 000 ft ;
       - zone de toucher (TDZ, 3 000 premiers pieds) légèrement surlignée.
     Les marques ne dépassent jamais la moitié de la piste (pistes courtes). */
  function runwayDiagramSvg(zone, opts){
    opts = opts || {};
    const w = opts.width || 360, h = opts.height || 96, margin = 14;
    const usableW = w - margin * 2, cy = h / 2, halfW = 17;
    const lenFt = Math.max(1, +zone.lengthFt || 0);
    const sc = usableW / lenFt;
    const pct = Math.max(0, Math.min(1, (+zone.percentAlongRunway || 0) / 100));
    const out = [];
    const bar = (x, y, bw, bh, cls) => out.push(`<rect class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1.2, bw).toFixed(1)}" height="${bh}"></rect>`);
    // Dessine un marquage longitudinal [fromFt, fromFt+lengthFt] depuis un seuil donné (dir = 1 : gauche, -1 : droite).
    // Longueur des bandes légèrement exagérée (minimum en px) pour rester lisible sur les pistes longues.
    const mark = (dir, fromFt, lengthFtMark, rows, bh, cls, minPx) => {
      if(fromFt + lengthFtMark > lenFt / 2) return;
      const bw = Math.max(minPx || 3.5, lengthFtMark * sc);
      const x = dir === 1 ? margin + fromFt * sc : w - margin - fromFt * sc - bw;
      rows.forEach(off => { bar(x, cy - off - bh, bw, bh, cls); bar(x, cy + off, bw, bh, cls); });
    };
    const tdzFt = Math.min(3000, lenFt / 3);
    [1, -1].forEach(dir => {
      // Zone de toucher surlignée
      const tx = dir === 1 ? margin : w - margin - tdzFt * sc;
      out.push(`<rect class="rwy-tdz-band" x="${tx.toFixed(1)}" y="${cy - halfW}" width="${(tdzFt * sc).toFixed(1)}" height="${halfW * 2}"></rect>`);
      // Seuil « touches de piano »
      mark(dir, 20, 150, [3, 6.5, 10, 13.5], 2, 'rwy-mark', 6);
      // Zone de toucher
      mark(dir, 500, 75, [5, 8.5, 12], 2, 'rwy-mark');
      mark(dir, 1020, 150, [5], 6, 'rwy-aim', 8);
      mark(dir, 1500, 75, [5, 8.5, 12], 2, 'rwy-mark');
      mark(dir, 2000, 75, [5, 8.5], 2, 'rwy-mark');
      mark(dir, 2500, 75, [5, 8.5], 2, 'rwy-mark');
      mark(dir, 3000, 75, [5], 2, 'rwy-mark');
    });
    const xPos = margin + pct * usableW;
    const lateralPx = Math.max(-(halfW + 6), Math.min(halfW + 6, (+zone.lateralOffsetFt || 0) / 8));
    const yPos = cy + (zone.side === 'droite' ? lateralPx : -lateralPx);
    const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
    return `<svg class="touchdown-diagram${opts.className ? ' ' + opts.className : ''}" ${opts.fluid ? 'width="100%"' : `width="${w}" height="${h}"`} viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      <rect x="${margin}" y="${cy - halfW}" width="${usableW}" height="${halfW * 2}" rx="1.5" fill="rgba(255,255,255,.05)" stroke="rgba(231,237,242,.14)"></rect>
      ${out.join('')}
      <line x1="${margin + 190 * sc > margin + usableW / 2 ? margin : margin + 190 * sc}" y1="${cy}" x2="${margin + usableW - 190 * sc < margin + usableW / 2 ? w - margin : w - margin - 190 * sc}" y2="${cy}" stroke="rgba(231,237,242,.35)" stroke-dasharray="7 6"></line>
      <line x1="${margin}" y1="${cy - halfW}" x2="${margin}" y2="${cy + halfW}" stroke="var(--phosphor, #39e88f)" stroke-width="2"></line>
      <circle cx="${xPos.toFixed(1)}" cy="${yPos.toFixed(1)}" r="6" fill="#ff5c5c" stroke="#fff" stroke-width="1.5"></circle>
      <text x="${margin}" y="${cy + halfW + 14}" class="axis-label">${esc(zone.runway)}</text>
      <text x="${(margin + tdzFt * sc / 2).toFixed(1)}" y="${cy - halfW - 5}" class="axis-label" text-anchor="middle">TDZ</text>
      <text x="${w - margin}" y="${cy + halfW + 14}" class="axis-label" text-anchor="end">${esc(Math.round(lenFt).toLocaleString('fr-FR'))} ft</text>
    </svg>`;
  }

  setLandingThresholds(null);
  const api = {
    up, low, haversineNm, greatCirclePoints,
    flightLandingRate, flightTrackedDistance, flightDistance,
    LANDING_GRADES, LANDING_CATEGORIES, DEFAULT_LANDING_THRESHOLDS, normLandingThresholds, setLandingThresholds, getLandingThresholds,
    landingGradesFor, setFlightCategoryResolver, flightCategory, landingGrade, flightLandingGrade, fmtFpm, fmtHm, fmtNm, fmtDateFr, daysBetween,
    hangarMatchKeys, assignFlightsToHangar, suggestHangarAircraft, aircraftStats,
    tourIsComplete, tourLegFlights, tourStats,
    runwayDiagramSvg
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FBShared = api;
})(typeof window !== 'undefined' ? window : globalThis);
