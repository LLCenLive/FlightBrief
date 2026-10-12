/* =========================================================
   FlightBrief — sauvegardes automatiques du fichier de données (v1.5)
   ---------------------------------------------------------
   Tout le logbook vit dans un seul flightbrief-data.json. Pour qu'un fichier corrompu
   (coupure de courant pendant une écriture, disque plein…) ne fasse jamais tout perdre :
     • écriture ATOMIQUE : on écrit dans un fichier temporaire puis on le renomme — le
       fichier réel n'est jamais à moitié écrit ;
     • une copie datée par jour (backups/flightbrief-data-AAAA-MM-JJ.json), les 7 plus
       récentes sont gardées ;
     • à la lecture, si le JSON est illisible, on met le fichier abîmé de côté et on
       repart de la sauvegarde valide la plus récente (au lieu de repartir de zéro et
       d'écraser le logbook à la première sauvegarde, comme avant).
   ========================================================= */
const fs = require('fs');
const path = require('path');

const KEEP_DAYS = 7;
const PREFIX = 'flightbrief-data-';

function localDay(d) {
  const x = d || new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

class DataStore {
  constructor(userDataDir) {
    this.dir = userDataDir;
    this.file = path.join(userDataDir, 'flightbrief-data.json');
    this.backupDir = path.join(userDataDir, 'backups');
    this.lastRecovery = null; // { from, corruptCopy } si la dernière lecture a dû restaurer une sauvegarde
  }

  _validJson(file) {
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    } catch (e) { return null; }
  }

  read() {
    if (!fs.existsSync(this.file)) return null; // première utilisation
    const data = this._validJson(this.file);
    if (data) return data;
    // Fichier présent mais illisible : on le garde de côté puis on tente les sauvegardes.
    let corruptCopy = null;
    try {
      corruptCopy = path.join(this.dir, `flightbrief-data.corrompu-${Date.now()}.json`);
      fs.copyFileSync(this.file, corruptCopy);
    } catch (e) { corruptCopy = null; }
    for (const b of this.list()) {
      const restored = this._validJson(b.path);
      if (restored) {
        try { this._atomicWrite(JSON.stringify(restored, null, 2)); } catch (e) { /* on renvoie quand même les données */ }
        this.lastRecovery = { from: b.name, date: b.date, corruptCopy, at: new Date().toISOString() };
        return restored;
      }
    }
    this.lastRecovery = { from: null, corruptCopy, at: new Date().toISOString() };
    return null;
  }

  _atomicWrite(json) {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, json, 'utf-8');
    fs.renameSync(tmp, this.file);
  }

  // v1.6 — écriture NON bloquante : avant, chaque sauvegarde écrivait le fichier en
  // synchrone (plusieurs Mo avec les trajets) puis le relisait en entier pour la sauvegarde
  // du jour, en bloquant le processus principal… et donc l'interface qui attendait la réponse.
  // Désormais : JSON compact, écriture asynchrone en arrière-plan, une seule à la fois ; si
  // d'autres sauvegardes arrivent pendant ce temps, seule la plus récente est écrite ensuite.
  write(data) {
    this._pending = data;
    if (!this._writing) this._drain();
    return true;
  }
  async _drain() {
    this._writing = true;
    try {
      while (this._pending) {
        const data = this._pending;
        this._pending = null;
        const json = JSON.stringify(data);
        try {
          await fs.promises.mkdir(this.dir, { recursive: true });
          const tmp = this.file + '.tmp';
          await fs.promises.writeFile(tmp, json, 'utf-8');
          await fs.promises.rename(tmp, this.file);
          this._afterWrite(json);
        } catch (e) { this.lastWriteError = e.message || String(e); }
      }
    } finally { this._writing = false; }
  }
  // À la fermeture : écrit tout de suite ce qui reste en attente (synchrone).
  flushSync() {
    if (!this._pending) return;
    const data = this._pending; this._pending = null;
    try { this._atomicWrite(JSON.stringify(data)); } catch (e) { /* rien de plus à faire */ }
  }
  // Sauvegarde du jour : on vient d'écrire un JSON valide, inutile de le relire.
  _afterWrite(json) {
    const target = path.join(this.backupDir, PREFIX + localDay() + '.json');
    if (this._backupDay === localDay()) return;
    fs.promises.mkdir(this.backupDir, { recursive: true })
      .then(() => fs.promises.access(target).then(() => true, () => false))
      .then(exists => exists ? null : fs.promises.writeFile(target, json, 'utf-8'))
      .then(() => { this._backupDay = localDay(); this.prune(); })
      .catch(() => {});
  }

  // Copie du jour (au plus une par jour, sauf si force) puis rotation.
  dailyBackup(force) {
    try {
      if (!fs.existsSync(this.file)) return null;
      if (!this._validJson(this.file)) return null; // jamais sauvegarder un fichier abîmé
      fs.mkdirSync(this.backupDir, { recursive: true });
      const target = path.join(this.backupDir, PREFIX + localDay() + '.json');
      if (force || !fs.existsSync(target)) fs.copyFileSync(this.file, target);
      this._backupDay = localDay();
      this.prune();
      return target;
    } catch (e) { return null; }
  }

  prune() {
    const all = this.list();
    all.slice(KEEP_DAYS).forEach(b => { try { fs.unlinkSync(b.path); } catch (e) { /* ignoré */ } });
  }

  // Sauvegardes, la plus récente d'abord.
  list() {
    let names = [];
    try { names = fs.readdirSync(this.backupDir); } catch (e) { return []; }
    return names
      .filter(n => n.startsWith(PREFIX) && n.endsWith('.json'))
      .map(n => {
        const p = path.join(this.backupDir, n);
        let st = null;
        try { st = fs.statSync(p); } catch (e) { /* ignoré */ }
        return { name: n, path: p, date: n.slice(PREFIX.length, -5), size: st ? st.size : 0, mtime: st ? st.mtime.toISOString() : null };
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  // Résumé lisible d'une sauvegarde (nombre de vols…) pour l'écran Admin.
  summary(b) {
    const d = this._validJson(b.path);
    return { ...b, valid: !!d, flights: d && Array.isArray(d.logbook) ? d.logbook.length : null };
  }

  restore(name) {
    this._pending = null; // une sauvegarde en attente ne doit pas écraser la restauration
    const b = this.list().find(x => x.name === name);
    if (!b) throw new Error('Sauvegarde introuvable.');
    const data = this._validJson(b.path);
    if (!data) throw new Error('Cette sauvegarde est illisible.');
    // Filet : l'état actuel est lui-même gardé avant d'être remplacé.
    try {
      if (fs.existsSync(this.file)) fs.copyFileSync(this.file, path.join(this.dir, `flightbrief-data.avant-restauration-${Date.now()}.json`));
    } catch (e) { /* ignoré */ }
    this._atomicWrite(JSON.stringify(data, null, 2));
    return true;
  }
}

/* Petits fichiers JSON annexes (cabin.json, twitch-bets.json) : écriture atomique + copie .bak.
   Un fichier illisible n'est jamais écrasé en silence : il est mis de côté, et on repart du .bak. */
function writeJsonSafe(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  try { if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); } catch (e) { /* ignoré */ }
  fs.renameSync(tmp, file);
}
function readJsonSafe(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch (e) { /* abîmé : voir plus bas */ }
  try { fs.copyFileSync(file, `${file}.corrompu-${Date.now()}`); } catch (e) { /* ignoré */ }
  try { return JSON.parse(fs.readFileSync(file + '.bak', 'utf-8')); } catch (e) { return null; }
}

module.exports = { DataStore, writeJsonSafe, readJsonSafe };
