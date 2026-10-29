/* =========================================================
   FlightBrief — Duty free : les viewers dépensent leurs miles en cosmétiques (v2.0)
   ---------------------------------------------------------
   • Les miles gagnés restent le compteur du statut et du classement (cabin.js) ;
     les achats se paient sur le SOLDE = miles gagnés − miles dépensés (v.spent).
   • Trois rayons, un article porté par rayon (les articles achetés restent acquis) :
       badge   — emoji devant le pseudo (chat, overlays, carnet de vol public) ;
       titre   — affiché par !miles, sur les overlays et le carnet public ;
       couleur — couleur du pseudo sur les overlays et le carnet public.
   • Chat : !dutyfree [badges|titres|couleurs] pour le catalogue, !acheter <article>
     pour acheter (ou reporter gratuitement un article déjà acheté), !acheter retirer <rayon>.
   ========================================================= */

// code : nom tapé dans le chat (FR) ; alias : autres noms acceptés (EN / ES) ; price : en miles.
const ITEMS = [
  { code: 'avion', cat: 'badge', name: 'Avion de tourisme', icon: '🛩️', price: 300, alias: ['plane', 'avioneta'] },
  { code: 'helico', cat: 'badge', name: 'Hélico', icon: '🚁', price: 300, alias: ['heli', 'helicopter', 'helicoptero'] },
  { code: 'cafe', cat: 'badge', name: 'Café du cockpit', icon: '☕', price: 300, alias: ['coffee'] },
  { code: 'parachute', cat: 'badge', name: 'Parachute', icon: '🪂', price: 400, alias: ['paracaidas'] },
  { code: 'canard', cat: 'badge', name: 'Canard en plastique', icon: '🦆', price: 400, alias: ['duck', 'pato'] },
  { code: 'globe', cat: 'badge', name: 'Globe-trotteur', icon: '🌍', price: 600, alias: ['globo'] },
  { code: 'ovni', cat: 'badge', name: 'OVNI', icon: '🛸', price: 1000, alias: ['ufo'] },
  { code: 'dragon', cat: 'badge', name: 'Dragon', icon: '🐉', price: 1500, alias: [] },
  { code: 'diamant', cat: 'badge', name: 'Diamant', icon: '💎', price: 2500, alias: ['diamond', 'diamante'] },
  { code: 'clandestin', cat: 'title', name: 'Passager clandestin', icon: '🧳', price: 200, alias: ['stowaway', 'polizon'] },
  { code: 'spotteur', cat: 'title', name: 'Spotteur', icon: '📷', price: 600, alias: ['spotter'] },
  { code: 'pnc', cat: 'title', name: 'Personnel de cabine', icon: '🧑‍✈️', price: 1000, alias: ['crew', 'tcp'] },
  { code: 'copilote', cat: 'title', name: 'Copilote', icon: '🎧', price: 1500, alias: ['copilot', 'copiloto'] },
  { code: 'chef', cat: 'title', name: 'Chef de cabine', icon: '🛎️', price: 2500, alias: ['purser', 'sobrecargo'] },
  { code: 'controleur', cat: 'title', name: 'Contrôleur aérien', icon: '📡', price: 3000, alias: ['atc', 'controller', 'controlador'] },
  { code: 'commandant', cat: 'title', name: 'Commandant de bord', icon: '👨‍✈️', price: 5000, alias: ['captain', 'comandante'] },
  { code: 'as', cat: 'title', name: 'As du manche', icon: '🏆', price: 8000, alias: ['ace'] },
  { code: 'ciel', cat: 'color', name: 'Bleu ciel', icon: '🔵', color: '#5cc8ff', price: 500, alias: ['sky', 'cielo'] },
  { code: 'radar', cat: 'color', name: 'Vert radar', icon: '🟢', color: '#39e88f', price: 500, alias: [] },
  { code: 'balise', cat: 'color', name: 'Orange balise', icon: '🟠', color: '#ffa13d', price: 800, alias: ['beacon', 'baliza'] },
  { code: 'aurore', cat: 'color', name: 'Rose aurore', icon: '🌸', color: '#ff7ac8', price: 800, alias: ['dawn', 'aurora'] },
  { code: 'or', cat: 'color', name: 'Or', icon: '🟡', color: '#ffd166', price: 2000, alias: ['gold', 'oro'] },
  { code: 'arcenciel', cat: 'color', name: 'Arc-en-ciel', icon: '🌈', color: 'rainbow', price: 4000, alias: ['rainbow', 'arcoiris'] }
];
const CATS = {
  badge: { label: 'Badges', words: ['badge', 'badges', 'insigne', 'insignia'] },
  title: { label: 'Titres', words: ['titre', 'titres', 'title', 'titles', 'titulo', 'titulos'] },
  color: { label: 'Couleurs', words: ['couleur', 'couleurs', 'color', 'colors', 'colour', 'colores'] }
};
const UNEQUIP = ['retirer', 'enlever', 'remove', 'off', 'quitar'];

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const byCode = new Map();
ITEMS.forEach(it => [it.code, ...it.alias].forEach(a => { if (!byCode.has(norm(a))) byCode.set(norm(a), it); }));

const find = word => byCode.get(norm(word)) || null;
const get = code => ITEMS.find(it => it.code === code) || null;
const catOf = word => { const w = norm(word); return Object.keys(CATS).find(k => CATS[k].words.includes(w)) || null; };
// Prix réel : prix du catalogue × multiplicateur réglé par le streamer (arrondi à 10 miles).
const priceOf = (it, mult) => Math.max(10, Math.round(it.price * (isFinite(mult) && mult > 0 ? mult : 1) / 10) * 10);

// Cosmétiques portés par un viewer, prêts à afficher (overlays, carnet public, appli).
function look(v) {
  const eq = (v && v.equipped) || {};
  const b = get(eq.badge), t = get(eq.title), c = get(eq.color);
  return { badge: b ? b.icon : null, title: t ? t.name : null, color: c ? c.color : null };
}
// « 🦆 Kero » : pseudo précédé du badge porté.
const deco = (v, name) => { const b = look(v).badge; return (b ? b + ' ' : '') + (name || (v && v.name) || ''); };
const balance = v => Math.max(0, Math.round((v && v.miles || 0) - (v && v.spent || 0)));

// Achat / port d'un article. Renvoie { ok, kind, item, price, balance } ou { ok: false, error, … }.
function buy(v, word, mult) {
  const it = find(word);
  if (!it) return { ok: false, error: 'unknown' };
  v.owned = Array.isArray(v.owned) ? v.owned : [];
  v.equipped = v.equipped || {};
  if (v.owned.includes(it.code)) { v.equipped[it.cat] = it.code; return { ok: true, kind: 'equip', item: it, price: 0, balance: balance(v) }; }
  const price = priceOf(it, mult), bal = balance(v);
  if (bal < price) return { ok: false, error: 'funds', item: it, price, balance: bal };
  v.spent = Math.round((v.spent || 0) + price);
  v.owned.push(it.code);
  v.equipped[it.cat] = it.code;
  return { ok: true, kind: 'buy', item: it, price, balance: balance(v) };
}
function unequip(v, word) {
  const cat = catOf(word) || (find(word) && find(word).cat);
  if (!cat || !v.equipped || !v.equipped[cat]) return false;
  delete v.equipped[cat];
  return cat;
}

module.exports = { ITEMS, CATS, UNEQUIP, find, get, catOf, priceOf, look, deco, balance, buy, unequip, norm };
