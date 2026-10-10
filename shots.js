/* =========================================================
   FlightBrief — captures d'écran des vols (v1.6)
   ---------------------------------------------------------
   • Capture de la fenêtre du simulateur (MSFS / X-Plane) si elle est trouvée, sinon de
     l'écran principal — via desktopCapturer d'Electron, sans logiciel tiers.
     Si la fenêtre ressort noire (certains modes plein écran DirectX), on capture l'écran.
   • Déclenchement : bouton du Briefing, raccourci clavier GLOBAL (fonctionne pendant que
     le simulateur a le focus), et captures automatiques au décollage, en croisière et à
     l'atterrissage (au choix).
   • Fichiers JPEG dans <données>/screenshots/FB_AAAA-MM-JJ_HH-MM-SS.jpg ; le vol enregistré
     au logbook garde la liste de ses captures.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const DEFAULTS = { hotkey: 'Ctrl+Alt+F12', source: 'auto', auto: { takeoff: true, cruise: true, landing: true }, sound: true };
const SIM_WINDOW_RE = /microsoft flight simulator|flightsimulator|x-plane|prepar3d/i;

function pad(n) { return String(n).padStart(2, '0'); }
function stamp(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`; }

class Shots {
  constructor(electron, userDataDir) {
    this.e = electron;           // { desktopCapturer, screen, globalShortcut, nativeImage }
    this.dir = path.join(userDataDir, 'screenshots');
    this.config = { ...DEFAULTS, auto: { ...DEFAULTS.auto } };
    this.registered = null;
    this.onTaken = null;
    this.busy = false;
  }
  setConfig(c) {
    this.config = { ...DEFAULTS, ...(c || {}), auto: { ...DEFAULTS.auto, ...((c && c.auto) || {}) } };
    return this.registerHotkey(this.config.hotkey);
  }
  registerHotkey(acc) {
    const gs = this.e.globalShortcut;
    if (this.registered) { try { gs.unregister(this.registered); } catch (e) { /* ignoré */ } this.registered = null; }
    if (!acc) return { ok: true, hotkey: '' };
    try {
      const ok = gs.register(acc, () => this.capture('raccourci'));
      if (!ok) return { ok: false, hotkey: acc, error: 'Ce raccourci est déjà utilisé par une autre application.' };
      this.registered = acc;
      return { ok: true, hotkey: acc };
    } catch (e) { return { ok: false, hotkey: acc, error: 'Raccourci invalide.' }; }
  }
  dispose() { if (this.registered) { try { this.e.globalShortcut.unregister(this.registered); } catch (e) { /* ignoré */ } } }

  _isBlack(img) {
    try {
      const { width, height } = img.getSize();
      const small = img.resize({ width: 48, height: Math.max(1, Math.round(48 * height / width)) });
      const buf = small.toBitmap();
      let sum = 0;
      for (let i = 0; i < buf.length; i += 4) sum += buf[i] + buf[i + 1] + buf[i + 2];
      return sum / (buf.length / 4) / 3 < 4;
    } catch (e) { return false; }
  }

  async capture(reason) {
    if (this.busy) return { ok: false, error: 'Capture déjà en cours.' };
    this.busy = true;
    try {
      const disp = this.e.screen.getPrimaryDisplay();
      const sf = disp.scaleFactor || 1;
      let w = Math.round(disp.size.width * sf), h = Math.round(disp.size.height * sf);
      if (w > 2560) { h = Math.round(h * 2560 / w); w = 2560; }
      const wantWindow = this.config.source !== 'screen';
      const sources = await this.e.desktopCapturer.getSources({ types: wantWindow ? ['window', 'screen'] : ['screen'], thumbnailSize: { width: w, height: h }, fetchWindowIcons: false });
      let src = wantWindow ? sources.find(s => s.id.startsWith('window') && SIM_WINDOW_RE.test(s.name)) : null;
      let img = src && src.thumbnail;
      let from = src ? 'window' : 'screen';
      if (!img || img.isEmpty() || this._isBlack(img)) {
        const screenSrc = sources.find(s => s.id.startsWith('screen') && String(s.display_id) === String(disp.id)) || sources.find(s => s.id.startsWith('screen'));
        img = screenSrc && screenSrc.thumbnail;
        from = 'screen';
      }
      if (!img || img.isEmpty()) return { ok: false, error: "Aucune image récupérée (écran verrouillé ou autorisation refusée)." };
      fs.mkdirSync(this.dir, { recursive: true });
      const now = new Date();
      let name = `FB_${stamp(now)}.jpg`, i = 2;
      while (fs.existsSync(path.join(this.dir, name))) name = `FB_${stamp(now)}_${i++}.jpg`;
      fs.writeFileSync(path.join(this.dir, name), img.toJPEG(90));
      const shot = this.info(name, { reason: reason || 'manuel', from, ts: now.getTime() });
      if (this.onTaken) this.onTaken(shot);
      return { ok: true, ...shot };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    } finally { this.busy = false; }
  }

  info(name, extra) {
    const file = path.join(this.dir, name);
    let ts = extra && extra.ts;
    if (!ts) {
      const m = name.match(/^FB_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
      if (m) ts = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
      else { try { ts = fs.statSync(file).mtimeMs; } catch (e) { ts = 0; } }
    }
    return { name, url: pathToFileURL(file).href, ts, ...(extra || {}) };
  }
  list(range) {
    let names = [];
    try { names = fs.readdirSync(this.dir).filter(n => /\.(jpe?g|png|webp)$/i.test(n)); } catch (e) { return []; }
    let out = names.map(n => this.info(n));
    if (range && (range.from || range.to)) out = out.filter(s => (!range.from || s.ts >= range.from) && (!range.to || s.ts <= range.to));
    return out.sort((a, b) => a.ts - b.ts);
  }
  resolve(names) {
    return (names || []).filter(n => typeof n === 'string' && !n.includes('/') && !n.includes('\\') && fs.existsSync(path.join(this.dir, n))).map(n => this.info(n));
  }
  remove(name) {
    if (!name || name.includes('/') || name.includes('\\')) return false;
    try { fs.unlinkSync(path.join(this.dir, name)); return true; } catch (e) { return false; }
  }
  // Images ajoutées à la main (vols sans tracker) : copiées dans le dossier des captures.
  importFiles(filePaths) {
    fs.mkdirSync(this.dir, { recursive: true });
    return (filePaths || []).map(p => {
      const ext = (path.extname(p) || '.jpg').toLowerCase();
      let st = null; try { st = fs.statSync(p); } catch (e) { return null; }
      const d = new Date(st.mtimeMs);
      let name = `FB_${stamp(d)}${ext}`, i = 2;
      while (fs.existsSync(path.join(this.dir, name))) name = `FB_${stamp(d)}_${i++}${ext}`;
      try { fs.copyFileSync(p, path.join(this.dir, name)); } catch (e) { return null; }
      return this.info(name, { ts: st.mtimeMs, reason: 'import' });
    }).filter(Boolean);
  }
  stats() {
    const l = this.list();
    let size = 0;
    l.forEach(s => { try { size += fs.statSync(path.join(this.dir, s.name)).size; } catch (e) { /* ignoré */ } });
    return { count: l.length, sizeMb: Math.round(size / 1048576), dir: this.dir };
  }
}

module.exports = { Shots, SHOTS_DEFAULTS: DEFAULTS };
