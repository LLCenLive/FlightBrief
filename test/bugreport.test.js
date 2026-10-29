// Tests du rapport « Signaler un bug » (v2.0) : node --test
const test = require('node:test');
const assert = require('node:assert');
const { sanitize, tailLog, reportMarkdown, issueUrl, REPO_URL, MAX_URL } = require('../bugreport');

const ctx = { home: 'C:\\Users\\pilote', user: 'pilote' };

test('nettoyage : chemins, session, jetons, e-mails et IP retirés', () => {
  const s = sanitize('Error at C:\\Users\\pilote\\AppData\\Roaming\\FlightBrief\\db.json (C:/Users/pilote/x) PASS oauth:abc123def · github_pat_11ABCD_xyz · Bearer abcdefghij123 · ?token=s3cr3t&x=1 · llc@example.com · 192.168.1.20 · Chrome 126.0.6478.234 · 127.0.0.1', ctx);
  assert.ok(!/pilote/i.test(s), s);
  assert.match(s, /~\\AppData/);
  assert.match(s, /oauth:<masqué>/);
  assert.match(s, /github_pat_<masqué>/);
  assert.match(s, /Bearer <masqué>/);
  assert.match(s, /\?token=<masqué>&x=1/);
  assert.match(s, /<e-mail>/);
  assert.match(s, /<ip>/);
  assert.match(s, /126\.0\.6478\.234/); // une version n'est pas une adresse IP
  assert.match(s, /127\.0\.0\.1/);
});

test('journal : seulement les dernières lignes non vides', () => {
  const log = Array.from({ length: 60 }, (_, i) => `ligne ${i}`).join('\n') + '\n\n';
  const t = tailLog(log, ctx, 5);
  assert.deepStrictEqual(t, ['ligne 55', 'ligne 56', 'ligne 57', 'ligne 58', 'ligne 59']);
});

test('rapport et adresse GitHub pré-remplie', () => {
  const r = { title: 'Le bot se tait', what: 'Plus de réponse', steps: '1. Atterrir', diag: { FlightBrief: '1.9.0', Langue: 'fr', Vide: '' }, logs: ['erreur A'] };
  const md = reportMarkdown(r);
  assert.match(md, /### Ce qui se passe\nPlus de réponse/);
  assert.match(md, /- FlightBrief : 1\.9\.0/);
  assert.ok(!md.includes('Vide'));
  assert.match(md, /```\nerreur A\n```/);
  const { url, truncated } = issueUrl(r);
  assert.ok(url.startsWith(REPO_URL + '/issues/new?labels=bug&title=Le%20bot%20se%20tait&body='));
  assert.strictEqual(truncated, false);
  assert.ok(issueUrl(r, 'https://github.com/LLCenLive/FlightBrief.git').url.startsWith(REPO_URL + '/issues/new?'));
});

test('rapport trop long : journaux retirés de l\'adresse, puis description', () => {
  const big = { title: 'x', what: 'court', logs: Array.from({ length: 200 }, () => 'é'.repeat(100)) };
  const a = issueUrl(big);
  assert.ok(a.truncated && a.url.length <= MAX_URL);
  assert.ok(decodeURIComponent(a.url).includes('court'));
  const b = issueUrl({ title: 'x', what: 'é'.repeat(5000) });
  assert.ok(b.truncated && b.url.length <= MAX_URL);
});
