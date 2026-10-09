const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

let nodeSimconnect = null;
function loadSimconnect() {
  if (nodeSimconnect) return nodeSimconnect;
  nodeSimconnect = require('node-simconnect');
  return nodeSimconnect;
}

const DEF_ID = 1;
const REQ_ID = 1;

const VARS = [
  { name: 'PLANE LATITUDE', unit: 'degrees', key: 'lat' },
  { name: 'PLANE LONGITUDE', unit: 'degrees', key: 'lon' },
  // INDICATED ALTITUDE (et non PLANE ALTITUDE) : c'est la valeur lue sur l'altimètre du
  // cockpit, calée sur le calage altimétrique (QNH/Kohlsman) réglé par le pilote. PLANE
  // ALTITUDE est l'altitude vraie (MSL géométrique), indépendante de ce calage — d'où le
  // décalage rapporté entre le panneau de bord et le tracker dès que le QNH réglé n'est
  // pas exactement la pression locale (ex. calage 1013 laissé par erreur, ou pas remis à
  // jour en croisière).
  { name: 'INDICATED ALTITUDE', unit: 'feet', key: 'altFt' },
  { name: 'AIRSPEED INDICATED', unit: 'knots', key: 'iasKt' },
  { name: 'GROUND VELOCITY', unit: 'knots', key: 'gsKt' },
  { name: 'VERTICAL SPEED', unit: 'feet per minute', key: 'vsFpm' },
  { name: 'PLANE HEADING DEGREES TRUE', unit: 'degrees', key: 'headingDeg' },
  // Angle d'inclinaison (roulis) et d'assiette (tangage), utilisés pour évaluer la
  // qualité des virages (voir suivi de virage plus bas). Attention au signe SimConnect :
  // à vérifier en vol réel selon l'appareil (convention pas toujours cohérente entre
  // avions/add-ons) ; seule la valeur absolue du roulis est utilisée ci-dessous.
  { name: 'PLANE BANK DEGREES', unit: 'degrees', key: 'bankDeg' },
  { name: 'PLANE PITCH DEGREES', unit: 'degrees', key: 'pitchDeg' },
  { name: 'SIM ON GROUND', unit: 'bool', key: 'onGround' },
  { name: 'FUEL TOTAL QUANTITY WEIGHT', unit: 'pounds', key: 'fuelLbs' },
  { name: 'COM ACTIVE FREQUENCY:1', unit: 'MHz', key: 'comFreqMhz' },
  { name: 'TITLE', unit: null, key: 'title', string: true }
];

// v1.5 — Flux RAPIDE (~10 Hz), dans une définition SimConnect SÉPARÉE : si l'une de ces
// variables est refusée par une version du simulateur, seule cette définition tombe — la
// télémétrie principale ci-dessus continue d'arriver normalement (voir handle.on('exception')).
// Sert à mesurer l'atterrissage précisément : vitesse verticale exacte au toucher
// (PLANE TOUCHDOWN NORMAL VELOCITY, mémorisée par le simu à l'impact), pic de facteur de
// charge (G FORCE), vent au moment du toucher, et hauteur sol (paris Twitch, approche 3D).
const DEF_ID_FAST = 2;
const REQ_ID_FAST = 2;
const FAST_VARS = [
  { name: 'VERTICAL SPEED', unit: 'feet per minute', key: 'vs' },
  { name: 'G FORCE', unit: 'GForce', key: 'g' },
  { name: 'PLANE TOUCHDOWN NORMAL VELOCITY', unit: 'feet per second', key: 'tdv' },
  { name: 'AMBIENT WIND DIRECTION', unit: 'degrees', key: 'windDir' },
  { name: 'AMBIENT WIND VELOCITY', unit: 'knots', key: 'windKt' },
  { name: 'PLANE ALT ABOVE GROUND', unit: 'feet', key: 'agl' },
  { name: 'SIM ON GROUND', unit: 'bool', key: 'onGround' }
];
const FAST_BUFFER_MS = 9000;          // historique gardé en mémoire (glissant)
const TOUCHDOWN_FINALIZE_MS = 3000;   // délai avant de figer les mesures du toucher (pic de G + rebond éventuel)
const APPROACH_SAMPLE_MS = 1000;      // échantillonnage du trajet resserré sous 2 500 ft sol en descente (approche 3D)
const APPROACH_SAMPLE_AGL_FT = 2500;

// Composantes du vent par rapport à un cap (piste ou avion) : + = vent de face / venant de droite.
function windComponents(windDirDeg, windKt, refHdgDeg) {
  if (windDirDeg == null || windKt == null || refHdgDeg == null) return null;
  const a = (windDirDeg - refHdgDeg) * Math.PI / 180;
  return { headwindKt: Math.round(windKt * Math.cos(a)), crosswindKt: Math.round(windKt * Math.sin(a)) };
}

const AIRBORNE_SPEED_KT = 40;    // GS au-dessus duquel on considère l'avion en l'air même si le capteur onGround retarde
const STOPPED_GS_KT = 3;          // en dessous, on considère l'avion à l'arrêt (parqué)
const MIN_FLIGHT_MIN = 2;         // durée minimale en vol pour enregistrer un vol
const PARKED_TIMEOUT_MS = 25000;  // temps immobile après roulage avant de considérer le vol terminé
// Juste après le décollage, le capteur SIM ON GROUND peut repasser brièvement à vrai (train qui
// finit de se rétracter, rebond de suspension à la rotation) sans que l'avion touche vraiment le
// sol. Sous ce délai, un contact au sol est ignoré comme bruit capteur plutôt que traité comme un
// atterrissage — sinon il pollue le taux d'atterrissage/zone de toucher de tout le vol (voir le
// mécanisme "premier impact conservé" utilisé pour gérer les rebonds réels à l'atterrissage).
const MIN_AIRBORNE_BEFORE_LANDING_MS = 90000;
const AIR_SAMPLE_MS = 5000;       // fréquence d'échantillonnage du trajet en vol
const GROUND_SAMPLE_MS = 6000;    // fréquence d'échantillonnage au roulage

// Seuils de segmentation des phases (heuristique, cf. computePhases)
const INITIAL_CLIMB_AGL_FT = 1500;
const INITIAL_CLIMB_MAX_SEC = 12 * 60;
const FINAL_APPROACH_AGL_FT = 500;
const FINAL_APPROACH_MAX_SEC = 4 * 60;
const APPROACH_AGL_FT = 3000;
const APPROACH_MAX_SEC = 25 * 60;
const VS_THRESHOLD_FPM = 300;

