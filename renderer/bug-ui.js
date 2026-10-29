/* =========================================================
   FlightBrief 2.0 — « Signaler un bug » (interface)
   ---------------------------------------------------------
   Chargé avant app.js pour noter dès le démarrage les erreurs de l'interface.
   La fenêtre montre TOUT ce qui sera joint (infos techniques, dernières erreurs nettoyées) :
   le pilote coche ce qu'il veut partager, puis ouvre l'issue GitHub pré-remplie ou copie
   le rapport. Rien n'est envoyé automatiquement.
   ========================================================= */
(function(){
'use strict';
const FBBug = {};
window.FBBug = FBBug;
const errors = [];
const note = s => { errors.push(`${new Date().toISOString().slice(11, 19)} ${String(s).slice(0, 300)}`); if(errors.length > 30) errors.shift(); };
window.addEventListener('error', e => note(`${e.message || 'Erreur'}${e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : ''}`));
window.addEventListener('unhandledrejection', e => note('Promesse rejetée : ' + ((e.reason && (e.reason.message || e.reason)) || '?')));

const $ = id => document.getElementById(id);
const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let prepared = null;

function build(){
  if($('bugOverlay')) return;
  const o = document.createElement('div');
  o.className = 'modal-overlay hidden'; o.id = 'bugOverlay';
  o.addEventListener('click', e => { if(e.target === o) FBBug.close(); });
  o.innerHTML = `<div class="modal bug-modal">
    <div class="modal-head"><h3>🐞 Signaler un bug</h3><button class="btn small" onclick="FBBug.close()">Fermer</button></div>
    <div class="field"><label>Résumé</label><input type="text" id="bugTitle" maxlength="120" placeholder="ex : le bot ne répond plus après un atterrissage"></div>
    <div class="field"><label>Ce qui se passe</label><textarea id="bugWhat" rows="3" maxlength="3000"></textarea></div>
    <div class="field"><label>Pour le reproduire <small class="hint">(facultatif)</small></label><textarea id="bugSteps" rows="3" maxlength="3000" placeholder="1. Lancer le tracker  2. …"></textarea></div>
    <div class="field"><label>Ce que tu attendais <small class="hint">(facultatif)</small></label><input type="text" id="bugExpected" maxlength="300"></div>
    <div class="switch-row"><span>Joindre les infos techniques<small class="tw-sub">Versions, système, états (simulateur, bot…) : aucune donnée de vol ni de compte</small></span><label class="switch"><input type="checkbox" id="bugDiag" checked><span class="slider"></span></label></div>
    <div class="switch-row"><span>Joindre les dernières erreurs<small class="tw-sub">Chemins du PC, nom de session, jetons et e-mails retirés</small></span><label class="switch"><input type="checkbox" id="bugLogs" checked><span class="slider"></span></label></div>
    <details class="bug-preview"><summary>Voir exactement ce qui sera joint</summary><pre id="bugPreview" data-no-i18n></pre></details>
    <div class="btn-row"><button class="btn primary" onclick="FBBug.send()">Ouvrir le rapport sur GitHub</button><button class="btn" onclick="FBBug.copy()">Copier le rapport</button></div>
    <div class="status-msg" id="bugMsg"></div>
    <div class="hint">GitHub s'ouvre avec le rapport déjà rempli : connecte-toi puis clique « Submit new issue ». Pas de compte GitHub ? « Copier le rapport » et colle-le où tu veux (Discord, e-mail…).</div>
  </div>`;
  document.body.appendChild(o);
  ['bugDiag', 'bugLogs'].forEach(id => $(id).addEventListener('change', preview));
}
function report(){
  return {
    title: $('bugTitle').value, what: $('bugWhat').value, steps: $('bugSteps').value, expected: $('bugExpected').value,
    diag: $('bugDiag').checked && prepared ? prepared.diag : null,
    logs: $('bugLogs').checked && prepared ? prepared.logs : null
  };
}
function preview(){
  const r = report(), lines = [];
  if(r.diag) Object.entries(r.diag).forEach(([k, v]) => { if(v != null && v !== '') lines.push(`${k} : ${v}`); });
  if(r.logs) lines.push('', ...(r.logs.length ? r.logs : ['(aucune erreur enregistrée)']));
  $('bugPreview').textContent = lines.length ? lines.join('\n') : '(rien d\'autre que ta description)';
}
const msg = (cls, t) => { const m = $('bugMsg'); m.className = 'status-msg ' + cls; m.textContent = t; };

FBBug.errors = () => errors.slice();
FBBug.open = async () => {
  build();
  $('bugOverlay').classList.remove('hidden');
  msg('', '');
  setTimeout(() => $('bugTitle').focus(), 50);
  try{
    prepared = await window.bugReport.prepare({
      uiErrors: errors, flights: (typeof db !== 'undefined' && db.logbook) ? db.logbook.length : null,
      streamer: typeof streamFeaturesOn === 'function' ? streamFeaturesOn() : null,
      screen: `${screen.width}×${screen.height} @${window.devicePixelRatio || 1}x`
    });
  }catch(e){ prepared = { diag: null, logs: null }; }
  preview();
};
FBBug.close = () => { const o = $('bugOverlay'); if(o) o.classList.add('hidden'); };
FBBug.send = async () => {
  const r = report();
  if(!r.title.trim() || !r.what.trim()){ msg('err', 'Donne au moins un résumé et ce qui se passe.'); return; }
  const res = await window.bugReport.open(r);
  if(!res.ok){ msg('err', "Impossible d'ouvrir GitHub."); return; }
  if(res.truncated){ await window.api.copyToClipboard(res.text); msg('ok', 'GitHub est ouvert. Le rapport est trop long pour l\'adresse : il est copié, colle-le dans l\'issue (Ctrl+V).'); }
  else msg('ok', 'GitHub est ouvert avec ton rapport : vérifie-le, puis « Submit new issue ». Merci !');
};
FBBug.copy = async () => {
  const r = report();
  if(!r.what.trim()){ msg('err', 'Décris d\'abord ce qui se passe.'); return; }
  await window.api.copyToClipboard((r.title.trim() ? '## ' + r.title.trim() + '\n\n' : '') + await window.bugReport.text(r));
  msg('ok', 'Rapport copié ✓ Colle-le où tu veux (Discord, e-mail…).');
};
})();
