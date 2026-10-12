/* Carnet de vol public — généré par FlightBrief. Lecture seule, aucune requête réseau.
   Tout texte venant des données est inséré avec textContent (jamais en HTML). */
(function(){
  'use strict';
  var D = window.FB_PUBLIC || { flights: [], viewers: [], airports: {} };
  var COAST = window.FB_COAST || [];
  var $ = function(id){ return document.getElementById(id); };

  // h('div', { class: 'x', onclick: fn }, [enfants | texte])
  function h(tag, attrs, kids){
    var n = document.createElement(tag);
    if(attrs) Object.keys(attrs).forEach(function(k){
      var v = attrs[k];
      if(v == null || v === false) return;
      if(k === 'class') n.className = v;
      else if(k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if(k === 'style') Object.keys(v).forEach(function(p){ n.style.setProperty(p, v[p]); });
      else n.setAttribute(k, v);
    });
    (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(function(c){
      if(c == null || c === false) return;
      n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return n;
  }
  var nf = function(n){ return Math.round(n || 0).toLocaleString(FBI18N.locale()); };
  var hhmm = function(min){ if(min == null) return '—'; min = Math.round(min); return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0'); };
  var dateFr = function(d){ if(!d) return ''; var p = String(d).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; };
  var safeHash = function(s){ return encodeURIComponent(String(s || '')); };

  /* ---------- en-tête ---------- */
  document.title = 'Carnet de vol — ' + (D.pilot || 'Pilote');
  $('pilot').textContent = D.title || D.pilot || 'Pilote';
  if(D.twitch){ var tl = $('twitchLink'); tl.href = 'https://www.twitch.tv/' + D.twitch; tl.textContent = '● twitch.tv/' + D.twitch; tl.classList.remove('hidden'); }
  var fl = D.flights || [];
  var totalMin = fl.reduce(function(s, f){ return s + (f.durationMin || 0); }, 0);
  var totalNm = fl.reduce(function(s, f){ return s + (f.distanceNm || 0); }, 0);
  var aps = {}; fl.forEach(function(f){ if(f.dep) aps[f.dep] = 1; if(f.arr) aps[f.arr] = 1; });
  var paxIds = {}; fl.forEach(function(f){ (f.passengers || []).forEach(function(p){ paxIds[p.id] = 1; }); });
  [[nf(fl.length), 'Vols'], [Math.round(totalMin / 60) + ' h', 'En l’air'], [nf(totalNm), 'NM'], [nf(Object.keys(aps).length), 'Aéroports'], [nf(Object.keys(paxIds).length || (D.viewers || []).length), 'Passagers']]
    .forEach(function(s){ $('stats').appendChild(h('div', { class: 'stat' }, [h('b', null, s[0]), h('span', null, s[1])])); });
  $('foot').textContent = 'Généré par FlightBrief' + (D.version ? ' v' + D.version : '') + ' le ' + new Date(D.generatedAt || Date.now()).toLocaleString(FBI18N.locale(), { dateStyle: 'long', timeStyle: 'short' }) + ' · site statique, aucune donnée collectée.';

  /* ---------- carte (canvas, projection équirectangulaire ajustée aux vols) ---------- */
  var canvas = $('map'), ctx = canvas.getContext('2d'), selected = -1, focusSet = null; // focusSet : vols d'un passager (page passeport)
  function routeOf(f){
    if(f.path && f.path.length > 1) return f.path;
    var a = D.airports[f.dep], b = D.airports[f.arr];
    return a && b ? [[a.lat, a.lon], [b.lat, b.lon]] : null;
  }
  function bounds(){
    var la = [], lo = [];
    fl.forEach(function(f){ var r = routeOf(f); if(r) r.forEach(function(p){ la.push(p[0]); lo.push(p[1]); }); });
    if(!la.length) return { s: -55, n: 70, w: -170, e: 190 };
    var s = Math.min.apply(null, la), n = Math.max.apply(null, la), w = Math.min.apply(null, lo), e = Math.max.apply(null, lo);
    var padLat = Math.max(3, (n - s) * .25), padLon = Math.max(5, (e - w) * .25);
    return { s: Math.max(-80, s - padLat), n: Math.min(84, n + padLat), w: w - padLon, e: e + padLon };
  }
  function drawMap(){
    var dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var b = bounds(), midLat = (b.s + b.n) / 2, k = Math.cos(midLat * Math.PI / 180);
    // Garde les proportions : on élargit la boîte dans la dimension trop courte.
    var spanX = (b.e - b.w) * k, spanY = b.n - b.s;
    if(spanX / spanY > W / H){ var ny = spanX * H / W; b.s = midLat - ny / 2; b.n = midLat + ny / 2; }
    else { var nx = spanY * W / H / k, mid = (b.w + b.e) / 2; b.w = mid - nx / 2; b.e = mid + nx / 2; }
    var X = function(lon){ return (lon - b.w) / (b.e - b.w) * W; }, Y = function(lat){ return (b.n - lat) / (b.n - b.s) * H; };
    // Graticule
    ctx.strokeStyle = 'rgba(84,214,232,.07)'; ctx.lineWidth = 1;
    var step = (b.e - b.w) > 60 ? 15 : (b.e - b.w) > 20 ? 5 : 2;
    for(var g = Math.ceil(b.w / step) * step; g < b.e; g += step){ ctx.beginPath(); ctx.moveTo(X(g), 0); ctx.lineTo(X(g), H); ctx.stroke(); }
    for(var g2 = Math.ceil(b.s / step) * step; g2 < b.n; g2 += step){ ctx.beginPath(); ctx.moveTo(0, Y(g2)); ctx.lineTo(W, Y(g2)); ctx.stroke(); }
    // Côtes (copiées aussi à ±360° pour les vols qui traversent l'antiméridien)
    ctx.strokeStyle = 'rgba(207,233,242,.42)'; ctx.lineWidth = 1;
    [-360, 0, 360].forEach(function(off){
      COAST.forEach(function(line){
        ctx.beginPath();
        line.forEach(function(p, i){ var x = X(p[0] + off), y = Y(p[1]); if(i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
      });
    });
    // Routes
    fl.forEach(function(f, i){
      var r = routeOf(f); if(!r) return;
      var on = focusSet ? focusSet[i] : i === selected, col = f.rules === 'VFR' ? '255,176,32' : '84,214,232';
      ctx.strokeStyle = 'rgba(' + col + ',' + (selected < 0 && !focusSet ? .65 : on ? 1 : .14) + ')';
      ctx.lineWidth = on ? 3 : 1.6;
      ctx.beginPath();
      r.forEach(function(p, j){ var x = X(p[1]), y = Y(p[0]); if(j) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
    });
    // Aéroports
    Object.keys(aps).forEach(function(icao){
      var a = D.airports[icao]; if(!a) return;
      var x = X(a.lon), y = Y(a.lat);
      ctx.fillStyle = '#39e88f'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(10,13,17,.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    if(selected >= 0){
      var f = fl[selected];
      [f.dep, f.arr].forEach(function(icao){
        var a = D.airports[icao]; if(!a) return;
        ctx.font = '600 12px ' + getComputedStyle(document.body).getPropertyValue('--mono');
        ctx.fillStyle = 'rgba(10,13,17,.85)'; var w = ctx.measureText(icao).width + 10;
        ctx.fillRect(X(a.lon) + 6, Y(a.lat) - 18, w, 17);
        ctx.fillStyle = '#e7edf2'; ctx.fillText(icao, X(a.lon) + 11, Y(a.lat) - 5);
      });
    }
  }
  var rt; window.addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(drawMap, 120); });

  /* ---------- vues ---------- */
  var lb = $('lightbox');
  function openLb(src){ $('lightboxImg').src = src; lb.classList.remove('hidden'); }
  lb.addEventListener('click', function(e){ if(e.target !== $('lightboxImg')) lb.classList.add('hidden'); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') lb.classList.add('hidden'); });
  var apName = function(icao){ var a = D.airports[icao]; return a ? a.name : ''; };

  function viewFlights(main){
    if(!fl.length){ main.appendChild(h('div', { class: 'empty' }, 'Aucun vol pour le moment.')); return; }
    var list = h('div', { class: 'flights' });
    fl.forEach(function(f, i){
      var row = h('div', { class: 'fl' + (i === selected ? ' on' : ''), onclick: function(){ selected = selected === i ? -1 : i; drawMap(); [].forEach.call(list.children, function(c, j){ c.classList.toggle('on', j === selected); }); } }, [
        h('div', { class: 'd' }, dateFr(f.date)),
        h('div', { class: 'r' }, [ (f.dep || '????') + ' → ' + (f.arr || '????'), h('span', { class: 'rule ' + f.rules }, f.rules), h('small', null, [apName(f.dep), apName(f.arr)].filter(Boolean).join(' → ')) ]),
        h('div', { class: 'ac' }, [f.callsign, f.aircraft].filter(Boolean).join(' · ')),
        h('div', { class: 'n' }, hhmm(f.durationMin)),
        h('div', { class: 'n dist' }, f.distanceNm != null ? nf(f.distanceNm) + ' NM' : '—'),
        h('div', { class: 'ld' }, f.landing ? [ '−' + nf(f.landing.fpm) + ' fpm', f.landing.letter ? h('span', { class: 'grade g-' + f.landing.letter }, f.landing.letter) : null ] : '—'),
        h('div', { class: 'pax' }, [ f.passengers.length ? '👥 ' + f.passengers.length : '', f.postcard ? h('img', { class: 'thumb', src: f.postcard, alt: 'Carte postale', onclick: function(e){ e.stopPropagation(); openLb(f.postcard); } }) : null ]),
        h('div', { class: 'fl-detail' }, f.passengers.length ? [ 'À bord :', h('div', { class: 'chips' }, f.passengers.map(function(p){ return h('a', { class: 'chip', href: '#/p/' + safeHash(p.id), onclick: function(e){ e.stopPropagation(); } }, p.name); })) ] : 'Pas de passagers du chat sur ce vol.')
      ]);
      list.appendChild(row);
    });
    main.appendChild(list);
  }

  function viewPassengers(main){
    var v = D.viewers || [];
    if(!v.length){ main.appendChild(h('div', { class: 'empty' }, 'Pas encore de passagers. Rejoins le stream et tape !embarquer pendant un vol !')); return; }
    var tb = h('tbody');
    v.forEach(function(p, i){
      tb.appendChild(h('tr', { class: 'row', onclick: function(){ location.hash = '#/p/' + safeHash(p.id); } }, [
        h('td', { class: 'rk' }, String(i + 1)),
        h('td', { class: 'name' }, p.name),
        h('td', null, h('span', { class: 'tier t-' + p.tier }, [p.tierIcon + ' ', p.tier])),
        h('td', { class: 'num' }, nf(p.miles)),
        h('td', { class: 'num hide-m' }, String(p.flights)),
        h('td', { class: 'num hide-m' }, String(p.stamps.length)),
        h('td', { class: 'flags hide-m' }, p.countries.map(function(c){ return c.flag; }).join(''))
      ]));
    });
    main.appendChild(h('table', { class: 'board' }, [ h('thead', null, h('tr', null, ['#', 'Passager', 'Statut', 'Miles', 'Vols', 'Tampons', 'Pays'].map(function(t, i){ return h('th', { class: (i >= 4 ? 'hide-m ' : '') + (i === 3 || i === 4 || i === 5 ? 'num' : '') }, t); }))), tb ]));
  }

  // Couleur et forme des tampons : stables pour un même aéroport.
  var INKS = ['#b23a48', '#2d5fa8', '#2f7d4f', '#7a3fa0', '#a8621d', '#1d7a86'];
  function hash(s){ var x = 0; for(var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return Math.abs(x); }
  function viewPassport(main, id){
    var p = (D.viewers || []).filter(function(x){ return x.id === id; })[0];
    main.appendChild(h('a', { class: 'back', href: '#/passagers' }, '← Tous les passagers'));
    if(!p){ main.appendChild(h('div', { class: 'empty' }, 'Passeport introuvable.')); return; }
    var stamps = p.stamps.slice().sort(function(a, b){ return String(a.first).localeCompare(String(b.first)); });
    var page = h('div', { class: 'pp-page' }, [
      h('h3', null, 'Visas & tampons · ' + stamps.length + ' aéroport' + (stamps.length > 1 ? 's' : '')),
      stamps.length ? h('div', { class: 'stamps' }, stamps.map(function(s){
        var k = hash(s.icao), round = k % 3 === 0;
        return h('div', { class: 'stamp' + (round ? ' round' : ''), title: s.name || s.icao, style: { '--c': INKS[k % INKS.length], transform: 'rotate(' + ((k % 15) - 7) + 'deg)' } }, [
          h('b', null, s.icao), h('div', { class: 'c' }, s.city || s.name || ''), h('div', { class: 'dt' }, dateFr(s.first)), s.count > 1 ? h('span', { class: 'x' }, '×' + s.count) : null
        ]);
      })) : h('div', { class: 'empty' }, 'Pas encore de tampon.'),
      p.postcards.length ? h('h3', { style: { 'margin-top': '22px' } }, 'Cartes postales') : null,
      p.postcards.length ? h('div', { class: 'pp-cards' }, p.postcards.slice().reverse().map(function(src){ return h('img', { src: src, alt: 'Carte postale', onclick: function(){ openLb(src); } }); })) : null
    ]);
    main.appendChild(h('div', { class: 'passport' }, [
      h('div', { class: 'pp-cover' }, [
        h('div', { class: 'crest' }, p.tierIcon || '✈'),
        h('div', null, [ h('div', { class: 'lbl' }, 'Passeport · ' + (D.pilot || '')), h('h2', null, p.name) ]),
        h('div', { class: 'kv' }, [
          h('div', null, [h('b', null, p.tier), h('span', null, 'Statut')]),
          h('div', null, [h('b', null, nf(p.miles)), h('span', null, 'Miles')]),
          h('div', null, [h('b', null, String(p.flights)), h('span', null, 'Vols')]),
          h('div', null, [h('b', null, String(p.bestTrip || 0)), h('span', null, 'Record d’affilée')])
        ]),
        h('div', { class: 'flags', title: p.countries.map(function(c){ return c.name; }).join(', ') }, p.countries.map(function(c){ return c.flag; }).join(' '))
      ]),
      page
    ]));
  }

  function viewCards(main){
    var cards = fl.filter(function(f){ return f.postcard; });
    if(!cards.length){ main.appendChild(h('div', { class: 'empty' }, 'Pas encore de carte postale.')); return; }
    main.appendChild(h('div', { class: 'cards' }, cards.map(function(f){
      return h('div', { class: 'card', onclick: function(){ openLb(f.postcard); } }, [ h('img', { src: f.postcard, alt: 'Carte postale ' + f.arr, loading: 'lazy' }), h('div', null, [ h('b', null, (f.dep || '') + ' → ' + (f.arr || '')), ' · ' + dateFr(f.date) + (f.passengers.length ? ' · ' + f.passengers.length + ' passager' + (f.passengers.length > 1 ? 's' : '') : '') ]) ]);
    })));
  }

  function route(){
    var hsh = location.hash || '#/vols', main = $('main');
    main.textContent = '';
    var m = hsh.match(/^#\/p\/(.+)$/), tab = m ? 'passagers' : (hsh.replace('#/', '') || 'vols');
    // Page passeport : la carte met en avant les vols où ce passager était à bord.
    focusSet = null;
    if(m){ var id = decodeURIComponent(m[1]); focusSet = {}; fl.forEach(function(f, i){ if((f.passengers || []).some(function(p){ return p.id === id; })) focusSet[i] = true; }); selected = -1; }
    drawMap();
    [].forEach.call($('tabs').children, function(a){ a.classList.toggle('on', a.getAttribute('data-tab') === tab); });
    if(m) viewPassport(main, decodeURIComponent(m[1]));
    else if(tab === 'passagers') viewPassengers(main);
    else if(tab === 'cartes') viewCards(main);
    else viewFlights(main);
  }
  window.addEventListener('hashchange', route);
  route();
})();
