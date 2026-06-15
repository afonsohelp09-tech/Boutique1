/**
 * AZAVISION — Vitrine (01-vitrine-client) · API Google Apps Script
 */
(function (global) {
  'use strict';

  var API = global.API_URL || global.ERP_API_URL_DEFAULT || '';
  var STRIPE_PK = global.STRIPE_PUBLISHABLE_KEY || '';

  var PAGE_SIZE = 24;
  var SS_CATALOG_PREFIX = 'azav_catalog_v2_';
  var SS_CATALOG_TTL_MS = 8 * 60 * 1000;
  var SEARCH_DEBOUNCE_MS = 450;
  var CART_QTY_DEBOUNCE_MS = 350;
  var HERO_PRELOAD_ID = 'azav-hero-preload';
  var CARD_IMG_W = 300;
  var CARD_IMG_H = 400;

  var LS = {
    cartId: 'azav_cart_id',
    token: 'azav_client_token',
    clientId: 'azav_client_id',
    clientName: 'azav_client_name',
    clientEmail: 'azav_client_email',
    wishLocal: 'azav_wish_local',
    lastOrderId: 'azav_last_order_id',
    lastOrderEmail: 'azav_last_order_email'
  };

  var state = {
    lang: 'pt',
    products: [],
    categories: [],
    store: null,
    config: {},
    cat: 'all',
    cart: [],
    cartId: '',
    wish: [],
    token: '',
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    accountView: 'login',
    regDraft: null,
    otpTarget: '',
    resetEmail: '',
    profile: null,
    addresses: [],
    selectedOrder: null,
    promo: '',
    discAmount: 0,
    discPct: 0,
    couponTipo: '',
    couponCode: '',
    qvProd: null,
    qvSize: '',
    qvColor: '',
    qvGuide: false,
    qvGalleryIndex: 0,
    qvViewMode: 'shop',
    form: { name: '', email: '', phone: '', addr: '', city: '', zip: '', nif: '' },
    payMethod: 'stripe',
    ordered: false,
    lastOrderId: '',
    lastOrderEmail: '',
    lastInvoice: null,
    lastInvoiceLoading: false,
    delStep: 0,
    loading: true,
    productsLoading: false,
    productsLoadingMore: false,
    productsPage: 1,
    productsHasMore: false,
    productsTotal: 0,
    storeLoading: true,
    stripe: null,
    stripeElements: null,
    stripePaymentElement: null,
    stripeAmountCents: 0,
    checkoutBusy: false,
    contactSent: false,
    theme: 'dark'
  };

  function $(id) { return document.getElementById(id); }

  function apiUrlConfigured() {
    return API && API.indexOf('INSEREZ_VOTRE') === -1 && API.indexOf('/exec') > -1;
  }

  function translateApiError(msg) {
    var m = String(msg || '').trim();
    if (!m) return t().errGeneric || 'Erro';
    var L = state.lang || 'pt';
    var map = {
      'Commande déjà payée': { pt: 'Encomenda já paga.', fr: 'Commande déjà payée.', en: 'Order already paid.', es: 'Pedido ya pagado.' },
      'Méthode de paiement non autorisée': { pt: 'Método de pagamento não autorizado.', fr: 'Méthode de paiement non autorisée.', en: 'Payment method not allowed.', es: 'Método de pago no autorizado.' },
      'Pedido não encontrado': { pt: 'Encomenda não encontrada.', fr: 'Commande introuvable.', en: 'Order not found.', es: 'Pedido no encontrado.' },
      'Acesso não autorizado / Accès non autorisé': { pt: 'Acesso não autorizado.', fr: 'Accès non autorisé.', en: 'Unauthorized access.', es: 'Acceso no autorizado.' },
      'STRIPE_SECRET_KEY manquante — Projet Apps Script → Paramètres → Propriétés du script': {
        pt: 'STRIPE_SECRET_KEY em falta — Google Apps Script → Propriedades do script.',
        fr: 'STRIPE_SECRET_KEY manquante — Google Apps Script → Propriétés du script.',
        en: 'STRIPE_SECRET_KEY missing — Google Apps Script → Script properties.',
        es: 'Falta STRIPE_SECRET_KEY — Google Apps Script → Propiedades del script.'
      }
    };
    if (map[m] && map[m][L]) return map[m][L];
    return m;
  }

  async function erpCall(action, data, token) {
    if (!apiUrlConfigured()) throw new Error(t().apiUrlMissing || 'API não configurada');
    var payload = data || {};
    if (!payload.lang) payload.lang = state.lang || 'pt';
    var res = await fetch(API, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: payload, token: token != null ? token : state.token || '' })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var json = await res.json();
    if (json && json.error) json.error = translateApiError(json.error);
    return json;
  }

  function orderAccessPayload(extra) {
    var payload = extra || {};
    var email = normEmail(state.clientEmail || state.form.email || state.lastOrderEmail || payload.email || '');
    if (email) payload.email = email;
    return payload;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function t() { return (global.T && (global.T[state.lang] || global.T.pt)) || {}; }

  function pickLocale(fields) {
    var L = state.lang;
    if (fields[L]) return fields[L];
    if (L === 'en' || L === 'es') return fields.fr || fields.pt || fields.en || '';
    if (L === 'pt') return fields.pt || fields.fr || '';
    return fields.fr || fields.pt || '';
  }

  function nm(p) { return pickLocale({ fr: p.fr, pt: p.pt, en: p.en, es: p.es }); }
  function desc(p) { return pickLocale({ fr: p.dFr, pt: p.dPt, en: p.dEn, es: p.dEs }); }
  function badge(p) {
    if (p.disponivel === false) return t().badgeSoldOut;
    if (p.old) return t().badgeSale;
    return null;
  }

  var SIZE_LIST = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'TU'];

  function productSizes(p) {
    var sizes = productSizeOptions(p);
    if (sizes.length) return sizes;
    return [t().oneSize || '—'];
  }
  function normalizeOptionValue(v) {
    var val = String(v || '').trim();
    return val && val !== '—' ? val : '';
  }
  function sortSizeOptions(list) {
    return (list || []).slice().sort(function (a, b) {
      var ia = SIZE_LIST.indexOf(a);
      var ib = SIZE_LIST.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return String(a).localeCompare(String(b));
    });
  }
  function productColorOptions(p) {
    var raw = (p.colors || p.cores || []).map(normalizeOptionValue).filter(Boolean);
    return sortColorOptions(raw);
  }
  function productSizeOptions(p) {
    var raw = ((p && p.sizes) || (p && p.tamanhos) || []).map(normalizeOptionValue).filter(Boolean);
    return sortSizeOptions(raw);
  }
  function hasColorOptions(p) { return productColorOptions(p).length > 0; }
  function hasSizeOptions(p) { return productSizeOptions(p).length > 0; }
  function requiresVariantSelection(p) { return hasColorOptions(p) || hasSizeOptions(p); }
  function hasValidVariantSelection(p, size, color) {
    return (!hasSizeOptions(p) || !!normalizeOptionValue(size)) &&
      (!hasColorOptions(p) || !!normalizeOptionValue(color));
  }
  function stars(r) { return '★'.repeat(Math.round(parseFloat(r) || 0)); }

  function cfgNum(key, fallback) {
    var v = state.config[key];
    if (v == null || v === '') return fallback;
    var n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }

  function cfgOn(key, def) {
    var v = state.config[key];
    if (v == null || v === '') return def;
    return v === '1' || v === 1 || String(v).toLowerCase() === 'true';
  }

  function shippingEnabled() {
    var rate = cfgNum('shipping_flat_rate', 0);
    return cfgOn('shipping_enabled', rate > 0);
  }
  function shippingThreshold() {
    if (!shippingEnabled()) return 999999;
    var t = cfgNum('free_shipping_threshold', cfgNum('shipping_free_above', 0));
    return t > 0 ? t : 999999;
  }
  function shippingFlat() {
    if (!shippingEnabled()) return 0;
    var r = cfgNum('shipping_flat_rate', 0);
    return r > 0 ? r : 0;
  }

  function normalizeCat(s) { return String(s || '').trim().toLowerCase(); }

  var NAV_NEW = '__new__';
  var NAV_SALE = '__sale__';

  function resolveCategoryName(catKey) {
    if (!catKey || catKey === 'all' || catKey === NAV_NEW || catKey === NAV_SALE) return '';
    var hit = state.categories.find(function (c) {
      return normalizeCat(c.nome) === catKey || String(c.category_id || '') === catKey;
    });
    if (hit) return hit.nome || '';
    var prod = state.products.find(function (p) { return p.catKey === catKey; });
    return prod ? prod.cat : catKey;
  }

  function findCategoryForNavLabel(label) {
    var lab = String(label || '').toLowerCase();
    var rules = [
      [/femm|mulher|woman|mujer|femin/i, /femm|mulher|woman|mujer|femin/i],
      [/homm|homem|\bmen\b|hombre|mascul/i, /homm|homem|\bmen\b|hombre|mascul/i],
      [/access|acess|accessor|accesor/i, /access|acess|accessor|accesor/i]
    ];
    var rule = null;
    for (var r = 0; r < rules.length; r++) {
      if (rules[r][0].test(lab)) { rule = rules[r][1]; break; }
    }
    if (!rule) return null;
    var hit = state.categories.find(function (c) {
      return rule.test(String(c.nome || ''));
    });
    if (hit) return { id: normalizeCat(hit.nome), label: hit.nome };
    var seen = {};
    for (var i = 0; i < state.products.length; i++) {
      var p = state.products[i];
      if (!p.cat || seen[p.catKey]) continue;
      if (rule.test(p.cat)) {
        seen[p.catKey] = 1;
        return { id: p.catKey, label: p.cat };
      }
    }
    return null;
  }

  function getNavItems() {
    var labels = (t().nav || []);
    var items = [];
    labels.forEach(function (label, i) {
      if (i === 0) {
        items.push({ label: label, cat: NAV_NEW });
      } else if (i === labels.length - 1) {
        items.push({ label: label, cat: NAV_SALE });
      } else {
        var cat = findCategoryForNavLabel(label);
        items.push({ label: label, cat: cat ? cat.id : 'all' });
      }
    });
    return items;
  }

  function updateNavActive() {
    var ul = $('navUl');
    if (!ul) return;
    var items = ul.querySelectorAll('button[data-cat]');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-cat') === state.cat);
    }
  }

  function renderNav() {
    var ul = $('navUl');
    if (ul) {
      ul.innerHTML = getNavItems().map(function (it) {
        var cid = esc(it.cat).replace(/'/g, "\\'");
        return '<li><button type="button" data-cat="' + esc(it.cat) + '" class="' + (state.cat === it.cat ? 'active' : '') + '" onclick="Shop.selectCat(\'' + cid + '\')">' + esc(it.label) + '</button></li>';
      }).join('');
    }
    renderMobileNav();
    updateMobBarLabels();
  }

  function updateMobBarLabels() {
    var tx = t();
    if ($('mobShopLbl') && tx.mobShop) $('mobShopLbl').textContent = tx.mobShop;
    if ($('mobCartLbl') && tx.mobCart) $('mobCartLbl').textContent = tx.mobCart;
    if ($('mobOrdersLbl') && tx.mobOrders) $('mobOrdersLbl').textContent = tx.mobOrders;
    if ($('mobAccountLbl') && tx.mobAccount) $('mobAccountLbl').textContent = tx.mobAccount;
    var menuHead = document.querySelector('.nav-mobile-head span');
    if (menuHead && tx.navMenu) menuHead.textContent = tx.navMenu;
    var menuBtn = $('btnNavMenu');
    if (menuBtn && tx.navMenu) menuBtn.setAttribute('aria-label', tx.navMenu);
  }

  function renderFooterShop() {
    var box = $('fShopL');
    if (!box) return;
    var links = [
      { label: t().seeAll, cat: 'all' },
      { label: (t().nav && t().nav[0]) || 'New', cat: NAV_NEW },
      { label: (t().nav && t().nav[4]) || 'Sale', cat: NAV_SALE }
    ];
    getCatList().slice(1, 4).forEach(function (c) {
      links.push({ label: c.label, cat: c.id });
    });
    box.innerHTML = links.map(function (l) {
      var cid = esc(l.cat).replace(/'/g, "\\'");
      return '<li><a href="#shop" onclick="event.preventDefault();Shop.selectCat(\'' + cid + '\')">' + esc(l.label) + '</a></li>';
    }).join('');
  }

  function updateScrollLock() {
    var lock = false;
    ['cartBg', 'wishBg', 'qvBg', 'coBg', 'contactBg', 'accBg', 'navMobileBg', 'imgZoomBg'].forEach(function (id) {
      var el = $(id);
      if (el && el.classList.contains('open')) lock = true;
    });
    if ($('soEl') && $('soEl').classList.contains('open')) lock = true;
    if (document.body) document.body.classList.toggle('scroll-lock', lock);
  }

  function closeAllOverlays() {
    closeImageZoom();
    closeCart();
    closeCo();
    closeWish();
    closeQv();
    closeAccount();
    closeContact();
    closeMobileNav();
    if (global.closeSo) global.closeSo();
    updateScrollLock();
  }

  function isMobileViewport() {
    return global.matchMedia && global.matchMedia('(max-width: 768px)').matches;
  }

  function toggleMobileNav() {
    var bg = $('navMobileBg');
    if (!bg) return;
    if (bg.classList.contains('open')) closeMobileNav();
    else {
      renderMobileNav();
      bg.classList.add('open');
      bg.setAttribute('aria-hidden', 'false');
      var btn = $('btnNavMenu');
      if (btn) btn.setAttribute('aria-expanded', 'true');
      updateScrollLock();
    }
  }

  function closeMobileNav() {
    var bg = $('navMobileBg');
    if (!bg) return;
    bg.classList.remove('open');
    bg.setAttribute('aria-hidden', 'true');
    var btn = $('btnNavMenu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    updateScrollLock();
  }

  function renderMobileNav() {
    var ul = $('navMobileUl');
    if (!ul) return;
    var items = getNavItems();
    ul.innerHTML = items.map(function (it) {
      var cid = esc(it.cat).replace(/'/g, "\\'");
      return '<li><button type="button" data-cat="' + esc(it.cat) + '" class="' + (state.cat === it.cat ? 'active' : '') + '" onclick="Shop.selectCat(\'' + cid + '\');Shop.closeMobileNav()">' + esc(it.label) + '</button></li>';
    }).join('');
    var foot = $('navMobileFoot');
    if (foot) {
      var langs = ['fr', 'pt', 'en', 'es'];
      var th = getTheme();
      foot.innerHTML =
        '<div class="lang-switch lang-box" role="group">' + langs.map(function (l) {
          return '<button type="button" class="' + (state.lang === l ? 'on' : '') + '" onclick="setLang(\'' + l + '\')">' + l.toUpperCase() + '</button>';
        }).join('') + '</div>' +
        (typeof buildThemeSwitchHtml === 'function' ? buildThemeSwitchHtml() : '');
      if (typeof updateThemeButtons === 'function') updateThemeButtons();
    }
  }

  function scrollShop() {
    var el = $('shop');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectCat(id) {
    state.cat = id || 'all';
    closeAllOverlays();
    scrollShop();
    renderCats();
    updateNavActive();
    refreshProducts();
  }

  function resetAll() {
    state.cat = 'all';
    if ($('srchIn')) $('srchIn').value = '';
    if ($('soIn')) $('soIn').value = '';
    if ($('sortSel')) $('sortSel').value = 'def';
    closeAllOverlays();
    renderCats();
    updateNavActive();
    refreshProducts();
  }

  function navGo(action) {
    if (action === 'shop' || action === 'all') return resetAll();
    if (action === 'new') return selectCat(NAV_NEW);
    if (action === 'sale') return selectCat(NAV_SALE);
    if (action === 'contact') return openContact();
    if (action === 'orders') return openOrdersOrLogin();
    if (action === 'account') { openAccount(); return; }
    if (String(action).indexOf('cat:') === 0) return selectCat(action.slice(4));
    selectCat(action);
  }

  var COLOR_PALETTE = [
    { id: 'noir', hex: '#000000', fr: 'Noir', pt: 'Preto', en: 'Black', es: 'Negro' },
    { id: 'anthracite', hex: '#374151', fr: 'Anthracite', pt: 'Antracite', en: 'Anthracite', es: 'Antracita' },
    { id: 'gris', hex: '#9CA3AF', fr: 'Gris', pt: 'Cinza', en: 'Grey', es: 'Gris' },
    { id: 'blanc', hex: '#FFFFFF', fr: 'Blanc', pt: 'Branco', en: 'White', es: 'Blanco', border: true },
    { id: 'creme', hex: '#FEF3C7', fr: 'Crème', pt: 'Creme', en: 'Cream', es: 'Crema', border: true },
    { id: 'beige', hex: '#D6D3D1', fr: 'Beige', pt: 'Bege', en: 'Beige', es: 'Beige' },
    { id: 'marron', hex: '#78350F', fr: 'Marron', pt: 'Marrom', en: 'Brown', es: 'Marrón' },
    { id: 'rouge', hex: '#EF4444', fr: 'Rouge', pt: 'Vermelho', en: 'Red', es: 'Rojo' },
    { id: 'bordeaux', hex: '#7F1D1D', fr: 'Bordeaux', pt: 'Bordô', en: 'Burgundy', es: 'Burdeos' },
    { id: 'rose', hex: '#EC4899', fr: 'Rose', pt: 'Rosa', en: 'Pink', es: 'Rosa' },
    { id: 'rose_pale', hex: '#FBCFE8', fr: 'Rose Pâle', pt: 'Rosa Pálido', en: 'Pale pink', es: 'Rosa pálido', border: true },
    { id: 'orange', hex: '#F97316', fr: 'Orange', pt: 'Laranja', en: 'Orange', es: 'Naranja' },
    { id: 'jaune', hex: '#EAB308', fr: 'Jaune', pt: 'Amarelo', en: 'Yellow', es: 'Amarillo' },
    { id: 'or', hex: '#D4AF37', fr: 'Or', pt: 'Ouro', en: 'Gold', es: 'Oro' },
    { id: 'vert', hex: '#10B981', fr: 'Vert', pt: 'Verde', en: 'Green', es: 'Verde' },
    { id: 'kaki', hex: '#3F6212', fr: 'Kaki', pt: 'Caqui', en: 'Khaki', es: 'Caqui' },
    { id: 'bleu', hex: '#3B82F6', fr: 'Bleu', pt: 'Azul', en: 'Blue', es: 'Azul' },
    { id: 'marine', hex: '#1E3A8A', fr: 'Marine', pt: 'Marinho', en: 'Navy', es: 'Marino' },
    { id: 'ciel', hex: '#7DD3FC', fr: 'Ciel', pt: 'Céu', en: 'Sky', es: 'Cielo' },
    { id: 'violet', hex: '#8B5CF6', fr: 'Violet', pt: 'Roxo', en: 'Violet', es: 'Violeta' }
  ];

  function normalizeColorKey(name) {
    return String(name || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function findColorById(id) {
    for (var i = 0; i < COLOR_PALETTE.length; i++) {
      if (COLOR_PALETTE[i].id === id) return COLOR_PALETTE[i];
    }
    return null;
  }

  function findColorByName(name) {
    var n = normalizeColorKey(name);
    if (!n) return null;
    for (var i = 0; i < COLOR_PALETTE.length; i++) {
      var c = COLOR_PALETTE[i];
      if (c.id === n) return c;
      if (normalizeColorKey(c.fr) === n) return c;
      if (normalizeColorKey(c.pt) === n) return c;
      if (normalizeColorKey(c.en) === n) return c;
      if (normalizeColorKey(c.es) === n) return c;
    }
    return null;
  }

  function colorCanonicalKey(nameOrId) {
    var raw = String(nameOrId || '').trim();
    if (!raw) return '';
    var byId = findColorById(raw);
    if (byId) return byId.id;
    var byName = findColorByName(raw);
    if (byName) return byName.id;
    return normalizeColorKey(raw);
  }

  function colorsMatch(a, b) {
    if (!a || !b) return !a && !b;
    return colorCanonicalKey(a) === colorCanonicalKey(b);
  }

  function colorDisplayName(nameOrId) {
    var raw = String(nameOrId || '').trim();
    if (!raw) return '—';
    var hit = findColorById(raw) || findColorByName(raw);
    if (hit) {
      var L = state.lang;
      return hit[L] || hit.pt || hit.fr || hit.id;
    }
    return raw;
  }

  function sortColorOptions(list) {
    return (list || []).slice().sort(function (a, b) {
      var ka = colorCanonicalKey(a);
      var kb = colorCanonicalKey(b);
      var ia = -1;
      var ib = -1;
      for (var i = 0; i < COLOR_PALETTE.length; i++) {
        if (COLOR_PALETTE[i].id === ka) ia = i;
        if (COLOR_PALETTE[i].id === kb) ib = i;
      }
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return String(a).localeCompare(String(b));
    });
  }

  function resolveColor(name) {
    if (!name || name === '—') return { hex: '#666666', border: false };
    var raw = String(name).trim();
    if (raw.charAt(0) === '#') {
      var hex = raw.length === 4
        ? '#' + raw.charAt(1) + raw.charAt(1) + raw.charAt(2) + raw.charAt(2) + raw.charAt(3) + raw.charAt(3)
        : raw;
      return { hex: hex, border: /^#(fff|ffffff|fef3c7|fbcfe8)$/i.test(hex) };
    }
    var hit = findColorById(raw) || findColorByName(raw);
    if (hit) return { hex: hit.hex, border: !!hit.border };
    var h = 0;
    for (var i = 0; i < raw.length; i++) h = raw.charCodeAt(i) + ((h << 5) - h);
    return { hex: '#' + (h & 0xffffff).toString(16).padStart(6, '0'), border: false };
  }

  function colorCss(name) {
    return resolveColor(name).hex;
  }

  function colorSwatchStyle(name) {
    var r = resolveColor(name);
    var s = 'background:' + r.hex;
    if (r.border) s += ';box-shadow:inset 0 0 0 1px rgba(128,128,128,.4),0 0 0 1px var(--border-hard)';
    return s;
  }

  var PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect fill="#1a1918" width="300" height="400"/>' +
    '<text x="150" y="205" font-family="system-ui,sans-serif" font-size="14" fill="#bda061" text-anchor="middle">AZAVISION</text></svg>'
  );

  function extractDriveFileId(url) {
    if (!url) return '';
    var s = String(url).trim();
    var m = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (m) return m[1];
    m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = s.match(/thumbnail\?id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    if (m) return m[1];
    return '';
  }

  function driveThumbUrl(fileId, width, version) {
    if (!fileId) return '';
    var w = Math.min(Math.max(parseInt(width, 10) || 400, 120), 1600);
    var url = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w' + w;
    if (version) url += '&v=' + encodeURIComponent(String(version).slice(0, 19));
    return url;
  }

  /** URL haute résolution pour zoom lightbox (thumbnails Drive fiables, pas uc?export=view). */
  function driveZoomImageUrl(fileId, version) {
    if (!fileId) return '';
    return driveThumbUrl(fileId, 1600, version);
  }

  function resolveZoomImageUrl(primary, fallbacks) {
    var tryList = [primary].concat(fallbacks || []).filter(Boolean);
    for (var i = 0; i < tryList.length; i++) {
      var u = String(tryList[i]).trim();
      if (!u || u === placeholderImage()) continue;
      if (/^data:image\//i.test(u)) return u;
      var fid = extractDriveFileId(u);
      if (fid) return driveZoomImageUrl(fid);
      if (u.indexOf('googleusercontent.com') >= 0) return u;
      if (/^https?:\/\//i.test(u) && u.indexOf('drive.google.com/file/') < 0 && u.indexOf('uc?export=') < 0) return u;
      var opt = optimizeImageUrl(u, 1600);
      if (opt) return opt;
    }
    return placeholderImage();
  }

  function imageVersionSuffix(p) {
    if (!p || !p.imagemUpdatedAt) return '';
    return String(p.imagemUpdatedAt).slice(0, 19);
  }

  function appendImageVersion(url, version) {
    if (!url || !version) return url;
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return url + sep + 'v=' + encodeURIComponent(String(version).slice(0, 19));
  }

  function optimizeImageUrl(url, width) {
    if (!url) return '';
    var u = String(url).trim();
    if (/^data:image\//i.test(u)) return u;
    if (u.indexOf('drive.google.com') >= 0 || u.indexOf('googleusercontent.com') >= 0) {
      var id = extractDriveFileId(u);
      if (id) return driveThumbUrl(id, width);
    }
    if (/^https?:\/\//i.test(u)) return u;
    return '';
  }

  function placeholderImage() { return PLACEHOLDER_IMG; }

  function resolveProductDriveId(p) {
    var id = extractDriveFileId((p && p.imagem) || '');
    if (id) return id;
    var vars = (p && p.variantes) || [];
    for (var i = 0; i < vars.length; i++) {
      id = extractDriveFileId(vars[i].imagem_variante || '');
      if (id) return id;
    }
    return '';
  }

  function productImageSet(p) {
    var ver = imageVersionSuffix(p);
    var cdn = (p && (p.imagemCdnUrl || p._raw && p._raw.imagem_cdn_url)) || '';
    if (cdn) {
      var cu = appendImageVersion(String(cdn).trim(), ver);
      return { driveId: p.driveFileId || '', grid: cu, md: cu, lg: cu, sm: cu, srcset: '' };
    }
    if (p && (p.imagemThumbSm || p._raw && p._raw.imagem_thumb_sm)) {
      var sm = appendImageVersion(p.imagemThumbSm || p._raw.imagem_thumb_sm, ver);
      var md = appendImageVersion(p.imagemThumbMd || p._raw.imagem_thumb_md || sm, ver);
      var lg = appendImageVersion(p.imagemThumbLg || p._raw.imagem_thumb_lg || md, ver);
      var grid = md;
      var fid = p.driveFileId || p._raw && p._raw.drive_file_id || resolveProductDriveId(p);
      var srcset = '';
      if (fid) {
        srcset = driveThumbUrl(fid, 240, ver) + ' 240w, ' + driveThumbUrl(fid, 320, ver) + ' 320w, ' + driveThumbUrl(fid, 480, ver) + ' 480w';
      }
      return { driveId: fid, grid: grid, md: md, lg: lg, sm: sm, srcset: srcset };
    }
    var driveId = resolveProductDriveId(p);
    if (driveId) {
      return {
        driveId: driveId,
        grid: driveThumbUrl(driveId, 320, ver),
        md: driveThumbUrl(driveId, 480, ver),
        lg: driveThumbUrl(driveId, 800, ver),
        sm: driveThumbUrl(driveId, 200, ver),
        srcset: driveThumbUrl(driveId, 240, ver) + ' 240w, ' + driveThumbUrl(driveId, 320, ver) + ' 320w, ' + driveThumbUrl(driveId, 480, ver) + ' 480w'
      };
    }
    var raw = (p && p.imagem) || '';
    var grid = optimizeImageUrl(raw, 320) || placeholderImage();
    return { driveId: '', grid: grid, md: grid, lg: grid, sm: grid, srcset: '' };
  }

  function variantImageUrl(p, variant, width) {
    if (variant && variant.imagem_variante) {
      var vid = extractDriveFileId(variant.imagem_variante);
      if (vid) return driveThumbUrl(vid, width || 800);
      var vu = optimizeImageUrl(variant.imagem_variante, width || 800);
      if (vu) return vu;
    }
    if (!p) return placeholderImage();
    if (width && width >= 900) return p.imgLg || p.img || placeholderImage();
    if (width && width <= 220) return p.imgSm || p.img || placeholderImage();
    return p.imgMd || p.img || placeholderImage();
  }

  function qvProductImage(p, size, color) {
    if (!p) return placeholderImage();
    return variantImageUrl(p, findVariant(p, size, color), 1200);
  }

  function productGalleryList(p) {
    if (!p) return [];
    var raw = p.gallery || p.imagens || (p._raw && p._raw.imagens) || [];
    if (raw && raw.length) {
      return raw.map(function (img, idx) {
        var url = typeof img === 'string' ? img : (img.url || '');
        if (!url) return null;
        var md = (typeof img === 'object' && (img.thumb_md || img.thumbMd)) || optimizeImageUrl(url, 480);
        var lg = (typeof img === 'object' && (img.thumb_lg || img.thumbLg)) || optimizeImageUrl(url, 900);
        return { url: url, md: md, lg: lg, ordem: (typeof img === 'object' && img.ordem != null) ? img.ordem : idx };
      }).filter(function (x) { return x; });
    }
    var main = qvProductImage(p, state.qvSize, state.qvColor);
    if (main && main !== placeholderImage()) return [{ url: main, md: main, lg: main, ordem: 0 }];
    if (p.imgLg || p.img) return [{ url: p.imgLg || p.img, md: p.imgMd || p.img, lg: p.imgLg || p.img, ordem: 0 }];
    return [];
  }

  function qvCurrentGalleryImage(p) {
    var gallery = productGalleryList(p);
    var idx = state.qvGalleryIndex || 0;
    if (idx >= gallery.length) idx = 0;
    if (gallery.length) return gallery[idx];
    return { url: qvProductImage(p, state.qvSize, state.qvColor), md: '', lg: '' };
  }

  function zoomGalleryImageUrl(item, p) {
    if (!item) return placeholderImage();
    var ver = p ? imageVersionSuffix(p) : '';
    var fid = extractDriveFileId(item.url || '') || extractDriveFileId(item.lg || '') || extractDriveFileId(item.md || '');
    if (fid) return driveZoomImageUrl(fid, ver);
    return resolveZoomImageUrl(item.lg || item.md || item.url, [item.md, item.url]);
  }

  function zoomProductImageUrl(p, size, color) {
    if (!p) return placeholderImage();
    var ver = imageVersionSuffix(p);
    var variant = findVariant(p, size, color);
    var fid = '';
    if (variant && variant.imagem_variante) fid = extractDriveFileId(variant.imagem_variante);
    if (!fid) fid = p.driveFileId || (p._raw && p._raw.drive_file_id) || resolveProductDriveId(p);
    if (!fid && p.imagem) fid = extractDriveFileId(p.imagem);
    if (fid) return driveZoomImageUrl(fid, ver);
    if (p.imagemCdnUrl) return appendImageVersion(String(p.imagemCdnUrl).trim(), ver);
    return resolveZoomImageUrl(variantImageUrl(p, variant, 1200), [p.imgLg, p.imgMd, p.img]);
  }

  /** URLs Drive haute résolution (plusieurs tailles + lh3 en secours). */
  function driveZoomCandidates(fid, version) {
    if (!fid) return [];
    var list = [];
    [1600, 1200, 1000, 800, 480].forEach(function (w) {
      var u = driveThumbUrl(fid, w, version);
      if (u && list.indexOf(u) < 0) list.push(u);
    });
    ['=w1600', '=w1200', '=w800'].forEach(function (s) {
      var u = 'https://lh3.googleusercontent.com/d/' + fid + s;
      if (list.indexOf(u) < 0) list.push(u);
    });
    return list;
  }

  function buildZoomUrlCandidates(primary, extras, p) {
    var ver = p ? imageVersionSuffix(p) : '';
    var out = [];
    function pushUrl(u) {
      u = u ? String(u).trim() : '';
      if (!u || u === placeholderImage()) return;
      if (/^data:image\//i.test(u)) {
        if (out.indexOf(u) < 0) out.push(u);
        return;
      }
      var fid = extractDriveFileId(u);
      if (fid) {
        driveZoomCandidates(fid, ver).forEach(function (x) {
          if (out.indexOf(x) < 0) out.push(x);
        });
        return;
      }
      var resolved = resolveZoomImageUrl(u, []);
      if (resolved && resolved !== placeholderImage() && out.indexOf(resolved) < 0) out.push(resolved);
    }
    pushUrl(primary);
    (extras || []).forEach(pushUrl);
    if (!out.length) out.push(placeholderImage());
    return out;
  }

  function qvVisibleImageSrc() {
    var el = document.querySelector('#qvModal .m-img-zoom img.shop-img.loaded, #qvModal .m-img-zoom img.shop-img.img-fallback, #qvModal .m-img-zoom img');
    if (!el || !el.src) return '';
    if (String(el.src).indexOf('data:image/svg') >= 0) return '';
    return el.src;
  }

  var imgZoomState = { scale: 1, x: 0, y: 0, drag: false, lastX: 0, lastY: 0, pinchDist: 0, pinchScale: 1 };

  function clampImageZoomPan() {
    var wrap = $('imgZoomWrap');
    var img = $('imgZoomImg');
    if (!wrap || !img || imgZoomState.scale <= 1.001) {
      imgZoomState.x = 0;
      imgZoomState.y = 0;
      return;
    }
    var wr = wrap.getBoundingClientRect();
    var baseW = img.offsetWidth || img.naturalWidth || 0;
    var baseH = img.offsetHeight || img.naturalHeight || 0;
    if (!baseW || !baseH) return;
    var maxX = Math.max(0, (baseW * imgZoomState.scale - wr.width) / 2);
    var maxY = Math.max(0, (baseH * imgZoomState.scale - wr.height) / 2);
    imgZoomState.x = Math.min(maxX, Math.max(-maxX, imgZoomState.x));
    imgZoomState.y = Math.min(maxY, Math.max(-maxY, imgZoomState.y));
  }

  function applyImageZoomTransform() {
    clampImageZoomPan();
    var img = $('imgZoomImg');
    if (!img) return;
    img.style.transform = 'translate(' + imgZoomState.x + 'px,' + imgZoomState.y + 'px) scale(' + imgZoomState.scale + ')';
  }

  function resetImageZoomTransform() {
    imgZoomState.scale = 1;
    imgZoomState.x = 0;
    imgZoomState.y = 0;
    applyImageZoomTransform();
  }

  function markZoomImageLoaded() {
    var img = $('imgZoomImg');
    if (img) img.classList.add('loaded');
    resetImageZoomTransform();
  }

  function openImageZoom(src, alt, fallbacks, productCtx) {
    var bg = $('imgZoomBg');
    var img = $('imgZoomImg');
    var wrap = $('imgZoomWrap');
    if (!bg || !img) return;
    resetImageZoomTransform();
    img.classList.remove('loaded');
    if (wrap) wrap.classList.remove('dragging');
    img.alt = alt || '';
    bg.classList.add('open');
    bg.setAttribute('aria-hidden', 'false');
    var hint = $('imgZoomHint');
    if (hint) hint.textContent = t().imgZoomHelp || '';
    updateScrollLock();

    var candidates = buildZoomUrlCandidates(src, fallbacks, productCtx);
    var preview = '';
    (fallbacks || []).some(function (u) {
      if (u && u !== placeholderImage()) { preview = String(u).trim(); return true; }
      return false;
    });
    if (preview) {
      img.src = preview;
      img.classList.add('loaded');
    }

    var idx = 0;
    function tryLoad() {
      if (idx >= candidates.length) {
        if (!preview) {
          img.src = placeholderImage();
          markZoomImageLoaded();
        }
        return;
      }
      var url = candidates[idx];
      function doneOk() {
        if (img.naturalWidth > 0 && img.naturalWidth < 160 && idx < candidates.length - 1) {
          idx++;
          tryLoad();
          return;
        }
        markZoomImageLoaded();
      }
      img.onload = function () {
        img.onload = null;
        img.onerror = null;
        doneOk();
      };
      img.onerror = function () {
        img.onload = null;
        img.onerror = null;
        idx++;
        if (idx >= candidates.length && preview) return;
        tryLoad();
      };
      img.src = url;
      if (img.complete && img.naturalWidth > 0) doneOk();
    }
    tryLoad();
  }

  function closeImageZoom() {
    var bg = $('imgZoomBg');
    var img = $('imgZoomImg');
    if (!bg) return;
    bg.classList.remove('open');
    bg.setAttribute('aria-hidden', 'true');
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.classList.remove('loaded');
      img.src = '';
    }
    imgZoomState.drag = false;
    imgZoomState.pinchDist = 0;
    var wrap = $('imgZoomWrap');
    if (wrap) wrap.classList.remove('dragging');
    updateScrollLock();
  }

  function openQvImageZoom() {
    var p = state.qvProd;
    if (!p) return;
    var item = qvCurrentGalleryImage(p);
    var visible = qvVisibleImageSrc() || item.lg || item.md || item.url || qvProductImage(p, state.qvSize, state.qvColor);
    var hiRes = zoomGalleryImageUrl(item, p);
    var fallbacks = [];
    if (visible) fallbacks.push(visible);
    if (item.md && fallbacks.indexOf(item.md) < 0) fallbacks.push(item.md);
    if (item.url && fallbacks.indexOf(item.url) < 0) fallbacks.push(item.url);
    if (p.imgLg && fallbacks.indexOf(p.imgLg) < 0) fallbacks.push(p.imgLg);
    if (p.imgMd && fallbacks.indexOf(p.imgMd) < 0) fallbacks.push(p.imgMd);
    openImageZoom(hiRes, nm(p), fallbacks, p);
  }

  function zoomImageStep(delta, focalX, focalY) {
    var wrap = $('imgZoomWrap');
    var oldScale = imgZoomState.scale;
    var newScale = Math.min(4, Math.max(1, oldScale + delta));
    if (newScale <= 1.001) {
      imgZoomState.scale = 1;
      imgZoomState.x = 0;
      imgZoomState.y = 0;
      applyImageZoomTransform();
      return;
    }
    if (wrap && focalX != null && focalY != null) {
      var rect = wrap.getBoundingClientRect();
      var cx = focalX - rect.left - rect.width / 2;
      var cy = focalY - rect.top - rect.height / 2;
      var ratio = newScale / oldScale;
      imgZoomState.x = cx - (cx - imgZoomState.x) * ratio;
      imgZoomState.y = cy - (cy - imgZoomState.y) * ratio;
    }
    imgZoomState.scale = newScale;
    applyImageZoomTransform();
  }

  function bindImageZoomEvents() {
    var bg = $('imgZoomBg');
    var wrap = $('imgZoomWrap');
    if (!bg || bg.dataset.bound === '1') return;
    bg.dataset.bound = '1';
    bg.addEventListener('click', function (e) {
      if (e.target === bg || (e.target.classList && e.target.classList.contains('img-zoom-backdrop'))) closeImageZoom();
    });
    document.addEventListener('keydown', function (e) {
      if (!bg.classList.contains('open')) return;
      if (e.key === 'Escape') closeImageZoom();
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomImageStep(0.25); }
      else if (e.key === '-') { e.preventDefault(); zoomImageStep(-0.25); }
    });
    if (!wrap) return;
    wrap.addEventListener('wheel', function (e) {
      if (!bg.classList.contains('open')) return;
      e.preventDefault();
      zoomImageStep(e.deltaY > 0 ? -0.15 : 0.15, e.clientX, e.clientY);
    }, { passive: false });
    wrap.addEventListener('dblclick', function (e) {
      e.preventDefault();
      if (imgZoomState.scale > 1.05) resetImageZoomTransform();
      else zoomImageStep(1, e.clientX, e.clientY);
    });
    function touchDist(touches) {
      if (!touches || touches.length < 2) return 0;
      var dx = touches[0].clientX - touches[1].clientX;
      var dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function startDrag(clientX, clientY) {
      if (imgZoomState.scale <= 1) return;
      imgZoomState.drag = true;
      imgZoomState.lastX = clientX;
      imgZoomState.lastY = clientY;
      wrap.classList.add('dragging');
    }
    function moveDrag(clientX, clientY) {
      if (!imgZoomState.drag) return;
      imgZoomState.x += clientX - imgZoomState.lastX;
      imgZoomState.y += clientY - imgZoomState.lastY;
      imgZoomState.lastX = clientX;
      imgZoomState.lastY = clientY;
      applyImageZoomTransform();
    }
    function endDrag() {
      imgZoomState.drag = false;
      wrap.classList.remove('dragging');
    }
    wrap.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (imgZoomState.scale <= 1) return;
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    });
    global.addEventListener('mousemove', function (e) { moveDrag(e.clientX, e.clientY); });
    global.addEventListener('mouseup', endDrag);
    wrap.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        imgZoomState.pinchDist = touchDist(e.touches);
        imgZoomState.pinchScale = imgZoomState.scale;
        imgZoomState.drag = false;
        wrap.classList.remove('dragging');
      } else if (e.touches[0]) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
    wrap.addEventListener('touchmove', function (e) {
      if (!bg.classList.contains('open')) return;
      if (e.touches.length === 2 && imgZoomState.pinchDist > 0) {
        e.preventDefault();
        var dist = touchDist(e.touches);
        if (dist > 0) {
          imgZoomState.scale = Math.min(4, Math.max(1, imgZoomState.pinchScale * (dist / imgZoomState.pinchDist)));
          if (imgZoomState.scale <= 1) { imgZoomState.x = 0; imgZoomState.y = 0; }
          applyImageZoomTransform();
        }
      } else if (e.touches[0] && imgZoomState.drag && imgZoomState.scale > 1) {
        e.preventDefault();
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    wrap.addEventListener('touchend', function () {
      imgZoomState.pinchDist = 0;
      endDrag();
    });
  }

  function imgHtml(src, alt, opts) {
    opts = opts || {};
    var url = src || placeholderImage();
    var cls = 'shop-img' + (opts.className ? ' ' + opts.className : '');
    var iw = opts.width || CARD_IMG_W;
    var ih = opts.height || CARD_IMG_H;
    var parts = [
      'class="' + cls + '"',
      'src="' + esc(url) + '"',
      'alt="' + esc(alt || '') + '"',
      'width="' + iw + '"',
      'height="' + ih + '"',
      'decoding="async"',
      opts.eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"',
      'onload="this.classList.add(\'loaded\')"',
      'onerror="typeof Shop!==\'undefined\'&&Shop.imgError&&Shop.imgError(this)"'
    ];
    if (opts.fallback && opts.fallback !== url) {
      parts.push('data-fallback="' + esc(opts.fallback) + '"');
    }
    if (opts.srcset) {
      parts.push('srcset="' + esc(opts.srcset) + '"');
      parts.push('sizes="' + esc(opts.sizes || '(max-width:768px) 46vw, 300px') + '"');
    }
    return '<img ' + parts.join(' ') + '/>';
  }

  function logoError(el) {
    if (!el) return;
    if (global.IconUi && global.IconUi.logoError) {
      global.IconUi.logoError(el);
      return;
    }
    el.style.display = 'none';
    var fb = el.parentElement && el.parentElement.querySelector('.brand-fallback, .logo-fallback-text');
    if (fb) fb.style.display = '';
  }

  function imgError(el) {
    if (!el) return;
    var isLogo = el.classList && (el.classList.contains('brand-logo') || el.classList.contains('f-logo') || el.classList.contains('login-logo'));
    var fb = el.getAttribute('data-fallback');
    if (fb && el.src !== fb && el.getAttribute('data-fb-tried') !== '1') {
      el.setAttribute('data-fb-tried', '1');
      el.src = fb;
      return;
    }
    if (isLogo) {
      logoError(el);
      return;
    }
    el.src = placeholderImage();
    el.classList.add('loaded', 'img-fallback');
  }

  function preloadProductImages(list, max) {
    (list || []).slice(0, max || 10).forEach(function (p) {
      if (!p || !p.imgSm) return;
      try {
        var im = new Image();
        im.decoding = 'async';
        im.src = p.imgSm;
      } catch (e) { /* ignore */ }
    });
  }

  function preloadHeroImage(url) {
    if (!url) return;
    var existing = document.getElementById(HERO_PRELOAD_ID);
    if (existing) {
      if (existing.getAttribute('href') === url) return;
      existing.remove();
    }
    var link = document.createElement('link');
    link.id = HERO_PRELOAD_ID;
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  }

  function findVariant(prod, size, color) {
    var vars = prod.variantes || (prod._raw && prod._raw.variantes) || [];
    if (!vars.length) return null;
    var sz = size || '', cl = color || '';
    var hit = vars.find(function (v) {
      var ts = String(v.tamanho || '').trim();
      var tc = String(v.cor || '').trim();
      return (!sz || ts === sz || !ts) && (!cl || colorsMatch(tc, cl) || !tc);
    });
    if (!hit && sz) hit = vars.find(function (v) { return String(v.tamanho || '').trim() === sz; });
    if (!hit && cl) hit = vars.find(function (v) { return colorsMatch(v.cor, cl); });
    return hit || vars[0];
  }

  function variantPrice(prod, variant) {
    if (variant && variant.preco != null && parseFloat(variant.preco) > 0) return parseFloat(variant.preco);
    return prod.price;
  }

  function mapProduct(p) {
    var price = parseFloat(p.preco_final) || 0;
    var list = parseFloat(p.preco);
    if (isNaN(list) || list <= price) list = null;
    var imgs = productImageSet(p);
    var nome = p.nome || '';
    var descr = p.descricao || '';
    var rate = parseFloat(p.reviews_average);
    var rev = parseInt(p.reviews_count, 10);
    return {
      id: p.produto_id,
      produto_id: p.produto_id,
      fr: nome,
      pt: nome,
      en: nome,
      es: nome,
      cat: p.categoria || '',
      catKey: normalizeCat(p.categoria),
      price: price,
      old: list,
      img: imgs.grid,
      imgMd: imgs.md,
      imgLg: imgs.lg,
      imgSm: imgs.sm,
      imgSrcset: imgs.srcset,
      _driveId: imgs.driveId,
      driveFileId: p.drive_file_id || imgs.driveId || '',
      imagemCdnUrl: p.imagem_cdn_url || '',
      imagemThumbSm: p.imagem_thumb_sm || '',
      imagemThumbMd: p.imagem_thumb_md || '',
      imagemThumbLg: p.imagem_thumb_lg || '',
      imagemUpdatedAt: p.imagem_updated_at || '',
      gallery: (p.imagens || []).map(function (img) {
        return {
          url: img.url || '',
          thumbSm: img.thumb_sm || img.thumbSm || '',
          thumbMd: img.thumb_md || img.thumbMd || '',
          thumbLg: img.thumb_lg || img.thumbLg || '',
          ordem: img.ordem != null ? img.ordem : 0
        };
      }),
      colors: productColorOptions({ colors: p.cores || [], cores: p.cores || [] }),
      sizes: productSizeOptions({ sizes: p.tamanhos || [], tamanhos: p.tamanhos || [] }),
      rate: isNaN(rate) ? 0 : rate,
      rev: isNaN(rev) ? 0 : rev,
      dFr: descr,
      dPt: descr,
      dEn: descr,
      dEs: descr,
      disponivel: p.disponivel !== false,
      variantes: p.variantes || [],
      _raw: p
    };
  }

  function loadSession() {
    try {
      state.cartId = localStorage.getItem(LS.cartId) || '';
      state.token = localStorage.getItem(LS.token) || '';
      state.clientId = localStorage.getItem(LS.clientId) || '';
      state.clientName = localStorage.getItem(LS.clientName) || '';
      state.clientEmail = localStorage.getItem(LS.clientEmail) || '';
      state.lastOrderId = localStorage.getItem(LS.lastOrderId) || '';
      state.lastOrderEmail = localStorage.getItem(LS.lastOrderEmail) || '';
      var wl = localStorage.getItem(LS.wishLocal);
      state.wish = wl ? JSON.parse(wl) : [];
    } catch (e) { state.wish = []; }
  }

  function saveSession() {
    try {
      if (state.cartId) localStorage.setItem(LS.cartId, state.cartId);
      if (state.token) localStorage.setItem(LS.token, state.token);
      else localStorage.removeItem(LS.token);
      if (state.clientId) localStorage.setItem(LS.clientId, state.clientId);
      else localStorage.removeItem(LS.clientId);
      if (state.clientName) localStorage.setItem(LS.clientName, state.clientName);
      else localStorage.removeItem(LS.clientName);
      if (state.clientEmail) localStorage.setItem(LS.clientEmail, state.clientEmail);
      else localStorage.removeItem(LS.clientEmail);
      if (state.lastOrderId) localStorage.setItem(LS.lastOrderId, state.lastOrderId);
      else localStorage.removeItem(LS.lastOrderId);
      if (state.lastOrderEmail) localStorage.setItem(LS.lastOrderEmail, state.lastOrderEmail);
      else localStorage.removeItem(LS.lastOrderEmail);
      localStorage.setItem(LS.wishLocal, JSON.stringify(state.wish));
    } catch (e) { /* ignore */ }
  }

  function accT() {
    var tr = t();
    return tr.account || (global.T && global.T.pt && global.T.pt.account) || {};
  }

  function normEmail(e) { return String(e || '').trim().toLowerCase(); }

  function validEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(e));
  }

  function validPassword(p) {
    return String(p || '').length >= 8;
  }

  function applySessionFromAuth(res, nomeFallback, emailOpt) {
    state.token = res.token || '';
    state.clientId = res.clientId || '';
    state.clientName = res.nome || nomeFallback || '';
    if (emailOpt) state.clientEmail = normEmail(emailOpt);
    saveSession();
  }

  async function restoreClientSession() {
    if (!state.token || !apiUrlConfigured()) return false;
    try {
      var v = await erpCall('validateToken', {}, state.token);
      if (!v || !v.success || v.type !== 'client' || !v.clientId) {
        logout(true);
        return false;
      }
      state.clientId = v.clientId;
      state.clientName = v.nome || state.clientName;
      saveSession();
      await loadClientProfile();
      await loadWishlistServer();
      return true;
    } catch (e) {
      return false;
    }
  }

  async function loadClientProfile() {
    if (!state.clientId || !apiUrlConfigured()) return;
    try {
      var res = await erpCall('getClientProfile', { clientId: state.clientId });
      if (res && res.success && res.client) {
        state.profile = res.client;
        state.clientName = res.client.nome || state.clientName;
        state.clientEmail = res.client.email || state.clientEmail;
        state.clientPhone = res.client.telefone || '';
        saveSession();
        prefillCheckoutFromProfile();
      }
    } catch (e) { /* ignore */ }
  }

  function prefillCheckoutFromProfile() {
    if (!state.profile && !state.clientName) return;
    var p = state.profile || {};
    if (!state.form.name && (p.nome || state.clientName)) state.form.name = p.nome || state.clientName;
    if (!state.form.email && (p.email || state.clientEmail)) state.form.email = p.email || state.clientEmail;
    if (!state.form.phone && (p.telefone || state.clientPhone)) state.form.phone = p.telefone || state.clientPhone;
  }

  async function loadClientAddresses() {
    if (!state.clientId || !state.token) return;
    try {
      var res = await erpCall('getClientAddresses', { clientId: state.clientId }, state.token);
      state.addresses = (res && res.success && res.addresses) ? res.addresses : [];
    } catch (e) {
      state.addresses = [];
    }
  }

  var VITRINE_LANGS = ['pt', 'fr', 'en', 'es'];

  function buildVitrineContentFromConfig(cfg) {
    cfg = cfg || {};
    var content = {};
    VITRINE_LANGS.forEach(function (lg) {
      content[lg] = {
        hEye: String(cfg['vitrine_hero_eyebrow_' + lg] || '').trim(),
        hTitle: String(cfg['vitrine_hero_title_' + lg] || '').trim(),
        hSub: String(cfg['vitrine_hero_sub_' + lg] || '').trim(),
        hBtn1: String(cfg['vitrine_hero_btn1_' + lg] || '').trim(),
        hBtn2: String(cfg['vitrine_hero_btn2_' + lg] || '').trim(),
        shopLabel: String(cfg['vitrine_shop_label_' + lg] || '').trim(),
        shopTitle: String(cfg['vitrine_shop_title_' + lg] || '').trim(),
        fDesc: String(cfg['vitrine_footer_desc_' + lg] || cfg.boutique_footer_tagline || '').trim()
      };
    });
    return content;
  }

  function buildSocialFromConfig(cfg) {
    cfg = cfg || {};
    return {
      instagram: String(cfg.social_instagram || '').trim(),
      facebook: String(cfg.social_facebook || '').trim(),
      pinterest: String(cfg.social_pinterest || '').trim(),
      tiktok: String(cfg.social_tiktok || '').trim()
    };
  }

  function hydrateStoreFromConfig() {
    if (!state.store) state.store = {};
    if (!state.config) state.config = {};
    if (!state.store.storeName && state.config.site_name) {
      state.store.storeName = String(state.config.site_name).trim();
    }
    if (!state.store.heroBgUrl && state.config.vitrine_hero_bg_url) {
      state.store.heroBgUrl = String(state.config.vitrine_hero_bg_url).trim();
    }
    if (!state.store.logoUrl && state.config.store_logo_url) {
      state.store.logoUrl = String(state.config.store_logo_url).trim();
    }
    if (!state.store.content || !Object.keys(state.store.content).length) {
      state.store.content = buildVitrineContentFromConfig(state.config);
    }
    if (!state.store.social || !Object.keys(state.store.social).length) {
      state.store.social = buildSocialFromConfig(state.config);
    }
  }

  async function loadStore() {
    var brandRes = null;
    try { brandRes = await erpCall('getPublicBrand', {}); } catch (e) { /* ignore */ }
    if (brandRes && brandRes.success && brandRes.brand) {
      state.store = brandRes.brand;
      if (brandRes.brand.config && typeof brandRes.brand.config === 'object') {
        state.config = brandRes.brand.config;
      }
    }
    if (!state.config || !Object.keys(state.config).length) {
      try {
        var cfg = await erpCall('getConfig', {});
        if (cfg && cfg.success && cfg.config) state.config = cfg.config;
      } catch (e2) { /* ignore */ }
    }
    try {
      var sd = await erpCall('getStoreData', {});
      if (sd && sd.success) {
        if (sd.settings && typeof sd.settings === 'object') {
          state.config = Object.assign({}, state.config || {}, sd.settings);
        }
        if (!state.store.storeName && sd.storeName) state.store.storeName = sd.storeName;
        if (!state.store.logoUrl && sd.logoUrl) state.store.logoUrl = sd.logoUrl;
        if (!state.store.heroBgUrl && sd.heroBgUrl) state.store.heroBgUrl = sd.heroBgUrl;
        if (sd.content && Object.keys(sd.content).length) state.store.content = sd.content;
        if (sd.social && Object.keys(sd.social).length) state.store.social = sd.social;
        if (sd.colors) state.store.colors = sd.colors;
      }
    } catch (e3) { /* ignore */ }
    if (!state.store) state.store = {};
    hydrateStoreFromConfig();
    if (!state.store.heroBgUrl && state.config && state.config.vitrine_hero_bg_url) {
      state.store.heroBgUrl = String(state.config.vitrine_hero_bg_url).trim();
    }
    if (!state.store.logoUrl && state.config && state.config.store_logo_url) {
      state.store.logoUrl = String(state.config.store_logo_url).trim();
    }
    if ((!state.store.defaultLang || ['pt', 'fr', 'en', 'es'].indexOf(String(state.store.defaultLang).toLowerCase()) === -1) && state.config) {
      state.store.defaultLang = state.config.boutique_default_lang || state.config.default_lang || state.store.defaultLang || 'pt';
    }
    if (!state.store.colors) state.store.colors = {};
    if (!state.store.colors.main && state.config && state.config.color_main) {
      state.store.colors.main = state.config.color_main;
    }
    if (!state.store.colors.accent && state.config && state.config.color_accent) {
      state.store.colors.accent = state.config.color_accent;
    }
    if (state.store && state.store.defaultLang && !global._langSet) {
      var dl = String(state.store.defaultLang).toLowerCase();
      if (dl === 'pt' || dl === 'en' || dl === 'es' || dl === 'fr') state.lang = dl;
      else state.lang = 'pt';
      if (global.applyShopLang) global.applyShopLang(state.lang);
    }
    applyBrandUi();
    applyHeroTextColors();
    applyPromoBanner();
  }

  var SOCIAL_NET = { socInsta: 'instagram', socPin: 'pinterest', socTik: 'tiktok', socFb: 'facebook' };

  function wireSocialBtn(id, url) {
    var el = $(id);
    if (!el) return;
    if (global.IconUi && global.IconUi.wireSocialButton && SOCIAL_NET[id]) {
      global.IconUi.wireSocialButton(el, SOCIAL_NET[id]);
    }
    var u = String(url || '').trim();
    if (u) {
      el.style.display = '';
      el.disabled = false;
      el.onclick = function () { window.open(u, '_blank', 'noopener,noreferrer'); };
    } else {
      el.style.display = 'none';
      el.onclick = null;
    }
  }

  function applyHeroTextColors() {
    var cfg = state.config || {};
    function setColor(id, key) {
      var el = $(id);
      if (!el) return;
      var raw = String(cfg[key] || '').trim();
      if (raw && raw.charAt(0) !== '#') raw = '#' + raw;
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) el.style.color = raw;
      else el.style.removeProperty('color');
    }
    setColor('hEye', 'vitrine_hero_eyebrow_color');
    setColor('hTitle', 'vitrine_hero_title_color');
    setColor('hSub', 'vitrine_hero_sub_color');
  }

  function applyVitrineContent(lang) {
    lang = lang || state.lang || 'pt';
    applyHeroTextColors();
    var cfg = state.config || {};
    var c = state.store && state.store.content && state.store.content[lang];
    if (!c) c = {};
    function showBlock(key, defaultOn) {
      return cfgOn(key, defaultOn !== false);
    }
    function setText(id, val, html, displayKey, displayDefault) {
      var el = $(id);
      if (!el) return;
      if (!showBlock(displayKey, displayDefault)) {
        el.style.display = 'none';
        el.textContent = '';
        el.innerHTML = '';
        return;
      }
      el.style.display = '';
      if (!val) {
        el.textContent = '';
        return;
      }
      if (html) el.innerHTML = val;
      else el.textContent = val;
      el.dataset.erp = '1';
    }
    setText('hEye', c.hEye, false, 'vitrine_display_hero_eyebrow', true);
    setText('hTitle', c.hTitle, true, 'vitrine_display_hero_title', true);
    setText('hSub', c.hSub, false, 'vitrine_display_hero_sub', true);
    setText('hBtn1', c.hBtn1, false, 'vitrine_display_hero_buttons', true);
    setText('hBtn2', c.hBtn2, false, 'vitrine_display_hero_buttons', true);
    var heroBtns = document.querySelector('.hero-btns');
    if (heroBtns) {
      heroBtns.style.display = showBlock('vitrine_display_hero_buttons', true) ? '' : 'none';
    }
    setText('secLabel', c.shopLabel, false, 'vitrine_display_shop_header', true);
    setText('secTitle', c.shopTitle, false, 'vitrine_display_shop_header', true);
    var shopHdr = document.querySelector('.shop-header .sh-left');
    if (shopHdr) {
      shopHdr.style.display = showBlock('vitrine_display_shop_header', true) ? '' : 'none';
    }
    setText('fDesc', c.fDesc, false, 'vitrine_display_footer_desc', true);
    applyServicesStrip();
  }

  function applyServicesStrip() {
    var cfg = state.config || {};
    var show = cfgOn('vitrine_display_services', true);
    var sec = document.querySelector('.services-in-footer') || document.querySelector('.services');
    if (sec) sec.style.display = show ? '' : 'none';
  }

  function resetHeroBackgroundTuning(heroBg) {
    if (!heroBg) return;
    var host = heroBg.closest ? heroBg.closest('.hero') : null;
    var target = host || heroBg;
    target.style.removeProperty('--hero-bg-pos');
    target.style.removeProperty('--hero-motion-scale');
    target.style.removeProperty('--hero-bg-blur');
    target.style.removeProperty('--hero-photo-pos');
    target.style.removeProperty('--hero-photo-scale');
    target.style.removeProperty('--hero-photo-opacity');
    target.style.removeProperty('--hero-photo-width');
    target.style.removeProperty('--hero-photo-max-height');
    try { delete heroBg.dataset.heroProbe; } catch (e) { /* ignore */ }
  }

  function isCompactViewport() {
    return global.matchMedia && global.matchMedia('(max-width: 768px)').matches;
  }

  function getHeroBackgroundWidth() {
    var vw = Math.max(global.innerWidth || 0, document.documentElement.clientWidth || 0, 1280);
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var target = Math.round(vw * dpr * (isCompactViewport() ? 0.75 : 0.65));
    return Math.max(720, Math.min(target, isCompactViewport() ? 1000 : 1200));
  }

  function getHeroPhotoWidth() {
    var vw = Math.max(global.innerWidth || 0, document.documentElement.clientWidth || 0, 1280);
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var target = Math.round(vw * dpr * (isCompactViewport() ? 0.85 : 0.95));
    return Math.max(960, Math.min(target, isCompactViewport() ? 1200 : 1400));
  }

  function applyHeroTuningForRatio(heroBg, token, ratio) {
    if (!heroBg || heroBg.dataset.heroProbe !== token) return;
    resetHeroBackgroundTuning(heroBg);
    heroBg.dataset.heroProbe = token;
    var host = heroBg.closest ? heroBg.closest('.hero') : null;
    var target = host || heroBg;
    if (ratio < 0.72) {
      target.style.setProperty('--hero-bg-pos', 'center 10%');
      target.style.setProperty('--hero-motion-scale', isCompactViewport() ? '1.08' : '1.16');
      target.style.setProperty('--hero-bg-blur', isCompactViewport() ? '7px' : '14px');
      target.style.setProperty('--hero-media-shift-x', '4px');
      target.style.setProperty('--hero-media-shift-y', '-16px');
      target.style.setProperty('--hero-photo-pos', 'center 10%');
      target.style.setProperty('--hero-photo-scale', '1');
      target.style.setProperty('--hero-photo-opacity', '1');
      target.style.setProperty('--hero-photo-width', 'min(88vw,760px)');
      target.style.setProperty('--hero-photo-max-height', 'min(86vh,980px)');
    } else if (ratio < 0.95) {
      target.style.setProperty('--hero-bg-pos', 'center 18%');
      target.style.setProperty('--hero-motion-scale', isCompactViewport() ? '1.06' : '1.12');
      target.style.setProperty('--hero-bg-blur', isCompactViewport() ? '6px' : '12px');
      target.style.setProperty('--hero-media-shift-x', '5px');
      target.style.setProperty('--hero-media-shift-y', '-12px');
      target.style.setProperty('--hero-photo-pos', 'center 12%');
      target.style.setProperty('--hero-photo-scale', '1');
      target.style.setProperty('--hero-photo-opacity', '.99');
      target.style.setProperty('--hero-photo-width', 'min(92vw,920px)');
      target.style.setProperty('--hero-photo-max-height', 'min(84vh,960px)');
    } else if (ratio > 2.2) {
      target.style.setProperty('--hero-bg-pos', 'center center');
      target.style.setProperty('--hero-motion-scale', isCompactViewport() ? '1.1' : '1.18');
      target.style.setProperty('--hero-bg-blur', isCompactViewport() ? '5px' : '10px');
      target.style.setProperty('--hero-media-shift-x', '14px');
      target.style.setProperty('--hero-media-shift-y', '-3px');
      target.style.setProperty('--hero-photo-pos', 'center center');
      target.style.setProperty('--hero-photo-scale', '1');
      target.style.setProperty('--hero-photo-opacity', '.98');
      target.style.setProperty('--hero-photo-width', 'min(99vw,1900px)');
      target.style.setProperty('--hero-photo-max-height', 'min(64vh,740px)');
    } else if (ratio > 1.8) {
      target.style.setProperty('--hero-bg-pos', 'center center');
      target.style.setProperty('--hero-motion-scale', isCompactViewport() ? '1.08' : '1.16');
      target.style.setProperty('--hero-bg-blur', isCompactViewport() ? '5px' : '9px');
      target.style.setProperty('--hero-media-shift-x', '12px');
      target.style.setProperty('--hero-media-shift-y', '-4px');
      target.style.setProperty('--hero-photo-pos', 'center center');
      target.style.setProperty('--hero-photo-scale', '1.01');
      target.style.setProperty('--hero-photo-opacity', '.98');
      target.style.setProperty('--hero-photo-width', 'min(98vw,1760px)');
      target.style.setProperty('--hero-photo-max-height', 'min(72vh,820px)');
    } else {
      target.style.setProperty('--hero-bg-pos', 'center 28%');
      target.style.setProperty('--hero-motion-scale', isCompactViewport() ? '1.07' : '1.14');
      target.style.setProperty('--hero-bg-blur', isCompactViewport() ? '6px' : '10px');
      target.style.setProperty('--hero-media-shift-x', '9px');
      target.style.setProperty('--hero-media-shift-y', '-8px');
      target.style.setProperty('--hero-photo-pos', 'center 22%');
      target.style.setProperty('--hero-photo-scale', '1.005');
      target.style.setProperty('--hero-photo-opacity', '.98');
      target.style.setProperty('--hero-photo-width', 'min(96vw,1600px)');
      target.style.setProperty('--hero-photo-max-height', 'min(82vh,900px)');
    }
  }

  function applyHeroTuningFallback(heroBg, token) {
    applyHeroTuningForRatio(heroBg, token, 1.35);
  }

  function tuneHeroBackground(heroBg, heroPhoto, token) {
    if (!heroBg || !token) return;
    heroBg.dataset.heroProbe = token;
    function applyFromImage(img) {
      var w = img && img.naturalWidth || 0;
      var h = img && img.naturalHeight || 0;
      if (!w || !h) {
        applyHeroTuningFallback(heroBg, token);
        return;
      }
      applyHeroTuningForRatio(heroBg, token, w / h);
    }
    if (heroPhoto) {
      if (heroPhoto.complete) {
        applyFromImage(heroPhoto);
        return;
      }
      heroPhoto.onload = function () { applyFromImage(heroPhoto); };
      heroPhoto.onerror = function () { applyHeroTuningFallback(heroBg, token); };
      return;
    }
    applyHeroTuningFallback(heroBg, token);
  }

  function applyBrandUi() {
    var name = (state.store && state.store.storeName) ? state.store.storeName : 'AZAVISION';
    document.querySelectorAll('.brand-dynamic').forEach(function (el) {
      if (el.querySelector && el.querySelector('.brand-logo')) return;
      el.innerHTML = esc(name) + '<span class="brand-dot">.</span>';
    });
    document.querySelectorAll('.f-brand-dynamic').forEach(function (el) {
      el.innerHTML = esc(name) + '<span>.</span>';
    });
    var navLogo = document.querySelector('.brand-logo');
    var footLogo = document.querySelector('.f-logo');
    var localNav = 'icons/logo-nav.png';
    var localFoot = 'icons/logo.png';
    if (navLogo) {
      navLogo.setAttribute('data-fallback', localNav);
      var remoteNav = (state.store && state.store.logoUrl) ? optimizeImageUrl(state.store.logoUrl, 400) : '';
      navLogo.src = remoteNav || localNav;
      navLogo.style.display = '';
    }
    if (footLogo) {
      footLogo.setAttribute('data-fallback', localFoot);
      var remoteFoot = (state.store && state.store.logoUrl) ? optimizeImageUrl(state.store.logoUrl, 300) : '';
      footLogo.src = remoteFoot || localFoot;
      footLogo.style.display = '';
    }
    if (state.store && state.store.colors) {
      var root = document.documentElement;
      if (state.store.colors.main) root.style.setProperty('--ink', state.store.colors.main);
      if (state.store.colors.accent) root.style.setProperty('--gold', state.store.colors.accent);
    }
    var heroBg = document.querySelector('.hero-bg');
    var heroPhoto = $('heroPhoto');
    var heroUrl = (state.store && state.store.heroBgUrl) || (state.config && state.config.vitrine_hero_bg_url) || '';
    if (heroBg && heroUrl) {
      var tunedHeroPhotoUrl = String(optimizeImageUrl(heroUrl, getHeroPhotoWidth()) || heroUrl).replace(/"/g, '');
      heroBg.style.backgroundImage = '';
      preloadHeroImage(tunedHeroPhotoUrl);
      if (heroPhoto) {
        heroPhoto.src = tunedHeroPhotoUrl;
        heroPhoto.style.display = '';
      }
      tuneHeroBackground(heroBg, heroPhoto, tunedHeroPhotoUrl);
    } else if (heroBg) {
      heroBg.style.backgroundImage = '';
      resetHeroBackgroundTuning(heroBg);
      if (heroPhoto) {
        heroPhoto.removeAttribute('src');
        heroPhoto.style.display = 'none';
      }
    }
    var social = (state.store && state.store.social) || {};
    wireSocialBtn('socInsta', social.instagram);
    wireSocialBtn('socPin', social.pinterest);
    wireSocialBtn('socTik', social.tiktok);
    wireSocialBtn('socFb', social.facebook);
    if (state.store && state.store.tagline && $('fDesc') && !$('fDesc').dataset.erp) {
      $('fDesc').textContent = state.store.tagline;
      $('fDesc').dataset.erp = '1';
    }
    applyVitrineContent(state.lang);
  }

  function fillPromoPlaceholders(text) {
    var cfg = state.config || {};
    return String(text || '')
      .replace(/\{\{\s*pct\s*\}\}/gi, String(cfg.announcement_promo_pct || '').trim())
      .replace(/\{\{\s*pct2\s*\}\}/gi, String(cfg.announcement_promo_pct_2 || '').trim())
      .replace(/\{\{\s*code\s*\}\}/gi, String(cfg.announcement_promo_code || '').trim())
      .replace(/\{\{\s*amount\s*\}\}/gi, String(cfg.announcement_promo_amount_eur || '').trim())
      .replace(/\{\{\s*min_cart\s*\}\}/gi, String(cfg.announcement_promo_min_cart_eur || '').trim())
      .replace(/\{\{\s*valid_until\s*\}\}/gi, String(cfg.announcement_promo_valid_until || '').trim())
      .replace(/\{\{\s*promo_label\s*\}\}/gi, String(cfg.announcement_promo_label || '').trim());
  }

  function announcementActive() {
    var cfg = state.config || {};
    if (!cfgOn('announcement_enabled', false)) return false;
    var now = new Date();
    var ds = String(cfg.announcement_date_start || '').trim();
    if (ds) {
      var d1 = new Date(ds);
      if (!isNaN(d1.getTime()) && now < d1) return false;
    }
    var de = String(cfg.announcement_date_end || '').trim();
    if (de) {
      var d2 = new Date(de);
      if (!isNaN(d2.getTime())) {
        d2.setHours(23, 59, 59, 999);
        if (now > d2) return false;
      }
    }
    return true;
  }

  function resolvePromoBarText() {
    var cfg = state.config || {};
    if (!cfgOn('promo_bar_display', true)) return '';

    var annOn = announcementActive();
    var annEnabled = cfgOn('announcement_enabled', false);
    var annDisplay = cfgOn('announcement_display', true);

    if (annOn && annEnabled && annDisplay) {
      if (String(cfg.announcement_text || '').trim()) {
        return fillPromoPlaceholders(cfg.announcement_text);
      }
      if (cfgOn('announcement_show_default', true) && String(cfg.announcement_promo_code || '').trim()) {
        return '✦ CODE : ' + String(cfg.announcement_promo_code).trim() + ' ✦';
      }
      return '';
    }

    if (cfgOn('promo_banner_enabled', false)) {
      if (String(cfg.promo_banner_text || '').trim()) {
        return fillPromoPlaceholders(cfg.promo_banner_text);
      }
    }

    if (cfgOn('promo_banner_show_default', true)) {
      return t().promo || '';
    }
    return '';
  }

  function applyPromoBanner() {
    var cfg = state.config || {};
    var text = resolvePromoBarText();
    var bar = document.querySelector('.promo-bar');
    if (bar) bar.style.display = text ? '' : 'none';
    if (!text) return;
    var mq = $('mq');
    if (mq) {
      var annMarquee = cfgOn('announcement_marquee', true);
      var annOn = announcementActive() && cfgOn('announcement_enabled', false) && cfgOn('announcement_display', true);
      var useMarquee = annOn ? annMarquee : true;
      if (useMarquee) mq.style.removeProperty('animation');
      else mq.style.animation = 'none';
    }
    ['mq1', 'mq2', 'mq3', 'mq4'].forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = text;
    });
  }

  async function loadCategories() {
    try {
      var res = await erpCall('getCategories', {});
      var rows = Array.isArray(res) ? res : (res.categories || []);
      state.categories = rows.filter(function (c) {
        var st = String(c.catalogo_status || 'publicado').toLowerCase();
        return st === 'publicado' || st === '';
      });
    } catch (e) { state.categories = []; }
  }

  function buildProductFilters() {
    var filters = { lite: true, pageSize: PAGE_SIZE };
    if (state.cat === NAV_SALE) {
      filters.promo_only = true;
    } else if (state.cat === NAV_NEW) {
      filters.sort = 'date_desc';
    } else if (state.cat !== 'all') {
      var catName = resolveCategoryName(state.cat);
      if (catName) filters.categoria = catName;
    }
    var q = ($('srchIn') && $('srchIn').value) ? $('srchIn').value.trim() : '';
    if (q) filters.search = q;
    var sort = $('sortSel') ? $('sortSel').value : 'def';
    if (sort === 'asc') filters.sort = 'price_asc';
    else if (sort === 'dsc') filters.sort = 'price_desc';
    else if (sort === 'rat') filters.sort = 'date_desc';
    return filters;
  }

  function catalogCacheKey(filters) {
    try {
      return SS_CATALOG_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(filters || {})))).slice(0, 120);
    } catch (e) {
      return SS_CATALOG_PREFIX + 'default';
    }
  }

  function tryRestoreCatalogCache() {
    if (!apiUrlConfigured()) return false;
    try {
      var key = catalogCacheKey(buildProductFilters());
      var raw = sessionStorage.getItem(key);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.ts || Date.now() - parsed.ts > SS_CATALOG_TTL_MS) return false;
      if (!parsed.products || !parsed.products.length) return false;
      state.products = parsed.products.map(mapProduct);
      state.productsTotal = parsed.total != null ? parsed.total : state.products.length;
      state.productsHasMore = !!parsed.hasMore;
      state.productsPage = parsed.page || 1;
      state.productsLoading = false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function writeCatalogCache(filters, res, mapped) {
    if (!mapped || !mapped.length) return;
    try {
      var key = catalogCacheKey(filters);
      sessionStorage.setItem(key, JSON.stringify({
        ts: Date.now(),
        products: mapped,
        total: res && res.total != null ? res.total : mapped.length,
        hasMore: !!(res && res.hasMore),
        page: filters.page || 1
      }));
    } catch (e) { /* quota */ }
  }

  async function loadProducts(append) {
    var filters = buildProductFilters();
    filters.page = append ? state.productsPage + 1 : 1;
    filters.pageSize = PAGE_SIZE;

    if (!append) {
      if (!state.products.length) state.productsLoading = true;
    } else {
      state.productsLoadingMore = true;
      renderLoadMore();
    }

    var res = await erpCall('getProducts', filters);
    if (!res || !res.success) throw new Error((res && res.error) || 'getProducts');
    var mapped = (res.products || []).map(mapProduct);
    if (append) {
      state.products = state.products.concat(mapped);
      state.productsPage = filters.page;
    } else {
      state.products = mapped;
      state.productsPage = 1;
    }
    state.productsTotal = res.total != null ? res.total : state.products.length;
    state.productsHasMore = !!res.hasMore;
    state.productsLoading = false;
    state.productsLoadingMore = false;
    if (!append) writeCatalogCache(filters, res, mapped);
    preloadProductImages(append ? mapped : state.products, append ? 6 : 12);
    return res;
  }

  async function loadMoreProducts() {
    if (state.productsLoadingMore || !state.productsHasMore || !apiUrlConfigured()) return;
    try {
      await loadProducts(true);
      renderGrid();
    } catch (e) {
      state.productsLoadingMore = false;
      renderLoadMore();
      global.toast((t().errorPrefix || '') + e.message, 'e');
    }
  }

  function showLoader(on) {
    showProductsLoader(on);
  }

  function showProductsLoader(on) {
    var el = $('shopLoader');
    if (el) el.style.display = on ? 'flex' : 'none';
  }

  function showApiBanner(on) {
    var el = $('apiBanner');
    if (el) el.style.display = on ? 'block' : 'none';
  }

  var _refreshProductsT;
  function refreshProductsDebounced() {
    clearTimeout(_refreshProductsT);
    _refreshProductsT = setTimeout(function () { refreshProducts(); }, SEARCH_DEBOUNCE_MS);
  }

  async function refreshProducts() {
    clearTimeout(_refreshProductsT);
    if (!apiUrlConfigured()) {
      state.loading = false;
      state.productsLoading = false;
      showApiBanner(true);
      render();
      return;
    }
    state.productsLoading = true;
    showProductsLoader(true);
    renderGrid();
    try {
      await loadProducts(false);
      showApiBanner(false);
    } catch (e) {
      global.toast((t().errorPrefix || '') + e.message, 'e');
      if (!state.products.length) state.products = [];
    }
    state.productsLoading = false;
    showProductsLoader(false);
    renderNav();
    renderFooterShop();
    render();
  }

  function getCatList() {
    var list = [{ id: 'all', label: t().cats.all, icon: '✦' }];
    state.categories.forEach(function (c) {
      list.push({ id: normalizeCat(c.nome), label: c.nome, icon: '◆', nome: c.nome });
    });
    if (list.length === 1) {
      var seen = {};
      state.products.forEach(function (p) {
        if (p.cat && !seen[p.catKey]) {
          seen[p.catKey] = 1;
          list.push({ id: p.catKey, label: p.cat, icon: '◆' });
        }
      });
    }
    return list;
  }

  function renderCats() {
    $('catRow').innerHTML = getCatList().map(function (c) {
      var active = state.cat === c.id ? ' on' : '';
      return '<button class="cat-pill' + active + '" onclick="Shop.selectCat(\'' + esc(c.id).replace(/'/g, "\\'") + '\')">' +
        c.icon + ' ' + esc(c.label) + '</button>';
    }).join('');
  }

  function getList() {
    var q = ($('srchIn') && $('srchIn').value || '').toLowerCase();
    var sort = $('sortSel') ? $('sortSel').value : 'def';
    if (state.cat === NAV_SALE) sort = sort === 'def' ? 'dsc' : sort;
    return state.products
      .filter(function (p) {
        if (state.cat === NAV_SALE) return !!p.old;
        if (state.cat === NAV_NEW || state.cat === 'all') return true;
        return p.catKey === state.cat || normalizeCat(p.cat) === state.cat;
      })
      .filter(function (p) {
        if (!q) return true;
        return nm(p).toLowerCase().indexOf(q) >= 0 || desc(p).toLowerCase().indexOf(q) >= 0;
      })
      .sort(function (a, b) {
        if (sort === 'asc') return a.price - b.price;
        if (sort === 'dsc') return b.price - a.price;
        if (sort === 'rat') return (b.rate || 0) - (a.rate || 0);
        return 0;
      });
  }

  function renderSkeletonCards(count) {
    var n = count || 8;
    var html = '';
    for (var i = 0; i < n; i++) {
      html += '<div class="card card-skeleton" aria-hidden="true">' +
        '<div class="card-img skeleton-block"></div>' +
        '<div class="card-info"><div class="skeleton-line w80"></div><div class="skeleton-line w50"></div></div></div>';
    }
    return html;
  }

  function renderProductCard(p, idx) {
    var b = badge(p);
    var faved = state.wish.some(function (x) { return x.id === p.id; });
    var pid = esc(p.id).replace(/'/g, "\\'");
    return '<div class="card" onclick="Shop.openQv(\'' + pid + '\')">' +
      '<div class="card-img">' +
      imgHtml(p.img, nm(p), {
        eager: idx < 6,
        srcset: p.imgSrcset || '',
        fallback: p.imgMd || p.imgLg || ''
      }) +
      '<div class="card-overlay"><div class="ov-btns">' +
      '<button class="btn-qv" onclick="event.stopPropagation();Shop.openQv(\'' + pid + '\')">' + esc(t().qv) + '</button>' +
      '<button class="btn-add-ov" onclick="Shop.addCart(\'' + pid + '\',\'\',\'\');event.stopPropagation()">' +
      '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg></button>' +
      '</div></div>' +
      (b ? '<span class="badge ' + ((b.indexOf('ouveau') >= 0 || b.indexOf('ovo') >= 0) ? 'badge-n' : 'badge-s') + '">' + esc(b) + '</span>' : '') +
      '<button class="btn-fav ' + (faved ? 'faved' : '') + '" onclick="Shop.toggleWish(\'' + pid + '\');event.stopPropagation()">' +
      '<svg fill="' + (faved ? 'currentColor' : 'none') + '" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg></button>' +
      '</div><div class="card-info">' +
      '<h3 class="card-name">' + esc(nm(p)) + '</h3>' +
      '<p class="card-stars">' + stars(p.rate) + ' <span>(' + (p.rev || 0) + ' ' + esc(t().reviews) + ')</span></p>' +
      '<div class="card-price"><span class="price-c">' + p.price.toFixed(2) + ' €</span>' +
      (p.old ? '<span class="price-o">' + p.old.toFixed(2) + ' €</span>' : '') + '</div>' +
      (productColorOptions(p).length ? '<div class="swatches">' + productColorOptions(p).map(function (c) {
        return '<span class="sw" style="' + colorSwatchStyle(c) + '" title="' + esc(colorDisplayName(c)) + '"></span>';
      }).join('') + '</div>' : '') + '</div></div>';
  }

  function renderLoadMore() {
    var wrap = $('gridLoadMore');
    if (!wrap) return;
    if (!state.productsHasMore && !state.productsLoadingMore) {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      return;
    }
    wrap.style.display = 'flex';
    wrap.innerHTML = '<button type="button" class="btn-load-more" onclick="Shop.loadMoreProducts()" ' +
      (state.productsLoadingMore ? 'disabled' : '') + '>' +
      esc(state.productsLoadingMore ? (t().loadMoreLoading || '…') : (t().loadMore || '…')) +
      '</button>';
  }

  function renderGrid() {
    var grid = $('grid');
    if (!grid) return;
    if (state.productsLoading && !state.products.length) {
      grid.innerHTML = renderSkeletonCards(8);
      if ($('resCount')) $('resCount').textContent = '…';
      renderLoadMore();
      return;
    }
    var list = getList();
    var n = list.length;
    var total = state.productsTotal > 0 ? state.productsTotal : n;
    if ($('resCount')) {
      $('resCount').textContent = total + ' ' + (total > 1 ? t().plural : t().single);
    }
    if (!n && !state.productsLoading) {
      grid.innerHTML = '<div class="no-res"><h3>' + esc(t().noT) + '</h3><p>' + esc(t().noD) + '</p>' +
        '<button class="btn-gold" style="margin:0 auto;" onclick="Shop.resetAll()">' + esc(t().noBtn) + '</button></div>';
      renderLoadMore();
      return;
    }
    grid.innerHTML = list.map(function (p, idx) { return renderProductCard(p, idx); }).join('');
    renderLoadMore();
  }

  function render() {
    renderCats();
    updateNavActive();
    renderGrid();
  }

  function cartCount() { return state.cart.reduce(function (s, i) { return s + i.qty; }, 0); }
  function cartSub() { return state.cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0); }
  function currentDiscount(sub) {
    var base = sub == null ? cartSub() : sub;
    if (state.couponTipo === 'percent' && state.discPct > 0) {
      return Math.min(base, (base * state.discPct) / 100);
    }
    return Math.min(base, parseFloat(state.discAmount) || 0);
  }
  function clearPromoState(opts) {
    state.discAmount = 0;
    state.discPct = 0;
    state.couponTipo = '';
    state.couponCode = '';
    if (!opts || !opts.keepInput) state.promo = '';
  }
  async function refreshActivePromo(opts) {
    if (!state.couponCode || !apiUrlConfigured()) return false;
    var sub = cartSub();
    if (!sub) {
      clearPromoState({ keepInput: true });
      return false;
    }
    try {
      var res = await erpCall('validateCoupon', { code: state.couponCode, total: sub });
      if (res && res.valid) {
        var discountValue = parseFloat(res.discount) || 0;
        state.couponCode = res.codigo || state.couponCode;
        state.couponTipo = res.tipo || '';
        state.discAmount = discountValue;
        state.discPct = res.tipo === 'percent' && sub > 0 ? (discountValue / sub) * 100 : 0;
        return true;
      }
      clearPromoState({ keepInput: true });
      if (!(opts && opts.silent)) global.toast((res && res.error) || t().promoErr, 'i');
      return false;
    } catch (e) {
      if (!(opts && opts.silent)) global.toast(e.message, 'e');
      return false;
    }
  }

  function updBadge() {
    var n = cartCount();
    if ($('cBadge')) { $('cBadge').textContent = n; $('cBadge').style.display = n ? 'flex' : 'none'; }
    if ($('cDN')) $('cDN').textContent = n;
    if ($('mobCartBadge')) {
      $('mobCartBadge').textContent = n;
      $('mobCartBadge').style.display = n ? 'flex' : 'none';
    }
    var wn = state.wish.length;
    if ($('wBadge')) { $('wBadge').textContent = wn; $('wBadge').style.display = wn ? 'flex' : 'none'; }
    if ($('wDN')) $('wDN').textContent = wn;
  }

  async function addCart(id, sz, cl) {
    var p = state.products.find(function (x) { return x.id === id; });
    if (!p) return;
    if (!p.disponivel) {
      global.toast(t().soldOut, 'e');
      return;
    }
    var sizes = productSizes(p);
    var size = normalizeOptionValue(sz);
    var color = normalizeOptionValue(cl);
    if (!size && !hasSizeOptions(p)) size = normalizeOptionValue(sizes[0]) || (t().oneSize || '—');
    if (!color && !hasColorOptions(p)) color = normalizeOptionValue(productColorOptions(p)[0]) || '—';
    if (requiresVariantSelection(p) && !hasValidVariantSelection(p, size, color)) {
      openQv(id);
      global.toast(t().selectOptionsNotice, 'i');
      return;
    }
    var variant = findVariant(p, size, color);
    var price = variantPrice(p, variant);
    var varianteId = variant ? variant.variante_id : '';
    var lineImg = variantImageUrl(p, variant, 200) || p.imgSm || p.img;

    if (apiUrlConfigured()) {
      try {
        var addRes = await erpCall('addToCart', {
          cartId: state.cartId || undefined,
          clientId: state.clientId || '',
          produto_id: p.produto_id,
          variante_id: varianteId,
          tamanho: size,
          cor: color,
          quantidade: 1,
          preco: price
        });
        if (addRes && addRes.success && addRes.cartId) {
          state.cartId = addRes.cartId;
          saveSession();
        }
      } catch (e) {
        global.toast('API panier : ' + e.message, 'e');
      }
    }

    var key = p.id + '-' + size + '-' + color;
    var ex = state.cart.find(function (x) { return x.key === key; });
    if (ex) ex.qty++;
    else {
      state.cart.push({
        key: key,
        id: p.id,
        produto_id: p.produto_id,
        variante_id: varianteId,
        fr: p.fr,
        pt: p.pt,
        en: p.en,
        es: p.es,
        img: lineImg,
        size: size,
        color: color,
        qty: 1,
        price: price
      });
    }
    updBadge();
    await refreshActivePromo({ silent: true });
    global.toast(t().tAdd.replace('{n}', nm(p)), 's');
    if ($('cartBg') && $('cartBg').classList.contains('open')) renderCart();
    if ($('coBg') && $('coBg').classList.contains('open') && !state.ordered) renderCo();
  }

  async function remCart(key) {
    var it = state.cart.find(function (x) { return x.key === key; });
    state.cart = state.cart.filter(function (x) { return x.key !== key; });
    if (apiUrlConfigured() && state.cartId && it && it.variante_id) {
      erpCall('removeFromCart', { cartId: state.cartId, variante_id: it.variante_id }).catch(function () {});
    }
    updBadge();
    await refreshActivePromo({ silent: true });
    global.toast(t().tRem, 'i');
    renderCart();
    if ($('coBg') && $('coBg').classList.contains('open') && !state.ordered) renderCo();
  }

  var _cartQtyTimers = {};
  function scheduleCartQtySync(key, varianteId, qty) {
    if (!apiUrlConfigured() || !state.cartId || !varianteId) return;
    clearTimeout(_cartQtyTimers[key]);
    _cartQtyTimers[key] = setTimeout(function () {
      erpCall('updateCartQty', { cartId: state.cartId, variante_id: varianteId, quantidade: qty }).catch(function (e) {
        global.toast('Panier : ' + e.message, 'e');
      });
    }, CART_QTY_DEBOUNCE_MS);
  }

  async function updQty(key, d) {
    var it = state.cart.find(function (x) { return x.key === key; });
    if (!it) return;
    var newQty = Math.max(1, it.qty + d);
    it.qty = newQty;
    scheduleCartQtySync(key, it.variante_id, newQty);
    await refreshActivePromo({ silent: true });
    renderCart();
    if ($('coBg') && $('coBg').classList.contains('open') && !state.ordered) renderCo();
  }

  function cartLineFromItem_(it, p) {
    var size = it.tamanho || productSizes(p)[0];
    var color = it.cor || (p.colors && p.colors[0]) || '—';
    var cartVar = findVariant(p, size, color);
    var cartImg = variantImageUrl(p, cartVar, 200) || p.imgSm || p.img || placeholderImage();
    var key = p.id + '-' + size + '-' + color;
    return {
      key: key,
      id: p.id,
      produto_id: p.produto_id,
      variante_id: it.variante_id || '',
      fr: p.fr,
      pt: p.pt,
      en: p.en,
      es: p.es,
      img: cartImg,
      size: size,
      color: color,
      qty: parseInt(it.quantidade, 10) || 1,
      price: parseFloat(it.preco) || p.price
    };
  }

  function minimalProductStub_(it) {
    var pid = it.produto_id;
    var label = pid || 'Article';
    return {
      id: pid,
      produto_id: pid,
      fr: label,
      pt: label,
      en: label,
      es: label,
      img: placeholderImage(),
      imgSm: placeholderImage(),
      colors: [it.cor || '—'],
      sizes: [it.tamanho || 'TU'],
      price: parseFloat(it.preco) || 0,
      variantes: it.variante_id ? [{ variante_id: it.variante_id, tamanho: it.tamanho, cor: it.cor }] : []
    };
  }

  async function syncCartFromServer() {
    if (!state.cartId || !apiUrlConfigured() || state.cart.length) return;
    try {
      var res = await erpCall('getCart', { cartId: state.cartId });
      if (!res || !res.success || !res.items || !res.items.length) return;
      state.cart = [];
      for (var i = 0; i < res.items.length; i++) {
        var it = res.items[i];
        var p = state.products.find(function (x) { return x.produto_id === it.produto_id; });
        if (!p) p = minimalProductStub_(it);
        state.cart.push(cartLineFromItem_(it, p));
      }
      updBadge();
    } catch (e2) { /* ignore */ }
  }

  function openCart() { $('cartBg').classList.add('open'); renderCart(); updateScrollLock(); }
  function closeCart() { $('cartBg').classList.remove('open'); updateScrollLock(); }

  function renderCart() {
    var db = $('cartDb'), df = $('cartDf');
    if ($('cDN')) $('cDN').textContent = cartCount();
    if (!state.cart.length) {
      db.innerHTML = '<div class="empty"><span class="empty-ico">🛍️</span><p class="empty-txt">' + esc(t().cartEmpty) + '</p>' +
        '<button class="btn-gold" style="font-size:9px;" onclick="Shop.closeCart()">' + esc(t().contShopping) + '</button></div>';
      df.style.display = 'none';
      return;
    }
    db.innerHTML = state.cart.map(function (it) {
      return '<div class="ci">' +
        imgHtml(it.img, nm(it), { className: '', fallback: it.img }) +
        '<div class="ci-body"><div><p class="ci-name">' + esc(nm(it)) + '</p>' +
        '<p class="ci-meta">' + esc(t().sizeMeta) + ': ' + esc(it.size) + ' · ' + esc(colorDisplayName(it.color)) + ' ' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;vertical-align:middle;' + colorSwatchStyle(it.color) + '"></span></p></div>' +
        '<div class="ci-bot"><div class="qty">' +
        '<button onclick="Shop.updQty(\'' + esc(it.key).replace(/'/g, "\\'") + '\',-1)">−</button><span>' + it.qty + '</span>' +
        '<button onclick="Shop.updQty(\'' + esc(it.key).replace(/'/g, "\\'") + '\',1)">+</button></div>' +
        '<div class="ci-pr"><p class="ci-price">' + (it.price * it.qty).toFixed(2) + ' €</p>' +
        '<button class="btn-rm" onclick="Shop.remCart(\'' + esc(it.key).replace(/'/g, "\\'") + '\')">' + esc(t().remove) + '</button></div></div></div></div>';
    }).join('');

    df.style.display = 'block';
    var sub = cartSub();
    var disc = currentDiscount(sub);
    var afterDisc = Math.max(0, sub - disc);
    var ship = state.couponTipo === 'free_shipping' ? 0 : (afterDisc >= shippingThreshold() ? 0 : shippingFlat());
    var pct = Math.min(100, (afterDisc / shippingThreshold()) * 100);

    df.innerHTML =
      (shippingEnabled() ? (
      '<div class="ship-bar"><p class="ship-msg ' + (afterDisc >= shippingThreshold() ? 'ok' : '') + '">' +
      (afterDisc >= shippingThreshold() ? esc(t().shipOk) : esc(t().shipNeed.replace('{n}', (shippingThreshold() - afterDisc).toFixed(2)))) +
      '</p><div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div></div>'
      ) : '') +
      '<div class="promo-sec"><span class="promo-lbl">' + esc(t().promoLbl) + '</span>' +
      '<div class="promo-row"><input id="promoIn" type="text" placeholder="' + esc(t().promoPH) + '" value="' + esc(state.promo) + '" oninput="Shop.setPromo(this.value)"/>' +
      '<button class="btn-validate" onclick="Shop.applyPromo()">' + esc(t().promoBtn) + '</button></div><p id="promoMsg"></p></div>' +
      '<div class="totals">' +
      '<div class="t-row"><span>' + esc(t().subT) + '</span><span>' + sub.toFixed(2) + ' €</span></div>' +
      (disc > 0 ? '<div class="t-row disc"><span>' + esc(t().discT) + '</span><span>- ' + disc.toFixed(2) + ' €</span></div>' : '') +
      '<div class="t-row"><span>' + esc(t().shipT) + '</span><span>' + (ship === 0 ? esc(t().shipFree) : ship.toFixed(2) + ' €') + '</span></div>' +
      '<div class="t-row grand"><span>' + esc(t().totalT) + '</span><span>' + (afterDisc + ship).toFixed(2) + ' €</span></div></div>' +
      '<button class="btn-checkout" onclick="Shop.openCo()">' + esc(t().checkoutBtn) + '</button>';
  }

  function setPromo(v) { state.promo = String(v || '').toUpperCase(); }

  async function applyPromo() {
    var el = $('promoMsg');
    var code = (state.promo || ($('promoIn') && $('promoIn').value) || '').trim().toUpperCase();
    if (!code) return;
    if (!apiUrlConfigured()) {
      if (code === 'BIENVENUE10') {
        state.couponCode = code;
        state.couponTipo = 'percent';
        state.discPct = 10;
        state.discAmount = 0;
        if (el) { el.className = 'promo-ok'; el.textContent = t().promoOk.replace('{n}', '10'); }
      } else {
        clearPromoState({ keepInput: true });
        if (el) { el.className = 'promo-err'; el.textContent = t().promoErr; }
      }
      renderCart();
      return;
    }
    try {
      var res = await erpCall('validateCoupon', { code: code, total: cartSub() });
      if (res && res.valid) {
        var discountValue = parseFloat(res.discount) || 0;
        state.couponCode = res.codigo || code;
        state.couponTipo = res.tipo || 'percent';
        state.discAmount = discountValue;
        state.discPct = res.tipo === 'percent' && cartSub() > 0 ? (discountValue / cartSub()) * 100 : 0;
        if (el) { el.className = 'promo-ok'; el.textContent = t().promoOk.replace('{n}', res.discount); }
        global.toast(t().promoOk.replace('{n}', res.discount), 's');
      } else {
        clearPromoState({ keepInput: true });
        if (el) { el.className = 'promo-err'; el.textContent = (res && res.error) || t().promoErr; }
      }
    } catch (e) {
      if (el) { el.className = 'promo-err'; el.textContent = e.message; }
    }
    renderCart();
  }

  function toggleWish(id) {
    var p = state.products.find(function (x) { return x.id === id; });
    if (!p) return;
    var was = state.wish.some(function (x) { return x.id === id; });
    state.wish = was ? state.wish.filter(function (x) { return x.id !== id; }) : state.wish.concat([p]);
    saveSession();
    if (state.clientId && apiUrlConfigured()) {
      if (was) erpCall('removeFromWishlist', { clientId: state.clientId, produtoId: p.produto_id }).catch(function () {});
      else erpCall('addToWishlist', { clientId: state.clientId, produtoId: p.produto_id }).catch(function () {});
    }
    updBadge();
    global.toast(was ? t().tFavR : t().tFavA, was ? 'i' : 's');
    render();
    if ($('wishBg') && $('wishBg').classList.contains('open')) renderWish();
  }

  async function loadWishlistServer() {
    if (!state.clientId || !apiUrlConfigured()) return;
    try {
      var res = await erpCall('getWishlist', { clientId: state.clientId });
      if (res && res.success && res.wishlist) {
        res.wishlist.forEach(function (w) {
          var prod = w.produto || {};
          var mapped = mapProduct(prod);
          if (!state.wish.some(function (x) { return x.id === mapped.id; })) state.wish.push(mapped);
        });
        saveSession();
        updBadge();
      }
    } catch (e) { /* ignore */ }
  }

  function openWish() { $('wishBg').classList.add('open'); renderWish(); updateScrollLock(); }
  function closeWish() { $('wishBg').classList.remove('open'); updateScrollLock(); }

  function renderWish() {
    if ($('wDN')) $('wDN').textContent = state.wish.length;
    if (!state.wish.length) {
      $('wishDb').innerHTML = '<div class="empty"><span class="empty-ico">♥</span><p class="empty-txt">' + esc(t().wishEmpty) + '</p>' +
        '<button class="btn-gold" style="font-size:9px;" onclick="Shop.closeWish()">' + esc(t().wishBrowse) + '</button></div>';
      return;
    }
    $('wishDb').innerHTML = state.wish.map(function (it) {
      var pid = esc(it.id).replace(/'/g, "\\'");
      return '<div class="ci">' + imgHtml(it.img, nm(it), { fallback: it.imgMd || it.img }) +
        '<div class="ci-body"><div><p class="ci-name">' + esc(nm(it)) + '</p><p class="ci-price" style="margin-top:5px;">' + it.price.toFixed(2) + ' €</p></div>' +
        '<div class="ci-bot"><button class="btn-gold" style="font-size:8px;padding:8px 10px;" onclick="Shop.addWishlistToCart(\'' + pid + '\')">' + esc(t().addCart) + '</button>' +
        '<button class="btn-rm" onclick="Shop.toggleWish(\'' + pid + '\')">' + esc(t().remove) + '</button></div></div></div>';
    }).join('');
  }

  function addWishlistToCart(id) {
    var p = state.products.find(function (x) { return x.id === id; });
    if (!p) return;
    if (requiresVariantSelection(p)) {
      openQv(id);
      global.toast(t().selectOptionsNotice, 'i');
      return;
    }
    addCart(id, '', '');
    toggleWish(id);
  }

  async function openQv(id) {
    var p = state.products.find(function (x) { return x.id === id; });
    var needsDetail = p && (!desc(p) || ((productSizeOptions(p).length || productColorOptions(p).length) && !(p.variantes && p.variantes.length)));
    var needsGallery = p && (!p.gallery || p.gallery.length <= 1);
    if ((!p || needsDetail || needsGallery) && apiUrlConfigured()) {
      try {
        var res = await erpCall('getProduct', { id: id });
        if (res && res.success && res.product) {
          p = mapProduct(res.product);
          if (res.product.avaliacoes) {
            var revs = res.product.avaliacoes;
            if (revs.reviews) {
              p.rev = revs.reviews.length;
              p.rate = parseFloat(revs.average) || 0;
            }
          }
        }
      } catch (e) { /* ignore */ }
    }
    if (!p) return;
    state.qvProd = p;
    state.qvGalleryIndex = 0;
    state.qvSize = hasSizeOptions(p) ? '' : (normalizeOptionValue(productSizes(p)[0]) || (t().oneSize || '—'));
    state.qvColor = hasColorOptions(p) ? '' : (normalizeOptionValue((p.colors || [])[0]) || '—');
    state.qvGuide = false;
    state.qvViewMode = 'shop';
    renderQv();
    $('qvBg').classList.add('open');
    updateScrollLock();
  }

  function closeQv() { $('qvBg').classList.remove('open'); updateScrollLock(); }

  function setQvViewMode(mode) {
    state.qvViewMode = mode === 'photo' ? 'photo' : 'shop';
    renderQv();
  }

  function renderQvOptionsBlock(colorOptions, sizeOptions, canAdd) {
    var tm = t();
    if (!colorOptions.length && !sizeOptions.length) return '';
    var html = '<div class="qv-options-card"><p class="qv-options-head">' + esc(tm.qvOptionsHead || 'Personnalisez votre article') + '</p>';
    if (colorOptions.length) {
      html += '<div class="qv-opt-block"><div class="qv-opt-head"><span class="opt-label">' + esc(tm.colLbl) + '</span>' +
        '<span class="qv-opt-value' + (state.qvColor ? '' : ' missing') + '">' +
        esc(state.qvColor ? colorDisplayName(state.qvColor) : tm.selectColorPrompt) + '</span></div>' +
        '<div class="color-opts qv-color-opts">' + colorOptions.map(function (c) {
          var on = colorsMatch(state.qvColor, c) ? ' on' : '';
          var label = colorDisplayName(c);
          return '<button class="col-btn' + on + '" type="button" title="' + esc(label) + '" aria-label="' + esc(label) + '" style="' + colorSwatchStyle(c) + '" onclick="Shop.setQvColor(\'' + esc(c).replace(/'/g, "\\'") + '\')"></button>';
        }).join('') + '</div></div>';
    }
    if (sizeOptions.length) {
      html += '<div class="qv-opt-block"><div class="qv-opt-head"><span class="opt-label">' + esc(tm.szLbl) + '</span>' +
        '<button type="button" class="qv-size-guide" onclick="Shop.toggleQvGuide()">' + esc(tm.szGuide) + '</button></div>' +
        (state.qvGuide ? '<div class="size-guide"><span>' + esc(SIZE_LIST.join(' · ')) + '</span></div>' : '') +
        '<div class="size-opts qv-size-opts">' + sizeOptions.map(function (s) {
          return '<button class="sz-btn ' + (state.qvSize === s ? 'on' : '') + '" type="button" onclick="Shop.setQvSize(\'' + esc(s).replace(/'/g, "\\'") + '\')">' + esc(s) + '</button>';
        }).join('') + '</div></div>';
    }
    html += '<p class="qv-selection-note' + (canAdd ? ' ok' : '') + '">' + esc(canAdd ? tm.selectionReady : tm.selectOptionsNotice) + '</p></div>';
    return html;
  }

  function renderQv() {
    var p = state.qvProd;
    if (!p) return;
    var faved = state.wish.some(function (x) { return x.id === p.id; });
    var pid = esc(p.id).replace(/'/g, "\\'");
    var colorOptions = productColorOptions(p);
    var sizeOptions = productSizeOptions(p);
    var canAdd = hasValidVariantSelection(p, state.qvSize, state.qvColor);
    var activeVariant = canAdd ? findVariant(p, state.qvSize, state.qvColor) : null;
    var displayPrice = canAdd ? variantPrice(p, activeVariant) : p.price;
    var catLabel = p.cat || '';
    getCatList().forEach(function (c) {
      if (c.id === p.catKey) catLabel = c.label;
    });

    var gallery = productGalleryList(p);
    var gIdx = state.qvGalleryIndex || 0;
    if (gIdx >= gallery.length) gIdx = 0;
    state.qvGalleryIndex = gIdx;
    var variantImg = qvProductImage(p, state.qvSize, state.qvColor);
    var currentImg;
    if (gallery.length && gIdx > 0) {
      currentImg = gallery[gIdx].lg || gallery[gIdx].md || gallery[gIdx].url;
    } else if ((state.qvColor || state.qvSize) && variantImg && variantImg !== placeholderImage()) {
      currentImg = variantImg;
    } else if (gallery.length) {
      currentImg = gallery[gIdx].lg || gallery[gIdx].md || gallery[gIdx].url;
    } else {
      currentImg = variantImg;
    }

    var galleryHtml = '';
    if (gallery.length > 1) {
      galleryHtml =
        '<div class="qv-gallery-thumbs">' + gallery.map(function (g, i) {
          var thumb = g.md || g.url || '';
          return '<button type="button" class="qv-gthumb' + (i === gIdx ? ' on' : '') + '" onclick="event.stopPropagation();Shop.setQvGallery(' + i + ')">' +
            '<img src="' + esc(thumb) + '" alt=""/></button>';
        }).join('') + '</div>' +
        '<div class="qv-gallery-nav">' +
        '<button type="button" class="qv-gnav" onclick="event.stopPropagation();Shop.qvGalleryPrev()">‹</button>' +
        '<span class="qv-gcount">' + (gIdx + 1) + ' / ' + gallery.length + '</span>' +
        '<button type="button" class="qv-gnav" onclick="event.stopPropagation();Shop.qvGalleryNext()">›</button></div>';
    }

    var mode = state.qvViewMode === 'photo' ? 'photo' : 'shop';
    var tm = t();
    var modal = $('qvModal');
    modal.className = 'modal qv-modal qv-mode-' + mode;
    modal.innerHTML =
      '<button class="modal-close" onclick="Shop.closeQv()"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>' +
      '<div class="qv-view-tabs" role="tablist">' +
      '<button type="button" role="tab" class="qv-view-tab' + (mode === 'shop' ? ' on' : '') + '" aria-selected="' + (mode === 'shop' ? 'true' : 'false') + '" onclick="Shop.setQvViewMode(\'shop\')">' +
      esc(tm.qvModeShop || 'Photo & options') + '</button>' +
      '<button type="button" role="tab" class="qv-view-tab' + (mode === 'photo' ? ' on' : '') + '" aria-selected="' + (mode === 'photo' ? 'true' : 'false') + '" onclick="Shop.setQvViewMode(\'photo\')">' +
      esc(tm.qvModePhoto || 'Galerie photo') + '</button></div>' +
      '<div class="qv-layout">' +
      '<div class="qv-media-col">' +
      '<div class="m-img m-img-zoom" role="button" tabindex="0" title="' + esc(tm.imgZoomHint || 'Cliquez pour agrandir') + '" onclick="event.stopPropagation();Shop.openQvImageZoom()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();event.stopPropagation();Shop.openQvImageZoom()}">' +
      imgHtml(currentImg, nm(p), { eager: true, fallback: p.imgMd || p.imgLg || p.img }) +
      '<span class="m-img-zoom-badge" aria-hidden="true">🔍</span></div>' +
      galleryHtml +
      '<div class="qv-media-toolbar">' +
      '<button type="button" class="qv-media-btn" onclick="event.stopPropagation();Shop.openQvImageZoom()">' + esc(tm.imgZoomHint || 'Agrandir') + '</button></div>' +
      '<div class="qv-photo-cta">' +
      '<button type="button" class="qv-switch-shop" onclick="Shop.setQvViewMode(\'shop\')">' + esc(tm.qvSwitchShop || 'Choisir taille & couleur') + '</button></div>' +
      '</div>' +
      '<div class="qv-detail-col">' +
      '<div class="qv-head"><p class="m-cat">' + esc(catLabel) + '</p>' +
      '<h2 class="m-name">' + esc(nm(p)) + '</h2>' +
      '<p class="m-stars">' + stars(p.rate) + ' <span>(' + (p.rev || 0) + ')</span></p>' +
      '<div class="m-price"><span class="c">' + displayPrice.toFixed(2) + ' €</span>' +
      (p.old ? '<span class="o">' + p.old.toFixed(2) + ' €</span>' : '') + '</div></div>' +
      '<div class="tab-panel qv-desc"><p>' + esc(desc(p)) + '</p></div>' +
      renderQvOptionsBlock(colorOptions, sizeOptions, canAdd) +
      '<div class="m-cta">' +
      '<button class="btn-madd' + (canAdd ? '' : ' disabled') + '" ' + (canAdd ? 'onclick="Shop.addCart(\'' + pid + '\',\'' + esc(state.qvSize).replace(/'/g, "\\'") + '\',\'' + esc(state.qvColor).replace(/'/g, "\\'") + '\');Shop.closeQv()"' : 'type="button" disabled') + '>' + esc(tm.addSel) + '</button>' +
      '<button class="btn-mfav" onclick="Shop.toggleWish(\'' + pid + '\');Shop.renderQv()">' + (faved ? esc(tm.favAdded) : esc(tm.favAdd)) + '</button></div></div></div>';
  }

  function setQvSize(s) { state.qvSize = s; renderQv(); }
  function setQvColor(c) { state.qvColor = c; renderQv(); }
  function toggleQvGuide() { state.qvGuide = !state.qvGuide; renderQv(); }

  function setQvGallery(idx) {
    state.qvGalleryIndex = parseInt(idx, 10) || 0;
    renderQv();
  }

  function qvGalleryPrev() {
    var p = state.qvProd;
    if (!p) return;
    var len = productGalleryList(p).length;
    if (len <= 1) return;
    state.qvGalleryIndex = ((state.qvGalleryIndex || 0) - 1 + len) % len;
    renderQv();
  }

  function qvGalleryNext() {
    var p = state.qvProd;
    if (!p) return;
    var len = productGalleryList(p).length;
    if (len <= 1) return;
    state.qvGalleryIndex = ((state.qvGalleryIndex || 0) + 1) % len;
    renderQv();
  }

  function buildOrderItems() {
    return state.cart.map(function (it) {
      return {
        produto_id: it.produto_id,
        variante_id: it.variante_id || '',
        tamanho: it.size,
        cor: it.color,
        preco: it.price,
        quantidade: it.qty,
        nome: nm(it)
      };
    });
  }

  function orderTotals() {
    var sub = cartSub();
    var disc = currentDiscount(sub);
    var after = Math.max(0, sub - disc);
    var ship = state.couponTipo === 'free_shipping' ? 0 : (after >= shippingThreshold() ? 0 : shippingFlat());
    return { sub: sub, disc: disc, after: after, ship: ship, total: after + ship };
  }

  function checkoutTotalsHtml(totals) {
    var rows = '<div class="totals" style="margin:12px 0;">' +
      '<div class="t-row"><span>' + esc(t().subT) + '</span><span>' + totals.sub.toFixed(2) + ' €</span></div>';
    if (totals.disc > 0) {
      rows += '<div class="t-row disc"><span>' + esc(t().discT) + '</span><span>- ' + totals.disc.toFixed(2) + ' €</span></div>';
    }
    if (shippingEnabled() && totals.ship > 0) {
      rows += '<div class="t-row"><span>' + esc(t().shipT) + '</span><span>' + totals.ship.toFixed(2) + ' €</span></div>';
    } else if (shippingEnabled()) {
      rows += '<div class="t-row"><span>' + esc(t().shipT) + '</span><span>' + esc(t().shipFree) + '</span></div>';
    }
    rows += '<div class="t-row grand"><span>' + esc(t().totalT) + '</span><span>' + totals.total.toFixed(2) + ' €</span></div></div>';
    return rows;
  }

  function isStripeOn() {
    if (!STRIPE_PK) return false;
    if (state.config.pay_stripe_enabled === '0' || state.config.pay_stripe_enabled === 0) return false;
    return cfgOn('pay_stripe_enabled', true) && cfgOn('pay_show_stripe', true);
  }

  function defaultPayMethod() {
    if (isStripeOn()) return 'stripe';
    if (cfgOn('pay_cod_enabled', true)) return 'cod';
    return 'cod';
  }

  function stripeLocale_() {
    var L = state.lang || 'pt';
    if (L === 'pt') return 'pt';
    if (L === 'fr') return 'fr';
    if (L === 'es') return 'es';
    return 'en';
  }

  function stripeAmountCents_() {
    var totals = orderTotals();
    return Math.max(50, Math.round(totals.total * 100));
  }

  function paymentOptionsHtml() {
    var opts = [];
    if (isStripeOn()) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="stripe" ' + (state.payMethod === 'stripe' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'stripe\')"/> ' + esc(t().payStripePt || t().payStripe) + '</label>');
    }
    if (cfgOn('pay_show_cod', true) && cfgOn('pay_cod_enabled', true)) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="cod" ' + (state.payMethod === 'cod' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'cod\')"/> ' +
        esc(t().payCod) + '</label>');
    }
    if (cfgOn('pay_show_transfer', true)) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="transfer" ' + (state.payMethod === 'transfer' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'transfer\')"/> ' +
        esc(t().payTransfer) + '</label>');
    }
    if (cfgOn('pay_show_mbway', false) && String(state.config.pay_mbway_phone || '').trim()) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="mbway" ' + (state.payMethod === 'mbway' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'mbway\')"/> ' +
        esc(t().payMbway || 'MB Way') + '</label>');
    }
    if (cfgOn('pay_show_paypal', false) && String(state.config.pay_paypal_me || '').trim()) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="paypal" ' + (state.payMethod === 'paypal' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'paypal\')"/> ' +
        esc(t().payPaypal || 'PayPal') + '</label>');
    }
    if (!opts.length) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="cod" checked/> ' +
        esc(t().payContact) + '</label>');
    }
    return '<div class="pay-opts">' + opts.join('') + '</div>';
  }

  function setPayMethod(m) {
    if (m !== 'stripe') destroyStripeElement();
    state.payMethod = m;
    renderCo();
  }

  function openCo() {
    if (!state.clientId && !cfgOn('guest_checkout_enabled', true)) {
      global.toast(accT().loginRequired || t().guestCheckout || 'Inicie sessão para finalizar a compra.', 'i');
      state.accountView = 'login';
      openAccount();
      return;
    }
    closeCart();
    state.ordered = false;
    state.delStep = 0;
    state.payMethod = defaultPayMethod();
    prefillCheckoutFromProfile();
    renderCo();
    $('coBg').classList.add('open');
    updateScrollLock();
  }

  function closeCo() {
    $('coBg').classList.remove('open');
    destroyStripeElement();
    updateScrollLock();
  }

  function destroyStripeElement() {
    if (state.stripePaymentElement) {
      try { state.stripePaymentElement.unmount(); } catch (e) { /* ignore */ }
      state.stripePaymentElement = null;
    }
    state.stripeElements = null;
    state.stripeAmountCents = 0;
  }

  async function initStripeElement() {
    if (!STRIPE_PK || !global.Stripe || !isStripeOn()) return;
    var amountCents = stripeAmountCents_();
    if (state.stripePaymentElement && state.stripeAmountCents === amountCents && state.stripeElements) return;
    destroyStripeElement();
    if (!state.stripe) state.stripe = global.Stripe(STRIPE_PK);
    var currency = String(state.config.currency_code || 'eur').toLowerCase();
    var stripeTheme = getTheme() === 'light' ? 'stripe' : 'night';
    var elementsOpts = {
      mode: 'payment',
      amount: amountCents,
      currency: currency,
      locale: stripeLocale_(),
      appearance: { theme: stripeTheme }
    };
    if (cfgOn('stripe_pt_local_methods', true)) {
      elementsOpts.paymentMethodTypes = ['card', 'mb_way', 'multibanco'];
    }
    state.stripeElements = state.stripe.elements(elementsOpts);
    state.stripeAmountCents = amountCents;
    state.stripePaymentElement = state.stripeElements.create('payment', {
      layout: { type: 'tabs', defaultCollapsed: false }
    });
    var mount = $('stripe-payment-element');
    if (mount) {
      mount.innerHTML = '';
      state.stripePaymentElement.mount('#stripe-payment-element');
    }
  }

  function scheduleStripeMount_() {
    if (state.payMethod !== 'stripe' || !isStripeOn() || state.ordered) return;
    setTimeout(function () {
      initStripeElement().catch(function (e) {
        global.toast((t().errStripe || 'Stripe') + ': ' + e.message, 'e');
      });
    }, 0);
  }

  function paymentInstructionsHtml() {
    var cfg = state.config || {};
    var m = state.lastPayMethod;
    var amount = state.lastOrderTotal || '';
    var ref = '#' + (state.lastOrderId || '');
    var rows = [];
    if (m === 'transfer' && String(cfg.transfer_iban || '').trim()) {
      rows.push('<p style="font-size:11px;margin:4px 0;">' + esc(t().payInstrIban || 'Transferência para o IBAN') + ' : <strong>' + esc(cfg.transfer_iban) + '</strong></p>');
    } else if (m === 'mbway' && String(cfg.pay_mbway_phone || '').trim()) {
      rows.push('<p style="font-size:11px;margin:4px 0;">' + esc(t().payInstrMbway || 'Envie o pagamento MB Way para') + ' <strong>' + esc(cfg.pay_mbway_phone) + '</strong></p>');
    } else if (m === 'paypal' && String(cfg.pay_paypal_me || '').trim()) {
      var link = String(cfg.pay_paypal_me).trim();
      if (!/^https?:\/\//i.test(link)) link = 'https://paypal.me/' + link.replace(/^@/, '');
      if (amount) link = link.replace(/\/+$/, '') + '/' + amount;
      rows.push('<p style="margin:8px 0;"><a class="btn-gold" style="display:inline-block;text-decoration:none;padding:10px 18px;" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(t().payPaypalBtn || 'Pagar com PayPal') + '</a></p>');
    } else {
      return '';
    }
    rows.push('<p style="font-size:11px;margin:4px 0;">' + esc(t().payInstrAmount || 'Montante') + ' : <strong>' + esc(amount) + ' €</strong> · ' + esc(t().payInstrRef || 'Referência a indicar') + ' : <strong>' + esc(ref) + '</strong></p>');
    return '<div class="order-ref-card" style="margin-top:10px;"><p class="order-ref-label">' + esc(t().payInstrTitle || 'Instruções de pagamento') + '</p>' + rows.join('') + '</div>';
  }

  function invoiceLabels_() {
    return {
      receiptTitle: t().receiptTitle || 'Comprovativo',
      total: t().receiptTotal || 'Total c/ IVA',
      print: t().receiptPrint || 'Imprimir',
      download: t().receiptDownload || 'Descarregar PDF',
      moreItems: t().receiptMore || 'artigos',
      disclaimer: t().receiptDisclaimer || '',
      iva: t().receiptIva || 'IVA',
      fiscalPdf: t().fiscalPdf || 'Fatura oficial (PDF)'
    };
  }

  function receiptSectionHtml() {
    if (state.lastInvoiceLoading) {
      return '<div class="receipt-card"><p class="rc-loading">' + esc(t().receiptLoading || 'Préparation du reçu…') + '</p></div>';
    }
    if (state.lastInvoice && state.lastInvoice.success && global.InvoiceReceipt) {
      return global.InvoiceReceipt.previewHtml(state.lastInvoice, invoiceLabels_());
    }
    return '';
  }

  async function loadInvoiceForOrder(orderId, nome) {
    if (!orderId || !apiUrlConfigured()) return null;
    try {
      var res = await erpCall('getInvoiceData', orderAccessPayload({ orderId: orderId, nome: nome || state.form.name || '', lang: state.lang }));
      return res && res.success ? res : null;
    } catch (e) {
      return null;
    }
  }

  async function loadOrderReceipt() {
    if (!state.lastOrderId) return;
    state.lastInvoiceLoading = true;
    renderCo();
    state.lastInvoice = await loadInvoiceForOrder(state.lastOrderId, state.form.name);
    state.lastInvoiceLoading = false;
    if (state.lastInvoice && state.lastInvoice.html && global.InvoiceReceipt) {
      global.InvoiceReceipt.openPrintDocument(state.lastInvoice.html);
    } else {
      global.toast(t().receiptError || 'Comprovativo indisponível', 'e');
    }
    renderCo();
  }

  async function fetchLastInvoice() {
    if (!state.lastOrderId) return;
    state.lastInvoiceLoading = true;
    if (state.ordered) renderCo();
    state.lastInvoice = await loadInvoiceForOrder(state.lastOrderId, state.form.name);
    state.lastInvoiceLoading = false;
    if (state.ordered) renderCo();
  }

  function printInvoice() {
    var html = state.lastInvoice && state.lastInvoice.html;
    if (!html && state.lastOrderId) {
      loadInvoiceForOrder(state.lastOrderId, state.form.name).then(function (inv) {
        if (inv && inv.html && global.InvoiceReceipt) {
          state.lastInvoice = inv;
          global.InvoiceReceipt.openPrintDocument(inv.html);
        } else {
          global.toast(t().receiptError || 'Reçu indisponible', 'e');
        }
      });
      return;
    }
    if (html && global.InvoiceReceipt) global.InvoiceReceipt.openPrintDocument(html);
    else global.toast(t().receiptError || 'Reçu indisponible', 'e');
  }

  function downloadInvoice() {
    printInvoice();
  }

  async function printOrderInvoice(orderId) {
    orderId = String(orderId || '').trim();
    if (!orderId) return;
    var inv = await loadInvoiceForOrder(orderId, state.clientName || state.form.name);
    if (inv && inv.html && global.InvoiceReceipt) {
      global.InvoiceReceipt.openPrintDocument(inv.html);
    } else {
      global.toast(t().receiptError || 'Reçu indisponible', 'e');
    }
  }

  function orderTrackingStep_(order) {
    var o = order || {};
    var estado = String(o.estado || '').toLowerCase();
    var pay = String(o.estado_pagamento || '').toLowerCase();
    var ship = String(o.estado_envio || '').toLowerCase();
    if (estado === 'delivered' || estado === 'entregue' || ship === 'delivered' || ship === 'entregue') return 3;
    if (estado === 'shipped' || ship === 'shipped' || ship === 'em_transito' || ship === 'enviado') return 2;
    if (pay === 'pago' || pay === 'paid' || pay === 'pago_stripe' || estado === 'paid' || estado === 'processing') return 1;
    return 0;
  }

  function orderTrackingHtml(order, animated) {
    var step = animated ? (state.delStep || 0) : orderTrackingStep_(order);
    var addr = state.form.addr || '';
    var city = state.form.city || '';
    var tr3d = (t().tr3d || '').replace('{address}', addr).replace('{city}', city);
    var pairs = [[t().tr1t, t().tr1d], [t().tr2t, t().tr2d], [t().tr3t, tr3d]];
    var trackInfo = '';
    if (order && order.tracking_number) {
      trackInfo = '<p style="font-size:10px;margin-top:8px;color:var(--muted);">' + esc(t().trackingLabel || 'Suivi') + ': <strong>' + esc(order.tracking_number) + '</strong>' +
        (order.transportadora ? ' (' + esc(order.transportadora) + ')' : '') + '</p>';
    }
    return '<div class="tracking"><p class="tr-title">' + esc(t().trTitle) + '</p><div class="tr-steps">' +
      pairs.map(function (pair, i) {
        var dotClass = animated ? (state.delStep > i ? 'done' : '') : (step >= i ? 'done' : '');
        var dotId = animated ? ' id="td' + i + '"' : '';
        return '<div class="tr-step"><span class="tr-dot ' + dotClass + '"' + dotId + '></span><h4>' + esc(pair[0]) + '</h4><p>' + esc(pair[1]) + '</p></div>';
      }).join('') + '</div>' + trackInfo + '</div>';
  }

  function startOrderTrackingAnimation_(initialStep) {
    state.delStep = initialStep || 1;
    updDots();
    clearTimeout(state._trackAnim1);
    clearTimeout(state._trackAnim2);
    state._trackAnim1 = setTimeout(function () { state.delStep = 2; updDots(); }, 5000);
    state._trackAnim2 = setTimeout(function () { state.delStep = 3; updDots(); }, 10000);
  }

  function renderCo() {
    if (state.ordered) {
      var lastEmail = state.lastOrderEmail || state.form.email || state.clientEmail || '';
      $('coBody').innerHTML =
        '<div class="order-ok"><span class="ok-emoji">🎉</span>' +
        '<h2 class="ok-title">' + esc(t().ordTitle) + '</h2>' +
        '<p class="ok-sub">' + esc(t().ordSub.replace('{name}', state.form.name).replace('{ref}', '#' + state.lastOrderId).replace('{email}', lastEmail)) + '</p>' +
        '<div class="order-ref-card"><p class="order-ref-label">' + esc(t().orderCodeLabel) + '</p><div class="order-ref-row"><strong>#' + esc(state.lastOrderId) + '</strong><button type="button" class="btn-copy-ref" onclick="Shop.copyLastOrderCode()">' + esc(t().copyOrderCode) + '</button></div><p class="order-ref-help">' + esc(t().orderCodeHint) + '</p></div>' +
        receiptSectionHtml() +
        paymentInstructionsHtml() +
        orderTrackingHtml(state.lastOrderSnapshot, true) +
        '</div><div class="order-ok-actions"><button class="btn-gold" type="button" onclick="Shop.openLastOrderTracking()">' + esc(t().trackOrderNow) + '</button>' +
        '<button class="btn-order-secondary" type="button" onclick="Shop.loadOrderReceipt()">' + esc(t().receiptLater || t().receiptPrint) + '</button>' +
        '<button class="btn-order-secondary" type="button" onclick="Shop.closeCo()">' + esc(t().backBtn) + '</button></div></div>';
      startOrderTrackingAnimation_(state.payMethod === 'stripe' ? 1 : 0);
      return;
    }

    var totals = orderTotals();
    var f = state.form;
    $('coBody').innerHTML =
      '<div class="m-body co-panel">' +
      '<h2 style="font-family:\'Cormorant Garamond\',serif;font-size:22px;font-weight:300;margin-bottom:5px;">' + esc(t().coTitle) + '</h2>' +
      '<p style="font-size:10px;color:var(--muted);margin-bottom:18px;">' + esc(t().coSub) + '</p>' +
      (!state.clientId ? '<p class="acc-hint" style="margin-bottom:14px;">' + esc(t().guestCheckout) + ' <button type="button" class="acc-link" onclick="Shop.closeCo();Shop.openAccount();">' + esc(t().guestCheckoutBtn) + '</button>' + esc(t().guestCheckoutSuffix) + '</p>' : '') +
      '<p class="form-title">' + esc(t().s1) + '</p>' +
      '<div class="fgrid">' +
      '<div class="field"><label>' + esc(t().fName) + '</label><input value="' + esc(f.name) + '" oninput="Shop.setForm(\'name\',this.value)" placeholder="Maria Silva"/></div>' +
      '<div class="field"><label>' + esc(t().fEmail) + '</label><input type="email" value="' + esc(f.email) + '" oninput="Shop.setForm(\'email\',this.value)" placeholder="email@exemplo.pt"/></div></div>' +
      '<div class="field" style="margin-bottom:10px;"><label>' + esc(t().phone) + '</label><input value="' + esc(f.phone) + '" oninput="Shop.setForm(\'phone\',this.value)" placeholder="+351 912 345 678"/></div>' +
      '<div class="field" style="margin-bottom:10px;"><label>' + esc(t().fNif) + '</label><input value="' + esc(f.nif) + '" oninput="Shop.setForm(\'nif\',this.value)" placeholder="123456789" maxlength="9" inputmode="numeric"/></div>' +
      '<div class="fgrid one"><div class="field"><label>' + esc(t().fAddr) + '</label><input value="' + esc(f.addr) + '" oninput="Shop.setForm(\'addr\',this.value)"/></div></div>' +
      '<div class="fgrid">' +
      '<div class="field"><label>' + esc(t().fZip) + '</label><input value="' + esc(f.zip) + '" oninput="Shop.setForm(\'zip\',this.value)"/></div>' +
      '<div class="field"><label>' + esc(t().fCity) + '</label><input value="' + esc(f.city) + '" oninput="Shop.setForm(\'city\',this.value)"/></div></div>' +
      '<p class="form-title" style="margin-top:16px;">' + esc(t().s2) + '</p>' +
      paymentOptionsHtml() +
      '<div id="stripe-payment-element" style="margin:12px 0;' + (state.payMethod === 'stripe' ? '' : 'display:none;') + '"></div>' +
      '<div class="sec-note"><span>' + esc(t().secN) + '</span><strong>' + esc(t().secS) + '</strong></div>' +
      checkoutTotalsHtml(totals) +
      '<button class="btn-pay" id="btnPayOrder" onclick="Shop.submitOrder()" ' + (state.checkoutBusy ? 'disabled' : '') + '>' +
      esc(state.checkoutBusy ? (t().payProcessing || 'A processar…') : t().payBtn) + '</button></div>';

    scheduleStripeMount_();
  }

  function setForm(k, v) { state.form[k] = v; }

  function copyText(value) {
    var text = String(value || '').trim();
    if (!text) return Promise.resolve(false);
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return false; });
    }
    try {
      var input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(input);
      return Promise.resolve(!!ok);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  async function copyLastOrderCode() {
    if (!state.lastOrderId) return;
    var ok = await copyText(state.lastOrderId);
    global.toast(ok ? t().copyOrderCodeOk : ('#' + state.lastOrderId), ok ? 's' : 'i');
  }

  function openLastOrderTracking() {
    if (!state.lastOrderId) return;
    openAccount();
    openOrderDetail(state.lastOrderId);
  }

  function updDots() {
    [0, 1, 2].forEach(function (i) {
      var d = $('td' + i);
      if (d) d.classList.toggle('done', state.delStep > i);
    });
  }

  async function registerOfflinePaymentSafe_(payload) {
    try {
      var res = await erpCall('registerOfflinePayment', payload);
      if (res && res.success) return res;
    } catch (e1) { /* ancien backend sans registerOfflinePayment */ }
    return erpCall('processPayment', {
      orderId: payload.orderId,
      metodo: payload.metodo,
      valor: payload.valor,
      clientId: payload.clientId,
      email: payload.email
    });
  }

  async function submitOrder() {
    if (state.checkoutBusy) return;
    var f = state.form;
    if (!f.name || !f.email || !f.addr || !f.city || !f.zip) {
      global.toast(t().tReq, 'e');
      return;
    }
    if (!state.cart.length) {
      global.toast(t().cartEmptyToast, 'e');
      return;
    }
    if (!apiUrlConfigured()) {
      global.toast(t().apiUrlMissing || 'API não configurada (index.html)', 'e');
      return;
    }

    await refreshActivePromo({ silent: true });
    var totals = orderTotals();
    var endereco = [f.addr, f.zip, f.city].filter(Boolean).join(', ');
    var awaitStripe = state.payMethod === 'stripe' && isStripeOn();

    state.checkoutBusy = true;
    renderCo();

    try {
      if (awaitStripe) {
        await initStripeElement();
        if (!state.stripeElements) {
          global.toast(t().errStripe || 'Stripe não disponível', 'e');
          return;
        }
        var submitUi = await state.stripeElements.submit();
        if (submitUi && submitUi.error) {
          global.toast(submitUi.error.message, 'e');
          return;
        }
      }

      var orderPayload = {
        clientId: state.clientId || 'guest',
        email: normEmail(f.email),
        telefone: f.phone || '',
        nome: f.name,
        cliente_nif: (f.nif || '').replace(/\s/g, ''),
        endereco: endereco,
        subtotal: totals.sub.toFixed(2),
        discount_total: totals.disc.toFixed(2),
        shipping_total: totals.ship.toFixed(2),
        grand_total: totals.total.toFixed(2),
        total: totals.total.toFixed(2),
        coupon_code: state.couponCode || (state.promo || ''),
        cartId: state.cartId || '',
        items: buildOrderItems(),
        awaitOnlinePayment: awaitStripe
      };

      var orderRes = await erpCall('createOrder', orderPayload);
      if (!orderRes || !orderRes.success) {
        global.toast((orderRes && orderRes.error) || (t().errOrderFailed || 'Erro ao criar encomenda'), 'e');
        return;
      }

      state.lastOrderId = orderRes.orderId;
      state.lastOrderEmail = normEmail(f.email);
      state.lastOrderTotal = totals.total.toFixed(2);
      state.lastPayMethod = state.payMethod;
      saveSession();

      if (awaitStripe) {
        var piRes = await erpCall('createStripePaymentIntent', { orderId: orderRes.orderId, email: f.email });
        if (!piRes || !piRes.success || !piRes.clientSecret) {
          global.toast((piRes && piRes.error) || (t().errStripe || 'Erro Stripe'), 'e');
          return;
        }
        var conf = await state.stripe.confirmPayment({
          elements: state.stripeElements,
          clientSecret: piRes.clientSecret,
          confirmParams: {
            return_url: window.location.href.split('#')[0] + '#order-' + orderRes.orderId,
            payment_method_data: { billing_details: { name: f.name, email: f.email } }
          },
          redirect: 'if_required'
        });
        if (conf.error) {
          global.toast(conf.error.message, 'e');
          return;
        }
        var confirmRes = await erpCall('confirmStripePayment', {
          orderId: orderRes.orderId,
          paymentIntentId: piRes.paymentIntentId,
          clientId: state.clientId || 'guest',
          nome: f.name,
          cartId: state.cartId || ''
        });
        if (!confirmRes || !confirmRes.success) {
          global.toast((confirmRes && confirmRes.error) || (t().errPayment || 'Erro no pagamento'), 'e');
          return;
        }
        if (confirmRes.fiscal_doc_url) state.lastFiscalUrl = confirmRes.fiscal_doc_url;
      } else if (state.payMethod === 'cod') {
        var codRes = await erpCall('processPayment', {
          orderId: orderRes.orderId,
          metodo: 'cod',
          valor: totals.total.toFixed(2),
          clientId: state.clientId || 'guest',
          email: f.email
        });
        if (!codRes || !codRes.success) {
          global.toast((codRes && codRes.error) || (t().errPayment || 'Erro no pagamento'), 'e');
          return;
        }
        if (codRes.fiscal_doc_url) state.lastFiscalUrl = codRes.fiscal_doc_url;
      } else if (state.payMethod === 'transfer' || state.payMethod === 'mbway' || state.payMethod === 'paypal') {
        await registerOfflinePaymentSafe_({
          orderId: orderRes.orderId,
          metodo: state.payMethod,
          valor: totals.total.toFixed(2),
          clientId: state.clientId || 'guest',
          email: f.email
        });
      }

      state.cart = [];
      clearPromoState();
      if (state.cartId) {
        try { await erpCall('clearCart', { cartId: state.cartId }); } catch (e2) { /* ignore */ }
      }
      updBadge();
      state.ordered = true;
      var paySnap = 'aguardando_pagamento';
      if (state.payMethod === 'stripe') paySnap = 'pago_stripe';
      else if (state.payMethod === 'cod') paySnap = 'pago';
      state.lastOrderSnapshot = {
        pedido_id: orderRes.orderId,
        estado: state.payMethod === 'cod' || state.payMethod === 'stripe' ? 'paid' : 'pending',
        estado_pagamento: paySnap,
        estado_envio: 'pending',
        tracking_number: '',
        transportadora: ''
      };
      renderCo();
      global.toast(t().ordTitle, 's');
    } catch (e) {
      global.toast(e.message, 'e');
    } finally {
      state.checkoutBusy = false;
      if ($('coBg') && $('coBg').classList.contains('open') && !state.ordered) renderCo();
    }
  }

  // ─── Account ───────────────────────────────────────────────────────────
  function openAccount() {
    $('accBg').classList.add('open');
    if (state.token && state.clientId && state.accountView !== 'track') state.accountView = 'dashboard';
    renderAccount();
    updateScrollLock();
  }
  function closeAccount() { $('accBg').classList.remove('open'); updateScrollLock(); }

  function openOrdersOrLogin() {
    closeAllOverlays();
    if (state.token && state.clientId) {
      state.accountView = 'dashboard';
    } else {
      state.accountView = 'track';
    }
    openAccount();
  }

  function renderTrackForm() {
    var a = accT();
    return '<p class="form-title">' + esc(a.trackTitle) + '</p>' +
      '<p class="acc-hint">' + esc(a.trackHint) + '</p>' +
      '<div class="fgrid one">' +
      '<div class="field"><label>' + esc(a.trackOrderId) + '</label><input id="trackOrderId" placeholder="ORD…" autocomplete="off" value="' + esc(state.lastOrderId || '') + '"/></div>' +
      '<div class="field"><label>' + esc(a.email) + '</label><input id="trackEmail" type="email" value="' + esc(state.form.email || state.lastOrderEmail || state.clientEmail || '') + '"/></div></div>' +
      '<button type="button" class="btn-pay" style="width:100%;margin-top:12px;" onclick="Shop.trackGuestOrder()">' + esc(a.trackBtn) + '</button>' +
      '<p style="margin-top:14px;text-align:center;"><button type="button" class="acc-link" onclick="Shop.setAccountView(\'login\')">' + esc(a.login) + '</button></p>';
  }

  async function trackGuestOrder() {
    var a = accT();
    var orderId = ($('trackOrderId') && $('trackOrderId').value || '').trim().toUpperCase();
    var email = normEmail($('trackEmail') && $('trackEmail').value);
    if (!orderId || !email) {
      global.toast(a.fieldsRequired, 'e');
      return;
    }
    try {
      var res = await erpCall('getOrder', orderAccessPayload({ orderId: orderId, email: email }));
      if (!res || !res.success || !res.order) {
        global.toast((res && res.code === 'NO_AUTH') ? a.trackEmailMismatch : a.trackNotFound, 'e');
        return;
      }
      state.selectedOrder = { order: res.order, details: res.details || [] };
      state.accountView = 'orderDetail';
      renderAccount();
    } catch (e) {
      global.toast(e.message, 'e');
    }
  }

  function stripeReturnParams_() {
    try {
      var sp = new URLSearchParams(global.location.search || '');
      return {
        paymentIntentId: (sp.get('payment_intent') || '').trim(),
        redirectStatus: (sp.get('redirect_status') || '').trim()
      };
    } catch (e) {
      return { paymentIntentId: '', redirectStatus: '' };
    }
  }

  function handleOrderHash() {
    var h = (global.location && global.location.hash) || '';
    var orderId = '';
    if (h.indexOf('#order-') === 0) orderId = h.replace('#order-', '').trim();
    var stripeRet = stripeReturnParams_();
    if (!orderId && stripeRet.paymentIntentId) {
      orderId = state.lastOrderId || '';
    }
    if (!orderId) return;
    state.lastOrderId = orderId;
    erpCall('finalizeStripeReturn', {
      orderId: orderId,
      paymentIntentId: stripeRet.paymentIntentId || '',
      clientId: state.clientId || 'guest',
      nome: state.clientName || state.form.name || '',
      email: state.lastOrderEmail || state.form.email || state.clientEmail || ''
    }).then(function (fin) {
      if (fin && fin.success && !fin.pending) {
        state.ordered = true;
        state.payMethod = 'stripe';
        state.lastPayMethod = 'stripe';
        state.lastOrderSnapshot = {
          pedido_id: orderId,
          estado: 'paid',
          estado_pagamento: 'pago_stripe',
          estado_envio: 'pending',
          tracking_number: '',
          transportadora: ''
        };
        state.cart = [];
        clearPromoState();
        updBadge();
        if (fin.fiscal_doc_url) state.lastFiscalUrl = fin.fiscal_doc_url;
        $('coBg').classList.add('open');
        renderCo();
        global.toast(t().ordTitle, 's');
      } else if (fin && fin.pending) {
        global.toast(fin.message || t().payPending || 'Pagamento em processamento…', 'i');
        openAccount();
        openOrderDetail(orderId);
      } else {
        openAccount();
        openOrderDetail(orderId);
      }
    }).catch(function () {
      openAccount();
      openOrderDetail(orderId);
    });
    try { global.history.replaceState(null, '', global.location.pathname); } catch (e) { /* ignore */ }
  }

  function setAccountView(v) {
    state.accountView = v;
    state.selectedOrder = null;
    if (state.token && v === 'addresses') {
      loadClientAddresses().then(renderAccount);
      return;
    }
    if (state.token && v === 'profile' && !state.profile) {
      loadClientProfile().then(renderAccount);
      return;
    }
    renderAccount();
  }

  function accountTabsHtml(active) {
    var a = accT();
  var tabs = [
      { id: 'login', label: a.login },
      { id: 'register', label: a.register }
    ];
    return '<div class="acc-tabs">' + tabs.map(function (tab) {
      return '<button type="button" class="acc-tab' + (active === tab.id ? ' on' : '') + '" onclick="Shop.setAccountView(\'' + tab.id + '\')">' + esc(tab.label) + '</button>';
    }).join('') + '</div>';
  }

  function renderLoginForm() {
    var a = accT();
    return accountTabsHtml('login') +
      '<p class="form-title">' + esc(a.login) + '</p>' +
      '<div class="fgrid one"><div class="field"><label>' + esc(a.email) + '</label><input id="loginEmail" type="email" autocomplete="email" value="' + esc(state.clientEmail || state.form.email || '') + '"/></div>' +
      '<div class="field"><label>' + esc(a.pass) + '</label><input id="loginPass" type="password" autocomplete="current-password"/></div></div>' +
      '<p style="margin-bottom:12px;"><button type="button" class="acc-link" onclick="Shop.setAccountView(\'forgot\')">' + esc(a.forgot) + '</button></p>' +
      '<button type="button" class="btn-pay" style="width:100%;" onclick="Shop.login()">' + esc(a.loginBtn) + '</button>';
  }

  function renderRegisterForm() {
    var a = accT();
    var d = state.regDraft || {};
    return accountTabsHtml('register') +
      '<p class="form-title">' + esc(a.register) + '</p>' +
      '<p class="acc-hint">' + esc(a.passMin) + '</p>' +
      '<div class="fgrid one">' +
      '<div class="field"><label>' + esc(a.name) + ' *</label><input id="regName" value="' + esc(d.nome || '') + '"/></div>' +
      '<div class="field"><label>' + esc(a.email) + ' *</label><input id="regEmail" type="email" autocomplete="email" value="' + esc(d.email || '') + '"/></div>' +
      '<div class="field"><label>' + esc(a.phone) + '</label><input id="regPhone" type="tel" value="' + esc(d.telefone || '') + '"/></div>' +
      '<div class="field"><label>' + esc(a.pass) + ' *</label><input id="regPass" type="password" autocomplete="new-password"/></div>' +
      '<div class="field"><label>' + esc(a.passConfirm) + ' *</label><input id="regPass2" type="password" autocomplete="new-password"/></div></div>' +
      '<label class="acc-check"><input type="checkbox" id="regTerms"' + (d.terms ? ' checked' : '') + '/><span>' + esc(a.terms) + '</span></label>' +
      '<label class="acc-check"><input type="checkbox" id="regNews"' + (d.newsletter ? ' checked' : '') + '/><span>' + esc(a.newsletter) + '</span></label>' +
      '<button type="button" class="btn-gold" style="width:100%;margin-top:8px;" onclick="Shop.startRegister()">' + esc(a.registerBtn) + '</button>';
  }

  function renderOtpForm() {
    var a = accT();
    return '<p class="form-title">' + esc(a.otpTitle) + '</p>' +
      '<p class="acc-hint">' + esc(a.otpHint) + ' <strong>' + esc(state.otpTarget) + '</strong></p>' +
      '<div class="field"><label>Code</label><input id="regOtp" class="acc-otp" type="text" inputmode="numeric" maxlength="6" placeholder="000000"/></div>' +
      '<button type="button" class="btn-pay" style="width:100%;margin:12px 0;" onclick="Shop.verifyRegisterOtp()">' + esc(a.otpVerify) + '</button>' +
      '<p style="text-align:center;"><button type="button" class="acc-link" onclick="Shop.resendRegisterOtp()">' + esc(a.otpResend) + '</button> · ' +
      '<button type="button" class="acc-link" onclick="Shop.setAccountView(\'register\')">' + esc(a.back) + '</button></p>';
  }

  function renderForgotForm() {
    var a = accT();
    return '<p class="form-title">' + esc(a.forgot) + '</p>' +
      '<p class="acc-hint">' + esc(a.forgotHint || 'O código de recuperação é enviado para o e-mail da conta.') + '</p>' +
      '<div class="field"><label>' + esc(a.emailOrPhone || (a.email + ' / ' + a.phone)) + '</label><input id="forgotEmail" type="text" autocomplete="username" value="' + esc(state.resetEmail || state.clientEmail || state.form.email || '') + '" placeholder="email@exemplo.pt · +351 912 345 678"/></div>' +
      '<button type="button" class="btn-pay" style="width:100%;margin-top:12px;" onclick="Shop.requestPasswordReset()">' + esc(a.forgotBtn) + '</button>' +
      '<p style="margin-top:14px;text-align:center;"><button type="button" class="acc-link" onclick="Shop.setAccountView(\'login\')">' + esc(a.back) + '</button></p>';
  }

  function renderResetForm() {
    var a = accT();
    return '<p class="form-title">' + esc(a.forgot) + '</p>' +
      '<p class="acc-hint">' + esc(state.resetMaskedEmail || state.resetEmail) + '</p>' +
      '<div class="fgrid one">' +
      '<div class="field"><label>Code</label><input id="resetCode" class="acc-otp" type="text" inputmode="numeric" maxlength="6"/></div>' +
      '<div class="field"><label>' + esc(a.pass) + '</label><input id="resetPass" type="password" autocomplete="new-password"/></div>' +
      '<div class="field"><label>' + esc(a.passConfirm) + '</label><input id="resetPass2" type="password"/></div></div>' +
      '<button type="button" class="btn-gold" style="width:100%;margin-top:8px;" onclick="Shop.confirmPasswordReset()">' + esc(a.resetBtn) + '</button>';
  }

  function renderDashboardNav(active) {
    var a = accT();
    var items = [
      { id: 'dashboard', label: a.orders },
      { id: 'profile', label: a.profile },
      { id: 'addresses', label: a.addresses }
    ];
    return '<div class="acc-dash-nav">' + items.map(function (it) {
      return '<button type="button" class="acc-dash-btn' + (active === it.id ? ' on' : '') + '" onclick="Shop.setAccountView(\'' + it.id + '\')">' + esc(it.label) + '</button>';
    }).join('') + '</div>';
  }

  function renderOrdersPanel() {
    var a = accT();
    var boxId = 'accOrdersList';
    setTimeout(function () { loadMyOrders(boxId); }, 0);
    return renderDashboardNav('dashboard') + '<div id="' + boxId + '"><p class="acc-hint">' + esc(a.loading) + '</p></div>';
  }

  function renderProfilePanel() {
    var a = accT();
    var p = state.profile || {};
    return renderDashboardNav('profile') +
      '<div class="fgrid one">' +
      '<div class="field"><label>' + esc(a.name) + '</label><input id="profName" value="' + esc(p.nome || state.clientName || '') + '"/></div>' +
      '<div class="field"><label>' + esc(a.email) + '</label><input id="profEmail" type="email" value="' + esc(p.email || state.clientEmail || '') + '" disabled style="opacity:.6"/></div>' +
      '<div class="field"><label>' + esc(a.phone) + '</label><input id="profPhone" value="' + esc(p.telefone || state.clientPhone || '') + '"/></div></div>' +
      '<button type="button" class="btn-gold" style="width:100%;" onclick="Shop.saveProfile()">' + esc(a.save) + '</button>';
  }

  function renderAddressesPanel() {
    var a = accT();
    var list = (state.addresses || []).map(function (ad) {
      return '<div class="acc-addr"><strong>' + esc(ad.tipo || 'envio') + '</strong><br>' +
        esc(ad.morada) + '<br>' + esc(ad.codigo_postal) + ' ' + esc(ad.cidade) + ', ' + esc(ad.pais || '') +
        '<div class="acc-addr-actions">' +
        '<button type="button" class="btn-ghost-sm" onclick="Shop.useAddress(\'' + esc(ad.address_id) + '\')">' + esc(a.useAddr) + '</button>' +
        '<button type="button" class="btn-ghost-sm" onclick="Shop.deleteAddress(\'' + esc(ad.address_id) + '\')">' + esc(a.delete) + '</button></div></div>';
    }).join('');
    return renderDashboardNav('addresses') + list +
      '<p class="form-title" style="margin-top:16px;">' + esc(a.addAddr) + '</p>' +
      '<div class="fgrid one">' +
      '<div class="field"><label>' + esc(a.addrLabel) + '</label><input id="addrMorada"/></div>' +
      '<div class="fgrid"><div class="field"><label>' + esc(a.zip) + '</label><input id="addrZip"/></div>' +
      '<div class="field"><label>' + esc(a.city) + '</label><input id="addrCity"/></div></div>' +
      '<div class="field"><label>' + esc(a.country) + '</label><input id="addrCountry" value="Portugal" placeholder="Portugal / France"/></div></div>' +
      '<button type="button" class="btn-gold" style="width:100%;margin-top:8px;" onclick="Shop.saveNewAddress()">' + esc(a.save) + '</button>';
  }

  function renderOrderDetail(o, details) {
    var a = accT();
    var lines = (details || []).map(function (d) {
      var meta = [];
      if (normalizeOptionValue(d.tamanho)) meta.push(t().sizeMeta + ': ' + d.tamanho);
      if (normalizeOptionValue(d.cor)) meta.push(t().colorMeta + ': ' + colorDisplayName(d.cor));
      return '<li><strong>' + esc(d.nome_produto || d.produto_id) + '</strong> × ' + esc(d.quantidade) + ' — ' + esc(d.preco) + ' €' +
        (meta.length ? '<br><span style="font-size:9px;color:var(--muted);">' + esc(meta.join(' · ')) + '</span>' : '') + '</li>';
    }).join('');
    var backView = (state.token && state.clientId) ? 'dashboard' : 'track';
    return '<button type="button" class="acc-link" style="margin-bottom:12px;" onclick="Shop.setAccountView(\'' + backView + '\')">← ' + esc(a.back) + '</button>' +
      '<p class="acc-order-id">#' + esc(o.pedido_id) + '</p>' +
      '<p style="font-size:10px;color:var(--muted);margin:8px 0;">' + esc(o.data) + '</p>' +
      '<p style="font-size:10px;"><strong>' + esc(a.total) + ':</strong> ' + esc(o.total) + ' € · <strong>' + esc(a.status) + ':</strong> ' + esc(o.estado || '') + '</p>' +
      '<p style="font-size:10px;"><strong>' + esc(a.pay) + ':</strong> ' + esc(o.estado_pagamento || '') + ' · <strong>' + esc(a.ship) + ':</strong> ' + esc(o.estado_envio || '') + '</p>' +
      (o.tracking_number ? '<p style="font-size:10px;"><strong>' + esc(a.tracking) + ':</strong> ' + esc(o.tracking_number) + (o.transportadora ? ' (' + esc(o.transportadora) + ')' : '') + '</p>' : '') +
      orderTrackingHtml(o) +
      '<div class="receipt-inline"><button type="button" class="btn-rc" style="width:100%;margin-top:8px;" onclick="Shop.printOrderInvoice(\'' + esc(o.pedido_id).replace(/'/g, "\\'") + '\')">' + esc(t().receiptPrint || 'Imprimer le reçu') + '</button></div>' +
      '<ul style="list-style:none;padding:12px 0 0;font-size:10px;color:var(--muted);">' + lines + '</ul>';
  }

  function renderLoggedIn() {
    var a = accT();
    var view = state.accountView;
    if (view === 'orderDetail' && state.selectedOrder) {
      return '<div class="acc-wrap"><h2 style="font-family:\'Cormorant Garamond\',serif;font-size:22px;margin-bottom:8px;">' + esc(a.orderDetail) + '</h2>' +
        renderOrderDetail(state.selectedOrder.order, state.selectedOrder.details) + '</div>';
    }
    var panel = '';
    if (view === 'profile') panel = renderProfilePanel();
    else if (view === 'addresses') panel = renderAddressesPanel();
    else panel = renderOrdersPanel();
    return '<div class="acc-wrap">' +
      '<h2 style="font-family:\'Cormorant Garamond\',serif;font-size:22px;margin-bottom:4px;">' + esc(a.welcome) + ', ' + esc(state.clientName || '') + '</h2>' +
      '<p style="font-size:10px;color:var(--muted);margin-bottom:16px;">' + esc(state.clientEmail || '') + '</p>' +
      panel +
      '<button type="button" class="btn-ghost" style="width:100%;margin-top:20px;border-color:#444;color:#aaa;" onclick="Shop.logout()">' + esc(a.logout) + '</button></div>';
  }

  function renderAccount() {
    var body = $('accBody');
    if (!body) return;
    var logged = !!(state.token && state.clientId);
    if (logged) {
      if (state.accountView === 'login' || state.accountView === 'register' || state.accountView === 'otp' || state.accountView === 'forgot' || state.accountView === 'reset') {
        state.accountView = 'dashboard';
      }
      body.innerHTML = renderLoggedIn();
      return;
    }
    var a = accT();
    if (state.accountView === 'orderDetail' && state.selectedOrder) {
      body.innerHTML = '<div class="acc-wrap"><h2 style="font-family:\'Cormorant Garamond\',serif;font-size:22px;margin-bottom:8px;">' + esc(a.orderDetail) + '</h2>' +
        renderOrderDetail(state.selectedOrder.order, state.selectedOrder.details) + '</div>';
      return;
    }
    var inner = '';
    if (state.accountView === 'track') inner = renderTrackForm();
    else if (state.accountView === 'register') inner = renderRegisterForm();
    else if (state.accountView === 'otp') inner = renderOtpForm();
    else if (state.accountView === 'forgot') inner = renderForgotForm();
    else if (state.accountView === 'reset') inner = renderResetForm();
    else inner = renderLoginForm();
    body.innerHTML = '<div class="acc-wrap"><h2 style="font-family:\'Cormorant Garamond\',serif;font-size:22px;margin-bottom:12px;">' + esc(a.title) + '</h2>' + inner + '</div>';
  }

  async function login() {
    var a = accT();
    var email = normEmail(($('loginEmail') && $('loginEmail').value) || '');
    var password = ($('loginPass') && $('loginPass').value) || '';
    if (!email || !password) {
      global.toast(a.fieldsRequired, 'e');
      return;
    }
    if (!validEmail(email)) {
      global.toast(a.emailInvalid, 'e');
      return;
    }
    try {
      var res = await erpCall('clientLogin', { email: email, password: password });
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Login', 'e');
        return;
      }
      applySessionFromAuth(res, '', email);
      state.accountView = 'dashboard';
      saveSession();
      await loadClientProfile();
      await loadWishlistServer();
      prefillCheckoutFromProfile();
      renderAccount();
      global.toast(a.connected, 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  function collectRegisterDraft() {
    return {
      nome: ($('regName') && $('regName').value.trim()) || '',
      email: normEmail(($('regEmail') && $('regEmail').value) || ''),
      telefone: ($('regPhone') && $('regPhone').value.trim()) || '',
      password: ($('regPass') && $('regPass').value) || '',
      password2: ($('regPass2') && $('regPass2').value) || '',
      terms: !!($('regTerms') && $('regTerms').checked),
      newsletter: !!($('regNews') && $('regNews').checked)
    };
  }

  async function startRegister() {
    var a = accT();
    var d = collectRegisterDraft();
    state.regDraft = d;
    if (!d.nome || !d.email || !d.password) {
      global.toast(a.fieldsRequired, 'e');
      return;
    }
    if (!validEmail(d.email)) {
      global.toast(a.emailInvalid, 'e');
      return;
    }
    if (!validPassword(d.password)) {
      global.toast(a.passMin, 'e');
      return;
    }
    if (d.password !== d.password2) {
      global.toast(a.passMismatch, 'e');
      return;
    }
    if (!d.terms) {
      global.toast(a.termsRequired, 'e');
      return;
    }
    try {
      var otpRes = await erpCall('sendRegistrationOTP', { target: d.email });
      if (!otpRes || !otpRes.success) {
        global.toast((otpRes && otpRes.error) || 'OTP', 'e');
        return;
      }
      state.otpTarget = d.email;
      state.accountView = 'otp';
      renderAccount();
      global.toast(a.codeSent, 's');
      if (otpRes.simulated_code && /localhost|127\.0\.0\.1/i.test(global.location && global.location.hostname || '')) {
        global.toast('DEV: ' + otpRes.simulated_code, 'i');
      }
    } catch (e) { global.toast(e.message, 'e'); }
  }

  async function resendRegisterOtp() {
    if (!state.regDraft || !state.otpTarget) {
      setAccountView('register');
      return;
    }
    await startRegister();
  }

  async function verifyRegisterOtp() {
    var a = accT();
    var code = normalizeOtp($('regOtp') && $('regOtp').value);
    var d = state.regDraft;
    if (!d || !state.otpTarget || code.length < 6) {
      global.toast(a.fieldsRequired, 'e');
      return;
    }
    try {
      var res = await erpCall('verifyRegistrationOTP', {
        target: state.otpTarget,
        code: code,
        userData: {
          nome: d.nome,
          email: d.email,
          telefone: d.telefone,
          password: d.password,
          newsletter: d.newsletter
        }
      });
      if (!res || !res.success) {
        global.toast((res && res.error) || 'OTP', 'e');
        return;
      }
      applySessionFromAuth(res, d.nome, d.email);
      state.clientPhone = d.telefone;
      state.accountView = 'dashboard';
      state.regDraft = null;
      await loadClientProfile();
      await loadWishlistServer();
      prefillCheckoutFromProfile();
      renderAccount();
      global.toast(a.created, 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  function normalizeOtp(v) {
    return String(v == null ? '' : v).replace(/\D/g, '').slice(0, 6);
  }

  async function requestPasswordReset() {
    var a = accT();
    var raw = (($('forgotEmail') && $('forgotEmail').value) || '').trim();
    var isEmail = raw.indexOf('@') !== -1;
    var isPhone = !isEmail && raw.replace(/\D/g, '').length >= 6;
    if (isEmail && !validEmail(normEmail(raw))) {
      global.toast(a.emailInvalid, 'e');
      return;
    }
    if (!isEmail && !isPhone) {
      global.toast(a.fieldsRequired, 'e');
      return;
    }
    try {
      var payload = isEmail ? { email: normEmail(raw) } : { telefone: raw };
      var res = await erpCall('requestPasswordReset', payload);
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Reset', 'e');
        return;
      }
      state.resetEmail = isEmail ? normEmail(raw) : raw;
      state.resetMaskedEmail = res.maskedEmail || '';
      state.accountView = 'reset';
      renderAccount();
      global.toast(a.resetSent + (res.maskedEmail ? ' (' + res.maskedEmail + ')' : ''), 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  async function confirmPasswordReset() {
    var a = accT();
    var code = normalizeOtp($('resetCode') && $('resetCode').value);
    var p1 = ($('resetPass') && $('resetPass').value) || '';
    var p2 = ($('resetPass2') && $('resetPass2').value) || '';
    if (!state.resetEmail || code.length < 6 || !p1) {
      global.toast(a.fieldsRequired, 'e');
      return;
    }
    if (!validPassword(p1) || p1 !== p2) {
      global.toast(p1 !== p2 ? a.passMismatch : a.passMin, 'e');
      return;
    }
    try {
      var res = await erpCall('confirmPasswordReset', {
        target: state.resetEmail,
        email: state.resetEmail.indexOf('@') !== -1 ? state.resetEmail : '',
        telefone: state.resetEmail.indexOf('@') === -1 ? state.resetEmail : '',
        code: code,
        newPassword: p1
      });
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Reset', 'e');
        return;
      }
      state.accountView = 'login';
      state.resetEmail = '';
      renderAccount();
      global.toast(a.passReset, 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  function logout(silent) {
    state.token = '';
    state.clientId = '';
    state.clientName = '';
    state.clientEmail = '';
    state.clientPhone = '';
    state.profile = null;
    state.addresses = [];
    state.accountView = 'login';
    saveSession();
    renderAccount();
    if (!silent) global.toast(accT().logout, 'i');
  }

  async function saveProfile() {
    var a = accT();
    var nome = ($('profName') && $('profName').value.trim()) || '';
    var telefone = ($('profPhone') && $('profPhone').value.trim()) || '';
    if (!nome) {
      global.toast(a.fieldsRequired, 'e');
      return;
    }
    try {
      var res = await erpCall('updateClient', { clientId: state.clientId, nome: nome, telefone: telefone }, state.token);
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Profile', 'e');
        return;
      }
      state.clientName = nome;
      state.clientPhone = telefone;
      if (state.profile) {
        state.profile.nome = nome;
        state.profile.telefone = telefone;
      }
      saveSession();
      prefillCheckoutFromProfile();
      global.toast(a.profileSaved, 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  async function saveNewAddress() {
    var a = accT();
    var morada = ($('addrMorada') && $('addrMorada').value.trim()) || '';
    var cidade = ($('addrCity') && $('addrCity').value.trim()) || '';
    var zip = ($('addrZip') && $('addrZip').value.trim()) || '';
    var pais = ($('addrCountry') && $('addrCountry').value.trim()) || '';
    if (!morada || !cidade || !zip) {
      global.toast(a.fieldsRequired, 'e');
      return;
    }
    try {
      var res = await erpCall('saveClientAddress', {
        clientId: state.clientId,
        tipo: 'envio',
        morada: morada,
        cidade: cidade,
        codigo_postal: zip,
        pais: pais
      }, state.token);
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Address', 'e');
        return;
      }
      await loadClientAddresses();
      renderAccount();
      global.toast(a.addrSaved, 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  function useAddress(addressId) {
    var ad = (state.addresses || []).find(function (x) { return x.address_id === addressId; });
    if (!ad) return;
    state.form.addr = ad.morada || '';
    state.form.city = ad.cidade || '';
    state.form.zip = ad.codigo_postal || '';
    closeAccount();
    global.toast(accT().useAddr, 's');
  }

  async function deleteAddress(addressId) {
    try {
      var res = await erpCall('deleteClientAddress', { clientId: state.clientId, address_id: addressId }, state.token);
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Delete', 'e');
        return;
      }
      await loadClientAddresses();
      renderAccount();
    } catch (e) { global.toast(e.message, 'e'); }
  }

  async function loadMyOrders(containerId) {
    var box = $(containerId || 'accOrdersList');
    if (!box || !state.clientId) return;
    var a = accT();
    try {
      var res = await erpCall('getOrders', { clientId: state.clientId, email: state.clientEmail || state.form.email || '' }, state.token);
      var orders = (res && res.orders) ? res.orders : [];
      if (!orders.length) {
        box.innerHTML = '<p class="acc-hint">' + esc(a.noOrders) + '</p>';
        return;
      }
      box.innerHTML = orders.slice(0, 20).map(function (o) {
        var oid = esc(o.pedido_id).replace(/'/g, "\\'");
        return '<div class="acc-order">' +
          '<div class="acc-order-main" onclick="Shop.openOrderDetail(\'' + oid + '\')">' +
          '<div class="acc-order-id">#' + esc(o.pedido_id) + '</div>' +
          '<p style="font-size:10px;color:var(--muted);margin-top:4px;">' + esc(o.data) + ' · ' + esc(o.total) + ' €</p>' +
          '<p style="font-size:9px;color:var(--gold);margin-top:4px;">' + esc(o.estado || '') + ' · ' + esc(o.estado_pagamento || '') + '</p></div>' +
          '<button type="button" class="btn-rc btn-rc-mini" onclick="event.stopPropagation();Shop.printOrderInvoice(\'' + oid + '\')">' + esc(t().receiptPrint || 'Imprimir') + '</button></div>';
      }).join('');
    } catch (e) { box.textContent = e.message; }
  }

  async function openOrderDetail(orderId) {
    try {
      var res = await erpCall('getOrder', orderAccessPayload({ orderId: orderId }));
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Order', 'e');
        return;
      }
      state.selectedOrder = { order: res.order, details: res.details || [] };
      state.accountView = 'orderDetail';
      if ($('accBg')) $('accBg').classList.add('open');
      renderAccount();
    } catch (e) { global.toast(e.message, 'e'); }
  }

  // ─── Contact ───────────────────────────────────────────────────────────
  function contactT() { return t().contact || {}; }

  function contactEmailPublic() {
    return state.config.contact_public_email || state.config.store_email || '';
  }

  function contactPhonePublic() {
    return state.config.contact_phone || '';
  }

  function contactPhoneTelUrl() {
    var p = contactPhonePublic();
    if (!p) return '';
    var digits = String(p).replace(/[^\d+]/g, '');
    return digits ? 'tel:' + digits : '';
  }

  function contactWhatsAppUrl() {
    var wa = state.config.contact_whatsapp || '';
    if (!wa) return '';
    if (String(wa).indexOf('http') === 0) return wa;
    var digits = String(wa).replace(/\D/g, '');
    return digits ? 'https://wa.me/' + digits : '';
  }

  function openContact() {
    state.contactSent = false;
    $('contactBg').classList.add('open');
    renderContact();
    updateScrollLock();
  }

  function closeContact() {
    $('contactBg').classList.remove('open');
    updateScrollLock();
  }

  function renderContact() {
    var body = $('contactBody');
    if (!body) return;
    var c = contactT();
    if (state.contactSent) {
      body.innerHTML =
        '<div class="acc-wrap contact-sent"><span>✓</span><p style="font-size:11px;color:var(--muted);line-height:1.7;">' + esc(c.success) + '</p>' +
        '<button type="button" class="btn-gold" style="width:100%;margin-top:16px;" onclick="Shop.closeContact()">OK</button></div>';
      return;
    }
    var pubEmail = contactEmailPublic();
    var waUrl = contactWhatsAppUrl();
    var phone = contactPhonePublic();
    var phoneUrl = contactPhoneTelUrl();
    var quick = '';
    if (pubEmail || waUrl || phone) {
      quick = '<p class="acc-hint" style="margin-top:8px;">' + esc(c.or) + '</p><div class="contact-quick">';
      if (pubEmail) {
        quick += '<a href="mailto:' + esc(pubEmail) + '">✉ ' + esc(c.emailUs) + '</a>';
      }
      if (phoneUrl) {
        quick += '<a href="' + esc(phoneUrl) + '">📞 ' + esc(c.phoneUs || 'Telefone') + ' · ' + esc(phone) + '</a>';
      }
      if (waUrl) {
        quick += '<a href="' + esc(waUrl) + '" target="_blank" rel="noopener noreferrer">💬 ' + esc(c.whatsapp) + '</a>';
      }
      quick += '</div>';
    }
    var subjects = [
      { v: '', l: '—' },
      { v: 'order', l: c.subjectOrder },
      { v: 'product', l: c.subjectProduct },
      { v: 'return', l: c.subjectReturn },
      { v: 'other', l: c.subjectOther }
    ];
    var subjHtml = subjects.map(function (s) {
      return '<option value="' + esc(s.v) + '">' + esc(s.l) + '</option>';
    }).join('');
    body.innerHTML =
      '<div class="acc-wrap">' +
      '<h2 style="font-family:\'Cormorant Garamond\',serif;font-size:22px;margin-bottom:6px;">' + esc(c.title) + '</h2>' +
      '<p class="acc-hint">' + esc(c.sub) + '</p>' + quick +
      '<div class="fgrid one" style="margin-top:16px;">' +
      '<div class="field"><label>' + esc(c.name) + '</label><input id="ctName" type="text" value="' + esc(state.clientName || state.form.name || '') + '"/></div>' +
      '<div class="field"><label>' + esc(c.email) + ' *</label><input id="ctEmail" type="email" value="' + esc(state.clientEmail || state.form.email || '') + '"/></div>' +
      '<div class="field"><label>' + esc(c.subject) + '</label><select id="ctSubject">' + subjHtml + '</select></div>' +
      '<div class="field"><label>' + esc(c.message) + ' *</label><textarea id="ctMessage" placeholder="' + esc(c.messagePH) + '"></textarea></div></div>' +
      '<button type="button" class="btn-pay" style="width:100%;margin-top:8px;" id="ctSubmitBtn" onclick="Shop.submitContact()">' + esc(c.send) + '</button></div>';
  }

  async function submitContact() {
    var c = contactT();
    var nome = ($('ctName') && $('ctName').value.trim()) || '';
    var email = normEmail(($('ctEmail') && $('ctEmail').value) || '');
    var subjKey = ($('ctSubject') && $('ctSubject').value) || '';
    var msg = ($('ctMessage') && $('ctMessage').value.trim()) || '';
    if (!email || !msg) {
      global.toast(t().tReq, 'e');
      return;
    }
    if (!validEmail(email)) {
      global.toast(accT().emailInvalid, 'e');
      return;
    }
  var subjLabel = '';
    if (subjKey === 'order') subjLabel = c.subjectOrder;
    else if (subjKey === 'product') subjLabel = c.subjectProduct;
    else if (subjKey === 'return') subjLabel = c.subjectReturn;
    else if (subjKey === 'other') subjLabel = c.subjectOther;
    var fullMsg = subjLabel ? '[' + subjLabel + ']\n\n' + msg : msg;
    var btn = $('ctSubmitBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = c.sending;
    }
    if (!apiUrlConfigured()) {
      global.toast((t().apiErrorPrefix || 'API: ') + (state.lang === 'pt' ? 'não configurada' : state.lang === 'es' ? 'no configurada' : state.lang === 'en' ? 'not configured' : 'non configurée'), 'e');
      if (btn) { btn.disabled = false; btn.textContent = c.send; }
      return;
    }
    try {
      var res = await erpCall('sendContactMessage', { name: nome, email: email, message: fullMsg });
      if (!res || !res.success) {
        global.toast((res && res.error) || c.send, 'e');
        if (btn) { btn.disabled = false; btn.textContent = c.send; }
        return;
      }
      state.contactSent = true;
      renderContact();
      global.toast(c.success, 's');
    } catch (e) {
      global.toast(e.message, 'e');
      if (btn) { btn.disabled = false; btn.textContent = c.send; }
    }
  }

  async function subscribeNewsletter(email) {
    if (!email || !apiUrlConfigured()) return;
    try {
      await erpCall('subscribeNewsletter', { email: email });
      global.toast(t().newsletterOk, 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  async function pingApi() {
    try {
      var res = await erpCall('ping', {});
      return res && res.success;
    } catch (e) { return false; }
  }

  function getTheme() {
    if (global.getTheme) return global.getTheme();
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function onThemeChange(theme) {
    state.theme = theme;
    if (state.payMethod === 'stripe' && $('coBg') && $('coBg').classList.contains('open') && !state.ordered) {
      state.stripeAmountCents = 0;
      destroyStripeElement();
      scheduleStripeMount_();
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────
  async function init() {
    state.theme = getTheme();
    loadSession();
    bindImageZoomEvents();
    showApiBanner(!apiUrlConfigured());
    state.loading = false;

    if (!apiUrlConfigured()) {
      state.productsLoading = false;
      if (global.boot) global.boot();
      renderNav();
      renderFooterShop();
      render();
      return;
    }

    state.productsLoading = true;
    tryRestoreCatalogCache();
    if (global.boot) global.boot();
    renderNav();
    renderFooterShop();
    render();

    pingApi().then(function (ok) {
      if (!ok) showApiBanner(true);
      else showApiBanner(false);
    }).catch(function () { showApiBanner(true); });

    loadStore().then(function () {
      state.storeLoading = false;
      if (cfgOn('maintenance_mode', false)) {
        var msg = state.config.maintenance_message || t().maintenanceDefault || 'Boutique en maintenance. Revenez bientôt.';
        document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Montserrat,sans-serif;text-align:center;"><div><h1 style="font-weight:300;margin-bottom:12px;">AZAVISION</h1><p style="color:#666;max-width:420px;">' + esc(msg) + '</p></div></div>';
        return;
      }
      if (global.boot) global.boot();
      applyBrandUi();
      applyPromoBanner();
      renderNav();
      renderFooterShop();
    }).catch(function () {
      state.storeLoading = false;
    });

    loadCategories().then(function () {
      renderCats();
    }).catch(function () { /* ignore */ });

    loadProducts(false).then(function () {
      renderNav();
      renderFooterShop();
      render();
      syncCartFromServer().catch(function () { /* ignore */ });
    }).catch(function (e) {
      state.productsLoading = false;
      if (!state.products.length) {
        showApiBanner(true);
        global.toast((t().apiErrorPrefix || 'API: ') + e.message, 'e');
      }
      renderGrid();
      syncCartFromServer().catch(function () { /* ignore */ });
    });
    if (state.token) restoreClientSession().catch(function () { /* ignore */ });
    if (state.clientId) loadWishlistServer().catch(function () { /* ignore */ });
    handleOrderHash();
    global.addEventListener('hashchange', handleOrderHash);
  }

  function setLang(l) {
    window._langSet = true;
    state.lang = (global.T && global.T[l]) ? l : 'pt';
    try { localStorage.setItem('azav_lang', state.lang); } catch (e) { /* ignore */ }
    if (global.boot) global.boot();
    applyVitrineContent(state.lang);
    applyPromoBanner();
    if ($('accBg') && $('accBg').classList.contains('open')) renderAccount();
    if ($('coBg') && $('coBg').classList.contains('open') && !state.ordered) renderCo();
    if ($('cartBg') && $('cartBg').classList.contains('open')) renderCart();
    if ($('wishBg') && $('wishBg').classList.contains('open')) renderWish();
    if (state.qvProd && $('qvBg') && $('qvBg').classList.contains('open')) renderQv();
    if ($('contactBg') && $('contactBg').classList.contains('open')) renderContact();
    renderNav();
    renderFooterShop();
  }

  global.Shop = {
    init: init,
    setLang: setLang,
    scrollShop: scrollShop,
    selectCat: selectCat,
    resetAll: resetAll,
    navGo: navGo,
    renderNav: renderNav,
    renderFooterShop: renderFooterShop,
    toggleMobileNav: toggleMobileNav,
    closeMobileNav: closeMobileNav,
    updateScrollLock: updateScrollLock,
    openOrdersOrLogin: openOrdersOrLogin,
    trackGuestOrder: trackGuestOrder,
    refreshProducts: refreshProducts,
    refreshProductsDebounced: refreshProductsDebounced,
    loadMoreProducts: loadMoreProducts,
    renderCats: renderCats,
    render: render,
    addCart: addCart,
    addWishlistToCart: addWishlistToCart,
    remCart: remCart,
    updQty: updQty,
    openCart: openCart,
    closeCart: closeCart,
    renderCart: renderCart,
    setPromo: setPromo,
    applyPromo: applyPromo,
    toggleWish: toggleWish,
    openWish: openWish,
    closeWish: closeWish,
    openQv: openQv,
    closeQv: closeQv,
    openQvImageZoom: openQvImageZoom,
    closeImageZoom: closeImageZoom,
    zoomImageStep: zoomImageStep,
    resetImageZoom: resetImageZoomTransform,
    renderQv: renderQv,
    setQvSize: setQvSize,
    setQvColor: setQvColor,
    setQvGallery: setQvGallery,
    setQvViewMode: setQvViewMode,
    qvGalleryPrev: qvGalleryPrev,
    qvGalleryNext: qvGalleryNext,
    toggleQvGuide: toggleQvGuide,
    openCo: openCo,
    closeCo: closeCo,
    setForm: setForm,
    setPayMethod: setPayMethod,
    printInvoice: printInvoice,
    loadOrderReceipt: loadOrderReceipt,
    downloadInvoice: downloadInvoice,
    printOrderInvoice: printOrderInvoice,
    submitOrder: submitOrder,
    copyLastOrderCode: copyLastOrderCode,
    openLastOrderTracking: openLastOrderTracking,
    openAccount: openAccount,
    closeAccount: closeAccount,
    setAccountView: setAccountView,
    login: login,
    startRegister: startRegister,
    verifyRegisterOtp: verifyRegisterOtp,
    resendRegisterOtp: resendRegisterOtp,
    requestPasswordReset: requestPasswordReset,
    confirmPasswordReset: confirmPasswordReset,
    logout: logout,
    saveProfile: saveProfile,
    saveNewAddress: saveNewAddress,
    useAddress: useAddress,
    deleteAddress: deleteAddress,
    loadMyOrders: loadMyOrders,
    openOrderDetail: openOrderDetail,
    subscribeNewsletter: subscribeNewsletter,
    onThemeChange: onThemeChange,
    openContact: openContact,
    closeContact: closeContact,
    submitContact: submitContact,
    imgError: imgError,
    logoError: logoError,
    applyVitrineContent: applyVitrineContent,
    applyPromoBanner: applyPromoBanner
  };

  document.addEventListener('DOMContentLoaded', function () {
    init();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  GUIDE API — VITRINE (erp-shop.js · fin de fichier)
  //  Ce fichier LIT les clés ; il ne les contient pas.
  //  Où coller : 01-vitrine-client/index.html → fin → script erp-api-config
  //  Référence   : 03-google-apps-script/api_apps_script.gs (Ctrl+End)
  // ═══════════════════════════════════════════════════════════════════════════
  //
  //  Variables lues depuis index.html (global) :
  //    API_URL / ERP_API_URL_DEFAULT  → #1 URL Web App GAS
  //    STRIPE_PUBLISHABLE_KEY         → #3 Stripe pk_ (checkout carte)
  //
  //  Variables lues depuis getConfig() (feuille Sheets CONFIG) :
  //    pay_stripe_enabled, pay_show_stripe  → activer Stripe
  //    contact_phone, contact_whatsapp    → #5 contact réclamations
  //    fiscal_* → géré côté serveur GAS (Facturalusa #4), pas côté vitrine
  //
  //  Carte test Stripe : 4242 4242 4242 4242 · date future · CVC 123
  // ═══════════════════════════════════════════════════════════════════════════
})(typeof window !== 'undefined' ? window : this);