// Détection des virages à partir de l'angle de roulis (bank). Un virage commence dès que
// |bank| dépasse TURN_BANK_THRESHOLD_DEG et se termine quand il repasse en dessous. Les seuils
// "serré"/"engagé" sont des repères génériques (vol de ligne/GA normal), à ajuster selon le
// type d'appareil si besoin (un avion de voltige tolère bien plus que 45°).
const TURN_BANK_THRESHOLD_DEG = 5;
const STEEP_TURN_BANK_DEG = 30;    // au-delà : virage serré, à surveiller
const AGGRESSIVE_TURN_BANK_DEG = 45; // au-delà : franchement inhabituel hors voltige

function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // rayon terrestre en NM
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function headingDiff(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Emplacements possibles des fichiers de données (airports.json, runways.json) : l'appli
// les cherche à plusieurs endroits plutôt que d'échouer si l'arborescence locale diffère
// (ex. dossier data/ à la racine du projet dans d'anciennes versions, ou ressources
// externes à côté de l'exécutable installé).
function findDataFile(name, rendererDir) {
  const res = process.resourcesPath || '';
  const candidates = [
    rendererDir && path.join(rendererDir, 'data', name),
    path.join(__dirname, 'renderer', 'data', name),
    path.join(__dirname, 'data', name),
    res && path.join(res, 'data', name),
    res && path.join(res, 'renderer', 'data', name),
    res && path.join(res, 'app.asar.unpacked', 'renderer', 'data', name)
  ].filter(Boolean);
  for (const p of candidates) { try { if (fs.existsSync(p)) return p; } catch (e) { /* suivant */ } }
  return candidates[0];
}

let airportIndex = null;
// Normalise airports.json en tableau [icao, nom, lat, lon, alt] quel que soit son format
// (tableau de tableaux, tableau d'objets, objet indexé par OACI). Un index vide n'est pas
// mémorisé : il sera relu au prochain appel.
function loadAirports(rendererDir) {
  if (airportIndex && airportIndex.length) return airportIndex;
  let list = [];
  try {
    const raw = JSON.parse(fs.readFileSync(findDataFile('airports.json', rendererDir), 'utf-8'));
    const entries = Array.isArray(raw) ? raw.map(e => [null, e]) : Object.entries(raw || {});
    for (const [key, e] of entries) {
      if (Array.isArray(e)) { if (Number.isFinite(+e[2]) && Number.isFinite(+e[3])) list.push([e[0], e[1], +e[2], +e[3], e[4]]); continue; }
      if (!e || typeof e !== 'object') continue;
      const icao = e.icao || e.ident || e.gps_code || e.id || key;
      const lat = +(e.lat ?? e.latitude ?? e.latitude_deg), lon = +(e.lon ?? e.lng ?? e.longitude ?? e.longitude_deg);
      if (icao && Number.isFinite(lat) && Number.isFinite(lon)) list.push([icao, e.name || '', lat, lon, e.elevFt ?? e.elevation_ft ?? null]);
    }
  } catch (e) { list = []; }
  airportIndex = list;
  if (list.length) airportGrid = null; // (re)construit sur la nouvelle liste
  return airportIndex;
}
let runwayIndex = null;
function loadRunways(rendererDir) {
  if (runwayIndex) return runwayIndex;
  try {
    runwayIndex = JSON.parse(fs.readFileSync(findDataFile('runways.json', rendererDir), 'utf-8'));
  } catch (e) { runwayIndex = {}; }
  return runwayIndex;
}

// Index spatial en grille (cellules de 1° x 1°) pour éviter de rebalayer tout le jeu
// d'aéroports (72k+ entrées depuis le passage au jeu complet OurAirports) à chaque
// appel de nearestAirport, qui est déclenché plusieurs fois par minute pendant le
// suivi de vol en direct.
let airportGrid = null;
function buildAirportGrid(list) {
  const grid = new Map();
  for (const entry of list) {
    const lat = entry[2], lon = entry[3];
    const key = Math.floor(lat) + '_' + Math.floor(lon);
    let cell = grid.get(key);
    if (!cell) { cell = []; grid.set(key, cell); }
    cell.push(entry);
  }
  return grid;
}

function nearestAirport(lat, lon, rendererDir) {
  const list = loadAirports(rendererDir);
  if (!list.length) return null;
  if (!airportGrid) airportGrid = buildAirportGrid(list);

  const cellLat = Math.floor(lat), cellLon = Math.floor(lon);
  let best = null, bestDist = Infinity;

  // Recherche par anneaux concentriques de cellules autour du point, du plus proche
  // au plus loin, jusqu'à être sûr qu'aucune cellule non explorée ne peut contenir un
  // aéroport plus proche que le meilleur candidat déjà trouvé (marge ~55 Nm/degré,
  // volontairement pessimiste pour rester correct près des pôles).
  for (let radius = 0; radius <= 20; radius++) {
    for (let dLat = -radius; dLat <= radius; dLat++) {
      for (let dLon = -radius; dLon <= radius; dLon++) {
        if (Math.max(Math.abs(dLat), Math.abs(dLon)) !== radius) continue; // anneau courant seulement
        const cell = airportGrid.get((cellLat + dLat) + '_' + (cellLon + dLon));
        if (!cell) continue;
        for (const [icao, name, alat, alon, elevFt] of cell) {
          const d = haversineNm(lat, lon, alat, alon);
          if (d < bestDist) { bestDist = d; best = { icao, name, distanceNm: Math.round(d * 10) / 10, elevFt: elevFt ?? null }; }
        }
      }
    }
    if (best && bestDist < radius * 55) break;
  }
  return best;
}

// Projette le point de toucher des roues sur la piste la plus probable de l'aéroport
// d'arrivée et calcule la distance depuis le seuil ainsi que l'écart latéral par rapport
// à l'axe.
//
// Choix de la piste : le cap seul ne suffit PAS. Des pistes parallèles (34L / 34C / 34R,
// 27L / 27R…) ont exactement le même QFU dans la base OurAirports : avant, la première de
// la liste gagnait, et un atterrissage parfait sur 34R était mesuré « à 300 m à droite »
// de 34C. Désormais chaque seuil compatible avec le cap est évalué GÉOMÉTRIQUEMENT et on
// garde celui dont l'axe passe le plus près du point de toucher, en pénalisant un toucher
// hors de la longueur de piste et, à peine, l'écart de cap.
const RUNWAY_HDG_TOLERANCE_DEG = 45;
function runwayGeometry(c, touchdownPoint) {
  const mPerDegLat = 111320;
  const cosLat = Math.cos(c.thresholdLat * Math.PI / 180);
  const toXY = (lat, lon) => ({ x: (lon - c.thresholdLon) * mPerDegLat * cosLat, y: (lat - c.thresholdLat) * mPerDegLat });
  const opp = toXY(c.oppositeLat, c.oppositeLon);
  const tdz = toXY(touchdownPoint.lat, touchdownPoint.lon);
  const rwyLenM = Math.hypot(opp.x, opp.y) || 1;
  const ux = opp.x / rwyLenM, uy = opp.y / rwyLenM; // vecteur unitaire seuil -> extrémité opposée
  return {
    rwyLenM,
    alongM: tdz.x * ux + tdz.y * uy,   // distance depuis le seuil, projetée sur l'axe
    lateralM: tdz.x * uy - tdz.y * ux  // écart perpendiculaire (signé, + = à droite)
  };
}
function computeTouchdownZone(touchdownPoint, arrIcao, rendererDir) {
  if (!arrIcao || !touchdownPoint) return null;
  const runways = loadRunways(rendererDir)[arrIcao];
  if (!runways || !runways.length) return null;

  let best = null;
  for (const rwy of runways) {
    if (rwy.leHdg == null || rwy.heHdg == null) continue;
    if (rwy.leLat == null || rwy.heLat == null) continue;
    const candidates = [
      { thresholdIdent: rwy.le, thresholdLat: rwy.leLat, thresholdLon: rwy.leLon, thresholdHdg: rwy.leHdg,
        oppositeLat: rwy.heLat, oppositeLon: rwy.heLon, oppositeIdent: rwy.he },
      { thresholdIdent: rwy.he, thresholdLat: rwy.heLat, thresholdLon: rwy.heLon, thresholdHdg: rwy.heHdg,
        oppositeLat: rwy.leLat, oppositeLon: rwy.leLon, oppositeIdent: rwy.le }
    ];
    for (const c of candidates) {
      const diff = touchdownPoint.hdg != null ? headingDiff(touchdownPoint.hdg, c.thresholdHdg) : 0;
      if (diff > RUNWAY_HDG_TOLERANCE_DEG) continue; // sens opposé / piste sécante
      const g = runwayGeometry(c, touchdownPoint);
      // Hors de la piste dans le sens de la longueur (avant le seuil ou après l'extrémité) :
      // pénalité proportionnelle, 150 m de marge avant le seuil (seuil décalé, toucher court).
      const outside = g.alongM < -150 ? (-150 - g.alongM) : g.alongM > g.rwyLenM ? (g.alongM - g.rwyLenM) : 0;
      const score = Math.abs(g.lateralM) + outside + diff * 3;
      if (!best || score < best.score) best = { ...c, ...g, diff, rwy, score };
    }
  }
  if (!best) return null; // aucune piste plausible

  const lengthFt = best.rwy.lengthFt || Math.round(best.rwyLenM * 3.28084);
  const distanceFromThresholdFt = Math.round(best.alongM * 3.28084);
  const lateralOffsetFt = Math.round(best.lateralM * 3.28084);

  return {
    runway: `${best.thresholdIdent}${best.oppositeIdent ? '/' + best.oppositeIdent : ''}`,
    // v1.5 : géométrie complète de la piste, pour l'approche rejouée en 3D et le vent traversier.
    thresholdIdent: best.thresholdIdent,
    thresholdLat: best.thresholdLat, thresholdLon: best.thresholdLon,
    oppositeLat: best.oppositeLat, oppositeLon: best.oppositeLon,
    runwayHdg: best.thresholdHdg,
    widthFt: best.rwy.widthFt || null,
    lengthFt,
    distanceFromThresholdFt: Math.max(0, Math.min(distanceFromThresholdFt, lengthFt)),
    percentAlongRunway: Math.round(Math.max(0, Math.min(100, (distanceFromThresholdFt / lengthFt) * 100))),
    lateralOffsetFt: Math.abs(lateralOffsetFt),
    side: lateralOffsetFt >= 0 ? 'droite' : 'gauche',
    headingMatchDeg: Math.round(best.diff)
  };
}

// Segmente après-coup un trajet en vol (points tagués 'liftoff'/'air'/'touchdown')
// en phases aéronautiques standard, avec un résumé par segment.
function computePhases(fullPath, depElevFt, arrElevFt) {
  const airPts = fullPath.filter(p => p.phase === 'liftoff' || p.phase === 'air' || p.phase === 'touchdown');
  if (airPts.length < 2) return [];

  const liftoffTs = airPts[0].ts;
  const touchdownTs = airPts[airPts.length - 1].ts;
  const depElev = depElevFt != null ? depElevFt : airPts[0].altFt;
  const arrElev = arrElevFt != null ? arrElevFt : airPts[airPts.length - 1].altFt;

  airPts.forEach((p, i) => {
    if (p.phase === 'liftoff' || p.phase === 'touchdown') return; // déjà tagués
    const aglDep = p.altFt - depElev;
    const aglArr = p.altFt - arrElev;
    const sinceLiftoffSec = (p.ts - liftoffTs) / 1000;
    const toTouchdownSec = (touchdownTs - p.ts) / 1000;
    const window = airPts.slice(Math.max(0, i - 2), i + 1);
    const vsAvg = window.reduce((s, w) => s + (w.vsFpm || 0), 0) / window.length;

    if (sinceLiftoffSec <= INITIAL_CLIMB_MAX_SEC && aglDep < INITIAL_CLIMB_AGL_FT) {
      p.subPhase = 'initial_climb';
    } else if (toTouchdownSec <= FINAL_APPROACH_MAX_SEC && aglArr < FINAL_APPROACH_AGL_FT) {
      p.subPhase = 'final_approach';
    } else if (toTouchdownSec <= APPROACH_MAX_SEC && aglArr < APPROACH_AGL_FT) {
      p.subPhase = 'approach';
    } else if (vsAvg > VS_THRESHOLD_FPM) {
      p.subPhase = 'climb';
    } else if (vsAvg < -VS_THRESHOLD_FPM) {
      p.subPhase = 'descent';
    } else {
      p.subPhase = 'cruise';
    }
  });
  airPts[0].subPhase = 'liftoff';
  airPts[airPts.length - 1].subPhase = 'touchdown';

  // Regroupe aussi les segments de roulage déjà tagués dans le chemin complet
  fullPath.forEach(p => { if (!p.subPhase) p.subPhase = p.phase === 'taxi_out' ? 'taxi_out' : p.phase === 'taxi_in' ? 'taxi_in' : p.subPhase; });

  // Fusionne en segments contigus de même sous-phase sur l'ensemble du trajet
  const segments = [];
  for (const p of fullPath) {
    const ph = p.subPhase || p.phase;
    const last = segments[segments.length - 1];
    if (last && last.phase === ph) {
      last.endTs = p.ts; last.endIdx++;
      last.maxAltFt = Math.max(last.maxAltFt, p.altFt);
      last.minAltFt = Math.min(last.minAltFt, p.altFt);
      last.maxIasKt = Math.max(last.maxIasKt, p.iasKt || 0);
      last._iasSum += p.iasKt || 0; last._n++;
      last._points.push(p);
    } else {
      segments.push({
        phase: ph, startTs: p.ts, endTs: p.ts, startIdx: segments.length, endIdx: segments.length,
        maxAltFt: p.altFt, minAltFt: p.altFt, maxIasKt: p.iasKt || 0,
        _iasSum: p.iasKt || 0, _n: 1, _points: [p]
      });
    }
  }
  return segmentPath(fullPath);
}

// Fusionne un trajet déjà tagué (subPhase/phase posé sur chaque point) en segments
// contigus avec un résumé par segment. Partagé par computePhases (vol terminé) et
// computeLivePhases (vol en cours), pour garder la même mise en forme dans les deux cas.
function segmentPath(fullPath) {
  const segments = [];
  for (const p of fullPath) {
    const ph = p.subPhase || p.phase;
    const last = segments[segments.length - 1];
    if (last && last.phase === ph) {
      last.endTs = p.ts; last.endIdx++;
      last.maxAltFt = Math.max(last.maxAltFt, p.altFt);
      last.minAltFt = Math.min(last.minAltFt, p.altFt);
      last.maxIasKt = Math.max(last.maxIasKt, p.iasKt || 0);
      last._iasSum += p.iasKt || 0; last._n++;
      last._points.push(p);
    } else {
      segments.push({
        phase: ph, startTs: p.ts, endTs: p.ts, startIdx: segments.length, endIdx: segments.length,
        maxAltFt: p.altFt, minAltFt: p.altFt, maxIasKt: p.iasKt || 0,
        _iasSum: p.iasKt || 0, _n: 1, _points: [p]
      });
    }
  }
  return segments.map(s => {
    let distanceNm = 0;
    for (let i = 1; i < s._points.length; i++) {
      distanceNm += haversineNm(s._points[i-1].lat, s._points[i-1].lon, s._points[i].lat, s._points[i].lon);
    }
    return {
      phase: s.phase,
      durationSec: Math.round((s.endTs - s.startTs) / 1000),
      distanceNm: Math.round(distanceNm * 10) / 10,
      maxAltFt: Math.round(s.maxAltFt),
      minAltFt: Math.round(s.minAltFt),
      avgIasKt: Math.round(s._iasSum / s._n),
      maxIasKt: Math.round(s.maxIasKt)
    };
  });
}

// Segmente le trajet EN COURS (avant l'atterrissage) en phases approximatives, pour
// alimenter les phases de vol et le rapport détaillé directement dans l'app au fil du
// vol. Contrairement à computePhases (appelée une fois le vol terminé), on ne connaît
// ni l'aéroport d'arrivée ni l'heure de toucher des roues : la classification se base
// sur l'altitude par rapport au sol (AGL, via l'aéroport le plus proche de la position
// courante) et sur la tendance récente du variomètre, plutôt que sur un compte à rebours
// vers un atterrissage qui n'a pas encore eu lieu.
function computeLivePhases(fullPath, depElevFt, rendererDir) {
  const workPath = fullPath.map(p => ({ ...p }));
  const airPts = workPath.filter(p => p.phase === 'liftoff' || p.phase === 'air');

  if (airPts.length < 1) {
    workPath.forEach(p => { if (!p.subPhase) p.subPhase = p.phase === 'taxi_out' ? 'taxi_out' : p.subPhase; });
    return segmentPath(workPath);
  }

  const liftoffTs = airPts[0].ts;
  const depElev = depElevFt != null ? depElevFt : airPts[0].altFt;
  let lastNearestElev = null;

  airPts.forEach((p, i) => {
    if (p.phase === 'liftoff') { p.subPhase = 'liftoff'; return; }
    const aglDep = p.altFt - depElev;
    const sinceLiftoffSec = (p.ts - liftoffTs) / 1000;
    const window = airPts.slice(Math.max(0, i - 2), i + 1);
    const vsAvg = window.reduce((s, w) => s + (w.vsFpm || 0), 0) / window.length;

    // Recalcul de l'aéroport le plus proche seulement de temps en temps (coûteux) :
    // sur le dernier point (position courante) et sinon à intervalle réduit.
    if (i === airPts.length - 1 || i % 4 === 0) {
      const near = nearestAirport(p.lat, p.lon, rendererDir);
      lastNearestElev = (near && near.distanceNm < 40) ? near.elevFt : null;
    }
    const aglNearest = lastNearestElev != null ? p.altFt - lastNearestElev : null;

    if (sinceLiftoffSec <= INITIAL_CLIMB_MAX_SEC && aglDep < INITIAL_CLIMB_AGL_FT) {
      p.subPhase = 'initial_climb';
    } else if (aglNearest != null && aglNearest < FINAL_APPROACH_AGL_FT && vsAvg < -100) {
      p.subPhase = 'final_approach';
    } else if (aglNearest != null && aglNearest < APPROACH_AGL_FT && vsAvg < -100) {
      p.subPhase = 'approach';
    } else if (vsAvg > VS_THRESHOLD_FPM) {
      p.subPhase = 'climb';
    } else if (vsAvg < -VS_THRESHOLD_FPM) {
      p.subPhase = 'descent';
    } else {
      p.subPhase = 'cruise';
    }
  });

  workPath.forEach(p => { if (!p.subPhase) p.subPhase = p.phase === 'taxi_out' ? 'taxi_out' : p.subPhase; });
  return segmentPath(workPath);
}

class FlightTracker extends EventEmitter {
  constructor(rendererDir, userDataDir) {
    super();
    this._rendererDir = rendererDir;
    // Dossier où sauvegarder une trace de secours du vol en cours, pour ne rien perdre en
    // cas de crash / fermeture inattendue avant l'envoi manuel du PIREP (voir _writeSnapshot).
    this._userDataDir = userDataDir || null;
    this._handle = null;
    this._connected = false;
    this._lastSnapshotAt = 0;
    this._fast = [];            // échantillons du flux rapide, FAST_BUFFER_MS glissants
    this._fastLast = null;      // dernier échantillon rapide reçu
    this._fastFailed = false;   // définition rapide refusée par le simu -> repli sur le flux 1 Hz
    this._fastSendIds = new Set();
    this._resetFlightState();
  }

  _snapshotPath() {
    if (!this._userDataDir) return null;
    return path.join(this._userDataDir, 'pending-flight.json');
  }

  // Écrit sur disque le meilleur résultat connu du vol en cours (ou tout juste terminé).
  // Volontairement silencieux en cas d'échec (jamais laisser une sauvegarde de secours
  // faire planter le tracking réel) — best effort uniquement.
  _writeSnapshot(result, final) {
    const p = this._snapshotPath();
    if (!p) return;
    try {
      fs.writeFileSync(p, JSON.stringify({ savedAt: Date.now(), final: !!final, result }));
    } catch (e) { /* sauvegarde de secours best-effort, on ignore un échec d'écriture */ }
  }

  // Supprime la sauvegarde de secours (vol correctement envoyé au logbook, ou volontairement
  // ignoré par l'utilisateur au redémarrage).
  clearPendingSnapshot() {
    const p = this._snapshotPath();
    if (!p) return;
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* rien de plus à faire */ }
  }

  // Relit la sauvegarde de secours si elle existe, pour proposer sa récupération au
  // démarrage de l'appli. Ne supprime rien elle-même — voir clearPendingSnapshot.
  loadPendingSnapshot() {
    const p = this._snapshotPath();
    if (!p) return null;
    try {
      if (!fs.existsSync(p)) return null;
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { return null; }
  }

  _resetFlightState() {
    this._lastSnapshotAt = 0;
    this._simTitle = null; // titre de l'avion dans le simu (associé au Hangar côté renderer)
    this._phase = 'idle'; // idle -> ground (taxi/parqué) -> airborne -> landed (roulage) -> idle
    this._path = [];
    this._start = null;
    this._end = null;
    this._firstMoveTs = null;
    this._hasBeenAirborne = false;
    this._takeoffAt = null;
    this._touchdownAt = null;
    this._touchdownPoint = null;
    this._maxAltFt = 0;
    this._maxIasKt = 0;
    this._initFuel = null;
    this._lastFuel = null;
    this._lastVs = 0;
    this._landingRate = null;
    // Rebonds : le nombre de fois où l'avion redécolle brièvement après un premier toucher
    // (touch-and-go non intentionnel compris). Le tout premier toucher (voir _processTelemetry,
    // cas 'airborne') reste la référence pour landingRate/touchdownPoint/touchdownAt, même en
    // cas de rebond — avant, chaque rebond écrasait ces valeurs avec le DERNIER impact.
    this._bounceCount = 0;
    // Virages : voir _trackBank. this._turns accumule chaque virage terminé de ce vol.
    this._inTurn = false;
    this._turnMaxBank = 0;
    this._maxBankDeg = 0;
    this._turns = [];
    this._lastPathTs = 0;
    this._stationarySince = null;
    this._liveDepGuess = null; // aéroport de départ deviné, mis en cache dès le 1er point du trajet
    this._lastProgressTs = 0;
    // v1.5 — mesures fines du toucher (voir _finalizeTouchdown)
    this._flightToken = (this._flightToken || 0) + 1; // invalide un minuteur de toucher d'un vol précédent
    this._tdFinalized = false;
    this._tdTimer && clearTimeout(this._tdTimer);
    this._tdTimer = null;
    this._tdvAirborne = null; // dernière valeur de PLANE TOUCHDOWN NORMAL VELOCITY vue en vol (= celle du vol précédent)
  }

  isConnected() { return this._connected; }

  async connect() {
    if (this._connected) return { ok: true, already: true };
    const sc = loadSimconnect();
    const TIMEOUT_MS = 8000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Simulateur non détecté (MSFS doit être lancé et un vol chargé).')), TIMEOUT_MS));
    const { recvOpen, handle } = await Promise.race([
      sc.open('FlightBrief', sc.Protocol.KittyHawk),
      timeoutPromise
    ]);
    this._handle = handle;
    this._connected = true;

    VARS.forEach((v, i) => {
      if (v.string) handle.addToDataDefinition(DEF_ID, v.name, null, sc.SimConnectDataType.STRING256, 0, i);
      else handle.addToDataDefinition(DEF_ID, v.name, v.unit, sc.SimConnectDataType.FLOAT64, 0, i);
    });
    handle.requestDataOnSimObject(REQ_ID, DEF_ID, 0, sc.SimConnectPeriod.SECOND, 0, 0, 0, 0);

    // Flux rapide (~10 Hz) dans sa propre définition : voir FAST_VARS.
    this._fast = []; this._fastLast = null; this._fastFailed = false; this._fastSendIds = new Set();
    try {
      FAST_VARS.forEach((v, i) => {
        const id = handle.addToDataDefinition(DEF_ID_FAST, v.name, v.unit, sc.SimConnectDataType.FLOAT64, 0, i);
        if (typeof id === 'number') this._fastSendIds.add(id);
      });
      const rid = handle.requestDataOnSimObject(REQ_ID_FAST, DEF_ID_FAST, 0, sc.SimConnectPeriod.SIM_FRAME, 0, 0, 5, 0);
      if (typeof rid === 'number') this._fastSendIds.add(rid);
    } catch (e) {
      this._fastFailed = true;
      console.error('[FlightBrief] [SimConnect] flux rapide indisponible :', e.message);
    }

    handle.on('simObjectData', packet => {
      if (packet && packet.requestID === REQ_ID_FAST) this._handleFastPacket(packet);
      else this._handlePacket(packet);
    });
    handle.on('quit', () => this._handleDisconnect());
    handle.on('close', () => this._handleDisconnect());
    handle.on('error', err => {
      console.error('[FlightBrief] [SimConnect] erreur:', err.message);
      this.emit('status', { connected: this._connected, error: err.message });
    });
    // Sans ce listener, une variable SimConnect invalide (mauvais nom/unité) fait échouer
    // silencieusement TOUTE la remontée de télémétrie — aucune erreur visible nulle part,
    // juste plus aucune donnée qui arrive. On journalise et on remonte un statut d'erreur
    // explicite dès qu'une exception SimConnect survient, pour ne plus jamais avoir à
    // deviner pourquoi le tracking ne réagit plus.
    handle.on('exception', exc => {
      // Exception sur le flux rapide (variable inconnue d'une version du simu…) : on le
      // désactive sans bruit, le flux principal et la mesure 1 Hz prennent le relais.
      if (exc && this._fastSendIds.has(exc.sendId)) {
        this._fastFailed = true;
        console.warn('[FlightBrief] [SimConnect] flux rapide refusé (variable', (FAST_VARS[exc.index] || {}).name || '?', ') — repli sur la mesure 1 Hz.');
        return;
      }
      const badVar = (exc && typeof exc.index === 'number' && VARS[exc.index]) ? VARS[exc.index].name : null;
      console.error('[FlightBrief] [SimConnect] exception reçue', exc, badVar ? `(variable suspectée : ${badVar})` : '');
      this.emit('status', {
        connected: this._connected,
        error: `Erreur SimConnect${badVar ? ' sur la variable ' + badVar : ''} (code ${exc && exc.exception}). Le tracking peut ne plus recevoir de données.`
      });
    });

    this.emit('status', { connected: true, sim: recvOpen.applicationName });
    return { ok: true, sim: recvOpen.applicationName };
  }

  disconnect() {
    if (this._handle) { try { this._handle.close(); } catch (e) { /* déjà fermé */ } }
    this._handleDisconnect();
  }

  _handleDisconnect() {
    if (!this._connected) return;
    this._connected = false;
    this._handle = null;
    if (this._phase === 'airborne' || this._phase === 'landed') this._terminateFlight();
    this._resetFlightState();
    this.emit('status', { connected: false });
  }

  _handlePacket(packet) {
    const d = packet.data;
    const data = {};
    VARS.forEach(v => { data[v.key] = v.string ? d.readString256() : d.readFloat64(); });
    this._processTelemetry(data);
  }

  _handleFastPacket(packet) {
    const d = packet.data;
    const s = { ts: Date.now() };
    try { FAST_VARS.forEach(v => { s[v.key] = d.readFloat64(); }); }
    catch (e) { return; }
    s.onGround = s.onGround > 0.5;
    this._fastLast = s;
    this._fast.push(s);
    const cutoff = s.ts - FAST_BUFFER_MS;
    while (this._fast.length && this._fast[0].ts < cutoff) this._fast.shift();
    // Valeur « résiduelle » du toucher précédent, mémorisée tant qu'on est en l'air : à
    // l'impact, le simu la remplace par la nouvelle — c'est ce changement qui la valide.
    if (this._phase === 'airborne' && !s.onGround && !this._touchdownPoint) this._tdvAirborne = s.tdv;
  }

  _fastFresh() {
    return !this._fastFailed && this._fastLast && (Date.now() - this._fastLast.ts) < 3000 ? this._fastLast : null;
  }

  _point(data, now) {
    const f = this._fastFresh();
    const p = {
      lat: data.lat, lon: data.lon, altFt: Math.round(data.altFt || 0),
      gsKt: Math.round(data.gsKt || 0), iasKt: Math.round(data.iasKt || 0),
      vsFpm: Math.round(data.vsFpm || 0), hdg: Math.round(data.headingDeg || 0),
      bankDeg: Math.round((data.bankDeg || 0) * 10) / 10, pitchDeg: Math.round((data.pitchDeg || 0) * 10) / 10,
      onGround: data.onGround > 0.5, ts: now
    };
    if (f && Number.isFinite(f.agl)) p.aglFt = Math.round(f.agl);
    return p;
  }

  /* ---------------- v1.5 — atterrissage mesuré précisément ----------------
     Appelée TOUCHDOWN_FINALIZE_MS après le premier contact (pour disposer des échantillons
     qui suivent l'impact : pic de G, rebond). Ordre de préférence pour le taux :
       1. PLANE TOUCHDOWN NORMAL VELOCITY : valeur exacte figée par le simu à l'impact ;
       2. vitesse verticale du flux 10 Hz juste avant le contact ;
       3. repli historique : vario lu à 1 Hz à la trame précédente. */
  _finalizeTouchdown(token) {
    if (token !== this._flightToken || this._tdFinalized || !this._touchdownPoint) return;
    this._tdFinalized = true;
    this._tdTimer = null;
    const td = this._touchdownPoint;
    const at = this._touchdownAt;
    const buf = this._fastFailed ? [] : this._fast.slice();
    let source = 'vs-1hz';

    // Instant réel du contact : 1er échantillon au sol précédé d'un échantillon en l'air.
    let tdIdx = -1;
    for (let i = 1; i < buf.length; i++) {
      if (buf[i].onGround && !buf[i - 1].onGround && buf[i].ts >= at - 2500 && buf[i].ts <= at + 800) { tdIdx = i; break; }
    }
    const tdTs = tdIdx >= 0 ? buf[tdIdx].ts : at;
    const before = tdIdx > 0 ? buf[tdIdx - 1] : null;

    let fpm = this._landingRate;
    if (before && Number.isFinite(before.vs)) { fpm = Math.round(before.vs); source = 'vs-10hz'; }
    const after = buf.filter(s => s.ts >= tdTs);
    const tdvNew = after.length ? after[after.length - 1].tdv : null;
    if (Number.isFinite(tdvNew) && tdvNew > 0.05 && tdvNew < 60 && tdvNew !== this._tdvAirborne) {
      fpm = -Math.round(tdvNew * 60);
      source = 'touchdown-velocity';
    }
    const gWin = buf.filter(s => s.ts >= tdTs - 300 && s.ts <= tdTs + 2200 && Number.isFinite(s.g));
    const gForce = gWin.length ? Math.round(Math.max(...gWin.map(s => s.g)) * 100) / 100 : null;
    const windSrc = before || (buf.length ? buf[Math.max(0, (tdIdx >= 0 ? tdIdx : buf.length) - 1)] : null);

    this._landingRate = fpm;
    td.vsFpm = fpm;
    td.measure = source;
    if (gForce != null) td.gForce = gForce;
    if (windSrc && Number.isFinite(windSrc.windDir)) { td.windDir = Math.round(windSrc.windDir); td.windKt = Math.round(windSrc.windKt); }

    // Piste + composantes du vent tout de suite (rapport, carte d'atterrissage, paris Twitch).
    const arr = nearestAirport(td.lat, td.lon, this._rendererDir);
    let zone = null;
    try { zone = arr ? computeTouchdownZone(td, arr.icao, this._rendererDir) : null; } catch (e) { zone = null; }
    const wc = windComponents(td.windDir, td.windKt, zone ? zone.runwayHdg : td.hdg);
    if (wc) { td.headwindKt = wc.headwindKt; td.crosswindKt = wc.crosswindKt; }

    this.emit('flight-landed', {
      landingRate: fpm, bounceCount: this._bounceCount, gForce, measure: source,
      windDir: td.windDir ?? null, windKt: td.windKt ?? null,
      headwindKt: td.headwindKt ?? null, crosswindKt: td.crosswindKt ?? null,
      arr: arr ? { icao: arr.icao, name: arr.name } : null, zone,
      touchdown: { ...td, zone }, ts: tdTs
    });
  }

  // Suivi du roulis en continu pendant que l'avion est en l'air : détecte le début/fin de
  // chaque virage (|bank| qui repasse sous le seuil) et mémorise son inclinaison maximale.
  // Volontairement séparé de l'échantillonnage du trajet (_point/AIR_SAMPLE_MS) : la détection
  // tourne à chaque trame reçue (~1 Hz) pour ne pas rater un virage serré mais bref.
  _trackBank(data) {
    const bank = Math.abs(data.bankDeg || 0);
    if (bank > TURN_BANK_THRESHOLD_DEG) {
      if (!this._inTurn) { this._inTurn = true; this._turnMaxBank = bank; }
      else if (bank > this._turnMaxBank) this._turnMaxBank = bank;
    } else if (this._inTurn) {
      this._inTurn = false;
      this._turns.push({ maxBankDeg: Math.round(this._turnMaxBank) });
      if (this._turnMaxBank > this._maxBankDeg) this._maxBankDeg = this._turnMaxBank;
    }
  }

  _processTelemetry(data) {
    const now = Date.now();
    const onGround = data.onGround > 0.5;
    const gs = data.gsKt || 0;
    let pathChanged = false;

    switch (this._phase) {
      case 'idle':
        this._phase = 'ground';
        break;

      case 'ground':
        if (!onGround || gs > AIRBORNE_SPEED_KT) {
          this._phase = 'airborne';
          if (!this._start) { this._start = now; this._firstMoveTs = now; this._simTitle = data.title || null; this.emit('flight-start', { startedAt: now, aircraft: data.title }); }
          this._takeoffAt = now;
          this._hasBeenAirborne = true;
          this._initFuel = data.fuelLbs;
          this._path.push({ ...this._point(data, now), phase: 'liftoff' });
          this._lastPathTs = now;
          pathChanged = true;
          break;
        }
        if (gs > STOPPED_GS_KT) {
          if (!this._firstMoveTs) {
            this._firstMoveTs = now;
            this._start = now;
            this._path = [{ ...this._point(data, now), phase: 'taxi_out' }];
            this._lastPathTs = now;
            pathChanged = true;
            this._simTitle = data.title || null;
            this.emit('flight-start', { startedAt: now, aircraft: data.title });
          } else if (now - this._lastPathTs >= GROUND_SAMPLE_MS) {
            this._path.push({ ...this._point(data, now), phase: 'taxi_out' });
            this._lastPathTs = now;
            pathChanged = true;
          }
        }
        break;

      case 'airborne':
        this._maxAltFt = Math.max(this._maxAltFt, data.altFt || 0);
        this._maxIasKt = Math.max(this._maxIasKt, data.iasKt || 0);
        this._lastFuel = data.fuelLbs;
        this._lastVs = data.vsFpm || 0;
        this._trackBank(data);
        // Échantillonnage resserré en approche (sous 2 500 ft sol, en descente) : le trajet
        // garde alors un point par seconde, assez pour rejouer l'approche finale en 3D.
        const fastNow = this._fastFresh();
        const sampleMs = (fastNow && fastNow.agl < APPROACH_SAMPLE_AGL_FT && (data.vsFpm || 0) < 0) ? APPROACH_SAMPLE_MS : AIR_SAMPLE_MS;
        if (now - this._lastPathTs >= sampleMs) {
          this._path.push({ ...this._point(data, now), phase: 'air' });
          this._lastPathTs = now;
          pathChanged = true;
        }
        if (onGround) {
          // Contact au sol trop tôt après le décollage : bruit capteur, on l'ignore
          // complètement (pas de changement de phase, pas de sample "touchdown" dans le
          // trajet) plutôt que de le traiter comme un atterrissage.
          if (now - this._takeoffAt < MIN_AIRBORNE_BEFORE_LANDING_MS) break;
          this._phase = 'landed';
          // Premier impact uniquement : si l'avion a déjà touché puis rebondi (voir le cas
          // 'landed' juste en dessous), touchdownPoint/landingRate/touchdownAt sont déjà
          // renseignés et ne doivent PAS être écrasés par ce nouvel impact.
          const firstTouch = !this._touchdownPoint;
          if (firstTouch) {
            this._touchdownAt = now;
            this._landingRate = Math.round(this._lastVs);
            this._touchdownPoint = this._point(data, now);
          }
          this._path.push({ ...this._point(data, now), phase: 'touchdown' });
          this._lastPathTs = now;
          this._stationarySince = null;
          pathChanged = true;
          // v1.5 : l'événement part une seule fois, quelques secondes après le 1er contact,
          // avec les mesures fines (voir _finalizeTouchdown). Sans flux rapide : tout de suite.
          if (firstTouch) {
            const token = this._flightToken;
            if (this._fastFailed || !this._fastLast) this._finalizeTouchdown(token);
            else this._tdTimer = setTimeout(() => this._finalizeTouchdown(token), TOUCHDOWN_FINALIZE_MS);
          }
        }
        break;

      case 'landed':
        // Rebond / touch-and-go : l'avion redécolle après un premier toucher. On repart en
        // 'airborne' (qui pourra retracker un nouveau virage) sans toucher au 1er impact déjà
        // mémorisé, et on compte le rebond pour le signaler dans le rapport de vol.
        if (!onGround) { this._phase = 'airborne'; this._stationarySince = null; this._bounceCount++; break; }
        if (gs > STOPPED_GS_KT) {
          this._stationarySince = null;
          if (now - this._lastPathTs >= GROUND_SAMPLE_MS) {
            this._path.push({ ...this._point(data, now), phase: 'taxi_in' });
            this._lastPathTs = now;
            pathChanged = true;
          }
        } else {
          if (!this._stationarySince) this._stationarySince = now;
          else if (now - this._stationarySince >= PARKED_TIMEOUT_MS) this._terminateFlight();
        }
        break;
    }

    // Phases de vol + rapport détaillé mis à jour en direct au fil du vol (voir
    // computeLivePhases), plutôt que calculés uniquement une fois le vol terminé.
    if (pathChanged && this._path.length) this._emitProgress(now);

    const fast = this._fastFresh();
    this.emit('telemetry', {
      ...data,
      altFt: Math.round(data.altFt || 0), iasKt: Math.round(data.iasKt || 0), gsKt: Math.round(data.gsKt || 0),
      vsFpm: Math.round(data.vsFpm || 0), headingDeg: Math.round(data.headingDeg || 0),
      comFreqMhz: data.comFreqMhz ? Math.round(data.comFreqMhz * 1000) / 1000 : null,
      onGround, phase: this._phase,
      aglFt: fast && Number.isFinite(fast.agl) ? Math.round(fast.agl) : null,
      windDir: fast && Number.isFinite(fast.windDir) ? Math.round(fast.windDir) : null,
      windKt: fast && Number.isFinite(fast.windKt) ? Math.round(fast.windKt) : null,
      gForce: fast && Number.isFinite(fast.g) ? Math.round(fast.g * 100) / 100 : null
    });
  }

  // Diffuse au renderer un instantané du vol en cours : trajet parcouru jusqu'ici,
  // phases/segments déjà identifiés et quelques stats, pour que la carte, les phases
  // et le rapport détaillé se complètent dans l'app au fil du vol (et pas seulement
  // une fois le vol terminé, dans la vue synthétique du logbook).
  _emitProgress(now) {
    if (!this._path.length) return;
    const first = this._path[0];
    if (!this._liveDepGuess) this._liveDepGuess = nearestAirport(first.lat, first.lon, this._rendererDir);

    const airPts = this._path.filter(p => p.phase === 'liftoff' || p.phase === 'air' || p.phase === 'touchdown');
    let distanceNm = 0;
    for (let i = 1; i < airPts.length; i++) distanceNm += haversineNm(airPts[i-1].lat, airPts[i-1].lon, airPts[i].lat, airPts[i].lon);

    let phases = [];
    try {
      phases = computeLivePhases(this._path, this._liveDepGuess && this._liveDepGuess.elevFt, this._rendererDir);
    } catch (e) {
      console.error('[FlightBrief] [tracker] erreur de segmentation en direct des phases :', e.message);
    }

    this.emit('flight-progress', {
      phase: this._phase,
      startedAt: this._start ? new Date(this._start).toISOString() : null,
      durationMin: this._start ? Math.round((now - this._start) / 60000) : 0,
      distanceNm: Math.round(distanceNm),
      maxAltFt: Math.round(this._maxAltFt),
      maxIasKt: Math.round(this._maxIasKt),
      depGuess: this._liveDepGuess,
      path: this._path,
      phases
    });

    // Sauvegarde de secours sur disque, au plus une fois par minute (pas à chaque mise à
    // jour du trajet) : en cas de crash ou de fermeture inattendue en plein vol, il reste
    // une trace récupérable au prochain lancement plutôt que de tout perdre. Marquée
    // final:false — moins complète qu'un vol terminé normalement (pas de taux
    // d'atterrissage, zone de toucher, carburant...), mais mieux que rien.
    if (now - this._lastSnapshotAt >= 60000) {
      this._lastSnapshotAt = now;
      this._writeSnapshot({
        startedAt: this._start ? new Date(this._start).toISOString() : null,
        simAircraft: this._simTitle || null,
        durationMin: this._start ? Math.round((now - this._start) / 60000) : 0,
        totalDurationMin: this._start ? Math.round((now - this._start) / 60000) : 0,
        distanceNm: Math.round(distanceNm),
        maxAltFt: Math.round(this._maxAltFt),
        maxIasKt: Math.round(this._maxIasKt),
        landingRateFpm: null,
        bounceCount: this._bounceCount,
        turnStats: { totalTurns: this._turns.length, maxBankDeg: Math.round(this._maxBankDeg), steepTurnCount: 0, aggressiveTurnCount: 0 },
        depGuess: this._liveDepGuess,
        arrGuess: null,
        path: this._path,
        phases,
        touchdown: null
      }, false);
    }
  }

  _terminateFlight() {
    const now = Date.now();
    this._end = now;
    if (!this._hasBeenAirborne || !this._takeoffAt) { this._resetFlightState(); return { ok: false, reason: 'no_flight' }; }

    const airDuration = (this._touchdownAt || now) - this._takeoffAt;
    if (airDuration < MIN_FLIGHT_MIN * 60 * 1000) { this._resetFlightState(); return { ok: false, reason: 'too_short' }; }
    // Vol clôturé juste après le toucher (arrêt manuel) : on fige les mesures tout de suite.
    if (this._touchdownPoint && !this._tdFinalized) {
      if (this._tdTimer) { clearTimeout(this._tdTimer); this._tdTimer = null; }
      this._finalizeTouchdown(this._flightToken);
    }

    const first = this._path[0], last = this._path[this._path.length - 1];
    const depAirport = nearestAirport(first.lat, first.lon, this._rendererDir);
    const arrAirport = nearestAirport(last.lat, last.lon, this._rendererDir);

    // Distance parcourue en vol uniquement (hors roulage)
    const airPts = this._path.filter(p => p.phase === 'liftoff' || p.phase === 'air' || p.phase === 'touchdown');
    let distanceNm = 0;
    for (let i = 1; i < airPts.length; i++) distanceNm += haversineNm(airPts[i-1].lat, airPts[i-1].lon, airPts[i].lat, airPts[i].lon);

    const fuelUsedLbs = (this._initFuel != null && this._lastFuel != null)
      ? Math.max(0, Math.round(this._initFuel - this._lastFuel)) : null;

    const phases = computePhases(this._path, depAirport && depAirport.elevFt, arrAirport && arrAirport.elevFt);
    const touchdownZone = this._touchdownPoint
      ? computeTouchdownZone(this._touchdownPoint, arrAirport && arrAirport.icao, this._rendererDir)
      : null;
    if (this._touchdownPoint && touchdownZone) {
      const wc = windComponents(this._touchdownPoint.windDir, this._touchdownPoint.windKt, touchdownZone.runwayHdg);
      if (wc) { this._touchdownPoint.headwindKt = wc.headwindKt; this._touchdownPoint.crosswindKt = wc.crosswindKt; }
    }

    const turnStats = {
      totalTurns: this._turns.length,
      maxBankDeg: Math.round(this._maxBankDeg),
      steepTurnCount: this._turns.filter(t => t.maxBankDeg >= STEEP_TURN_BANK_DEG).length,
      aggressiveTurnCount: this._turns.filter(t => t.maxBankDeg >= AGGRESSIVE_TURN_BANK_DEG).length
    };

    const result = {
      startedAt: new Date(this._start).toISOString(),
      endedAt: new Date(now).toISOString(),
      simAircraft: this._simTitle || null,
      durationMin: Math.round(airDuration / 60000),
      totalDurationMin: Math.round((now - this._start) / 60000),
      distanceNm: Math.round(distanceNm),
      maxAltFt: Math.round(this._maxAltFt),
      maxIasKt: Math.round(this._maxIasKt),
      fuelUsedLbs,
      landingRateFpm: this._landingRate,
      bounceCount: this._bounceCount,
      turnStats,
      depGuess: depAirport,
      arrGuess: arrAirport,
      path: this._path,
      phases,
      touchdown: this._touchdownPoint ? { ...this._touchdownPoint, zone: touchdownZone } : null
    };
    // Sauvegarde finale AVANT l'émission de l'événement : même si l'IPC vers le renderer
    // échoue (fenêtre détruite, exception quelconque côté UI), le vol complet reste
    // récupérable sur disque au prochain lancement plutôt que perdu silencieusement.
    this._writeSnapshot(result, true);
    this.emit('flight-end', result);
    this._resetFlightState();
    return { ok: true };
  }

  // Arrête le suivi du vol en cours immédiatement (sans attendre le délai de parking à
  // l'arrêt), pour permettre de clôturer le vol et déclencher l'envoi du PIREP en un seul
  // clic depuis le renderer, plutôt que d'attendre la détection automatique. La connexion
  // SimConnect elle-même reste active (ne se déconnecte pas), prête pour un prochain vol.
  stopTracking() {
    // 'ground' couvre aussi bien "connecté, avion immobile" que "roulage avant décollage" :
    // dans ce dernier cas, _terminateFlight() gère déjà proprement l'absence de vol réel
    // (this._hasBeenAirborne == false -> reset silencieux, sans PIREP à envoyer).
    if (this._phase === 'idle' || !this._firstMoveTs) {
      return { ok: false, reason: 'not_tracking' };
    }
    this._stationarySince = null;
    return this._terminateFlight();
  }
}

module.exports = { FlightTracker, nearestAirport, loadAirports, loadRunways, computeTouchdownZone, computePhases, computeLivePhases, windComponents };
