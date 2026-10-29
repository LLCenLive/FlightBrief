// Tests de la publication GitHub Pages du carnet public (v2.0) : node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { GitHubPages, checkToken, cleanRepo, blobSha } = require('../github-pages');

const TOKEN = 'github_pat_' + 'A1b2C3d4E5'.repeat(4);

// Faux GitHub : un dépôt en mémoire, juste ce qu'il faut de l'API Git Data.
function fakeGitHub(initial, opts) {
  opts = opts || {};
  const blobs = new Map(), trees = new Map(), commits = new Map();
  let n = 0;
  const id = p => p + (++n).toString(16).padStart(8, '0');
  let head = null;
  const calls = [];
  const commitFiles = files => {
    const t = id('t'); trees.set(t, files);
    const c = id('c'); commits.set(c, { tree: t }); head = c;
  };
  if (initial) commitFiles(new Map(Object.entries(initial).map(([p, s]) => [p, blobSha(Buffer.from(s))])));
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
  const fetch = async (url, o) => {
    const m = (o && o.method) || 'GET', u = url.replace('https://api.github.com', ''), body = o && o.body ? JSON.parse(o.body) : null;
    calls.push(m + ' ' + u);
    if (o.headers.Authorization !== 'Bearer ' + TOKEN) return json(401, { message: 'Bad credentials' });
    if (opts.readOnly && m !== 'GET') return json(403, { message: 'Resource not accessible by personal access token' });
    let r;
    if (m === 'GET' && (r = u.match(/^\/repos\/me\/carnet$/))) return json(200, { full_name: 'me/carnet', private: false, default_branch: 'main', permissions: { push: true } });
    if (m === 'GET' && /\/git\/ref\/heads\/main$/.test(u)) return head ? json(200, { object: { sha: head } }) : json(409, { message: 'Git Repository is empty.' });
    if (m === 'PUT' && /\/contents\/\.nojekyll$/.test(u)) { commitFiles(new Map([['.nojekyll', blobSha(Buffer.from(''))]])); return json(201, {}); }
    if (m === 'GET' && (r = u.match(/\/git\/commits\/(\w+)$/))) return json(200, { tree: { sha: commits.get(r[1]).tree } });
    if (m === 'GET' && (r = u.match(/\/git\/trees\/(\w+)\?recursive=1$/))) return json(200, { tree: [...trees.get(r[1])].map(([p, sha]) => ({ path: p, sha, type: 'blob' })) });
    if (m === 'POST' && /\/git\/blobs$/.test(u)) { const buf = Buffer.from(body.content, 'base64'), sha = blobSha(buf); blobs.set(sha, buf); return json(201, { sha }); }
    if (m === 'POST' && /\/git\/trees$/.test(u)) {
      const files = new Map(trees.get(body.base_tree));
      body.tree.forEach(e => e.sha === null ? files.delete(e.path) : files.set(e.path, e.sha));
      const t = id('t'); trees.set(t, files); return json(201, { sha: t });
    }
    if (m === 'POST' && /\/git\/commits$/.test(u)) { const c = id('c'); commits.set(c, { tree: body.tree, message: body.message }); return json(201, { sha: c }); }
    if (m === 'PATCH' && /\/git\/refs\/heads\/main$/.test(u)) { head = body.sha; return json(200, {}); }
    if (m === 'GET' && /\/pages$/.test(u)) return opts.pages ? json(200, { html_url: 'https://me.github.io/carnet/' }) : json(404, { message: 'Not Found' });
    if (m === 'POST' && /\/pages$/.test(u)) return json(403, { message: 'Resource not accessible by personal access token' });
    return json(404, { message: 'Not Found' });
  };
  return { fetch, calls, files: () => head ? trees.get(commits.get(head).tree) : new Map(), head: () => head };
}

function site(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-site-'));
  for (const [p, s] of Object.entries(files)) { if (s === undefined) continue; fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), s); }
  return dir;
}
const SITE = { 'index.html': '<!doctype html>', 'app.js': 'a', 'style.css': 's', 'data.js': 'window.FB_PUBLIC={}', '.nojekyll': '', 'cartes/carte-1.jpg': 'jpg1' };

test('jetons : fine-grained acceptés, jetons classiques refusés', () => {
  assert.ok(checkToken(TOKEN).ok);
  assert.match(checkToken('ghp_' + 'x'.repeat(36)).error, /classique/);
  assert.match(checkToken('abc').error, /github_pat_/);
  assert.strictEqual(cleanRepo('https://github.com/me/carnet.git/'), 'me/carnet');
});

test('premier envoi dans un dépôt vide, puis rien à faire si rien ne change', async () => {
  const gh = fakeGitHub(null), pages = new GitHubPages(gh.fetch);
  const r = await pages.publish({ token: TOKEN, repo: 'me/carnet', branch: 'main', dir: site(SITE) });
  assert.ok(r.ok, r.error);
  assert.strictEqual(r.changed, 5); // .nojekyll déjà créé à l'initialisation
  assert.deepStrictEqual([...gh.files().keys()].sort(), ['.nojekyll', 'app.js', 'cartes/carte-1.jpg', 'data.js', 'index.html', 'style.css']);
  assert.strictEqual(r.url, 'https://me.github.io/carnet/');
  assert.strictEqual(r.pagesEnabled, false);
  const head = gh.head();
  const again = await pages.publish({ token: TOKEN, repo: 'me/carnet', branch: 'main', dir: site(SITE) });
  assert.strictEqual(again.changed, 0);
  assert.strictEqual(gh.head(), head); // pas de commit vide
});

test("seuls les fichiers du carnet sont modifiés : README et CNAME restent, l'ancienne carte part", async () => {
  const gh = fakeGitHub({ 'README.md': 'perso', CNAME: 'carnet.exemple.fr', 'index.html': 'old', 'cartes/carte-1.jpg': 'jpg1' }, { pages: true });
  const r = await new GitHubPages(gh.fetch).publish({ token: TOKEN, repo: 'me/carnet', branch: 'main', dir: site({ ...SITE, 'cartes/carte-1.jpg': undefined, 'cartes/carte-2.jpg': 'jpg2' }) });
  assert.ok(r.ok, r.error);
  const files = [...gh.files().keys()].sort();
  assert.ok(files.includes('README.md') && files.includes('CNAME'));
  assert.ok(!files.includes('cartes/carte-1.jpg'));
  assert.ok(files.includes('cartes/carte-2.jpg'));
  assert.strictEqual(r.pagesEnabled, true);
});

test('erreurs expliquées : mauvais jeton, droits insuffisants, dépôt mal écrit', async () => {
  const gh = fakeGitHub({ 'index.html': 'x' }, { readOnly: true }), pages = new GitHubPages(gh.fetch);
  assert.match((await pages.publish({ token: 'github_pat_' + 'Z'.repeat(40), repo: 'me/carnet', dir: site(SITE) })).error, /refusé/);
  assert.match((await pages.publish({ token: TOKEN, repo: 'me/carnet', dir: site(SITE) })).error, /Contents : Read and write/);
  assert.match((await pages.publish({ token: TOKEN, repo: 'carnet', dir: site(SITE) })).error, /compte\/dépôt/);
  assert.ok((await pages.check({ token: TOKEN, repo: 'me/carnet' })).ok);
});
