/* =========================================================
   FlightBrief — Prédictions Twitch pour le pari d'atterrissage (v1.7)
   ---------------------------------------------------------
   En plus de « !pari 180 », les viewers misent leurs points de chaîne sur une tranche de
   taux de toucher, dans l'interface officielle de Twitch. La prédiction suit les paris du bot :
   ouverture au début de la descente, verrouillage en courte finale, résultat au toucher,
   remboursement si le vol est interrompu.
   Conditions Twitch : chaîne Affiliée ou Partenaire, et compte de la chaîne connecté (onglet
   À bord) avec le droit « channel:manage:predictions ».
   ========================================================= */
const SCOPE = 'channel:manage:predictions';
// Tranches de taux de toucher (ft/min, valeur absolue) : [min inclus, max exclu, libellé ≤ 25 car.]
const BUCKETS = [
  [0, 100, '🧈 Beurre (< 100)'],
  [100, 200, '👌 Doux (100-199)'],
  [200, 350, '✈️ Ferme (200-349)'],
  [350, 600, '😬 Dur (350-599)'],
  [600, Infinity, '💥 Boum (600+)']
];
const TITLE = 'Taux de toucher (ft/min) ?';
const bucketOf = fpm => BUCKETS.findIndex(([a, b]) => Math.abs(fpm) >= a && Math.abs(fpm) < b);

class Prediction {
  // ctx : { fetch(url, opts), getAuth() -> TwitchAuth du compte de la chaîne, tr(text), log(text) }
  constructor(ctx) {
    this.ctx = ctx;
    this.cur = null;      // { id, outcomes: [id…] } de la prédiction en cours
    this.state = 'idle';  // idle | active | locked | resolved | canceled | error
    this.error = null;
    this._chain = Promise.resolve(); // une requête à la fois, dans l'ordre (ouvrir avant verrouiller…)
  }
  publicState() { return { state: this.state, error: this.error }; }

  async _call(method, body) {
    const a = this.ctx.getAuth();
    const token = await a.ensureToken().catch(() => null);
    if (!token || !a.data.userId) throw new Error('Connecte le compte de ta chaîne (onglet À bord) pour lancer des prédictions.');
    if (!(a.data.scopes || []).includes(SCOPE)) throw new Error('Reconnecte le compte de ta chaîne (onglet À bord) pour autoriser les prédictions.');
    const res = await this.ctx.fetch('https://api.twitch.tv/helix/predictions', {
      method, headers: { Authorization: 'Bearer ' + token, 'Client-Id': a.clientId(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ broadcaster_id: a.data.userId, ...body })
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) return j;
    if (res.status === 403) throw new Error('Twitch refuse : les prédictions demandent une chaîne Affiliée ou Partenaire.');
    if (res.status === 401) throw new Error('Autorisation refusée : reconnecte le compte de ta chaîne.');
    throw new Error(j.message || ('Twitch a répondu HTTP ' + res.status));
  }
  _run(fn) {
    this._chain = this._chain.then(fn).catch(e => { this.state = 'error'; this.error = e.message; this.ctx.log('Prédiction : ' + e.message); });
    return this._chain;
  }

  open() {
    return this._run(async () => {
      if (this.cur) return;
      const tr = this.ctx.tr;
      const j = await this._call('POST', {
        title: tr(TITLE).slice(0, 45),
        outcomes: BUCKETS.map(b => ({ title: tr(b[2]).slice(0, 25) })),
        prediction_window: 1800 // maximum Twitch ; FlightBrief verrouille lui-même en courte finale
      });
      const p = j.data && j.data[0];
      if (!p) throw new Error('Réponse Twitch inattendue.');
      this.cur = { id: p.id, outcomes: p.outcomes.map(o => o.id) };
      this.state = 'active'; this.error = null;
      this.ctx.log('Prédiction Twitch ouverte');
    });
  }
  lock() {
    return this._run(async () => {
      if (!this.cur || this.state !== 'active') return;
      await this._call('PATCH', { id: this.cur.id, status: 'LOCKED' });
      this.state = 'locked';
    });
  }
  resolve(fpm) {
    return this._run(async () => {
      if (!this.cur) return;
      const i = bucketOf(fpm);
      await this._call('PATCH', { id: this.cur.id, status: 'RESOLVED', winning_outcome_id: this.cur.outcomes[i] });
      this.cur = null; this.state = 'resolved';
      this.ctx.log(`Prédiction Twitch : ${this.ctx.tr(BUCKETS[i][2])}`);
    });
  }
  // Vol interrompu ou paris annulés : Twitch rembourse les points.
  cancel() {
    return this._run(async () => {
      if (!this.cur) return;
      const id = this.cur.id;
      this.cur = null;
      await this._call('PATCH', { id, status: 'CANCELED' });
      this.state = 'canceled';
    });
  }
}

module.exports = { Prediction, BUCKETS, SCOPE, bucketOf };
