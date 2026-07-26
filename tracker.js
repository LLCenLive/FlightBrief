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
  { name: 'PLANE ALTITUDE', unit: 'feet', key: 'altFt' },
  { name: 'AIRSPEED INDICATED', unit: 'knots', key: 'iasKt' },
  { name: 'GROUND VELOCITY', unit: 'knots', key: 'gsKt' },
  { name: 'VERTICAL SPEED', unit: 'feet per minute', key: 'vsFpm' },
  { name: 'PLANE HEADING DEGREES TRUE', unit: 'degrees', key: 'headingDeg' },
  { name: 'SIM ON GROUND', unit: 'bool', key: 'onGround' },
  { name: 'FUEL TOTAL QUANTITY WEIGHT', unit: 'pounds', key: 'fuelLbs' },
  { name: 'COM ACTIVE FREQUENCY:1', unit: 'MHz', key: 'comFreqMhz' },
  { name: 'TITLE', unit: null, key: 'title', string: true }
];

const AIRBORNE_SPEED_KT = 40;     // GS au-dessus duquel on considère l'avion en l'air même si le capteur onGround retarde
const STOPPED_GS_KT = 3;          // en dessous, on considère l'avion à l'arrêt (parqué)
const MIN_FLIGHT_MIN = 2;         // durée minimale en vol pour enregistrer un vol
const PARKED_TIMEOUT_MS = 25000;  // temps immobile après roulage avant de considérer le vol terminé
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

let airportIndex = null;
function loadAirports(rendererDir) {
  if (airportIndex) return airportIndex;
  try {
    airportIndex = JSON.parse(fs.readFileSync(path.join(rendererDir, 'data', 'airports.json'), 'utf-8'));
  } catch (e) { airportIndex = []; }
  return airportIndex;
}
let runwayIndex = null;
function loadRunways(rendererDir) {
  if (runwayIndex) return runwayIndex;
  try {
    runwayIndex = JSON.parse(fs.readFileSync(path.join(rendererDir, 'data', 'runways.json'), 'utf-8'));
  } catch (e) { runwayIndex = {}; }
  return runwayIndex;
}

function nearestAirport(lat, lon, rendererDir) {
  const list = loadAirports(rendererDir);
  let best = null, bestDist = Infinity;
  for (const [icao, name, alat, alon, elevFt] of list) {
    const d = haversineNm(lat, lon, alat, alon);
    if (d < bestDist) { bestDist = d; best = { icao, name, distanceNm: Math.round(d * 10) / 10, elevFt: elevFt ?? null }; }
  }
  return best;
}

