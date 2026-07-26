# Publier FlightBrief sur GitHub

Petit guide pas-à-pas pour mettre ce projet sur GitHub et le partager avec tes amis.

## 1. Créer un compte GitHub (si tu n'en as pas)

Sur [github.com](https://github.com), inscription gratuite.

## 2. Installer Git sur ta machine

- Windows : [git-scm.com/download/win](https://git-scm.com/download/win)
- macOS : `brew install git` (ou il est déjà présent avec Xcode Command Line Tools)
- Linux : `sudo apt install git` (ou l'équivalent de ta distro)

Vérifie ensuite dans un terminal :

```bash
git --version
```

## 3. Créer le dépôt sur GitHub

Sur [github.com/new](https://github.com/new) :

- **Repository name** : `flightbrief` (ou ce que tu veux)
- **Visibilité** : Public (pour que tes amis y accèdent librement) ou Private (et tu les invites un par un dans Settings → Collaborators)
- **Ne coche aucune case** "Add a README", "Add .gitignore", "Choose a license" — ce projet les a déjà, ça évite un conflit à la première synchronisation.
- Clique sur **Create repository**. GitHub affiche une page avec des commandes : garde-la ouverte, tu en auras besoin à l'étape 5 (l'URL du type `https://github.com/ton-pseudo/flightbrief.git`).

## 4. Préparer le projet en local

Dans le dossier du projet (celui qui contient `main.js`, `package.json`, etc.) :

```bash
git init
git add .
git commit -m "Version initiale de FlightBrief"
```

`node_modules/` et `dist/` sont déjà exclus par `.gitignore` — tu n'as jamais besoin de les envoyer sur GitHub, ils se régénèrent avec `npm install` / `npm run dist`.

## 5. Envoyer le projet sur GitHub

Remplace `ton-pseudo` par le tien (visible dans l'URL donnée par GitHub à l'étape 3) :

```bash
git branch -M main
git remote add origin https://github.com/ton-pseudo/flightbrief.git
git push -u origin main
```

Git te demandera de t'authentifier : la méthode la plus simple aujourd'hui est de créer un **Personal Access Token** (Settings → Developer settings → Personal access tokens → Generate new token, coche `repo`) et de l'utiliser comme mot de passe quand Git te le demande. Alternative plus confortable sur la durée : configurer une clé SSH ([guide officiel](https://docs.github.com/fr/authentication/connecting-to-github-with-ssh)).

Une fois le push terminé, rafraîchis la page GitHub : ton code y est, tes amis peuvent déjà le voir (s'ils ont le lien, ou si le dépôt est public).

## 6. Partager l'application, pas juste le code

Tes amis n'ont pas forcément envie d'installer Node.js et de taper `npm install` pour lancer l'app. Deux options :

### Option A — Tu construis les installeurs toi-même

```bash
npm run dist:win     # .exe pour Windows
npm run dist:mac     # .dmg pour macOS (doit être lancé sur un Mac)
npm run dist:linux   # .AppImage / .deb pour Linux
```

Les fichiers apparaissent dans `dist/`. Va ensuite sur la page du dépôt → **Releases** (dans la colonne de droite) → **Create a new release** → glisse les fichiers générés → **Publish release**. Tes amis les téléchargent directement depuis cette page, sans rien installer d'autre.

### Option B — Laisser GitHub construire les installeurs pour toi (recommandé)

Le dépôt inclut déjà `.github/workflows/build.yml` : un robot GitHub qui construit automatiquement les versions Windows, macOS **et** Linux à chaque fois que tu publies un tag de version, et les attache directement à une Release.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Va ensuite dans l'onglet **Actions** du dépôt sur GitHub : tu verras le build tourner (quelques minutes), puis une Release `v1.0.0` apparaît automatiquement dans **Releases**, avec les trois installeurs déjà attachés. C'est ce lien-là que tu partages à tes amis.

Pour une prochaine mise à jour, tu recommences juste : tu commit tes changements, puis `git tag v1.1.0 && git push origin v1.1.0`.

## 7. Créer une page de téléchargement (au lieu d'envoyer tes amis directement sur GitHub)

Le dépôt inclut une page prête à l'emploi dans `docs/index.html` : une vitrine avec présentation du projet et boutons de téléchargement qui récupèrent automatiquement les derniers installeurs publiés (elle interroge l'API GitHub à chaque visite, donc pas besoin de la retoucher à chaque nouvelle version).

**Avant de la publier**, ouvre `docs/index.html` et modifie ces deux lignes tout en bas du fichier (dans la balise `<script>`) :

```js
const REPO_OWNER = 'ton-pseudo';   // ton pseudo GitHub
const REPO_NAME  = 'flightbrief';  // le nom exact de ton dépôt
```

Puis commit et pousse ce changement (`git add docs/index.html && git commit -m "Configure la page de téléchargement" && git push`).

**Pour l'activer** : sur la page du dépôt GitHub → **Settings** → **Pages** (dans le menu de gauche) → sous "Build and deployment", **Source : Deploy from a branch** → **Branch : main**, dossier **/docs** → **Save**.

GitHub affiche alors une adresse du type `https://ton-pseudo.github.io/flightbrief/` (ça peut prendre une ou deux minutes à se mettre en ligne la première fois). C'est ce lien-là — pas celui du dépôt — que tu partages à tes amis : ils atterrissent sur une page de présentation avec un bouton "Télécharger", sans avoir à naviguer dans GitHub.

Tant qu'aucune Release n'existe encore (voir étape 6), la page affiche un message "Aucune version publiée pour l'instant" à la place des boutons — normal, ça se remplit tout seul dès que tu publies ta première Release.

## 8. Mettre à jour le projet ensuite

À chaque modification :

```bash
git add .
git commit -m "Description du changement"
git push
```

## Remarque sur "GitHub Pages"

GitHub Pages héberge des **sites web statiques** (HTML/CSS/JS servis dans le navigateur) — c'est exactement ce qu'utilise la page de téléchargement de l'étape 7. Ce que GitHub Pages ne peut *pas* faire, en revanche, c'est faire tourner FlightBrief lui-même : c'est une application de bureau Electron (accès au système de fichiers, à SimConnect, etc.), elle ne peut pas s'exécuter "dans" une page web. D'où le découpage : `docs/index.html` sert uniquement de vitrine et de lien vers les vrais installeurs, hébergés eux sur les Releases GitHub.
