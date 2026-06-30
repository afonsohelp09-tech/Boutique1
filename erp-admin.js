/**
 * AZAVISION — Admin ERP (02-admin-erp)
 */
(function (global) {
  'use strict';

  var API = global.API_URL || global.ERP_API_URL_DEFAULT || '';
  var proApi = null;
  var LS_TOKEN = 'azav_admin_token';
  var LS_USER = 'azav_admin_user';
  var LS_LANG = 'azav_admin_lang';
  var LS_THEME = 'azav_admin_theme';

  var state = {
    lang: 'pt',
    theme: 'dark',
    token: '',
    user: null,
    view: 'dashboard',
    sidebarOpen: false,
    loading: false,
    config: {},
    dashboard: null,
    products: [],
    productFilter: 'all',
    productSearch: '',
    productSelected: {},
    promoTab: 'coupons',
    couponFilter: 'active',
    categories: [],
    orders: [],
    ordersError: '',
    ordersTotal: 0,
    orderFilter: '',
    orderSearch: '',
    clients: [],
    coupons: [],
    clientSearch: '',
    selectedProduct: null,
    selectedOrder: null,
    productForm: null,
    categoryForm: null,
    couponForm: null,
    storefront: null,
    vitrineEditLang: 'pt',
    vitrineGalleryOpen: '',
    vitrineGalleryImages: [],
    vitrineGalleryLoading: false,
    adminUsers: [],
    reviews: [],
    reviewFilter: 'pendente',
    returns: [],
    returnFilter: '',
    empresa: {},
    orderPageSize: 100,
    orderHasMore: false
  };
  var storefrontAutosaveTimer = 0;
  var storefrontAutosaveDirty = false;
  var storefrontAutosaveInFlight = false;
  var storefrontAutosaveQueued = false;
  var loginInFlight = false;
  var sessionEstablishedAt = 0;

  var VITRINE_LANGS = ['pt', 'fr', 'en', 'es'];
  var VITRINE_SVC_COUNT = 4;
  var VITRINE_SVC_EXAMPLES = {
    fr: [
      { t: 'Livraison express offerte', d: 'Dès 150 € via DHL Express en 48 h.' },
      { t: 'Retours faciles', d: 'Prise en charge à domicile gratuite sous 30 jours.' },
      { t: 'Paiement sécurisé', d: 'SSL 256 bits · Visa · Mastercard · Apple Pay.' },
      { t: 'Atelier durable', d: 'Fibres nobles, organiques et emballages recyclés.' }
    ],
    pt: [
      { t: 'Envio expresso grátis', d: 'A partir de 150 € via DHL Express em 48 h.' },
      { t: 'Devoluções fáceis', d: 'Recolha gratuita ao domicílio em 30 dias.' },
      { t: 'Pagamento seguro', d: 'SSL 256 bits · Visa · Mastercard · MB Way.' },
      { t: 'Atelier sustentável', d: 'Fibras nobres orgânicas e embalagens ecológicas.' }
    ],
    en: [
      { t: 'Free express shipping', d: 'From €150 via DHL Express in 48 h.' },
      { t: 'Easy returns', d: 'Free home pickup within 30 days.' },
      { t: 'Secure payment', d: 'TLS 1.3 · Visa · Mastercard · Apple Pay.' },
      { t: 'Sustainable atelier', d: 'Noble organic fibres and eco packaging.' }
    ],
    es: [
      { t: 'Envío express gratuito', d: 'Desde 150 € vía DHL Express en 48 h.' },
      { t: 'Devoluciones fáciles', d: 'Recogida gratuita a domicilio en 30 días.' },
      { t: 'Pago seguro', d: 'SSL 256 bits · Visa · Mastercard · Apple Pay.' },
      { t: 'Taller sostenible', d: 'Fibras nobles orgánicas y envases ecológicos.' }
    ]
  };

  var VITRINE_TEXT_EXAMPLES = {
    fr: {
      hEye: 'HAUTE COUTURE · COLLECTION SIGNATURE 2026',
      hTitle: "L'Allure Française<br><em>Redéfinie</em>",
      hSub: "Matières d'exception certifiées, coupes géométriques intemporelles et fabrication responsable.",
      hBtn1: 'Découvrir la boutique ↓',
      hBtn2: 'Les nouveautés',
      shopLabel: 'Notre sélection',
      shopTitle: 'Collections exclusives',
      fDesc: 'Notre maison réinterprète les grands basiques du vestiaire parisien avec transparence et responsabilité.',
      promoText: '✦ LIVRAISON OFFERTE DÈS 150 € · RETOURS 30 JOURS GRATUITS · CODE : BIENVENUE10 (-10 %) ✦',
      svc: VITRINE_SVC_EXAMPLES.fr
    },
    pt: {
      hEye: 'ALTA COSTURA · COLEÇÃO SIGNATURE 2026',
      hTitle: 'A Elegância<br><em>Redefinida</em>',
      hSub: 'Materiais excecionais certificados, cortes intemporais e confeção responsável.',
      hBtn1: 'Descobrir a loja ↓',
      hBtn2: 'Novidades',
      shopLabel: 'A nossa seleção',
      shopTitle: 'Coleções exclusivas',
      fDesc: 'Reinterpretamos o guarda-roupa essencial com transparência e respeito pelas matérias nobres.',
      promoText: '✦ ENVIO GRÁTIS A PARTIR DE 150 € · DEVOLUÇÕES 30 DIAS GRÁTIS · CÓDIGO: BIENVENUE10 (-10 %) ✦',
      svc: VITRINE_SVC_EXAMPLES.pt
    },
    en: {
      hEye: 'HAUTE COUTURE · SIGNATURE COLLECTION 2026',
      hTitle: 'French Allure<br><em>Redefined</em>',
      hSub: 'Certified exceptional materials, timeless cuts and responsible craftsmanship.',
      hBtn1: 'Explore the shop ↓',
      hBtn2: 'New arrivals',
      shopLabel: 'Our selection',
      shopTitle: 'Exclusive collections',
      fDesc: 'We reinterpret Parisian wardrobe essentials with transparency and care for noble materials.',
      promoText: '✦ FREE SHIPPING FROM €150 · FREE 30-DAY RETURNS · CODE: BIENVENUE10 (-10 %) ✦',
      svc: VITRINE_SVC_EXAMPLES.en
    },
    es: {
      hEye: 'ALTA COSTURA · COLECCIÓN SIGNATURE 2026',
      hTitle: 'Elegancia<br><em>Redefinida</em>',
      hSub: 'Materiales excepcionales certificados, cortes atemporales y confección responsable.',
      hBtn1: 'Descubrir la tienda ↓',
      hBtn2: 'Novedades',
      shopLabel: 'Nuestra selección',
      shopTitle: 'Colecciones exclusivas',
      fDesc: 'Reinterpretamos los básicos del armario parisino con transparencia y respeto por las materias nobles.',
      promoText: '✦ ENVÍO GRATIS DESDE 150 € · DEVOLUCIONES 30 DÍAS GRATIS · CÓDIGO: BIENVENUE10 (-10 %) ✦',
      svc: VITRINE_SVC_EXAMPLES.es
    }
  };

  function storageGet(key) {
    try {
      var v = localStorage.getItem(key);
      if (v != null && v !== '') return v;
    } catch (e) { /* ignore */ }
    try {
      return sessionStorage.getItem(key) || '';
    } catch (e2) { return ''; }
  }

  function storageSet(key, val) {
    try {
      if (val) localStorage.setItem(key, val);
      else localStorage.removeItem(key);
    } catch (e) { /* ignore */ }
    try {
      if (val) sessionStorage.setItem(key, val);
      else sessionStorage.removeItem(key);
    } catch (e2) { /* ignore */ }
  }

  function storageRemove(key) {
    storageSet(key, '');
  }

  function $(id) { return document.getElementById(id); }
  function t() { return (global.AdminT && global.AdminT[state.lang]) || global.AdminT.pt; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function apiOk() {
    return API && API.indexOf('INSEREZ') === -1 && API.indexOf('/exec') > -1;
  }

  function isNoAuthResponse(json) {
    return !!(json && (json.code === 'NO_AUTH' || /não autorizado|non autorisé|not authorized/i.test(String(json.error || ''))));
  }

  function isSpreadsheetBindingError(msg) {
    return /liaison classeur|ERP_SPREADSHEET_ID|bindActiveSpreadsheet/i.test(String(msg || ''));
  }

  async function erpCall(action, data, opts) {
    opts = opts || {};
    if (!apiOk()) throw new Error('API_URL');
    var res = await fetch(API, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: data || {}, token: state.token || '' })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var json = await res.json();
    if (!opts._noRetry && isNoAuthResponse(json) && state.token && action !== 'adminLogin' && action !== 'validateToken' && action !== 'refreshAdminToken') {
      try {
        var refreshed = await erpCall('refreshAdminToken', {}, { _noRetry: true });
        if (refreshed && refreshed.success) {
          return erpCall(action, data, { _noRetry: true });
        }
      } catch (refreshErr) { /* ignore */ }
      logout(true);
      toast(t().sessionExpired || 'Session expirée — reconnectez-vous', 'e');
    }
    if (json && !json.success && isSpreadsheetBindingError(json.error)) {
      json.error = (json.error || '') + ' — Ouvrez Google Sheets → menu « ERP Vente en ligne » → « Enregistrer la liaison avec ce classeur », puis redéployez la Web App.';
    }
    return json;
  }

  function toast(msg, type) {
    if (global.toast) global.toast(msg, type || 's');
  }

  function isAdminUser() {
    return !!(state.user && String(state.user.role || 'admin').toLowerCase() === 'admin');
  }

  /* Vues accessibles au rôle « staff » ; les administrateurs ont tout. */
  var STAFF_ALLOWED_VIEWS = ['dashboard', 'products', 'orders', 'reviews', 'returns', 'categories', 'clients', 'coupons'];

  function canAccessView(view) {
    if (isAdminUser()) return true;
    return STAFF_ALLOWED_VIEWS.indexOf(String(view || '')) >= 0;
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function resolveImageMimeType(file) {
    var mt = String((file && file.type) || '').toLowerCase().trim();
    if (mt === 'image/jpg' || mt === 'image/pjpeg') return 'image/jpeg';
    if (mt && mt !== 'application/octet-stream') return mt;
    var n = String((file && file.name) || '').toLowerCase();
    if (/\.jfif$/.test(n)) return 'image/jpeg';
    if (/\.jpe?g$/.test(n)) return 'image/jpeg';
    if (/\.png$/.test(n)) return 'image/png';
    if (/\.webp$/.test(n)) return 'image/webp';
    if (/\.gif$/.test(n)) return 'image/gif';
    if (/\.bmp$/.test(n)) return 'image/bmp';
    if (/\.tiff?$/.test(n)) return 'image/tiff';
    if (/\.svg$/.test(n)) return 'image/svg+xml';
    if (/\.heic$/.test(n)) return 'image/heic';
    if (/\.heif$/.test(n)) return 'image/heif';
    if (/\.avif$/.test(n)) return 'image/avif';
    if (/\.ico$/.test(n)) return 'image/x-icon';
    return 'image/jpeg';
  }

  function isAllowedHeroImage(file, mime) {
    var n = String((file && file.name) || '').toLowerCase();
    if (/\.(jpe?g|jfif|png|webp|gif|bmp|tiff?|svg|heic|heif|avif|ico)$/i.test(n)) return true;
    return /^image\/(jpeg|png|webp|gif|bmp|tiff|svg\+xml|heic|heif|avif|x-icon)/i.test(mime || '');
  }

  function isUnknownActionError(msg) {
    return /desconhecida|unknown|inconnu|desconocida|inconnue|em falta|ausente|missing/i.test(String(msg || ''));
  }

  function configDisplayVal(st, key) {
    var v = st && st[key];
    return v == null || v === '' ? '1' : String(v);
  }

  function announcementFromSettings(st) {
    st = st || {};
    return {
      enabled: st.announcement_enabled,
      display: configDisplayVal(st, 'announcement_display'),
      showDefault: configDisplayVal(st, 'announcement_show_default'),
      marquee: configDisplayVal(st, 'announcement_marquee'),
      text: st.announcement_text || '',
      label: st.announcement_promo_label || '',
      code: st.announcement_promo_code || '',
      pct: st.announcement_promo_pct || '',
      pct2: st.announcement_promo_pct_2 || '',
      amount: st.announcement_promo_amount_eur || '',
      minCart: st.announcement_promo_min_cart_eur || '',
      validUntil: st.announcement_promo_valid_until || '',
      dateStart: st.announcement_date_start || '',
      dateEnd: st.announcement_date_end || '',
      labelDisplay: configDisplayVal(st, 'announcement_promo_label_display'),
      pctDisplay: configDisplayVal(st, 'announcement_promo_pct_display'),
      pct2Display: configDisplayVal(st, 'announcement_promo_pct_2_display'),
      codeDisplay: configDisplayVal(st, 'announcement_promo_code_display'),
      amountDisplay: configDisplayVal(st, 'announcement_promo_amount_display'),
      minCartDisplay: configDisplayVal(st, 'announcement_promo_min_cart_display'),
      validUntilDisplay: configDisplayVal(st, 'announcement_promo_valid_until_display')
    };
  }

  function announcementVarDisplayChecks(ann, v) {
    ann = ann || {};
    function d(key) { return ann[key] != null ? ann[key] : '1'; }
    return check('vit_ann_display', v.annDisplay || 'Afficher la campagne sur la vitrine', d('display')) +
      check('vit_ann_show_default', v.annShowDefault || 'Afficher le repli automatique (✦ CODE : …) si le texte est vide', d('showDefault')) +
      check('vit_ann_label_display', v.showPromoLabel || 'Afficher {{promo_label}}', d('labelDisplay')) +
      check('vit_ann_pct_display', v.showPromoPct || 'Afficher {{pct}}', d('pctDisplay')) +
      check('vit_ann_pct2_display', v.showPromoPct2 || 'Afficher {{pct2}}', d('pct2Display')) +
      check('vit_ann_code_display', v.showPromoCode || 'Afficher {{code}}', d('codeDisplay')) +
      check('vit_ann_amount_display', v.showPromoAmount || 'Afficher {{amount}}', d('amountDisplay')) +
      check('vit_ann_min_cart_display', v.showPromoMinCart || 'Afficher {{min_cart}}', d('minCartDisplay')) +
      check('vit_ann_valid_until_display', v.showPromoValidUntil || 'Afficher {{valid_until}}', d('validUntilDisplay'));
  }

  function storefrontDisplayFromSettings(st) {
    st = st || {};
    function f(k) {
      return st[k] == null || st[k] === '' ? '1' : String(st[k]);
    }
    return {
      heroEyebrow: f('vitrine_display_hero_eyebrow'),
      heroTitle: f('vitrine_display_hero_title'),
      heroSub: f('vitrine_display_hero_sub'),
      heroButtons: f('vitrine_display_hero_buttons'),
      shopHeader: f('vitrine_display_shop_header'),
      footerDesc: f('vitrine_display_footer_desc'),
      services: f('vitrine_display_services'),
      svcItems: storefrontSvcDisplayFromSettings(st),
      social: f('vitrine_display_social'),
      promoFaixa: f('vitrine_display_promo_faixa')
    };
  }

  function storefrontSvcDisplayFromSettings(st) {
    st = st || {};
    var out = [];
    for (var i = 0; i < VITRINE_SVC_COUNT; i++) {
      out.push(st['vitrine_display_svc' + i] == null || st['vitrine_display_svc' + i] === '' ? '1' : String(st['vitrine_display_svc' + i]));
    }
    return out;
  }

  function buildSvcContentFromSettings(st, lg) {
    var svc = [];
    for (var i = 0; i < VITRINE_SVC_COUNT; i++) {
      svc.push({
        t: String(st['vitrine_svc' + i + '_title_' + lg] || '').trim(),
        d: String(st['vitrine_svc' + i + '_desc_' + lg] || '').trim()
      });
    }
    return svc;
  }

  function buildStorefrontContentFromSettings(st) {
    var content = {};
    VITRINE_LANGS.forEach(function (lg) {
      content[lg] = {
        hEye: String(st['vitrine_hero_eyebrow_' + lg] || '').trim(),
        hTitle: String(st['vitrine_hero_title_' + lg] || '').trim(),
        hSub: String(st['vitrine_hero_sub_' + lg] || '').trim(),
        hBtn1: String(st['vitrine_hero_btn1_' + lg] || '').trim(),
        hBtn2: String(st['vitrine_hero_btn2_' + lg] || '').trim(),
        shopLabel: String(st['vitrine_shop_label_' + lg] || '').trim(),
        shopTitle: String(st['vitrine_shop_title_' + lg] || '').trim(),
        fDesc: String(st['vitrine_footer_desc_' + lg] || st.boutique_footer_tagline || '').trim(),
        svc: buildSvcContentFromSettings(st, lg)
      };
    });
    return content;
  }

  function buildStorefrontSocialFromSettings(st) {
    return {
      instagram: String(st.social_instagram || '').trim(),
      facebook: String(st.social_facebook || '').trim(),
      pinterest: String(st.social_pinterest || '').trim(),
      tiktok: String(st.social_tiktok || '').trim()
    };
  }

  function storefrontConfigKeyForPurpose(purpose) {
    purpose = String(purpose || 'hero_bg').toLowerCase();
    if (purpose === 'logo') return 'store_logo_url';
    if (purpose === 'hero_bg') return 'vitrine_hero_bg_url';
    return '';
  }

  function isHexColorValue(value) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || '').trim());
  }

  function normalizeHexColor(value, fallback) {
    var raw = String(value || '').trim();
    if (!raw) return String(fallback || '#1A1A1A').toUpperCase();
    if (raw.charAt(0) !== '#') raw = '#' + raw;
    if (!isHexColorValue(raw)) return String(fallback || '#1A1A1A').toUpperCase();
    if (raw.length === 4) {
      raw = '#' + raw.charAt(1) + raw.charAt(1) + raw.charAt(2) + raw.charAt(2) + raw.charAt(3) + raw.charAt(3);
    }
    return raw.toUpperCase();
  }

  var HERO_BG_CHUNK_BYTES = 2.5 * 1024 * 1024;
  var HERO_BG_SINGLE_MAX_BYTES = 5 * 1024 * 1024;
  var HERO_BG_MAX_BYTES = 500 * 1024 * 1024;

  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var bin = '';
    var step = 0x8000;
    for (var i = 0; i < bytes.length; i += step) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return btoa(bin);
  }

  function formatUploadSize(bytes) {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' Go';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' Ko';
    return bytes + ' o';
  }

  function isUploadSizeError(msg) {
    return /volumineuse|too large|demasiado|tropo grande|8 Mo|8 MB|max 8/i.test(String(msg || ''));
  }

  async function fileToVitrineUploadPayload(file, mime, purpose) {
    var dataUrl = await fileToBase64(file);
    return {
      base64: String(dataUrl).split(',')[1] || dataUrl,
      mimeType: mime,
      fileName: file.name,
      purpose: purpose || 'hero_bg'
    };
  }

  async function uploadVitrineImageChunked(file, mime, purpose) {
    var v = t().vit || {};
    var totalChunks = Math.ceil(file.size / HERO_BG_CHUNK_BYTES);
    var begin = await erpCall('beginVitrineImageUpload', {
      purpose: purpose,
      fileName: file.name,
      mimeType: mime,
      totalSize: file.size,
      totalChunks: totalChunks
    });
    if (!begin || !begin.success) {
      if (isUnknownActionError((begin && begin.error) || '')) {
        return { success: false, error: '__chunk_api_missing__' };
      }
      return begin;
    }
    var sessionId = begin.sessionId;
    for (var i = 0; i < totalChunks; i++) {
      var start = i * HERO_BG_CHUNK_BYTES;
      var slice = file.slice(start, Math.min(start + HERO_BG_CHUNK_BYTES, file.size));
      var buf = await slice.arrayBuffer();
      var chunkRes = await erpCall('uploadVitrineImageChunk', {
        sessionId: sessionId,
        index: i,
        base64: arrayBufferToBase64(buf)
      });
      if (!chunkRes || !chunkRes.success) return chunkRes;
      var pct = Math.round(((i + 1) / totalChunks) * 100);
      toast((v.uploading || 'Envoi…') + ' ' + pct + '% (' + formatUploadSize(file.size) + ')', 'i');
    }
    return erpCall('finishVitrineImageUpload', {
      sessionId: sessionId,
      purpose: purpose,
      fileName: file.name,
      mimeType: mime
    });
  }

  function vitrineUploadApiMissing() {
    try { return sessionStorage.getItem('erp_vitrine_upload_api_missing') === '1'; } catch (e) { return false; }
  }

  function setVitrineUploadApiMissing() {
    try { sessionStorage.setItem('erp_vitrine_upload_api_missing', '1'); } catch (e) { /* ignore */ }
  }

  async function uploadVitrineImageWithFallback(payload) {
    var actions = ['uploadVitrineImage', 'uploadHeroBg', 'uploadStoreImage'];
    var lastErr = '';
    var res = null;
    var purpose = String((payload && payload.purpose) || 'hero_bg').toLowerCase();
    var configKey = storefrontConfigKeyForPurpose(purpose);
    if (!vitrineUploadApiMissing()) {
      for (var i = 0; i < actions.length; i++) {
        res = await erpCall(actions[i], payload);
        if (res && res.success) return res;
        lastErr = (res && res.error) || lastErr;
        if (!isUnknownActionError(lastErr)) break;
      }
      if (!isUnknownActionError(lastErr)) return res || { success: false, error: lastErr };
      setVitrineUploadApiMissing();
    }
    var ext = (payload.mimeType || 'image/jpeg').split('/').pop().replace('svg+xml', 'svg');
    var up = await erpCall('uploadProductImage', {
      base64: payload.base64,
      mimeType: payload.mimeType,
      fileName: payload.fileName || (purpose + '.' + ext),
      categoria: '_Vitrine',
      produto_id: purpose
    });
    if (!up || !up.success) {
      return {
        success: false,
        error: (up && up.error) || lastErr || 'Upload impossible. Redéployez le script Google Apps Script (api_apps_script.gs).'
      };
    }
    if (configKey) {
      try {
        var patch = {};
        patch[configKey] = up.url;
        await erpCall('updateConfig', patch);
      } catch (cfgErr) { /* URL Drive suffit si CONFIG échoue */ }
    }
    return { success: true, url: up.url, fileId: up.fileId, thumbnailUrl: up.thumbnailUrl, fallback: true };
  }

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(LS_THEME, theme); } catch (e) { /* ignore */ }
    var meta = $('metaThemeColor') || document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f3ef' : '#0b0a09');
    updateThemeButtons();
  }

  function themeSwitchHtml() {
    var a = t();
    var th = getTheme();
    return '<div class="theme-switch" role="group" aria-label="' + esc(a.themeAria || 'Appearance') + '">' +
      '<button type="button" id="btnThemeDark" class="' + (th === 'dark' ? 'on' : '') + '" aria-pressed="' + (th === 'dark' ? 'true' : 'false') + '" onclick="Admin.setTheme(\'dark\')" title="' + esc(a.themeDark) + '">' +
      '<svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>' +
      '<span class="theme-lbl">' + esc(a.themeDarkShort) + '</span></button>' +
      '<button type="button" id="btnThemeLight" class="' + (th === 'light' ? 'on' : '') + '" aria-pressed="' + (th === 'light' ? 'true' : 'false') + '" onclick="Admin.setTheme(\'light\')" title="' + esc(a.themeLight) + '">' +
      '<svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>' +
      '<span class="theme-lbl">' + esc(a.themeLightShort) + '</span></button></div>';
  }

  function updateThemeButtons() {
    var th = getTheme();
    var a = t();
    var darkBtn = $('btnThemeDark');
    var lightBtn = $('btnThemeLight');
    if (darkBtn) {
      darkBtn.classList.toggle('on', th === 'dark');
      darkBtn.setAttribute('aria-pressed', th === 'dark' ? 'true' : 'false');
      darkBtn.title = a.themeDark || 'Dark';
      var dl = darkBtn.querySelector('.theme-lbl');
      if (dl) dl.textContent = a.themeDarkShort || a.themeDark || 'Dark';
    }
    if (lightBtn) {
      lightBtn.classList.toggle('on', th === 'light');
      lightBtn.setAttribute('aria-pressed', th === 'light' ? 'true' : 'false');
      lightBtn.title = a.themeLight || 'Light';
      var ll = lightBtn.querySelector('.theme-lbl');
      if (ll) ll.textContent = a.themeLightShort || a.themeLight || 'Light';
    }
  }

  function setTheme(theme) {
    applyTheme(theme);
  }

  function loadSession() {
    try {
      state.token = storageGet(LS_TOKEN) || '';
      state.user = JSON.parse(storageGet(LS_USER) || 'null');
      var lg = storageGet(LS_LANG);
      if (lg && global.AdminT[lg]) state.lang = lg;
      var th = storageGet(LS_THEME);
      if (th === 'light' || th === 'dark') state.theme = th;
    } catch (e) { state.user = null; }
    applyTheme(state.theme);
  }

  function saveSession() {
    if (state.token) storageSet(LS_TOKEN, state.token);
    else storageRemove(LS_TOKEN);
    if (state.user) storageSet(LS_USER, JSON.stringify(state.user));
    else storageRemove(LS_USER);
    storageSet(LS_LANG, state.lang);
  }

  function updateScrollLock() {
    var lock = state.sidebarOpen || ($('modalBg') && $('modalBg').classList.contains('open'));
    document.body.classList.toggle('scroll-lock', !!lock);
  }

  function setLang(l) {
    if (!global.AdminT[l]) l = 'fr';
    state.lang = l;
    saveSession();
    ['fr', 'pt', 'en', 'es'].forEach(function (c) {
      var b = $('btnLang' + c.toUpperCase());
      if (b) b.classList.toggle('on', c === l);
    });
    if (state.token && $('sidebar')) refreshSidebarNav();
    render();
  }

  function setView(v) {
    if (!canAccessView(v)) {
      toast((t().team && t().team.adminOnly) || 'Apenas administradores.', 'e');
      return;
    }
    state.view = v;
    state.sidebarOpen = false;
    state.selectedProduct = null;
    state.selectedOrder = null;
    closeModal();
    updateScrollLock();
    render();
    loadViewData();
  }

  function toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    var sb = $('sidebar');
    var ov = $('sidebarOverlay');
    if (sb) sb.classList.toggle('open', state.sidebarOpen);
    if (ov) ov.classList.toggle('open', state.sidebarOpen);
    updateScrollLock();
  }

  function closeSidebar() {
    state.sidebarOpen = false;
    if ($('sidebar')) $('sidebar').classList.remove('open');
    if ($('sidebarOverlay')) $('sidebarOverlay').classList.remove('open');
    updateScrollLock();
  }

  function openModal(html, opts) {
    var bg = $('modalBg');
    var body = $('modalBody');
    if (!bg || !body) return;
    body.innerHTML = html;
    body.classList.toggle('wizard-panel', !!(opts && opts.wide));
    bg.classList.toggle('wizard-bg', !!(opts && opts.wide));
    bg.classList.add('open');
    updateScrollLock();
  }

  function closeModal() {
    var bg = $('modalBg');
    var body = $('modalBody');
    if (bg) {
      bg.classList.remove('open', 'wizard-bg');
    }
    if (body) {
      body.classList.remove('wizard-panel');
      body.innerHTML = '';
    }
    updateScrollLock();
  }

  async function validateAdmin(opts) {
    opts = opts || {};
    if (!state.token || !apiOk()) return false;
    if (opts.trustSession && state.user) return true;
    try {
      var v = await erpCall('validateToken', {}, { _noRetry: true });
      if (!v || !v.success || v.type !== 'admin') {
        logout(true);
        return false;
      }
      state.user = state.user || {};
      if (v.role) state.user.role = v.role;
      if (v.email) state.user.email = v.email;
      if (v.nome) state.user.nome = v.nome;
      saveSession();
      return true;
    } catch (e) {
      if (opts.trustSession || (sessionEstablishedAt && (Date.now() - sessionEstablishedAt) < 120000)) {
        return !!(state.user && state.token);
      }
      return false;
    }
  }

  async function refreshAdminSessionQuiet() {
    if (!state.token || !apiOk()) return;
    try {
      await erpCall('refreshAdminToken', {}, { _noRetry: true });
    } catch (eRef) { /* ignore */ }
  }

  function loginDeviceLabel() {
    var ua = String(navigator.userAgent || '');
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone/iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Mobi/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  async function login() {
    if (loginInFlight) return;
    var a = t();
    var email = ($('loginEmail') && $('loginEmail').value || '').trim();
    var pass = ($('loginPass') && $('loginPass').value) || '';
    if (!email || !pass) { toast(a.noData, 'e'); return; }
    loginInFlight = true;
    var btn = document.querySelector('.login-card .btn-primary');
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    try {
      var res = await erpCall('adminLogin', { email: email, password: pass, device: loginDeviceLabel() });
      if (!res || !res.success) {
        toast((res && res.error) || a.error, 'e');
        return;
      }
      state.token = res.token;
      state.user = res.user;
      sessionEstablishedAt = Date.now();
      saveSession();
      toast(a.connected, 's');
      await initApp({ trustSession: true });
      render();
    } catch (e) {
      toast(e.message === 'API_URL' ? a.apiBanner.replace(/<[^>]+>/g, '') : e.message, 'e');
    } finally {
      loginInFlight = false;
      if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
    }
  }

  function logout(silent) {
    state.token = '';
    state.user = null;
    sessionEstablishedAt = 0;
    saveSession();
    if (!silent) toast(t().logout, 'i');
    render();
  }

  function apiErrMsg(e) {
    if (!e) return t().error;
    if (e.message === 'API_URL') return (t().apiBanner || '').replace(/<[^>]+>/g, '');
    return e.message;
  }

  async function loadViewData(opts) {
    opts = opts || {};
    if (!state.token) return;
    if (!opts.silent) {
      state.loading = true;
      renderMain();
    }
    try {
      if (state.view === 'dashboard') await loadDashboard();
      else if (state.view === 'products') {
        await Promise.all([
          loadProducts(),
          state.categories.length ? Promise.resolve() : loadCategories()
        ]);
      }
      else if (state.view === 'categories') await loadCategories();
      else if (state.view === 'orders') await loadOrders(false);
      else if (state.view === 'reviews') await loadReviews();
      else if (state.view === 'returns') await loadReturns();
      else if (state.view === 'clients') await loadClients();
      else if (state.view === 'config') {
        await loadConfig();
        await loadEmpresa();
      }
      else if (state.view === 'vitrine') await loadStorefront();
      else if (state.view === 'team') await loadAdminUsers();
      else if (state.view === 'coupons') {
        var tasks = [loadCoupons()];
        if (!state.categories.length) tasks.push(loadCategories());
        if (state.promoTab === 'banner') tasks.push(loadConfig());
        await Promise.all(tasks);
      }
    } catch (e) {
      toast(apiErrMsg(e), 'e');
    }
    state.loading = false;
    if (opts.silent && state.view === 'orders') renderOrdersPanel();
    else renderMain();
    updateNavActiveState();
  }

  function renderOrdersPanel() {
    var main = $('mainContent');
    if (!main || state.view !== 'orders' || state.loading) return;
    main.innerHTML = renderOrders();
  }

  async function loadDashboard() {
    var res = await erpCall('getDashboard', {});
    if (res && res.success) state.dashboard = res;
  }

  var loadProductsSeq = 0;

  async function loadProducts() {
    var seq = ++loadProductsSeq;
    var filters = { page: 1, pageSize: 500 };
    if (state.productFilter === 'trash') {
      filters.onlyTrash = true;
      filters.trashOnly = true;
    } else {
      filters.excludeTrash = true;
    }
    if (state.productSearch) filters.search = state.productSearch;
    var res = await erpCall('getProducts', filters);
    if (seq !== loadProductsSeq) return;
    var rows = (res && res.success && res.products) ? res.products : [];
    if (state.productFilter === 'trash') {
      rows = rows.filter(function (p) {
        return String((p && p.status) || '').toLowerCase().trim() === 'lixeira';
      });
    } else {
      rows = rows.filter(function (p) {
        return String((p && p.status) || '').toLowerCase().trim() !== 'lixeira';
      });
    }
    state.products = rows;
  }

  async function loadCategories() {
    var res = await erpCall('getCategories', {});
    state.categories = Array.isArray(res) ? res : (res && res.categories) || [];
  }

  function orderStatusLabel(code) {
    var o = t().ord || {};
    var map = {
      pending: o.stPending || 'pending',
      processing: o.stProcessing || 'processing',
      paid: o.stPaid || 'paid',
      shipped: o.stShipped || 'shipped',
      delivered: o.stDelivered || 'delivered',
      cancelled: o.stCancelled || 'cancelled',
      em_processamento: o.stProcessing || 'processing',
      preparacao: o.stProcessing || 'processing',
      enviado: o.stShipped || 'shipped',
      entregue: o.stDelivered || 'delivered',
      cancelado: o.stCancelled || 'cancelled',
      aguardando_pagamento: o.payPending || 'aguardando',
      pago: o.payPaid || 'pago',
      pago_stripe: o.payPaid || 'pago',
      reembolsado: o.payRefunded || 'reembolsado'
    };
    var k = String(code || '').toLowerCase().trim();
    return map[k] || code || '—';
  }

  function orderStatusOptions(selected) {
    var o = t().ord || {};
    var list = [
      { v: 'pending', l: o.stPending },
      { v: 'processing', l: o.stProcessing },
      { v: 'paid', l: o.stPaid },
      { v: 'shipped', l: o.stShipped },
      { v: 'delivered', l: o.stDelivered },
      { v: 'cancelled', l: o.stCancelled }
    ];
    return list.map(function (it) {
      return '<option value="' + it.v + '"' + (String(selected) === it.v ? ' selected' : '') + '>' + esc(it.l || it.v) + '</option>';
    }).join('');
  }

  function payStatusOptions(selected) {
    var o = t().ord || {};
    var list = [
      { v: 'aguardando_pagamento', l: o.payPending },
      { v: 'pending', l: o.payPending },
      { v: 'pago', l: o.payPaid },
      { v: 'pago_stripe', l: o.payStripe },
      { v: 'reembolsado', l: o.payRefunded },
      { v: 'paid', l: o.payPaid },
      { v: 'cancelled', l: o.payCancelled }
    ];
    var sel = String(selected || '').toLowerCase();
    var html = list.map(function (it) {
      return '<option value="' + it.v + '"' + (sel === it.v ? ' selected' : '') + '>' + esc(it.l || it.v) + '</option>';
    }).join('');
    if (selected && !list.some(function (it) { return it.v === sel; })) {
      html += '<option value="' + esc(selected) + '" selected>' + esc(selected) + '</option>';
    }
    return html;
  }

  function shipStatusOptions(selected) {
    var o = t().ord || {};
    var list = [
      { v: 'pending', l: o.shipPending },
      { v: 'preparacao', l: o.shipPrep },
      { v: 'em_transito', l: o.shipTransit },
      { v: 'shipped', l: o.shipShipped },
      { v: 'delivered', l: o.shipDelivered },
      { v: 'entregue', l: o.shipDelivered }
    ];
    var sel = String(selected || '').toLowerCase();
    var html = list.map(function (it) {
      return '<option value="' + it.v + '"' + (sel === it.v ? ' selected' : '') + '>' + esc(it.l || it.v) + '</option>';
    }).join('');
    if (selected && !list.some(function (it) { return it.v === sel; })) {
      html += '<option value="' + esc(selected) + '" selected>' + esc(selected) + '</option>';
    }
    return html;
  }

  async function loadOrders(append) {
    var filters = { limit: state.orderPageSize || 100 };
    if (append && state.orders.length) filters.offset = state.orders.length;
    if (state.orderFilter) filters.status = state.orderFilter;
    if (state.orderSearch) filters.search = state.orderSearch;
    var res = await erpCall('getOrders', filters);
    if (!res || !res.success) {
      if (!append) {
        state.orders = [];
        state.ordersTotal = 0;
        state.ordersError = (res && res.error) ? String(res.error) : t().error;
      }
      state.orderHasMore = false;
      return;
    }
    state.ordersError = '';
    var rows = res.orders || [];
    state.orders = append ? state.orders.concat(rows) : rows;
    state.ordersTotal = res.total != null ? res.total : state.orders.length;
    state.orderHasMore = state.orders.length < state.ordersTotal;
  }

  async function loadMoreOrders() {
    if (!state.orderHasMore || state.loading) return;
    state.loading = true;
    renderMain();
    try {
      await loadOrders(true);
    } catch (e) { toast(apiErrMsg(e), 'e'); }
    state.loading = false;
    renderOrdersPanel();
  }

  async function loadReviews() {
    var filters = {};
    if (state.reviewFilter && state.reviewFilter !== 'all') filters.estado = state.reviewFilter;
    var res = await erpCall('getAdminReviews', filters);
    state.reviews = (res && res.success && res.reviews) ? res.reviews : [];
  }

  async function loadReturns() {
    var filters = {};
    if (state.returnFilter) filters.status = state.returnFilter;
    var res = await erpCall('getReturns', filters);
    state.returns = (res && res.success && res.returns) ? res.returns : [];
  }

  async function loadEmpresa() {
    if (!isAdminUser()) {
      state.empresa = {};
      return;
    }
    try {
      var res = await erpCall('getEmpresa', {});
      state.empresa = (res && res.success && res.empresa) ? res.empresa : {};
    } catch (e) { state.empresa = {}; }
  }

  function orderStatusBadge(ord) {
    var est = String(ord.estado || '').toLowerCase();
    var pay = String(ord.estado_pagamento || '').toLowerCase();
    var cls = 'badge badge-draft';
    if (est === 'cancelled' || est === 'cancelado') cls = 'badge badge-draft';
    else if (est === 'shipped' || est === 'delivered' || est === 'enviado' || est === 'entregue') cls = 'badge badge-pub';
    else if (est === 'processing' || est === 'em_processamento' || est === 'preparacao') cls = 'badge badge-sched';
    else if (est === 'pending' || pay.indexOf('aguard') >= 0) cls = 'badge badge-sched';
    var lbl = orderStatusLabel(ord.estado);
    if (ord.estado_pagamento) lbl += ' · ' + orderStatusLabel(ord.estado_pagamento);
    return '<span class="' + cls + '">' + esc(lbl) + '</span>';
  }

  async function loadClients() {
    var filters = {};
    if (state.clientSearch) filters.search = state.clientSearch;
    var res = await erpCall('getClients', filters);
    state.clients = (res && res.success && res.clients) ? res.clients : [];
  }

  async function loadConfig() {
    var res = await erpCall('getConfigAdmin', {}, state.token);
    if (!res || !res.success) res = await erpCall('getConfig', {});
    if (res && res.success) state.config = res.config || {};
  }

  async function loadStorefront() {
    var res = await erpCall('getStoreData', {});
    if (!res || !res.success) return;
    var st = res.settings || {};
    var content = res.content || {};
    if (!content || !Object.keys(content).length) content = buildStorefrontContentFromSettings(st);
    else {
      VITRINE_LANGS.forEach(function (lg) {
        if (!content[lg]) content[lg] = {};
        if (!content[lg].svc || !content[lg].svc.length) content[lg].svc = buildSvcContentFromSettings(st, lg);
      });
    }
    var social = res.social || {};
    if (!social || !Object.keys(social).length) social = buildStorefrontSocialFromSettings(st);
    state.storefront = {
      storeName: res.storeName || st.site_name || '',
      logoUrl: res.logoUrl || st.store_logo_url || '',
      heroBgUrl: res.heroBgUrl || st.vitrine_hero_bg_url || '',
      heroMotionCanvas: st.vitrine_hero_motion_canvas == null || st.vitrine_hero_motion_canvas === '' ? '0' : String(st.vitrine_hero_motion_canvas),
      tagline: res.tagline || st.boutique_footer_tagline || '',
      colors: res.colors || { main: st.color_main || '#1a1a1a', accent: st.color_accent || '#c9a96e' },
      heroTextColors: {
        eyebrow: String(st.vitrine_hero_eyebrow_color || '').trim(),
        title: String(st.vitrine_hero_title_color || '').trim(),
        sub: String(st.vitrine_hero_sub_color || '').trim()
      },
      defaultLang: res.defaultLang || st.boutique_default_lang || 'pt',
      content: content,
      social: social,
      promoOn: st.promo_banner_enabled,
      promoText: st.promo_banner_text || '',
      promoBarDisplay: st.promo_bar_display == null || st.promo_bar_display === '' ? '1' : st.promo_bar_display,
      promoShowDefault: st.promo_banner_show_default == null || st.promo_banner_show_default === '' ? '1' : st.promo_banner_show_default,
      announcement: announcementFromSettings(st),
      promoFaixaDisplay: st.vitrine_display_promo_faixa == null || st.vitrine_display_promo_faixa === '' ? '1' : st.vitrine_display_promo_faixa,
      display: storefrontDisplayFromSettings(st)
    };
    if (!state.vitrineEditLang) state.vitrineEditLang = state.storefront.defaultLang || 'pt';
  }

  async function loadAdminUsers() {
    if (!isAdminUser()) {
      state.adminUsers = [];
      return;
    }
    var res = await erpCall('listAdminUsers', {});
    state.adminUsers = (res && res.success && res.users) ? res.users : [];
  }

  async function loadCoupons() {
    var res = await erpCall('getCoupons', {});
    state.coupons = (res && res.success && res.coupons) ? res.coupons : [];
  }

  function navIcon(id) {
    if (global.IconUi && global.IconUi.nav) return global.IconUi.nav(id);
    return '◆';
  }

  function navItems() {
    var n = t().nav;
    var items = [
      { id: 'dashboard', label: n.dashboard },
      { id: 'products', label: n.products },
      { id: 'orders', label: n.orders },
      { id: 'reviews', label: n.reviews },
      { id: 'returns', label: n.returns },
      { id: 'categories', label: n.categories },
      { id: 'clients', label: n.clients },
      { id: 'vitrine', label: n.vitrine },
      { id: 'config', label: n.config },
      { id: 'coupons', label: (n.promotions || n.coupons) }
    ];
    if (isAdminUser()) items.splice(items.length - 1, 0, { id: 'team', label: n.team });
    return items.filter(function (it) { return canAccessView(it.id); });
  }

  function viewTitle() {
    return ({
      dashboard: t().dash.title,
      products: t().prod.title,
      categories: t().cat.title,
      orders: t().ord.title,
      reviews: (t().rev && t().rev.title) || 'Reviews',
      returns: (t().ret && t().ret.title) || 'Returns',
      clients: t().cli.title,
      vitrine: (t().vit && t().vit.title) || 'Vitrine',
      team: (t().team && t().team.title) || 'Team',
      config: t().cfg.title,
      coupons: (t().promo && t().promo.title) || t().cup.title
    })[state.view] || '';
  }

  function updateNavActiveState() {
    document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(function (btn) {
      var active = btn.getAttribute('data-view') === state.view;
      btn.classList.toggle('on', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    });
    var mob = $('mobBar');
    if (mob) {
      mob.querySelectorAll('button[data-view]').forEach(function (btn) {
        var active = btn.getAttribute('data-view') === state.view;
        btn.classList.toggle('on', active);
        btn.setAttribute('aria-current', active ? 'page' : 'false');
      });
    }
    var title = $('topTitle');
    if (title) title.textContent = viewTitle();
  }

  function refreshSidebarNav() {
    var nav = document.querySelector('.sidebar-nav');
    if (nav) nav.innerHTML = renderNavHtml();
  }

  function renderNavHtml() {
    return navItems().map(function (it) {
      var active = state.view === it.id;
      return '<button type="button" class="nav-item' + (active ? ' on' : '') + '" data-view="' + it.id + '" aria-current="' + (active ? 'page' : 'false') + '" onclick="Admin.setView(\'' + it.id + '\');Admin.closeSidebar()">' +
        '<span class="nav-ico">' + navIcon(it.id) + '</span><span class="nav-lbl">' + esc(it.label) + '</span></button>';
    }).join('');
  }

  function logoError(el) {
    if (global.IconUi && global.IconUi.logoError) global.IconUi.logoError(el);
  }

  function renderLogin() {
    var a = t();
    $('app').innerHTML =
      '<div class="login-wrap">' +
      '<div class="login-card">' +
      '<img src="icons/logo.png" alt="AZAVISION" class="login-logo" onerror="Admin.logoError(this)"/>' +
      '<span class="logo-fallback-text">AZAVISION</span>' +
      '<h1>' + esc(a.loginTitle) + '</h1>' +
      (!apiOk() ? '<p class="api-warn">' + a.apiBanner + '</p>' : '') +
      '<div class="field"><label>' + esc(a.email) + '</label><input id="loginEmail" type="email" autocomplete="username"/></div>' +
      '<div class="field"><label>' + esc(a.password) + '</label><input id="loginPass" type="password" autocomplete="current-password"/></div>' +
      '<button type="button" class="btn-primary" onclick="Admin.login()">' + esc(a.loginBtn) + '</button>' +
      '<div class="lang-row">' +
      '<div class="lang-switch" role="group">' +
      ['fr', 'pt', 'en', 'es'].map(function (c) {
        return '<button type="button" id="btnLang' + c.toUpperCase() + '" class="' + (state.lang === c ? 'on' : '') + '" onclick="Admin.setLang(\'' + c + '\')">' + c.toUpperCase() + '</button>';
      }).join('') +
      '</div></div>' +
      '<div class="login-theme-row">' + themeSwitchHtml() + '</div>' +
      '</div></div>';
  }

  function renderShell() {
    var a = t();
    var userLabel = state.user ? esc(state.user.nome || state.user.email) : '';
    $('app').innerHTML =
      '<div class="admin-shell">' +
      '<div class="sidebar-overlay" id="sidebarOverlay" onclick="Admin.closeSidebar()"></div>' +
      '<aside class="sidebar" id="sidebar">' +
      '<div class="sidebar-head"><img src="icons/logo-nav.png" alt="AZAVISION" onerror="Admin.logoError(this)"/><span class="logo-fallback-text">AZAVISION</span><span>' + esc(a.appTitle) + '</span></div>' +
      '<nav class="sidebar-nav">' + renderNavHtml() + '</nav>' +
      '<button type="button" class="nav-item logout" onclick="Admin.logout()">' + esc(a.logout) + '</button>' +
      '</aside>' +
      '<div class="main-col">' +
      '<header class="topbar">' +
      '<button type="button" class="icon-btn menu-btn" onclick="Admin.toggleSidebar()" aria-label="Menu"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg></button>' +
      '<h1 class="top-title" id="topTitle"></h1>' +
      '<div class="top-right"><span class="user-pill">' + userLabel + '</span>' +
      themeSwitchHtml() +
      '<div class="lang-switch" role="group">' +
      ['fr', 'pt', 'en', 'es'].map(function (c) {
        return '<button type="button" id="btnLang' + c.toUpperCase() + '" class="' + (state.lang === c ? 'on' : '') + '" onclick="Admin.setLang(\'' + c + '\')">' + c.toUpperCase() + '</button>';
      }).join('') +
      '</div></div></header>' +
      '<main class="main" id="mainContent"></main>' +
      '</div></div>' +
      '<nav class="mob-bar" id="mobBar">' +
      '<button type="button" data-view="dashboard" class="' + (state.view === 'dashboard' ? 'on' : '') + '" aria-current="' + (state.view === 'dashboard' ? 'page' : 'false') + '" onclick="Admin.setView(\'dashboard\')"><span class="mob-ico">' + navIcon('dashboard') + '</span>' + esc(a.nav.dashboard) + '</button>' +
      '<button type="button" data-view="products" class="' + (state.view === 'products' ? 'on' : '') + '" aria-current="' + (state.view === 'products' ? 'page' : 'false') + '" onclick="Admin.setView(\'products\')"><span class="mob-ico">' + navIcon('products') + '</span>' + esc(a.nav.products) + '</button>' +
      '<button type="button" data-view="orders" class="' + (state.view === 'orders' ? 'on' : '') + '" aria-current="' + (state.view === 'orders' ? 'page' : 'false') + '" onclick="Admin.setView(\'orders\')"><span class="mob-ico">' + navIcon('orders') + '</span>' + esc(a.nav.orders) + '</button>' +
      '<button type="button" onclick="Admin.toggleSidebar()"><span class="mob-ico">' + (global.IconUi && global.IconUi.nav ? global.IconUi.nav('menu') : '☰') + '</span>' + esc(a.nav.more) + '</button>' +
      '</nav>';
  }

  function renderMain() {
    var main = $('mainContent');
    var title = $('topTitle');
    if (!main) return;
    if (title) title.textContent = viewTitle();
    if (state.loading) {
      main.innerHTML = '<p class="loading-msg">' + esc(t().loading) + '</p>';
      return;
    }
    if (!canAccessView(state.view)) {
      main.innerHTML = '<p class="api-warn">' + esc((t().team && t().team.adminOnly) || 'Apenas administradores.') + '</p>';
      return;
    }
    if (state.view === 'dashboard') main.innerHTML = renderDashboard();
    else if (state.view === 'products') main.innerHTML = proApi ? proApi.renderProducts() : renderProducts();
    else if (state.view === 'categories') main.innerHTML = renderCategories();
    else if (state.view === 'orders') main.innerHTML = renderOrders();
    else if (state.view === 'reviews') main.innerHTML = renderReviews();
    else if (state.view === 'returns') main.innerHTML = renderReturns();
    else if (state.view === 'clients') main.innerHTML = renderClients();
    else if (state.view === 'vitrine') main.innerHTML = renderVitrine();
    else if (state.view === 'team') main.innerHTML = renderTeam();
    else if (state.view === 'config') main.innerHTML = renderConfig();
    else if (state.view === 'coupons') main.innerHTML = proApi ? proApi.renderPromotions() : renderCoupons();
    if (state.view === 'vitrine') bindStorefrontAutosave();
  }

  function renderDashboard() {
    var d = t().dash;
    var k = (state.dashboard && state.dashboard.kpis) || {};
    var recent = (state.dashboard && state.dashboard.recent_orders) || [];
    var alerts = (state.dashboard && state.dashboard.stock_alerts) || [];
    return '<div class="kpi-grid">' +
      kpiCard(d.clients, k.total_clientes) +
      kpiCard(d.products, k.total_produtos) +
      kpiCard(d.orders, k.total_pedidos) +
      kpiCard(d.revenue, (k.receita_total || '0') + ' €') +
      kpiCard(d.today, (k.vendas_hoje || '0') + ' €') +
      kpiCard(d.pending, k.pedidos_pendentes) +
      '</div>' +
      '<div class="panel-grid">' +
      '<section class="panel"><h2>' + esc(d.recentOrders) + '</h2>' +
      (recent.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Date</th><th>Total</th><th></th></tr></thead><tbody>' +
        recent.map(function (o) {
          return '<tr><td>' + esc(o.pedido_id) + '</td><td>' + esc(o.data) + '</td><td>' + esc(o.total) + ' €</td>' +
            '<td><button type="button" class="btn-sm" onclick="Admin.openOrder(\'' + esc(o.pedido_id).replace(/'/g, "\\'") + '\')">' + esc(t().edit) + '</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">' + esc(t().noData) + '</p>') +
      '</section>' +
      '<section class="panel"><h2>' + esc(d.stockAlerts) + '</h2>' +
      (alerts.length ? '<ul class="alert-list">' + alerts.map(function (a) {
        return '<li>' + esc(a.produto_id || a.variante_id) + ' — ' + esc(a.quantidade) + '</li>';
      }).join('') + '</ul>' : '<p class="muted">' + esc(t().noData) + '</p>') +
      '</section></div>';
  }

  function kpiCard(label, val) {
    return '<div class="kpi-card"><span class="kpi-lbl">' + esc(label) + '</span><strong class="kpi-val">' + esc(val == null ? '—' : val) + '</strong></div>';
  }

  function renderProducts() {
    var p = t().prod;
    var rows = state.products;
    return '<div class="toolbar">' +
      '<div class="tabs">' +
      '<button type="button" class="tab' + (state.productMode === 'active' ? ' on' : '') + '" onclick="Admin.setProductMode(\'active\')">' + esc(p.active) + '</button>' +
      '<button type="button" class="tab' + (state.productMode === 'trash' ? ' on' : '') + '" onclick="Admin.setProductMode(\'trash\')">' + esc(p.trash) + '</button>' +
      '</div>' +
      '<button type="button" class="btn-ghost" onclick="Admin.syncDrive()">' + esc((t().wiz && t().wiz.syncDrive) || 'Sync Drive') + '</button>' +
      '<button type="button" class="btn-primary" onclick="Admin.editProduct(null)">' + esc(p.new) + '</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>' + esc(p.name) + '</th><th>' + esc(p.category) + '</th><th>€</th><th>' + esc(p.catalogStatus) + '</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (pr) {
        var pid = esc(pr.produto_id).replace(/'/g, "\\'");
        return '<tr><td><strong>' + esc(pr.nome) + '</strong></td><td>' + esc(pr.categoria) + '</td><td>' + esc(pr.preco_final) + '</td><td>' + esc(pr.catalogo_status || '') + '</td>' +
          '<td class="actions"><button type="button" class="btn-sm" onclick="Admin.editProduct(\'' + pid + '\')">' + esc(t().edit) + '</button>' +
          (state.productMode === 'active' ? '<button type="button" class="btn-sm danger" onclick="Admin.deleteProduct(\'' + pid + '\')">' + esc(t().delete) + '</button>' : '') +
          '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">' + esc(t().noData) + '</td></tr>') +
      '</tbody></table></div>';
  }

  function renderCategories() {
    var c = t().cat;
    return '<div class="toolbar"><button type="button" class="btn-primary" onclick="Admin.editCategory(null)">' + esc(c.new) + '</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>' + esc(c.name) + '</th><th>' + esc(c.status) + '</th><th></th></tr></thead><tbody>' +
      (state.categories.length ? state.categories.map(function (cat) {
        var id = esc(cat.category_id).replace(/'/g, "\\'");
        return '<tr><td>' + esc(cat.nome) + '</td><td>' + esc(cat.catalogo_status || 'publicado') + '</td>' +
          '<td class="actions"><button type="button" class="btn-sm" onclick="Admin.editCategory(\'' + id + '\')">' + esc(t().edit) + '</button>' +
          '<button type="button" class="btn-sm danger" onclick="Admin.removeCategory(\'' + id + '\')">' + esc(t().delete) + '</button></td></tr>';
      }).join('') : '<tr><td colspan="3" class="muted">' + esc(t().noData) + '</td></tr>') +
      '</tbody></table></div>';
  }

  function renderOrders() {
    var o = t().ord;
    var err = state.ordersError ? '<p class="api-warn">' + esc(state.ordersError) + '</p>' : '';
    var countHint = state.orders.length ? '<p class="hint-block">' + state.orders.length + (state.ordersTotal > state.orders.length ? ' / ' + state.ordersTotal + ' ' + (o.showing || '') : '') + '</p>' : '';
    var moreBtn = state.orderHasMore ? '<div class="toolbar" style="margin-top:12px;"><button type="button" class="btn-ghost" onclick="Admin.loadMoreOrders()">' + esc(o.loadMore || 'Load more') + '</button></div>' : '';
    return err + countHint + '<div class="toolbar">' +
      '<input class="search-in" placeholder="' + esc(t().search) + '" value="' + esc(state.orderSearch) + '" oninput="Admin.setOrderSearch(this.value)"/>' +
      '<select class="select-in" onchange="Admin.setOrderFilter(this.value)">' +
      '<option value=""' + (!state.orderFilter ? ' selected' : '') + '>' + esc(o.filterAll) + '</option>' +
      '<option value="pending"' + (state.orderFilter === 'pending' ? ' selected' : '') + '>' + esc(o.filterPending) + '</option>' +
      '<option value="processing"' + (state.orderFilter === 'processing' ? ' selected' : '') + '>' + esc(o.filterProcessing) + '</option>' +
      '<option value="paid"' + (state.orderFilter === 'paid' ? ' selected' : '') + '>' + esc(o.filterPaid) + '</option>' +
      '<option value="shipped"' + (state.orderFilter === 'shipped' ? ' selected' : '') + '>' + esc(o.filterShipped) + '</option>' +
      '<option value="delivered"' + (state.orderFilter === 'delivered' ? ' selected' : '') + '>' + esc(o.filterDelivered) + '</option>' +
      '<option value="cancelled"' + (state.orderFilter === 'cancelled' ? ' selected' : '') + '>' + esc(o.filterCancelled) + '</option>' +
      '</select>' +
      '<button type="button" class="btn-ghost" onclick="Admin.refreshOrders()" title="Refresh">↻</button>' +
      '<button type="button" class="btn-ghost" onclick="Admin.exportOrders()">' + esc(o.exportCsv) + '</button></div>' +
      '<div class="table-wrap"><table class="data-table ord-table"><thead><tr><th>' + esc(o.id) + '</th><th>' + esc(o.date) + '</th><th>' + esc(o.client) + '</th><th>' + esc(o.total) + '</th><th>' + esc(o.status) + '</th><th></th></tr></thead><tbody>' +
      (state.orders.length ? state.orders.map(function (ord) {
        var oid = esc(String(ord.pedido_id || '')).replace(/'/g, "\\'");
        return '<tr><td><strong>' + esc(ord.pedido_id) + '</strong></td><td>' + esc(ord.data) + '</td><td>' + esc(ord.email || ord.cliente_id) + '</td><td>' + esc(ord.total) + ' €</td><td>' + orderStatusBadge(ord) + '</td>' +
          '<td class="actions"><button type="button" class="btn-sm" onclick="Admin.openOrder(\'' + oid + '\')">' + esc(t().edit) + '</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted">' + esc(state.ordersError || t().noData) + '</td></tr>') +
      '</tbody></table></div>' + moreBtn;
  }

  var CLIENTS_RENDER_MAX = 200;

  function renderClients() {
    var c = t().cli;
    var total = state.clients.length;
    var visible = state.clients.slice(0, CLIENTS_RENDER_MAX);
    return '<div class="toolbar"><input class="search-in" placeholder="' + esc(t().search) + '" value="' + esc(state.clientSearch) + '" oninput="Admin.setClientSearch(this.value)"/></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>' + esc(c.name) + '</th><th>' + esc(c.email) + '</th><th>' + esc(c.phone) + '</th><th>' + esc(c.since) + '</th></tr></thead><tbody>' +
      (visible.length ? visible.map(function (cl) {
        return '<tr><td>' + esc(cl.nome) + '</td><td>' + esc(cl.email) + '</td><td>' + esc(cl.telefone) + '</td><td>' + esc(cl.data_registo || cl.data) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">' + esc(t().noData) + '</td></tr>') +
      '</tbody></table></div>' +
      (total > CLIENTS_RENDER_MAX ? '<p class="hint-block">' + esc(visible.length) + ' / ' + esc(total) + ' — ' + esc(t().search) + '</p>' : (total > 0 ? '<p class="hint-block">' + esc(total) + ' client(s)</p>' : ''));
  }

  function cfgVal(key, def) {
    var v = state.config[key];
    return v == null || v === '' ? (def || '') : v;
  }

  function renderConfig() {
    var c = t().cfg;
    return '<p class="hint-block">' + esc(c.subtitle) + '</p>' +
      '<form class="config-form" onsubmit="event.preventDefault();Admin.saveConfig()">' +
      '<section class="panel"><h2>' + esc(c.shipping) + '</h2>' +
      field('cfg_free_shipping', c.freeFrom, cfgVal('free_shipping_threshold', '150')) +
      field('cfg_flat', c.flatRate, cfgVal('shipping_flat_rate', '7.9')) +
      '</section>' +
      '<section class="panel"><h2>' + esc(c.payments) + '</h2>' +
      check('cfg_stripe', c.stripe, cfgVal('pay_stripe_enabled', '1')) +
      check('cfg_cod', c.cod, cfgVal('pay_cod_enabled', '1')) +
      check('cfg_show_stripe', c.showStripe, cfgVal('pay_show_stripe', '1')) +
      check('cfg_show_cod', c.showCod, cfgVal('pay_show_cod', '1')) +
      check('cfg_transfer', c.transfer || 'Transferência bancária ativa', cfgVal('pay_transfer_enabled', '1')) +
      check('cfg_show_transfer', c.showTransfer, cfgVal('pay_show_transfer', '1')) +
      field('cfg_transfer_iban', c.transferIban || 'IBAN (transferência bancária)', cfgVal('transfer_iban', ''), {
        placeholder: 'PT50 0000 0000 0000 0000 0000 0',
        help: c.transferIbanHelp || 'Obrigatório para a opção transferência aparecer no checkout. Mostrado ao cliente após a encomenda.'
      }) +
      field('cfg_transfer_holder', c.transferHolder || 'Titular da conta (opcional)', cfgVal('transfer_account_holder', ''), {
        placeholder: 'AZAVISION Lda',
        help: c.transferHolderHelp || 'Nome do titular exibido nas instruções de pagamento.'
      }) +
      field('cfg_transfer_bank', c.transferBank || 'Banco (opcional)', cfgVal('transfer_bank_name', ''), {
        placeholder: 'Millennium BCP',
        help: c.transferBankHelp || 'Nome do banco (opcional) — ajuda o cliente na transferência.'
      }) +
      check('cfg_show_mbway', c.showMbway || 'Mostrar MB Way', cfgVal('pay_show_mbway', '0')) +
      field('cfg_mbway_phone', c.mbwayPhone || 'Número MB Way', cfgVal('pay_mbway_phone', ''), {
        placeholder: '+351 912 345 678',
        help: c.mbwayPhoneHelp || 'Obrigatório para a opção MB Way aparecer no checkout.'
      }) +
      check('cfg_show_paypal', c.showPaypal || 'Mostrar PayPal', cfgVal('pay_show_paypal', '0')) +
      check('cfg_paypal', c.paypal || 'PayPal ativo', cfgVal('pay_paypal_enabled', '0')) +
      field('cfg_paypal_me', c.paypalMe || 'Ligação PayPal.Me', cfgVal('pay_paypal_me', ''), {
        placeholder: 'paypal.me/asualoja',
        help: c.paypalMeHelp || 'Obrigatório para a opção PayPal aparecer no checkout (ligação PayPal.Me).'
      }) +
      check('cfg_show_whatsapp', c.showWhatsapp || 'Mostrar pagamento WhatsApp', cfgVal('pay_show_whatsapp', '1')) +
      '<p class="field-help">' + esc(c.showWhatsappHelp || 'Utiliza o número WhatsApp definido em Contacto (cfg_whatsapp).') + '</p>' +
      check('cfg_guest_checkout', c.guestCheckout || 'Permitir compra sem conta (convidado)', cfgVal('guest_checkout_enabled', '1')) +
      '</section>' +
      '<section class="panel"><h2>' + esc(c.promo) + '</h2>' +
      check('cfg_promo_bar_display', c.promoBarShow || 'Afficher le bandeau en haut de la vitrine', cfgVal('promo_bar_display', '1')) +
      check('cfg_promo_on', c.promoOn, cfgVal('promo_banner_enabled', '0')) +
      field('cfg_promo_text', c.promoText, cfgVal('promo_banner_text', '')) +
      check('cfg_promo_show_default', c.promoShowDefault || 'Afficher le texte par défaut si la faixa est inactive', cfgVal('promo_banner_show_default', '1')) +
      '</section>' +
      '<section class="panel"><h2>' + esc(c.contact) + '</h2>' +
      field('cfg_store_email', c.storeEmail, cfgVal('store_email', '')) +
      field('cfg_contact_email', c.publicEmail, cfgVal('contact_public_email', '')) +
      field('cfg_phone', c.phone || 'Telefone (reclamações)', cfgVal('contact_phone', '')) +
      field('cfg_whatsapp', c.whatsapp, cfgVal('contact_whatsapp', '')) +
      field('cfg_lang', c.lang, cfgVal('default_lang', cfgVal('boutique_default_lang', 'pt'))) +
      '</section>' +
      '<section class="panel"><h2>' + esc(c.fiscal || 'Facturação (Facturalusa)') + '</h2>' +
      '<p class="field-help">' + esc(c.fiscalHint || 'Clé API depuis facturalusa.pt → Mon compte → API. La clé secrète Stripe (sk_…) se configure dans Google Apps Script → Propriétés du script.') + '</p>' +
      field('cfg_fiscal_provider', c.fiscalProvider || 'Fournisseur', cfgVal('fiscal_provider', 'facturalusa')) +
      check('cfg_fiscal_enabled', c.fiscalEnabled || 'Facturation certifiée activée', cfgVal('fiscal_enabled', '1')) +
      check('cfg_fiscal_emit', c.fiscalEmit || 'Émettre la fatura au paiement', cfgVal('fiscal_emit_on_payment', '1')) +
      field('cfg_fiscal_api_key', c.fiscalApiKey || 'Clé API Facturalusa', cfgVal('fiscal_api_key', ''), {
        placeholder: cfgVal('fiscal_api_key_set', '') === '1' ? '•••••• (déjà configurée — laisser vide pour conserver)' : '26830|…'
      }) +
      field('cfg_fiscal_doc_type', c.fiscalDocType || 'Type de document', cfgVal('fiscal_doc_type', 'Factura Recibo')) +
      '</section>' +
      (isAdminUser() ? renderEmpresaSection() : '') +
      '<button type="submit" class="btn-primary wide">' + esc(t().save) + '</button></form>';
  }

  function renderEmpresaSection() {
    var e = t().emp || {};
    var emp = state.empresa || {};
    function ev(key, def) {
      var v = emp[key];
      return v == null || v === '' ? (def || '') : v;
    }
    return '<section class="panel"><h2>' + esc(e.title || 'Entreprise') + '</h2>' +
      '<p class="hint-block">' + esc(e.subtitle || '') + '</p>' +
      field('emp_nome', e.name || 'Nom', ev('nome', '')) +
      field('emp_nif', e.nif || 'NIF', ev('nif', '')) +
      '<div class="fgrid">' +
      field('emp_email', e.email || 'E-mail', ev('email', '')) +
      field('emp_telefone', e.phone || 'Téléphone', ev('telefone', '')) +
      '</div>' +
      field('emp_morada', e.address || 'Adresse', ev('morada', '')) +
      '<div class="fgrid">' +
      field('emp_cidade', e.city || 'Ville', ev('cidade', '')) +
      field('emp_pais', e.country || 'Pays', ev('pais', 'Portugal')) +
      '</div>' +
      '<div class="fgrid">' +
      field('emp_website', e.website || 'Site', ev('website', '')) +
      field('emp_moeda', e.currency || 'Devise', ev('moeda', 'EUR')) +
      '</div>' +
      field('emp_tva_padrao', e.vat || 'TVA %', ev('tva_padrao', '23')) +
      '</section>';
  }

  function field(id, label, val, opts) {
    opts = opts || {};
    var placeholder = opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '';
    var help = opts.help ? '<p class="field-help">' + esc(opts.help) + '</p>' : '';
    return '<div class="field"><label>' + esc(label) + '</label><input id="' + id + '" value="' + esc(val) + '"' + placeholder + '/>' + help + '</div>';
  }

  function colorField(id, label, val, opts) {
    opts = opts || {};
    var hex = normalizeHexColor(val, opts.fallback || '#1A1A1A');
    var help = opts.help ? '<p class="field-help">' + esc(opts.help) + '</p>' : '';
    return '<div class="field"><label>' + esc(label) + '</label>' +
      '<div class="color-field">' +
      '<input type="color" class="color-picker" id="picker_' + id + '" value="' + esc(hex) + '" oninput="Admin.syncColorField(\'' + id + '\', this.value)"/>' +
      '<input id="' + id + '" value="' + esc(hex) + '" placeholder="' + esc(hex) + '" oninput="Admin.syncColorField(\'' + id + '\', this.value, true)" onchange="Admin.syncColorField(\'' + id + '\', this.value, true)"/>' +
      '</div>' + help + '</div>';
  }

  function optionalColorField(id, label, val, opts) {
    opts = opts || {};
    var hex = isHexColorValue(val) ? normalizeHexColor(val, opts.fallback || '#FFFFFF') : '';
    var pickerVal = hex || normalizeHexColor(opts.fallback || '#FFFFFF', '#FFFFFF');
    var help = opts.help ? '<p class="field-help">' + esc(opts.help) + '</p>' : '';
    return '<div class="field"><label>' + esc(label) + '</label>' +
      '<div class="color-field">' +
      '<input type="color" class="color-picker" id="picker_' + id + '" value="' + esc(pickerVal) + '" oninput="Admin.syncColorField(\'' + id + '\', this.value)"/>' +
      '<input id="' + id + '" value="' + esc(hex) + '" placeholder="' + esc(opts.placeholder || 'auto') + '" oninput="Admin.syncColorField(\'' + id + '\', this.value, true)" onchange="Admin.syncColorField(\'' + id + '\', this.value, true)"/>' +
      '<button type="button" class="btn-ghost" title="' + esc(opts.resetLabel || 'Reset') + '" onclick="Admin.clearColorField(\'' + id + '\')">✕</button>' +
      '</div>' + help + '</div>';
  }

  function clearColorField(id) {
    var input = $(id);
    if (input) input.value = '';
    scheduleStorefrontAutosave();
  }

  function syncColorField(id, value, fromText) {
    var input = $(id);
    var picker = $('picker_' + id);
    if (!input) return;
    var fallback = input.value || (picker && picker.value) || '#1A1A1A';
    if (fromText) {
      var raw = String(value || '').trim();
      if (!raw) return;
      if (raw.charAt(0) !== '#') raw = '#' + raw;
      if (!isHexColorValue(raw)) return;
      var normalized = normalizeHexColor(raw, fallback);
      input.value = normalized;
      if (picker) picker.value = normalized;
      return;
    }
    var hex = normalizeHexColor(value, fallback);
    input.value = hex;
    if (picker) picker.value = hex;
  }

  function check(id, label, val) {
    var on = val === '1' || val === 1 || String(val).toLowerCase() === 'true';
    return '<label class="check-row"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '/> ' + esc(label) + '</label>';
  }

  function vitrineExampleSet(lang) {
    return VITRINE_TEXT_EXAMPLES[lang] || VITRINE_TEXT_EXAMPLES.pt;
  }

  function vitrineExampleHelp(example) {
    if (!example) return '';
    var v = t().vit || {};
    return (v.exampleLabel || 'Exemple actuellement visible sur la vitrine :') + ' ' + example;
  }

  function vitrineDisplaySubPanel(sectionTitle, hint, checksHtml) {
    var v = t().vit || {};
    return '<div class="panel-sub"><h3 style="margin:0 0 10px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--gold)">' +
      esc(sectionTitle || v.displaySection || 'Affichage sur la vitrine client') + '</h3>' +
      (hint ? '<p class="field-help" style="margin-bottom:12px">' + esc(hint) + '</p>' : '') +
      '<div class="check-grid">' + checksHtml + '</div></div>';
  }

  function vitrineDisplayPanel() {
    var v = t().vit || {};
    var d = (state.storefront && state.storefront.display) || storefrontDisplayFromSettings({});
    return vitrineDisplaySubPanel(
      v.displayTextsSection || v.texts || 'Textos exibidos',
      v.displaySectionHint || 'Décochez pour masquer un bloc sur la boutique client. Les textes restent enregistrés.',
      check('vit_disp_hero_eye', v.showHeroEye || 'Sur-titre hero', d.heroEyebrow) +
      check('vit_disp_hero_title', v.showHeroTitle || 'Titre hero', d.heroTitle) +
      check('vit_disp_hero_sub', v.showHeroSub || 'Sous-titre hero', d.heroSub) +
      check('vit_disp_hero_btns', v.showHeroButtons || 'Boutons hero', d.heroButtons) +
      check('vit_disp_shop_hdr', v.showShopHeader || 'Titre section boutique', d.shopHeader) +
      check('vit_disp_footer_desc', v.showFooterDesc || 'Description pied de page', d.footerDesc)
    );
  }

  function vitrineServicesPanel() {
    var v = t().vit || {};
    var d = (state.storefront && state.storefront.display) || storefrontDisplayFromSettings((state.storefront && state.storefront.settings) || state.config || {});
    var svcDisp = d.svcItems || storefrontSvcDisplayFromSettings((state.storefront && state.storefront.settings) || state.config || {});
    var exPt = (VITRINE_SVC_EXAMPLES.pt || []);
    var checks = check('vit_disp_services', v.showServices || 'Afficher toute la section services (4 blocs)', d.services);
    for (var i = 0; i < VITRINE_SVC_COUNT; i++) {
      var hint = (exPt[i] && exPt[i].t) ? exPt[i].t : ('Info ' + (i + 1));
      checks += check('vit_disp_svc' + i, (v.showSvcItem || 'Afficher sur la vitrine') + ' : ' + hint, svcDisp[i]);
    }
    return '<section class="panel"><h2>' + esc(v.servicesSection || 'Bandeau services (4 infos)') + '</h2>' +
      '<p class="hint-block">' + esc(v.servicesSectionHint || 'Décochez pour masquer une information sur la page client. Les textes se modifient par langue (onglets PT/FR/EN/ES) dans la section Textes.') + '</p>' +
      '<div class="check-grid">' + checks + '</div></section>';
  }

  function vitrineServicesLangFields(c, ex) {
    var v = t().vit || {};
    var html = '<div class="panel-sub" style="margin-top:18px"><h3 style="margin:0 0 12px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--gold)">' +
      esc(v.servicesTextsSection || 'Textes du bandeau services (4 infos)') + '</h3>' +
      '<p class="field-help" style="margin-bottom:12px">' + esc(v.servicesTextsHint || 'Ex. : Envio expresso grátis / Devoluções fáceis — laissez vide pour utiliser le texte par défaut de la vitrine.') + '</p>';
    for (var i = 0; i < VITRINE_SVC_COUNT; i++) {
      var svcEx = (ex.svc && ex.svc[i]) || {};
      var cur = (c.svc && c.svc[i]) || {};
      html += '<p class="field-help" style="margin:14px 0 6px;font-weight:600">' + esc((v.svcBlock || 'Information') + ' ' + (i + 1)) + '</p>';
      html += field('vit_svc' + i + '_title', v.svcTitle || 'Titre affiché', cur.t || '', { placeholder: svcEx.t || '', help: vitrineExampleHelp(svcEx.t) });
      html += field('vit_svc' + i + '_desc', v.svcDesc || 'Description', cur.d || '', { placeholder: svcEx.d || '', help: vitrineExampleHelp(svcEx.d) });
    }
    html += '</div>';
    return html;
  }

  function vitrineLangBlock() {
    var v = t().vit || {};
    var lg = state.vitrineEditLang || 'pt';
    var sf = state.storefront || {};
    var c = (sf.content && sf.content[lg]) || {};
    var ex = vitrineExampleSet(lg);
    var langs = ['pt', 'fr', 'en', 'es'];
    return '<div class="lang-tabs">' + langs.map(function (code) {
      return '<button type="button" class="tab' + (lg === code ? ' on' : '') + '" onclick="Admin.setVitrineLang(\'' + code + '\')">' + code.toUpperCase() + '</button>';
    }).join('') + '</div>' +
      '<p class="field-help">' + esc(v.examplesNote || 'Les exemples ci-dessous reprennent les textes actuellement visibles sur la vitrine.') + '</p>' +
      field('vit_hEye', v.hEye, c.hEye || '', { placeholder: ex.hEye, help: vitrineExampleHelp(ex.hEye) }) +
      field('vit_hTitle', v.hTitle, c.hTitle || '', { placeholder: ex.hTitle, help: vitrineExampleHelp(ex.hTitle) }) +
      field('vit_hSub', v.hSub, c.hSub || '', { placeholder: ex.hSub, help: vitrineExampleHelp(ex.hSub) }) +
      '<div class="fgrid">' +
      field('vit_hBtn1', v.hBtn1, c.hBtn1 || '', { placeholder: ex.hBtn1, help: vitrineExampleHelp(ex.hBtn1) }) +
      field('vit_hBtn2', v.hBtn2, c.hBtn2 || '', { placeholder: ex.hBtn2, help: vitrineExampleHelp(ex.hBtn2) }) +
      '</div>' +
      '<div class="fgrid">' +
      field('vit_shopLabel', v.shopLabel, c.shopLabel || '', { placeholder: ex.shopLabel, help: vitrineExampleHelp(ex.shopLabel) }) +
      field('vit_shopTitle', v.shopTitle, c.shopTitle || '', { placeholder: ex.shopTitle, help: vitrineExampleHelp(ex.shopTitle) }) +
      '</div>' +
      field('vit_fDesc', v.fDesc, c.fDesc || '', { placeholder: ex.fDesc, help: vitrineExampleHelp(ex.fDesc) }) +
      vitrineServicesLangFields(c, ex);
  }

  function renderVitrine() {
    var v = t().vit || {};
    var sf = state.storefront || {};
    var colors = sf.colors || {};
    var heroTextColors = sf.heroTextColors || {};
    var ann = sf.announcement || {};
    var social = sf.social || {};
    var logoUrl = sf.logoUrl || '';
    var heroUrl = sf.heroBgUrl || '';
    var promoOn = sf.promoOn === '1' || sf.promoOn === 1 || String(sf.promoOn).toLowerCase() === 'true';
    return '<p class="hint-block">' + esc(v.subtitle) + '</p>' +
      '<form class="config-form" onsubmit="event.preventDefault();Admin.saveStorefront()">' +
      '<section class="panel"><h2>' + esc(v.brand) + '</h2>' +
      field('vit_store_name', v.storeName, sf.storeName || '') +
      '<div class="field"><label>' + esc(v.logoUpload || 'Joindre le logo') + '</label>' +
      (logoUrl ? '<div class="hero-preview logo-preview"><img id="vitLogoPreview" src="' + esc(logoUrl) + '" alt=""/></div>' : '<div class="hero-preview empty logo-preview" id="vitLogoPreviewWrap"><span>' + esc(v.logoUpload || 'Joindre le logo') + '</span></div>') +
      '<input type="file" accept="image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.bmp,.tif,.tiff,.svg,.heic,.heif,.avif,.ico" id="vit_logo_file" onchange="Admin.uploadStoreLogo(this)"/>' +
      '<p class="field-help">' + esc(v.logoFormats || v.heroFormats || 'Formats acceptes : JPG, PNG, WebP, SVG, ICO (max 8 Mo).') + '</p>' +
      '</div>' +
      field('vit_logo_url', v.logoUrl, logoUrl, {
        help: v.logoUrlHelp || 'Le logo est enregistre dans Google Drive si vous le telechargez ici, puis son URL est sauvegardee dans CONFIG.'
      }) +
      vitrineGalleryBlock('logo') +
      '<div class="field"><label>' + esc(v.heroBg) + '</label>' +
      (heroUrl ? '<div class="hero-preview"><img id="vitHeroPreview" src="' + esc(heroUrl) + '" alt=""/></div>' : '<div class="hero-preview empty" id="vitHeroPreviewWrap"><span>' + esc(v.heroUpload) + '</span></div>') +
      '<input type="file" accept="image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.bmp,.tif,.tiff,.svg,.heic,.heif,.avif,.ico" id="vit_hero_file" onchange="Admin.uploadHeroBg(this)"/>' +
      '<p class="field-help">' + esc(v.heroFormats || 'Formats acceptes : JPG, JFIF, PNG, WebP, GIF, BMP, TIFF, SVG, HEIC, HEIF, AVIF, ICO — fichiers lourds acceptes (jusqu\'a 500 Mo). Vous pouvez aussi coller une URL ci-dessous.') + '</p>' +
      field('vit_hero_bg_url', v.heroUrl, heroUrl) +
      vitrineGalleryBlock('hero_bg') +
      check('vit_hero_motion', v.heroMotion || 'Fond animé luxe (canvas particules)', (sf.heroMotionCanvas === '1' || sf.heroMotionCanvas === 1) ? '1' : '0') +
      '<p class="field-help">' + esc(v.heroMotionHelp || 'Alternative à l\'image statique : animation dorée. Utilise les couleurs marque. Une image reste possible au centre (produit / mannequin).') + '</p>' +
      '</div>' +
      '<div class="fgrid">' +
      colorField('vit_color_main', v.colorMain, colors.main || '#1A1A1A', {
        fallback: '#1A1A1A',
        help: v.colorHelp || 'Cliquez sur la pastille pour choisir une couleur, ou saisissez un code hex (#1A1A1A).'
      }) +
      colorField('vit_color_accent', v.colorAccent, colors.accent || '#C9A96E', {
        fallback: '#C9A96E',
        help: v.colorHelp || 'Cliquez sur la pastille pour choisir une couleur, ou saisissez un code hex (#C9A96E).'
      }) +
      '</div>' +
      '<div class="fgrid">' +
      optionalColorField('vit_hero_eye_color', v.heroEyeColor || 'Cor do texto — faixa (eyebrow)', heroTextColors.eyebrow || '', {
        fallback: '#C9A96E',
        placeholder: v.colorAuto || 'Automático',
        resetLabel: v.colorReset || 'Repor automático',
        help: v.heroTextColorHelp || 'Deixe vazio para usar a cor automática do tema.'
      }) +
      optionalColorField('vit_hero_title_color', v.heroTitleColor || 'Cor do texto — título', heroTextColors.title || '', {
        fallback: '#FFFFFF',
        placeholder: v.colorAuto || 'Automático',
        resetLabel: v.colorReset || 'Repor automático'
      }) +
      optionalColorField('vit_hero_sub_color', v.heroSubColor || 'Cor do texto — subtítulo', heroTextColors.sub || '', {
        fallback: '#EDEAE4',
        placeholder: v.colorAuto || 'Automático',
        resetLabel: v.colorReset || 'Repor automático'
      }) +
      '</div>' +
      field('vit_def_lang', v.defLang, sf.defaultLang || 'pt') +
      '</section>' +
      '<section class="panel"><h2>' + esc(v.texts) + '</h2>' +
      '<p class="hint-block">' + esc(v.langTab) + '</p>' +
      vitrineDisplayPanel() +
      vitrineLangBlock() +
      vitrineServicesPanel() +
      '</section>' +
      '<section class="panel"><h2>' + esc(v.social) + '</h2>' +
      vitrineDisplaySubPanel(
        v.displaySocialSection || v.social || 'Redes sociais',
        v.displaySocialHint || v.displaySectionHint,
        check('vit_disp_social', v.showSocial || 'Afficher les icônes réseaux sociaux dans le pied de page', ((state.storefront && state.storefront.display) || storefrontDisplayFromSettings({})).social)
      ) +
      '<div class="fgrid">' +
      field('vit_social_insta', v.instagram, social.instagram || '') +
      field('vit_social_fb', v.facebook, social.facebook || '') +
      '</div>' +
      '<div class="fgrid">' +
      field('vit_social_pin', v.pinterest, social.pinterest || '') +
      field('vit_social_tik', v.tiktok, social.tiktok || '') +
      '</div>' +
      '</section>' +
      '<section class="panel"><h2>' + esc(v.promo) + '</h2>' +
      '<p class="hint-block">' + esc(v.promoSectionHint || 'Contrôle ce qui s\'affiche en haut de la boutique client.') + '</p>' +
      vitrineDisplaySubPanel(
        v.displayPromoSection || v.promo || 'Faixa promocional',
        v.displayPromoHint || v.promoSectionHint,
        check('vit_promo_bar_display', v.promoBarShow || 'Afficher le bandeau en haut de la vitrine', sf.promoBarDisplay != null ? sf.promoBarDisplay : '1') +
        check('vit_disp_promo_faixa', v.showPromoFaixa || 'Afficher le contenu de la faixa promocional (texte personnalisé ou défaut)', sf.promoFaixaDisplay != null ? sf.promoFaixaDisplay : (((state.storefront && state.storefront.display) || storefrontDisplayFromSettings({})).promoFaixa))
      ) +
      check('vit_promo_on', v.promoOn || 'Faixa active (contenu personnalisé)', promoOn ? '1' : '0') +
      field('vit_promo_text', v.promoText, sf.promoText || '', {
        placeholder: vitrineExampleSet(state.vitrineEditLang || 'pt').promoText,
        help: vitrineExampleHelp(vitrineExampleSet(state.vitrineEditLang || 'pt').promoText)
      }) +
      check('vit_promo_show_default', v.promoShowDefault || 'Afficher le texte par défaut (livraison, retours…) si la faixa est inactive', sf.promoShowDefault != null ? sf.promoShowDefault : '0') +
      '<p class="field-help" style="margin:16px 0 10px"><strong>' + esc(v.annTitle || 'Campanha / Anúncio (avançado)') + '</strong></p>' +
      '<p class="hint-block">' + esc(v.annHint || 'Campanha com datas e variáveis. Se ativa et affichée, tem prioridade sobre a faixa promocional acima.') + '</p>' +
      vitrineDisplaySubPanel(
        v.displayAnnSection || v.annTitle || 'Campanha / Anúncio',
        v.displayAnnVarsHint || v.displayAnnHint || v.displaySectionHint,
        announcementVarDisplayChecks(ann, v)
      ) +
      check('vit_ann_on', v.annOn || 'Ativar campanha (contenu + dates)', ann.enabled === '1' || ann.enabled === 1 ? '1' : (ann.enabled || '0')) +
      check('vit_ann_marquee', v.annMarquee || 'Texto deslizante (marquee)', ann.marquee) +
      field('vit_ann_text', v.annText || 'Texto do anúncio', ann.text || '', {
        placeholder: '✦ {{promo_label}} · -{{pct}}% COM O CÓDIGO {{code}} ATÉ {{valid_until}} ✦',
        help: v.annTextHelp || 'Variáveis disponíveis: {{pct}}, {{pct2}}, {{code}}, {{amount}}, {{min_cart}}, {{valid_until}}, {{promo_label}}.'
      }) +
      '<div class="fgrid">' +
      field('vit_ann_label', v.annLabel || 'Título da campanha ({{promo_label}})', ann.label || '', { placeholder: 'BLACK FRIDAY' }) +
      field('vit_ann_code', v.annCode || 'Código promo ({{code}})', ann.code || '', { placeholder: 'BEMVINDO10' }) +
      '</div>' +
      '<div class="fgrid">' +
      field('vit_ann_pct', v.annPct || 'Desconto % ({{pct}})', ann.pct || '', { placeholder: '10' }) +
      field('vit_ann_pct2', v.annPct2 || '2.º desconto % ({{pct2}})', ann.pct2 || '', { placeholder: '20' }) +
      '</div>' +
      '<div class="fgrid">' +
      field('vit_ann_amount', v.annAmount || 'Remise fixa € ({{amount}})', ann.amount || '', { placeholder: '15' }) +
      field('vit_ann_min_cart', v.annMinCart || 'Carrinho mínimo € ({{min_cart}})', ann.minCart || '', { placeholder: '150' }) +
      '</div>' +
      '<div class="fgrid">' +
      field('vit_ann_start', v.annStart || 'Início (AAAA-MM-DD)', ann.dateStart || '', { placeholder: '2026-06-01' }) +
      field('vit_ann_end', v.annEnd || 'Fim (AAAA-MM-DD)', ann.dateEnd || '', { placeholder: '2026-06-30' }) +
      '</div>' +
      field('vit_ann_valid_until', v.annValidUntil || 'Validade exibida ({{valid_until}})', ann.validUntil || '', { placeholder: '30/06' }) +
      '</section>' +
      '<p class="field-help">' + esc(v.autoSaveHint || 'Les modifications sont enregistrées automatiquement après un court instant et au rafraîchissement de la page.') + '</p>' +
      '<button type="submit" class="btn-primary wide">' + esc(t().save) + '</button></form>';
  }

  function collectVitrineLangFields() {
    if (!state.storefront) state.storefront = { content: {} };
    if (!state.storefront.content) state.storefront.content = {};
    var lg = state.vitrineEditLang || 'pt';
    var svc = [];
    for (var si = 0; si < VITRINE_SVC_COUNT; si++) {
      svc.push({ t: val('vit_svc' + si + '_title'), d: val('vit_svc' + si + '_desc') });
    }
    state.storefront.content[lg] = {
      hEye: val('vit_hEye'),
      hTitle: val('vit_hTitle'),
      hSub: val('vit_hSub'),
      hBtn1: val('vit_hBtn1'),
      hBtn2: val('vit_hBtn2'),
      shopLabel: val('vit_shopLabel'),
      shopTitle: val('vit_shopTitle'),
      fDesc: val('vit_fDesc'),
      svc: svc
    };
  }

  function setVitrineLang(lg) {
    collectVitrineLangFields();
    state.vitrineEditLang = lg;
    renderMain();
  }

  function markStorefrontDirty() {
    storefrontAutosaveDirty = true;
  }

  function scheduleStorefrontAutosave(immediate) {
    if (state.view !== 'vitrine') return;
    markStorefrontDirty();
    if (storefrontAutosaveTimer) clearTimeout(storefrontAutosaveTimer);
    storefrontAutosaveTimer = setTimeout(function () {
      storefrontAutosaveTimer = 0;
      saveStorefront({ silent: true });
    }, immediate ? 120 : 900);
  }

  function bindStorefrontAutosave() {
    var main = $('mainContent');
    if (!main) return;
    var form = main.querySelector('.config-form');
    if (!form || form.dataset.autosaveBound === '1') return;
    form.dataset.autosaveBound = '1';
    form.addEventListener('input', function (ev) {
      var el = ev.target;
      if (!el || el.type === 'file') return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') scheduleStorefrontAutosave(false);
    });
    form.addEventListener('change', function (ev) {
      var el = ev.target;
      if (!el || el.type === 'file') return;
      scheduleStorefrontAutosave(true);
    });
  }

  async function uploadHeroBg(input) {
    var v = t().vit || {};
    var file = input && input.files && input.files[0];
    if (!file) return;
    var mime = resolveImageMimeType(file);
    if (!isAllowedHeroImage(file, mime)) {
      toast(v.imgTypeError || 'Format d\'image non supporté (JPEG, PNG, WebP, GIF, BMP, TIFF, SVG, HEIC, AVIF)', 'e');
      if (input) input.value = '';
      return;
    }
    if (file.size > HERO_BG_MAX_BYTES) {
      toast(v.heroSizeError || ('Image trop volumineuse (max 500 Mo). Collez une URL Google Drive dans le champ ci-dessous.'), 'e');
      if (input) input.value = '';
      return;
    }
    try {
      toast((v.uploading || t().loading) + ' ' + (file.name || '') + ' (' + formatUploadSize(file.size) + ')', 'i');
      var payload = await fileToVitrineUploadPayload(file, mime, 'hero_bg');
      var res = await uploadVitrineImageWithFallback(payload);
      if ((!res || !res.success) && file.size > HERO_BG_SINGLE_MAX_BYTES) {
        var needChunk = !res || isUnknownActionError(res.error) || isUploadSizeError(res.error) || res.error === '__chunk_api_missing__';
        if (needChunk) {
          var chunked = await uploadVitrineImageChunked(file, mime, 'hero_bg');
          if (chunked && chunked.success) res = chunked;
          else if (chunked && chunked.error !== '__chunk_api_missing__') res = chunked;
        }
      }
      if (!res || !res.success) {
        var err = (res && res.error) || t().error;
        if (err === '__chunk_api_missing__' || isUnknownActionError(err)) {
          err = v.apiDeployHint || 'Redéployez api_apps_script.gs dans Google Apps Script (Déployer → Application Web → nouvelle version).';
        }
        if (file.size > HERO_BG_SINGLE_MAX_BYTES && (isUnknownActionError(err) || /copie api_apps_script|redéployez|nova versão/i.test(err))) {
          err = (err || '') + ' ' + (v.heroSizeError || 'Pour les images > 5 Mo sans redéploiement, collez une URL Google Drive ci-dessous.');
        }
        toast(err, 'e');
        return;
      }
      syncVitrineFormToState();
      if (!state.storefront) state.storefront = {};
      state.storefront.heroBgUrl = res.url;
      var urlEl = $('vit_hero_bg_url');
      if (urlEl) urlEl.value = res.url;
      renderMain();
      toast(t().saved, 's');
    } catch (e) { toast(apiErrMsg(e), 'e'); }
    if (input) input.value = '';
  }

  async function uploadStoreLogo(input) {
    var v = t().vit || {};
    var file = input && input.files && input.files[0];
    if (!file) return;
    var mime = resolveImageMimeType(file);
    if (!isAllowedHeroImage(file, mime)) {
      toast(v.imgTypeError || 'Format d\'image non supporté', 'e');
      if (input) input.value = '';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast(v.imgSizeError || 'Image trop volumineuse (max 8 Mo)', 'e');
      if (input) input.value = '';
      return;
    }
    try {
      toast((v.uploading || t().loading) + ' ' + (file.name || ''), 'i');
      var dataUrl = await fileToBase64(file);
      var b64 = String(dataUrl).split(',')[1] || dataUrl;
      var res = await uploadVitrineImageWithFallback({
        base64: b64,
        mimeType: mime,
        fileName: file.name,
        purpose: 'logo'
      });
      if (!res || !res.success) {
        var err = (res && res.error) || t().error;
        if (isUnknownActionError(err)) {
          err = v.apiDeployHint || 'Redéployez api_apps_script.gs dans Google Apps Script (Déployer → Application Web → nouvelle version).';
        }
        toast(err, 'e');
        return;
      }
      syncVitrineFormToState();
      if (!state.storefront) state.storefront = { content: {} };
      state.storefront.logoUrl = res.url;
      var urlEl = $('vit_logo_url');
      if (urlEl) urlEl.value = res.url;
      renderMain();
      toast(t().saved, 's');
    } catch (e) {
      toast(apiErrMsg(e), 'e');
    }
    if (input) input.value = '';
  }

  function vitrineGalleryBlock(purpose) {
    var v = t().vit || {};
    var open = state.vitrineGalleryOpen === purpose;
    var html = '<div class="field" style="margin-top:6px">' +
      '<button type="button" class="btn-ghost" onclick="Admin.toggleVitrineGallery(\'' + purpose + '\')">' +
      esc(open ? (v.driveGalleryClose || 'Fechar galeria') : ('🖼 ' + (v.driveGallery || 'Galeria Drive'))) + '</button>';
    if (open) {
      if (state.vitrineGalleryLoading) {
        html += '<p class="field-help">' + esc(t().loading || 'A carregar…') + '</p>';
      } else if (!state.vitrineGalleryImages || !state.vitrineGalleryImages.length) {
        html += '<p class="field-help">' + esc(v.driveGalleryEmpty || 'Nenhuma imagem encontrada no Drive.') + '</p>';
      } else {
        html += '<p class="field-help">' + esc(v.driveGalleryHelp || 'Clique numa imagem para a usar — o URL é guardado automaticamente.') + '</p>' +
          '<div class="drive-gallery" style="margin-top:8px">' +
          state.vitrineGalleryImages.map(function (img, idx) {
            return '<button type="button" class="drive-thumb" title="' + esc(img.name || '') + '" onclick="Admin.pickVitrineImage(\'' + purpose + '\',' + idx + ')">' +
              '<img src="' + esc(img.thumbnailUrl || img.url) + '" alt="" loading="lazy"/>' +
              '<span class="drive-thumb-meta">' + esc(img.name || '') + '</span></button>';
          }).join('') + '</div>';
      }
    }
    html += '</div>';
    return html;
  }

  function syncVitrineFormToState() {
    try {
      if ($('vit_store_name')) {
        syncStorefrontDraft();
        collectVitrineLangFields();
      }
    } catch (e) { /* formulaire absent */ }
  }

  async function toggleVitrineGallery(purpose) {
    syncVitrineFormToState();
    if (state.vitrineGalleryOpen === purpose) {
      state.vitrineGalleryOpen = '';
      renderMain();
      return;
    }
    state.vitrineGalleryOpen = purpose;
    if (!state.vitrineGalleryImages || !state.vitrineGalleryImages.length) {
      state.vitrineGalleryLoading = true;
      renderMain();
      try {
        var res = await erpCall('listProductImages', { limit: 120 });
        state.vitrineGalleryImages = (res && res.success && res.images) ? res.images : [];
        if (res && !res.success) toast(res.error || t().error, 'e');
      } catch (e) {
        state.vitrineGalleryImages = [];
        toast(apiErrMsg(e), 'e');
      }
      state.vitrineGalleryLoading = false;
    }
    renderMain();
  }

  async function pickVitrineImage(purpose, idx) {
    var img = (state.vitrineGalleryImages || [])[idx];
    if (!img || !img.url) return;
    syncVitrineFormToState();
    if (!state.storefront) state.storefront = { content: {} };
    var configKey = storefrontConfigKeyForPurpose(purpose);
    var elId;
    if (purpose === 'logo') {
      state.storefront.logoUrl = img.url;
      elId = 'vit_logo_url';
    } else {
      state.storefront.heroBgUrl = img.url;
      elId = 'vit_hero_bg_url';
    }
    var el = $(elId);
    if (el) el.value = img.url;
    state.vitrineGalleryOpen = '';
    renderMain();
    if (!configKey) return;
    try {
      var patch = {};
      patch[configKey] = img.url;
      var res = await erpCall('updateConfig', patch);
      if (res && res.success) toast(t().saved, 's');
      else toast((res && res.error) || t().error, 'e');
    } catch (e) {
      toast(apiErrMsg(e), 'e');
    }
  }

  function syncStorefrontDraft() {
    if (!state.storefront) state.storefront = { content: {} };
    state.storefront.storeName = val('vit_store_name').trim();
    state.storefront.logoUrl = val('vit_logo_url').trim();
    state.storefront.heroBgUrl = val('vit_hero_bg_url').trim();
    state.storefront.heroMotionCanvas = chk('vit_hero_motion');
    state.storefront.colors = {
      main: normalizeHexColor(val('vit_color_main'), '#1A1A1A'),
      accent: normalizeHexColor(val('vit_color_accent'), '#C9A96E')
    };
    function optionalHex(id) {
      var raw = String(val(id) || '').trim();
      if (!raw) return '';
      if (raw.charAt(0) !== '#') raw = '#' + raw;
      return isHexColorValue(raw) ? raw.toUpperCase() : '';
    }
    state.storefront.heroTextColors = {
      eyebrow: optionalHex('vit_hero_eye_color'),
      title: optionalHex('vit_hero_title_color'),
      sub: optionalHex('vit_hero_sub_color')
    };
    state.storefront.defaultLang = val('vit_def_lang').trim() || 'pt';
    state.storefront.social = {
      instagram: val('vit_social_insta').trim(),
      facebook: val('vit_social_fb').trim(),
      pinterest: val('vit_social_pin').trim(),
      tiktok: val('vit_social_tik').trim()
    };
    state.storefront.promoOn = chk('vit_promo_on');
    state.storefront.promoText = val('vit_promo_text').trim();
    state.storefront.promoBarDisplay = chk('vit_promo_bar_display');
    state.storefront.promoFaixaDisplay = chk('vit_disp_promo_faixa');
    state.storefront.promoShowDefault = chk('vit_promo_show_default');
    var svcItems = [];
    for (var sdi = 0; sdi < VITRINE_SVC_COUNT; sdi++) {
      svcItems.push(chk('vit_disp_svc' + sdi));
    }
    state.storefront.display = {
      heroEyebrow: chk('vit_disp_hero_eye'),
      heroTitle: chk('vit_disp_hero_title'),
      heroSub: chk('vit_disp_hero_sub'),
      heroButtons: chk('vit_disp_hero_btns'),
      shopHeader: chk('vit_disp_shop_hdr'),
      footerDesc: chk('vit_disp_footer_desc'),
      services: chk('vit_disp_services'),
      svcItems: svcItems,
      social: chk('vit_disp_social'),
      promoFaixa: chk('vit_disp_promo_faixa')
    };
    state.storefront.announcement = {
      enabled: chk('vit_ann_on'),
      display: chk('vit_ann_display'),
      labelDisplay: chk('vit_ann_label_display'),
      pctDisplay: chk('vit_ann_pct_display'),
      pct2Display: chk('vit_ann_pct2_display'),
      codeDisplay: chk('vit_ann_code_display'),
      amountDisplay: chk('vit_ann_amount_display'),
      minCartDisplay: chk('vit_ann_min_cart_display'),
      validUntilDisplay: chk('vit_ann_valid_until_display'),
      showDefault: chk('vit_ann_show_default'),
      marquee: chk('vit_ann_marquee'),
      text: val('vit_ann_text').trim(),
      label: val('vit_ann_label').trim(),
      code: val('vit_ann_code').trim(),
      pct: val('vit_ann_pct').trim(),
      pct2: val('vit_ann_pct2').trim(),
      amount: val('vit_ann_amount').trim(),
      minCart: val('vit_ann_min_cart').trim(),
      validUntil: val('vit_ann_valid_until').trim(),
      dateStart: val('vit_ann_start').trim(),
      dateEnd: val('vit_ann_end').trim()
    };
    return state.storefront;
  }

  function postKeepalive(action, data) {
    if (!apiOk()) return;
    try {
      fetch(API, {
        method: 'POST',
        mode: 'cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, data: data || {}, token: state.token || '' })
      });
    } catch (e) { /* ignore */ }
  }

  function flushStorefrontAutosave() {
    if (!storefrontAutosaveDirty || state.view !== 'vitrine' || !state.token) return;
    collectVitrineLangFields();
    var sf = syncStorefrontDraft();
    postKeepalive('updateConfig', buildStorefrontConfigPatch(sf));
    postKeepalive('updateEmpresa', { nome: sf.storeName || '' });
    storefrontAutosaveDirty = false;
  }

  function buildStorefrontConfigPatch(sf) {
    var patch = {
      site_name: sf.storeName || '',
      store_logo_url: sf.logoUrl || '',
      color_main: (sf.colors && sf.colors.main) || '#1A1A1A',
      color_accent: (sf.colors && sf.colors.accent) || '#C9A96E',
      vitrine_hero_bg_url: sf.heroBgUrl || '',
      vitrine_hero_motion_canvas: sf.heroMotionCanvas || '0',
      vitrine_hero_eyebrow_color: (sf.heroTextColors && sf.heroTextColors.eyebrow) || '',
      vitrine_hero_title_color: (sf.heroTextColors && sf.heroTextColors.title) || '',
      vitrine_hero_sub_color: (sf.heroTextColors && sf.heroTextColors.sub) || '',
      boutique_default_lang: sf.defaultLang || 'pt',
      social_instagram: (sf.social && sf.social.instagram) || '',
      social_facebook: (sf.social && sf.social.facebook) || '',
      social_pinterest: (sf.social && sf.social.pinterest) || '',
      social_tiktok: (sf.social && sf.social.tiktok) || '',
      promo_banner_enabled: (sf.promoOn === '1' || sf.promoOn === 1 || String(sf.promoText || '').trim()) ? '1' : '0',
      promo_bar_display: sf.promoBarDisplay || '1',
      promo_banner_show_default: sf.promoShowDefault || '1',
      promo_banner_text: sf.promoText || ''
    };
    var disp = sf.display || {};
    patch.vitrine_display_hero_eyebrow = disp.heroEyebrow || '1';
    patch.vitrine_display_hero_title = disp.heroTitle || '1';
    patch.vitrine_display_hero_sub = disp.heroSub || '1';
    patch.vitrine_display_hero_buttons = disp.heroButtons || '1';
    patch.vitrine_display_shop_header = disp.shopHeader || '1';
    patch.vitrine_display_footer_desc = disp.footerDesc || '1';
    patch.vitrine_display_services = disp.services || '1';
    for (var sdi = 0; sdi < VITRINE_SVC_COUNT; sdi++) {
      patch['vitrine_display_svc' + sdi] = (disp.svcItems && disp.svcItems[sdi] != null) ? disp.svcItems[sdi] : '1';
    }
    patch.vitrine_display_social = disp.social || '1';
    patch.vitrine_display_promo_faixa = disp.promoFaixa || sf.promoFaixaDisplay || '1';
    var ann = sf.announcement || {};
    patch.announcement_enabled = ann.enabled || '0';
    patch.announcement_display = ann.display || '1';
    patch.announcement_promo_label_display = ann.labelDisplay || '1';
    patch.announcement_promo_pct_display = ann.pctDisplay || '1';
    patch.announcement_promo_pct_2_display = ann.pct2Display || '1';
    patch.announcement_promo_code_display = ann.codeDisplay || '1';
    patch.announcement_promo_amount_display = ann.amountDisplay || '1';
    patch.announcement_promo_min_cart_display = ann.minCartDisplay || '1';
    patch.announcement_promo_valid_until_display = ann.validUntilDisplay || '1';
    patch.announcement_show_default = ann.showDefault || '1';
    patch.announcement_marquee = ann.marquee || '0';
    patch.announcement_text = ann.text || '';
    patch.announcement_promo_label = ann.label || '';
    patch.announcement_promo_code = ann.code || '';
    patch.announcement_promo_pct = ann.pct || '';
    patch.announcement_promo_pct_2 = ann.pct2 || '';
    patch.announcement_promo_amount_eur = ann.amount || '';
    patch.announcement_promo_min_cart_eur = ann.minCart || '';
    patch.announcement_promo_valid_until = ann.validUntil || '';
    patch.announcement_date_start = ann.dateStart || '';
    patch.announcement_date_end = ann.dateEnd || '';
    ['pt', 'fr', 'en', 'es'].forEach(function (lg) {
      var block = (sf.content && sf.content[lg]) || {};
      if (!block || typeof block !== 'object') return;
      patch['vitrine_hero_eyebrow_' + lg] = block.hEye != null ? block.hEye : '';
      patch['vitrine_hero_title_' + lg] = block.hTitle != null ? block.hTitle : '';
      patch['vitrine_hero_sub_' + lg] = block.hSub != null ? block.hSub : '';
      patch['vitrine_hero_btn1_' + lg] = block.hBtn1 != null ? block.hBtn1 : '';
      patch['vitrine_hero_btn2_' + lg] = block.hBtn2 || '';
      patch['vitrine_shop_label_' + lg] = block.shopLabel != null ? block.shopLabel : '';
      patch['vitrine_shop_title_' + lg] = block.shopTitle != null ? block.shopTitle : '';
      patch['vitrine_footer_desc_' + lg] = block.fDesc != null ? block.fDesc : '';
      if (block.svc && block.svc.length) {
        for (var si = 0; si < VITRINE_SVC_COUNT; si++) {
          var svcItem = block.svc[si] || {};
          patch['vitrine_svc' + si + '_title_' + lg] = svcItem.t != null ? svcItem.t : '';
          patch['vitrine_svc' + si + '_desc_' + lg] = svcItem.d != null ? svcItem.d : '';
        }
      }
    });
    return patch;
  }

  async function saveStorefrontWithFallback(sf) {
    var patch = buildStorefrontConfigPatch(sf);
    var cfgRes = await erpCall('updateConfig', patch);
    if (!cfgRes || !cfgRes.success) {
      if (!isUnknownActionError((cfgRes && cfgRes.error) || '')) return cfgRes || { success: false, error: t().error };
    } else {
      try { await erpCall('updateEmpresa', { nome: sf.storeName || '' }); } catch (eEmp) { /* ignore */ }
    }

    var payload = {
      storeName: sf.storeName,
      logoUrl: sf.logoUrl,
      heroBgUrl: sf.heroBgUrl,
      vitrine_hero_motion_canvas: sf.heroMotionCanvas || '0',
      color_main: sf.colors.main,
      color_accent: sf.colors.accent,
      heroEyebrowColor: (sf.heroTextColors && sf.heroTextColors.eyebrow) || '',
      heroTitleColor: (sf.heroTextColors && sf.heroTextColors.title) || '',
      heroSubColor: (sf.heroTextColors && sf.heroTextColors.sub) || '',
      defaultLang: sf.defaultLang,
      social_instagram: sf.social.instagram,
      social_facebook: sf.social.facebook,
      social_pinterest: sf.social.pinterest,
      social_tiktok: sf.social.tiktok,
      promo_banner_enabled: sf.promoOn,
      promo_bar_display: sf.promoBarDisplay,
      promo_banner_show_default: sf.promoShowDefault,
      promo_banner_text: sf.promoText,
      announcement_enabled: (sf.announcement && sf.announcement.enabled) || '0',
      announcement_display: (sf.announcement && sf.announcement.display) || '1',
      announcement_show_default: (sf.announcement && sf.announcement.showDefault) || '1',
      announcement_marquee: (sf.announcement && sf.announcement.marquee) || '0',
      announcement_text: (sf.announcement && sf.announcement.text) || '',
      announcement_promo_label: (sf.announcement && sf.announcement.label) || '',
      announcement_promo_code: (sf.announcement && sf.announcement.code) || '',
      announcement_promo_pct: (sf.announcement && sf.announcement.pct) || '',
      announcement_promo_pct_2: (sf.announcement && sf.announcement.pct2) || '',
      announcement_promo_amount_eur: (sf.announcement && sf.announcement.amount) || '',
      announcement_promo_min_cart_eur: (sf.announcement && sf.announcement.minCart) || '',
      announcement_promo_valid_until: (sf.announcement && sf.announcement.validUntil) || '',
      announcement_date_start: (sf.announcement && sf.announcement.dateStart) || '',
      announcement_date_end: (sf.announcement && sf.announcement.dateEnd) || '',
      vitrine_display_hero_eyebrow: (sf.display && sf.display.heroEyebrow) || '1',
      vitrine_display_hero_title: (sf.display && sf.display.heroTitle) || '1',
      vitrine_display_hero_sub: (sf.display && sf.display.heroSub) || '1',
      vitrine_display_hero_buttons: (sf.display && sf.display.heroButtons) || '1',
      vitrine_display_shop_header: (sf.display && sf.display.shopHeader) || '1',
      vitrine_display_footer_desc: (sf.display && sf.display.footerDesc) || '1',
      vitrine_display_services: (sf.display && sf.display.services) || '1',
      vitrine_display_svc0: (sf.display && sf.display.svcItems && sf.display.svcItems[0]) || '1',
      vitrine_display_svc1: (sf.display && sf.display.svcItems && sf.display.svcItems[1]) || '1',
      vitrine_display_svc2: (sf.display && sf.display.svcItems && sf.display.svcItems[2]) || '1',
      vitrine_display_svc3: (sf.display && sf.display.svcItems && sf.display.svcItems[3]) || '1',
      vitrine_display_social: (sf.display && sf.display.social) || '1',
      vitrine_display_promo_faixa: (sf.display && sf.display.promoFaixa) || sf.promoFaixaDisplay || '1',
      announcement_promo_label_display: (sf.announcement && sf.announcement.labelDisplay) || '1',
      announcement_promo_pct_display: (sf.announcement && sf.announcement.pctDisplay) || '1',
      announcement_promo_pct_2_display: (sf.announcement && sf.announcement.pct2Display) || '1',
      announcement_promo_code_display: (sf.announcement && sf.announcement.codeDisplay) || '1',
      announcement_promo_amount_display: (sf.announcement && sf.announcement.amountDisplay) || '1',
      announcement_promo_min_cart_display: (sf.announcement && sf.announcement.minCartDisplay) || '1',
      announcement_promo_valid_until_display: (sf.announcement && sf.announcement.validUntilDisplay) || '1',
      content: sf.content
    };
    var res = await erpCall('updateStorefront', payload);
    if (res && res.success) return res;
    var err = (res && res.error) || '';
    if (!isUnknownActionError(err)) {
      if (cfgRes && cfgRes.success) return { success: true, fallback: true };
      return res;
    }

    var legacyRes = await erpCall('updateStoreDesign', payload);
    if (legacyRes && legacyRes.success) return legacyRes;
    err = (legacyRes && legacyRes.error) || err;
    if (!isUnknownActionError(err) && !(cfgRes && cfgRes.success)) return legacyRes;

    if (cfgRes && cfgRes.success) return { success: true, fallback: true };
    return cfgRes || { success: false, error: err || t().error };
  }

  async function saveStorefront(opts) {
    opts = opts || {};
    collectVitrineLangFields();
    var sf = syncStorefrontDraft();
    if (storefrontAutosaveInFlight) {
      storefrontAutosaveQueued = true;
      return;
    }
    storefrontAutosaveInFlight = true;
    try {
      var res = await saveStorefrontWithFallback(sf);
      if (!res || !res.success) {
        var errMsg = (res && res.error) || t().error;
        if (!opts.silent || isNoAuthResponse(res) || isSpreadsheetBindingError(errMsg)) {
          toast(errMsg, 'e');
        }
        return;
      }
      storefrontAutosaveDirty = false;
      await loadStorefront();
      if (!opts.silent) {
        toast(t().saved, 's');
        renderMain();
      }
    } catch (e) {
      if (!opts.silent) toast(apiErrMsg(e), 'e');
    } finally {
      storefrontAutosaveInFlight = false;
      if (storefrontAutosaveQueued) {
        storefrontAutosaveQueued = false;
        scheduleStorefrontAutosave(true);
      }
    }
  }

  function isSelfAdminUser(u) {
    if (!u || !state.user) return false;
    if (u.user_id && state.user.user_id && String(u.user_id) === String(state.user.user_id)) return true;
    var e1 = String(u.email || '').trim().toLowerCase();
    var e2 = String(state.user.email || '').trim().toLowerCase();
    return !!(e1 && e2 && e1 === e2);
  }

  function countActiveAdmins() {
    return state.adminUsers.filter(function (x) {
      return String(x.role || '').toLowerCase() === 'admin' && String(x.status || 'ativo').toLowerCase() === 'ativo';
    }).length;
  }

  function reviewStatusLabel(st) {
    var r = t().rev || {};
    var k = String(st || '').toLowerCase();
    if (k === 'aprovado') return r.stApproved || 'aprovado';
    if (k === 'rejeitado') return r.stRejected || 'rejeitado';
    return r.stPending || 'pendente';
  }

  function returnStatusLabel(st) {
    var r = t().ret || {};
    var k = String(st || '').toLowerCase();
    if (k === 'approved') return r.stApproved || 'approved';
    if (k === 'received') return r.stReceived || 'received';
    if (k === 'refunded') return r.stRefunded || 'refunded';
    if (k === 'rejected') return r.stRejected || 'rejected';
    return r.stRequested || 'requested';
  }

  function renderReviews() {
    var r = t().rev || {};
    return '<p class="hint-block">' + esc(r.subtitle || '') + '</p>' +
      '<div class="toolbar"><select class="select-in" onchange="Admin.setReviewFilter(this.value)">' +
      '<option value="all"' + (state.reviewFilter === 'all' ? ' selected' : '') + '>' + esc(r.filterAll || 'All') + '</option>' +
      '<option value="pendente"' + (state.reviewFilter === 'pendente' ? ' selected' : '') + '>' + esc(r.filterPending || 'Pending') + '</option>' +
      '<option value="aprovado"' + (state.reviewFilter === 'aprovado' ? ' selected' : '') + '>' + esc(r.filterApproved || 'Approved') + '</option>' +
      '<option value="rejeitado"' + (state.reviewFilter === 'rejeitado' ? ' selected' : '') + '>' + esc(r.filterRejected || 'Rejected') + '</option>' +
      '</select><button type="button" class="btn-ghost" onclick="Admin.refreshReviews()">↻</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>' + esc(r.product) + '</th><th>' + esc(r.rating) + '</th><th>' + esc(r.comment) + '</th><th>' + esc(r.date) + '</th><th>' + esc(r.status) + '</th><th></th></tr></thead><tbody>' +
      (state.reviews.length ? state.reviews.map(function (rv) {
        var id = esc(rv.avaliacao_id || '').replace(/'/g, "\\'");
        var st = String(rv.estado || 'pendente').toLowerCase();
        var actions = '';
        if (st === 'pendente' || st === 'rejeitado') {
          actions += '<button type="button" class="btn-sm" onclick="Admin.approveReview(\'' + id + '\')">' + esc(r.approve) + '</button> ';
        }
        if (st === 'pendente' || st === 'aprovado') {
          actions += '<button type="button" class="btn-sm" onclick="Admin.rejectReview(\'' + id + '\')">' + esc(r.reject) + '</button> ';
        }
        actions += '<button type="button" class="btn-sm danger" onclick="Admin.deleteReview(\'' + id + '\')">' + esc(t().delete) + '</button>';
        return '<tr><td>' + esc(rv.produto_id) + '</td><td>' + esc(rv.nota) + '/5</td><td style="max-width:220px;">' + esc(rv.comentario) + '</td><td>' + esc(rv.data) + '</td><td>' + esc(reviewStatusLabel(rv.estado)) + '</td><td class="actions">' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted">' + esc(t().noData) + '</td></tr>') +
      '</tbody></table></div>';
  }

  function renderReturns() {
    var r = t().ret || {};
    return '<p class="hint-block">' + esc(r.subtitle || '') + '</p>' +
      '<div class="toolbar">' +
      '<select class="select-in" onchange="Admin.setReturnFilter(this.value)">' +
      '<option value=""' + (!state.returnFilter ? ' selected' : '') + '>' + esc(r.filterAll || 'All') + '</option>' +
      '<option value="requested"' + (state.returnFilter === 'requested' ? ' selected' : '') + '>' + esc(r.filterRequested || 'Requested') + '</option>' +
      '<option value="approved"' + (state.returnFilter === 'approved' ? ' selected' : '') + '>' + esc(r.filterApproved || 'Approved') + '</option>' +
      '<option value="received"' + (state.returnFilter === 'received' ? ' selected' : '') + '>' + esc(r.filterReceived || 'Received') + '</option>' +
      '<option value="refunded"' + (state.returnFilter === 'refunded' ? ' selected' : '') + '>' + esc(r.filterRefunded || 'Refunded') + '</option>' +
      '<option value="rejected"' + (state.returnFilter === 'rejected' ? ' selected' : '') + '>' + esc(r.filterRejected || 'Rejected') + '</option>' +
      '</select>' +
      '<button type="button" class="btn-primary" onclick="Admin.newReturnModal()">' + esc(r.newReturn || 'New') + '</button>' +
      '<button type="button" class="btn-ghost" onclick="Admin.refreshReturns()">↻</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>' + esc(r.orderId) + '</th><th>' + esc(r.client) + '</th><th>' + esc(r.product) + '</th><th>' + esc(r.reason) + '</th><th>' + esc(r.status) + '</th><th></th></tr></thead><tbody>' +
      (state.returns.length ? state.returns.map(function (rt) {
        var rid = esc(rt.return_id || '').replace(/'/g, "\\'");
        return '<tr><td><strong>' + esc(rt.return_id) + '</strong></td><td>' + esc(rt.order_id) + '</td><td>' + esc(rt.client_email || rt.client_id) + '</td><td>' + esc(rt.product) + ' ×' + esc(rt.qty) + '</td><td>' + esc(rt.reason) + '</td><td>' + esc(returnStatusLabel(rt.status)) + '</td>' +
          '<td class="actions"><button type="button" class="btn-sm" onclick="Admin.editReturn(\'' + rid + '\')">' + esc(t().edit) + '</button></td></tr>';
      }).join('') : '<tr><td colspan="7" class="muted">' + esc(t().noData) + '</td></tr>') +
      '</tbody></table></div>';
  }

  function setReviewFilter(f) {
    state.reviewFilter = f || 'all';
    loadViewData({ silent: true });
  }

  function setReturnFilter(f) {
    state.returnFilter = f || '';
    loadViewData({ silent: true });
  }

  function refreshReviews() {
    if (state.view !== 'reviews') setView('reviews');
    else loadViewData({ silent: false });
  }

  function refreshReturns() {
    if (state.view !== 'returns') setView('returns');
    else loadViewData({ silent: false });
  }

  async function approveReview(id) {
    if (!id) return;
    try {
      var res = await erpCall('approveReview', { id: id });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      await loadReviews();
      renderMain();
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  async function rejectReview(id) {
    if (!id) return;
    try {
      var res = await erpCall('rejectReview', { id: id });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      await loadReviews();
      renderMain();
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  async function deleteReview(id) {
    var r = t().rev || {};
    if (!id || !global.confirm(r.confirmDelete || t().delete + '?')) return;
    try {
      var res = await erpCall('deleteReview', { id: id });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      await loadReviews();
      renderMain();
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  function newReturnModal() {
    var r = t().ret || {};
    openModal(
      '<div class="modal-inner"><h2>' + esc(r.newReturn) + '</h2>' +
      field('ret_order_id', r.orderId, '') +
      field('ret_product', r.product, '') +
      field('ret_qty', r.qty, '1') +
      field('ret_reason', r.reason, '') +
      '<div class="field"><label>' + esc(r.notes) + '</label><textarea id="ret_notes" rows="2"></textarea></div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" onclick="Admin.closeModal()">' + esc(t().cancel) + '</button>' +
      '<button type="button" class="btn-primary" onclick="Admin.saveNewReturn()">' + esc(t().save) + '</button></div></div>'
    );
  }

  async function saveNewReturn() {
    var r = t().ret || {};
    var payload = {
      order_id: val('ret_order_id'),
      product: val('ret_product'),
      qty: parseInt(val('ret_qty'), 10) || 1,
      reason: val('ret_reason'),
      notes: val('ret_notes')
    };
    if (!payload.order_id) { toast(t().error, 'e'); return; }
    try {
      var res = await erpCall('createReturn', payload);
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(r.created || t().saved, 's');
      closeModal();
      await loadReturns();
      renderMain();
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  function editReturn(returnId) {
    var r = t().ret || {};
    var rt = state.returns.find(function (x) { return x.return_id === returnId; });
    if (!rt) return;
    var rid = esc(returnId).replace(/'/g, "\\'");
    openModal(
      '<div class="modal-inner"><h2>' + esc(r.updateStatus) + ' — ' + esc(returnId) + '</h2>' +
      '<p class="hint-block">' + esc(rt.order_id) + ' · ' + esc(rt.client_email || '') + '</p>' +
      '<p style="font-size:11px;">' + esc(rt.product) + ' — ' + esc(rt.reason) + '</p>' +
      '<div class="field"><label>' + esc(r.status) + '</label><select id="ret_status">' +
      ['requested', 'approved', 'received', 'refunded', 'rejected'].map(function (s) {
        return '<option value="' + s + '"' + (String(rt.status) === s ? ' selected' : '') + '>' + esc(returnStatusLabel(s)) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" onclick="Admin.closeModal()">' + esc(t().cancel) + '</button>' +
      '<button type="button" class="btn-primary" onclick="Admin.saveReturnStatus(\'' + rid + '\')">' + esc(t().save) + '</button></div></div>'
    );
  }

  async function saveReturnStatus(returnId) {
    try {
      var res = await erpCall('updateReturnStatus', { return_id: returnId, status: val('ret_status') });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      closeModal();
      await loadReturns();
      renderMain();
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  async function changeAdminPassword() {
    var tm = t().team || {};
    var oldP = val('pwd_old');
    var newP = val('pwd_new');
    var newP2 = val('pwd_new2');
    if (!oldP || !newP) { toast(tm.passwordHelp || t().error, 'e'); return; }
    if (newP.length < 6) { toast(tm.passwordHelp || t().error, 'e'); return; }
    if (newP !== newP2) { toast(t().error, 'e'); return; }
    try {
      var res = await erpCall('adminChangePassword', { old: oldP, new: newP });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(tm.changePwdOk || t().saved, 's');
      $('pwd_old').value = '';
      $('pwd_new').value = '';
      $('pwd_new2').value = '';
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  function renderTeam() {
    var tm = t().team || {};
    if (!isAdminUser()) {
      return '<p class="api-warn">' + esc(tm.adminOnly) + '</p>';
    }
    var navLabels = t().nav || {};
    var staffViews = STAFF_ALLOWED_VIEWS.map(function (v) { return navLabels[v === 'coupons' ? 'promotions' : v] || navLabels[v] || v; }).join(', ');
    return '<p class="hint-block">' + esc(tm.subtitle) + '</p>' +
      '<section class="panel"><h2>' + esc(tm.changePwdTitle || 'Mot de passe') + '</h2>' +
      field('pwd_old', tm.oldPassword || 'Ancien', '', { help: tm.passwordHelp }) +
      field('pwd_new', tm.newPasswordSelf || 'Nouveau', '') +
      field('pwd_new2', tm.newPasswordSelf || 'Confirmer', '') +
      '<button type="button" class="btn-primary" onclick="Admin.changeAdminPassword()">' + esc(tm.changePwdBtn || t().save) + '</button></section>' +
      '<section class="panel"><h2>' + esc(tm.accessTitle || 'Acessos por função') + '</h2>' +
      '<p class="field-help"><strong>' + esc(tm.roleAdmin || 'Administrador') + '</strong> — ' + esc(tm.accessAdmin || 'Acesso total: tudo + Conteúdo da vitrine, Configuração e Equipa admin.') + '</p>' +
      '<p class="field-help"><strong>' + esc(tm.roleStaff || 'Pessoal') + '</strong> — ' + esc(tm.accessStaff || 'Acesso operacional:') + ' ' + esc(staffViews) + '</p>' +
      '</section>' +
      '<div class="toolbar"><button type="button" class="btn-primary" onclick="Admin.editAdminUser(null)">' + esc(tm.newUser) + '</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>' + esc(tm.name) + '</th><th>' + esc(tm.email) + '</th><th>' + esc(tm.role) + '</th><th>' + esc(tm.status) + '</th><th>' + esc(tm.createdAt || 'Criado em') + '</th><th></th></tr></thead><tbody>' +
      (state.adminUsers.length ? state.adminUsers.map(function (u) {
        var uid = esc(u.user_id).replace(/'/g, "\\'");
        var roleLbl = u.role === 'admin' ? (tm.roleAdmin || 'admin') : (tm.roleStaff || 'staff');
        var active = String(u.status || 'ativo').toLowerCase() === 'ativo';
        var stLbl = active ? (tm.statusActive || 'ativo') : (tm.statusInactive || 'inativo');
        var self = isSelfAdminUser(u);
        var toggleBtn = '';
        if (!self) {
          toggleBtn = ' <button type="button" class="btn-sm' + (active ? ' danger' : '') + '" onclick="Admin.toggleAdminUserStatus(\'' + uid + '\')">' +
            esc(active ? (tm.deactivate || 'Desativar') : (tm.activate || 'Ativar')) + '</button>';
        }
        return '<tr><td>' + esc(u.nome) + (self ? ' <span class="muted">(' + esc(tm.you || 'você') + ')</span>' : '') + '</td>' +
          '<td>' + esc(u.email) + '</td><td>' + esc(roleLbl) + '</td><td>' + esc(stLbl) + '</td>' +
          '<td>' + esc(u.data_criacao || '—') + '</td>' +
          '<td><button type="button" class="btn-sm" onclick="Admin.editAdminUser(\'' + uid + '\')">' + esc(t().edit) + '</button>' + toggleBtn + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted">' + esc(t().noData) + '</td></tr>') +
      '</tbody></table></div>';
  }

  async function toggleAdminUserStatus(userId) {
    var tm = t().team || {};
    if (!isAdminUser()) { toast(tm.adminOnly, 'e'); return; }
    var u = state.adminUsers.find(function (x) { return x.user_id === userId; });
    if (!u) return;
    if (isSelfAdminUser(u)) { toast(tm.cantSelf || 'Não pode desativar a sua própria conta.', 'e'); return; }
    var active = String(u.status || 'ativo').toLowerCase() === 'ativo';
    if (active && String(u.role || '').toLowerCase() === 'admin' && countActiveAdmins() <= 1) {
      toast(tm.lastAdmin || 'Impossível desativar o último administrador ativo.', 'e');
      return;
    }
    try {
      var res = await erpCall('updateAdminUser', { user_id: userId, status: active ? 'inativo' : 'ativo' });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      await loadAdminUsers();
      renderMain();
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  function editAdminUser(userId) {
    var tm = t().team || {};
    if (!isAdminUser()) { toast(tm.adminOnly, 'e'); return; }
    var u = null;
    if (userId) u = state.adminUsers.find(function (x) { return x.user_id === userId; });
    var isNew = !u;
    var self = u ? isSelfAdminUser(u) : false;
    var emailField = isNew
      ? field('au_email', tm.email, '')
      : '<div class="field"><label>' + esc(tm.email) + '</label><input id="au_email" value="' + esc(u.email || '') + '" disabled/>' +
        '<p class="field-help">' + esc(tm.emailLocked || 'O e-mail não pode ser alterado. Crie uma nova conta se necessário.') + '</p></div>';
    openModal(
      '<div class="modal-inner"><h2>' + esc(isNew ? tm.newUser : tm.editUser) + '</h2>' +
      '<input type="hidden" id="au_id" value="' + esc(u ? u.user_id : '') + '"/>' +
      field('au_nome', tm.name, u ? u.nome : '') +
      emailField +
      field('au_pass', isNew ? tm.password : tm.newPassword, '', { help: tm.passwordHelp || 'Mínimo 6 caracteres.' }) +
      '<div class="field"><label>' + esc(tm.role) + '</label><select id="au_role">' +
      '<option value="staff"' + (!u || u.role !== 'admin' ? ' selected' : '') + '>' + esc(tm.roleStaff) + '</option>' +
      '<option value="admin"' + (u && u.role === 'admin' ? ' selected' : '') + '>' + esc(tm.roleAdmin) + '</option></select>' +
      '<p class="field-help">' + esc(tm.roleHelp || 'Administrador: acesso total. Pessoal: sem Vitrine, Configuração nem Equipa admin.') + '</p></div>' +
      '<div class="field"><label>' + esc(tm.status) + '</label><select id="au_status"' + (self ? ' disabled' : '') + '>' +
      '<option value="ativo"' + (!u || String(u.status).toLowerCase() === 'ativo' ? ' selected' : '') + '>' + esc(tm.statusActive) + '</option>' +
      '<option value="inativo"' + (u && String(u.status).toLowerCase() === 'inativo' ? ' selected' : '') + '>' + esc(tm.statusInactive) + '</option></select>' +
      (self ? '<p class="field-help">' + esc(tm.cantSelf || 'Não pode desativar a sua própria conta.') + '</p>' : '') + '</div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" onclick="Admin.closeModal()">' + esc(t().cancel) + '</button>' +
      '<button type="button" class="btn-primary" onclick="Admin.saveAdminUser()">' + esc(t().save) + '</button></div></div>'
    );
  }

  async function saveAdminUser() {
    var tm = t().team || {};
    if (!isAdminUser()) { toast(tm.adminOnly, 'e'); return; }
    var id = val('au_id');
    var payload = {
      nome: val('au_nome'),
      email: val('au_email'),
      password: val('au_pass'),
      role: val('au_role'),
      status: val('au_status')
    };
    if (payload.password && String(payload.password).length < 6) {
      toast(tm.passwordHelp || 'Mínimo 6 caracteres.', 'e');
      return;
    }
    if (id) {
      var current = state.adminUsers.find(function (x) { return x.user_id === id; });
      var wasActiveAdmin = current && String(current.role || '').toLowerCase() === 'admin' && String(current.status || 'ativo').toLowerCase() === 'ativo';
      var staysActiveAdmin = payload.role === 'admin' && payload.status === 'ativo';
      if (wasActiveAdmin && !staysActiveAdmin && countActiveAdmins() <= 1) {
        toast(tm.lastAdmin || 'Impossível desativar o último administrador ativo.', 'e');
        return;
      }
      if (current && isSelfAdminUser(current) && payload.status === 'inativo') {
        toast(tm.cantSelf || 'Não pode desativar a sua própria conta.', 'e');
        return;
      }
    }
    try {
      var res;
      if (id) {
        payload.user_id = id;
        delete payload.email;
        if (!payload.password) delete payload.password;
        res = await erpCall('updateAdminUser', payload);
      } else {
        if (!payload.email || !payload.password) { toast(tm.password, 'e'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email).trim())) {
          toast(tm.invalidEmail || 'E-mail inválido.', 'e');
          return;
        }
        res = await erpCall('createAdminUser', payload);
      }
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      closeModal();
      toast(!id ? (tm.created || t().saved) : t().saved, 's');
      await loadAdminUsers();
      renderMain();
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  function renderCoupons() {
    var c = t().cup;
    return '<div class="toolbar"><button type="button" class="btn-primary" onclick="Admin.editCoupon(null)">' + esc(c.new) + '</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>' + esc(c.code) + '</th><th>' + esc(c.type) + '</th><th>' + esc(c.value) + '</th><th></th></tr></thead><tbody>' +
      (state.coupons.length ? state.coupons.map(function (cup) {
        var id = esc(cup.cupon_id || cup.cupom_id || cup.codigo).replace(/'/g, "\\'");
        return '<tr><td><strong>' + esc(cup.codigo) + '</strong></td><td>' + esc(cup.tipo) + '</td><td>' + esc(cup.valor) + '</td>' +
          '<td><button type="button" class="btn-sm danger" onclick="Admin.removeCoupon(\'' + id + '\')">' + esc(t().delete) + '</button></td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">' + esc(t().noData) + '</td></tr>') +
      '</tbody></table></div>';
  }

  function setProductMode(m) {
    var map = { active: 'all', trash: 'trash' };
    setProductFilter(map[m] || m || 'all');
  }

  function setProductFilter(m) {
    if (proApi) return proApi.setProductFilter(m);
    state.productFilter = m;
    loadViewData();
  }

  var _searchT;
  function setOrderSearch(v) {
    state.orderSearch = v;
    clearTimeout(_searchT);
    _searchT = setTimeout(function () { loadViewData({ silent: true }); }, 550);
  }

  function setOrderFilter(v) {
    state.orderFilter = v;
    loadViewData({ silent: true });
  }

  function refreshOrders() {
    if (state.view !== 'orders') {
      setView('orders');
      return;
    }
    loadViewData({ silent: false });
  }

  function setClientSearch(v) {
    state.clientSearch = v;
    clearTimeout(_searchT);
    _searchT = setTimeout(loadViewData, 400);
  }

  function categoryOptions(selected) {
    return state.categories.map(function (c) {
      return '<option value="' + esc(c.nome) + '"' + (c.nome === selected ? ' selected' : '') + '>' + esc(c.nome) + '</option>';
    }).join('');
  }

  async function editProduct(id) {
    if (global.ProductWizard) {
      return global.ProductWizard.open(id);
    }
    await loadCategories();
    var p = t().prod;
    var pr = null;
    if (id) {
      var res = await erpCall('getProduct', { id: id });
      if (res && res.success) pr = res.product;
    }
    var f = pr || { nome: '', descricao: '', categoria: '', preco_ht: '', tva: '23', imagem: '', catalogo_status: 'publicado', gerir_stock: '1', prazo_entrega_dias: '3' };
    var v0 = (pr && pr.variantes && pr.variantes[0]) || {};
    openModal(
      '<div class="modal-inner"><h2>' + esc(pr ? t().edit : p.new) + '</h2>' +
      '<div class="field"><label>' + esc(p.name) + '</label><input id="pf_nome" value="' + esc(f.nome) + '"/></div>' +
      '<div class="field"><label>' + esc(p.desc) + '</label><textarea id="pf_desc">' + esc(f.descricao) + '</textarea></div>' +
      '<div class="field"><label>' + esc(p.category) + '</label><select id="pf_cat"><option value="">—</option>' + categoryOptions(f.categoria) + '</select></div>' +
      '<div class="fgrid"><div class="field"><label>' + esc(p.priceHt) + '</label><input id="pf_ht" type="number" step="0.01" value="' + esc(f.preco_ht || f.preco_final) + '"/></div>' +
      '<div class="field"><label>' + esc(p.tva) + '</label><input id="pf_tva" type="number" value="' + esc(f.tva || '23') + '"/></div></div>' +
      '<div class="field"><label>' + esc(p.image) + '</label><input id="pf_img" value="' + esc(f.imagem) + '"/></div>' +
      '<div class="field"><label>' + esc(p.catalogStatus) + '</label><select id="pf_catstat">' +
      '<option value="publicado"' + (f.catalogo_status === 'publicado' ? ' selected' : '') + '>' + esc(p.statusPublished) + '</option>' +
      '<option value="rascunho"' + (f.catalogo_status === 'rascunho' ? ' selected' : '') + '>' + esc(p.statusDraft) + '</option>' +
      '<option value="agendado"' + (f.catalogo_status === 'agendado' ? ' selected' : '') + '>' + esc(p.statusScheduled) + '</option></select></div>' +
      '<div class="fgrid"><div class="field"><label>' + esc(p.size) + '</label><input id="pf_size" value="' + esc(v0.tamanho || 'M') + '"/></div>' +
      '<div class="field"><label>' + esc(p.color) + '</label><input id="pf_color" value="' + esc(v0.cor || '—') + '"/></div>' +
      '<div class="field"><label>' + esc(p.qty) + '</label><input id="pf_stock" type="number" value="' + esc(v0.stock || v0.quantidade || '10') + '"/></div></div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" onclick="Admin.closeModal()">' + esc(t().cancel) + '</button>' +
      '<button type="button" class="btn-primary" onclick="Admin.saveProduct(\'' + esc(id || '').replace(/'/g, "\\'") + '\')">' + esc(t().save) + '</button></div></div>'
    );
  }

  async function saveProduct(id) {
    var p = t().prod;
    var payload = {
      nome: ($('pf_nome') && $('pf_nome').value.trim()) || '',
      descricao: ($('pf_desc') && $('pf_desc').value) || '',
      categoria: ($('pf_cat') && $('pf_cat').value) || '',
      preco_ht: parseFloat($('pf_ht') && $('pf_ht').value) || 0,
      tva: parseFloat($('pf_tva') && $('pf_tva').value) || 23,
      imagem: ($('pf_img') && $('pf_img').value.trim()) || '',
      catalogo_status: ($('pf_catstat') && $('pf_catstat').value) || 'publicado',
      gerir_stock: '1',
      variantes: [{
        tamanho: ($('pf_size') && $('pf_size').value) || 'M',
        cor: ($('pf_color') && $('pf_color').value) || '—',
        stock: parseInt($('pf_stock') && $('pf_stock').value, 10) || 0
      }]
    };
    if (!payload.nome) { toast(t().noData, 'e'); return; }
    try {
      var res;
      if (id) {
        payload.produto_id = id;
        payload.replace_variants = true;
        res = await erpCall('updateProduct', payload);
      } else {
        res = await erpCall('createProduct', payload);
      }
      if (!res || !res.success) {
        toast((res && res.error) || t().error, 'e');
        return;
      }
      closeModal();
      toast(t().saved, 's');
      await loadProducts();
      renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  async function deleteProduct(id) {
    if (!confirm(t().prod.confirmDelete)) return;
    try {
      var res = await erpCall('deleteProduct', { id: id, produto_id: id });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      await loadProducts();
      renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  function editCategory(id) {
    var c = t().cat;
    var cat = id ? state.categories.find(function (x) { return x.category_id === id; }) : null;
    openModal(
      '<div class="modal-inner"><h2>' + esc(cat ? t().edit : c.new) + '</h2>' +
      '<div class="field"><label>' + esc(c.name) + '</label><input id="cf_nome" value="' + esc(cat ? cat.nome : '') + '"/></div>' +
      '<div class="field"><label>' + esc(c.desc) + '</label><input id="cf_desc" value="' + esc(cat ? cat.descricao : '') + '"/></div>' +
      '<div class="field"><label>' + esc(c.status) + '</label><select id="cf_stat">' +
      '<option value="publicado"' + ((!cat || cat.catalogo_status === 'publicado') ? ' selected' : '') + '>' + esc(c.published) + '</option>' +
      '<option value="rascunho"' + (cat && cat.catalogo_status === 'rascunho' ? ' selected' : '') + '>' + esc(c.draft) + '</option></select></div>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" onclick="Admin.closeModal()">' + esc(t().cancel) + '</button>' +
      '<button type="button" class="btn-primary" onclick="Admin.saveCategory(\'' + esc(id || '').replace(/'/g, "\\'") + '\')">' + esc(t().save) + '</button></div></div>'
    );
  }

  async function saveCategory(id) {
    var data = {
      nome: ($('cf_nome') && $('cf_nome').value.trim()) || '',
      descricao: ($('cf_desc') && $('cf_desc').value) || '',
      catalogo_status: ($('cf_stat') && $('cf_stat').value) || 'publicado'
    };
    if (!data.nome) return;
    try {
      var res = id
        ? await erpCall('updateCategory', Object.assign({ category_id: id }, data))
        : await erpCall('createCategory', data);
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      closeModal();
      toast(t().saved, 's');
      await loadCategories();
      renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  async function removeCategory(id) {
    if (!confirm(t().delete + '?')) return;
    try {
      var res = await erpCall('deleteCategory', { category_id: id });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      await loadCategories();
      renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  async function openOrder(orderId) {
    orderId = String(orderId || '').trim();
    if (!orderId) return;
    var btn = document.activeElement;
    if (btn && btn.disabled !== undefined) btn.disabled = true;
    try {
      var res = await erpCall('getOrder', { orderId: orderId });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      state.selectedOrder = res;
      var o = t().ord;
      var ord = res.order || {};
      var ent = res.entrega || {};
      var lines = (res.details || []).map(function (d) {
        return '<li>' + esc(d.nome_produto || d.produto_id) + ' × ' + esc(d.quantidade) + ' — ' + esc(d.preco) + ' €</li>';
      }).join('');
      if (!lines) lines = '<li class="muted">' + esc(t().noData) + '</li>';
      var customerBlock = '';
      if (ord.telefone || ord.endereco || ord.cliente_nif || ord.fiscal_doc_url || ord.fiscal_doc_ref) {
        customerBlock = '<div class="panel" style="margin:12px 0;padding:12px;"><p class="hint-block" style="margin:0 0 8px;"><strong>' + esc(o.customerBlock || 'Client') + '</strong></p>';
        if (ord.telefone) customerBlock += '<p style="font-size:11px;margin:4px 0;">' + esc(o.phone || 'Tél.') + ': ' + esc(ord.telefone) + '</p>';
        if (ord.endereco) customerBlock += '<p style="font-size:11px;margin:4px 0;">' + esc(o.address || 'Adresse') + ': ' + esc(ord.endereco) + '</p>';
        if (ord.cliente_nif) customerBlock += '<p style="font-size:11px;margin:4px 0;">' + esc(o.nif || 'NIF') + ': ' + esc(ord.cliente_nif) + '</p>';
        if (ord.fiscal_doc_ref) customerBlock += '<p style="font-size:11px;margin:4px 0;">' + esc(o.fiscalRef || 'Réf.') + ': ' + esc(ord.fiscal_doc_ref) + '</p>';
        if (ord.fiscal_doc_url) {
          customerBlock += '<p style="font-size:11px;margin:4px 0;"><a href="' + esc(ord.fiscal_doc_url) + '" target="_blank" rel="noopener">' + esc(o.fiscalDoc || 'PDF') + '</a></p>';
        }
        customerBlock += '</div>';
      }
      var payState = String(ord.estado_pagamento || '').toLowerCase();
      var stripeBlock = '';
      if (ord.stripe_payment_intent) {
        stripeBlock = '<div class="panel" style="margin:12px 0;padding:12px;"><p class="hint-block" style="margin:0 0 8px;"><strong>' + esc(o.stripeTx || 'Stripe') + '</strong> · ' + esc(ord.stripe_payment_intent) + '</p>';
        if (ord.stripe_dashboard_url) {
          stripeBlock += '<a class="btn-ghost" style="display:inline-block;margin-right:8px;text-decoration:none;" href="' + esc(ord.stripe_dashboard_url) + '" target="_blank" rel="noopener">' + esc(o.stripeOpen || 'Stripe') + '</a>';
        }
        if (payState === 'pago_stripe' || payState === 'pago' || payState === 'paid') {
          stripeBlock += '<button type="button" class="btn-ghost" style="color:var(--danger,#c44);" onclick="Admin.refundStripeOrder(\'' + esc(orderId).replace(/'/g, "\\'") + '\')">' + esc(o.stripeRefund || 'Rembourser') + '</button>';
        }
        stripeBlock += '</div>';
      }
      var curEst = String(ord.estado || 'pending').toLowerCase();
      if (curEst === 'em_processamento' || curEst === 'preparacao') curEst = 'processing';
      openModal(
        '<div class="modal-inner"><h2>' + esc(o.detail) + ' #' + esc(ord.pedido_id || orderId) + '</h2>' +
        '<p class="hint-block">' + esc(ord.data) + ' · ' + esc(ord.email) + ' · <strong>' + esc(ord.total) + ' €</strong></p>' +
        customerBlock +
        stripeBlock +
        '<ul class="order-lines">' + lines + '</ul>' +
        '<div class="field"><label>' + esc(o.status) + '</label><select id="of_estado">' + orderStatusOptions(curEst) + '</select></div>' +
        '<div class="fgrid"><div class="field"><label>' + esc(o.pay) + '</label><select id="of_pay">' + payStatusOptions(ord.estado_pagamento) + '</select></div>' +
        '<div class="field"><label>' + esc(o.ship) + '</label><select id="of_ship">' + shipStatusOptions(ord.estado_envio) + '</select></div></div>' +
        '<button type="button" class="btn-ghost" style="margin-bottom:12px" onclick="Admin.setOrderQuick(\'processing\')">' + esc(o.markProcessing) + '</button>' +
        '<div class="fgrid"><div class="field"><label>' + esc(o.carrier) + '</label><input id="of_carrier" value="' + esc(ent.transportadora || 'CTT') + '"/></div>' +
        '<div class="field"><label>' + esc(o.tracking) + '</label><input id="of_track" value="' + esc(ent.tracking_number || ord.tracking_number || '') + '"/></div></div>' +
        '<div class="field"><label>' + esc(o.notes) + '</label><textarea id="of_notes" rows="2">' + esc(ord.notas || '') + '</textarea></div>' +
        '<div class="modal-actions"><button type="button" class="btn-ghost" onclick="Admin.closeModal()">' + esc(t().cancel) + '</button>' +
        '<button type="button" class="btn-ghost" onclick="Admin.printOrderInvoice(\'' + esc(orderId).replace(/'/g, "\\'") + '\')">' + esc(o.printInvoice || 'Imprimer facture') + '</button>' +
        (curEst !== 'cancelled' && curEst !== 'cancelado' ? '<button type="button" class="btn-ghost" style="color:var(--danger,#c44);" onclick="Admin.cancelOrder(\'' + esc(orderId).replace(/'/g, "\\'") + '\')">' + esc(o.cancelOrder || 'Annuler la commande') + '</button>' : '') +
        '<button type="button" class="btn-primary" id="btnSaveOrder" onclick="Admin.saveOrder(\'' + esc(orderId).replace(/'/g, "\\'") + '\')">' + esc(o.updateStatus) + '</button></div></div>'
      );
    } catch (e) { toast(apiErrMsg(e), 'e'); }
    finally { if (btn && btn.disabled !== undefined) btn.disabled = false; }
  }

  function setOrderQuick(estado) {
    var el = $('of_estado');
    if (el) el.value = estado;
    if (estado === 'processing') {
      var pay = $('of_pay');
      var ship = $('of_ship');
      if (pay && (pay.value === 'aguardando_pagamento' || pay.value === 'pending')) pay.value = 'pago';
      if (ship && (ship.value === 'pending' || !ship.value)) ship.value = 'preparacao';
    }
    if (estado === 'shipped') {
      var sh = $('of_ship');
      if (sh) sh.value = 'em_transito';
    }
  }

  function printViaIframe_(html) {
    try {
      var existing = document.getElementById('azv-admin-print-frame');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      var iframe = document.createElement('iframe');
      iframe.id = 'azv-admin-print-frame';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
      document.body.appendChild(iframe);
      var doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(function () {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { /* ignore */ }
      }, 500);
      return true;
    } catch (e) { return false; }
  }

  async function printOrderInvoice(orderId) {
    orderId = String(orderId || '').trim();
    if (!orderId) return;
    try {
      var res = await erpCall('getInvoiceData', { orderId: orderId });
      if (!res || !res.success || !res.html) { toast(t().error, 'e'); return; }
      var w = null;
      try { w = window.open('', '_blank', 'width=820,height=960'); } catch (eOpen) { w = null; }
      if (w && w.document) {
        w.document.open();
        w.document.write(res.html);
        w.document.close();
        w.focus();
        setTimeout(function () { try { w.print(); } catch (e) { /* ignore */ } }, 450);
      } else {
        printViaIframe_(res.html);
      }
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  async function refundStripeOrder(orderId) {
    orderId = String(orderId || '').trim();
    var o = t().ord || {};
    if (!orderId) return;
    if (!global.confirm(o.stripeRefundConfirm || 'Rembourser le paiement Stripe ?')) return;
    try {
      var res = await erpCall('refundStripePayment', { orderId: orderId });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(o.stripeRefundedOk || 'Remboursement effectué', 's');
      closeModal();
      await loadOrders();
      renderOrdersPanel();
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  async function cancelOrder(orderId) {
    orderId = String(orderId || '').trim();
    var o = t().ord || {};
    if (!orderId) return;
    if (!global.confirm(o.cancelConfirm || 'Annuler cette commande et restaurer le stock ?')) return;
    try {
      var res = await erpCall('cancelOrder', { orderId: orderId });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      closeModal();
      toast(o.cancelledOk || 'Commande annulée', 's');
      await loadOrders();
      renderOrdersPanel();
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  async function saveOrder(orderId) {
    orderId = String(orderId || '').trim();
    var saveBtn = $('btnSaveOrder');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = t().loading; }
    try {
      var res = await erpCall('updateOrderStatus', {
        orderId: orderId,
        estado: $('of_estado') ? $('of_estado').value : '',
        estado_pagamento: $('of_pay') ? $('of_pay').value : '',
        estado_envio: $('of_ship') ? $('of_ship').value : '',
        tracking: $('of_track') ? $('of_track').value : '',
        transportadora: $('of_carrier') ? $('of_carrier').value : 'CTT',
        notes: $('of_notes') ? $('of_notes').value : ''
      });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      closeModal();
      toast(t().saved, 's');
      await loadOrders();
      renderOrdersPanel();
    } catch (e) { toast(apiErrMsg(e), 'e'); }
    finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = t().ord.updateStatus;
      }
    }
  }

  async function exportOrders() {
    try {
      var res = await erpCall('exportOrdersCsv', { status: state.orderFilter, search: state.orderSearch });
      if (!res || !res.success || !res.csv) { toast(t().error, 'e'); return; }
      var blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'commandes-azavision.csv';
      a.click();
    } catch (e) { toast(e.message, 'e'); }
  }

  async function saveConfig() {
    var patch = {
      free_shipping_threshold: val('cfg_free_shipping'),
      shipping_flat_rate: val('cfg_flat'),
      pay_stripe_enabled: chk('cfg_stripe'),
      pay_cod_enabled: chk('cfg_cod'),
      pay_show_stripe: chk('cfg_show_stripe'),
      pay_show_cod: chk('cfg_show_cod'),
      pay_transfer_enabled: chk('cfg_transfer'),
      pay_show_transfer: chk('cfg_show_transfer'),
      transfer_iban: val('cfg_transfer_iban').replace(/\s+/g, ' ').trim(),
      transfer_account_holder: val('cfg_transfer_holder'),
      transfer_bank_name: val('cfg_transfer_bank'),
      pay_show_mbway: chk('cfg_show_mbway'),
      pay_mbway_phone: val('cfg_mbway_phone'),
      pay_paypal_enabled: chk('cfg_paypal'),
      pay_show_paypal: chk('cfg_show_paypal'),
      pay_paypal_me: val('cfg_paypal_me'),
      pay_show_whatsapp: chk('cfg_show_whatsapp'),
      guest_checkout_enabled: chk('cfg_guest_checkout'),
      promo_banner_enabled: (chk('cfg_promo_on') === '1' || val('cfg_promo_text').trim()) ? '1' : '0',
      promo_bar_display: chk('cfg_promo_bar_display'),
      promo_banner_show_default: chk('cfg_promo_show_default'),
      promo_banner_text: val('cfg_promo_text'),
      store_email: val('cfg_store_email'),
      contact_public_email: val('cfg_contact_email'),
      contact_phone: val('cfg_phone'),
      contact_whatsapp: val('cfg_whatsapp'),
      default_lang: val('cfg_lang'),
      boutique_default_lang: val('cfg_lang'),
      fiscal_provider: val('cfg_fiscal_provider'),
      fiscal_enabled: chk('cfg_fiscal_enabled'),
      fiscal_emit_on_payment: chk('cfg_fiscal_emit'),
      fiscal_doc_type: val('cfg_fiscal_doc_type')
    };
    var fiscalKey = val('cfg_fiscal_api_key');
    if (fiscalKey) patch.fiscal_api_key = fiscalKey;
    try {
      var res = await erpCall('updateConfig', patch);
      if (!res || !res.success) {
        toast((res && res.error) || t().error, 'e');
        return;
      }
      if (isAdminUser() && $('emp_nome')) {
        try {
          await erpCall('updateEmpresa', {
            nome: val('emp_nome'),
            nif: val('emp_nif'),
            email: val('emp_email'),
            telefone: val('emp_telefone'),
            morada: val('emp_morada'),
            cidade: val('emp_cidade'),
            pais: val('emp_pais'),
            website: val('emp_website'),
            moeda: val('emp_moeda'),
            tva_padrao: val('emp_tva_padrao')
          });
        } catch (eEmp) { /* ignore */ }
      }
      toast(t().saved, 's');
      await loadConfig();
      await loadEmpresa();
      renderMain();
    } catch (e) { toast(apiErrMsg(e), 'e'); }
  }

  function val(id) { var el = $(id); return el ? el.value : ''; }
  function chk(id) { var el = $(id); return el && el.checked ? '1' : '0'; }

  function editCoupon(id) {
    if (proApi) return proApi.editCoupon(id);
    openModal('');
  }

  async function saveCoupon(id) {
    if (proApi) return proApi.saveCoupon(id);
  }

  async function removeCoupon(id) {
    if (!confirm(t().delete + '?')) return;
    try {
      var res = await erpCall('deleteCoupon', { cupon_id: id, codigo: id });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      await loadCoupons();
      renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  function render() {
    if (!state.token) renderLogin();
    else {
      if (!$('sidebar')) renderShell();
      renderMain();
      updateNavActiveState();
    }
    if ($('apiBanner')) $('apiBanner').style.display = apiOk() ? 'none' : 'block';
  }

  async function initApp(opts) {
    opts = opts || {};
    var ok = await validateAdmin(opts);
    if (!ok) return;
    renderShell();
    loadViewData();
    loadCategories().catch(function () { /* catégories en arrière-plan */ });
    if (!opts.trustSession) refreshAdminSessionQuiet();
    else setTimeout(refreshAdminSessionQuiet, 800);
  }

  async function init() {
    loadSession();
    global.addEventListener('pagehide', flushStorefrontAutosave);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && state.token) refreshAdminSessionQuiet();
    });
    if ($('apiBanner')) {
      $('apiBanner').innerHTML = t().apiBanner;
      $('apiBanner').style.display = apiOk() ? 'none' : 'block';
    }
    if (state.token && apiOk()) await initApp();
    render();
  }

  global.Admin = {
    init: init,
    setLang: setLang,
    setTheme: setTheme,
    getTheme: getTheme,
    login: login,
    logout: logout,
    setView: setView,
    toggleSidebar: toggleSidebar,
    closeSidebar: closeSidebar,
    closeModal: closeModal,
    setProductMode: setProductMode,
    setProductFilter: setProductFilter,
    setProductSearch: function (v) { if (proApi) proApi.setProductSearch(v); },
    toggleProductSelect: function (id, on) { if (proApi) proApi.toggleProductSelect(id, on); },
    toggleAllProducts: function (on) { if (proApi) proApi.toggleAllProducts(on); },
    bulkProducts: function (a) { if (proApi) proApi.bulkProducts(a); },
    restoreProduct: function (id) { if (proApi) proApi.restoreProduct(id); },
    purgeProduct: function (id) { if (proApi) proApi.purgeProduct(id); },
    duplicateProduct: function (id) { if (proApi) proApi.duplicateProduct(id); },
    quickPublishProduct: function (id) { if (proApi) proApi.quickPublishProduct(id); },
    quickDraftProduct: function (id) { if (proApi) proApi.quickDraftProduct(id); },
    setPromoTab: function (tab) { if (proApi) proApi.setPromoTab(tab); },
    setCouponFilter: function (f) { if (proApi) proApi.setCouponFilter(f); },
    savePromoBanner: function () { if (proApi) proApi.savePromoBanner(); },
    setOrderSearch: setOrderSearch,
    setOrderFilter: setOrderFilter,
    refreshOrders: refreshOrders,
    loadMoreOrders: loadMoreOrders,
    setReviewFilter: setReviewFilter,
    setReturnFilter: setReturnFilter,
    refreshReviews: refreshReviews,
    refreshReturns: refreshReturns,
    approveReview: approveReview,
    rejectReview: rejectReview,
    deleteReview: deleteReview,
    newReturnModal: newReturnModal,
    saveNewReturn: saveNewReturn,
    editReturn: editReturn,
    saveReturnStatus: saveReturnStatus,
    changeAdminPassword: changeAdminPassword,
    setOrderQuick: setOrderQuick,
    setClientSearch: setClientSearch,
    editProduct: editProduct,
    saveProduct: saveProduct,
    deleteProduct: deleteProduct,
    editCategory: editCategory,
    saveCategory: saveCategory,
    removeCategory: removeCategory,
    openOrder: openOrder,
    refundStripeOrder: refundStripeOrder,
    saveOrder: saveOrder,
    cancelOrder: cancelOrder,
    printOrderInvoice: printOrderInvoice,
    exportOrders: exportOrders,
    saveConfig: saveConfig,
    setVitrineLang: setVitrineLang,
    saveStorefront: saveStorefront,
    uploadHeroBg: uploadHeroBg,
    uploadStoreLogo: uploadStoreLogo,
    toggleVitrineGallery: toggleVitrineGallery,
    pickVitrineImage: pickVitrineImage,
    syncColorField: syncColorField,
    clearColorField: clearColorField,
    editAdminUser: editAdminUser,
    saveAdminUser: saveAdminUser,
    toggleAdminUserStatus: toggleAdminUserStatus,
    editCoupon: editCoupon,
    saveCoupon: saveCoupon,
    removeCoupon: removeCoupon,
    syncDrive: function () {
      if (global.ProductWizard) global.ProductWizard.syncDrive();
    },
    logoError: logoError
  };

  if (global.AdminPro) {
    proApi = global.AdminPro.install({
      state: state,
      erpCall: erpCall,
      esc: esc,
      t: t,
      toast: toast,
      loadProducts: loadProducts,
      loadCoupons: loadCoupons,
      loadConfig: loadConfig,
      loadCategories: loadCategories,
      renderMain: renderMain,
      openModal: openModal,
      closeModal: closeModal,
      categoryOptions: categoryOptions,
      cfgVal: cfgVal,
      Admin: global.Admin
    });
  }

  if (global.ProductWizard) {
    global.ProductWizard.install({
      Admin: global.Admin,
      erpCall: erpCall,
      esc: esc,
      t: t,
      state: state,
      loadCategories: loadCategories,
      loadProducts: loadProducts,
      renderMain: renderMain,
      openModal: openModal,
      closeModal: closeModal,
      categoryOptions: categoryOptions
    });
  }

  document.addEventListener('DOMContentLoaded', function () { init(); });

  // ═══════════════════════════════════════════════════════════════════════════
  //  GUIDE API — ADMIN ERP (erp-admin.js · fin de fichier)
  //  Les clés sensibles se configurent ICI dans l’interface, pas dans ce .js
  //  Référence complète : 03-google-apps-script/api_apps_script.gs (Ctrl+End)
  // ═══════════════════════════════════════════════════════════════════════════
  //
  //  Écran Admin → menu « Boutique » (renderConfig / saveConfig) :
  //
  //  #4 FACTURALUSA
  //    Champs   : cfg_fiscal_provider, cfg_fiscal_enabled, cfg_fiscal_emit,
  //               cfg_fiscal_api_key, cfg_fiscal_doc_type
  //    Sheets   : fiscal_provider, fiscal_enabled, fiscal_emit_on_payment,
  //               fiscal_api_key, fiscal_doc_type
  //    Exemple  : fiscal_api_key = 26830|PEKDtgsOzbPjo0ymkXvrNqZtgCmmOrvAaSBlzIxS347b0431
  //    Obtenir  : https://facturalusa.pt/u/subscription/api
  //    Note     : laisser cfg_fiscal_api_key vide pour conserver la clé existante
  //
  //  #5 CONTACT
  //    Champs   : cfg_phone (+351 937 831 268), cfg_whatsapp (351937831268),
  //               cfg_contact_email, cfg_store_email
  //
  //  STRIPE (#2 sk_ + #3 pk_)
  //    sk_      : GAS → Propriétés script → STRIPE_SECRET_KEY (jamais ici)
  //    pk_      : 01-vitrine-client/index.html → STRIPE_PUBLISHABLE_KEY
  //    Admin    : cfg_stripe + cfg_show_stripe (pay_stripe_enabled dans CONFIG)
  //
  //  MODÈLE nouvelle API : documenter dans api_apps_script.gs fin + ajouter
  //  champs renderConfig/saveConfig + clés getDefaultConfigCatalog_()
  // ═══════════════════════════════════════════════════════════════════════════
})(typeof window !== 'undefined' ? window : this);
