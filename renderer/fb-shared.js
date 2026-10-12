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
    if(!td) return f && f.landingRateFpm != null && !isNaN(f.landingRateFpm) ? Number(f.landingRateFpm) : null; // vol importé (v1.7)
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
    return nm == null ? '—' : Math.round(nm).toLocaleString(FBI18N.locale()) + ' NM';
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
      <text x="${w - margin}" y="${cy + halfW + 14}" class="axis-label" text-anchor="end">${esc(Math.round(lenFt).toLocaleString(FBI18N.locale()))} ft</text>
    </svg>`;
  }

  /* =========================================================
     v1.5 — NOTE D'ATTERRISSAGE (A+ … F, sur 100)
     ---------------------------------------------------------
     Combine ce qui fait un bon atterrissage, pas seulement le taux :
       taux de toucher (50 pts, selon les seuils de la catégorie de l'avion),
       facteur de charge au toucher (15), rebonds (10),
       zone de toucher : distance au seuil (15), écart à l'axe (10).
     Un critère non mesuré (ancien vol, piste non identifiée…) est simplement ignoré :
     la note est ramenée sur 100 à partir des critères disponibles. */
  function interp(x, xs, ys){
    if(x <= xs[0]) return ys[0];
    for(let i = 1; i < xs.length; i++){
      if(x <= xs[i]){ const t = (x - xs[i-1]) / (xs[i] - xs[i-1]); return ys[i-1] + t * (ys[i] - ys[i-1]); }
    }
    return ys[ys.length - 1];
  }
  const SCORE_LETTERS = [
    { min: 95, letter: 'A+', color: '#39e88f' }, { min: 85, letter: 'A', color: '#39e88f' },
    { min: 72, letter: 'B', color: '#54d6e8' }, { min: 58, letter: 'C', color: '#ffd166' },
    { min: 42, letter: 'D', color: '#ffb020' }, { min: -1, letter: 'F', color: '#ff5c5c' }
  ];
  // td : { fpm, gForce, bounces, zone:{distanceFromThresholdFt, lateralOffsetFt} }
  function landingScore(td, cat){
    if(!td || td.fpm == null || isNaN(td.fpm)) return null;
    const th = _thresholds[catKey(cat)] || DEFAULT_LANDING_THRESHOLDS.none;
    const a = Math.abs(td.fpm);
    const parts = [];
    parts.push({ key: 'rate', label: 'Taux de toucher', pts: interp(a, [0, th.butter, th.smooth, th.firm, th.firm * 1.6], [50, 47, 38, 22, 0]), max: 50 });
    if(td.gForce != null && !isNaN(td.gForce)) parts.push({ key: 'g', label: 'Facteur de charge', pts: interp(td.gForce, [1.0, 1.2, 1.4, 1.7, 2.1], [15, 15, 11, 5, 0]), max: 15 });
    if(td.bounces != null) parts.push({ key: 'bounce', label: 'Rebonds', pts: td.bounces <= 0 ? 10 : td.bounces === 1 ? 4 : 0, max: 10 });
    const z = td.zone;
    if(z && z.distanceFromThresholdFt != null){
      const d = z.distanceFromThresholdFt;
      const pts = d < 400 ? interp(d, [0, 400], [4, 12]) : d <= 2000 ? 15 : interp(d, [2000, 3000, 5000], [15, 10, 0]);
      parts.push({ key: 'zone', label: 'Distance au seuil', pts, max: 15 });
    }
    if(z && z.lateralOffsetFt != null) parts.push({ key: 'center', label: "Écart à l'axe", pts: interp(Math.abs(z.lateralOffsetFt), [0, 10, 25, 50, 80], [10, 10, 7, 3, 0]), max: 10 });
    const got = parts.reduce((s, p) => s + p.pts, 0), max = parts.reduce((s, p) => s + p.max, 0);
    const score = Math.round(100 * got / max);
    const l = SCORE_LETTERS.find(x => score >= x.min);
    return { score, letter: l.letter, color: l.color, parts: parts.map(p => ({ ...p, pts: Math.round(p.pts * 10) / 10 })), grade: landingGrade(td.fpm, cat) };
  }
  // Données d'un vol du logbook -> entrée de landingScore.
  function flightLandingInput(f){
    const td = f && f.trackData;
    const fpm = flightLandingRate(f);
    if(fpm == null) return null;
    const t = td && td.touchdown;
    return { fpm, gForce: t && t.gForce != null ? t.gForce : null, bounces: td ? (td.bounceCount || 0) : null, zone: t && t.zone ? t.zone : null };
  }
  function flightLandingScore(f){
    const inp = flightLandingInput(f);
    return inp ? landingScore(inp, flightCategory(f)) : null;
  }

  /* ---------------- Continent d'un aéroport (préfixe OACI) ----------------
     Les 1res lettres du code OACI désignent la région du monde. Pour la Russie (U…),
     on tranche Europe / Asie avec la longitude (Oural ≈ 60° E). */
  const CONTINENT_LABELS = { EU: 'Europe', AS: 'Asie', AF: 'Afrique', NA: 'Amérique du Nord', SA: 'Amérique du Sud', OC: 'Océanie' };
  function continentOf(icao, lon){
    const c = up(icao);
    if(!/^[A-Z]{2}/.test(c)) return null;
    const a = c[0], two = c.slice(0, 2);
    if(two === 'BI' || two === 'BK') return 'EU';           // Islande, Kosovo
    if(two === 'BG') return 'NA';                            // Groenland
    if(two === 'PA' || two === 'PH' || two === 'PF' || two === 'PO' || two === 'PP') return 'NA'; // Alaska, Hawaï
    if(two === 'GC') return 'AF';                            // Canaries
    if(two === 'LL' || two === 'LC') return 'AS';            // Israël, Chypre (Asie géographique)
    if(two === 'UA' || two === 'UB' || two === 'UC' || two === 'UT' || two === 'UG' || two === 'UD') return 'AS'; // Asie centrale, Caucase
    if(a === 'U') return lon != null && lon < 60 ? 'EU' : 'AS';
    if(a === 'E' || a === 'L') return 'EU';
    if(a === 'K' || a === 'C' || a === 'M' || a === 'T') return 'NA';
    if(a === 'S') return 'SA';
    if(a === 'D' || a === 'F' || a === 'G' || a === 'H') return 'AF';
    if(a === 'O' || a === 'V' || a === 'W' || a === 'Z' || a === 'R') return 'AS';
    if(a === 'Y' || a === 'N' || a === 'A' || a === 'P') return 'OC';
    return null;
  }

  /* ---------------- Hauteur du soleil (vol de nuit) ----------------
     Formule NOAA simplifiée (précision ~0,5°, largement suffisante ici). Nuit = soleil à
     plus de 6° sous l'horizon (fin du crépuscule civil), comme en aéronautique. */
  function sunElevationDeg(lat, lon, date){
    const d = new Date(date);
    if(isNaN(d) || lat == null || lon == null) return null;
    const rad = Math.PI / 180;
    const jd = d.getTime() / 86400000 + 2440587.5;
    const n = jd - 2451545.0;
    const L = (280.46 + 0.9856474 * n) % 360;
    const g = ((357.528 + 0.9856003 * n) % 360) * rad;
    const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
    const eps = (23.439 - 0.0000004 * n) * rad;
    const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
    const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
    const lst = (gmst * 15 + lon) * rad;
    const ha = lst - ra;
    const el = Math.asin(Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(ha));
    return el / rad;
  }
  function isNightAt(lat, lon, date){
    const e = sunElevationDeg(lat, lon, date);
    return e == null ? null : e < -6;
  }

  /* ---------------- v1.5 — icônes avion (vue de dessus, nez vers le haut, viewBox 64) ----------------
     4 styles au choix (Admin → Icône de l'avion). Couleur : variable CSS --plane-color,
     contour blanc pour rester lisible sur n'importe quel fond de carte. */
  const PLANE_ICONS = {
    airliner: { label: 'Avion de ligne', svg: '<path class="pl-body" d="M32 3C34.7 3 35.6 7.5 35.6 12V25L58.5 37.6Q60 38.5 60 40V41.2Q60 42.2 58.8 42L35.6 36.4V49.5L43.2 55.6Q44 56.3 44 57.3V58.2Q44 59 43.1 58.8L34.2 56.8L33 61Q32 62.3 31 61L29.8 56.8L20.9 58.8Q20 59 20 58.2V57.3Q20 56.3 20.8 55.6L28.4 49.5V36.4L5.2 42Q4 42.2 4 41.2V40Q4 38.5 5.5 37.6L28.4 25V12C28.4 7.5 29.3 3 32 3Z"/><ellipse class="pl-eng" cx="19.6" cy="31" rx="2.1" ry="4.3"/><ellipse class="pl-eng" cx="44.4" cy="31" rx="2.1" ry="4.3"/><path class="pl-hl" d="M32 6C33.3 6 33.8 9 33.8 12V50L32 54L30.2 50V12C30.2 9 30.7 6 32 6Z"/><path class="pl-glass" d="M29.8 10.2Q32 8.6 34.2 10.2L34 11.6Q32 10.6 30 11.6Z"/>' },
    ownship: { label: 'Silhouette', svg: '<path class="pl-body" d="M32 4.5Q35 4.5 35 9V23.5L57 31Q59.5 32 59.5 34.5V36.5L35 32.5V47L42.5 52.5V56.5L32 53.5L21.5 56.5V52.5L29 47V32.5L4.5 36.5V34.5Q4.5 32 7 31L29 23.5V9Q29 4.5 32 4.5Z"/>' },
    ga: { label: 'Aviation légère', svg: '<path class="pl-body" d="M30.4 6.5H33.6L34.4 18.5H58.5Q61 18.5 61 21V24.5Q61 26.5 58.5 26.5H34.2L33.4 46H41.5Q43 46 43 47.5V50.5Q43 52 41.5 52H33.2L32.8 58Q32 60 31.2 58L30.8 52H22.5Q21 52 21 50.5V47.5Q21 46 22.5 46H30.6L29.8 26.5H5.5Q3 26.5 3 24.5V21Q3 18.5 5.5 18.5H29.6Z"/><rect class="pl-prop" x="24.5" y="3.2" width="15" height="2.2" rx="1.1"/><path class="pl-hl" d="M31.3 9H32.7L33.2 44H30.8Z"/>' },
    arrow: { label: 'Flèche', svg: '<path class="pl-body" d="M32 4L55 57.5Q55.6 59.2 54 58.6L32 47.5L10 58.6Q8.4 59.2 9 57.5Z"/><path class="pl-hl" d="M32 12L47 51.5L32 44Z"/>' }
  };
  function planeSvg(style){
    const ic = PLANE_ICONS[style] || PLANE_ICONS.airliner;
    return '<svg class="fb-plane" viewBox="0 0 64 64" aria-hidden="true">' + ic.svg + '</svg>';
  }

  // v1.7 — Cartes d'aéroport en un clic (sites publics, ouverts dans le navigateur).
  function chartLinks(icao){
    icao = up(icao);
    if(!/^[A-Z0-9]{4}$/.test(icao)) return [];
    const out = [
      { label: 'ChartFox', url: `https://chartfox.org/${icao}` },
      { label: 'Navigraph', url: `https://charts.navigraph.com/airport/${icao}` },
      { label: 'SkyVector', url: `https://skyvector.com/airport/${icao}` }
    ];
    if(/^K/.test(icao)) out.push({ label: 'AirNav', url: `https://www.airnav.com/airport/${icao}` });
    out.push({ label: 'OurAirports', url: `https://ourairports.com/airports/${icao}/` });
    return out;
  }

  setLandingThresholds(null);
  const api = {
    chartLinks,
    up, low, haversineNm, greatCirclePoints,
    flightLandingRate, flightTrackedDistance, flightDistance,
    LANDING_GRADES, LANDING_CATEGORIES, DEFAULT_LANDING_THRESHOLDS, normLandingThresholds, setLandingThresholds, getLandingThresholds,
    landingGradesFor, setFlightCategoryResolver, flightCategory, landingGrade, flightLandingGrade, fmtFpm, fmtHm, fmtNm, fmtDateFr, daysBetween,
    hangarMatchKeys, assignFlightsToHangar, suggestHangarAircraft, aircraftStats,
    tourIsComplete, tourLegFlights, tourStats,
    runwayDiagramSvg,
    landingScore, flightLandingInput, flightLandingScore, SCORE_LETTERS, continentOf, CONTINENT_LABELS, sunElevationDeg, isNightAt, planeSvg, PLANE_ICONS
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FBShared = api;
})(typeof window !== 'undefined' ? window : globalThis);
