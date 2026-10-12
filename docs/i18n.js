/* =========================================================
   FlightBrief — traduction de l'interface (FR source -> EN / ES)
   ---------------------------------------------------------
   Le code de l'appli reste écrit en français. Les textes affichés sont traduits à la volée :
     • dans les pages (appli, overlays OBS, mobile, carnet public) : tout texte ajouté au DOM,
       et les attributs title / placeholder / aria-label… ;
     • dans le processus principal : les messages du bot envoyés dans le chat Twitch.
   Dictionnaire : renderer/i18n/translations.js (3 colonnes FR | EN | ES).
   Une clé peut contenir {0}, {1}… pour les parties variables : « Dans ~{0} min » traduit
   « Dans ~5 min », et chaque partie variable est elle-même traduite si elle est connue.
   Un élément (ou ses enfants) marqué data-no-i18n n'est jamais traduit.
   ========================================================= */
(function (root) {
  const LANGS = { fr: 'Français', en: 'English', es: 'Español' };
  const LOCALES = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' };
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-label', 'data-tip', 'label'];
  let lang = 'fr', exact = null, byHead = new Map(), loose = [], rows = [];

  function pick(l) { l = String(l || '').slice(0, 2).toLowerCase(); return LANGS[l] ? l : 'en'; }
  function compile(key) {
    const parts = key.split(/\{(\d+)\}/);
    let re = '^', order = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2) { re += '([\\s\\S]*?)'; order.push(+parts[i]); } else re += parts[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return { re: new RegExp(re + '$'), order, lit: parts.filter((p, i) => !(i % 2)).join('').length };
  }
  // Dictionnaire : texte « fr\ten\tes » (une ligne par texte, # en début de ligne = commentaire).
  function load(tsv) {
    rows = rows.concat(String(tsv).split('\n').filter(l => l && l[0] !== '#').map(l => l.split('\t')).filter(r => r.length >= 3));
    if (exact) use(lang);
  }
  function use(l) {
    lang = l === 'fr' ? 'fr' : pick(l);
    exact = null; byHead = new Map(); loose = [];
    if (lang === 'fr') return;
    const col = lang === 'en' ? 1 : 2;
    exact = Object.create(null);
    for (const r of rows) {
      const k = r[0].trim(), v = (r[col] || '').trim();
      if (!k || !v) continue;
      if (!/\{\d+\}/.test(k)) { exact[k] = v; continue; }
      const p = { ...compile(k), v };
      const head = k.split('{')[0];
      if (head.length >= 3) { const h = head.slice(0, 3); if (!byHead.has(h)) byHead.set(h, []); byHead.get(h).push(p); } else loose.push(p);
    }
    const byLit = (a, b) => b.lit - a.lit; // le gabarit le plus précis gagne
    byHead.forEach(list => list.sort(byLit)); loose.sort(byLit);
  }
  function core(s, depth) {
    let out = exact[s];
    if (out != null) return out;
    if (depth > 2) return null;
    const cands = (byHead.get(s.slice(0, 3)) || []).concat(loose);
    for (const p of cands) {
      const g = s.match(p.re);
      if (!g) continue;
      return p.v.replace(/\{(\d+)\}/g, (m, i) => { const at = p.order.indexOf(+i); return at < 0 ? '' : tr(g[at + 1], depth + 1); });
    }
    return null;
  }
  // Traduit un texte affiché ; renvoie le texte tel quel s'il est inconnu.
  function tr(s, depth) {
    if (!exact || s == null || s === '') return s;
    const m = String(s).match(/^(\s*)([\s\S]*?)(\s*)$/), c = m[2];
    if (!c || !/\p{L}/u.test(c)) return s;
    const out = core(c.replace(/\s+/g, ' '), depth || 0);
    return out == null ? s : m[1] + out + m[3];
  }

  /* ---------- pages : traduction du DOM au fil de l'eau ---------- */
  const done = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, NOSCRIPT: 1 };
  function skip(el) { for (let e = el; e && e.nodeType === 1; e = e.parentNode) { if (SKIP[e.tagName] || (e.hasAttribute && (e.hasAttribute('data-no-i18n') || e.isContentEditable))) return true; } return false; }
  function text(n) {
    if (done.get(n) === n.nodeValue || skip(n.parentNode)) return;
    const v = tr(n.nodeValue);
    if (v !== n.nodeValue) n.nodeValue = v;
    done.set(n, n.nodeValue);
  }
  function attrs(el) {
    for (const a of ATTRS) {
      const cur = el.getAttribute(a);
      if (!cur) continue;
      const v = tr(cur);
      if (v !== cur) el.setAttribute(a, v);
    }
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value) { const v = tr(el.value); if (v !== el.value) el.value = v; }
  }
  // Attributs : seul data-no-i18n les protège (un placeholder de <textarea> se traduit, son contenu non).
  function noAttr(el) { return !!(el.closest && el.closest('[data-no-i18n]')); }
  function walk(node) {
    if (node.nodeType === 3) return text(node);
    if (node.nodeType !== 1 || noAttr(node)) return;
    attrs(node);
    const it = node.ownerDocument.createTreeWalker(node, 5 /* éléments + textes */);
    for (let n = it.nextNode(); n; n = it.nextNode()) { if (n.nodeType === 3) text(n); else if (!noAttr(n)) attrs(n); }
  }
  function start(doc) {
    if (lang === 'fr' || !doc || !doc.documentElement) return;
    doc.documentElement.lang = lang;
    const go = () => {
      walk(doc.documentElement);
      if (doc.title) doc.title = tr(doc.title);
      new MutationObserver(muts => {
        for (const m of muts) {
          if (m.type === 'childList') m.addedNodes.forEach(walk);
          else if (m.type === 'characterData') text(m.target);
          else if (m.type === 'attributes' && !noAttr(m.target)) attrs(m.target);
        }
      }).observe(doc.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
    // Boîtes de dialogue natives et textes dessinés sur canvas (carte postale, graphiques).
    const w = doc.defaultView;
    ['alert', 'confirm', 'prompt'].forEach(f => { const o = w[f]; if (o) w[f] = (msg, ...r) => o.call(w, tr(msg), ...r); });
    const C = w.CanvasRenderingContext2D && w.CanvasRenderingContext2D.prototype;
    if (C) ['fillText', 'strokeText'].forEach(f => { const o = C[f]; C[f] = function (t, ...r) { return o.call(this, tr(t), ...r); }; });
  }

  const api = { LANGS, load, use, tr, start, pick, rows: () => rows, get lang() { return lang; }, locale: () => LOCALES[lang] || 'fr-FR' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FBI18N = api;
})(typeof window !== 'undefined' ? window : globalThis);
