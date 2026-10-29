/* =========================================================
   FlightBrief — publication du carnet de vol public sur GitHub Pages (v2.0)
   ---------------------------------------------------------
   Envoie le site généré par public-logbook.js dans un dépôt GitHub, en UN commit,
   via l'API REST (aucune dépendance, pas de git installé).
   Sécurité :
   • jeton « fine-grained » uniquement (github_pat_…), limité au seul dépôt du carnet,
     droit « Contents : Read and write » (et « Pages » en option pour activer le site) ;
     les jetons classiques (ghp_…), qui ouvrent TOUS les dépôts du compte, sont refusés ;
   • le jeton est chiffré sur le disque (safeStorage, comme les comptes Twitch) et ne
     repart jamais vers l'interface ;
   • seuls les fichiers du carnet sont créés, modifiés ou supprimés (MANAGED) : un README,
     un CNAME ou tout autre fichier du dépôt n'est jamais touché ;
   • fichiers identiques : rien n'est envoyé, pas de commit vide.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API = 'https://api.github.com';
const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const TOKEN_RE = /^github_pat_[A-Za-z0-9_]{20,255}$/;
// Fichiers gérés par FlightBrief à la racine du dépôt (+ le dossier des cartes postales).
const MANAGED = ['index.html', 'style.css', 'app.js', 'data.js', 'coast.js', 'i18n.js', '.nojekyll'];
const isManaged = p => MANAGED.includes(p) || /^cartes\/carte-\d+\.jpg$/.test(p);

// Empreinte git d'un fichier (« blob <taille>\0<contenu> ») : sert à ne renvoyer que ce qui a changé.
const blobSha = buf => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');

function checkToken(t) {
  t = String(t || '').trim();
  if (/^(ghp|gho|ghu|ghs)_/.test(t)) return { ok: false, error: "Ce jeton est un jeton « classique » : il donne accès à tous tes dépôts. Crée plutôt un jeton « fine-grained » limité au seul dépôt du carnet." };
  if (!TOKEN_RE.test(t)) return { ok: false, error: 'Jeton non reconnu : un jeton « fine-grained » commence par github_pat_.' };
  return { ok: true, token: t };
}
const cleanRepo = s => String(s || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '').replace(/\.git$/i, '');
const cleanBranch = s => (String(s || '').trim().replace(/[^A-Za-z0-9._/-]/g, '') || 'main').slice(0, 100);

// Fichiers du site dans le dossier généré : [{ path, buf }]
function listSite(dir) {
  const out = [];
  for (const f of MANAGED) { const p = path.join(dir, f); if (fs.existsSync(p)) out.push({ path: f, buf: fs.readFileSync(p) }); }
  try { for (const n of fs.readdirSync(path.join(dir, 'cartes'))) { const rel = 'cartes/' + n; if (isManaged(rel)) out.push({ path: rel, buf: fs.readFileSync(path.join(dir, 'cartes', n)) }); } } catch (e) { /* pas de cartes */ }
  return out;
}

class GitHubPages {
  // fetch(url, opts) : net.fetch d'Electron (ou un faux dans les tests).
  constructor(fetchFn) { this.fetch = fetchFn; this.busy = false; }

  async _api(token, method, url, body) {
    const res = await this.fetch(API + url, {
      method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'FlightBrief' },
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(j.message || ('GitHub a répondu HTTP ' + res.status)); e.status = res.status; throw e; }
    return j;
  }
  _explain(e, repo) {
    if (e.status === 401) return 'Jeton refusé par GitHub (expiré ou révoqué ?). Crée-en un nouveau.';
    if (e.status === 403) return `Le jeton n'a pas le droit d'écrire dans ${repo} : donne-lui « Contents : Read and write » sur ce dépôt.`;
    if (e.status === 404) return `Dépôt ${repo} introuvable avec ce jeton : vérifie le nom (compte/dépôt) et que le jeton a bien accès à ce dépôt.`;
    return e.message || String(e);
  }

