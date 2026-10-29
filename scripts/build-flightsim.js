/* Zip pour flightsim.to : npm run dist:flightsim (après npm run dist:win).
   Un seul fichier, qui marche seul (règle de flightsim.to) :
     FlightBrief-Setup-<version>.exe                 l'appli complète (installeur Windows)
     MSFS 2024 EFB (Community)/llcenlive-efb-flightbrief/   l'appli EFB, à glisser dans Community
     README.txt                                      installation, en anglais (obligatoire sur le site)
   Résultat : dist/flightsim-to/FlightBrief-<version>.zip */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const version = require(path.join(root, 'package.json')).version;
const { zip } = require(path.join(root, 'zip'));
const Efb = require(path.join(root, 'efb-package'));

const setup = path.join(root, 'dist', `FlightBrief-Setup-${version}.exe`);
if (!fs.existsSync(setup)) { console.error(`[flightsim] ${path.relative(root, setup)} introuvable : lance d'abord « npm run dist:win ».`); process.exit(1); }

const out = path.join(root, 'dist', 'flightsim-to');
const efbDir = path.join(out, 'efb-build', Efb.PACKAGE);
fs.mkdirSync(out, { recursive: true });
Efb.writePackage(path.join(root, 'efb'), efbDir, version);

const files = [{ name: path.basename(setup), data: fs.readFileSync(setup) }];
(function walk(rel) {
  for (const e of fs.readdirSync(path.join(efbDir, rel), { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(r); else files.push({ name: `MSFS 2024 EFB (Community)/${Efb.PACKAGE}/${r}`, data: fs.readFileSync(path.join(efbDir, r)) });
  }
})('');
const readme = [
  `FlightBrief ${version}`,
  '',
  'Flight briefing, logbook, career tracking and live flight tracking (SimConnect) for MSFS,',
  'with OBS overlays and a Twitch bot for streamers. Free, Windows 10/11.',
  '',
  '1. INSTALL FLIGHTBRIEF',
  `   Run FlightBrief-Setup-${version}.exe. Windows SmartScreen may warn about an unknown publisher:`,
  '   click "More info" then "Run anyway". FlightBrief updates itself from then on.',
  '',
  '2. OPTIONAL: FLIGHTBRIEF APP ON THE MSFS 2024 TABLET (EFB)',
  '   Easiest: in FlightBrief, Profile > MSFS 2024 EFB > Install the EFB app.',
  `   Or by hand: copy the "${Efb.PACKAGE}" folder from "MSFS 2024 EFB (Community)" into your`,
  '   MSFS 2024 Community folder. Restart the simulator, open the EFB and tap "FlightBrief".',
  '   FlightBrief must be running on the same PC during the flight.',
  '',
  'Languages: English, French, Spanish.',
  'Source code and release notes: GitHub, LLCenLive/FlightBrief.',
  ''
].join('\r\n');
files.push({ name: 'README.txt', data: Buffer.from(readme, 'utf-8') });

const dest = path.join(out, `FlightBrief-${version}.zip`);
fs.writeFileSync(dest, zip(files));
fs.rmSync(path.join(out, 'efb-build'), { recursive: true, force: true });
console.log(`[flightsim] ${path.relative(root, dest)} (${(fs.statSync(dest).size / 1048576).toFixed(1)} Mo, ${files.length} fichiers)`);
