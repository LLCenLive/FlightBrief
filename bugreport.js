/* =========================================================
   FlightBrief — « Signaler un bug » (v2.0)
   ---------------------------------------------------------
   Prépare un rapport (description + infos techniques + dernières erreurs) que le pilote
   relit avant de l'envoyer lui-même : rien ne part tout seul. Deux sorties :
   • une issue GitHub pré-remplie, ouverte dans le navigateur (le pilote se connecte à GitHub
     et clique « Submit ») ;
   • le texte complet copié dans le presse-papiers (Discord, e-mail…).
   Vie privée : les journaux sont nettoyés avant d'être montrés (chemins du PC, nom de la
   session Windows, jetons Twitch / GitHub, e-mails, adresses IP) et aucune donnée du logbook,
   des viewers ou des comptes n'est jointe : seulement des compteurs et des états.
   ========================================================= */
const REPO_URL = 'https://github.com/LLCenLive/FlightBrief';
const MAX_URL = 7500;     // au-delà, certains navigateurs / GitHub coupent l'adresse
const MAX_LOG_LINES = 40;

// Retire du texte tout ce qui pourrait identifier le pilote ou ouvrir un compte.
function sanitize(text, ctx) {
  let s = String(text || '');
  const home = ctx && ctx.home ? String(ctx.home) : '';
  if (home) {
    const variants = [home, home.replace(/\\/g, '/'), home.replace(/\\/g, '\\\\')];
    for (const v of variants) if (v) s = s.split(v).join('~');
  }
  if (ctx && ctx.user && ctx.user.length > 2) s = s.replace(new RegExp(ctx.user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '<user>');
  return s
    .replace(/oauth:[A-Za-z0-9]+/g, 'oauth:<masqué>')
    .replace(/\b(github_pat_|ghp_|gho_|ghu_|ghs_)[A-Za-z0-9_]+/g, '$1<masqué>')
    .replace(/(Bearer|OAuth)\s+[A-Za-z0-9._-]{8,}/gi, '$1 <masqué>')
    .replace(/([?&](?:token|key|access_token|client_secret)=)[^&\s]+/gi, '$1<masqué>')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<e-mail>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, ip => ip.split('.').some(o => +o > 255) || /^(127\.|0\.0\.0\.0)/.test(ip) ? ip : '<ip>');
}

// Dernières lignes d'un journal (fichier crash ou erreurs de l'interface), nettoyées.
function tailLog(text, ctx, n) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  return lines.slice(-(n || MAX_LOG_LINES)).map(l => sanitize(l, ctx).slice(0, 400));
}

function diagText(d) {
  const rows = Object.entries(d || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => `- ${k} : ${v}`);
  return rows.join('\n');
}

// r : { title, what, steps, expected, diag: {…} | null, logs: [lignes] | null }
function reportMarkdown(r) {
  const parts = [];
  parts.push('### Ce qui se passe\n' + (String(r.what || '').trim() || '_(non précisé)_'));
  if (String(r.steps || '').trim()) parts.push('### Pour le reproduire\n' + String(r.steps).trim());
  if (String(r.expected || '').trim()) parts.push('### Ce qui était attendu\n' + String(r.expected).trim());
  if (r.diag) parts.push('### Infos techniques\n' + diagText(r.diag));
  if (r.logs && r.logs.length) parts.push('### Dernières erreurs\n```\n' + r.logs.join('\n') + '\n```');
  parts.push('_Rapport préparé par le bouton « Signaler un bug » de FlightBrief._');
  return parts.join('\n\n');
}

// Adresse d'une nouvelle issue pré-remplie. Trop longue : on retire d'abord les journaux
// (le rapport complet reste dans le presse-papiers), puis on coupe la description.
function issueUrl(r, repoUrl) {
  const base = (repoUrl || REPO_URL).replace(/\.git$/, '').replace(/\/+$/, '') + '/issues/new';
  const title = String(r.title || '').trim().slice(0, 120) || 'Bug';
  const make = body => `${base}?labels=bug&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  let url = make(reportMarkdown(r));
  if (url.length <= MAX_URL) return { url, truncated: false };
  url = make(reportMarkdown({ ...r, logs: null }) + '\n\n_Journaux trop longs pour l\'adresse : colle ici le rapport complet copié par FlightBrief._');
  if (url.length <= MAX_URL) return { url, truncated: true };
  return { url: make('_Rapport trop long pour l\'adresse : colle ici le rapport complet copié par FlightBrief (Ctrl+V)._'), truncated: true };
}

module.exports = { sanitize, tailLog, reportMarkdown, issueUrl, diagText, REPO_URL, MAX_URL };
