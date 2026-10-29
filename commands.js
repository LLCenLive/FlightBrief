/* =========================================================
   FlightBrief — commandes du chat personnalisables (v2.0)
   ---------------------------------------------------------
   Catalogue unique des commandes du bot (vol, paris) et de « À bord » (cabin.js) :
   chaque commande garde ses noms d'origine (FR / EN / ES), et le streamer peut la
   renommer et régler son délai anti-spam dans l'onglet Twitch.
   • Une commande renommée ne répond PLUS à ses noms d'origine : on la renomme souvent
     parce qu'un autre bot de la chaîne (Nightbot, StreamElements…) utilise déjà !top ou !miles.
   • Les messages du bot restent écrits avec les noms d'origine (et donc traduisibles) :
     renameInText() remplace, juste avant l'envoi, chaque nom d'origine par le nom choisi.
   Réglages (config du bot Twitch) : commands { clé: actif }, cmdNames { clé: 'nom' },
   cmdCooldowns { clé: secondes }.
   ========================================================= */

// names : nom affiché par langue ; aliases : autres noms acceptés (sans le « ! »).
// cooldown : délai par défaut en secondes (null = délai général du bot, réglé dans l'onglet Twitch).
const CATALOG = [
  { key: 'eta', group: 'bot', names: { fr: 'eta', en: 'eta', es: 'eta' }, aliases: [], cooldown: null },
  { key: 'route', group: 'bot', names: { fr: 'route', en: 'route', es: 'route' }, aliases: [], cooldown: null },
  { key: 'metar', group: 'bot', names: { fr: 'metar', en: 'metar', es: 'metar' }, aliases: [], cooldown: null },
  { key: 'avion', group: 'bot', names: { fr: 'avion', en: 'aircraft', es: 'avion' }, aliases: ['plane', 'avión'], cooldown: null },
  { key: 'alt', group: 'bot', names: { fr: 'alt', en: 'alt', es: 'alt' }, aliases: ['altitude', 'altitud'], cooldown: null },
  { key: 'landing', group: 'bot', names: { fr: 'landing', en: 'landing', es: 'aterrizaje' }, aliases: ['atterro', 'atterrissage'], cooldown: null },
  { key: 'pari', group: 'bot', names: { fr: 'pari', en: 'bet', es: 'apuesta' }, aliases: [], cooldown: 0 },
  { key: 'top', group: 'bot', names: { fr: 'top', en: 'top', es: 'top' }, aliases: ['classement', 'ranking', 'leaderboard'], cooldown: null },
  { key: 'fb', group: 'bot', names: { fr: 'fb', en: 'fb', es: 'fb' }, aliases: ['flightbrief', 'commandes', 'commands', 'comandos'], cooldown: null },
  { key: 'board', group: 'cabin', names: { fr: 'embarquer', en: 'board', es: 'embarcar' }, aliases: ['monter', 'abord', 'boarding', 'abordar'], cooldown: 0 },
  { key: 'miles', group: 'cabin', names: { fr: 'miles', en: 'miles', es: 'millas' }, aliases: ['statut', 'status', 'estatus'], cooldown: 30 },
  { key: 'passport', group: 'cabin', names: { fr: 'passeport', en: 'passport', es: 'pasaporte' }, aliases: [], cooldown: 30 },
  { key: 'city', group: 'cabin', names: { fr: 'maville', en: 'mycity', es: 'miciudad' }, aliases: ['ville', 'city', 'ciudad'], cooldown: 30 },
  { key: 'trip', group: 'cabin', names: { fr: 'voyage', en: 'trip', es: 'viaje' }, aliases: ['correspondance'], cooldown: 30 },
  { key: 'pax', group: 'cabin', names: { fr: 'passagers', en: 'passengers', es: 'pasajeros' }, aliases: ['manifeste'], cooldown: 20 },
  { key: 'answer', group: 'cabin', names: { fr: 'rep', en: 'answer', es: 'resp' }, aliases: ['reponse', 'respuesta'], cooldown: 0 },
  { key: 'arrival', group: 'cabin', names: { fr: 'arrivee', en: 'arrival', es: 'llegada' }, aliases: [], cooldown: 0 },
  { key: 'seatbelt', group: 'cabin', names: { fr: 'ceinture', en: 'seatbelt', es: 'cinturon' }, aliases: ['belt', 'cinturón'], cooldown: 0 },
  { key: 'dutyfree', group: 'cabin', names: { fr: 'dutyfree', en: 'dutyfree', es: 'dutyfree' }, aliases: ['boutique', 'shop', 'tienda'], cooldown: 30 },
  { key: 'buy', group: 'cabin', names: { fr: 'acheter', en: 'buy', es: 'comprar' }, aliases: [], cooldown: 5 },
  { key: 'vatsim', group: 'cabin', names: { fr: 'vatsim', en: 'vatsim', es: 'vatsim' }, aliases: [], cooldown: 10 },
  { key: 'ivao', group: 'cabin', names: { fr: 'ivao', en: 'ivao', es: 'ivao' }, aliases: [], cooldown: 10 },
  { key: 'help', group: 'cabin', names: { fr: 'cabine', en: 'cabin', es: 'cabina' }, aliases: ['abords'], cooldown: 60 }
];
const BY_KEY = new Map(CATALOG.map(c => [c.key, c]));

