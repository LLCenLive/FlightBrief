/* =========================================================
   FlightBrief — page de l'appli EFB de MSFS 2024 (v2.0)
   ---------------------------------------------------------
   Servie par FlightBrief (http://127.0.0.1:4814/efb) et affichée dans la tablette du simulateur
   par l'appli du dossier efb/. Mêmes rubriques que l'appli :
     • Briefing : vol, progression, météo, route, notes, ATC en ligne, amis, OFP SimBrief ;
     • Logbook  : statistiques et vols (filtre par réseau, fiche de chaque vol) ;
     • Carrière : grade, progression, tours ;
     • Live     : bot Twitch, paris d'atterrissage, passagers « À bord », classement, chat.
   /api/efb/state toutes les 3 s ; logbook et carrières à l'ouverture de l'onglet puis toutes les
   60 s ; l'OFP à la demande. Le code d'appairage est glissé dans la page par FlightBrief.
   ES5 uniquement (var, XMLHttpRequest, pas de fonctions fléchées) : le navigateur Coherent GT
   du simulateur est ancien.
   ========================================================= */
(function () {
  'use strict';
  var CFG = window.FB_EFB || {};
  var LANG = CFG.lang === 'en' || CFG.lang === 'es' ? CFG.lang : 'fr';
  // Petit dictionnaire : la traduction automatique de l'appli utilise du JavaScript trop récent pour le simulateur.
  var DICT = {
    'Briefing': ['Briefing', 'Briefing'], 'Logbook': ['Logbook', 'Logbook'], 'Carrière': ['Career', 'Carrera'], 'Live': ['Live', 'Live'], 'Fermer': ['Close', 'Cerrar'],
    'FlightBrief connecté': ['FlightBrief connected', 'FlightBrief conectado'], 'Connexion à FlightBrief…': ['Connecting to FlightBrief…', 'Conectando con FlightBrief…'],
    'FlightBrief injoignable': ['FlightBrief unreachable', 'FlightBrief inaccesible'], 'simulateur non connecté': ['simulator not connected', 'simulador no conectado'], 'en vol': ['in flight', 'en vuelo'],
    'Lance FlightBrief sur ce PC.': ['Start FlightBrief on this PC.', 'Inicia FlightBrief en este PC.'],
    'Cette page se met à jour toute seule dès que FlightBrief répond.': ['This page updates by itself as soon as FlightBrief answers.', 'Esta página se actualiza sola en cuanto FlightBrief responda.'],
    'Pas encore de plan de vol': ['No flight plan yet', 'Aún no hay plan de vuelo'],
    'Remplis le Briefing dans FlightBrief ou importe ton plan de vol SimBrief.': ['Fill in the Briefing in FlightBrief or import your SimBrief flight plan.', 'Rellena el Briefing en FlightBrief o importa tu plan de vuelo SimBrief.'],
    'Altitude': ['Altitude', 'Altitud'], 'Vitesse sol': ['Ground speed', 'Velocidad suelo'], 'Restant': ['Remaining', 'Restante'], 'Arrivée prévue': ['ETA', 'Llegada prevista'], 'Descente dans': ['Descent in', 'Descenso en'],
    'Météo': ['Weather', 'Meteo'], 'Pas de METAR': ['No METAR', 'Sin METAR'], 'Route': ['Route', 'Ruta'], 'Notes du briefing': ['Briefing notes', 'Notas del briefing'],
    'Approche': ['Approach', 'Aproximación'], 'Notes': ['Notes', 'Notas'], 'Niveau': ['Level', 'Nivel'], 'Durée': ['Duration', 'Duración'],
    'ATC en ligne': ['Online ATC', 'ATC en línea'], 'Aucun contrôleur à': ['No controller at', 'Ningún controlador en'], 'Amis en vol': ['Friends flying', 'Amigos en vuelo'],
    'Aucun ami en ligne.': ['No friend online.', 'Ningún amigo en línea.'], 'viewer': ['viewer', 'viewer'], 'OFP SimBrief': ['SimBrief OFP', 'OFP SimBrief'], 'Ouvrir l\'OFP': ['Open the OFP', 'Abrir el OFP'],
    'Pas d\'OFP SimBrief importé.': ['No SimBrief OFP imported.', 'Ningún OFP de SimBrief importado.'],
    'Vols': ['Flights', 'Vuelos'], 'Heures': ['Hours', 'Horas'], 'Distance': ['Distance', 'Distancia'], 'Note moyenne': ['Average score', 'Nota media'],
    'Tous': ['All', 'Todos'], 'Avec tracé': ['Tracked', 'Con trazado'], 'Afficher plus': ['Show more', 'Mostrar más'],
    'Aucun vol enregistré.': ['No flight logged.', 'Ningún vuelo registrado.'], 'Aucun vol pour ce filtre.': ['No flight for this filter.', 'Ningún vuelo con este filtro.'],
    'Appareil': ['Aircraft', 'Avión'], 'Réseau': ['Network', 'Red'], 'Règles': ['Rules', 'Reglas'], 'Atterrissage': ['Landing', 'Aterrizaje'], 'rebond': ['bounce', 'rebote'], 'rebonds': ['bounces', 'rebotes'],
    'Altitude max': ['Max altitude', 'Altitud máx.'], 'PIREP': ['PIREP', 'PIREP'], 'Remarques': ['Remarks', 'Observaciones'], 'Passagers du chat': ['Chat passengers', 'Pasajeros del chat'],
    'Validé': ['Accepted', 'Validado'], 'En attente': ['Pending', 'Pendiente'], 'Refusé': ['Rejected', 'Rechazado'], 'Aucun': ['None', 'Ninguno'],
    'Aucune carrière.': ['No career.', 'Ninguna carrera.'], 'Crée une carrière dans l\'onglet Carrière de FlightBrief.': ['Create a career in the FlightBrief Career tab.', 'Crea una carrera en la pestaña Carrera de FlightBrief.'],
    'Prochain grade': ['Next rank', 'Siguiente rango'], 'Grade maximum atteint': ['Top rank reached', 'Rango máximo alcanzado'], 'vols': ['flights', 'vuelos'], 'étapes': ['legs', 'etapas'], 'Prochaine étape': ['Next leg', 'Siguiente etapa'], 'Terminé': ['Completed', 'Completado'],
    'Le bot Twitch est désactivé dans FlightBrief.': ['The Twitch bot is turned off in FlightBrief.', 'El bot de Twitch está desactivado en FlightBrief.'],
    'Bot Twitch': ['Twitch bot', 'Bot de Twitch'], 'connecté au chat': ['connected to chat', 'conectado al chat'], 'lecture seule': ['read-only', 'solo lectura'], 'déconnecté': ['disconnected', 'desconectado'],
    'Paris d\'atterrissage': ['Landing bets', 'Apuestas de aterrizaje'], 'ouverts': ['open', 'abiertas'], 'fermés': ['locked', 'cerradas'], 'terminés': ['resolved', 'terminadas'], 'pas de paris': ['no bets', 'sin apuestas'],
    'pronostics': ['guesses', 'pronósticos'], 'Ouvrir': ['Open', 'Abrir'], 'Fermer les paris': ['Lock', 'Cerrar'], 'Annuler': ['Cancel', 'Anular'], 'Gagnant': ['Winner', 'Ganador'], 'à': ['within', 'a'], 'près': ['', ''],
    'Meilleurs parieurs': ['Top bettors', 'Mejores apostadores'], 'victoires': ['wins', 'victorias'],
    'À bord': ['On board', 'A bordo'], 'passagers': ['passengers', 'pasajeros'], 'Embarquement ouvert': ['Boarding open', 'Embarque abierto'], 'Portes fermées': ['Doors closed', 'Puertas cerradas'],
    'Ouvrir l\'embarquement': ['Open boarding', 'Abrir embarque'], 'Fermer les portes': ['Close doors', 'Cerrar puertas'], 'Turbulences !': ['Turbulence!', '¡Turbulencias!'], 'ceintures': ['seatbelts', 'cinturones'],
    'Personne à bord pour l\'instant.': ['Nobody on board yet.', 'Nadie a bordo por ahora.'], 'Prochain survol': ['Next flyover', 'Próximo sobrevuelo'], 'chez': ['over', 'sobre'], 'Quiz en cours': ['Quiz running', 'Quiz en curso'],
    'Classement des miles': ['Miles ranking', 'Clasificación de millas'], 'Capture d\'écran': ['Screenshot', 'Captura'], 'Activité du chat': ['Chat activity', 'Actividad del chat'],
    'Rien pour l\'instant.': ['Nothing yet.', 'Nada por ahora.'], 'Fait ✓': ['Done ✓', 'Hecho ✓'], 'Impossible pour l\'instant.': ['Not possible right now.', 'No es posible ahora.'], 'Chargement…': ['Loading…', 'Cargando…']
  };
  function t(s) { var d = DICT[s]; return LANG === 'fr' || !d ? s : d[LANG === 'en' ? 0 : 1]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function num(n) { return n == null ? '—' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function fl(ft) { if (ft == null) return '—'; return ft >= 10000 ? 'FL' + ('00' + Math.round(ft / 100)).slice(-3) : num(ft) + ' ft'; }
  function mins(m) { if (m == null) return '—'; m = Math.max(0, Math.round(m)); return m >= 60 ? Math.floor(m / 60) + ' h ' + ('0' + (m % 60)).slice(-2) : m + ' min'; }
  function hhmm(iso) { if (!iso) return '—'; var d = new Date(iso); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function dateFr(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : (s || '—'); }
  // Pseudo avec badge et couleur du duty free (arc-en-ciel : doré, le dégradé n'est pas fiable dans le simulateur).
  function pseudo(name, lk) {
    lk = lk || {};
    var col = lk.color ? ' style="color:' + esc(lk.color === 'rainbow' ? '#ffd166' : lk.color) + '"' : '';
    return (lk.badge ? esc(lk.badge) + ' ' : '') + '<span' + col + '>' + esc(name) + '</span>';
  }

  var state = null, failures = 0, tab = 'briefing';
  var logbook = null, careers = null, lbFilter = 'all', lbShown = 40, lastLoaded = {};

  function xhr(method, url, cb) {
    var r = new XMLHttpRequest();
    r.open(method, url, true);
    r.setRequestHeader('X-FlightBrief-Efb', CFG.token || '');
    r.timeout = 12000;
    r.onreadystatechange = function () {
      if (r.readyState !== 4) return;
      var j = null;
      try { j = JSON.parse(r.responseText); } catch (e) { j = null; }
      cb(r.status === 200 ? j : null);
    };
    r.ontimeout = function () { cb(null); };
    try { r.send(); } catch (e) { cb(null); }
  }

  function poll() {
    xhr('GET', '/api/efb/state?t=' + Date.now(), function (j) {
      if (j && j.ok) { state = j; failures = 0; } else failures++;
      render();
      window.setTimeout(poll, 3000);
    });
  }
  // Logbook et carrières : chargés à l'ouverture de l'onglet, rafraîchis au plus toutes les 60 s.
  function loadPart(part, force) {
    if (!force && lastLoaded[part] && Date.now() - lastLoaded[part] < 60000) return;
    lastLoaded[part] = Date.now();
    xhr('GET', '/api/efb/' + part + '?t=' + Date.now(), function (j) {
      if (!j || !j.ok) { lastLoaded[part] = 0; return; }
      if (part === 'logbook') logbook = j; else careers = j;
      render();
    });
  }

  function renderConn() {
    var c = $('conn'), up = state && failures < 3;
    c.className = 'conn' + (up ? ' ok' : '');
    c.innerHTML = '<span class="dot"></span><span class="txt">' + (up ? t('FlightBrief connecté') + ' · ' + (state.connected ? t('en vol') : t('simulateur non connecté'))
      : !state && failures < 3 ? t('Connexion à FlightBrief…') : t('FlightBrief injoignable')) + '</span>';
  }

  /* ---------------- Briefing ---------------- */
  function kpi(label, val) { return '<div class="kpi"><span>' + esc(label) + '</span><b>' + esc(val) + '</b></div>'; }
  function kv(label, val) { return val ? '<div class="kv"><span>' + esc(label) + '</span><b>' + esc(val) + '</b></div>' : ''; }
  function metar(icao, text) { if (!icao) return ''; return '<div class="metar"><b>' + esc(icao) + '</b>' + (text ? esc(text) : '<span class="names">' + t('Pas de METAR') + '</span>') + '</div>'; }
  var FAC = { ATIS: 0, DEL: 1, GND: 2, TWR: 3, DEP: 4, APP: 5, CTR: 6 };
  function renderBriefing() {
    var s = state, b = s.briefing || {};
    if (!s.dep && !s.arr && !s.connected) return '<div class="big-msg"><b>' + t('Pas encore de plan de vol') + '</b>' + t('Remplis le Briefing dans FlightBrief ou importe ton plan de vol SimBrief.') + '</div>';
    var left = '<div class="card"><div class="route">' + esc(s.dep || '????') + '<span class="arrow">→</span>' + esc(s.arr || '????') + '</div>'
      + ((b.depName || b.arrName) ? '<div class="names">' + esc(b.depName || '') + ' → ' + esc(b.arrName || '') + '</div>' : '')
      + '<div class="pills">' + (s.callsign ? '<span class="pill">' + esc(s.callsign) + '</span>' : '') + (s.aircraft ? '<span class="pill">' + esc(s.aircraft) + '</span>' : '')
      + (b.rules ? '<span class="pill ' + (b.rules === 'VFR' ? 'vfr' : 'ifr') + '">' + esc(b.rules) + '</span>' : '')
      + (b.altitude ? '<span class="pill">' + t('Niveau') + ' ' + esc(b.altitude) + '</span>' : '') + (b.duration ? '<span class="pill">' + t('Durée') + ' ' + esc(b.duration) + '</span>' : '') + '</div>';
    if (s.connected) {
      if (s.progressPct != null) left += '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, s.progressPct)) + '%"></i></div>';
      left += '<div class="kpis">' + kpi(t('Altitude'), fl(s.altFt)) + kpi(t('Vitesse sol'), s.gsKt != null ? s.gsKt + ' kt' : '—')
        + kpi(t('Restant'), s.remainingNm != null ? num(s.remainingNm) + ' NM' : '—') + kpi(t('Arrivée prévue'), s.etaIso ? hhmm(s.etaIso) : '—')
        + kpi(t('Descente dans'), s.todMin != null && s.todMin > 0 ? mins(s.todMin) : '—') + '</div>';
    }
    left += '</div>';
    if (s.route) left += '<div class="card"><h3>' + t('Route') + '</h3><div class="txt mono">' + esc(s.route) + '</div></div>';
    if (b.approach || b.weather || b.notes) left += '<div class="card"><h3>' + t('Notes du briefing') + '</h3>' + kv(t('Approche'), b.approach) + kv(t('Météo'), b.weather) + kv(t('Notes'), b.notes) + '</div>';
    left += '<div class="card"><h3>' + t('OFP SimBrief') + '</h3>' + (b.hasOfp ? '<a href="#" class="btn small" data-action="ofp">' + t('Ouvrir l\'OFP') + '</a>' : '<div class="empty">' + t('Pas d\'OFP SimBrief importé.') + '</div>') + '</div>';

    var right = '<div class="card"><h3>' + t('Météo') + '</h3>' + metar(s.dep, s.metar && s.metar.dep) + (s.arr && s.arr !== s.dep ? metar(s.arr, s.metar && s.metar.arr) : '') + '</div>';
    right += '<div class="card"><h3>' + t('ATC en ligne') + '</h3>';
    [s.dep, s.arr].forEach(function (icao, i) {
      if (!icao || (i === 1 && icao === s.dep)) return;
      var list = (s.atc || []).filter(function (a) { return a.icao === icao; }).sort(function (a, b) { return (FAC[a.facility] || 9) - (FAC[b.facility] || 9); });
      if (!list.length) { right += '<div class="row"><span class="l empty">' + t('Aucun contrôleur à') + ' ' + esc(icao) + '</span></div>'; return; }
      list.forEach(function (a) {
        right += '<div class="row"><span class="l"><span class="tag ' + esc(a.facility) + '">' + esc(a.facility) + (a.atisCode ? ' ' + esc(a.atisCode) : '') + '</span>' + esc(a.callsign)
          + '<span class="net">' + (a.network === 'ivao' ? 'IVAO' : 'VATSIM') + '</span></span><span class="r freq">' + esc(a.frequency) + '</span></div>';
      });
    });
    right += '</div><div class="card"><h3>' + t('Amis en vol') + '</h3>';
    var fr = s.friends || [];
    if (!fr.length) right += '<div class="empty">' + t('Aucun ami en ligne.') + '</div>';
    fr.forEach(function (p) {
      right += '<div class="row"><span class="l"><b>' + esc(p.label || p.callsign) + '</b><span class="net">' + esc(p.callsign) + ' · ' + (p.network === 'ivao' ? 'IVAO' : 'VATSIM') + (p.viewer ? ' · ' + t('viewer') : '') + '</span></span>'
        + '<span class="r">' + esc((p.dep || '????') + '→' + (p.arr || '????')) + ' ' + esc(fl(p.altFt)) + '</span></div>';
    });
    right += '</div>';
    return '<div class="cols"><div class="col wide">' + left + '</div><div class="col">' + right + '</div></div>';
  }

  /* ---------------- Logbook ---------------- */
  var PIREP = { ok: 'Validé', pending: 'En attente', rejected: 'Refusé', none: 'Aucun' };
  function lbFiltered() {
    var all = (logbook && logbook.flights) || [];
    if (lbFilter === 'all') return all;
    if (lbFilter === 'tracked') return all.filter(function (f) { return f.tracked; });
    return all.filter(function (f) { return (f.network || '—') === lbFilter; });
  }
  function renderLogbook() {
    if (!logbook) return '<div class="big-msg">' + t('Chargement…') + '</div>';
    var st = logbook.stats || {};
    var h = '<div class="stats"><div class="stat"><span>' + t('Vols') + '</span><b>' + num(st.flights) + '</b></div><div class="stat even"><span>' + t('Heures') + '</span><b>' + esc(st.hours || '0h00') + '</b></div>'
      + '<div class="stat"><span>' + t('Distance') + '</span><b>' + num(st.nm) + ' NM</b></div><div class="stat last even"><span>' + t('Note moyenne') + '</span><b>' + (st.avgScore != null ? st.avgScore + '/100' : '—') + '</b></div></div>';
    if (!logbook.flights.length) return h + '<div class="big-msg">' + t('Aucun vol enregistré.') + '</div>';
    var nets = [];
    logbook.flights.forEach(function (f) { var n = f.network || '—'; if (nets.indexOf(n) < 0) nets.push(n); });
    h += '<div class="chips"><a href="#" class="chip' + (lbFilter === 'all' ? ' on' : '') + '" data-lb="all">' + t('Tous') + '</a>'
      + nets.map(function (n) { return '<a href="#" class="chip' + (lbFilter === n ? ' on' : '') + '" data-lb="' + esc(n) + '">' + esc(n) + '</a>'; }).join('')
      + '<a href="#" class="chip' + (lbFilter === 'tracked' ? ' on' : '') + '" data-lb="tracked">' + t('Avec tracé') + '</a></div>';
    var list = lbFiltered();
    if (!list.length) return h + '<div class="empty">' + t('Aucun vol pour ce filtre.') + '</div>';
    list.slice(0, lbShown).forEach(function (f) {
      h += '<a href="#" class="flight" data-flight="' + esc(f.id) + '"><div class="fl-route"><b>' + esc(f.dep || '????') + ' → ' + esc(f.arr || '????') + '</b>'
        + '<small>' + esc(dateFr(f.date)) + (f.callsign ? ' · ' + esc(f.callsign) : '') + (f.aircraft ? ' · ' + esc(f.aircraft) : '') + '</small></div>'
        + '<div class="fl-meta">' + esc(f.duration || '—') + (f.nm != null ? ' · ' + num(f.nm) + ' NM' : '') + '<br>' + esc(f.network || '—') + (f.fpm != null ? ' · −' + Math.abs(Math.round(f.fpm)) + ' fpm' : '') + '</div>'
        + '<div class="fl-score" style="' + (f.score ? 'color:' + esc(f.score.color) + ';border-color:' + esc(f.score.color) : 'color:#3a4652') + '">' + (f.score ? esc(f.score.letter) : '—') + '</div></a>';
    });
    if (list.length > lbShown) h += '<a href="#" class="more" data-action="lb-more">' + t('Afficher plus') + ' (' + (list.length - lbShown) + ')</a>';
    return h;
  }
  function openFlight(id) {
    var f = null, all = (logbook && logbook.flights) || [];
    for (var i = 0; i < all.length; i++) if (all[i].id === id) f = all[i];
    if (!f) return;
    var h = '<div class="route">' + esc(f.dep || '????') + '<span class="arrow">→</span>' + esc(f.arr || '????') + '</div><div class="names">' + esc(dateFr(f.date)) + (f.callsign ? ' · ' + esc(f.callsign) : '') + '</div><div style="height:12px"></div>'
      + kv(t('Appareil'), f.aircraft) + kv(t('Réseau'), f.network) + kv(t('Règles'), f.rules) + kv(t('Durée'), f.duration) + kv(t('Distance'), f.nm != null ? num(f.nm) + ' NM' : null)
      + kv(t('Altitude max'), f.maxAltFt ? fl(f.maxAltFt) : null)
      + kv(t('Atterrissage'), f.fpm != null ? '−' + Math.abs(Math.round(f.fpm)) + ' ft/min' + (f.score ? ' · ' + f.score.letter + ' (' + f.score.score + '/100)' : '') + (f.bounces ? ' · ' + f.bounces + ' ' + t(f.bounces > 1 ? 'rebonds' : 'rebond') : '') : null)
      + kv(t('Carrière'), f.career) + kv(t('PIREP'), t(PIREP[f.pirep] || 'Aucun')) + kv(t('Remarques'), f.remarks)
      + (f.passengers && f.passengers.length ? kv(t('Passagers du chat'), f.passengers.join(', ')) : '');
    openSheet((f.callsign || f.dep + ' → ' + f.arr), h);
  }

  /* ---------------- Carrière ---------------- */
  function renderCareer() {
    if (!careers) return '<div class="big-msg">' + t('Chargement…') + '</div>';
    if (!careers.careers.length) return '<div class="big-msg"><b>' + t('Aucune carrière.') + '</b>' + t('Crée une carrière dans l\'onglet Carrière de FlightBrief.') + '</div>';
    var cols = ['', ''];
    careers.careers.forEach(function (c, i) {
      var h = '<div class="career"><span class="type">' + esc(c.type) + '</span><div class="name">' + esc(c.name) + '</div><div class="rank">' + esc(c.rank) + '</div>'
        + '<div class="bar"><i style="width:' + c.pct + '%"></i></div>'
        + '<div class="meta"><span>' + esc(c.hours) + ' h · ' + c.flights + ' ' + t('vols') + '</span><em>' + (c.next ? t('Prochain grade') + ' : ' + esc(c.next.name) + ' (' + esc(c.next.hours) + ' h)' : t('Grade maximum atteint')) + '</em></div>';
      (c.tours || []).forEach(function (tr) {
        h += '<div class="tour"><div class="t-head"><b>' + esc(tr.name) + '</b><span>' + tr.done + '/' + tr.total + ' ' + t('étapes') + '</span></div><div class="stops">';
        // Escale k atteinte quand les k premières étapes sont faites ; la suivante est la prochaine destination.
        (tr.stops || []).forEach(function (icao, k) {
          var cls = tr.done > 0 && k <= tr.done ? ' done' : (k === tr.done + 1 ? ' next' : '');
          h += '<span class="stop' + cls + '"><i></i>' + esc(icao || '----') + '</span>';
        });
        h += '</div>' + (tr.next ? '<div class="names">' + t('Prochaine étape') + ' : ' + esc(tr.next.dep) + ' → ' + esc(tr.next.arr) + '</div>' : '<div class="names" style="color:#39e88f">' + t('Terminé') + '</div>') + '</div>';
      });
      cols[i % 2] += h + '</div>';
    });
    return '<div class="cols"><div class="col">' + cols[0] + '</div><div class="col">' + cols[1] + '</div></div>';
  }

  /* ---------------- Live ---------------- */
  function btn(action, label, enabled, cls) {
    return '<a href="#" class="btn ' + (cls || '') + (enabled ? '' : ' off') + '" data-action="' + action + '">' + esc(label) + '</a>';
  }
  function renderLive() {
    var st = state.stream || {};
    if (!st.enabled) return '<div class="big-msg"><b>' + t('Live') + '</b>' + t('Le bot Twitch est désactivé dans FlightBrief.') + '</div>';
    var left = '<div class="card"><h3>' + t('Bot Twitch') + '</h3><div><b>' + esc(st.botName) + '</b> · #' + esc(st.channel) + '<span class="state' + (st.state === 'connected' ? ' on' : ' warn') + '">'
      + (st.state === 'connected' ? (st.canSpeak ? t('connecté au chat') : t('lecture seule')) : t('déconnecté')) + '</span></div></div>';
    var b = st.bets || {}, BS = { open: t('ouverts'), locked: t('fermés'), resolved: t('terminés') };
    left += '<div class="card"><h3>' + t('Paris d\'atterrissage') + '<small>' + (b.count ? b.count + ' ' + t('pronostics') : '') + '</small></h3><div><span class="state' + (b.state === 'open' ? ' on' : '') + '" style="margin-left:0">' + (BS[b.state] || t('pas de paris')) + '</span></div>'
      + '<div class="btns">' + btn('bets-open', t('Ouvrir'), b.state !== 'open', 'primary') + btn('bets-lock', t('Fermer les paris'), b.state === 'open') + btn('bets-cancel', t('Annuler'), b.state === 'open' || b.state === 'locked', 'warn') + '</div>';
    (b.guesses || []).forEach(function (g) { left += '<div class="row"><span class="l">' + esc(g.name) + '</span><span class="r">−' + esc(g.fpm) + ' fpm</span></div>'; });
    if (b.result && b.result.winner) left += '<div class="result">🎯 ' + t('Gagnant') + ' : ' + esc(b.result.winner.name) + ' (' + esc(b.result.winner.fpm) + ', ' + t('à') + ' ' + esc(b.result.winner.diff) + ' ' + t('près') + ') · −' + esc(b.result.actual) + ' fpm</div>';
    left += '</div>';
    if ((st.leaderboard || []).length) {
      left += '<div class="card"><h3>' + t('Meilleurs parieurs') + '</h3>';
      st.leaderboard.forEach(function (p, i) { left += '<div class="row"><span class="l">' + (i + 1) + '. ' + esc(p.name) + '</span><span class="r">' + p.wins + ' ' + t('victoires') + '</span></div>'; });
      left += '</div>';
    }
    left += '<div class="card"><h3>' + t('Activité du chat') + '</h3><div class="log">';
    var log = st.log || [];
    if (!log.length) left += '<div>' + t('Rien pour l\'instant.') + '</div>';
    log.forEach(function (e) { left += '<div class="' + (e.kind === 'reply' ? 'reply' : '') + '">' + (e.user ? '<b>' + esc(e.user) + '</b>' : '') + esc(e.text) + '</div>'; });
    left += '</div></div>';

    var right = '', c = st.cabin;
    if (c) {
      right += '<div class="card"><h3>' + t('À bord') + '<small>' + c.pax + ' ' + t('passagers') + '</small></h3><div><span class="state' + (c.boarding ? ' on' : '') + '" style="margin-left:0">' + (c.boarding ? t('Embarquement ouvert') : t('Portes fermées')) + '</span>'
        + (c.turbulence ? '<span class="state warn">⚠ ' + c.turbulence.safe + '/' + c.turbulence.atRisk + ' ' + t('ceintures') + '</span>' : '') + '</div>'
        + '<div class="btns">' + btn('boarding-open', t('Ouvrir l\'embarquement'), !c.boarding, 'primary') + btn('boarding-close', t('Fermer les portes'), c.boarding)
        + (c.turbOn ? btn('turbulence', t('Turbulences !'), !c.turbulence, 'warn') : '') + btn('shot', t('Capture d\'écran'), true) + '</div>';
      if (c.nextFlyover) right += '<div class="names" style="margin-bottom:6px">🏠 ' + t('Prochain survol') + ' : ' + t('chez') + ' ' + esc(c.nextFlyover.name) + ' (' + esc(c.nextFlyover.city) + ') · ' + esc(c.nextFlyover.km) + ' km</div>';
      if (c.quiz) right += '<div class="names" style="margin-bottom:6px">🧭 ' + t('Quiz en cours') + ' : ' + esc(c.quiz.text) + '</div>';
      if (!c.passengers.length) right += '<div class="empty">' + t('Personne à bord pour l\'instant.') + '</div>';
      c.passengers.forEach(function (p) {
        right += '<div class="row pax' + (p.present ? '' : ' away') + '"><span class="l"><span class="tier">' + esc(p.tierIcon) + '</span>' + pseudo(p.name, p.look) + (p.leg > 1 ? ' <span class="net">×' + p.leg + '</span>' : '') + '</span><span class="r">' + num(p.miles) + ' mi</span></div>';
      });
      right += '</div>';
      if ((c.ranking || []).length) {
        right += '<div class="card"><h3>' + t('Classement des miles') + '</h3>';
        c.ranking.forEach(function (r, i) { right += '<div class="row"><span class="l">' + (i + 1) + '. <span class="tier">' + esc(r.tierIcon) + '</span>' + pseudo(r.name, r.look) + '</span><span class="r">' + num(r.miles) + '</span></div>'; });
        right += '</div>';
      }
    } else right += '<div class="card"><div class="btns" style="margin-top:0">' + btn('shot', t('Capture d\'écran'), true) + '</div></div>';
    return '<div class="cols"><div class="col">' + left + '</div><div class="col">' + right + '</div></div>';
  }

  /* ---------------- affichage ---------------- */
  var lastHtml = {};
  function render() {
    renderConn();
    var pages = { briefing: renderBriefing, logbook: renderLogbook, career: renderCareer, live: renderLive };
    for (var k in pages) {
      if (k !== tab) continue; // seul l'onglet visible est recalculé
      var el = $('page-' + k);
      var html = state && failures < 3 ? pages[k]()
        : !state && failures < 3 ? '<div class="big-msg">' + t('Connexion à FlightBrief…') + '</div>'
        : '<div class="big-msg"><b>' + t('FlightBrief injoignable') + '</b>' + t('Lance FlightBrief sur ce PC.') + '<br>' + t('Cette page se met à jour toute seule dès que FlightBrief répond.') + '</div>';
      if (lastHtml[k] !== html) { el.innerHTML = html; lastHtml[k] = html; } // pas de réécriture inutile (scintillement)
    }
  }
  function openSheet(title, html) { $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html; $('sheetBody').scrollTop = 0; $('sheet').className = 'sheet'; }
  function closeSheet() { $('sheet').className = 'sheet hidden'; }

  var toastTimer = null;
  function toast(text, err) {
    var el = $('toast');
    el.className = 'toast' + (err ? ' err' : '');
    el.textContent = text;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.className = 'toast hidden'; }, 2500);
  }
  function showTab(tb) {
    tab = tb;
    var links = document.querySelectorAll('.tabs a');
    for (var i = 0; i < links.length; i++) links[i].className = links[i].getAttribute('data-tab') === tb ? 'on' : '';
    var pages = document.querySelectorAll('.page');
    for (var j = 0; j < pages.length; j++) pages[j].className = 'page' + (pages[j].id === 'page-' + tb ? ' on' : '');
    if (tb === 'logbook') loadPart('logbook');
    if (tb === 'career') loadPart('careers');
    render();
  }

  var ATTRS = ['data-tab', 'data-action', 'data-lb', 'data-flight'];
  document.addEventListener('click', function (e) {
    var el = e.target, attr = null;
    while (el && el !== document) {
      for (var i = 0; i < ATTRS.length && !attr; i++) if (el.getAttribute && el.getAttribute(ATTRS[i]) !== null) attr = ATTRS[i];
      if (attr) break;
      el = el.parentNode;
    }
    if (!attr) return;
    e.preventDefault();
    var v = el.getAttribute(attr);
    if (attr === 'data-tab') return showTab(v);
    if (attr === 'data-lb') { lbFilter = v; lbShown = 40; return render(); }
    if (attr === 'data-flight') return openFlight(v);
    if (v === 'sheet-close') return closeSheet();
    if (v === 'lb-more') { lbShown += 60; return render(); }
    if (v === 'ofp') {
      openSheet(t('OFP SimBrief'), '<div class="empty">' + t('Chargement…') + '</div>');
      return xhr('GET', '/api/efb/ofp?t=' + Date.now(), function (j) {
        var o = j && j.ofp;
        $('sheetTitle').textContent = o ? 'OFP ' + (o.callsign || '') + ' · ' + (o.dep || '') + ' → ' + (o.arr || '') + (o.airac ? ' · AIRAC ' + o.airac : '') : t('OFP SimBrief');
        $('sheetBody').innerHTML = o ? '<pre>' + esc(o.text) + '</pre>' : '<div class="empty">' + t('Pas d\'OFP SimBrief importé.') + '</div>';
      });
    }
    if (el.className.indexOf(' off') >= 0) return;
    xhr('POST', '/api/efb/action?a=' + encodeURIComponent(v), function (j) {
      toast(j && j.ok ? t('Fait ✓') : t('Impossible pour l\'instant.'), !(j && j.ok));
      window.setTimeout(function () { xhr('GET', '/api/efb/state?t=' + Date.now(), function (s) { if (s && s.ok) { state = s; render(); } }); }, 400);
    });
  });

  var labels = document.querySelectorAll('[data-t]');
  for (var i = 0; i < labels.length; i++) labels[i].textContent = t(labels[i].getAttribute('data-t'));
  window.setInterval(function () { if (tab === 'logbook') loadPart('logbook'); if (tab === 'career') loadPart('careers'); }, 15000);
  render();
  poll();
})();
