/**
 * AZAVISION — Vitrine (01-vitrine-client) · API Google Apps Script
 */
(function (global) {
  'use strict';

  var API = global.API_URL || global.ERP_API_URL_DEFAULT || '';
  var STRIPE_PK = global.STRIPE_PUBLISHABLE_KEY || '';

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
    qvTab: 'desc',
    qvGuide: false,
    form: { name: '', email: '', phone: '', addr: '', city: '', zip: '' },
    payMethod: 'cod',
    ordered: false,
    lastOrderId: '',
    lastOrderEmail: '',
    delStep: 0,
    loading: true,
    stripe: null,
    stripeElements: null,
    stripePaymentElement: null,
    contactSent: false,
    theme: 'dark'
  };

  function $(id) { return document.getElementById(id); }

  function apiUrlConfigured() {
    return API && API.indexOf('INSEREZ_VOTRE') === -1 && API.indexOf('/exec') > -1;
  }

  async function erpCall(action, data, token) {
    if (!apiUrlConfigured()) throw new Error('API_URL non configurée (index.html)');
    var res = await fetch(API, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: data || {}, token: token != null ? token : state.token || '' })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
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

  function productSizes(p) {
    if (p.sizes && p.sizes.length) return p.sizes;
    return [t().oneSize || '—'];
  }
  function normalizeOptionValue(v) {
    var val = String(v || '').trim();
    return val && val !== '—' ? val : '';
  }
  function productColorOptions(p) {
    return (p.colors || []).map(normalizeOptionValue).filter(Boolean);
  }
  function productSizeOptions(p) {
    return ((p && p.sizes) || []).map(normalizeOptionValue).filter(Boolean);
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

  function shippingThreshold() { return cfgNum('free_shipping_threshold', cfgNum('shipping_free_above', 150)); }
  function shippingFlat() { return cfgNum('shipping_flat_rate', 7.9); }

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
    ['cartBg', 'wishBg', 'qvBg', 'coBg', 'contactBg', 'accBg', 'navMobileBg'].forEach(function (id) {
      var el = $(id);
      if (el && el.classList.contains('open')) lock = true;
    });
    if ($('soEl') && $('soEl').classList.contains('open')) lock = true;
    if (document.body) document.body.classList.toggle('scroll-lock', lock);
  }

  function closeAllOverlays() {
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

  function colorCss(name) {
    if (!name || name === '—') return '#666';
    if (String(name).charAt(0) === '#') return name;
    var h = 0;
    for (var i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return '#' + (h & 0xffffff).toString(16).padStart(6, '0');
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

  function driveThumbUrl(fileId, width) {
    if (!fileId) return '';
    var w = Math.min(Math.max(parseInt(width, 10) || 400, 120), 1600);
    return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w' + w;
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
    var driveId = resolveProductDriveId(p);
    if (driveId) {
      return {
        driveId: driveId,
        grid: driveThumbUrl(driveId, 480),
        md: driveThumbUrl(driveId, 800),
        lg: driveThumbUrl(driveId, 1200),
        sm: driveThumbUrl(driveId, 200),
        srcset: driveThumbUrl(driveId, 320) + ' 320w, ' + driveThumbUrl(driveId, 480) + ' 480w, ' + driveThumbUrl(driveId, 640) + ' 640w'
      };
    }
    var raw = (p && p.imagem) || '';
    var grid = optimizeImageUrl(raw, 480) || placeholderImage();
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

  function imgHtml(src, alt, opts) {
    opts = opts || {};
    var url = src || placeholderImage();
    var cls = 'shop-img' + (opts.className ? ' ' + opts.className : '');
    var parts = [
      'class="' + cls + '"',
      'src="' + esc(url) + '"',
      'alt="' + esc(alt || '') + '"',
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
      if (!p || !p.img) return;
      try {
        var im = new Image();
        im.decoding = 'async';
        im.src = p.img;
      } catch (e) { /* ignore */ }
    });
  }

  function findVariant(prod, size, color) {
    var vars = prod.variantes || (prod._raw && prod._raw.variantes) || [];
    if (!vars.length) return null;
    var sz = size || '', cl = color || '';
    var hit = vars.find(function (v) {
      var ts = String(v.tamanho || '').trim();
      var tc = String(v.cor || '').trim();
      return (!sz || ts === sz || !ts) && (!cl || tc === cl || !tc);
    });
    if (!hit && sz) hit = vars.find(function (v) { return String(v.tamanho || '').trim() === sz; });
    if (!hit && cl) hit = vars.find(function (v) { return String(v.cor || '').trim() === cl; });
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
      colors: (p.cores && p.cores.length) ? p.cores : ['—'],
      sizes: (p.tamanhos && p.tamanhos.length) ? p.tamanhos : [],
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
    if (!state.store) state.store = {};
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

  function applyVitrineContent(lang) {
    lang = lang || state.lang || 'pt';
    var c = state.store && state.store.content && state.store.content[lang];
    if (!c) return;
    function setText(id, val, html) {
      var el = $(id);
      if (!el || !val) return;
      if (html) el.innerHTML = val;
      else el.textContent = val;
      el.dataset.erp = '1';
    }
    setText('hEye', c.hEye, false);
    setText('hTitle', c.hTitle, true);
    setText('hSub', c.hSub, false);
    setText('hBtn1', c.hBtn1, false);
    setText('hBtn2', c.hBtn2, false);
    setText('secLabel', c.shopLabel, false);
    setText('secTitle', c.shopTitle, false);
    setText('fDesc', c.fDesc, false);
  }

  function resetHeroBackgroundTuning(heroBg) {
    if (!heroBg) return;
    heroBg.style.removeProperty('--hero-bg-pos');
    heroBg.style.removeProperty('--hero-motion-scale');
    try { delete heroBg.dataset.heroProbe; } catch (e) { /* ignore */ }
  }

  function tuneHeroBackground(heroBg, rawUrl) {
    if (!heroBg || !rawUrl) return;
    var tunedUrl = String(optimizeImageUrl(rawUrl, 1600) || rawUrl).trim();
    if (!tunedUrl) return;
    heroBg.dataset.heroProbe = tunedUrl;
    resetHeroBackgroundTuning(heroBg);
    heroBg.dataset.heroProbe = tunedUrl;
    var probe = new Image();
    probe.decoding = 'async';
    probe.onload = function () {
      if (heroBg.dataset.heroProbe !== tunedUrl) return;
      var w = probe.naturalWidth || 0;
      var h = probe.naturalHeight || 0;
      if (!w || !h) return;
      var ratio = w / h;
      if (ratio < 0.95) {
        heroBg.style.setProperty('--hero-bg-pos', 'center 18%');
        heroBg.style.setProperty('--hero-motion-scale', '1.03');
      } else if (ratio > 1.8) {
        heroBg.style.setProperty('--hero-bg-pos', 'center center');
        heroBg.style.setProperty('--hero-motion-scale', '1.08');
      } else {
        heroBg.style.setProperty('--hero-bg-pos', 'center 28%');
        heroBg.style.setProperty('--hero-motion-scale', '1.06');
      }
    };
    probe.onerror = function () {
      if (heroBg.dataset.heroProbe !== tunedUrl) return;
      heroBg.style.setProperty('--hero-bg-pos', 'center center');
      heroBg.style.setProperty('--hero-motion-scale', '1.06');
    };
    probe.src = tunedUrl;
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
    var heroUrl = (state.store && state.store.heroBgUrl) || (state.config && state.config.vitrine_hero_bg_url) || '';
    if (heroBg && heroUrl) {
      var tunedHeroUrl = String(optimizeImageUrl(heroUrl, 1600) || heroUrl).replace(/"/g, '');
      heroBg.style.backgroundImage = 'url("' + tunedHeroUrl + '")';
      tuneHeroBackground(heroBg, tunedHeroUrl);
    } else if (heroBg) {
      heroBg.style.backgroundImage = '';
      resetHeroBackgroundTuning(heroBg);
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

  function applyPromoBanner() {
    var text = '';
    if (cfgOn('promo_banner_enabled', false) && state.config.promo_banner_text) {
      text = state.config.promo_banner_text;
    } else if (state.config.announcement_promo_code) {
      text = '✦ CODE : ' + state.config.announcement_promo_code + ' ✦';
    }
    if (!text) text = t().promo;
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

  async function loadProducts() {
    var filters = {};
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
    var res = await erpCall('getProducts', filters);
    if (!res || !res.success) throw new Error((res && res.error) || 'getProducts');
    state.products = (res.products || []).map(mapProduct);
    preloadProductImages(state.products, 12);
  }

  function showLoader(on) {
    var el = $('shopLoader');
    if (el) el.style.display = on ? 'flex' : 'none';
  }

  function showApiBanner(on) {
    var el = $('apiBanner');
    if (el) el.style.display = on ? 'block' : 'none';
  }

  async function refreshProducts() {
    if (!apiUrlConfigured()) {
      state.loading = false;
      showApiBanner(true);
      render();
      return;
    }
    state.loading = true;
    showLoader(true);
    try {
      await loadProducts();
      showApiBanner(false);
    } catch (e) {
      global.toast((t().errorPrefix || '') + e.message, 'e');
      state.products = [];
    }
    state.loading = false;
    showLoader(false);
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

  function render() {
    if (state.loading) return;
    renderCats();
    updateNavActive();
    var list = getList();
    var n = list.length;
    if ($('resCount')) $('resCount').textContent = n + ' ' + (n > 1 ? t().plural : t().single);
    if (!n) {
      $('grid').innerHTML = '<div class="no-res"><h3>' + esc(t().noT) + '</h3><p>' + esc(t().noD) + '</p>' +
        '<button class="btn-gold" style="margin:0 auto;" onclick="Shop.resetAll()">' + esc(t().noBtn) + '</button></div>';
      return;
    }
    $('grid').innerHTML = list.map(function (p, idx) {
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
        '<div class="swatches">' + p.colors.map(function (c) {
          return '<span class="sw" style="background:' + colorCss(c) + '" title="' + esc(c) + '"></span>';
        }).join('') + '</div></div></div>';
    }).join('');
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
    if (!color && !hasColorOptions(p)) color = normalizeOptionValue((p.colors || [])[0]) || '—';
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

  async function updQty(key, d) {
    var it = state.cart.find(function (x) { return x.key === key; });
    if (it) it.qty = Math.max(1, it.qty + d);
    await refreshActivePromo({ silent: true });
    renderCart();
    if ($('coBg') && $('coBg').classList.contains('open') && !state.ordered) renderCo();
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
        if (!p && it.produto_id) {
          try {
            var pr = await erpCall('getProduct', { id: it.produto_id });
            if (pr && pr.success && pr.product) p = mapProduct(pr.product);
          } catch (e1) { /* ignore */ }
        }
        if (!p) continue;
        var size = it.tamanho || productSizes(p)[0];
        var color = it.cor || p.colors[0];
        var cartVar = findVariant(p, size, color);
        var cartImg = variantImageUrl(p, cartVar, 200) || p.imgSm || p.img;
        var key = p.id + '-' + size + '-' + color;
        state.cart.push({
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
        });
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
        '<p class="ci-meta">' + esc(t().sizeMeta) + ': ' + esc(it.size) + ' · ' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + colorCss(it.color) + ';vertical-align:middle;"></span></p></div>' +
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
      '<div class="ship-bar"><p class="ship-msg ' + (afterDisc >= shippingThreshold() ? 'ok' : '') + '">' +
      (afterDisc >= shippingThreshold() ? esc(t().shipOk) : esc(t().shipNeed.replace('{n}', (shippingThreshold() - afterDisc).toFixed(2)))) +
      '</p><div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div></div>' +
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
    if (!p && apiUrlConfigured()) {
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
    state.qvSize = hasSizeOptions(p) ? '' : (normalizeOptionValue(productSizes(p)[0]) || (t().oneSize || '—'));
    state.qvColor = hasColorOptions(p) ? '' : (normalizeOptionValue((p.colors || [])[0]) || '—');
    state.qvTab = 'desc';
    state.qvGuide = false;
    renderQv();
    $('qvBg').classList.add('open');
    updateScrollLock();
  }

  function closeQv() { $('qvBg').classList.remove('open'); updateScrollLock(); }

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

    $('qvModal').innerHTML =
      '<button class="modal-close" onclick="Shop.closeQv()"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>' +
      '<div class="m-img">' + imgHtml(qvProductImage(p, state.qvSize, state.qvColor), nm(p), { eager: true, fallback: p.imgMd || p.imgLg || p.img }) + '</div>' +
      '<div class="m-body"><p class="m-cat">' + esc(catLabel) + '</p>' +
      '<h2 class="m-name">' + esc(nm(p)) + '</h2>' +
      '<p class="m-stars">' + stars(p.rate) + ' <span>(' + (p.rev || 0) + ')</span></p>' +
      '<div class="m-price"><span class="c">' + displayPrice.toFixed(2) + ' €</span>' +
      (p.old ? '<span class="o">' + p.old.toFixed(2) + ' €</span>' : '') + '</div>' +
      '<div class="tab-bar">' +
      '<button class="tab-btn ' + (state.qvTab === 'desc' ? 'on' : '') + '" onclick="Shop.setTab(\'desc\')">' + esc(t().tabDesc) + '</button>' +
      '<button class="tab-btn ' + (state.qvTab === 'comp' ? 'on' : '') + '" onclick="Shop.setTab(\'comp\')">' + esc(t().tabComp) + '</button></div>' +
      '<div class="tab-panel">' + (state.qvTab === 'desc' ? '<p>' + esc(desc(p)) + '</p>' : '<ul>' + t().comp.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>') + '</div>' +
      (colorOptions.length ? '<span class="opt-label">' + esc(t().colLbl) + '</span>' +
      '<div class="color-opts">' + colorOptions.map(function (c) {
        var on = state.qvColor === c ? ' on' : '';
        return '<button class="col-btn' + on + '" type="button" title="' + esc(c) + '" aria-label="' + esc(c) + '" style="background:' + colorCss(c) + '" onclick="Shop.setQvColor(\'' + esc(c).replace(/'/g, "\\'") + '\')"></button>';
      }).join('') + '</div>' : '') +
      (sizeOptions.length ? '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">' +
      '<span class="opt-label" style="margin:0;">' + esc(t().szLbl) + '</span>' +
      '<button style="background:none;border:none;color:var(--gold);font-size:8px;cursor:pointer;" onclick="Shop.toggleQvGuide()">' + esc(t().szGuide) + '</button></div>' +
      (state.qvGuide ? '<div class="size-guide"><span>XS · S · M · L · XL</span></div>' : '') +
      '<div class="size-opts">' + sizeOptions.map(function (s) {
        return '<button class="sz-btn ' + (state.qvSize === s ? 'on' : '') + '" type="button" onclick="Shop.setQvSize(\'' + esc(s).replace(/'/g, "\\'") + '\')">' + esc(s) + '</button>';
      }).join('') + '</div>' : '') +
      ((colorOptions.length || sizeOptions.length) ? '<div class="qv-selection-box">' +
      (colorOptions.length ? '<div class="qv-selection-row' + (state.qvColor ? '' : ' missing') + '"><span>' + esc(t().colLbl) + '</span><strong>' + esc(state.qvColor || t().selectColorPrompt) + '</strong></div>' : '') +
      (sizeOptions.length ? '<div class="qv-selection-row' + (state.qvSize ? '' : ' missing') + '"><span>' + esc(t().szLbl) + '</span><strong>' + esc(state.qvSize || t().selectSizePrompt) + '</strong></div>' : '') +
      '<p class="qv-selection-note' + (canAdd ? ' ok' : '') + '">' + esc(canAdd ? t().selectionReady : t().selectOptionsNotice) + '</p></div>' : '') +
      '<div class="m-cta">' +
      '<button class="btn-madd' + (canAdd ? '' : ' disabled') + '" ' + (canAdd ? 'onclick="Shop.addCart(\'' + pid + '\',\'' + esc(state.qvSize).replace(/'/g, "\\'") + '\',\'' + esc(state.qvColor).replace(/'/g, "\\'") + '\');Shop.closeQv()"' : 'type="button" disabled') + '>' + esc(t().addSel) + '</button>' +
      '<button class="btn-mfav" onclick="Shop.toggleWish(\'' + pid + '\');Shop.renderQv()">' + (faved ? esc(t().favAdded) : esc(t().favAdd)) + '</button></div></div>';
  }

  function setTab(tab) { state.qvTab = tab; renderQv(); }
  function setQvSize(s) { state.qvSize = s; renderQv(); }
  function setQvColor(c) { state.qvColor = c; renderQv(); }
  function toggleQvGuide() { state.qvGuide = !state.qvGuide; renderQv(); }

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

  function paymentOptionsHtml() {
    var opts = [];
    if (cfgOn('pay_show_cod', true) && cfgOn('pay_cod_enabled', true)) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="cod" ' + (state.payMethod === 'cod' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'cod\')"/> ' +
        esc(t().payCod) + '</label>');
    }
    if (cfgOn('pay_stripe_enabled', false) && cfgOn('pay_show_stripe', true) && STRIPE_PK) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="stripe" ' + (state.payMethod === 'stripe' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'stripe\')"/> ' + esc(t().payStripe) + '</label>');
    }
    if (cfgOn('pay_show_transfer', true)) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="transfer" ' + (state.payMethod === 'transfer' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'transfer\')"/> ' +
        esc(t().payTransfer) + '</label>');
    }
    if (!opts.length) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="cod" checked/> ' +
        esc(t().payContact) + '</label>');
    }
    return '<div class="pay-opts">' + opts.join('') + '</div>';
  }

  function setPayMethod(m) {
    state.payMethod = m;
    renderCo();
  }

  function openCo() {
    closeCart();
    state.ordered = false;
    state.delStep = 0;
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
  }

  async function initStripeElement() {
    if (!STRIPE_PK || !global.Stripe) return;
    destroyStripeElement();
    state.stripe = global.Stripe(STRIPE_PK);
    var stripeTheme = getTheme() === 'light' ? 'stripe' : 'night';
    state.stripeElements = state.stripe.elements({ appearance: { theme: stripeTheme } });
    state.stripePaymentElement = state.stripeElements.create('payment');
    var mount = $('stripe-payment-element');
    if (mount) state.stripePaymentElement.mount('#stripe-payment-element');
  }

  function renderCo() {
    if (state.ordered) {
      var lastEmail = state.lastOrderEmail || state.form.email || state.clientEmail || '';
      $('coBody').innerHTML =
        '<div class="order-ok"><span class="ok-emoji">🎉</span>' +
        '<h2 class="ok-title">' + esc(t().ordTitle) + '</h2>' +
        '<p class="ok-sub">' + esc(t().ordSub.replace('{name}', state.form.name).replace('{ref}', '#' + state.lastOrderId).replace('{email}', lastEmail)) + '</p>' +
        '<div class="order-ref-card"><p class="order-ref-label">' + esc(t().orderCodeLabel) + '</p><div class="order-ref-row"><strong>#' + esc(state.lastOrderId) + '</strong><button type="button" class="btn-copy-ref" onclick="Shop.copyLastOrderCode()">' + esc(t().copyOrderCode) + '</button></div><p class="order-ref-help">' + esc(t().orderCodeHint) + '</p></div>' +
        '<div class="tracking"><p class="tr-title">' + esc(t().trTitle) + '</p><div class="tr-steps">' +
        [[t().tr1t, t().tr1d], [t().tr2t, t().tr2d], [t().tr3t, t().tr3d.replace('{address}', state.form.addr).replace('{city}', state.form.city)]].map(function (pair, i) {
          return '<div class="tr-step"><span class="tr-dot ' + (state.delStep > i ? 'done' : '') + '" id="td' + i + '"></span><h4>' + esc(pair[0]) + '</h4><p>' + esc(pair[1]) + '</p></div>';
        }).join('') +
        '</div></div><div class="order-ok-actions"><button class="btn-gold" type="button" onclick="Shop.openLastOrderTracking()">' + esc(t().trackOrderNow) + '</button><button class="btn-order-secondary" type="button" onclick="Shop.closeCo()">' + esc(t().backBtn) + '</button></div></div>';
      state.delStep = 1;
      setTimeout(function () { state.delStep = 2; updDots(); }, 5000);
      setTimeout(function () { state.delStep = 3; updDots(); }, 10000);
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
      '<div class="fgrid one"><div class="field"><label>' + esc(t().fAddr) + '</label><input value="' + esc(f.addr) + '" oninput="Shop.setForm(\'addr\',this.value)"/></div></div>' +
      '<div class="fgrid">' +
      '<div class="field"><label>' + esc(t().fZip) + '</label><input value="' + esc(f.zip) + '" oninput="Shop.setForm(\'zip\',this.value)"/></div>' +
      '<div class="field"><label>' + esc(t().fCity) + '</label><input value="' + esc(f.city) + '" oninput="Shop.setForm(\'city\',this.value)"/></div></div>' +
      '<p class="form-title" style="margin-top:16px;">' + esc(t().s2) + '</p>' +
      paymentOptionsHtml() +
      '<div id="stripe-payment-element" style="margin:12px 0;' + (state.payMethod === 'stripe' ? '' : 'display:none;') + '"></div>' +
      '<div class="sec-note"><span>' + esc(t().secN) + '</span><strong>' + esc(t().secS) + '</strong></div>' +
      '<p style="font-size:10px;color:var(--muted);margin:8px 0;">Total : <strong style="color:var(--gold);">' + totals.total.toFixed(2) + ' €</strong></p>' +
      '<button class="btn-pay" onclick="Shop.submitOrder()">' + esc(t().payBtn) + '</button></div>';

    if (state.payMethod === 'stripe') initStripeElement();
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

  async function submitOrder() {
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
      global.toast('Configure API_URL dans index.html', 'e');
      return;
    }

    await refreshActivePromo({ silent: true });
    var totals = orderTotals();
    var endereco = [f.addr, f.zip, f.city].filter(Boolean).join(', ');
    var awaitStripe = state.payMethod === 'stripe' && STRIPE_PK && cfgOn('pay_stripe_enabled', false);

    try {
      var orderPayload = {
        clientId: state.clientId || 'guest',
        email: normEmail(f.email),
        telefone: f.phone || '',
        nome: f.name,
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
        global.toast((orderRes && orderRes.error) || 'createOrder failed', 'e');
        return;
      }

      state.lastOrderId = orderRes.orderId;
      state.lastOrderEmail = normEmail(f.email);
      saveSession();

      if (awaitStripe) {
        var piRes = await erpCall('createStripePaymentIntent', { orderId: orderRes.orderId, email: f.email });
        if (!piRes || !piRes.success || !piRes.clientSecret) {
          global.toast((piRes && piRes.error) || 'Stripe intent failed', 'e');
          return;
        }
        if (!state.stripe) await initStripeElement();
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
          global.toast((confirmRes && confirmRes.error) || 'confirmStripePayment', 'e');
          return;
        }
      } else if (state.payMethod === 'cod' || state.payMethod === 'transfer') {
        await erpCall('processPayment', {
          orderId: orderRes.orderId,
          metodo: state.payMethod,
          valor: totals.total.toFixed(2),
          clientId: state.clientId || 'guest'
        });
      }

      state.cart = [];
      clearPromoState();
      if (state.cartId) {
        try { await erpCall('clearCart', { cartId: state.cartId }); } catch (e2) { /* ignore */ }
      }
      updBadge();
      state.ordered = true;
      renderCo();
      global.toast(t().ordTitle, 's');
    } catch (e) {
      global.toast(e.message, 'e');
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
      var res = await erpCall('getOrder', { orderId: orderId });
      if (!res || !res.success || !res.order) {
        global.toast(a.trackNotFound, 'e');
        return;
      }
      var orderEmail = normEmail(res.order.email || res.order.cliente_email || '');
      if (orderEmail && orderEmail !== email) {
        global.toast(a.trackEmailMismatch, 'e');
        return;
      }
      state.selectedOrder = { order: res.order, details: res.details || [] };
      state.accountView = 'orderDetail';
      renderAccount();
    } catch (e) {
      global.toast(e.message, 'e');
    }
  }

  function handleOrderHash() {
    var h = (global.location && global.location.hash) || '';
    if (h.indexOf('#order-') !== 0) return;
    var orderId = h.replace('#order-', '').trim();
    if (!orderId) return;
    openAccount();
    openOrderDetail(orderId);
    try { global.history.replaceState(null, '', global.location.pathname + global.location.search); } catch (e) { /* ignore */ }
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
      '<p class="acc-hint">' + esc(a.email) + '</p>' +
      '<div class="field"><label>' + esc(a.email) + '</label><input id="forgotEmail" type="email" value="' + esc(state.resetEmail || state.clientEmail || state.form.email || '') + '"/></div>' +
      '<button type="button" class="btn-pay" style="width:100%;margin-top:12px;" onclick="Shop.requestPasswordReset()">' + esc(a.forgotBtn) + '</button>' +
      '<p style="margin-top:14px;text-align:center;"><button type="button" class="acc-link" onclick="Shop.setAccountView(\'login\')">' + esc(a.back) + '</button></p>';
  }

  function renderResetForm() {
    var a = accT();
    return '<p class="form-title">' + esc(a.forgot) + '</p>' +
      '<p class="acc-hint">' + esc(state.resetEmail) + '</p>' +
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
      if (normalizeOptionValue(d.cor)) meta.push(t().colorMeta + ': ' + d.cor);
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
      if (otpRes.simulated_code) {
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
    var email = normEmail(($('forgotEmail') && $('forgotEmail').value) || '');
    if (!validEmail(email)) {
      global.toast(a.emailInvalid, 'e');
      return;
    }
    try {
      var res = await erpCall('requestPasswordReset', { email: email });
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Reset', 'e');
        return;
      }
      state.resetEmail = email;
      state.accountView = 'reset';
      renderAccount();
      global.toast(a.resetSent, 's');
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
        email: state.resetEmail,
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
        return '<div class="acc-order" onclick="Shop.openOrderDetail(\'' + esc(o.pedido_id) + '\')">' +
          '<div class="acc-order-id">#' + esc(o.pedido_id) + '</div>' +
          '<p style="font-size:10px;color:var(--muted);margin-top:4px;">' + esc(o.data) + ' · ' + esc(o.total) + ' €</p>' +
          '<p style="font-size:9px;color:var(--gold);margin-top:4px;">' + esc(o.estado || '') + ' · ' + esc(o.estado_pagamento || '') + '</p></div>';
      }).join('');
    } catch (e) { box.textContent = e.message; }
  }

  async function openOrderDetail(orderId) {
    try {
      var res = await erpCall('getOrder', { orderId: orderId });
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
    var quick = '';
    if (pubEmail || waUrl) {
      quick = '<p class="acc-hint" style="margin-top:8px;">' + esc(c.or) + '</p><div class="contact-quick">';
      if (pubEmail) {
        quick += '<a href="mailto:' + esc(pubEmail) + '">✉ ' + esc(c.emailUs) + '</a>';
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
      destroyStripeElement();
      initStripeElement();
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────
  async function init() {
    state.theme = getTheme();
    loadSession();
    showApiBanner(!apiUrlConfigured());
    if (!apiUrlConfigured()) {
      state.loading = false;
      render();
      return;
    }
    showLoader(true);
    try {
      var ok = await pingApi();
      if (!ok) throw new Error('ping failed');
      await Promise.all([loadStore(), loadCategories(), loadProducts()]);
      await syncCartFromServer();
      if (state.token) await restoreClientSession();
      if (state.clientId) await loadWishlistServer();
      showApiBanner(false);
    } catch (e) {
      showApiBanner(true);
      global.toast((t().apiErrorPrefix || 'API: ') + e.message, 'e');
    }
    state.loading = false;
    showLoader(false);
    if (global.boot) global.boot();
    renderNav();
    renderFooterShop();
    render();
    handleOrderHash();
  }

  function setLang(l) {
    window._langSet = true;
    state.lang = (global.T && global.T[l]) ? l : 'pt';
    if (global.boot) global.boot();
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
    renderQv: renderQv,
    setTab: setTab,
    setQvSize: setQvSize,
    setQvColor: setQvColor,
    toggleQvGuide: toggleQvGuide,
    openCo: openCo,
    closeCo: closeCo,
    setForm: setForm,
    setPayMethod: setPayMethod,
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
    applyVitrineContent: applyVitrineContent
  };

  document.addEventListener('DOMContentLoaded', function () {
    init();
  });
})(typeof window !== 'undefined' ? window : this);
