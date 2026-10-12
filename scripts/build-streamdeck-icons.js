/* Icônes du plugin Stream Deck (PNG aux tailles Elgato) à partir de pictogrammes SVG.
   node scripts/build-streamdeck-icons.js   (demande rsvg-convert ; macOS : brew install librsvg)
   L'icône du plugin reprend build/icon.png (redimensionnée avec sips sur macOS). */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const dir = path.join(__dirname, '..', 'streamdeck', 'com.flightbrief.deck.sdPlugin', 'images');

const G = {
  tracker: '<path d="M12 2.5l1.6 6.2 7.4 4.3v1.8l-7.4-2.1-.4 5.1 2.3 1.8v1.5l-3.5-1-3.5 1v-1.5l2.3-1.8-.4-5.1-7.4 2.1V13l7.4-4.3z" fill="C" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  screenshot: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/>',
  copilot: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  boarding: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
  bets: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="C"/>',
  volume: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'
};
const COLORS = { tracker: '#39e88f', info: '#54d6e8', screenshot: '#54d6e8', copilot: '#a06cf5', boarding: '#39e88f', bets: '#ffd166', volume: '#54d6e8' };
const svg = (glyph, color, size, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${bg ? `<rect width="24" height="24" fill="${bg}"/>` : ''}<g transform="${bg ? 'translate(4.8 4.8) scale(.6)' : ''}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph.replace(/="C"/g, `="${color}"`)}</g></svg>`;

function png(svgText, out, size) {
  const tmp = out + '.svg';
  fs.writeFileSync(tmp, svgText);
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', out, tmp]);
  fs.unlinkSync(tmp);
}
for (const [name, glyph] of Object.entries(G)) {
  png(svg(glyph, '#ffffff', 20), path.join(dir, 'actions', name + '.png'), 20);       // liste des actions
  png(svg(glyph, '#ffffff', 40), path.join(dir, 'actions', name + '@2x.png'), 40);
  png(svg(glyph, COLORS[name], 72, '#0a0d11'), path.join(dir, 'keys', name + '.png'), 72); // touche par défaut
  png(svg(glyph, COLORS[name], 144, '#0a0d11'), path.join(dir, 'keys', name + '@2x.png'), 144);
}
png(svg(G.tracker, '#ffffff', 28), path.join(dir, 'category.png'), 28);
png(svg(G.tracker, '#ffffff', 56), path.join(dir, 'category@2x.png'), 56);
const icon = path.join(__dirname, '..', 'build', 'icon.png');
for (const [n, s] of [['plugin.png', 256], ['plugin@2x.png', 512]]) execFileSync('sips', ['-z', String(s), String(s), icon, '--out', path.join(dir, n)], { stdio: 'ignore' });
console.log('Icônes Stream Deck générées dans', dir);
