/*
  FlightBrief — appli EFB pour Microsoft Flight Simulator 2024 (v2.0)
  ---------------------------------------------------------------------
  Ajoute « FlightBrief » à la liste des applis de l'EFB (tablette du cockpit). L'appli affiche
  la page que FlightBrief sert sur ce PC (http://127.0.0.1:4814/efb) : vol en cours, météo,
  ATC et amis, commandes du stream. Rien d'autre n'est chargé depuis Internet.

  JavaScript simple, sans étape de build : l'appli s'enregistre auprès de l'EFB par les deux
  objets que l'EFB fournit, window.EFB_API (conteneur, use()) et window.msfssdk
  (@microsoft/msfs-sdk : DisplayComponent, FSComponent, Subject), comme décrit par le contrat
  App / AppView de l'API EFB d'Asobo (npm @microsoft/msfs-efb-api).
  Méthode d'enregistrement « sans build » apprise de RCCSilva/msfs-efb-iframe (licence MIT).

  Le nom interne (INTERNAL_NAME) doit être identique au nom de ce fichier, de son dossier
  et au dossier html_ui/efb_ui/efb_apps/<nom> du paquet, sinon le simulateur ignore l'appli.
*/
(function () {
  'use strict';

  var PAGE_URL = 'http://127.0.0.1:4814/efb';     // serveur local de FlightBrief (127.0.0.1, pas « localhost »)
  var HEALTH_URL = 'http://127.0.0.1:4814/api/ping'; // 200 + CORS dès que FlightBrief tourne
  var APP_NAME = 'FlightBrief';
  var INTERNAL_NAME = 'FlightBriefEfb';
  var VERSION = '2.0.1';
  var BASE_URL = 'coui://html_ui/efb_ui/efb_apps/' + INTERNAL_NAME;
  var STYLE_ID = 'fb-efb-style';

  function sdk() { return window.msfssdk || (typeof msfssdk !== 'undefined' ? msfssdk : null); }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '.fbefb-root{position:absolute;left:0;top:0;right:0;bottom:0;width:100%;height:100%;overflow:hidden;background:#0f151b;}' +
      '.fbefb-frame{position:absolute;left:0;top:0;width:100%;height:100%;border:0;background:#0f151b;}' +
      '.fbefb-msg{position:absolute;left:10%;right:10%;top:35%;padding:24px;text-align:center;font:20px/28px Arial,sans-serif;' +
      'color:#e7edf2;background:#16202a;border:1px solid #243240;border-radius:14px;z-index:5;}' +
      '.fbefb-msg b{display:block;font-size:26px;margin-bottom:8px;color:#fff;}' +
      '.fbefb-hidden{display:none;}';
    var el = document.createElement('style');
    el.id = STYLE_ID; el.type = 'text/css';
    el.appendChild(document.createTextNode(css));
    document.head.appendChild(el);
  }

  function viewClass(S) {
    return class FlightBriefEfbView extends S.DisplayComponent {
      constructor(props) {
        super(props);
        this.rootRef = S.FSComponent.createRef();
        this.frame = null; this.msg = null; this.timer = null; this.serverUp = null; this.destroyed = false;
        this.pageKeyActions = new Map();
      }
      render() {
        var h = S.FSComponent.buildComponent;
        return h('div', { class: 'fbefb-root', ref: this.rootRef },
          h('div', { class: 'fbefb-msg fbefb-hidden' }, ''));
      }
      onAfterRender() {
        var root = this.rootRef.instance;
        if (!root) return;
        this.msg = root.querySelector('.fbefb-msg');
        this.check();
        this.startPolling();
      }
      // FlightBrief n'est pas encore lancé : message, puis chargement automatique dès qu'il répond.
      check() {
        if (this.destroyed) return;
        var self = this, x = new XMLHttpRequest();
        x.open('GET', HEALTH_URL + '?t=' + Date.now());
        x.timeout = 1500;
        x.onreadystatechange = function () {
          if (x.readyState !== 4 || self.destroyed) return;
          var up = x.status === 200, was = self.serverUp;
          self.serverUp = up;
          if (up && was !== true) self.load();
          self.showMsg(!up);
        };
        try { x.send(); } catch (e) { this.serverUp = false; this.showMsg(true); }
      }
      load() {
        var root = this.rootRef.instance;
        if (!root) return;
        if (this.frame && this.frame.parentNode) this.frame.parentNode.removeChild(this.frame);
        var f = document.createElement('iframe');
        f.className = 'fbefb-frame'; f.setAttribute('frameborder', '0');
        root.insertBefore(f, root.firstChild);
        f.src = PAGE_URL + '?v=' + VERSION;
        this.frame = f;
      }
      showMsg(on) {
        if (!this.msg) return;
        this.msg.innerHTML = '<b>FlightBrief</b>Lance FlightBrief sur ce PC (version 2.0.1 ou plus récente).<br>Start FlightBrief on this PC.';
        this.msg.className = on ? 'fbefb-msg' : 'fbefb-msg fbefb-hidden';
      }
      startPolling() {
        var self = this;
        this.stopPolling();
        this.timer = window.setInterval(function () { self.check(); }, 3000);
      }
      stopPolling() { if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; } }
      onOpen() { this.startPolling(); }
      onResume() { this.startPolling(); }
      onPause() { this.stopPolling(); }
      onClose() { this.stopPolling(); }
      onUpdate() {}
      routeGamepadInteractionEvent() {}
      handlePageKeyAction() {}
      destroy() {
        this.destroyed = true; this.stopPolling();
        if (this.frame) this.frame.src = 'about:blank';
        super.destroy();
      }
    };
  }

  function register() {
    var S = sdk(), efb = window.EFB_API;
    if (!S || !efb || typeof efb.use !== 'function') return false;
    injectStyle();
    var View = viewClass(S);
    class FlightBriefEfb {
      constructor() {
        this.available = S.Subject.create(true);
        this.BootMode = 0;    // AppBootMode.COLD
        this.SuspendMode = 0; // AppSuspendMode.SLEEP
        this._isReady = false; this._favoriteIndex = -1; this.bus = null;
      }
      get name() { return APP_NAME; }
      get internalName() { return INTERNAL_NAME; }
      get icon() { return BASE_URL + '/Assets/app-icon.png'; }
      get isReady() { return this._isReady; }
      get favoriteIndex() { return this._favoriteIndex; }
      set favoriteIndex(v) { this._favoriteIndex = v; }
      get compatibleAircraftModels() { return undefined; }
      get unitsSettingsManager() { return this._unitsSettingsManager; }
      getIsSearchable() { return true; }
      getIsFavoritable() { return true; }
      getVersion() { return VERSION; }
      async install() { /* la page vient de FlightBrief */ }
      async _install(props) {
        this.bus = props && props.bus;
        this._unitsSettingsManager = props && props.unitsSettingManager;
        this.notificationManager = props && props.notificationManager;
        this.efbSettingsManager = props && props.efbSettingsManager;
        this.options = props && props.options;
        await this.install(props);
        this._isReady = true;
      }
      render() { return S.FSComponent.buildComponent(View, { bus: this.bus }); }
    }
    efb.use(FlightBriefEfb); // lève une erreur tant que l'EFB n'a pas fourni son bus : on réessaie
    return true;
  }

  var tries = 0;
  (function retry() {
    var ok = false;
    try { ok = register(); } catch (e) { ok = false; }
    if (!ok && ++tries < 150) window.setTimeout(retry, 100);
  })();
})();