// Minuscules, sans accents ni espaces : « !Arrivée » -> « arrivee ».
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '');
// Nom saisi par le streamer -> nom valide (lettres, chiffres, _ ; 25 caractères) ou '' (= nom d'origine).
const cleanName = s => norm(String(s || '').replace(/^!+/, '')).replace(/[^a-z0-9_]/g, '').slice(0, 25);

const customName = (key, cfg) => cleanName(cfg && cfg.cmdNames && cfg.cmdNames[key]);
const isEnabled = (key, cfg) => !(cfg && cfg.commands && cfg.commands[key] === false);
const originalNames = c => [...new Set([c.names.fr, c.names.en, c.names.es, ...c.aliases].map(norm))];

// Table « nom tapé -> clé » : noms choisis d'abord (ils l'emportent sur un alias d'origine
// d'une autre commande), puis noms d'origine des commandes qui n'ont pas été renommées.
function lookupTable(cfg) {
  const t = new Map();
  for (const c of CATALOG) { const n = customName(c.key, cfg); if (n && !t.has(n)) t.set(n, c.key); }
  for (const c of CATALOG) { if (customName(c.key, cfg)) continue; for (const n of originalNames(c)) if (!t.has(n)) t.set(n, c.key); }
  return t;
}
let _cache = { cfg: null, sig: '', table: null };
const sigOf = cfg => JSON.stringify(cfg && cfg.cmdNames || {});
function table(cfg) {
  const sig = sigOf(cfg);
  if (_cache.sig !== sig || !_cache.table) _cache = { cfg, sig, table: lookupTable(cfg) };
  return _cache.table;
}

// « !eta », « !metar LFPG » -> { key, group, args, rest } ; null si ce n'est pas une commande connue et active.
function resolve(text, cfg, group) {
  text = String(text || '').trim();
  if (!text.startsWith('!')) return null;
  const [raw, ...args] = text.slice(1).split(/\s+/);
  const key = table(cfg).get(norm(raw));
  if (!key || !isEnabled(key, cfg)) return null;
  const c = BY_KEY.get(key);
  if (group && c.group !== group) return null;
  return { key, group: c.group, args, rest: args.join(' ').trim() };
}

// Délai anti-spam (s) d'une commande : réglage du streamer, sinon valeur par défaut.
function cooldownOf(key, cfg, fallback) {
  const v = cfg && cfg.cmdCooldowns ? cfg.cmdCooldowns[key] : null;
  if (v != null && v !== '' && isFinite(v)) return Math.max(0, Math.min(3600, +v));
  const c = BY_KEY.get(key);
  return c && c.cooldown != null ? c.cooldown : (fallback != null ? fallback : 0);
}

// Nom à afficher (« !eta ») dans la langue de l'appli.
function displayName(key, cfg, lang) {
  const c = BY_KEY.get(key);
  if (!c) return '!' + key;
  return '!' + (customName(key, cfg) || c.names[lang] || c.names.fr);
}

// Dans un message déjà traduit : chaque nom d'origine d'une commande renommée -> nouveau nom.
function renameInText(text, cfg) {
  if (!text || !cfg || !cfg.cmdNames) return text;
  let out = String(text);
  for (const c of CATALOG) {
    const n = customName(c.key, cfg);
    if (!n) continue;
    const alts = originalNames(c).filter(x => x !== n).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!alts.length) continue;
    out = out.replace(new RegExp('!(?:' + alts.join('|') + ')(?![\\p{L}\\d_])', 'giu'), '!' + n);
  }
  return out;
}

// Deux commandes avec le même nom (choisi ou d'origine) : { nom: [clés…] } pour prévenir dans l'onglet Twitch.
function conflicts(cfg) {
  const seen = new Map();
  for (const c of CATALOG) {
    const n = customName(c.key, cfg);
    const names = n ? [n] : originalNames(c);
    for (const x of names) { if (!seen.has(x)) seen.set(x, []); seen.get(x).push(c.key); }
  }
  const out = {};
  for (const [n, keys] of seen) if (keys.length > 1 && keys.some(k => customName(k, cfg))) out[n] = keys;
  return out;
}

module.exports = { CATALOG, resolve, cooldownOf, displayName, renameInText, conflicts, cleanName, isEnabled };