  // Vérifie l'accès au dépôt sans rien écrire.
  async check({ token, repo }) {
    const t = checkToken(token); if (!t.ok) return t;
    repo = cleanRepo(repo);
    if (!REPO_RE.test(repo)) return { ok: false, error: 'Indique le dépôt sous la forme compte/dépôt (ex : LLCenLive/carnet).' };
    try {
      const r = await this._api(t.token, 'GET', `/repos/${repo}`);
      if (r.permissions && r.permissions.push === false) return { ok: false, error: `Ton compte ne peut pas écrire dans ${repo}.` };
      return { ok: true, repo: r.full_name, private: !!r.private, defaultBranch: r.default_branch || 'main' };
    } catch (e) { return { ok: false, error: this._explain(e, repo) }; }
  }

  // Publie le dossier `dir` dans `repo` (branche `branch`). Renvoie { ok, changed, commit, url } ou { ok: false, error }.
  async publish({ token, repo, branch, dir, message }) {
    const t = checkToken(token); if (!t.ok) return t;
    repo = cleanRepo(repo); branch = cleanBranch(branch);
    if (!REPO_RE.test(repo)) return { ok: false, error: 'Indique le dépôt sous la forme compte/dépôt (ex : LLCenLive/carnet).' };
    if (this.busy) return { ok: false, error: 'Publication déjà en cours.' };
    this.busy = true;
    try {
      const files = listSite(dir);
      if (!files.some(f => f.path === 'index.html')) return { ok: false, error: "Le site n'a pas été généré (index.html manquant)." };
      const api = (m, u, b) => this._api(t.token, m, u, b);
      // Dernier commit de la branche (dépôt vide : on l'initialise avec un premier fichier).
      let head = null;
      try { head = await api('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`); }
      catch (e) { if (e.status !== 404 && e.status !== 409) throw e; }
      if (!head) {
        await api('PUT', `/repos/${repo}/contents/.nojekyll`, { message: 'FlightBrief : création du carnet de vol', content: '', branch });
        head = await api('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
      }
      const parentSha = head.object.sha;
      const parent = await api('GET', `/repos/${repo}/git/commits/${parentSha}`);
      const tree = await api('GET', `/repos/${repo}/git/trees/${parent.tree.sha}?recursive=1`);
      const remote = new Map((tree.tree || []).filter(x => x.type === 'blob').map(x => [x.path, x.sha]));
      const entries = [];
      for (const f of files) {
        const sha = blobSha(f.buf);
        if (remote.get(f.path) === sha) continue;
        const b = await api('POST', `/repos/${repo}/git/blobs`, { content: f.buf.toString('base64'), encoding: 'base64' });
        entries.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha });
      }
      // Fichiers du carnet qui n'existent plus en local (anciennes cartes postales) : supprimés.
      const local = new Set(files.map(f => f.path));
      for (const p of remote.keys()) if (isManaged(p) && !local.has(p)) entries.push({ path: p, mode: '100644', type: 'blob', sha: null });
      let commitSha = parentSha;
      if (entries.length) {
        const nt = await api('POST', `/repos/${repo}/git/trees`, { base_tree: parent.tree.sha, tree: entries });
        const c = await api('POST', `/repos/${repo}/git/commits`, { message: message || 'FlightBrief : mise à jour du carnet de vol', tree: nt.sha, parents: [parentSha] });
        await api('PATCH', `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: c.sha });
        commitSha = c.sha;
      }
      const pages = await this._pages(api, repo, branch);
      return { ok: true, changed: entries.length, commit: commitSha, url: pages.url, pagesEnabled: pages.enabled };
    } catch (e) { return { ok: false, error: this._explain(e, repo) }; }
    finally { this.busy = false; }
  }
  // Adresse du site ; active GitHub Pages sur la branche si le jeton a le droit « Pages ».
  async _pages(api, repo, branch) {
    const [owner, name] = repo.split('/');
    const guess = name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? `https://${name.toLowerCase()}/` : `https://${owner.toLowerCase()}.github.io/${name}/`;
    try { return { url: (await api('GET', `/repos/${repo}/pages`)).html_url || guess, enabled: true }; } catch (e) { /* pas encore activé */ }
    try { return { url: (await api('POST', `/repos/${repo}/pages`, { source: { branch, path: '/' } })).html_url || guess, enabled: true }; } catch (e) { /* droit « Pages » absent : à activer à la main */ }
    return { url: guess, enabled: false };
  }
}

module.exports = { GitHubPages, checkToken, cleanRepo, blobSha, isManaged, listSite, MANAGED };
