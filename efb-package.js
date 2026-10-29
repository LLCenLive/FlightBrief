/* =========================================================
   FlightBrief — paquet « Community » de l'appli EFB pour MSFS 2024 (v2.0)
   ---------------------------------------------------------
   Construit, à partir des sources du dossier efb/ (le même que le projet du mode développeur
   du SDK), un paquet prêt à l'emploi : manifest.json + layout.json + html_ui/efb_ui/efb_apps/…
   • install() le dépose dans le dossier Community du simulateur (trouvé dans UserCfg.opt :
     version Steam ou Microsoft Store / Xbox) ;
   • exportTo() le copie dans un autre dossier (à glisser soi-même dans Community).
   Le paquet ne contient que des fichiers recopiés (pas de compilation) : c'est ce que fait
   aussi le SDK pour une appli EFB en JavaScript (groupe d'assets « Copy »).
   ========================================================= */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PACKAGE = 'llcenlive-efb-flightbrief';
const APP = 'FlightBriefEfb';

// Date Windows (FILETIME : centaines de nanosecondes depuis 1601), comme dans les layout.json du SDK.
const fileTime = ms => Math.round(ms * 10000 + 116444736000000000);

function walk(dir, rel, out) {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(dir, r, out); else out.push(r);
  }
  return out;
}

// Fichiers du paquet : [{ path, buf }] (chemins avec « / », comme dans layout.json).
function packageFiles(srcRoot, version) {
  const files = [];
  const appDir = path.join(srcRoot, 'PackageSources', APP);
  for (const r of walk(appDir, '', [])) files.push({ path: `html_ui/efb_ui/efb_apps/${APP}/${r}`, buf: fs.readFileSync(path.join(appDir, r)) });
  const thumb = path.join(srcRoot, 'PackageDefinitions', PACKAGE, 'ContentInfo', 'thumbnail.jpg');
  if (fs.existsSync(thumb)) files.push({ path: `ContentInfo/${PACKAGE}/thumbnail.jpg`, buf: fs.readFileSync(thumb) });
  const manifest = {
    dependencies: [], content_type: 'MISC', title: 'FlightBrief EFB', manufacturer: '', creator: 'LLCenLive',
    package_version: String(version || '1.0.0').replace(/[^0-9.]/g, '') || '1.0.0', minimum_game_version: '1.0.0',
    release_notes: { neutral: { LastUpdate: '', OlderHistory: '' } }
  };
  return { files, manifest };
}

// Écrit le paquet dans `dest` (dossier du paquet lui-même), en remplaçant une version précédente.
function writePackage(srcRoot, dest, version, now) {
  const { files, manifest } = packageFiles(srcRoot, version);
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  const t = fileTime(now || Date.now());
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dest, f.path)), { recursive: true });
    fs.writeFileSync(path.join(dest, f.path), f.buf);
  }
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const layout = { content: files.map(f => ({ path: f.path, size: f.buf.length, date: t })) };
  fs.writeFileSync(path.join(dest, 'layout.json'), JSON.stringify(layout, null, 2));
  return { dest, files: files.length };
}

// Dossiers UserCfg.opt possibles de MSFS 2024 (Steam, puis Microsoft Store / Xbox).
function userCfgCandidates(env) {
  env = env || process.env;
  const out = [];
  if (env.APPDATA) out.push(path.join(env.APPDATA, 'Microsoft Flight Simulator 2024', 'UserCfg.opt'));
  if (env.LOCALAPPDATA) out.push(path.join(env.LOCALAPPDATA, 'Packages', 'Microsoft.Limitless_8wekyb3d8bbwe', 'LocalCache', 'UserCfg.opt'));
  return out;
}
// « InstalledPackagesPath "D:\MSFS2024" » -> D:\MSFS2024\Community
function communityFromUserCfg(text) {
  const m = String(text || '').match(/^\s*InstalledPackagesPath\s+"([^"]+)"/m);
  return m ? path.join(m[1], 'Community') : null;
}
function findCommunity(env, readFile) {
  readFile = readFile || (p => fs.readFileSync(p, 'utf-8'));
  for (const f of userCfgCandidates(env)) {
    let txt = null;
    try { txt = readFile(f); } catch (e) { continue; }
    const c = communityFromUserCfg(txt);
    if (c) return { community: c, userCfg: f, edition: /Limitless/.test(f) ? 'store' : 'steam' };
  }
  return null;
}
// Le paquet est-il déjà installé, et dans quelle version ?
function installedVersion(community) {
  try { return JSON.parse(fs.readFileSync(path.join(community, PACKAGE, 'manifest.json'), 'utf-8')).package_version || null; } catch (e) { return null; }
}
// Sous AppData ? (une appli du Microsoft Store y écrit dans un dossier privé que le simulateur ne voit pas)
const underAppData = (p, env) => {
  env = env || process.env;
  const n = s => String(s || '').toLowerCase().replace(/[\\/]+$/, '');
  const home = n(path.join(env.USERPROFILE || os.homedir(), 'AppData'));
  return n(p).startsWith(home);
};

module.exports = { PACKAGE, APP, packageFiles, writePackage, findCommunity, communityFromUserCfg, userCfgCandidates, installedVersion, underAppData, fileTime };