// Projette le point de toucher des roues sur la piste la plus probable de l'aéroport
// d'arrivée (déduite du cap au moment du toucher) et calcule la distance depuis le
// seuil ainsi que l'écart latéral par rapport à l'axe.
function computeTouchdownZone(touchdownPoint, arrIcao, rendererDir) {
  if (!arrIcao || !touchdownPoint) return null;
  const runways = loadRunways(rendererDir)[arrIcao];
  if (!runways || !runways.length) return null;

  let best = null;
  for (const rwy of runways) {
    if (rwy.leHdg == null || rwy.heHdg == null) continue;
    const candidates = [
      { thresholdIdent: rwy.le, thresholdLat: rwy.leLat, thresholdLon: rwy.leLon, thresholdHdg: rwy.leHdg,
        oppositeLat: rwy.heLat, oppositeLon: rwy.heLon, oppositeIdent: rwy.he },
      { thresholdIdent: rwy.he, thresholdLat: rwy.heLat, thresholdLon: rwy.heLon, thresholdHdg: rwy.heHdg,
        oppositeLat: rwy.leLat, oppositeLon: rwy.leLon, oppositeIdent: rwy.le }
    ];
    for (const c of candidates) {
      const diff = headingDiff(touchdownPoint.hdg, c.thresholdHdg);
      if (!best || diff < best.diff) best = { ...c, diff, rwy };
    }
  }
  if (!best || best.diff > 55) return null; // aucune piste plausible

  // Projection plan local (équirectangulaire, valable sur de courtes distances)
  const mPerDegLat = 111320;
  const cosLat = Math.cos(best.thresholdLat * Math.PI / 180);
  const toXY = (lat, lon) => ({
    x: (lon - best.thresholdLon) * mPerDegLat * cosLat,
    y: (lat - best.thresholdLat) * mPerDegLat
  });
  const opp = toXY(best.oppositeLat, best.oppositeLon);
  const tdz = toXY(touchdownPoint.lat, touchdownPoint.lon);
  const rwyLenM = Math.hypot(opp.x, opp.y) || 1;
  const ux = opp.x / rwyLenM, uy = opp.y / rwyLenM; // vecteur unitaire seuil -> extrémité opposée

  const alongM = tdz.x * ux + tdz.y * uy;           // distance depuis le seuil, projetée sur l'axe
  const lateralM = tdz.x * uy - tdz.y * ux;         // écart perpendiculaire (signé)

  const lengthFt = best.rwy.lengthFt || Math.round(rwyLenM * 3.28084);
  const distanceFromThresholdFt = Math.round(alongM * 3.28084);
  const lateralOffsetFt = Math.round(lateralM * 3.28084);

  return {
    runway: `${best.thresholdIdent}${best.oppositeIdent ? '/' + best.oppositeIdent : ''}`,
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
  constructor(rendererDir) {
    super();
    this._rendererDir = rendererDir;
    this._handle = null;
    this._connected = false;
    this._resetFlightState();
  }

  _resetFlightState() {
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
    this._lastPathTs = 0;
    this._stationarySince = null;
    this._liveDepGuess = null; // aéroport de départ deviné, mis en cache dès le 1er point du trajet
    this._lastProgressTs = 0;
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

    handle.on('simObjectData', packet => this._handlePacket(packet));
    handle.on('quit', () => this._handleDisconnect());
    handle.on('close', () => this._handleDisconnect());
    handle.on('error', err => {
      console.error('[FlightBrief] [SimConnect] erreur:', err.message);
      this.emit('status', { connected: this._connected, error: err.message });
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

  _point(data, now) {
    return {
      lat: data.lat, lon: data.lon, altFt: Math.round(data.altFt || 0),
      gsKt: Math.round(data.gsKt || 0), iasKt: Math.round(data.iasKt || 0),
      vsFpm: Math.round(data.vsFpm || 0), hdg: Math.round(data.headingDeg || 0),
      onGround: data.onGround > 0.5, ts: now
    };
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
          if (!this._start) { this._start = now; this._firstMoveTs = now; this.emit('flight-start', { startedAt: now, aircraft: data.title }); }
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
        if (now - this._lastPathTs >= AIR_SAMPLE_MS) {
          this._path.push({ ...this._point(data, now), phase: 'air' });
          this._lastPathTs = now;
          pathChanged = true;
        }
        if (onGround) {
          this._phase = 'landed';
          this._touchdownAt = now;
          this._landingRate = Math.round(this._lastVs);
          this._touchdownPoint = this._point(data, now);
          this._path.push({ ...this._touchdownPoint, phase: 'touchdown' });
          this._lastPathTs = now;
          this._stationarySince = null;
          pathChanged = true;
          this.emit('flight-landed', { landingRate: this._landingRate });
        }
        break;

      case 'landed':
        if (!onGround) { this._phase = 'airborne'; this._stationarySince = null; break; } // rebond / touch-and-go
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

    this.emit('telemetry', {
      ...data,
      altFt: Math.round(data.altFt || 0), iasKt: Math.round(data.iasKt || 0), gsKt: Math.round(data.gsKt || 0),
      vsFpm: Math.round(data.vsFpm || 0), headingDeg: Math.round(data.headingDeg || 0),
      comFreqMhz: data.comFreqMhz ? Math.round(data.comFreqMhz * 1000) / 1000 : null,
      onGround, phase: this._phase
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
  }

  _terminateFlight() {
    const now = Date.now();
    this._end = now;
    if (!this._hasBeenAirborne || !this._takeoffAt) { this._resetFlightState(); return; }

    const airDuration = (this._touchdownAt || now) - this._takeoffAt;
    if (airDuration < MIN_FLIGHT_MIN * 60 * 1000) { this._resetFlightState(); return; }

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

    const result = {
      startedAt: new Date(this._start).toISOString(),
      endedAt: new Date(now).toISOString(),
      durationMin: Math.round(airDuration / 60000),
      totalDurationMin: Math.round((now - this._start) / 60000),
      distanceNm: Math.round(distanceNm),
      maxAltFt: Math.round(this._maxAltFt),
      maxIasKt: Math.round(this._maxIasKt),
      fuelUsedLbs,
      landingRateFpm: this._landingRate,
      depGuess: depAirport,
      arrGuess: arrAirport,
      path: this._path,
      phases,
      touchdown: this._touchdownPoint ? { ...this._touchdownPoint, zone: touchdownZone } : null
    };
    this.emit('flight-end', result);
    this._resetFlightState();
  }
}

module.exports = { FlightTracker, nearestAirport, loadAirports, loadRunways, computeTouchdownZone, computePhases, computeLivePhases };
