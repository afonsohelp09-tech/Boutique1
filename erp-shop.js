/**
 * AZAVISION — Vitrine (01-vitrine-client) · API Google Apps Script
 */
(function (global) {
  'use strict';

  var API = global.API_URL || global.ERP_API_URL_DEFAULT || '';
  var STRIPE_PK = global.STRIPE_PUBLISHABLE_KEY || '';
  var DEFAULT_CONTACT_EMAIL = 'azavision1@gmail.com';
  var DEFAULT_COMPLAINT_EMAIL = 'azavision1@gmail.com';

  function refreshStripePk_() {
    if (!STRIPE_PK && global.STRIPE_PUBLISHABLE_KEY) STRIPE_PK = global.STRIPE_PUBLISHABLE_KEY;
    return STRIPE_PK || '';
  }

  function getStripePk_() {
    return refreshStripePk_();
  }

  function logStripeApiError_(action, res, extra) {
    console.error('[AZAVISION] Stripe — ' + action + ':', res || extra || 'erreur inconnue');
    if (res) {
      try { console.error('[AZAVISION] Stripe — détail JSON:', JSON.stringify(res)); } catch (e) { /* ignore */ }
    }
    if (extra) console.error('[AZAVISION] Stripe — info:', extra);
  }

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
    lastOrderEmail: 'azav_last_order_email',
    regDraft: 'azav_reg_draft',
    otpTarget: 'azav_otp_target'
  };

  var state = {
    lang: 'pt',
    products: [],
    categories: [],
    store: null,
    config: {},
    storeConfigReady: false,
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
    editingAddressId: '',
    selectedOrder: null,
    returnFormOrderId: '',
    promo: '',
    discAmount: 0,
    discPct: 0,
    couponTipo: '',
    couponCode: '',
    couponCategoria: '',
    couponValor: 0,
    qvProd: null,
    qvSize: '',
    qvColor: '',
    qvGuide: false,
    qvGalleryIndex: 0,
    qvForceVariant: false,
    qvViewMode: 'shop',
    qvInfoTab: 'desc',
    qvOpenReviewsTab: false,
    reviewEligibility: {},
    qvAddedFlash: null,
    form: { name: '', email: '', phone: '', addr: '', city: '', zip: '', nif: '', acceptCheckoutTerms: false },
    payMethod: 'stripe_card',
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
    stripeMountedPmType: '',
    checkoutBusy: false,
    registerInFlight: false,
    stripeRetryOrderId: '',
    stripeRetryOrderTotal: 0,
    stripeRetryPayMethod: 'stripe_card',
    lastStripeVoucher: null,
    lastStripePending: false,
    stripeRetryName: '',
    stripeRetryEmail: '',
    _stripePollTimer: null,
    _stripeServerTotal: null,
    contactSent: false,
    theme: 'dark',
    pageScrollY: 0
  };

  function $(id) { return document.getElementById(id); }

  function apiUrlConfigured() {
    return API && API.indexOf('INSEREZ_VOTRE') === -1 && API.indexOf('/exec') > -1;
  }

  function translateApiError(msg, code) {
    var m = String(msg || '').trim();
    var a = accT();
    if (code) {
      var codeMap = {
        REG_EMAIL_EXISTS: a.emailAlreadyRegistered,
        OTP_RATE_LIMIT: a.otpRateLimit,
        EMAIL_SEND_FAILED: a.emailSendFailed,
        OTP_INVALID: a.otpInvalid,
        OTP_EXPIRED: a.otpExpired,
        OTP_SMS_UNAVAILABLE: a.otpSmsUnavailable,
        REG_PASS_SHORT: a.passMin,
        REG_EMAIL_INVALID: a.emailInvalid,
        USE_OTP: a.registerIntro,
        coupon_invalid: t().promoErr,
        coupon_usage_limit: t().promoUsageLimit
      };
      if (codeMap[code]) return codeMap[code];
    }
    if (!m) return t().errGeneric || 'Erro';
    var L = state.lang || 'pt';
    var map = {
      'Email já registado': { pt: a.emailAlreadyRegistered, fr: a.emailAlreadyRegistered, en: a.emailAlreadyRegistered, es: a.emailAlreadyRegistered },
      'Code invalide ou expiré': { pt: a.otpInvalid, fr: a.otpInvalid, en: a.otpInvalid, es: a.otpInvalid },
      'Code expiré. Demandez un nouveau code.': { pt: a.otpExpired, fr: a.otpExpired, en: a.otpExpired, es: a.otpExpired },
      'Erro ao enviar email. Verifique a ligação ou tente mais tarde.': { pt: a.emailSendFailed, fr: a.emailSendFailed, en: a.emailSendFailed, es: a.emailSendFailed },
      'Trop de tentatives. Réessayez dans quelques minutes.': { pt: a.otpRateLimit, fr: a.otpRateLimit, en: a.otpRateLimit, es: a.otpRateLimit },
      'Commande déjà payée': { pt: 'Encomenda já paga.', fr: 'Commande déjà payée.', en: 'Order already paid.', es: 'Pedido ya pagado.' },
      'Méthode de paiement non autorisée': { pt: 'Método de pagamento não autorizado.', fr: 'Méthode de paiement non autorisée.', en: 'Payment method not allowed.', es: 'Método de pago no autorizado.' },
      'Pedido não encontrado': { pt: 'Encomenda não encontrada.', fr: 'Commande introuvable.', en: 'Order not found.', es: 'Pedido no encontrado.' },
      'Cupão inválido ou expirado': { pt: t().promoErr, fr: t().promoErr, en: t().promoErr, es: t().promoErr },
      'Cupão já atingiu o limite de utilizações': { pt: t().promoUsageLimit, fr: t().promoUsageLimit, en: t().promoUsageLimit, es: t().promoUsageLimit },
      'Code non applicable aux articles du panier': { pt: t().promoCatErr, fr: t().promoCatErr, en: t().promoCatErr, es: t().promoCatErr },
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
    if (json && json.error) json.error = translateApiError(json.error, json.code);
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
  function stars(r) {
    var n = Math.max(0, Math.min(5, Math.round(parseFloat(r) || 0)));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function starsGlyphsHtml(rate) {
    var n = Math.max(0, Math.min(5, Math.round(parseFloat(rate) || 0)));
    var chips = '';
    for (var i = 1; i <= 5; i++) {
      chips += '<span class="star-chip' + (i <= n ? ' on' : '') + '">' + (i <= n ? '★' : '☆') + '</span>';
    }
    return '<span class="stars-glyph" aria-hidden="true">' + chips + '</span>';
  }

  function productStarsHtml(rate, count) {
    var rev = parseInt(count, 10) || 0;
    return starsGlyphsHtml(rate) + ' <span class="stars-meta">(' + rev + ' ' + esc(t().reviews) + ')</span>';
  }

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
    return cfgOn('shipping_enabled', false);
  }
  function shippingShowStorefront() {
    return cfgOn('shipping_show_storefront', true);
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

  function getProductEnvioGratisDesde(p) {
    if (!p) return null;
    var raw = p.envio_gratis_desde != null ? p.envio_gratis_desde : (p._raw && p._raw.envio_gratis_desde);
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    var n = parseFloat(String(raw).replace(',', '.'));
    return isNaN(n) ? null : Math.max(0, n);
  }

  function productById(id) {
    return state.products.find(function (x) { return x.id === id || x.produto_id === id; });
  }

  function productShippingHintHtml(p, unitPrice) {
    if (!shippingShowStorefront()) return '';
    var th = getProductEnvioGratisDesde(p);
    if (th === null) return '';
    var price = unitPrice != null ? unitPrice : (p.price || 0);
    if (th === 0 || price >= th) {
      return '<p class="qv-ship ok">' + esc(t().prodShipFree) + '</p>';
    }
    return '<p class="qv-ship">' + esc(t().prodShipFrom.replace('{n}', th.toFixed(2))) + '</p>';
  }

  function cartHasProductShippingInfo() {
    return state.cart.some(function (it) { return getProductEnvioGratisDesde(productById(it.id)) !== null; });
  }

  function cartShowsShippingUi() {
    if (!shippingShowStorefront()) return false;
    if (state.couponTipo === 'free_shipping') return shippingEnabled() || cartHasProductShippingInfo();
    return shippingEnabled() || cartHasProductShippingInfo();
  }

  function computeCartShipping(afterDiscSubtotal) {
    if (state.couponTipo === 'free_shipping') return 0;
    if (!state.cart.length) return 0;
    var sub = cartSub();
    var after = afterDiscSubtotal != null ? afterDiscSubtotal : Math.max(0, sub - currentDiscount(sub));
    var discountRatio = sub > 0 ? (after / sub) : 1;
    var needsPaidShip = false;
    var globalBucket = 0;
    var hasGlobalLines = false;
    state.cart.forEach(function (it) {
      var p = productById(it.id);
      var th = getProductEnvioGratisDesde(p);
      var lineTotal = it.price * it.qty;
      var lineAfter = lineTotal * discountRatio;
      if (th === null) {
        if (shippingEnabled()) {
          hasGlobalLines = true;
          globalBucket += lineAfter;
        }
        return;
      }
      if (th === 0) return;
      if (lineAfter < th) needsPaidShip = true;
    });
    if (needsPaidShip && shippingEnabled()) return shippingFlat();
    if (hasGlobalLines && shippingEnabled()) {
      if (globalBucket >= shippingThreshold()) return 0;
      return shippingFlat();
    }
    return 0;
  }

  function cartShipBarHtml(afterDisc) {
    if (!cartShowsShippingUi() || state.couponTipo === 'free_shipping') return '';
    var hasGlobalLines = state.cart.some(function (it) { return getProductEnvioGratisDesde(productById(it.id)) === null; });
    if (shippingEnabled() && hasGlobalLines) {
      var th = shippingThreshold();
      var ok = afterDisc >= th;
      var pct = th > 0 && th < 999999 ? Math.min(100, (afterDisc / th) * 100) : 0;
      return '<div class="ship-bar"><p class="ship-msg ' + (ok ? 'ok' : '') + '">' +
        esc(ok ? t().shipOk : t().shipNeed.replace('{n}', Math.max(0, th - afterDisc).toFixed(2))) +
        '</p><div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div></div>';
    }
    if (cartHasProductShippingInfo()) {
      var ship = computeCartShipping(afterDisc);
      return '<div class="ship-bar"><p class="ship-msg ' + (ship === 0 ? 'ok' : '') + '">' +
        esc(ship === 0 ? t().shipOk : t().prodShipCartHint) + '</p></div>';
    }
    return '';
  }

  function normalizeCat(s) { return String(s || '').trim().toLowerCase(); }

  function normalizeSearchText(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[''`.´]/g, '')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getSearchQuery() {
    var v = ($('srchIn') && $('srchIn').value) || ($('soIn') && $('soIn').value) || '';
    return String(v).trim();
  }

  function setSearchQuery(q, skipRefresh) {
    var val = String(q || '');
    if ($('srchIn')) $('srchIn').value = val;
    if ($('soIn')) $('soIn').value = val;
    updateSearchClearBtn();
    if (!skipRefresh) refreshProductsDebounced();
  }

  function getSearchTokens(rawQuery) {
    var norm = normalizeSearchText(rawQuery);
    if (!norm) return [];
    return norm.split(' ').filter(function (w) {
      return w.length >= 2 || /^\d+$/.test(w);
    });
  }

  function productSearchBlob(p) {
    var parts = [nm(p), desc(p), p.cat, p.id, p.produto_id];
    productColorOptions(p).forEach(function (c) {
      parts.push(colorDisplayName(c));
      parts.push(c);
    });
    productSizeOptions(p).forEach(function (s) { parts.push(s); });
    return normalizeSearchText(parts.join(' '));
  }

  function productMatchesSearch(p, rawQuery) {
    var q = normalizeSearchText(rawQuery);
    if (!q) return true;
    var blob = productSearchBlob(p);
    if (blob.indexOf(q) >= 0) return true;
    var tokens = getSearchTokens(rawQuery);
    if (!tokens.length) return blob.indexOf(q) >= 0;
    for (var i = 0; i < tokens.length; i++) {
      if (blob.indexOf(tokens[i]) < 0) return false;
    }
    return true;
  }

  function searchRelevanceScore(p, rawQuery) {
    var q = normalizeSearchText(rawQuery);
    if (!q) return 0;
    var score = 0;
    var name = normalizeSearchText(nm(p));
    var cat = normalizeSearchText(p.cat);
    if (name === q) score += 200;
    else if (name.indexOf(q) === 0) score += 130;
    else if (name.indexOf(q) >= 0) score += 90;
    if (cat.indexOf(q) >= 0) score += 40;
    getSearchTokens(rawQuery).forEach(function (tok) {
      if (name.indexOf(tok) === 0) score += 30;
      else if (name.indexOf(tok) >= 0) score += 22;
      if (cat.indexOf(tok) >= 0) score += 12;
      if (normalizeSearchText(desc(p)).indexOf(tok) >= 0) score += 8;
    });
    return score;
  }

  function updateSearchClearBtn() {
    var btn = $('srchClear');
    var input = $('srchIn');
    var has = !!getSearchQuery();
    if (btn) btn.style.display = has ? 'flex' : 'none';
    if (input) input.classList.toggle('has-clear', has);
  }

  function clearSearch(skipRefresh) {
    setSearchQuery('', true);
    if (!skipRefresh) refreshProducts();
    else updateShopCategoryHeader();
  }

  function clearActiveFilters() {
    if (getSearchQuery() && state.cat !== 'all') resetAll();
    else if (getSearchQuery()) clearSearch();
    else resetAll();
  }

  function renderSearchSuggestions() {
    var box = $('soSuggest');
    if (!box) return;
    var chips = t().searchChips || [];
    if (!chips.length) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = '<p class="search-suggest-lbl">' + esc(t().searchSuggestLbl || '') + '</p>' +
      '<div class="search-suggest-row">' + chips.map(function (c) {
        var q = esc(c.q || c.label || '').replace(/'/g, "\\'");
        return '<button type="button" class="search-chip" onclick="Shop.pickSearchChip(\'' + q + '\')">' + esc(c.label || c.q) + '</button>';
      }).join('') + '</div>';
  }

  function openSearchOverlay() {
    var ov = $('soEl');
    if (!ov) return;
    capturePageScroll();
    if ($('soIn') && $('srchIn')) $('soIn').value = $('srchIn').value;
    ov.classList.add('open');
    ov.setAttribute('aria-hidden', 'false');
    renderSearchSuggestions();
    updateScrollLock();
    setTimeout(function () {
      var soIn = $('soIn');
      if (soIn) { soIn.focus(); soIn.select(); }
    }, 50);
  }

  function closeSearchOverlay(updateLock) {
    var ov = $('soEl');
    if (!ov) return;
    ov.classList.remove('open');
    ov.setAttribute('aria-hidden', 'true');
    if (updateLock !== false) updateScrollLock();
  }

  function pickSearchChip(q) {
    setSearchQuery(q, true);
    applySearch();
  }

  function applySearch() {
    if ($('soIn') && $('srchIn')) $('srchIn').value = $('soIn').value;
    closeSearchOverlay();
    scrollShop();
    refreshProducts();
  }

  function syncSearchFromOverlay() {
    if ($('soIn') && $('srchIn')) {
      if (document.activeElement === $('soIn')) $('srchIn').value = $('soIn').value;
      else if (document.activeElement === $('srchIn')) $('soIn').value = $('srchIn').value;
    }
    updateSearchClearBtn();
    refreshProductsDebounced();
  }

  function handleSearchOverlayKey(e) {
    if (!e) return;
    if (e.key === 'Escape') closeSearchOverlay();
    else if (e.key === 'Enter') applySearch();
  }

  var NAV_NEW = '__new__';
  var NAV_SALE = '__sale__';
  var NAV_WOMEN = '__women__';
  var NAV_MEN = '__men__';
  var NAV_ACCESSORIES = '__accessories__';

  var NAV_CAT_GROUPS = {
    __women__: { grupo: 'women', re: /femm|mulher|woman|women|mujer|femin/i },
    __men__: { grupo: 'men', re: /homm|homem|\bmen\b|hombre|mascul/i },
    __accessories__: { grupo: 'accessories', re: /access|acess|accessor|accesor/i }
  };

  function isNavCatGroup(catId) {
    return !!NAV_CAT_GROUPS[catId];
  }

  function navCatGroupRe(catId) {
    var g = NAV_CAT_GROUPS[catId];
    return g ? g.re : null;
  }

  function categoryNameMatchesNavGroup(name, catId) {
    var re = navCatGroupRe(catId);
    return re ? re.test(String(name || '')) : false;
  }

  function categoryNameMatchesAnyNavGroup(name) {
    var k;
    for (k in NAV_CAT_GROUPS) {
      if (Object.prototype.hasOwnProperty.call(NAV_CAT_GROUPS, k) && NAV_CAT_GROUPS[k].re.test(String(name || ''))) return true;
    }
    return false;
  }

  function buildNavCatKeys(catId) {
    var re = navCatGroupRe(catId);
    if (!re) return null;
    var keys = {};
    state.categories.forEach(function (c) {
      var nome = String(c.nome || c.name || '');
      if (re.test(nome)) keys[normalizeCat(nome)] = 1;
    });
    state.products.forEach(function (p) {
      if (p.cat && re.test(p.cat)) keys[p.catKey] = 1;
    });
    return keys;
  }

  function productMatchesNavCatGroup(p, catId) {
    if (!p) return false;
    if (!isNavCatGroup(catId)) {
      return p.catKey === catId || normalizeCat(p.cat) === catId;
    }
    var re = navCatGroupRe(catId);
    if (re && re.test(p.cat || '')) return true;
    var keys = buildNavCatKeys(catId);
    if (!keys) return false;
    if (keys[p.catKey]) return true;
    var pk = p.catKey || '';
    var k;
    for (k in keys) {
      if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
      if (pk === k) return true;
      if (pk.indexOf(k + ' ') === 0 || pk.indexOf(k + '/') === 0 || pk.indexOf(k + ' > ') >= 0) return true;
      if (pk.indexOf(' ' + k) > 0 || pk.indexOf('/' + k) > 0) return true;
    }
    return false;
  }

  function getNavGroupLabel(catId) {
    var nav = t().nav || [];
    if (catId === NAV_WOMEN && nav[1]) return nav[1];
    if (catId === NAV_MEN && nav[2]) return nav[2];
    if (catId === NAV_ACCESSORIES && nav[3]) return nav[3];
    if (catId === NAV_NEW && nav[0]) return nav[0];
    if (catId === NAV_SALE && nav[4]) return nav[4];
    return resolveCategoryName(catId) || catId;
  }

  function getActiveCategoryDisplay() {
    if (state.cat === 'all') return null;
    if (state.cat === NAV_NEW || state.cat === NAV_SALE || isNavCatGroup(state.cat)) {
      return { label: getNavGroupLabel(state.cat), slot: state.cat };
    }
    return { label: resolveCategoryName(state.cat) || state.cat, slot: state.cat };
  }

  function updateShopCategoryHeader() {
    var banner = $('shopCatBanner');
    var q = getSearchQuery();
    var active = getActiveCategoryDisplay();
    if (banner) {
      if (active || q) {
        banner.classList.add('visible');
        var n = getList().length;
        var metaTpl = t().catFilterCount || '{n} articles';
        var html = '<div class="shop-cat-banner-inner">';
        if (active) {
          html += '<span class="shop-cat-badge">' + esc(active.label) + '</span>';
        }
        if (q) {
          html += '<span class="shop-cat-badge shop-search-badge">⌕ ' + esc(q) + '</span>';
        }
        html += '<span class="shop-cat-meta">' + esc(metaTpl.replace('{n}', String(n))) + '</span>';
        html += '<button type="button" class="shop-cat-clear" onclick="Shop.clearActiveFilters()">' +
          esc(q && active ? (t().searchClearAll || t().catFilterClear) : (q ? (t().searchClear || t().catFilterClear) : (t().catFilterClear || t().seeAll))) +
          '</button></div>';
        banner.innerHTML = html;
      } else {
        banner.classList.remove('visible');
        banner.innerHTML = '';
      }
    }
    var labelEl = $('secLabel');
    var titleEl = $('secTitle');
    if (active && (isNavCatGroup(state.cat) || state.cat === NAV_SALE || state.cat === NAV_NEW)) {
      if (labelEl) labelEl.textContent = t().catFilterLabel || t().secLabel || '';
      if (titleEl) titleEl.textContent = active.label;
    }
  }

  function resolveCategoryName(catKey) {
    if (!catKey || catKey === 'all' || catKey === NAV_NEW || catKey === NAV_SALE) return '';
    if (isNavCatGroup(catKey)) {
      var hit = state.categories.find(function (c) {
        return categoryNameMatchesNavGroup(c.nome, catKey);
      });
      if (hit) return hit.nome || '';
      return getNavGroupLabel(catKey);
    }
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
      } else if (i === 1) {
        items.push({ label: label, cat: NAV_WOMEN });
      } else if (i === 2) {
        items.push({ label: label, cat: NAV_MEN });
      } else if (i === 3) {
        items.push({ label: label, cat: NAV_ACCESSORIES });
      } else if (i === labels.length - 1) {
        items.push({ label: label, cat: NAV_SALE });
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
      var html = getNavItems().map(function (it) {
        var cid = esc(it.cat).replace(/'/g, "\\'");
        var navCat = isNavCatGroup(it.cat) ? ' nav-cat-btn' : '';
        return '<li><button type="button" data-cat="' + esc(it.cat) + '" class="' + (state.cat === it.cat ? 'active' : '') + navCat + '" onclick="Shop.selectCat(\'' + cid + '\')">' + esc(it.label) + '</button></li>';
      }).join('');
      html += '<li class="nav-info-sep" aria-hidden="true"></li>';
      html += '<li><button type="button" class="nav-info-btn" onclick="Shop.openInfo(\'returns\')">' + esc(t().navInfo || 'Info') + '</button></li>';
      ul.innerHTML = html;
    }
    renderMobileNav();
    updateMobBarLabels();
  }

  function updateMobBarLabels() {
    var tx = t();
    if ($('mobMenuLbl') && tx.navMenu) $('mobMenuLbl').textContent = tx.navMenu;
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

  function getInfoPages() {
    var pages = t().infoPages;
    if (Array.isArray(pages) && pages.length) return pages;
    return [
      { id: 'returns', label: 'Returns' },
      { id: 'sizeguide', label: 'Size guide' },
      { id: 'delivery', label: 'Delivery' },
      { id: 'privacy', label: 'Privacy' },
      { id: 'terms', label: 'Terms' },
      { id: 'legal', label: 'Legal' },
      { id: 'faq', label: 'FAQ' },
      { id: 'care', label: 'Care' }
    ];
  }

  function footerSupportAction(index) {
    if (index === 0) return 'Shop.openOrdersOrLogin()';
    if (index === 1) return 'Shop.openInfo(\'delivery\')';
    if (index === 2) return 'Shop.openInfo(\'returns\')';
    if (index === 3) return 'Shop.openInfo(\'sizeguide\')';
    if (index === 4) return 'Shop.openInfo(\'faq\')';
    if (index === 5) return 'Shop.openInfo(\'care\')';
    return 'Shop.openContact()';
  }

  function legalPageHref(pageKey) {
    pageKey = String(pageKey || '').toLowerCase();
    if (pageKey === 'privacy') {
      var lg = state.lang || 'pt';
      return 'privacy.html?lang=' + encodeURIComponent(lg);
    }
    return '';
  }

  function isExternalLegalPage(pageId) {
    return String(pageId || '').toLowerCase() === 'privacy';
  }

  function renderFooterLegal() {
    var box = $('fLegal');
    if (!box) return;
    var tm = t();
    var labels = (tm.fLegal && tm.fLegal.length >= 3) ? tm.fLegal : ['Terms', 'Privacy', 'Legal notice'];
    var pages = ['terms', 'privacy', 'legal'];
    var livroUrl = 'https://www.livroreclamacoes.pt/Inicio/';
    var livroLabel = tm.livroReclamacoes || 'Livro de Reclamações';
    var html = pages.map(function (page, i) {
      if (isExternalLegalPage(page)) {
        return '<a href="' + esc(legalPageHref(page)) + '">' + esc(labels[i]) + '</a>';
      }
      return '<a href="#" onclick="event.preventDefault();Shop.openInfo(\'' + page + '\')">' + esc(labels[i]) + '</a>';
    }).join('');
    html += '<a href="' + livroUrl + '" target="_blank" rel="noopener noreferrer">' + esc(livroLabel) + '</a>';
    box.innerHTML = html;
  }

  function renderFooterSupport() {
    var box = $('fSuppL');
    if (!box) return;
    var labels = (t().fSupp && t().fSupp.length) ? t().fSupp : [];
    box.innerHTML = labels.map(function (label, i) {
      return '<li><a href="#" onclick="event.preventDefault();' + footerSupportAction(i) + '">' + esc(label) + '</a></li>';
    }).join('');
  }

  function mergeInfoOverride_(base, pageKey, lang) {
    var overrides = state.infoContentOverrides || {};
    var oPage = overrides[pageKey];
    var oDoc = oPage && (oPage[lang] || oPage.pt);
    if (!oDoc || !base) return base;
    var doc = Object.assign({}, base);
    if (oDoc.title != null && String(oDoc.title).trim()) doc.title = oDoc.title;
    if (oDoc.promise != null && String(oDoc.promise).trim()) doc.promise = oDoc.promise;
    if (oDoc.updated != null && String(oDoc.updated).trim()) doc.updated = oDoc.updated;
    if (oDoc.subtitle != null) doc.subtitle = oDoc.subtitle;
    if (oDoc.howToTitle != null) doc.howToTitle = oDoc.howToTitle;
    if (oDoc.steps && oDoc.steps.length) doc.steps = oDoc.steps.slice();
    if (oDoc.rows && oDoc.rows.length) doc.rows = oDoc.rows.slice();
    if (oDoc.cols && oDoc.cols.length) doc.cols = oDoc.cols.slice();
    if (oDoc.colHint != null) doc.colHint = oDoc.colHint;
    if (oDoc.unit != null) doc.unit = oDoc.unit;
    if (oDoc.tip != null) doc.tip = oDoc.tip;
    if (oDoc.note != null) doc.note = oDoc.note;
    if (oDoc.oneSize != null) doc.oneSize = oDoc.oneSize;
    if (oDoc.sections && oDoc.sections.length) doc.sections = oDoc.sections.slice();
    return doc;
  }

  function sizeGuideDoc() {
    var sg = global.SizeGuideContent;
    if (!sg) return null;
    var base = sg[state.lang] || sg.pt || null;
    if (!base) return null;
    var doc = Object.assign({}, base);
    if (sg.rows && sg.rows.length && !doc.rows) doc.rows = sg.rows;
    return mergeInfoOverride_(doc, 'sizeguide', state.lang);
  }

  function sizeGuideRowsFor(availableSizes) {
    var doc = sizeGuideDoc();
    var all = (doc && doc.rows && doc.rows.length) ? doc.rows : ((global.SizeGuideContent && global.SizeGuideContent.rows) ? global.SizeGuideContent.rows : []);
    if (!availableSizes || !availableSizes.length) return all;
    var norm = availableSizes.map(function (s) { return String(s || '').trim().toUpperCase(); });
    if (norm.length === 1 && (norm[0] === 'TU' || norm[0] === 'U' || norm[0] === 'ONE SIZE' || norm[0] === 'TAMANHO ÚNICO')) return [];
    var filtered = all.filter(function (r) {
      return norm.indexOf(String(r.size).toUpperCase()) >= 0;
    });
    return filtered.length ? filtered : all;
  }

  function isOneSizeOnly(availableSizes) {
    if (!availableSizes || !availableSizes.length) return false;
    if (availableSizes.length > 1) return false;
    var s = String(availableSizes[0] || '').trim().toUpperCase();
    return s === 'TU' || s === 'U' || s === 'ONE SIZE' || s === 'TAMANHO ÚNICO';
  }

  function buildSizeGuideHtml(availableSizes, compact) {
    var doc = sizeGuideDoc();
    if (!doc) return '';
    var unit = doc.unit || 'cm';
    var html = '<div class="size-guide-block' + (compact ? ' size-guide-block--compact' : '') + '">';
    if (!compact) {
      html += '<h2 class="size-guide-title">' + esc(doc.title) + '</h2>';
      html += '<p class="size-guide-sub">' + esc(doc.subtitle) + '</p>';
    }
    if (isOneSizeOnly(availableSizes)) {
      html += '<p class="size-guide-one">' + esc(doc.oneSize) + '</p></div>';
      return html;
    }
    html += '<p class="size-guide-how-title">' + esc(doc.howToTitle) + '</p>';
    html += '<ol class="size-guide-steps">';
    (doc.steps || []).forEach(function (step) {
      html += '<li>' + esc(step) + '</li>';
    });
    html += '</ol>';
    var rows = sizeGuideRowsFor(availableSizes);
    html += '<div class="size-guide-table-wrap"><table class="size-guide-table"><thead><tr>';
    (doc.cols || []).forEach(function (col) {
      html += '<th scope="col">' + esc(col) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (row) {
      html += '<tr><td><strong>' + esc(row.size) + '</strong></td>' +
        '<td>' + esc(row.chest) + ' ' + esc(unit) + '</td>' +
        '<td>' + esc(row.length) + ' ' + esc(unit) + '</td>' +
        '<td>' + esc(row.shoulder) + ' ' + esc(unit) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    if (doc.colHint) html += '<p class="size-guide-colhint">' + esc(doc.colHint) + '</p>';
    html += '<p class="size-guide-tip">' + esc(doc.tip) + '</p>';
    html += '<p class="size-guide-note">' + esc(doc.note) + '</p></div>';
    return html;
  }

  function buildLegalDocHtml(pageKey) {
    var lc = global.LegalContent;
    if (!lc || !lc[pageKey]) return '<article class="info-doc legal-doc"><p>—</p></article>';
    var base = lc[pageKey][state.lang] || lc[pageKey].pt;
    var doc = mergeInfoOverride_(base, pageKey, state.lang);
    if (!doc) return '';
    var vars = legalVars();
    var html = '<article class="info-doc legal-doc">';
    html += '<h1>' + esc(fillLegalText(doc.title, vars)) + '</h1>';
    html += '<p class="legal-meta">' + esc(fillLegalText(doc.updated, vars)) + '</p>';
    (doc.sections || []).forEach(function (sec) {
      html += '<h2>' + esc(fillLegalText(sec.h, vars)) + '</h2>';
      (sec.p || []).forEach(function (para) {
        html += '<p>' + esc(fillLegalText(para, vars)) + '</p>';
      });
    });
    html += '</article>';
    return html;
  }

  function buildInfoDocHtml(pageKey) {
    var ic = global.InfoContent;
    if (!ic || !ic[pageKey]) return '';
    var base = ic[pageKey][state.lang] || ic[pageKey].pt;
    var doc = mergeInfoOverride_(base, pageKey, state.lang);
    if (!doc) return '';
    var vars = legalVars();
    var html = '<article class="info-doc legal-doc">';
    html += '<h1>' + esc(fillLegalText(doc.title, vars)) + '</h1>';
    if (doc.promise) {
      html += '<p class="info-promise">' + esc(fillLegalText(doc.promise, vars)) + '</p>';
    }
    if (doc.updated) {
      html += '<p class="legal-meta">' + esc(fillLegalText(doc.updated, vars)) + '</p>';
    }
    (doc.sections || []).forEach(function (sec) {
      html += '<h2>' + esc(fillLegalText(sec.h, vars)) + '</h2>';
      (sec.p || []).forEach(function (para) {
        html += '<p>' + esc(fillLegalText(para, vars)) + '</p>';
      });
    });
    html += '</article>';
    return html;
  }

  function renderInfoContent(pageId) {
    if (pageId === 'sizeguide') {
      return '<div class="info-doc-wrap">' + buildSizeGuideHtml(null, false) + '</div>';
    }
    if (pageId === 'privacy' || pageId === 'terms' || pageId === 'legal') {
      return buildLegalDocHtml(pageId);
    }
    var html = buildInfoDocHtml(pageId);
    if (html) return html;
    return '<article class="info-doc legal-doc"><p>—</p></article>';
  }

  function renderInfoHub(pageId) {
    state.infoPage = pageId || 'returns';
    var nav = $('infoNav');
    var body = $('infoBody');
    var titleEl = $('infoHubTitle');
    if (!nav || !body) return;
    if (titleEl) titleEl.textContent = t().infoHubTitle || 'Info';
    nav.innerHTML = getInfoPages().map(function (p) {
      if (isExternalLegalPage(p.id)) {
        return '<a class="info-nav-btn info-nav-link" href="' + esc(legalPageHref(p.id)) + '">' + esc(p.label) + '</a>';
      }
      var pid = esc(p.id).replace(/'/g, "\\'");
      var on = p.id === state.infoPage ? ' on' : '';
      return '<button type="button" class="info-nav-btn' + on + '" onclick="Shop.openInfo(\'' + pid + '\')">' + esc(p.label) + '</button>';
    }).join('');
    body.innerHTML = renderInfoContent(state.infoPage);
    body.scrollTop = 0;
    var activeBtn = nav.querySelector('.info-nav-btn.on');
    if (activeBtn && activeBtn.scrollIntoView) {
      try {
        activeBtn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      } catch (e) {
        activeBtn.scrollIntoView(false);
      }
    }
  }

  function openInfo(pageId) {
    if (isExternalLegalPage(pageId)) {
      global.location.href = legalPageHref(pageId);
      return;
    }
    dismissMobileNav(false);
    state.infoPage = pageId || 'returns';
    var bg = $('infoBg');
    if (!bg) return;
    capturePageScroll();
    bg.classList.add('open');
    bg.setAttribute('aria-hidden', 'false');
    renderInfoHub(state.infoPage);
    updateScrollLock();
  }

  function closeInfo(updateLock) {
    var bg = $('infoBg');
    if (!bg) return;
    bg.classList.remove('open');
    bg.setAttribute('aria-hidden', 'true');
    if (updateLock !== false) updateScrollLock();
  }

  function openSizeGuide() {
    openInfo('sizeguide');
  }

  function closeSizeGuide() {
    closeInfo();
  }

  var SCROLL_STORE_KEY = 'azavision_page_scroll';

  function getPageScrollY() {
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function capturePageScroll() {
    if (document.body.classList.contains('scroll-lock')) {
      return state.pageScrollY || 0;
    }
    var y = getPageScrollY();
    state.pageScrollY = y;
    try { sessionStorage.setItem(SCROLL_STORE_KEY, String(y)); } catch (e) { /* ignore */ }
    return y;
  }

  function storedPageScrollY() {
    if (state.pageScrollY != null && !isNaN(state.pageScrollY)) return state.pageScrollY;
    try {
      var n = parseInt(sessionStorage.getItem(SCROLL_STORE_KEY), 10);
      if (!isNaN(n) && n >= 0) return n;
    } catch (e) { /* ignore */ }
    return 0;
  }

  function restorePageScrollY(y) {
    var html = document.documentElement;
    var prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    html.scrollTop = y;
    requestAnimationFrame(function () {
      window.scrollTo(0, y);
      html.scrollTop = y;
      requestAnimationFrame(function () {
        window.scrollTo(0, y);
        html.scrollTop = y;
        html.style.scrollBehavior = prev;
      });
    });
  }

  function isOverlayOpen() {
    var ids = ['cartBg', 'wishBg', 'qvBg', 'coBg', 'contactBg', 'accBg', 'navMobileBg', 'imgZoomBg', 'infoBg'];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el && el.classList.contains('open')) return true;
    }
    if ($('soEl') && $('soEl').classList.contains('open')) return true;
    return false;
  }

  function lockBodyScroll() {
    var body = document.body;
    var html = document.documentElement;
    if (!body || body.classList.contains('scroll-lock')) return;
    capturePageScroll();
    var sw = window.innerWidth - html.clientWidth;
    if (sw > 0) body.style.paddingRight = sw + 'px';
    body.classList.add('scroll-lock');
    html.classList.add('scroll-lock');
    body.style.top = '-' + state.pageScrollY + 'px';
  }

  function unlockBodyScroll() {
    var body = document.body;
    var html = document.documentElement;
    if (!body || !body.classList.contains('scroll-lock')) return;
    var y = storedPageScrollY();
    body.classList.remove('scroll-lock');
    html.classList.remove('scroll-lock');
    body.style.top = '';
    body.style.paddingRight = '';
    restorePageScrollY(y);
  }

  function updateScrollLock() {
    if (isOverlayOpen()) lockBodyScroll();
    else unlockBodyScroll();
  }

  function dismissMobileNav(updateLock) {
    var bg = $('navMobileBg');
    if (!bg || !bg.classList.contains('open')) return;
    bg.classList.remove('open');
    bg.setAttribute('aria-hidden', 'true');
    var btn = $('btnNavMenu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (updateLock !== false) updateScrollLock();
  }

  function closeAllOverlays() {
    closeImageZoom(false);
    closeCart(false);
    closeCo(false);
    closeWish(false);
    closeQv(false);
    closeAccount(false);
    closeContact(false);
    closeInfo(false);
    dismissMobileNav(false);
    closeSearchOverlay(false);
    updateScrollLock();
  }

  function toggleMobileNav() {
    var bg = $('navMobileBg');
    if (!bg) return;
    if (bg.classList.contains('open')) closeMobileNav();
    else {
      capturePageScroll();
      renderMobileNav();
      bg.classList.add('open');
      bg.setAttribute('aria-hidden', 'false');
      var btn = $('btnNavMenu');
      if (btn) btn.setAttribute('aria-expanded', 'true');
      updateScrollLock();
    }
  }

  function closeMobileNav(updateLock) {
    dismissMobileNav(updateLock);
  }

  function renderMobileNav() {
    var ul = $('navMobileUl');
    if (!ul) return;
    var items = getNavItems();
    var shopHtml = items.map(function (it) {
      var cid = esc(it.cat).replace(/'/g, "\\'");
      return '<li><button type="button" data-cat="' + esc(it.cat) + '" class="' + (state.cat === it.cat ? 'active' : '') + '" onclick="Shop.selectCat(\'' + cid + '\');Shop.closeMobileNav()">' + esc(it.label) + '</button></li>';
    }).join('');
    var infoHtml = '<li class="nav-mobile-divider" role="separator"></li>' +
      '<li class="nav-mobile-section">' + esc(t().navInfoSection || t().navInfo || 'Info') + '</li>' +
      getInfoPages().map(function (p) {
        if (isExternalLegalPage(p.id)) {
          return '<li><a class="nav-info-link" href="' + esc(legalPageHref(p.id)) + '" onclick="Shop.closeMobileNav()">' + esc(p.label) + '</a></li>';
        }
        var pid = esc(p.id).replace(/'/g, "\\'");
        return '<li><button type="button" class="nav-info-link" onclick="Shop.openInfo(\'' + pid + '\');Shop.closeMobileNav()">' + esc(p.label) + '</button></li>';
      }).join('');
    ul.innerHTML = shopHtml + infoHtml;
    var foot = $('navMobileFoot');
    if (foot) {
      var langs = ['fr', 'pt', 'en', 'es'];
      var th = getTheme();
      foot.innerHTML =
        '<div class="nav-foot-row">' +
        '<span class="nav-foot-label">' + esc(t().navLangLabel || 'Langue') + '</span>' +
        '<div class="lang-switch lang-box" role="group">' + langs.map(function (l) {
          return '<button type="button" class="' + (state.lang === l ? 'on' : '') + '" onclick="setLang(\'' + l + '\')">' + l.toUpperCase() + '</button>';
        }).join('') + '</div></div>' +
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
    updateShopCategoryHeader();
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
    updateShopCategoryHeader();
    if (global.boot) global.boot();
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

  /** URLs Drive haute résolution — même fichier que l'aperçu (pas de lh3 aléatoire). */
  function driveZoomCandidates(fid, version) {
    if (!fid) return [];
    var list = [];
    [1600, 1200, 1000, 800, 480].forEach(function (w) {
      var u = driveThumbUrl(fid, w, version);
      if (u && list.indexOf(u) < 0) list.push(u);
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

  function qvActiveImageRef(p) {
    if (!p) return { url: placeholderImage(), md: '', lg: '' };
    var gallery = productGalleryList(p);
    var gIdx = state.qvGalleryIndex || 0;
    if (gIdx >= gallery.length) gIdx = 0;
    if (gallery.length > 1 && !state.qvForceVariant) {
      return gallery[gIdx] || gallery[0];
    }
    var variantImg = qvProductImage(p, state.qvSize, state.qvColor);
    if (variantImg && variantImg !== placeholderImage()) {
      return { url: variantImg, md: variantImg, lg: variantImg };
    }
    if (gallery.length) return gallery[gIdx] || gallery[0];
    return {
      url: p.imgLg || p.imgMd || p.img || placeholderImage(),
      md: p.imgMd || p.img || '',
      lg: p.imgLg || p.imgMd || p.img || placeholderImage()
    };
  }

  function qvDisplayedImageUrl(p) {
    var ref = qvActiveImageRef(p);
    return ref.lg || ref.md || ref.url || placeholderImage();
  }

  function qvZoomImageUrl(p) {
    var ref = qvActiveImageRef(p);
    return zoomGalleryImageUrl(ref, p);
  }

  function zoomUrlFromSrc(url, p) {
    if (!url || url === placeholderImage()) return placeholderImage();
    var ver = p ? imageVersionSuffix(p) : '';
    var fid = extractDriveFileId(url);
    if (fid) return driveZoomImageUrl(fid, ver);
    return resolveZoomImageUrl(url, []);
  }

  function buildZoomCandidatesForAnchor(anchorUrl, p) {
    if (!anchorUrl || anchorUrl === placeholderImage()) return [placeholderImage()];
    var ver = p ? imageVersionSuffix(p) : '';
    var fid = extractDriveFileId(anchorUrl);
    if (fid) {
      var list = driveZoomCandidates(fid, ver);
      if (list.indexOf(anchorUrl) < 0) list.unshift(anchorUrl);
      return list.length ? list : [anchorUrl];
    }
    var resolved = resolveZoomImageUrl(anchorUrl, []);
    if (resolved && resolved !== placeholderImage() && resolved !== anchorUrl) {
      return [resolved, anchorUrl];
    }
    return [anchorUrl];
  }

  function qvVisibleImageSrc() {
    var el = document.querySelector('#qvModal .m-img-zoom img[data-zoom-src]');
    if (el) {
      var zs = el.getAttribute('data-zoom-src');
      if (zs && zs.indexOf('data:image/svg') < 0) return zs;
    }
    el = document.querySelector('#qvModal .m-img-zoom img.shop-img.loaded, #qvModal .m-img-zoom img.shop-img.img-fallback, #qvModal .m-img-zoom img');
    if (!el || !el.src) return '';
    if (String(el.src).indexOf('data:image/svg') >= 0) return '';
    if (el.classList.contains('img-fallback')) {
      var fb = el.getAttribute('data-fallback');
      if (fb && fb.indexOf('data:image/svg') < 0) return fb;
    }
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
    capturePageScroll();
    resetImageZoomTransform();
    img.classList.remove('loaded');
    if (wrap) wrap.classList.remove('dragging');
    img.alt = alt || '';
    bg.classList.add('open');
    bg.setAttribute('aria-hidden', 'false');
    var hint = $('imgZoomHint');
    if (hint) hint.textContent = t().imgZoomHelp || '';
    updateScrollLock();

    var anchor = src || (fallbacks && fallbacks[0]) || '';
    if (!anchor || anchor === placeholderImage()) {
      anchor = (fallbacks || []).find(function (u) {
        return u && u !== placeholderImage();
      }) || placeholderImage();
    }

    var anchorFid = extractDriveFileId(anchor);
    var candidates = buildZoomCandidatesForAnchor(anchor, productCtx);
    if (anchorFid) {
      candidates = candidates.filter(function (u) {
        var f = extractDriveFileId(u);
        return !f || f === anchorFid;
      });
      if (!candidates.length) candidates = [anchor];
    }

    var idx = 0;
    function tryLoad() {
      if (idx >= candidates.length) {
        markZoomImageLoaded();
        return;
      }
      var url = candidates[idx];
      img.onload = function () {
        img.onload = null;
        img.onerror = null;
        markZoomImageLoaded();
      };
      img.onerror = function () {
        img.onload = null;
        img.onerror = null;
        idx++;
        tryLoad();
      };
      img.src = url;
      if (img.complete && img.naturalWidth > 0) {
        img.onload = null;
        img.onerror = null;
        markZoomImageLoaded();
      }
    }
    tryLoad();
  }

  function closeImageZoom(updateLock) {
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
    if (updateLock !== false) updateScrollLock();
  }

  function openQvImageZoom() {
    var p = state.qvProd;
    if (!p) return;
    var ref = qvActiveImageRef(p);
    var zoomSrc = qvVisibleImageSrc() || qvZoomImageUrl(p);
    var displayed = qvDisplayedImageUrl(p);
    var extras = [displayed, ref.lg, ref.md, ref.url].filter(function (u, i, arr) {
      return u && u !== placeholderImage() && arr.indexOf(u) === i;
    });
    openImageZoom(zoomSrc, nm(p), extras, p);
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
    if (opts.zoomSrc) {
      parts.push('data-zoom-src="' + esc(opts.zoomSrc) + '"');
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
      envio_gratis_desde: p.envio_gratis_desde != null ? p.envio_gratis_desde : '',
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
      state.token = storageGet(LS.token);
      state.clientId = storageGet(LS.clientId);
      state.clientName = storageGet(LS.clientName);
      state.clientEmail = storageGet(LS.clientEmail);
      state.lastOrderId = localStorage.getItem(LS.lastOrderId) || '';
      state.lastOrderEmail = localStorage.getItem(LS.lastOrderEmail) || '';
      var wl = localStorage.getItem(LS.wishLocal);
      state.wish = wl ? JSON.parse(wl) : [];
      loadRegDraftFromStorage();
    } catch (e) { state.wish = []; }
  }

  function loadRegDraftFromStorage() {
    try {
      var raw = storageGet(LS.regDraft);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          state.regDraft = d;
          if (!d.password) state.regDraft.password = '';
          if (!d.password2) state.regDraft.password2 = '';
        }
      }
      var ot = storageGet(LS.otpTarget);
      if (ot) state.otpTarget = ot;
      if (state.regDraft && state.otpTarget && !state.token) state.accountView = 'otp';
    } catch (e2) { /* ignore */ }
  }

  function saveRegDraftToStorage() {
    try {
      if (state.regDraft) {
        var safe = Object.assign({}, state.regDraft);
        storageSet(LS.regDraft, JSON.stringify(safe));
      } else {
        storageSet(LS.regDraft, '');
      }
      storageSet(LS.otpTarget, state.otpTarget || '');
    } catch (e) { /* ignore */ }
  }

  function clearRegDraftStorage() {
    state.regDraft = null;
    state.otpTarget = '';
    storageSet(LS.regDraft, '');
    storageSet(LS.otpTarget, '');
  }

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

  function saveSession() {
    try {
      if (state.cartId) localStorage.setItem(LS.cartId, state.cartId);
      storageSet(LS.token, state.token || '');
      storageSet(LS.clientId, state.clientId || '');
      storageSet(LS.clientName, state.clientName || '');
      storageSet(LS.clientEmail, state.clientEmail || '');
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

  function orderStateLabel_(code) {
    var a = accT();
    var k = String(code || '').toLowerCase().trim();
    if (!k) return '—';
    var map = {
      pending: a.ostPending, processing: a.ostProcessing, em_processamento: a.ostProcessing, preparacao: a.ostPrep,
      paid: a.ostPaid, pago: a.ostPaid, pago_stripe: a.ostPaid,
      shipped: a.ostShipped, enviado: a.ostShipped, em_transito: a.ostTransit,
      delivered: a.ostDelivered, entregue: a.ostDelivered,
      cancelled: a.ostCancelled, cancelado: a.ostCancelled,
      aguardando_pagamento: a.ostAwaiting, reembolsado: a.ostRefunded
    };
    return map[k] || code || '—';
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
      return !!(state.token && state.clientId);
    }
  }

  function loginDeviceLabel() {
    var ua = String(navigator.userAgent || '');
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone/iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Mobi/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  // ---- Connexion Google (OAuth / Google Identity Services) ---------------
  function googleClientId_() {
    return String((state.config && state.config.google_client_id) || '').trim();
  }

  /** Bloc « ou / Continuer avec Google » — visible seulement si google_client_id est configuré. */
  function googleSignInBoxHtml_() {
    if (!googleClientId_()) return '';
    var a = accT();
    return '<div class="acc-or"><span>' + esc(a.orSeparator || 'ou') + '</span></div>' +
      '<div id="googleBtnBox" class="g-signin-box" aria-label="Google"></div>';
  }

  function onGoogleCredential_(resp) {
    var cred = resp && resp.credential;
    if (!cred) return;
    var a = accT();
    erpCall('googleSignIn', { credential: cred, device: loginDeviceLabel(), lang: state.lang || 'pt' })
      .then(function (res) {
        if (!res || !res.success) {
          global.toast((res && res.error) || (a.googleError || 'Connexion Google impossible'), 'e');
          return;
        }
        applySessionFromAuth(res, res.nome || '', res.email || '');
        state.accountView = 'dashboard';
        saveSession();
        Promise.all([loadClientProfile(), loadWishlistServer()]).catch(function () {}).then(function () {
          prefillCheckoutFromProfile();
          renderAccount();
          global.toast(res.isNew ? (a.connected || 'Conta criada') : (a.connected || 'Ligado'), 's');
          processPendingReviewDeepLink_();
        });
      })
      .catch(function (e) { global.toast((e && e.message) || (a.googleError || 'Google'), 'e'); });
  }

  function initGoogleId_() {
    var cid = googleClientId_();
    if (!cid) return false;
    if (!global.google || !global.google.accounts || !global.google.accounts.id) return false;
    if (state._googleIdInited) return true;
    try {
      global.google.accounts.id.initialize({
        client_id: cid,
        callback: onGoogleCredential_,
        ux_mode: 'popup',
        auto_select: false
      });
      state._googleIdInited = true;
      return true;
    } catch (e) { return false; }
  }

  function mountGoogleButton_() {
    if (!googleClientId_()) return;
    var box = $('googleBtnBox');
    if (!box) return;
    if (!initGoogleId_()) {
      // GIS pas encore chargé : nouvelle tentative courte (mobile / réseau lent).
      if ((state._googleMountTries || 0) < 20) {
        state._googleMountTries = (state._googleMountTries || 0) + 1;
        setTimeout(mountGoogleButton_, 250);
      }
      return;
    }
    state._googleMountTries = 0;
    try {
      box.innerHTML = '';
      var width = Math.min(360, Math.max(220, box.offsetWidth || 300));
      global.google.accounts.id.renderButton(box, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'center',
        locale: state.lang || 'pt',
        width: width
      });
    } catch (e) { /* ignore */ }
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
    if (!state.form.nif && p.nif) state.form.nif = p.nif;
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

  function isStoreConfigReady() {
    return !!state.storeConfigReady;
  }

  /** Mode chargement hero avant config admin : `brand` (A, défaut) ou `minimal` (B). Config : vitrine_hero_loading_mode */
  function heroLoadingMode_() {
    var m = String((state.config && state.config.vitrine_hero_loading_mode) || '').toLowerCase().trim();
    if (m === 'minimal') return 'minimal';
    try {
      if (sessionStorage.getItem('azv_hero_load_mode') === 'minimal') return 'minimal';
    } catch (e) { /* ignore */ }
    return 'brand';
  }

  function persistHeroLoadingMode_() {
    try { sessionStorage.setItem('azv_hero_load_mode', heroLoadingMode_()); } catch (e) { /* ignore */ }
  }

  /** État A/B pendant le chargement API — pas de texte marketing i18n. */
  function applyHeroLoadingState() {
    if (isStoreConfigReady()) return;
    var mode = heroLoadingMode_();
    try {
      document.body.classList.remove('hero-loading-brand', 'hero-loading-minimal');
      document.body.classList.add(mode === 'minimal' ? 'hero-loading-minimal' : 'hero-loading-brand');
    } catch (eB) { /* ignore */ }
    var loadEl = $('heroLoading');
    if (loadEl) loadEl.setAttribute('aria-busy', 'true');
    var name = (state.store && state.store.storeName) ? String(state.store.storeName).trim() : 'AZAVISION';
    var brandEl = $('heroLoadingBrand');
    if (brandEl) brandEl.textContent = name || 'AZAVISION';
    var logoEl = $('heroLoadingLogo');
    if (logoEl) {
      logoEl.alt = name || 'AZAVISION';
      var logoSrc = (state.store && state.store.logoUrl)
        ? (optimizeImageUrl(state.store.logoUrl, 240) || state.store.logoUrl)
        : '';
      if (logoSrc) {
        logoEl.src = logoSrc;
        logoEl.style.display = '';
        logoEl.onerror = function () { logoEl.style.display = 'none'; };
      } else {
        logoEl.removeAttribute('src');
        logoEl.style.display = 'none';
      }
    }
    if (mode === 'brand') startHeroMotionCanvas_();
    else stopHeroMotionCanvas_();
  }

  function setVitrinePending(pending) {
    try {
      if (pending) {
        document.body.classList.add('vitrine-pending');
        applyHeroLoadingState();
      } else {
        document.body.classList.remove('vitrine-pending');
      }
    } catch (ePend) { /* ignore */ }
  }

  function markStoreConfigReady() {
    state.storeConfigReady = true;
    persistHeroLoadingMode_();
    var loadEl = $('heroLoading');
    if (loadEl) loadEl.setAttribute('aria-busy', 'false');
    setVitrinePending(false);
  }

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
        fDesc: String(cfg['vitrine_footer_desc_' + lg] || cfg.boutique_footer_tagline || '').trim(),
        svc: buildSvcContentFromConfig(cfg, lg)
      };
    });
    return content;
  }

  function buildSvcContentFromConfig(cfg, lg) {
    var svc = [];
    for (var i = 0; i < 4; i++) {
      svc.push({
        t: String(cfg['vitrine_svc' + i + '_title_' + lg] || '').trim(),
        d: String(cfg['vitrine_svc' + i + '_desc_' + lg] || '').trim()
      });
    }
    return svc;
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
      if (brandRes.brand.empresa && typeof brandRes.brand.empresa === 'object') {
        state.store.empresa = brandRes.brand.empresa;
      }
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
        if (sd.empresa && typeof sd.empresa === 'object') state.store.empresa = sd.empresa;
        if (sd.infoContent && typeof sd.infoContent === 'object') state.infoContentOverrides = sd.infoContent;
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
    markStoreConfigReady();
    applyBrandUi();
    applyHeroTextColors();
    applyPromoBanner();
    applyVitrineContent(state.lang);
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

  function applySocialDisplay() {
    var show = cfgOn('vitrine_display_social', true);
    var row = document.querySelector('.social-row');
    if (row) row.style.display = show ? '' : 'none';
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
    if (!isStoreConfigReady()) {
      applyServicesStrip();
      return;
    }
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
    var lang = state.lang || 'pt';
    var showSection = cfgOn('vitrine_display_services', true);
    var sec = document.querySelector('.services-in-footer') || document.querySelector('.services');
    var grid = document.getElementById('svcGrid');
    if (!grid && !sec) return;

    if (!isStoreConfigReady()) {
      if (grid) grid.innerHTML = '';
      if (sec) sec.style.display = 'none';
      return;
    }

    var customSvc = (state.store && state.store.content && state.store.content[lang] && state.store.content[lang].svc) || [];
    var offlineFallback = !apiUrlConfigured();
    var fallbackSvc = [];
    if (offlineFallback) {
      try {
        var tr = t();
        fallbackSvc = (tr && tr.svc) || [];
      } catch (eFb) { /* ignore */ }
    }
    var parts = [];
    for (var i = 0; i < 4; i++) {
      if (!cfgOn('vitrine_display_svc' + i, true)) continue;
      var custom = customSvc[i] || {};
      var fb = fallbackSvc[i] || {};
      var title = String(custom.t || '').trim() || (offlineFallback ? String(fb.t || '').trim() : '');
      var desc = String(custom.d || '').trim() || (offlineFallback ? String(fb.d || '').trim() : '');
      if (!title && !desc) continue;
      var ico = (global.IconUi && IconUi.svc) ? IconUi.svc(i) : (fb.i || '');
      parts.push('<div class="svc"><span class="svc-icon">' + ico + '</span><h3 class="svc-title">' + esc(title) + '</h3><p class="svc-desc">' + esc(desc) + '</p></div>');
    }

    if (grid) grid.innerHTML = parts.join('');
    if (sec) sec.style.display = (showSection && parts.length) ? '' : 'none';
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

  var heroMotionState_ = { raf: 0, particles: [], w: 0, h: 0, cssW: 0, cssH: 0, dpr: 1, bound: false, orientBound: false, visBound: false };

  var AZV_HERO_MOTION_POOL_ = ['letters_luxe', 'letters_web', 'letters', 'letters_cascade', 'letters_stars', 'letters_orbit', 'letters_pulse', 'web', 'stars', 'sunmoon'];

  function heroMotionIsMobileViewport_(w) {
    w = w || heroMotionState_.w || 0;
    if (w > 0 && w < 768) return true;
    try { return global.matchMedia && global.matchMedia('(max-width:768px)').matches; } catch (e) { return false; }
  }

  function heroMotionHexToRgb_(hex) {
    var h = String(hex || '').trim();
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return '197,169,110';
    return parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16);
  }

  function heroMotionDarkenHex_(hex, pct) {
    var h = String(hex || '#C9A96E').trim();
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) || 197;
    var g = parseInt(h.slice(2, 4), 16) || 169;
    var b = parseInt(h.slice(4, 6), 16) || 110;
    var f = 1 - (pct || 0.18);
    function pad(n) { var s = Math.round(n).toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + pad(r * f) + pad(g * f) + pad(b * f);
  }

  function heroMotionPalette_() {
    var colors = (state.store && state.store.colors) || {};
    var accent = String(colors.accent || state.config.color_accent || '#C9A96E').trim();
    if (accent.charAt(0) !== '#') accent = '#' + accent;
    var main = String(colors.main || state.config.color_main || '#0d0d0d').trim();
    if (main.charAt(0) !== '#') main = '#' + main;
    var theme = getTheme();
    var isLight = theme === 'light';
    var bg = isLight ? '#e6dfd4' : (main || '#0d0d0d');
    var goldHex = isLight ? heroMotionDarkenHex_(accent, 0.32) : accent;
    return {
      bg: bg,
      gold: heroMotionHexToRgb_(goldHex),
      gold2: heroMotionHexToRgb_(heroMotionDarkenHex_(goldHex, isLight ? 0.18 : 0.22)),
      light: isLight
    };
  }

  function heroMotionInitParticles_(w, h) {
    heroMotionState_.particles = [];
    var mobile = heroMotionIsMobileViewport_(w);
    var n = Math.max(mobile ? 16 : 24, Math.floor((w * h) / (mobile ? 13000 : 9000)));
    for (var i = 0; i < n; i++) {
      heroMotionState_.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 0.4,
        a: Math.random(),
        va: (Math.random() - 0.5) * 0.008,
        gold: Math.random() > 0.6
      });
    }
  }

  function heroMotionResize_() {
    var canvas = $('heroMotionCanvas');
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    if (w < 50 || h < 50) {
      heroMotionScheduleLayoutFixes_();
      return;
    }
    if (w === heroMotionState_.cssW && h === heroMotionState_.cssH && dpr === heroMotionState_.dpr) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    heroMotionState_.cssW = w;
    heroMotionState_.cssH = h;
    heroMotionState_.dpr = dpr;
    heroMotionState_.w = w;
    heroMotionState_.h = h;
    heroMotionState_.letterData = null;
    heroMotionState_.letterW = 0;
    heroMotionState_.letterH = 0;
    heroMotionInitParticles_(w, h);
  }

  function heroMotionOnViewportChange_() {
    heroMotionState_.letterData = null;
    heroMotionState_.letterW = 0;
    heroMotionState_.letterH = 0;
    heroMotionResize_();
  }

  function stopHeroMotionCanvas_() {
    if (heroMotionState_.raf) {
      cancelAnimationFrame(heroMotionState_.raf);
      heroMotionState_.raf = 0;
    }
    if (heroMotionState_.bound) {
      global.removeEventListener('resize', heroMotionOnViewportChange_);
      heroMotionState_.bound = false;
    }
    if (heroMotionState_.orientBound) {
      global.removeEventListener('orientationchange', heroMotionOnViewportChange_);
      heroMotionState_.orientBound = false;
    }
    var hero = document.querySelector('.hero');
    if (hero) hero.classList.remove('hero-motion-on');
    var heroBg = document.querySelector('.hero-bg');
    if (heroBg) heroBg.classList.remove('hero-bg-hidden');
    var canvas = $('heroMotionCanvas');
    if (canvas) {
      var ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /** Phase intro AZAVISION (~5,2 s desktop / ~6 s mobile) puis toile d'araignée classique. */
  function heroMotionIntroPhase_() {
    var elapsed = heroMotionState_.t || 0;
    var INTRO = heroMotionIsMobileViewport_() ? 6 : 5.2;
    if (elapsed < INTRO) return { phase: 'intro', progress: Math.min(1, elapsed / INTRO) };
    return { phase: 'web', progress: 1 };
  }

  function heroMotionDrawFrame_() {
    var canvas = $('heroMotionCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var pal = heroMotionPalette_();
    var W = heroMotionState_.w;
    var H = heroMotionState_.h;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, H * 0.75);
    if (pal.light) {
      vg.addColorStop(0, 'rgba(255,255,255,0)');
      vg.addColorStop(1, 'rgba(72,58,36,0.14)');
    } else {
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    }
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    heroMotionState_.t = (heroMotionState_.t || 0) + 0.016;
    var style = heroMotionState_.style || 'web';
    if (style === 'stars') heroMotionDrawStars_(ctx, pal, W, H);
    else if (style === 'letters') heroMotionDrawLetters_(ctx, pal, W, H);
    else if (style === 'letters_web') heroMotionDrawLettersWeb_(ctx, pal, W, H);
    else if (style === 'letters_stars') heroMotionDrawLettersStars_(ctx, pal, W, H);
    else if (style === 'letters_pulse') heroMotionDrawLettersPulse_(ctx, pal, W, H);
    else if (style === 'letters_orbit') heroMotionDrawLettersOrbit_(ctx, pal, W, H);
    else if (style === 'letters_luxe') heroMotionDrawLettersLuxe_(ctx, pal, W, H);
    else if (style === 'letters_cascade') heroMotionDrawLettersCascade_(ctx, pal, W, H);
    else if (style === 'sunmoon') heroMotionDrawSunMoon_(ctx, pal, W, H);
    else heroMotionDrawWeb_(ctx, pal, W, H);
    heroMotionState_.raf = requestAnimationFrame(heroMotionDrawFrame_);
  }

  /** Style « web » — toile d'araignée : points reliés par des lignes + losanges (connexions animées en continu). */
  function heroMotionDrawWeb_(ctx, pal, W, H) {
    var particles = heroMotionState_.particles;
    var GR = pal.gold;
    var GR2 = pal.gold2;
    var mob = heroMotionIsMobileViewport_(W);
    var D = mob ? 95 : 120;
    var t = heroMotionState_.t || 0;
    var shimmer = 0.82 + 0.18 * Math.sin(t * 1.45);
    var lineOp = mob ? 0.28 : 0.2;
    var lineW = mob ? 0.72 : 0.55;
    var i;
    var j;
    for (i = 0; i < particles.length; i++) {
      for (j = i + 1; j < particles.length; j++) {
        var dx = particles[i].x - particles[j].x;
        var dy = particles[i].y - particles[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < D) {
          var op = (1 - dist / D) * lineOp * shimmer;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(' + GR + ',' + op + ')';
          ctx.lineWidth = lineW;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
      var alpha = (mob ? 0.55 : 0.4) + (mob ? 0.4 : 0.5) * Math.abs(Math.sin(p.a));
      var color = p.gold ? GR : GR2;
      var pr = mob ? Math.max(p.r, 1.1) : p.r;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + color + ',' + alpha + ')';
      ctx.fill();
      if (p.gold && pr > 1.2) {
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr * (mob ? 3 : 4));
        g.addColorStop(0, 'rgba(' + GR + ',' + (alpha * 0.3) + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(p.x, p.y, pr * (mob ? 3 : 4), 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }
    }
    for (i = 0; i < 3; i++) {
      var pi = particles[(i * 7) % particles.length];
      if (!pi) continue;
      var s = 6 + i * 3;
      var dop = 0.07 + 0.03 * Math.sin(pi.a * 1.5 + i);
      ctx.save();
      ctx.translate(pi.x, pi.y);
      ctx.rotate(pi.a * 0.5);
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.5, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.5, 0);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(' + GR + ',' + dop + ')';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Dessine une étoile scintillante à 4 branches. */
  function heroMotionStarShape_(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r * 2.2);
    ctx.lineTo(r * 0.45, -r * 0.45);
    ctx.lineTo(r * 2.2, 0);
    ctx.lineTo(r * 0.45, r * 0.45);
    ctx.lineTo(0, r * 2.2);
    ctx.lineTo(-r * 0.45, r * 0.45);
    ctx.lineTo(-r * 2.2, 0);
    ctx.lineTo(-r * 0.45, -r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Style « stars » — ciel d'étoiles scintillantes + étoile filante occasionnelle. */
  function heroMotionDrawStars_(ctx, pal, W, H) {
    var particles = heroMotionState_.particles;
    var GR = pal.gold;
    var i;
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx * 0.35;
      p.y += p.vy * 0.35;
      p.a += Math.abs(p.va) * 3 + 0.01;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
      var tw = 0.2 + 0.8 * Math.abs(Math.sin(p.a * 2 + i));
      var size = p.r * (0.7 + tw * 0.9);
      var col = p.gold ? ('rgba(' + GR + ',' + tw + ')') : ('rgba(255,255,255,' + (tw * 0.9) + ')');
      heroMotionStarShape_(ctx, p.x, p.y, size, col);
    }
    var sh = heroMotionState_.shoot;
    if (!sh || sh.done) {
      if (Math.random() < 0.012) {
        heroMotionState_.shoot = { x: Math.random() * W * 0.7, y: Math.random() * H * 0.4, len: 0, done: false };
      }
    } else {
      sh.x += 7;
      sh.y += 3.4;
      sh.len = Math.min(160, sh.len + 12);
      var tailX = sh.x - sh.len;
      var tailY = sh.y - sh.len * 0.485;
      var grad = ctx.createLinearGradient(tailX, tailY, sh.x, sh.y);
      grad.addColorStop(0, 'rgba(' + GR + ',0)');
      grad.addColorStop(1, 'rgba(255,255,255,0.9)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(sh.x, sh.y);
      ctx.stroke();
      if (sh.x > W || sh.y > H) sh.done = true;
    }
  }

  /** Police canvas — Cormorant si chargée, sinon serif système (mobile). */
  function heroMotionLetterFontFamily_() {
    return '"Cormorant Garamond", Georgia, "Times New Roman", serif';
  }

  /** Zone mobile proche du carré (chargement hero). */
  function heroMotionIsSquareMobile_(W, H) {
    if (!heroMotionIsMobileViewport_(W)) return false;
    if (!W || !H) return true;
    var ratio = W / H;
    return ratio > 0.82 && ratio < 1.22;
  }

  /** Dessine le masque texte AZAVISION (1 ou 2 lignes sur mobile étroit). Retourne taille police. */
  function heroMotionDrawLetterMask_(c, W, H) {
    var narrow = W < 520;
    var squareMob = heroMotionIsSquareMobile_(W, H);
    var fs;
    var font = heroMotionLetterFontFamily_();
    c.fillStyle = '#fff';
    c.strokeStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (narrow || squareMob) {
      fs = Math.min(W / (squareMob ? 4.6 : 5.0), H / (squareMob ? 4.0 : 5.2));
      fs = Math.max(26, Math.round(fs));
      c.font = '700 ' + fs + 'px ' + font;
      c.lineWidth = Math.max(2, fs * 0.09);
      c.fillText('AZA', W / 2, H * 0.44);
      c.fillText('VISION', W / 2, H * 0.56);
      c.strokeText('AZA', W / 2, H * 0.44);
      c.strokeText('VISION', W / 2, H * 0.56);
    } else {
      fs = Math.min(H * 0.38, W / 6.8);
      fs = Math.max(24, Math.round(fs));
      c.font = '600 ' + fs + 'px ' + font;
      c.lineWidth = Math.max(1.5, fs * 0.06);
      c.fillText('AZAVISION', W / 2, H / 2);
      c.strokeText('AZAVISION', W / 2, H / 2);
    }
    return fs;
  }

  /** Attend le chargement des polices puis recalcule le masque AZAVISION. */
  function heroMotionWaitFontsThenRebuild_() {
    var done = false;
    function rebuild() {
      if (done) return;
      done = true;
      heroMotionState_.letterData = null;
      heroMotionState_.letterW = 0;
      heroMotionState_.letterH = 0;
      heroMotionState_.letterParts = null;
    }
    try {
      if (document.fonts && document.fonts.load) {
        document.fonts.load('600 48px ' + heroMotionLetterFontFamily_()).then(rebuild).catch(rebuild);
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(rebuild).catch(rebuild);
      }
    } catch (eF) { /* ignore */ }
    setTimeout(rebuild, 800);
  }

  /** Recalcul canvas après layout mobile (hero parfois 0px au 1er frame). */
  function heroMotionScheduleLayoutFixes_() {
    [0, 80, 200, 500].forEach(function (ms) {
      setTimeout(function () {
        if (!document.querySelector('.hero.hero-motion-on')) return;
        heroMotionOnViewportChange_();
      }, ms);
    });
  }
  /** Construit points cibles du mot AZAVISION + liens « toile » de proximité. */
  function heroMotionBuildLetterTargets_(W, H) {
    var empty = { pts: [], links: [], linkDist: 22 };
    if (W < 8 || H < 8) return empty;
    var off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    var c = off.getContext('2d');
    if (!c) return empty;
    var fs = heroMotionDrawLetterMask_(c, W, H);
    var data;
    try { data = c.getImageData(0, 0, W, H).data; } catch (e) { return empty; }
    var pts = [];
    var mobile = heroMotionIsMobileViewport_(W);
    /* Mobile : pas trop dense — sinon AZAVISION devient un blob brillant illisible. */
    var step = Math.max(mobile ? 5 : 4, Math.round(fs / (mobile ? 13 : 18)));
    var y;
    var x;
    for (y = 0; y < H; y += step) {
      for (x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 100) pts.push({ x: x, y: y });
      }
    }
    if (pts.length < 40) {
      c.clearRect(0, 0, W, H);
      fs = heroMotionDrawLetterMask_(c, W, H);
      c.lineWidth = Math.max(2, fs * 0.12);
      if (W < 520 || heroMotionIsSquareMobile_(W, H)) {
        c.strokeText('AZA', W / 2, H * 0.44);
        c.strokeText('VISION', W / 2, H * 0.56);
      } else {
        c.strokeText('AZAVISION', W / 2, H / 2);
      }
      try { data = c.getImageData(0, 0, W, H).data; } catch (e2) { return empty; }
      pts = [];
      step = Math.max(mobile ? 4 : 2, Math.round(fs / (mobile ? 16 : 24)));
      for (y = 0; y < H; y += step) {
        for (x = 0; x < W; x += step) {
          if (data[(y * W + x) * 4 + 3] > 80) pts.push({ x: x, y: y });
        }
      }
    }
    var maxPts = mobile ? 150 : 560;
    if (pts.length > maxPts) {
      var keep = [];
      var k = pts.length / maxPts;
      for (var m = 0; m < maxPts; m++) keep.push(pts[Math.floor(m * k)]);
      pts = keep;
    }
    var linkDist = Math.max(16, step * 2.6);
    var ld2 = linkDist * linkDist;
    var links = [];
    for (var a = 0; a < pts.length; a++) {
      for (var b = a + 1; b < pts.length; b++) {
        var dxx = pts[a].x - pts[b].x;
        var dyy = pts[a].y - pts[b].y;
        if (dxx * dxx + dyy * dyy < ld2) {
          links.push(a, b);
          if (links.length >= 6000) break;
        }
      }
      if (links.length >= 6000) break;
    }
    return { pts: pts, links: links, linkDist: linkDist };
  }

  /** Silhouette typographique discrète — lisibilité mobile (sous les particules). */
  function heroMotionDrawLetterGhost_(ctx, pal, W, H, alpha) {
    alpha = alpha == null ? 0.14 : alpha;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pal.light ? 'rgba(48,36,14,1)' : 'rgba(' + pal.gold + ',1)';
    ctx.strokeStyle = ctx.fillStyle;
    heroMotionDrawLetterMask_(ctx, W, H);
    ctx.restore();
  }

  /** Liens « toile » dynamiques entre particules proches (positions courantes, jamais figées). */
  function heroMotionDrawLiveWebLinks_(ctx, parts, GR, maxDist, shimmer, step) {
    if (!parts || !parts.length) return;
    var n = parts.length;
    step = step || (n > 220 ? 2 : 1);
    var D = maxDist || 26;
    var D2 = D * D;
    var win = n > 180 ? 18 : 28;
    var i;
    var j;
    for (i = 0; i < n; i += step) {
      for (j = i + step; j < Math.min(n, i + win); j += step) {
        var pa = parts[i];
        var pb = parts[j];
        if (!pa || !pb) continue;
        var dx = pa.x - pb.x;
        var dy = pa.y - pb.y;
        var d2 = dx * dx + dy * dy;
        if (d2 >= D2) continue;
        var d = Math.sqrt(d2);
        var op = (1 - d / D) * 0.26 * shimmer;
        ctx.strokeStyle = 'rgba(' + GR + ',' + op + ')';
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }
  }

  /** Style « letters » — poussière dorée formant AZAVISION, reliée en toile animée. */
  function heroMotionDrawLetters_(ctx, pal, W, H, opts) {
    opts = opts || {};
    var drawOpts = heroMotionState_.letterDrawOpts || {};
    opts = Object.assign({}, drawOpts, opts);
    var introPh = opts.introOnly ? heroMotionIntroPhase_() : null;
    var introBoost = !!opts.introOnly && introPh && introPh.phase === 'intro';
    var st = heroMotionState_;
    var mob = heroMotionIsMobileViewport_(W);
    /* Mobile : mot lisible (pas de halo/scintillement) ; toile de fond toujours animée. */
    var still = mob;
    var isLight = !!(pal && pal.light);
    var luxe = !!opts.luxe && !still;
    var cascade = !!opts.cascade && !still;
    var crisp = still || luxe || isLight;
    var lineMul = still ? (isLight ? 0.2 : 0.16) : (luxe ? 0.34 : (isLight ? 0.72 : (mob ? 0.38 : 0.44)));
    var composite = crisp ? 'source-over' : 'lighter';
    var glowMul = still ? 0 : (luxe ? 2.1 : (mob ? 2.8 : 4.2));
    var t = st.t || 0;
    /* Sur mobile les fils DU MOT restent fixes (pas de pulsation) ; le fond web anime à part. */
    var shimmer = still ? 1 : ((crisp ? 0.9 : 0.82) + (crisp ? 0.1 : 0.18) * Math.sin(t * 1.6));
    var needRebuild = !st.letterData || st.letterW !== W || st.letterH !== H || (still && st.letterReadable !== 3) || (!still && st.letterReadable === 3);
    if (needRebuild) {
      st.letterData = heroMotionBuildLetterTargets_(W, H);
      st.letterW = W;
      st.letterH = H;
      st.letterReadable = still ? 3 : 0;
      st.letterParts = st.letterData.pts.map(function (tg) {
        return {
          x: cascade ? (tg.x + (Math.random() - 0.5) * W * 0.15) : (Math.random() * W),
          y: cascade ? (-Math.random() * H * 0.55 - 30) : (Math.random() * H),
          tx: tg.x, ty: tg.y,
          a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.05,
          gold: Math.random() > (luxe ? 0.45 : 0.35),
          r: still ? (1.05 + Math.random() * 0.3) : ((mob || luxe ? 2.0 : 1.1) + Math.random() * (mob || luxe ? 0.9 : 0.9)),
          orbitR: still ? 0 : (mob || luxe ? (0.2 + Math.random() * 0.45) : (0.9 + Math.random() * 2.4)),
          orbitSp: still ? 0 : (mob || luxe ? (0.1 + Math.random() * 0.14) : (0.22 + Math.random() * 0.38)),
          orbitPh: Math.random() * 6.28
        };
      });
    }
    var GR = pal.gold;
    var GR2 = pal.gold2;
    var parts = st.letterParts || [];
    if (!parts.length) { heroMotionDrawWeb_(ctx, pal, W, H); return; }
    var links = (st.letterData && st.letterData.links) || [];
    var LD = (st.letterData && st.letterData.linkDist) || 22;
    var maxLine = LD * 1.7;
    if (still && !opts.skipWebBackdrop) heroMotionDrawWeb_(ctx, pal, W, H);
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.orbitR == null) {
        p.orbitR = still ? 0 : (mob || luxe ? (0.2 + Math.random() * 0.45) : (0.9 + Math.random() * 2.4));
        p.orbitSp = still ? 0 : (mob || luxe ? (0.1 + Math.random() * 0.14) : (0.22 + Math.random() * 0.38));
        p.orbitPh = Math.random() * 6.28;
      }
      if (!still) p.a += p.va;
      var orbitScale = introBoost ? Math.max(0.12, 1 - introPh.progress * 0.88) : 1;
      if (luxe) orbitScale *= 0.65;
      var ox = 0;
      var oy = 0;
      if (!still) {
        ox = Math.sin(t * p.orbitSp + p.orbitPh + i * 0.17) * p.orbitR * orbitScale;
        oy = Math.cos(t * (p.orbitSp * 0.86) + p.orbitPh + i * 0.13) * p.orbitR * orbitScale;
      }
      var gx = p.tx + ox;
      var gy = p.ty + oy;
      var lerp = still ? 0.42 : (cascade ? 0.09 : (introBoost ? (0.1 + introPh.progress * 0.14) : (mob ? 0.24 : 0.13)));
      if (luxe) lerp = Math.min(lerp + 0.04, 0.28);
      p.x += (gx - p.x) * lerp;
      p.y += (gy - p.y) * lerp;
    }
    var ghostA = 0;
    if (still) {
      ghostA = isLight ? 0.46 : 0.4;
    } else if (mob || luxe || introBoost) {
      ghostA = luxe ? 0.1 : (introBoost ? (0.08 + introPh.progress * 0.12) : 0.11);
    }
    if (ghostA > 0) heroMotionDrawLetterGhost_(ctx, pal, W, H, ghostA);
    if (!still && (mob || isLight)) {
      ctx.fillStyle = isLight ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.28)';
      ctx.fillRect(W * 0.05, H * 0.26, W * 0.9, H * 0.48);
    }
    ctx.globalCompositeOperation = composite;
    ctx.lineWidth = still ? 0.85 : (mob ? 1.05 : 0.8);
    for (i = 0; i < links.length; i += 2) {
      var pa = parts[links[i]];
      var pb = parts[links[i + 1]];
      if (!pa || !pb) continue;
      var lx = pa.x - pb.x;
      var ly = pa.y - pb.y;
      var ld = Math.sqrt(lx * lx + ly * ly);
      if (ld < maxLine) {
        var op = (1 - ld / maxLine) * lineMul * shimmer;
        ctx.strokeStyle = 'rgba(' + GR + ',' + op + ')';
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }
    /* Mobile : pas de liens dynamiques sur les lettres (ça blanchit le mot) — la toile = fond web. */
    if (!luxe && !still) {
      heroMotionDrawLiveWebLinks_(ctx, parts, GR, LD * (mob ? 1.25 : 1.45), shimmer * (mob ? 0.65 : 1), parts.length > 220 ? 3 : 2);
    }
    for (i = 0; i < parts.length; i++) {
      var q = parts[i];
      var twinkle = still ? 1 : (0.72 + 0.28 * Math.abs(Math.sin(q.a * 2 + i)));
      var glow = still ? 0.72 : Math.min(1, twinkle * shimmer);
      var color = q.gold ? GR : GR2;
      if (glowMul > 2.5 && !still) {
        var gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r * glowMul);
        gr.addColorStop(0, 'rgba(' + color + ',' + (glow * (isLight ? 0.55 : 0.42)) + ')');
        gr.addColorStop(1, 'rgba(' + color + ',0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * glowMul, 0, Math.PI * 2);
        ctx.fill();
      }
      var coreA = still
        ? (isLight ? 0.88 : 0.7)
        : (isLight ? Math.min(1, glow * 0.98) : Math.min(1, 0.82 + glow * 0.18));
      /* Mobile : or mat (pas de blanc brillant qui noie le mot). */
      ctx.fillStyle = still
        ? (isLight ? ('rgba(48,36,14,' + coreA + ')') : ('rgba(' + color + ',' + coreA + ')'))
        : (isLight
          ? ('rgba(48,36,14,' + coreA + ')')
          : ('rgba(255,245,225,' + coreA + ')'));
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Présentation AZAVISION (~5 s) puis toile d'araignée classique (points flottants reliés entre eux). */
  function heroMotionDrawLettersWeb_(ctx, pal, W, H) {
    var ph = heroMotionIntroPhase_();
    var mob = heroMotionIsMobileViewport_(W);
    if (ph.phase === 'intro') {
      if (ph.progress > 0.78) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.55, (ph.progress - 0.78) / 0.22 * 0.55);
        heroMotionDrawWeb_(ctx, pal, W, H);
        ctx.restore();
      }
      heroMotionDrawLetters_(ctx, pal, W, H, { introOnly: true, skipWebBackdrop: true });
      return;
    }
    if (mob) {
      heroMotionDrawLetters_(ctx, pal, W, H, {});
      return;
    }
    heroMotionDrawWeb_(ctx, pal, W, H);
  }

  /** Combinaison AZAVISION + ciel d'étoiles. */
  function heroMotionDrawLettersStars_(ctx, pal, W, H) {
    if (!heroMotionIsMobileViewport_(W)) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      heroMotionDrawStars_(ctx, pal, W, H);
      ctx.restore();
    }
    heroMotionDrawLetters_(ctx, pal, W, H, {});
  }

  /** AZAVISION lisible + élégant (recommandé mobile). */
  function heroMotionDrawLettersLuxe_(ctx, pal, W, H) {
    heroMotionDrawLetters_(ctx, pal, W, H, { luxe: true });
  }

  /** Particules en cascade puis formation AZAVISION + toile. */
  function heroMotionDrawLettersCascade_(ctx, pal, W, H) {
    heroMotionDrawLetters_(ctx, pal, W, H, { cascade: true });
  }

  /** Combinaison AZAVISION + halo pulsant (désactivé sur mobile — lisibilité). */
  function heroMotionDrawLettersPulse_(ctx, pal, W, H) {
    var mob = heroMotionIsMobileViewport_(W);
    if (!mob) {
      var st = heroMotionState_;
      var GR = pal.gold;
      var pulse = 0.1 + 0.12 * Math.sin((st.t || 0) * 1.25);
      var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.04, W / 2, H / 2, H * 0.58);
      vg.addColorStop(0, 'rgba(' + GR + ',0)');
      vg.addColorStop(0.45, 'rgba(' + GR + ',' + (pulse * 0.55) + ')');
      vg.addColorStop(1, 'rgba(' + GR + ',0)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
    heroMotionDrawLetters_(ctx, pal, W, H, {});
  }

  /** Combinaison AZAVISION + particules en orbite (orbite masquée sur mobile). */
  function heroMotionDrawLettersOrbit_(ctx, pal, W, H) {
    if (!heroMotionIsMobileViewport_(W)) {
      var st = heroMotionState_;
      var t = st.t || 0;
      var GR = pal.gold;
      var cx = W / 2;
      var cy = H / 2;
      var baseR = Math.min(W, H) * 0.38;
      var ring;
      var k;
      var ang;
      var r;
      var a;
      var x;
      var y;
      var tw;
      for (ring = 0; ring < 3; ring++) {
        ang = t * (0.35 + ring * 0.12) + ring * 2.1;
        r = baseR * (0.82 + ring * 0.14);
        for (k = 0; k < 8; k++) {
          a = ang + k * Math.PI / 4;
          x = cx + Math.cos(a) * r;
          y = cy + Math.sin(a) * r * 0.38;
          tw = 0.35 + 0.55 * Math.abs(Math.sin(t * 2 + k + ring));
          ctx.beginPath();
          ctx.arc(x, y, 1.1 + ring * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + GR + ',' + tw + ')';
          ctx.fill();
        }
      }
    }
    heroMotionDrawLetters_(ctx, pal, W, H, {});
  }

  /** Style « sunmoon » — lune (croissant) et soleil rayonnant qui brillent. */
  function heroMotionDrawSunMoon_(ctx, pal, W, H) {
    var st = heroMotionState_;
    var GR = pal.gold;
    var t = st.t || 0;
    var particles = st.particles;
    var i;
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.a += Math.abs(p.va) * 2 + 0.008;
      var tw = 0.15 + 0.5 * Math.abs(Math.sin(p.a * 2 + i));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + tw + ')';
      ctx.fill();
    }
    var pulse = 1 + 0.07 * Math.sin(t * 2);
    var R = Math.min(W, H);
    var sunX = W * 0.72;
    var sunY = H * 0.42;
    var sunR = R * 0.085;
    var sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 4.2 * pulse);
    sg.addColorStop(0, 'rgba(' + GR + ',0.5)');
    sg.addColorStop(0.5, 'rgba(' + GR + ',0.16)');
    sg.addColorStop(1, 'rgba(' + GR + ',0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 4.2 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(t * 0.25);
    for (var r = 0; r < 12; r++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(sunR * 1.45, 0);
      ctx.lineTo(sunR * (2.1 + 0.2 * Math.sin(t * 2)), 0);
      ctx.strokeStyle = 'rgba(' + GR + ',0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(' + GR + ',0.96)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    var mX = W * 0.28;
    var mY = H * 0.4;
    var mR = R * 0.072;
    var mg = ctx.createRadialGradient(mX, mY, 0, mX, mY, mR * 3.4 * pulse);
    mg.addColorStop(0, 'rgba(225,230,240,0.4)');
    mg.addColorStop(1, 'rgba(225,230,240,0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mX, mY, mR * 3.4 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(236,239,246,0.96)';
    ctx.beginPath();
    ctx.arc(mX, mY, mR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.bg;
    ctx.beginPath();
    ctx.arc(mX - mR * 0.55, mY - mR * 0.28, mR * 0.92, 0, Math.PI * 2);
    ctx.fill();
  }

  function startHeroMotionCanvas_() {
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var canvas = $('heroMotionCanvas');
    var hero = document.querySelector('.hero');
    if (!canvas || !hero) return;
    stopHeroMotionCanvas_();
    heroMotionState_.t = 0;
    heroMotionState_.style = heroMotionStyle_();
    hero.classList.add('hero-motion-on');
    heroMotionResize_();
    heroMotionWaitFontsThenRebuild_();
    heroMotionScheduleLayoutFixes_();
    if (!heroMotionState_.bound) {
      global.addEventListener('resize', heroMotionOnViewportChange_);
      heroMotionState_.bound = true;
    }
    if (!heroMotionState_.orientBound) {
      global.addEventListener('orientationchange', heroMotionOnViewportChange_);
      heroMotionState_.orientBound = true;
    }
    if (!heroMotionState_.visBound) {
      document.addEventListener('visibilitychange', function heroMotionVis_() {
        if (!document.hidden && isHeroMotionCanvasOn() && !heroMotionState_.raf) {
          heroMotionState_.raf = requestAnimationFrame(heroMotionDrawFrame_);
        }
      });
      heroMotionState_.visBound = true;
    }
    heroMotionState_.raf = requestAnimationFrame(heroMotionDrawFrame_);
  }

  function isHeroMotionCanvasOn() {
    if (heroMotionUrlStyle_()) return true;
    return cfgOn('vitrine_hero_motion_canvas', false);
  }

  /** Normalise un identifiant de style de motion (accepte FR/EN/synonymes). */
  function heroMotionNormalizeStyle_(v) {
    v = String(v || '').toLowerCase().trim();
    if (['web', 'spider', 'toile', 'araignee', 'araignée', 'constellation', 'points', 'dots'].indexOf(v) >= 0) return 'web';
    if (['stars', 'star', 'etoiles', 'étoiles', 'etoile', 'étoile'].indexOf(v) >= 0) return 'stars';
    if (['letters', 'lettres', 'azavision', 'text', 'texte', 'mot'].indexOf(v) >= 0) return 'letters';
    if (['letters_luxe', 'letterluxe', 'azavision_luxe', 'luxe', 'pro'].indexOf(v) >= 0) return 'letters_luxe';
    if (['letters_cascade', 'lettercascade', 'azavision_cascade', 'cascade', 'chute'].indexOf(v) >= 0) return 'letters_cascade';
    if (['letters_web', 'letterweb', 'azavision_web', 'toile_azavision', 'web_azavision', 'letters_toile', 'toile_connectee'].indexOf(v) >= 0) return 'letters_web';
    if (['letters_stars', 'letterstars', 'azavision_stars', 'etoiles_azavision', 'stars_azavision'].indexOf(v) >= 0) return 'letters_stars';
    if (['letters_pulse', 'letterpulse', 'azavision_pulse', 'pulse_azavision', 'halo_azavision'].indexOf(v) >= 0) return 'letters_pulse';
    if (['letters_orbit', 'letterorbit', 'azavision_orbit', 'orbite_azavision', 'orbit_azavision'].indexOf(v) >= 0) return 'letters_orbit';
    if (['sunmoon', 'moonsun', 'lune', 'soleil', 'sun', 'moon', 'lunesoleil'].indexOf(v) >= 0) return 'sunmoon';
    return '';
  }

  /** Style aléatoire par session (1re entrée) — toujours une variante AZAVISION animée. */
  function heroMotionSessionStyle_() {
    try {
      var key = 'azv_hero_motion_session';
      var cur = heroMotionNormalizeStyle_(sessionStorage.getItem(key));
      if (cur) return cur;
      var pick = AZV_HERO_MOTION_POOL_[Math.floor(Math.random() * AZV_HERO_MOTION_POOL_.length)];
      sessionStorage.setItem(key, pick);
      return pick;
    } catch (eS) { return 'letters_luxe'; }
  }

  /** Style demandé via l'URL (?motion=stars) — sert aussi à activer le canvas pour essayer. */
  function heroMotionUrlStyle_() {
    try {
      var u = new URLSearchParams(global.location.search).get('motion');
      return heroMotionNormalizeStyle_(u);
    } catch (e) { return ''; }
  }

  /** Résout le style courant : URL → config admin → variante session (1re entrée) → défaut « letters ». */
  function heroMotionStyle_() {
    var fromUrl = heroMotionUrlStyle_();
    if (fromUrl) {
      try { sessionStorage.setItem('azv_hero_motion_session', fromUrl); } catch (e) { /* ignore */ }
      return fromUrl;
    }
    var cfg = heroMotionNormalizeStyle_(state.config && state.config.vitrine_hero_motion_style);
    if (cfg) return cfg;
    return heroMotionSessionStyle_();
  }

  /** Permet d'essayer un style à chaud : Shop.setHeroMotion('letters'|'letters_web'|'letters_stars'|…). */
  function setHeroMotion(style) {
    var s = heroMotionNormalizeStyle_(style) || 'letters';
    try { sessionStorage.setItem('azv_hero_motion_session', s); } catch (e) { /* ignore */ }
    heroMotionState_.style = s;
    heroMotionState_.t = 0;
    heroMotionState_.letterData = null;
    heroMotionState_.letterDrawOpts = null;
    startHeroMotionCanvas_();
    return s;
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
    var remoteNav = (state.store && state.store.logoUrl) ? (optimizeImageUrl(state.store.logoUrl, 400) || state.store.logoUrl) : '';
    var remoteFoot = (state.store && state.store.logoUrl) ? (optimizeImageUrl(state.store.logoUrl, 300) || state.store.logoUrl) : '';
    if (navLogo) {
      if (remoteNav) {
        navLogo.setAttribute('data-fallback', remoteNav);
        navLogo.src = remoteNav;
        navLogo.style.display = '';
        var navWrap = navLogo.closest('.brand');
        if (navWrap) navWrap.classList.remove('logo-missing');
      } else {
        logoError(navLogo);
      }
    }
    if (footLogo) {
      if (remoteFoot) {
        footLogo.setAttribute('data-fallback', remoteFoot);
        footLogo.src = remoteFoot;
        footLogo.style.display = '';
        var footWrap = footLogo.closest('.f-brand');
        if (footWrap) footWrap.classList.remove('logo-missing');
      } else {
        logoError(footLogo);
      }
    }
    /* color_main / color_accent admin : ne pas écraser --gold/--ink (thème clair/foncé fixe, comme l'admin) */
    var heroBg = document.querySelector('.hero-bg');
    var heroPhoto = $('heroPhoto');
    var heroUrl = (state.store && state.store.heroBgUrl) || (state.config && state.config.vitrine_hero_bg_url) || '';
    var motionOn = isHeroMotionCanvasOn();
    if (motionOn) {
      startHeroMotionCanvas_();
      if (heroBg) {
        heroBg.style.backgroundImage = '';
        heroBg.classList.add('hero-bg-hidden');
        resetHeroBackgroundTuning(heroBg);
      }
      if (heroUrl) {
        var motionPhotoUrl = String(optimizeImageUrl(heroUrl, getHeroPhotoWidth()) || heroUrl).replace(/"/g, '');
        preloadHeroImage(motionPhotoUrl);
        if (heroPhoto) {
          heroPhoto.src = motionPhotoUrl;
          heroPhoto.style.display = '';
        }
        if (heroBg && heroPhoto) tuneHeroBackground(heroBg, heroPhoto, motionPhotoUrl);
      } else if (heroPhoto) {
        heroPhoto.removeAttribute('src');
        heroPhoto.style.display = 'none';
      }
    } else {
      stopHeroMotionCanvas_();
      if (heroBg && heroUrl) {
        var tunedHeroPhotoUrl = String(optimizeImageUrl(heroUrl, getHeroPhotoWidth()) || heroUrl).replace(/"/g, '');
        heroBg.style.backgroundImage = '';
        heroBg.classList.remove('hero-bg-hidden');
        preloadHeroImage(tunedHeroPhotoUrl);
        if (heroPhoto) {
          heroPhoto.src = tunedHeroPhotoUrl;
          heroPhoto.style.display = '';
        }
        tuneHeroBackground(heroBg, heroPhoto, tunedHeroPhotoUrl);
      } else if (heroBg) {
        heroBg.style.backgroundImage = '';
        heroBg.classList.remove('hero-bg-hidden');
        resetHeroBackgroundTuning(heroBg);
        if (heroPhoto) {
          heroPhoto.removeAttribute('src');
          heroPhoto.style.display = 'none';
        }
      }
    }
    var social = (state.store && state.store.social) || {};
    wireSocialBtn('socInsta', social.instagram);
    wireSocialBtn('socPin', social.pinterest);
    wireSocialBtn('socTik', social.tiktok);
    wireSocialBtn('socFb', social.facebook);
    applySocialDisplay();
    if (state.store && state.store.tagline && $('fDesc') && !$('fDesc').dataset.erp) {
      $('fDesc').textContent = state.store.tagline;
      $('fDesc').dataset.erp = '1';
    }
    applyVitrineContent(state.lang);
  }

  function fillPromoPlaceholders(text) {
    var cfg = state.config || {};
    function promoVal(displayKey, valueKey) {
      if (!cfgOn(displayKey, true)) return '';
      return String(cfg[valueKey] || '').trim();
    }
    return String(text || '')
      .replace(/\{\{\s*pct\s*\}\}/gi, promoVal('announcement_promo_pct_display', 'announcement_promo_pct'))
      .replace(/\{\{\s*pct2\s*\}\}/gi, promoVal('announcement_promo_pct_2_display', 'announcement_promo_pct_2'))
      .replace(/\{\{\s*code\s*\}\}/gi, promoVal('announcement_promo_code_display', 'announcement_promo_code'))
      .replace(/\{\{\s*amount\s*\}\}/gi, promoVal('announcement_promo_amount_display', 'announcement_promo_amount_eur'))
      .replace(/\{\{\s*min_cart\s*\}\}/gi, promoVal('announcement_promo_min_cart_display', 'announcement_promo_min_cart_eur'))
      .replace(/\{\{\s*valid_until\s*\}\}/gi, promoVal('announcement_promo_valid_until_display', 'announcement_promo_valid_until'))
      .replace(/\{\{\s*promo_label\s*\}\}/gi, promoVal('announcement_promo_label_display', 'announcement_promo_label'));
  }

  function cleanupPromoText(text) {
    return String(text || '')
      .replace(/\s*[·|]\s*[·|]\s*/g, ' · ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s*[·|]\s*/g, '')
      .replace(/\s*[·|]\s*$/g, '')
      .trim();
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
    if (!isStoreConfigReady()) return '';
    var cfg = state.config || {};
    if (!cfgOn('promo_bar_display', true)) return '';

    var annOn = announcementActive();
    var annEnabled = cfgOn('announcement_enabled', false);
    var annDisplay = cfgOn('announcement_display', true);

    if (annOn && annEnabled && annDisplay) {
      if (String(cfg.announcement_text || '').trim()) {
        return cleanupPromoText(fillPromoPlaceholders(cfg.announcement_text));
      }
      if (cfgOn('announcement_show_default', true) && cfgOn('announcement_promo_code_display', true) && String(cfg.announcement_promo_code || '').trim()) {
        return '✦ CODE : ' + String(cfg.announcement_promo_code).trim() + ' ✦';
      }
      return '';
    }

    if (!cfgOn('vitrine_display_promo_faixa', true)) return '';

    var customFaixa = String(cfg.promo_banner_text || '').trim();
    var faixaOn = cfgOn('promo_banner_enabled', false) || !!customFaixa;
    if (faixaOn && customFaixa) {
      return cleanupPromoText(fillPromoPlaceholders(customFaixa));
    }

    if (cfgOn('promo_banner_show_default', false)) {
      return t().promo || '';
    }
    return '';
  }

  function applyPromoBanner() {
    var cfg = state.config || {};
    var text = resolvePromoBarText();
    var bar = document.querySelector('.promo-bar');
    if (bar) bar.style.display = text ? '' : 'none';
    if (!text) {
      ['mq1', 'mq2', 'mq3', 'mq4'].forEach(function (id) {
        var el = $(id);
        if (el) el.textContent = '';
      });
      return;
    }
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
      if (isNavCatGroup(state.cat)) {
        filters.categoria_grupo = NAV_CAT_GROUPS[state.cat].grupo;
      } else {
        var catName = resolveCategoryName(state.cat);
        if (catName) filters.categoria = catName;
      }
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
    updateSearchClearBtn();
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
    renderFooterSupport();
    renderFooterLegal();
    render();
  }

  function getCatList() {
    var list = [{ id: 'all', label: t().cats.all, icon: '✦' }];
    var nav = t().nav || [];
    if (nav.length >= 4) {
      list.push({ id: NAV_WOMEN, label: nav[1], icon: '♀', navGroup: true });
      list.push({ id: NAV_MEN, label: nav[2], icon: '♂', navGroup: true });
      list.push({ id: NAV_ACCESSORIES, label: nav[3], icon: '◈', navGroup: true });
    }
    state.categories.forEach(function (c) {
      if (categoryNameMatchesAnyNavGroup(c.nome)) return;
      list.push({ id: normalizeCat(c.nome), label: c.nome, icon: '◆', nome: c.nome });
    });
    if (list.length <= 4) {
      var seen = {};
      state.products.forEach(function (p) {
        if (!p.cat || seen[p.catKey]) return;
        if (categoryNameMatchesAnyNavGroup(p.cat)) return;
        seen[p.catKey] = 1;
        list.push({ id: p.catKey, label: p.cat, icon: '◆' });
      });
    }
    return list;
  }

  function renderCats() {
    $('catRow').innerHTML = getCatList().map(function (c) {
      var active = state.cat === c.id ? ' on' : '';
      var main = c.navGroup ? ' cat-pill--nav' : '';
      return '<button class="cat-pill' + main + active + '" onclick="Shop.selectCat(\'' + esc(c.id).replace(/'/g, "\\'") + '\')">' +
        c.icon + ' ' + esc(c.label) + '</button>';
    }).join('');
  }

  function getList() {
    var q = getSearchQuery();
    var sort = $('sortSel') ? $('sortSel').value : 'def';
    if (state.cat === NAV_SALE) sort = sort === 'def' ? 'dsc' : sort;
    return state.products
      .filter(function (p) {
        if (state.cat === NAV_SALE) return !!p.old;
        if (state.cat === NAV_NEW || state.cat === 'all') return true;
        return productMatchesNavCatGroup(p, state.cat);
      })
      .filter(function (p) {
        return productMatchesSearch(p, q);
      })
      .sort(function (a, b) {
        if (q) {
          var ra = searchRelevanceScore(a, q);
          var rb = searchRelevanceScore(b, q);
          if (rb !== ra) return rb - ra;
        }
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
      ((state.cat !== 'all' || getSearchQuery()) && p.cat ? '<span class="card-cat-tag">' + esc(p.cat) + '</span>' : '') +
      '<h3 class="card-name">' + esc(nm(p)) + '</h3>' +
      '<p class="card-stars product-stars">' + productStarsHtml(p.rate, p.rev) + '</p>' +
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
    var q = getSearchQuery();
    var filtered = q || state.cat !== 'all';
    if ($('resCount')) {
      var count = filtered ? n : (state.productsTotal > 0 ? state.productsTotal : n);
      $('resCount').textContent = count + ' ' + (count !== 1 ? t().plural : t().single);
    }
    if (!n && !state.productsLoading) {
      var noSub = q ? (t().noSearch || t().noD) : t().noD;
      grid.innerHTML = '<div class="no-res"><h3>' + esc(t().noT) + '</h3><p>' + esc(noSub) + '</p>' +
        (q ? '<button class="btn-ghost" style="margin:0 auto 10px;" onclick="Shop.clearSearch()">' + esc(t().searchClear || 'Clear') + '</button>' : '') +
        '<button class="btn-gold" style="margin:0 auto;" onclick="Shop.resetAll()">' + esc(t().noBtn) + '</button></div>';
      renderLoadMore();
      return;
    }
    grid.innerHTML = list.map(function (p, idx) { return renderProductCard(p, idx); }).join('');
    renderLoadMore();
    updateSearchClearBtn();
    updateShopCategoryHeader();
  }

  function render() {
    renderCats();
    updateNavActive();
    renderGrid();
  }

  function cartCount() { return state.cart.reduce(function (s, i) { return s + i.qty; }, 0); }
  function cartSub() { return state.cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0); }
  function cartLineCategory_(it) {
    if (it.cat) return String(it.cat).trim();
    var p = state.products.find(function (x) { return x.id === it.id || x.produto_id === it.produto_id; });
    return p ? String(p.cat || '').trim() : '';
  }
  function couponValidationItems_() {
    return state.cart.map(function (it) {
      return { categoria: cartLineCategory_(it), preco: it.price, quantidade: it.qty };
    });
  }
  function couponEligibleSubtotal_() {
    var cat = String(state.couponCategoria || '').trim();
    if (!cat) return cartSub();
    return state.cart.reduce(function (sum, it) {
      if (cartLineCategory_(it) === cat) return sum + it.price * it.qty;
      return sum;
    }, 0);
  }
  function promoSuccessText_(res) {
    if (!res) return t().promoErr;
    if (res.tipo === 'free_shipping') return t().promoOkShip;
    if (res.tipo === 'fixed') return (t().promoOkFixed || '').replace('{n}', res.discount);
    if (res.tipo === 'percent') {
      var pct = res.valor != null && res.valor !== '' ? String(res.valor) : res.discount;
      return t().promoOk.replace('{n}', pct);
    }
    return t().promoOk.replace('{n}', res.discount);
  }
  function applyCouponResult_(res, code) {
    if (!res || !res.valid) return false;
    var discountValue = parseFloat(res.discount) || 0;
    state.promo = res.codigo || code || state.promo;
    state.couponCode = res.codigo || code || '';
    state.couponTipo = res.tipo || '';
    state.couponCategoria = res.categoria || '';
    state.couponValor = parseFloat(res.valor) || 0;
    var basis = couponEligibleSubtotal_();
    state.discAmount = discountValue;
    state.discPct = res.tipo === 'percent' && basis > 0 ? (discountValue / basis) * 100 : 0;
    return true;
  }
  function currentDiscount(sub) {
    if (state.couponTipo === 'free_shipping') return 0;
    var base = state.couponCategoria ? couponEligibleSubtotal_() : (sub == null ? cartSub() : sub);
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
    state.couponCategoria = '';
    state.couponValor = 0;
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
      var res = await erpCall('validateCoupon', { code: state.couponCode, total: sub, items: couponValidationItems_() });
      if (applyCouponResult_(res, state.couponCode)) return true;
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

  async function addCart(id, sz, cl, opts) {
    opts = opts || {};
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
    if (!opts.silentToast) global.toast(t().tAdd.replace('{n}', nm(p)), 's');
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

  function openCart() {
    capturePageScroll();
    $('cartBg').classList.add('open');
    renderCart();
    updateScrollLock();
  }
  function closeCart(updateLock) {
    $('cartBg').classList.remove('open');
    if (updateLock !== false) updateScrollLock();
  }

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
    var ship = computeCartShipping(afterDisc);

    df.innerHTML =
      cartShipBarHtml(afterDisc) +
      '<div class="promo-sec"><span class="promo-lbl">' + esc(t().promoLbl) + '</span>' +
      '<div class="promo-row"><input id="promoIn" type="text" placeholder="' + esc(t().promoPH) + '" value="' + esc(state.promo) + '" oninput="Shop.setPromo(this.value)"/>' +
      '<button class="btn-validate" onclick="Shop.applyPromo()">' + esc(t().promoBtn) + '</button></div><p id="promoMsg"></p></div>' +
      '<div class="totals">' +
      '<div class="t-row"><span>' + esc(t().subT) + '</span><span>' + sub.toFixed(2) + ' €</span></div>' +
      (disc > 0 ? '<div class="t-row disc"><span>' + esc(t().discT) + (state.couponTipo === 'percent' && state.couponValor ? ' (-' + esc(String(state.couponValor)) + '%)' : '') + '</span><span>- ' + disc.toFixed(2) + ' €</span></div>' : '') +
      (state.couponTipo === 'free_shipping' ? '<div class="t-row disc"><span>' + esc(t().discT) + '</span><span>' + esc(t().promoOkShip) + '</span></div>' : '') +
      (cartShowsShippingUi() ? '<div class="t-row"><span>' + esc(t().shipT) + '</span><span>' + (ship === 0 ? esc(t().shipFree) : ship.toFixed(2) + ' €') + '</span></div>' : '') +
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
        state.promo = code;
        state.couponCode = code;
        state.couponTipo = 'percent';
        state.couponValor = 10;
        state.discPct = 10;
        state.discAmount = 0;
        state.couponCategoria = '';
        if (el) { el.className = 'promo-ok'; el.textContent = promoSuccessText_({ tipo: 'percent', valor: 10, discount: '10' }); }
      } else {
        clearPromoState({ keepInput: true });
        if (el) { el.className = 'promo-err'; el.textContent = t().promoErr; }
      }
      renderCart();
      return;
    }
    try {
      var res = await erpCall('validateCoupon', { code: code, total: cartSub(), items: couponValidationItems_() });
      if (applyCouponResult_(res, code)) {
        var okMsg = promoSuccessText_(res);
        if (el) { el.className = 'promo-ok'; el.textContent = okMsg; }
        global.toast(okMsg, 's');
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

  function openWish() {
    capturePageScroll();
    $('wishBg').classList.add('open');
    renderWish();
    updateScrollLock();
  }
  function closeWish(updateLock) {
    $('wishBg').classList.remove('open');
    if (updateLock !== false) updateScrollLock();
  }

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
    capturePageScroll();
    if (!document.body.classList.contains('scroll-lock')) lockBodyScroll();
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
              p.approvedReviews = revs.reviews;
            }
          }
        }
      } catch (e) { /* ignore */ }
    }
    if (!p) {
      updateScrollLock();
      return;
    }
    state.qvProd = p;
    state.qvGalleryIndex = 0;
    state.qvGuide = false;
    state.qvViewMode = 'shop';
    state.qvInfoTab = state.qvOpenReviewsTab ? 'reviews' : 'desc';
    state.qvAddedFlash = null;
    var colorOpts = productColorOptions(p);
    var sizeOpts = productSizeOptions(p);
    if (colorOpts.length) {
      state.qvColor = colorOpts[0];
      state.qvForceVariant = true;
    } else {
      state.qvColor = normalizeOptionValue((p.colors || [])[0]) || '—';
      state.qvForceVariant = false;
    }
    if (sizeOpts.length === 1) {
      state.qvSize = sizeOpts[0];
    } else if (!sizeOpts.length) {
      state.qvSize = normalizeOptionValue(productSizes(p)[0]) || (t().oneSize || 'TU');
    } else {
      state.qvSize = '';
    }
    if (state.token && p && p.id) await fetchReviewEligibility([p.id]);
    renderQv();
    state.qvOpenReviewsTab = false;
    $('qvBg').classList.add('open');
    updateScrollLock();
  }

  function closeQv(updateLock) {
    state.qvAddedFlash = null;
    $('qvBg').classList.remove('open');
    if (updateLock !== false) updateScrollLock();
  }

  function setQvViewMode(mode) {
    state.qvViewMode = mode === 'photo' ? 'photo' : 'shop';
    renderQv();
  }

  function setQvInfoTab(tab) {
    state.qvInfoTab = tab === 'reviews' ? 'reviews' : 'desc';
    if (tab === 'reviews' && state.qvProd && state.qvProd.id && state.token) {
      fetchReviewEligibility([state.qvProd.id]).then(function () { renderQv(); });
      return;
    }
    renderQv();
  }

  function renderQvReviewsList_(reviews) {
    var tm = t();
    if (!reviews || !reviews.length) {
      return '<p class="acc-hint qv-review-empty">' + esc(tm.noReviewsYet || 'Aucun avis pour le moment.') + '</p>';
    }
    return '<ul class="qv-review-list">' + reviews.map(function (r) {
      var nota = Math.max(1, Math.min(5, parseInt(r.nota, 10) || 5));
      var txt = String(r.comentario || r.comment || '').trim();
      return '<li class="qv-review-item">' +
        '<p class="qv-review-stars product-stars">' + starsGlyphsHtml(nota) + '</p>' +
        (txt ? '<p class="qv-review-text">' + esc(txt) + '</p>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  function renderQvInfoTabsBlock(p) {
    var tab = state.qvInfoTab === 'reviews' ? 'reviews' : 'desc';
    var tm = t();
    var revCount = parseInt(p.rev, 10) || 0;
    var reviewsLabel = tm.tabReviews || tm.reviews || 'Avis';
    if (revCount > 0) reviewsLabel += ' (' + revCount + ')';
    return '<div class="qv-info-section">' +
      '<div class="tab-bar qv-tab-bar" role="tablist">' +
      '<button type="button" role="tab" class="tab-btn' + (tab === 'desc' ? ' on' : '') + '" aria-selected="' + (tab === 'desc' ? 'true' : 'false') + '" onclick="Shop.setQvInfoTab(\'desc\')">' + esc(tm.tabDesc) + '</button>' +
      '<button type="button" role="tab" class="tab-btn' + (tab === 'reviews' ? ' on' : '') + '" aria-selected="' + (tab === 'reviews' ? 'true' : 'false') + '" onclick="Shop.setQvInfoTab(\'reviews\')">' + esc(reviewsLabel) + '</button></div>' +
      (tab === 'desc'
        ? '<div class="tab-panel qv-desc" role="tabpanel"><p>' + esc(desc(p)) + '</p></div>'
        : '<div class="qv-review-panel" role="tabpanel">' + renderQvReviewsList_(p.approvedReviews) + renderQvReviewFormBlock(p) + '</div>') +
      '</div>';
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
          return '<div class="col-btn-item' + on + '">' +
            '<button class="col-btn' + on + '" type="button" title="' + esc(label) + '" aria-label="' + esc(label) + '" style="' + colorSwatchStyle(c) + '" onclick="Shop.setQvColor(\'' + esc(c).replace(/'/g, "\\'") + '\')"></button>' +
            '<span class="col-btn-lbl">' + esc(label) + '</span></div>';
        }).join('') + '</div></div>';
    }
    if (sizeOptions.length) {
      html += '<div class="qv-opt-block"><div class="qv-opt-head"><span class="opt-label">' + esc(tm.szLbl) + '</span>' +
        '<button type="button" class="qv-size-guide" onclick="Shop.toggleQvGuide()">' + esc(tm.szGuide) + '</button></div>' +
        (state.qvGuide ? buildSizeGuideHtml(sizeOptions, true) : '') +
        '<div class="size-opts qv-size-opts">' + sizeOptions.map(function (s) {
          return '<button class="sz-btn ' + (state.qvSize === s ? 'on' : '') + '" type="button" onclick="Shop.setQvSize(\'' + esc(s).replace(/'/g, "\\'") + '\')">' + esc(s) + '</button>';
        }).join('') + '</div></div>';
    }
    html += '<p class="qv-selection-note' + (canAdd ? ' ok' : '') + '">' + esc(canAdd ? tm.selectionReady : tm.selectOptionsNotice) + '</p></div>';
    return html;
  }

  function qvAddedSummaryText(flash) {
    if (!flash || !state.qvProd) return '';
    var parts = [nm(state.qvProd)];
    var size = normalizeOptionValue(flash.size);
    var color = normalizeOptionValue(flash.color);
    if (size && size !== '—') parts.push(size);
    if (color && color !== '—') parts.push(colorDisplayName(color));
    return parts.join(' · ');
  }

  function renderQvCtaBlock(pid, canAdd, faved, tm) {
    var flash = state.qvAddedFlash;
    var html = '<div class="m-cta">';
    if (flash) {
      var summary = qvAddedSummaryText(flash);
      html += '<div class="qv-added-ok" role="status" aria-live="polite">' +
        '<span class="qv-added-icon" aria-hidden="true">✓</span>' +
        '<p class="qv-added-title">' + esc((tm.qvAddedTitle || '✓ Added to bag — {n}').replace('{n}', summary)) + '</p>' +
        '<p class="qv-added-hint">' + esc(tm.qvAddedHint || 'Browse photos or pick another size/colour, then add again.') + '</p></div>';
    }
    html += '<button class="btn-madd' + (canAdd ? '' : ' disabled') + '" ' +
      (canAdd ? 'onclick="Shop.addCartFromQv()"' : 'type="button" disabled') + '>' +
      esc(flash ? (tm.qvAddAnother || tm.addSel) : tm.addSel) + '</button>';
    if (flash) {
      html += '<div class="qv-added-actions">' +
        '<button type="button" class="btn-ghost-sm qv-act-btn" onclick="Shop.closeQv()">' + esc(tm.qvContinueShop || tm.contShopping) + '</button>' +
        '<button type="button" class="btn-gold qv-act-btn" onclick="Shop.openCartFromQv()">' + esc(tm.qvViewCart || 'View bag') + '</button></div>';
    }
    html += '<button class="btn-mfav" onclick="Shop.toggleWish(\'' + pid + '\');Shop.renderQv()">' +
      (faved ? esc(tm.favAdded) : esc(tm.favAdd)) + '</button></div>';
    return html;
  }

  async function addCartFromQv() {
    var p = state.qvProd;
    if (!p) return;
    if (!hasValidVariantSelection(p, state.qvSize, state.qvColor)) {
      global.toast(t().selectOptionsNotice, 'i');
      return;
    }
    await addCart(p.id, state.qvSize, state.qvColor, { silentToast: true });
    if ($('qvBg') && $('qvBg').classList.contains('open')) {
      state.qvAddedFlash = {
        size: state.qvSize,
        color: state.qvColor,
        at: Date.now()
      };
      renderQv();
    }
  }

  function openCartFromQv() {
    closeQv(false);
    openCart();
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
    var currentImg = qvDisplayedImageUrl(p);
    var zoomSrc = qvZoomImageUrl(p);

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
      imgHtml(currentImg, nm(p), { eager: true, fallback: currentImg, zoomSrc: zoomSrc }) +
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
      '<p class="m-stars product-stars">' + productStarsHtml(p.rate, p.rev) + '</p>' +
      '<div class="m-price"><span class="c">' + displayPrice.toFixed(2) + ' €</span>' +
      (p.old ? '<span class="o">' + p.old.toFixed(2) + ' €</span>' : '') + '</div>' +
      productShippingHintHtml(p, displayPrice) + '</div>' +
      renderQvInfoTabsBlock(p) +
      renderQvOptionsBlock(colorOptions, sizeOptions, canAdd) +
      renderQvCtaBlock(pid, canAdd, faved, tm) + '</div></div>';
  }

  function renderQvReviewFormBlock(p) {
    if (!p || !p.id) return '';
    var tm = t();
    if (!state.clientId || !state.token) {
      return '<div class="qv-review-block qv-review-form"><p class="acc-hint">' + esc(tm.reviewLoginHint || '') + '</p></div>';
    }
    var elig = state.reviewEligibility[p.id];
    if (elig && elig.hasReview) {
      var pendingMsg = elig.reviewStatus === 'pendente'
        ? (tm.reviewPendingModeration || tm.reviewThanks || 'Review pending moderation.')
        : (tm.reviewAlreadyDone || 'You already reviewed this product.');
      return '<div class="qv-review-block qv-review-form"><p class="acc-hint">' + esc(pendingMsg) + '</p></div>';
    }
    if (elig && !elig.canReview) {
      var blockMsg = tm.reviewDeliveryRequired || tm.reviewPurchaseRequired || 'Purchase this product to leave a review.';
      return '<div class="qv-review-block qv-review-form"><p class="acc-hint">' + esc(blockMsg) + '</p></div>';
    }
    return '<div class="qv-review-block qv-review-form">' +
      '<p class="form-title qv-review-form-title">' + esc(tm.reviewTitle || 'Review') + '</p>' +
      '<div class="field qv-review-field"><label>' + esc(tm.reviewRating || 'Rating') + '</label>' +
      '<select id="qvReviewRating" class="qv-review-select"><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></div>' +
      '<div class="field qv-review-field"><label>' + esc(tm.reviewComment || 'Comment') + '</label>' +
      '<textarea id="qvReviewComment" class="qv-review-textarea" rows="3" placeholder="' + esc(tm.reviewPlaceholder || '') + '"></textarea></div>' +
      '<button type="button" class="btn-ghost-sm" onclick="Shop.submitProductReview(\'' + esc(p.id).replace(/'/g, "\\'") + '\')">' + esc(tm.reviewSubmit || 'Submit') + '</button></div>';
  }

  async function submitProductReview(produtoId) {
    produtoId = String(produtoId || '').trim();
    if (!produtoId || !state.token) {
      global.toast(t().reviewLoginHint || 'Login required', 'e');
      return;
    }
    var commentEl = $('qvReviewComment');
    var ratingEl = $('qvReviewRating');
    var comentario = commentEl ? String(commentEl.value || '').trim() : '';
    var nota = ratingEl ? parseInt(ratingEl.value, 10) || 5 : 5;
    if (!comentario) {
      global.toast(t().reviewRequired || 'Comment required', 'e');
      return;
    }
    try {
      var res = await erpCall('createReview', { produtoId: produtoId, produto_id: produtoId, nota: nota, comentario: comentario }, state.token);
      if (!res || !res.success) {
        var errCode = res && (res.code || res.error);
        if (errCode === 'REVIEW_DELIVERY_REQUIRED' || errCode === 'REVIEW_PURCHASE_REQUIRED') {
          global.toast(t().reviewDeliveryRequired || t().reviewPurchaseRequired || 'Purchase required', 'e');
          return;
        }
        if (errCode === 'REVIEW_ALREADY') {
          global.toast(t().reviewAlreadyDone || 'Already reviewed', 'e');
          state.reviewEligibility[produtoId] = { hasReview: true, canReview: false, purchased: true, reviewStatus: 'pendente' };
          renderQv();
          return;
        }
        global.toast((res && res.error) || t().errGeneric || 'Error', 'e');
        return;
      }
      global.toast(t().reviewThanks || 'Thanks', 's');
      state.reviewEligibility[produtoId] = { hasReview: true, canReview: false, purchased: true, reviewStatus: 'pendente' };
      if (commentEl) commentEl.value = '';
      state.qvInfoTab = 'reviews';
      renderQv();
    } catch (e) { global.toast(e.message, 'e'); }
  }

  function setQvSize(s) { state.qvSize = s; state.qvForceVariant = true; state.qvAddedFlash = null; renderQv(); }
  function setQvColor(c) { state.qvColor = c; state.qvForceVariant = true; state.qvAddedFlash = null; renderQv(); }
  function toggleQvGuide() { state.qvGuide = !state.qvGuide; renderQv(); }

  function setQvGallery(idx) {
    state.qvGalleryIndex = parseInt(idx, 10) || 0;
    state.qvForceVariant = false;
    renderQv();
  }

  function qvGalleryPrev() {
    var p = state.qvProd;
    if (!p) return;
    var len = productGalleryList(p).length;
    if (len <= 1) return;
    state.qvForceVariant = false;
    state.qvGalleryIndex = ((state.qvGalleryIndex || 0) - 1 + len) % len;
    renderQv();
  }

  function qvGalleryNext() {
    var p = state.qvProd;
    if (!p) return;
    var len = productGalleryList(p).length;
    if (len <= 1) return;
    state.qvForceVariant = false;
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
        categoria: cartLineCategory_(it),
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
    var ship = computeCartShipping(after);
    return { sub: sub, disc: disc, after: after, ship: ship, total: after + ship };
  }

  function checkoutTotalsHtml(totals) {
    var rows = '<div class="totals" style="margin:12px 0;">' +
      '<div class="t-row"><span>' + esc(t().subT) + '</span><span>' + totals.sub.toFixed(2) + ' €</span></div>';
    if (totals.disc > 0) {
      var discLbl = esc(t().discT);
      if (state.couponTipo === 'percent' && state.couponValor) discLbl += ' (-' + esc(String(state.couponValor)) + '%)';
      rows += '<div class="t-row disc"><span>' + discLbl + '</span><span>- ' + totals.disc.toFixed(2) + ' €</span></div>';
    } else if (state.couponTipo === 'free_shipping') {
      rows += '<div class="t-row disc"><span>' + esc(t().discT) + '</span><span>' + esc(t().promoOkShip) + '</span></div>';
    }
    if (shippingEnabled() && totals.ship > 0) {
      rows += '<div class="t-row"><span>' + esc(t().shipT) + '</span><span>' + totals.ship.toFixed(2) + ' €</span></div>';
    } else if (cartShowsShippingUi()) {
      rows += '<div class="t-row"><span>' + esc(t().shipT) + '</span><span>' + esc(t().shipFree) + '</span></div>';
    }
    rows += '<div class="t-row grand"><span>' + esc(t().totalT) + '</span><span>' + totals.total.toFixed(2) + ' €</span></div></div>';
    return rows;
  }

  function isStripeOn(silent) {
    refreshStripePk_();
    var pk = getStripePk_();
    if (!pk) {
      if (silent !== true) console.error('[AZAVISION] Stripe OFF : STRIPE_PUBLISHABLE_KEY manquante dans index.html (erp-api-config)');
      return false;
    }
    if (state.config.pay_stripe_enabled === '0' || state.config.pay_stripe_enabled === 0) {
      if (silent !== true) console.warn('[AZAVISION] Stripe OFF : pay_stripe_enabled=0 (admin/Sheets CONFIG)');
      return false;
    }
    var en = cfgOn('pay_stripe_enabled', true);
    var show = cfgOn('pay_show_stripe', true);
    if (!en || !show) {
      if (silent !== true) {
        console.warn('[AZAVISION] Stripe OFF : pay_stripe_enabled=', en, 'pay_show_stripe=', show,
          '| config raw:', state.config.pay_stripe_enabled, state.config.pay_show_stripe);
      }
      return false;
    }
    return true;
  }

  function stripeDynamicMethods_() {
    return cfgOn('stripe_dynamic_methods', false);
  }

  function stripeSeparatedPtMethods_() {
    if (stripeDynamicMethods_()) return false;
    return cfgOn('stripe_pt_local_methods', true);
  }

  function isStripePayMethod_(m) {
    m = m || state.payMethod;
    return m === 'stripe' || m === 'stripe_card' || m === 'stripe_mb_way' || m === 'stripe_multibanco';
  }

  function stripePmStripeType_(m) {
    m = m || state.payMethod;
    if (m === 'stripe_mb_way') return 'mb_way';
    if (m === 'stripe_multibanco') return 'multibanco';
    return 'card';
  }

  function stripePmPayload_(m) {
    if (!isStripePayMethod_(m)) return {};
    if (!stripeSeparatedPtMethods_() && m === 'stripe') return {};
    return { stripePmType: stripePmStripeType_(m) };
  }

  function stripePayMethodLabel_(m) {
    if (m === 'stripe_mb_way') return t().payStripeMbWay || 'MB Way';
    if (m === 'stripe_multibanco') return t().payStripeMultibanco || 'Multibanco';
    if (m === 'stripe_card' || m === 'stripe') return t().payStripeCard || t().payStripe || 'Cartão';
    return '';
  }

  function stripePaymentHintHtml_(m) {
    m = m || state.payMethod;
    if (!isStripePayMethod_(m)) return '';
    var hint = '';
    if (m === 'stripe_mb_way') hint = t().stripeMbWayHint || '';
    else if (m === 'stripe_multibanco') hint = t().stripeMultibancoHint || '';
    else if (m === 'stripe_card' || m === 'stripe') hint = t().stripeCardHint || '';
    if (!hint) return '';
    return '<p class="acc-hint" style="margin:8px 0 4px;">' + esc(hint) + '</p>';
  }

  function defaultPayMethod() {
    if (isStripeOn()) return stripeSeparatedPtMethods_() ? 'stripe_card' : 'stripe';
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
    if (state._stripeServerTotal != null && !isNaN(state._stripeServerTotal)) {
      return Math.max(50, Math.round(parseFloat(state._stripeServerTotal) * 100));
    }
    if (state.stripeRetryOrderId && state.stripeRetryOrderTotal) {
      return Math.max(50, Math.round(parseFloat(state.stripeRetryOrderTotal) * 100));
    }
    var totals = orderTotals();
    return Math.max(50, Math.round(totals.total * 100));
  }

  function isPendingStripeOrder_(o) {
    return String((o && o.estado_pagamento) || '').toLowerCase() === 'aguardando_pagamento';
  }

  function stopStripePaymentPoll_() {
    if (state._stripePollTimer) {
      clearInterval(state._stripePollTimer);
      state._stripePollTimer = null;
    }
  }

  function startStripePaymentPoll_(orderId) {
    stopStripePaymentPoll_();
    if (!orderId || !isStripeOn()) return;
    state._stripePollTimer = setInterval(function () {
      erpCall('getStripePaymentStatus', orderAccessPayload({
        orderId: orderId,
        clientId: state.clientId || 'guest',
        nome: state.clientName || state.form.name || ''
      }), state.token).then(function (st) {
        if (st && st.paid) {
          stopStripePaymentPoll_();
          state.stripeRetryOrderId = '';
          openOrderDetail(orderId);
          global.toast(t().ordTitle, 's');
        }
      }).catch(function () { /* ignore */ });
    }, 12000);
  }

  function isTransferPaymentOn() {
    return cfgOn('pay_transfer_enabled', true) && cfgOn('pay_show_transfer', true) &&
      String(state.config.transfer_iban || '').trim().length >= 15;
  }

  function isMbwayPaymentOn() {
    return cfgOn('pay_show_mbway', false) && !!String(state.config.pay_mbway_phone || '').trim();
  }

  function isWhatsappPaymentOn() {
    return false;
  }

  function buildWhatsappPayMessage_(ref, amount) {
    var msg = String(t().payWhatsappMsg || 'Olá, pretendo pagar a encomenda {ref} no valor de {amount} €.')
      .replace('{ref}', ref).replace('{amount}', amount);
    var iban = String((state.config || {}).transfer_iban || '').trim();
    var holder = String((state.config || {}).transfer_account_holder || '').trim();
    if (iban) {
      msg += '\n' + String(t().payInstrIban || 'IBAN') + ': ' + iban;
      if (holder) msg += '\n' + String(t().transferHolder || 'Titular') + ': ' + holder;
    }
    var mb = String((state.config || {}).pay_mbway_phone || '').trim();
    if (mb) msg += '\nMB Way: ' + mb;
    return msg;
  }

  function paymentOptionsHtml() {
    var opts = [];
    if (isStripeOn()) {
      if (stripeSeparatedPtMethods_()) {
        opts.push('<label class="pay-opt"><input type="radio" name="payM" value="stripe_card" ' + (state.payMethod === 'stripe_card' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'stripe_card\')"/> ' + esc(t().payStripeCard || t().payStripe) + '</label>');
        opts.push('<label class="pay-opt"><input type="radio" name="payM" value="stripe_mb_way" ' + (state.payMethod === 'stripe_mb_way' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'stripe_mb_way\')"/> ' + esc(t().payStripeMbWay || 'MB Way') + '</label>');
        if (cfgOn('pay_show_multibanco', true)) {
          opts.push('<label class="pay-opt"><input type="radio" name="payM" value="stripe_multibanco" ' + (state.payMethod === 'stripe_multibanco' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'stripe_multibanco\')"/> ' + esc(t().payStripeMultibanco || 'Multibanco') + '</label>');
        }
      } else {
        opts.push('<label class="pay-opt"><input type="radio" name="payM" value="stripe" ' + (state.payMethod === 'stripe' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'stripe\')"/> ' + esc(t().payStripe || 'Pagamento online') + '</label>');
      }
    }
    if (cfgOn('pay_show_cod', true) && cfgOn('pay_cod_enabled', true)) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="cod" ' + (state.payMethod === 'cod' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'cod\')"/> ' +
        esc(t().payCod) + '</label>');
    }
    if (isTransferPaymentOn()) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="transfer" ' + (state.payMethod === 'transfer' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'transfer\')"/> ' +
        esc(t().payTransfer) + '</label>');
    }
    if (isMbwayPaymentOn()) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="mbway" ' + (state.payMethod === 'mbway' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'mbway\')"/> ' +
        esc(t().payMbway || 'MB Way') + '</label>');
    }
    if (cfgOn('pay_show_paypal', false) && cfgOn('pay_paypal_enabled', true) && String(state.config.pay_paypal_me || '').trim()) {
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
    var wasStripe = isStripePayMethod_(state.payMethod);
    if (!isStripePayMethod_(m) || (wasStripe && state.payMethod !== m)) destroyStripeElement();
    state.payMethod = m;
    renderCo();
  }

  function setStripeRetryPayMethod(m) {
    if (!isStripePayMethod_(m)) return;
    if (state.stripeRetryPayMethod !== m) destroyStripeElement();
    state.stripeRetryPayMethod = m;
    renderAccount();
    scheduleStripeRetryMount_();
  }

  function stripeRetryPaymentOptionsHtml_() {
    if (!stripeSeparatedPtMethods_()) return '';
    var m = state.stripeRetryPayMethod || 'stripe_card';
    var opts = [];
    opts.push('<label class="pay-opt"><input type="radio" name="payMRetry" value="stripe_card" ' + (m === 'stripe_card' ? 'checked' : '') + ' onchange="Shop.setStripeRetryPayMethod(\'stripe_card\')"/> ' + esc(t().payStripeCard || t().payStripe) + '</label>');
    opts.push('<label class="pay-opt"><input type="radio" name="payMRetry" value="stripe_mb_way" ' + (m === 'stripe_mb_way' ? 'checked' : '') + ' onchange="Shop.setStripeRetryPayMethod(\'stripe_mb_way\')"/> ' + esc(t().payStripeMbWay || 'MB Way') + '</label>');
    if (cfgOn('pay_show_multibanco', true)) {
      opts.push('<label class="pay-opt"><input type="radio" name="payMRetry" value="stripe_multibanco" ' + (m === 'stripe_multibanco' ? 'checked' : '') + ' onchange="Shop.setStripeRetryPayMethod(\'stripe_multibanco\')"/> ' + esc(t().payStripeMultibanco || 'Multibanco') + '</label>');
    }
    return '<div class="pay-opts" style="margin:10px 0;">' + opts.join('') + '</div>' + stripePaymentHintHtml_(m);
  }

  function openCo() {
    if (requireClientAccountForCheckout_()) {
      global.toast(accT().loginRequired || t().guestCheckout || 'Inicie sessão para finalizar a compra.', 'i');
      state.accountView = 'login';
      openAccount();
      return;
    }
    closeCart(false);
    state.ordered = false;
    state.lastStripePending = false;
    state.lastStripeVoucher = null;
    state.lastInvoice = null;
    state.lastInvoiceTried = false;
    state.delStep = 0;
    state.payMethod = defaultPayMethod();
    prefillCheckoutFromProfile();
    renderCo();
    if (isStripePayMethod_(state.payMethod) && !isStripeOn(true)) diagnoseStripe();
    capturePageScroll();
    $('coBg').classList.add('open');
    updateScrollLock();
  }

  function closeCo(updateLock) {
    $('coBg').classList.remove('open');
    destroyStripeElement();
    if (updateLock !== false) updateScrollLock();
  }

  function destroyStripeElement() {
    if (state.stripePaymentElement) {
      try { state.stripePaymentElement.unmount(); } catch (e) { /* ignore */ }
      state.stripePaymentElement = null;
    }
    state.stripeElements = null;
    state.stripeAmountCents = 0;
    state.stripeMountedPmType = '';
  }

  function activeStripePayMethod_() {
    if (state.stripeRetryOrderId) return state.stripeRetryPayMethod || 'stripe_card';
    return state.payMethod;
  }

  function isStripePendingStatus_(s) {
    s = String(s || '').toLowerCase();
    return s === 'processing' || s === 'requires_action';
  }

  function extractMultibancoVoucher_(pi) {
    try {
      var na = pi && pi.next_action;
      if (!na) return null;
      var d = na.multibanco_display_details || na.display_multibanco_details || null;
      if (!d && na.type && na.type.indexOf('multibanco') < 0) return null;
      d = d || {};
      var amount = (pi.amount != null) ? (pi.amount / 100).toFixed(2) : '';
      var voucher = {
        entity: d.entity || '',
        reference: d.reference || '',
        amount: amount,
        expiresAt: d.expires_at || 0,
        hostedUrl: d.hosted_voucher_url || ''
      };
      if (!voucher.entity && !voucher.reference && !voucher.hostedUrl) return null;
      return voucher;
    } catch (e) {
      return null;
    }
  }

  function markStripeOrderPending_(orderId, endereco, voucher) {
    state.cart = [];
    clearPromoState();
    if (state.cartId) {
      try { erpCall('clearCart', { cartId: state.cartId }); } catch (e) { /* ignore */ }
    }
    updBadge();
    state.ordered = true;
    state.lastStripePending = true;
    state.lastStripeVoucher = voucher || null;
    state.lastOrderSnapshot = {
      pedido_id: orderId,
      estado: 'pending',
      estado_pagamento: 'aguardando_pagamento',
      estado_envio: 'pending',
      endereco: endereco || '',
      tracking_number: '',
      transportadora: ''
    };
    startStripePaymentPoll_(orderId);
  }

  function stripePendingInstructionsHtml_() {
    if (!state.lastStripePending) return '';
    var v = state.lastStripeVoucher;
    var rows = [];
    var title = t().payPendingTitle || 'Pagamento em processamento';
    if (v && (v.entity || v.reference)) {
      title = t().mbVoucherTitle || 'Referência Multibanco';
      if (v.entity) rows.push('<p style="font-size:11px;margin:4px 0;">' + esc(t().mbVoucherEntity || 'Entidade') + ' : <strong>' + esc(v.entity) + '</strong></p>');
      if (v.reference) rows.push('<p style="font-size:11px;margin:4px 0;">' + esc(t().mbVoucherRef || 'Referência') + ' : <strong>' + esc(v.reference) + '</strong></p>');
      if (v.amount) rows.push('<p style="font-size:11px;margin:4px 0;">' + esc(t().mbVoucherAmount || 'Montante') + ' : <strong>' + esc(v.amount) + ' €</strong></p>');
      rows.push('<p style="font-size:10px;margin:6px 0;color:var(--muted);">' + esc(t().mbVoucherHint || 'Pague esta referência em ATM ou homebanking. A encomenda é confirmada após o pagamento.') + '</p>');
      if (v.hostedUrl) {
        rows.push('<p style="margin:8px 0;"><a class="btn-gold" style="display:inline-block;text-decoration:none;padding:10px 18px;" href="' + esc(v.hostedUrl) + '" target="_blank" rel="noopener">' + esc(t().mbVoucherOpen || 'Ver referência') + '</a></p>');
      }
    } else {
      rows.push('<p style="font-size:11px;margin:4px 0;color:var(--muted);">' + esc(t().payPending || 'Pagamento em validação…') + '</p>');
    }
    return '<div class="order-ref-card" style="margin-top:10px;"><p class="order-ref-label">' + esc(title) + '</p>' + rows.join('') + '</div>';
  }

  async function initStripeElement() {
    refreshStripePk_();
    if (!getStripePk_()) {
      console.error('[AZAVISION] STRIPE_PUBLISHABLE_KEY manquante dans index.html');
      return;
    }
    if (typeof global.Stripe !== 'function') {
      console.error('[AZAVISION] Stripe.js non chargé — vérifiez que js.stripe.com/v3/ est chargé avant erp-shop.js');
      return;
    }
    if (!isStripeOn(true)) {
      console.warn('[AZAVISION] initStripeElement ignoré — isStripeOn()=false (Shop.diagnoseStripe())');
      return;
    }
    var amountCents = stripeAmountCents_();
    var pmType = stripePmStripeType_(activeStripePayMethod_());
    var mountedKey = stripeSeparatedPtMethods_() ? pmType : 'all';
    if (state.stripePaymentElement && state.stripeAmountCents === amountCents && state.stripeElements && state.stripeMountedPmType === mountedKey) return;
    destroyStripeElement();
    if (!state.stripe) state.stripe = global.Stripe(getStripePk_());
    var currency = String(state.config.currency_code || 'eur').toLowerCase();
    var stripeTheme = getTheme() === 'light' ? 'stripe' : 'night';
    var elementsOpts = {
      mode: 'payment',
      amount: amountCents,
      currency: currency,
      locale: stripeLocale_(),
      appearance: { theme: stripeTheme }
    };
    if (stripeSeparatedPtMethods_()) {
      elementsOpts.paymentMethodTypes = [pmType];
    }
    state.stripeElements = state.stripe.elements(elementsOpts);
    state.stripeAmountCents = amountCents;
    state.stripeMountedPmType = mountedKey;
    var paymentElOpts = {
      layout: (stripeSeparatedPtMethods_() && pmType !== 'card')
        ? { type: 'accordion', defaultCollapsed: false, radios: false, spacedAccordionItems: false }
        : { type: 'tabs', defaultCollapsed: false },
      wallets: pmType === 'card' ? { applePay: 'auto', googlePay: 'auto' } : { applePay: 'never', googlePay: 'never' },
      defaultValues: stripeBillingDefaults_()
    };
    if (pmType === 'mb_way') {
      paymentElOpts.fields = { billingDetails: { phone: 'auto' } };
    }
    state.stripePaymentElement = state.stripeElements.create('payment', paymentElOpts);
    var mount = state.stripeRetryOrderId ? $('stripe-retry-element') : $('stripe-payment-element');
    if (mount) {
      mount.innerHTML = '';
      state.stripePaymentElement.mount(state.stripeRetryOrderId ? '#stripe-retry-element' : '#stripe-payment-element');
    }
  }

  function scheduleStripeRetryMount_() {
    if (!state.stripeRetryOrderId || !isStripeOn()) return;
    setTimeout(function () {
      initStripeElement().catch(function (e) {
        global.toast((t().errStripe || 'Erro no pagamento') + ': ' + e.message, 'e');
      });
    }, 0);
  }

  function openStripeRetryPay(orderId, total) {
    orderId = String(orderId || '').trim();
    if (!orderId || !isStripeOn()) return;
    state.stripeRetryOrderId = orderId;
    state.stripeRetryPayMethod = state.lastPayMethod && isStripePayMethod_(state.lastPayMethod) ? state.lastPayMethod : (stripeSeparatedPtMethods_() ? 'stripe_card' : 'stripe');
    state.stripeRetryOrderTotal = parseFloat(total) || 0;
    state.stripeRetryEmail = state.clientEmail || state.form.email || state.lastOrderEmail || '';
    state.stripeRetryName = state.clientName || state.form.name || '';
    state.stripeAmountCents = 0;
    destroyStripeElement();
    renderAccount();
    scheduleStripeRetryMount_();
    startStripePaymentPoll_(orderId);
  }

  function cancelStripeRetry() {
    stopStripePaymentPoll_();
    state.stripeRetryOrderId = '';
    state.stripeRetryOrderTotal = 0;
    destroyStripeElement();
    renderAccount();
  }

  async function submitStripeRetryPayment() {
    if (state.checkoutBusy || !state.stripeRetryOrderId) return;
    var orderId = state.stripeRetryOrderId;
    var email = state.stripeRetryEmail || normEmail(state.form.email || state.lastOrderEmail || '');
    var nome = state.stripeRetryName || state.form.name || '';
    if (!email) {
      global.toast(t().tReq, 'e');
      return;
    }
    if (!state.stripeElements || !state.stripePaymentElement) {
      await initStripeElement();
    }
    if (!state.stripeElements) {
      global.toast(t().errStripe || 'Stripe não disponível', 'e');
      return;
    }
    state.checkoutBusy = true;
    var retryBtn = $('btnStripeRetry');
    if (retryBtn) { retryBtn.disabled = true; retryBtn.textContent = t().payProcessing || 'A processar…'; }
    try {
      state._stripeServerTotal = parseFloat(state.stripeRetryOrderTotal) || 0;
      var submitUi = await state.stripeElements.submit();
      if (submitUi && submitUi.error) {
        global.toast(submitUi.error.message, 'e');
        return;
      }
      var piRes = await erpCall('createStripePaymentIntent', orderAccessPayload(Object.assign({
        orderId: orderId, email: email, nome: nome, clientId: state.clientId || 'guest'
      }, stripePmPayload_(state.stripeRetryPayMethod))), state.token);
      if (!piRes || !piRes.success || !piRes.clientSecret) {
        if (piRes && piRes.alreadyPaid) {
          stopStripePaymentPoll_();
          state.stripeRetryOrderId = '';
          await openOrderDetail(orderId);
          global.toast(t().ordTitle, 's');
          return;
        }
        logStripeApiError_('createStripePaymentIntent (retry)', piRes);
        global.toast((piRes && piRes.error) || (t().errStripe || 'Erro no pagamento'), 'e');
        return;
      }
      var conf = await state.stripe.confirmPayment({
        elements: state.stripeElements,
        clientSecret: piRes.clientSecret,
        confirmParams: stripeConfirmParams_(orderId),
        redirect: 'if_required'
      });
      if (conf.error) {
        logStripeApiError_('confirmPayment (retry)', conf.error);
        global.toast(conf.error.message + ' — ' + (t().stripeRetryHint || ''), 'e');
        return;
      }
      var confPiRetry = conf.paymentIntent;
      var piIdRetry = (confPiRetry && confPiRetry.id) ? confPiRetry.id : piRes.paymentIntentId;
      if (confPiRetry && isStripePendingStatus_(confPiRetry.status)) {
        var voucher = extractMultibancoVoucher_(confPiRetry);
        state.stripeRetryOrderId = '';
        state.stripeRetryOrderTotal = 0;
        destroyStripeElement();
        startStripePaymentPoll_(orderId);
        if (voucher && voucher.hostedUrl) {
          try { global.open(voucher.hostedUrl, '_blank', 'noopener'); } catch (eOpen) { /* ignore */ }
        }
        await openOrderDetail(orderId);
        global.toast(t().payPending || 'Pagamento em processamento…', 'i');
        return;
      }
      var confirmRes = await erpCall('confirmStripePayment', orderAccessPayload({
        orderId: orderId,
        paymentIntentId: piIdRetry,
        clientId: state.clientId || 'guest',
        nome: nome
      }), state.token);
        if (!confirmRes || !confirmRes.success) {
          logStripeApiError_('confirmStripePayment (retry)', confirmRes);
          global.toast((confirmRes && confirmRes.error) || (t().errPayment || 'Erro no pagamento'), 'e');
          return;
        }
      stopStripePaymentPoll_();
      state.stripeRetryOrderId = '';
      state.stripeRetryOrderTotal = 0;
      destroyStripeElement();
      await openOrderDetail(orderId);
      global.toast(t().ordTitle, 's');
    } catch (e) {
      global.toast(e.message, 'e');
    } finally {
      state._stripeServerTotal = null;
      state.checkoutBusy = false;
      if (retryBtn) { retryBtn.disabled = false; retryBtn.textContent = t().stripePayNow || 'Pagar agora'; }
      if (state.stripeRetryOrderId) renderAccount();
    }
  }

  async function cancelPendingOrder(orderId) {
    orderId = String(orderId || '').trim();
    if (!orderId) return;
    var email = normEmail(state.clientEmail || state.form.email || state.lastOrderEmail || '');
    if (!email) {
      global.toast(t().tReq, 'e');
      return;
    }
    if (!global.confirm(t().stripeCancelConfirm || 'Cancelar esta encomenda?')) return;
    try {
      var res = await erpCall('cancelPendingOrder', orderAccessPayload({ orderId: orderId, email: email, clientId: state.clientId || 'guest' }), state.token);
      if (!res || !res.success) {
        global.toast((res && res.error) || (t().errOrderFailed || 'Erro'), 'e');
        return;
      }
      stopStripePaymentPoll_();
      state.stripeRetryOrderId = '';
      destroyStripeElement();
      global.toast(t().stripeCancelledOk || 'Encomenda cancelada', 's');
      if (state.accountView === 'orderDetail') {
        state.selectedOrder = null;
        state.accountView = state.token ? 'dashboard' : 'track';
      }
      renderAccount();
    } catch (e) {
      global.toast(e.message, 'e');
    }
  }

  function scheduleStripeMount_() {
    if (!isStripePayMethod_(state.payMethod) || !isStripeOn(true) || state.ordered || state.checkoutBusy) return;
    setTimeout(function () {
      initStripeElement().catch(function (e) {
        global.toast((t().errStripe || 'Erro no pagamento') + ': ' + e.message, 'e');
      });
    }, 0);
  }

  function stripeCleanPhone_(phone) {
    phone = String(phone || '').trim();
    if (!phone) return '';
    var digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    if (phone.charAt(0) === '+') return '+' + digits;
    if (digits.indexOf('00') === 0 && digits.length > 2) return '+' + digits.slice(2);
    if (digits.length === 9 && digits.charAt(0) === '9') return '+351' + digits;
    return digits.length >= 9 ? '+' + digits : '';
  }

  function stripeBillingDetails_() {
    var phone = stripeCleanPhone_(state.form.phone || state.clientPhone || '');
    var out = {
      name: String(state.form.name || state.clientName || '').trim(),
      email: normEmail(state.form.email || state.clientEmail || '')
    };
    if (phone) out.phone = phone;
    return out;
  }

  function stripeBillingDefaults_() {
    return { billingDetails: stripeBillingDetails_() };
  }

  function stripeConfirmParams_(orderId) {
    var details = stripeBillingDetails_();
    var params = {
      return_url: window.location.href.split('#')[0] + '#order-' + orderId
    };
    if (details.name || details.email || details.phone) {
      params.payment_method_data = { billing_details: details };
    }
    return params;
  }

  function updateCheckoutBusyUi_(busy) {
    var btn = $('btnPayOrder');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? (t().payProcessing || 'A processar…') : t().payBtn;
  }

  function paymentInstructionsHtml() {
    var cfg = state.config || {};
    var m = state.lastPayMethod;
    var amount = state.lastOrderTotal || '';
    var ref = '#' + (state.lastOrderId || '');
    var rows = [];
    if (m === 'transfer' && String(cfg.transfer_iban || '').trim()) {
      var holder = String(cfg.transfer_account_holder || '').trim();
      var bank = String(cfg.transfer_bank_name || '').trim();
      if (holder) {
        rows.push('<p style="font-size:11px;margin:4px 0;">' + esc(t().transferHolder || 'Titular da conta') + ' : <strong>' + esc(holder) + '</strong></p>');
      }
      if (bank) {
        rows.push('<p style="font-size:11px;margin:4px 0;">' + esc(t().transferBank || 'Banco') + ' : <strong>' + esc(bank) + '</strong></p>');
      }
      rows.push('<p style="font-size:11px;margin:4px 0;">' + esc(t().payInstrIban || 'Transferência para o IBAN') + ' : <strong id="pay-iban-value">' + esc(cfg.transfer_iban) + '</strong> ' +
        '<button type="button" class="btn-copy-ref" onclick="Shop.copyPayIban()">' + esc(t().copyIban || t().copyOrderCode || 'Copiar') + '</button></p>');
    } else if (m === 'mbway' && String(cfg.pay_mbway_phone || '').trim()) {
      rows.push('<p style="font-size:11px;margin:4px 0;">' + esc(t().payInstrMbway || 'Envie o pagamento MB Way para') + ' <strong>' + esc(cfg.pay_mbway_phone) + '</strong></p>');
    } else if (m === 'paypal' && String(cfg.pay_paypal_me || '').trim()) {
      var link = String(cfg.pay_paypal_me).trim();
      if (!/^https?:\/\//i.test(link)) link = 'https://paypal.me/' + link.replace(/^@/, '');
      if (amount) link = link.replace(/\/+$/, '') + '/' + amount;
      rows.push('<p style="margin:8px 0;"><a class="btn-gold" style="display:inline-block;text-decoration:none;padding:10px 18px;" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(t().payPaypalBtn || 'Pagar com PayPal') + '</a></p>');
    } else if (m === 'whatsapp' && contactWhatsAppUrl()) {
      var waMsg = buildWhatsappPayMessage_(ref, amount);
      var waLink = contactWhatsAppUrl(waMsg);
      rows.push('<p style="font-size:11px;margin:4px 0;">' + esc(t().payInstrWhatsapp || 'Envie-nos uma mensagem WhatsApp para confirmar o pagamento') + '</p>');
      rows.push('<p style="margin:8px 0;"><a class="btn-gold" style="display:inline-block;text-decoration:none;padding:10px 18px;" href="' + esc(waLink) + '" target="_blank" rel="noopener noreferrer">💬 ' + esc(t().payWhatsappBtn || 'Pagar via WhatsApp') + '</a></p>');
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

  function invoiceFileName_(inv) {
    var ref = (inv && (inv.invoiceRef || (inv.order && inv.order.pedido_id))) || state.lastOrderId || 'comprovativo';
    return 'comprovativo-' + String(ref).replace(/[^\w\-]/g, '') + '.pdf';
  }

  function downloadInvoice() {
    var inv = state.lastInvoice;
    var html = inv && inv.html;
    if (!global.InvoiceReceipt || !global.InvoiceReceipt.downloadPdf) { printInvoice(); return; }
    if (html) { global.InvoiceReceipt.downloadPdf(html, invoiceFileName_(inv)); return; }
    if (state.lastOrderId) {
      loadInvoiceForOrder(state.lastOrderId, state.form.name).then(function (res) {
        if (res && res.html) {
          state.lastInvoice = res;
          global.InvoiceReceipt.downloadPdf(res.html, invoiceFileName_(res));
        } else {
          global.toast(t().receiptError || 'Comprovativo indisponível', 'e');
        }
      });
    }
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

  async function downloadOrderInvoice(orderId) {
    orderId = String(orderId || '').trim();
    if (!orderId) return;
    var inv = await loadInvoiceForOrder(orderId, state.clientName || state.form.name);
    if (inv && inv.html && global.InvoiceReceipt && global.InvoiceReceipt.downloadPdf) {
      global.InvoiceReceipt.downloadPdf(inv.html, invoiceFileName_(inv));
    } else if (inv && inv.html && global.InvoiceReceipt) {
      global.InvoiceReceipt.openPrintDocument(inv.html);
    } else {
      global.toast(t().receiptError || 'Reçu indisponible', 'e');
    }
  }

  function formatDeliveryLine_(order) {
    var o = order || {};
    var end = String(o.endereco || o.endereco_entrega || o.morada || '').trim();
    if (!end && state.form) {
      end = [state.form.addr, state.form.zip, state.form.city].filter(Boolean).join(', ');
    }
    if (!end) return t().trDeliveryFallback || 'Morada de entrega confirmada na encomenda.';
    return end;
  }

  function orderTrackingStep_(order) {
    var o = order || {};
    var estado = String(o.estado || '').toLowerCase();
    var ship = String(o.estado_envio || '').toLowerCase();
    if (estado === 'delivered' || estado === 'entregue' || ship === 'delivered' || ship === 'entregue') return 4;
    if (estado === 'shipped' || ship === 'shipped' || ship === 'em_transito' || ship === 'enviado') return 3;
    if (ship === 'preparacao' || estado === 'processing' || estado === 'em_processamento') return 2;
    return 1;
  }

  function orderTrackingDesc_(index, step, pair, deliveryLine, allowCurrent) {
    if (index === 3) {
      if (step >= 3) return String(t().tr4d || pair[1]).replace('{delivery}', deliveryLine);
      return t().trDeliveryPending || 'Será atualizado quando a encomenda for expedida.';
    }
    if (index < step) return pair[1];
    if (allowCurrent && index === step) return pair[1];
    return t().trStepPending || 'Aguarda atualização.';
  }

  function orderTrackingHtml(order) {
    var step = orderTrackingStep_(order);
    var o = order || {};
    var estado = String(o.estado || '').toLowerCase();
    var ship = String(o.estado_envio || '').toLowerCase();
    var allowCurrent = ship === 'preparacao' || estado === 'processing' || estado === 'em_processamento' ||
      estado === 'shipped' || ship === 'shipped' || ship === 'em_transito' || ship === 'enviado';
    var delivery = formatDeliveryLine_(order);
    var pairs = [
      [t().tr1t, t().tr1d],
      [t().tr2t, t().tr2d],
      [t().tr3t, t().tr3d],
      [t().tr4t, t().tr4d]
    ];
    var trackInfo = '';
    if (order && order.tracking_number) {
      trackInfo = '<p class="tr-track-ref">' + esc(t().trackingLabel || 'Rastreio') + ': <strong>' + esc(order.tracking_number) + '</strong>' +
        (order.transportadora ? ' · ' + esc(order.transportadora) : '') + '</p>';
    }
    return '<div class="tracking"><p class="tr-title">' + esc(t().trTitle) + '</p><div class="tr-steps">' +
      pairs.map(function (pair, i) {
        var done = i < step;
        var current = allowCurrent && i === step;
        var dotClass = (done ? 'done' : '') + (current ? ' current' : '');
        var desc = orderTrackingDesc_(i, step, pair, delivery, allowCurrent);
        return '<div class="tr-step' + (current ? ' tr-step-current' : '') + '"><span class="tr-dot ' + dotClass.trim() + '"></span><h4>' + esc(pair[0]) + '</h4><p>' + esc(desc) + '</p></div>';
      }).join('') + '</div>' + trackInfo + '</div>';
  }

  function renderCo() {
    if (state.checkoutBusy && isStripePayMethod_(state.payMethod) && !state.ordered) {
      updateCheckoutBusyUi_(true);
      return;
    }
    if (state.ordered) {
      // Auto-chargement du comprovativo une seule fois (puis renderCo se relancera quand prêt).
      if (state.lastOrderId && !state.lastInvoice && !state.lastInvoiceLoading && !state.lastInvoiceTried) {
        state.lastInvoiceTried = true;
        fetchLastInvoice();
      }
      var lastEmail = state.lastOrderEmail || state.form.email || state.clientEmail || '';
      $('coBody').innerHTML =
        '<div class="order-ok"><span class="ok-emoji">🎉</span>' +
        '<h2 class="ok-title">' + esc(t().ordTitle) + '</h2>' +
        '<p class="ok-sub">' + esc(t().ordSub.replace('{name}', state.form.name).replace('{ref}', '#' + state.lastOrderId).replace('{email}', lastEmail)) + '</p>' +
        '<div class="order-ref-card"><p class="order-ref-label">' + esc(t().orderCodeLabel) + '</p><div class="order-ref-row"><strong>#' + esc(state.lastOrderId) + '</strong><button type="button" class="btn-copy-ref" onclick="Shop.copyLastOrderCode()">' + esc(t().copyOrderCode) + '</button></div><p class="order-ref-help">' + esc(t().orderCodeHint) + '</p></div>' +
        receiptSectionHtml() +
        stripePendingInstructionsHtml_() +
        paymentInstructionsHtml() +
        orderTrackingHtml(state.lastOrderSnapshot) +
        '</div><div class="order-ok-actions"><button class="btn-gold" type="button" onclick="Shop.openLastOrderTracking()">' + esc(t().trackOrderNow) + '</button>' +
        '<button class="btn-order-secondary" type="button" onclick="Shop.loadOrderReceipt()">' + esc(t().receiptLater || t().receiptPrint) + '</button>' +
        '<button class="btn-order-secondary" type="button" onclick="Shop.closeCo()">' + esc(t().backBtn) + '</button></div></div>';
      return;
    }

    var totals = orderTotals();
    var f = state.form;
    $('coBody').innerHTML =
      '<div class="m-body co-panel">' +
      '<h2 class="co-title">' + esc(t().coTitle) + '</h2>' +
      '<p style="font-size:10px;color:var(--muted);margin-bottom:18px;">' + esc(t().coSub) + '</p>' +
      (requireClientAccountForCheckout_()
        ? '<p class="acc-hint" style="margin-bottom:14px;color:var(--gold);">' + esc(accT().loginRequired || t().loginRequired || 'Inicie sessão para finalizar a compra.') + ' <button type="button" class="acc-link" onclick="Shop.closeCo();Shop.openAccount();">' + esc(accT().loginBtn || accT().login || 'Entrar') + '</button></p>'
        : (!state.clientId ? '<p class="acc-hint" style="margin-bottom:14px;">' + esc(t().guestCheckout) + ' <button type="button" class="acc-link" onclick="Shop.closeCo();Shop.openAccount();">' + esc(t().guestCheckoutBtn) + '</button>' + esc(t().guestCheckoutSuffix) + '</p>' : '')) +
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
      (isStripePayMethod_(state.payMethod) ? stripePaymentHintHtml_(state.payMethod) : '') +
      '<div id="stripe-payment-element" style="margin:12px 0;' + (isStripePayMethod_(state.payMethod) ? '' : 'display:none;') + '"></div>' +
      '<div class="sec-note"><span>' + esc(t().secN) + '</span><strong>' + esc(t().secS) + '</strong></div>' +
      checkoutTotalsHtml(totals) +
      '<label class="acc-check co-terms"><input type="checkbox" id="coTerms"' + (f.acceptCheckoutTerms ? ' checked' : '') + ' onchange="Shop.setForm(\'acceptCheckoutTerms\',this.checked)"/><span>' + checkoutTermsLabelHtml() + '</span></label>' +
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

  async function copyPayIban() {
    var iban = String((state.config && state.config.transfer_iban) || '').trim();
    if (!iban) return;
    var ok = await copyText(iban.replace(/\s+/g, ''));
    global.toast(ok ? (t().copyIbanOk || t().copyOrderCodeOk || 'IBAN copiado') : iban, ok ? 's' : 'i');
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

  function isGuestCheckoutAllowed_() {
    return cfgOn('guest_checkout_enabled', false);
  }

  function requireClientAccountForCheckout_() {
    return !state.clientId && !isGuestCheckoutAllowed_();
  }

  async function submitOrder() {
    if (state.checkoutBusy) return;
    if (requireClientAccountForCheckout_()) {
      global.toast(accT().loginRequired || t().guestCheckout || 'Inicie sessão para finalizar a compra.', 'i');
      state.accountView = 'login';
      openAccount();
      return;
    }
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
    if (state.payMethod === 'transfer' && !isTransferPaymentOn()) {
      global.toast(t().transferIbanRequired || 'IBAN não configurado na loja — contacte o vendedor.', 'e');
      return;
    }
    if (state.payMethod === 'mbway' && !isMbwayPaymentOn()) {
      global.toast(t().mbwayRequired || 'MB Way não configurado na loja.', 'e');
      return;
    }
    if (state.payMethod === 'paypal' && !(cfgOn('pay_paypal_enabled', true) && String(state.config.pay_paypal_me || '').trim())) {
      global.toast(t().paypalRequired || 'PayPal não configurado na loja.', 'e');
      return;
    }
    if (state.payMethod === 'whatsapp' && !isWhatsappPaymentOn()) {
      global.toast(t().whatsappRequired || 'WhatsApp não configurado na loja.', 'e');
      return;
    }
    if (!f.acceptCheckoutTerms) {
      global.toast(t().coTermsRequired || t().termsRequired || 'Aceite os termos de venda', 'e');
      return;
    }

    if ((state.promo || '').trim() && !state.couponCode) {
      await applyPromo();
      if (!state.couponCode) return;
    } else if (state.couponCode) {
      var couponBefore = state.couponCode;
      await refreshActivePromo({ silent: true });
      if (!state.couponCode && couponBefore) {
        global.toast(t().promoErr, 'e');
        return;
      }
    }
    var totals = orderTotals();
    var endereco = [f.addr, f.zip, f.city].filter(Boolean).join(', ');
    var awaitStripe = isStripePayMethod_(state.payMethod) && isStripeOn();

    if (awaitStripe) {
      if (!state.stripeElements || !state.stripePaymentElement) {
        await initStripeElement();
      }
      if (!state.stripeElements) {
        global.toast(t().errStripe || 'Pagamento não disponível', 'e');
        return;
      }
      var preStripeSubmit = await state.stripeElements.submit();
      if (preStripeSubmit && preStripeSubmit.error) {
        global.toast(preStripeSubmit.error.message, 'e');
        return;
      }
    }

    state.checkoutBusy = true;
    if (awaitStripe) updateCheckoutBusyUi_(true);
    else renderCo();

    try {
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
        coupon_code: state.couponCode || '',
        cartId: state.cartId || '',
        items: buildOrderItems(),
        lang: state.lang || 'pt',
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
        state._stripeServerTotal = parseFloat(orderRes.total != null ? orderRes.total : totals.total);
        if (isNaN(state._stripeServerTotal)) state._stripeServerTotal = totals.total;
        var serverCents = Math.max(50, Math.round(state._stripeServerTotal * 100));
        if (!state.stripeElements || state.stripeAmountCents !== serverCents) {
          logStripeApiError_('stripe_amount_mismatch', null, 'el=' + state.stripeAmountCents + ' srv=' + serverCents);
          global.toast(t().stripeAmountChanged || 'Montant mis à jour — complétez le paiement depuis le détail de commande.', 'e');
          openAccount();
          openOrderDetail(orderRes.orderId);
          return;
        }
        var piRes = await erpCall('createStripePaymentIntent', orderAccessPayload(Object.assign({
          orderId: orderRes.orderId, email: f.email, nome: f.name, clientId: state.clientId || 'guest'
        }, stripePmPayload_(state.payMethod))), state.token);
        if (!piRes || !piRes.success || !piRes.clientSecret) {
          logStripeApiError_('createStripePaymentIntent', piRes);
          global.toast((piRes && piRes.error) || (t().errStripe || 'Erro Stripe') + ' — ' + (t().stripeRetryHint || ''), 'e');
          openAccount();
          openOrderDetail(orderRes.orderId);
          return;
        }
        var conf = await state.stripe.confirmPayment({
          elements: state.stripeElements,
          clientSecret: piRes.clientSecret,
          confirmParams: stripeConfirmParams_(orderRes.orderId),
          redirect: 'if_required'
        });
        if (conf.error) {
          logStripeApiError_('confirmPayment', conf.error);
          global.toast(conf.error.message + ' — ' + (t().stripeRetryHint || ''), 'e');
          openAccount();
          openOrderDetail(orderRes.orderId);
          return;
        }
        var confPi = conf.paymentIntent;
        var piId = (confPi && confPi.id) ? confPi.id : piRes.paymentIntentId;
        if (confPi && isStripePendingStatus_(confPi.status)) {
          destroyStripeElement();
          markStripeOrderPending_(orderRes.orderId, endereco, extractMultibancoVoucher_(confPi));
          saveSession();
          renderCo();
          global.toast(t().payPending || 'Pagamento em processamento…', 'i');
          return;
        }
        var confirmRes = await erpCall('confirmStripePayment', orderAccessPayload({
          orderId: orderRes.orderId,
          paymentIntentId: piId,
          clientId: state.clientId || 'guest',
          nome: f.name,
          cartId: state.cartId || ''
        }), state.token);
        if (!confirmRes || !confirmRes.success) {
          logStripeApiError_('confirmStripePayment', confirmRes);
          global.toast((confirmRes && confirmRes.error) || (t().errPayment || 'Erro no pagamento') + ' — ' + (t().stripeRetryHint || ''), 'e');
          openAccount();
          openOrderDetail(orderRes.orderId);
          return;
        }
        if (confirmRes.fiscal_doc_url) state.lastFiscalUrl = confirmRes.fiscal_doc_url;
        destroyStripeElement();
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
      } else if (state.payMethod === 'transfer' || state.payMethod === 'mbway' || state.payMethod === 'paypal' || state.payMethod === 'whatsapp') {
        await registerOfflinePaymentSafe_({
          orderId: orderRes.orderId,
          metodo: state.payMethod,
          valor: totals.total.toFixed(2),
          clientId: state.clientId || 'guest',
          email: f.email,
          lang: state.lang || 'pt'
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
      if (isStripePayMethod_(state.payMethod)) paySnap = 'pago_stripe';
      else if (state.payMethod === 'cod') paySnap = 'pago';
      state.lastOrderSnapshot = {
        pedido_id: orderRes.orderId,
        estado: 'pending',
        estado_pagamento: paySnap,
        estado_envio: 'pending',
        endereco: endereco,
        tracking_number: '',
        transportadora: ''
      };
      renderCo();
      global.toast(t().ordTitle, 's');
    } catch (e) {
      global.toast(e.message, 'e');
    } finally {
      state._stripeServerTotal = null;
      state.checkoutBusy = false;
      if ($('coBg') && $('coBg').classList.contains('open') && !state.ordered) renderCo();
    }
  }

  // ─── Account ───────────────────────────────────────────────────────────
  function openAccount() {
    capturePageScroll();
    $('accBg').classList.add('open');
    if (state.token && state.clientId && state.accountView !== 'track') state.accountView = 'dashboard';
    renderAccount();
    updateScrollLock();
  }
  function closeAccount(updateLock) {
    $('accBg').classList.remove('open');
    stopStripePaymentPoll_();
    if (updateLock !== false) updateScrollLock();
  }

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
          estado: 'pending',
          estado_pagamento: 'pago_stripe',
          estado_envio: 'pending',
          endereco: [state.form.addr, state.form.zip, state.form.city].filter(Boolean).join(', '),
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
    if (v !== 'addresses') state.editingAddressId = '';
    if (state.token && v === 'addresses') {
      loadClientAddresses().then(renderAccount);
      return;
    }
    if (state.token && v === 'wishlist') {
      loadWishlistServer().then(renderAccount);
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
      '<button type="button" class="btn-pay" style="width:100%;" onclick="Shop.login()">' + esc(a.loginBtn) + '</button>' +
      googleSignInBoxHtml_();
  }

  function termsAcceptLabelHtml() {
    var a = accT();
    var privacy = '<a href="' + esc(legalPageHref('privacy')) + '" target="_blank" rel="noopener noreferrer" class="acc-legal-link">' + esc(a.privacyLinkText || 'Privacy') + '</a>';
    var terms = '<a href="#" onclick="event.preventDefault();Shop.openInfo(\'terms\')" class="acc-legal-link">' + esc(a.termsLinkText || 'Terms') + '</a>';
    var html = a.termsWithLink || a.terms || '';
    return String(html).replace(/\{\{privacyLink\}\}/g, privacy).replace(/\{\{termsLink\}\}/g, terms);
  }

  function checkoutTermsLabelHtml() {
    var a = accT();
    var tm = t();
    var privacy = '<a href="' + esc(legalPageHref('privacy')) + '" target="_blank" rel="noopener noreferrer" class="acc-legal-link">' + esc(a.privacyLinkText || 'Privacy') + '</a>';
    var terms = '<a href="#" onclick="event.preventDefault();Shop.openInfo(\'terms\')" class="acc-legal-link">' + esc(a.termsLinkText || 'Terms') + '</a>';
    var html = tm.coTermsWithLink || a.termsWithLink || '';
    return String(html).replace(/\{\{privacyLink\}\}/g, privacy).replace(/\{\{termsLink\}\}/g, terms);
  }

  function renderRegisterForm() {
    var a = accT();
    var d = state.regDraft || {};
    return accountTabsHtml('register') +
      '<p class="form-title">' + esc(a.register) + '</p>' +
      '<p class="acc-hint">' + esc(a.registerIntro || '') + '</p>' +
      '<p class="acc-hint">' + esc(a.passMin) + '</p>' +
      '<div class="fgrid one">' +
      '<div class="field"><label>' + esc(a.name) + ' *</label><input id="regName" autocomplete="name" value="' + esc(d.nome || '') + '"/></div>' +
      '<div class="field"><label>' + esc(a.email) + ' *</label><input id="regEmail" type="email" autocomplete="email" value="' + esc(d.email || '') + '"/></div>' +
      '<div class="field"><label>' + esc(a.phone) + '</label><input id="regPhone" type="tel" autocomplete="tel" inputmode="tel" value="' + esc(d.telefone || '') + '"/></div>' +
      '<div class="field"><label>' + esc(a.pass) + ' *</label><input id="regPass" type="password" autocomplete="new-password"/></div>' +
      '<div class="field"><label>' + esc(a.passConfirm) + ' *</label><input id="regPass2" type="password" autocomplete="new-password"/></div></div>' +
      '<label class="acc-check"><input type="checkbox" id="regTerms"' + (d.terms ? ' checked' : '') + '/><span>' + termsAcceptLabelHtml() + '</span></label>' +
      '<label class="acc-check"><input type="checkbox" id="regNews"' + (d.newsletter ? ' checked' : '') + '/><span>' + esc(a.newsletter) + '</span></label>' +
      '<button type="button" class="btn-gold" style="width:100%;margin-top:8px;" onclick="Shop.startRegister()">' + esc(a.registerBtn) + '</button>' +
      googleSignInBoxHtml_();
  }

  function renderOtpForm() {
    var a = accT();
    return '<p class="form-title">' + esc(a.otpTitle) + '</p>' +
      '<p class="acc-hint">' + esc(a.otpHint) + ' <strong>' + esc(state.otpTarget) + '</strong></p>' +
      '<div class="field"><label>' + esc(a.otpCode || 'Code') + '</label><input id="regOtp" class="acc-otp" type="text" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code"/></div>' +
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
      '<div class="field"><label>' + esc(a.otpCode || 'Code') + '</label><input id="resetCode" class="acc-otp" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code"/></div>' +
      '<div class="field"><label>' + esc(a.pass) + '</label><input id="resetPass" type="password" autocomplete="new-password"/></div>' +
      '<div class="field"><label>' + esc(a.passConfirm) + '</label><input id="resetPass2" type="password"/></div></div>' +
      '<button type="button" class="btn-gold" style="width:100%;margin-top:8px;" onclick="Shop.confirmPasswordReset()">' + esc(a.resetBtn) + '</button>';
  }

  function renderDashboardNav(active) {
    var a = accT();
    var items = [
      { id: 'dashboard', label: a.orders },
      { id: 'wishlist', label: a.wishlist || t().wishT },
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
    var nlOn = String(p.newsletter || '').toLowerCase() === 'sim' || p.newsletter === true;
    return renderDashboardNav('profile') +
      '<p class="form-title">' + esc(a.profile) + '</p>' +
      '<div class="fgrid one">' +
      '<div class="field"><label>' + esc(a.name) + '</label><input id="profName" value="' + esc(p.nome || state.clientName || '') + '"/></div>' +
      '<div class="field"><label>' + esc(a.email) + '</label><input id="profEmail" type="email" value="' + esc(p.email || state.clientEmail || '') + '" disabled style="opacity:.6"/></div>' +
      '<div class="field"><label>' + esc(a.phone) + '</label><input id="profPhone" value="' + esc(p.telefone || state.clientPhone || '') + '"/></div>' +
      '<div class="field"><label>' + esc(a.nif || t().fNif) + '</label><input id="profNif" value="' + esc(p.nif || state.form.nif || '') + '" placeholder="123456789" maxlength="9" inputmode="numeric"/></div></div>' +
      '<label class="acc-check"><input type="checkbox" id="profNews"' + (nlOn ? ' checked' : '') + '/><span>' + esc(a.newsletter) + '</span></label>' +
      '<button type="button" class="btn-gold" style="width:100%;margin-top:8px;" onclick="Shop.saveProfile()">' + esc(a.save) + '</button>' +
      '<p class="form-title" style="margin-top:20px;">' + esc(a.changePassTitle) + '</p>' +
      '<div class="fgrid one">' +
      '<div class="field"><label>' + esc(a.oldPass) + '</label><input id="profOldPass" type="password" autocomplete="current-password"/></div>' +
      '<div class="field"><label>' + esc(a.newPass) + '</label><input id="profNewPass" type="password" autocomplete="new-password"/></div>' +
      '<div class="field"><label>' + esc(a.passConfirm) + '</label><input id="profNewPass2" type="password" autocomplete="new-password"/></div></div>' +
      '<button type="button" class="btn-pay" style="width:100%;" onclick="Shop.changeClientPassword()">' + esc(a.changePassBtn) + '</button>';
  }

  function renderWishlistPanel() {
    var a = accT();
    var boxId = 'accWishList';
    setTimeout(function () { renderAccountWishlist(boxId); }, 0);
    return renderDashboardNav('wishlist') + '<div id="' + boxId + '"><p class="acc-hint">' + esc(a.loading) + '</p></div>';
  }

  function renderAccountWishlist(containerId) {
    var box = $(containerId || 'accWishList');
    if (!box) return;
    var a = accT();
    if (!state.wish.length) {
      box.innerHTML = '<p class="acc-hint">' + esc(a.wishEmptyAcc || t().wishEmpty) + '</p>';
      return;
    }
    box.innerHTML = state.wish.map(function (it) {
      var pid = esc(it.id).replace(/'/g, "\\'");
      return '<div class="ci acc-wish-item">' + imgHtml(it.img, nm(it), { fallback: it.imgMd || it.img }) +
        '<div class="ci-body"><div><p class="ci-name">' + esc(nm(it)) + '</p><p class="ci-price" style="margin-top:5px;">' + it.price.toFixed(2) + ' €</p></div>' +
        '<div class="ci-bot"><button type="button" class="btn-gold" style="font-size:8px;padding:8px 10px;" onclick="Shop.addWishlistToCart(\'' + pid + '\')">' + esc(t().addCart) + '</button>' +
        '<button type="button" class="btn-rm" onclick="Shop.toggleWish(\'' + pid + '\');Shop.renderAccountWishlist(\'' + esc(containerId || 'accWishList') + '\')">' + esc(t().remove) + '</button></div></div></div>';
    }).join('');
  }

  function renderAddressesPanel() {
    var a = accT();
    var editing = state.editingAddressId || '';
    var editAd = editing ? (state.addresses || []).find(function (ad) { return ad.address_id === editing; }) : null;
    var list = (state.addresses || []).map(function (ad) {
      var aid = esc(ad.address_id).replace(/'/g, "\\'");
      return '<div class="acc-addr"><strong>' + esc(ad.tipo || 'envio') + '</strong><br>' +
        esc(ad.morada) + '<br>' + esc(ad.codigo_postal) + ' ' + esc(ad.cidade) + ', ' + esc(ad.pais || '') +
        '<div class="acc-addr-actions">' +
        '<button type="button" class="btn-ghost-sm" onclick="Shop.useAddress(\'' + aid + '\')">' + esc(a.useAddr) + '</button>' +
        '<button type="button" class="btn-ghost-sm" onclick="Shop.startEditAddress(\'' + aid + '\')">' + esc(a.editAddr) + '</button>' +
        '<button type="button" class="btn-ghost-sm" onclick="Shop.deleteAddress(\'' + aid + '\')">' + esc(a.delete) + '</button></div></div>';
    }).join('');
    var formTitle = editing ? (a.editAddr + ' — ' + esc(editAd && editAd.tipo || 'envio')) : a.addAddr;
    var moradaVal = editing && editAd ? editAd.morada : '';
    var zipVal = editing && editAd ? editAd.codigo_postal : '';
    var cityVal = editing && editAd ? editAd.cidade : '';
    var countryVal = editing && editAd ? (editAd.pais || 'Portugal') : 'Portugal';
    return renderDashboardNav('addresses') + list +
      '<p class="form-title" style="margin-top:16px;">' + esc(formTitle) + '</p>' +
      '<div class="fgrid one">' +
      '<div class="field"><label>' + esc(a.addrLabel) + '</label><input id="addrMorada" value="' + esc(moradaVal) + '"/></div>' +
      '<div class="fgrid"><div class="field"><label>' + esc(a.zip) + '</label><input id="addrZip" value="' + esc(zipVal) + '"/></div>' +
      '<div class="field"><label>' + esc(a.city) + '</label><input id="addrCity" value="' + esc(cityVal) + '"/></div></div>' +
      '<div class="field"><label>' + esc(a.country) + '</label><input id="addrCountry" value="' + esc(countryVal) + '" placeholder="Portugal / France"/></div></div>' +
      (editing ? '<button type="button" class="btn-ghost-sm" style="width:100%;margin-bottom:8px;" onclick="Shop.cancelEditAddress()">' + esc(a.cancelEdit) + '</button>' : '') +
      '<button type="button" class="btn-gold" style="width:100%;margin-top:8px;" onclick="Shop.saveNewAddress()">' + esc(editing ? a.save : a.save) + '</button>';
  }

  function isOrderEligibleForReview_(o) {
    if (!o) return false;
    var estado = String(o.estado || '').toLowerCase();
    if (estado === 'cancelado' || estado === 'cancelled' || estado === 'canceled') return false;
    var ship = String(o.estado_envio || '').toLowerCase();
    return estado === 'delivered' || estado === 'entregue' || estado === 'entregada' ||
      ship === 'delivered' || ship === 'entregue' || ship === 'entregada';
  }

  function captureReviewDeepLink_() {
    try {
      var sp = new URLSearchParams(global.location.search || '');
      var pid = (sp.get('review') || '').trim();
      if (!pid) return;
      state.pendingReview = {
        produtoId: pid,
        orderId: (sp.get('order') || '').trim()
      };
    } catch (e) { /* ignore */ }
  }

  function clearReviewQueryFromUrl_() {
    try {
      var u = new URL(global.location.href);
      u.searchParams.delete('review');
      u.searchParams.delete('order');
      var qs = u.searchParams.toString();
      global.history.replaceState({}, '', u.pathname + (qs ? '?' + qs : '') + (u.hash || ''));
    } catch (e) { /* ignore */ }
  }

  async function processPendingReviewDeepLink_() {
    var pr = state.pendingReview;
    if (!pr || !pr.produtoId) return;
    if (!state.token) {
      state.accountView = 'login';
      if ($('accBg')) {
        $('accBg').classList.add('open');
        renderAccount();
        updateScrollLock();
      }
      return;
    }
    state.pendingReview = null;
    clearReviewQueryFromUrl_();
    if (pr.produtoId && pr.orderId) await openReviewForProduct(pr.produtoId);
    else if (pr.orderId) await openOrderDetail(pr.orderId);
    else await openReviewForProduct(pr.produtoId);
  }

  function canReviewProduct_(produtoId) {
    var e = state.reviewEligibility[String(produtoId || '')];
    return !!(e && e.canReview);
  }

  function hasReviewProduct_(produtoId) {
    var e = state.reviewEligibility[String(produtoId || '')];
    return !!(e && e.hasReview);
  }

  async function fetchReviewEligibility(produtoIds) {
    if (!state.token || !produtoIds || !produtoIds.length) return;
    try {
      var res = await erpCall('getClientReviewEligibility', { produtoIds: produtoIds }, state.token);
      if (res && res.success && res.products) {
        Object.keys(res.products).forEach(function (pid) {
          state.reviewEligibility[pid] = res.products[pid];
        });
      }
    } catch (e) { /* ignore */ }
  }

  async function openReviewForProduct(produtoId) {
    produtoId = String(produtoId || '').trim();
    if (!produtoId) return;
    if (!state.token) {
      global.toast(t().reviewLoginHint || accT().loginRequired, 'e');
      return;
    }
    if ($('accBg')) $('accBg').classList.remove('open');
    state.qvOpenReviewsTab = true;
    await openQv(produtoId);
  }

  function renderOrderDetail(o, details) {
    var a = accT();
    var lines = (details || []).map(function (d) {
      var meta = [];
      if (normalizeOptionValue(d.tamanho)) meta.push(t().sizeMeta + ': ' + d.tamanho);
      if (normalizeOptionValue(d.cor)) meta.push(t().colorMeta + ': ' + colorDisplayName(d.cor));
      var pid = String(d.produto_id || '').trim();
      var reviewHtml = '';
      if (state.token && pid && isOrderEligibleForReview_(o)) {
        if (hasReviewProduct_(pid)) {
          var eligRv = state.reviewEligibility[pid];
          var rvMsg = (eligRv && eligRv.reviewStatus === 'pendente')
            ? (a.reviewPending || t().reviewPendingModeration || t().reviewThanks || '')
            : (a.reviewDone || t().reviewAlreadyDone || '');
          reviewHtml = '<br><span style="font-size:9px;color:var(--gold);">' + esc(rvMsg) + '</span>';
        } else if (canReviewProduct_(pid)) {
          reviewHtml = '<br><button type="button" class="btn-ghost-sm" style="margin-top:6px;font-size:9px;" onclick="Shop.openReviewForProduct(\'' + esc(pid).replace(/'/g, "\\'") + '\')">' + esc(a.reviewBtn || t().reviewBtn || 'Review') + '</button>';
        }
      }
      return '<li><strong>' + esc(d.nome_produto || d.produto_id) + '</strong> × ' + esc(d.quantidade) + ' — ' + esc(d.preco) + ' €' +
        (meta.length ? '<br><span style="font-size:9px;color:var(--muted);">' + esc(meta.join(' · ')) + '</span>' : '') +
        reviewHtml + '</li>';
    }).join('');
    var backView = (state.token && state.clientId) ? 'dashboard' : 'track';
    var stripePayBlock = '';
    if (isPendingStripeOrder_(o) && isStripeOn()) {
      var showRetryPanel = state.stripeRetryOrderId === o.pedido_id;
      stripePayBlock = '<div class="order-stripe-pay" style="margin:14px 0;padding:14px;border:1px solid var(--border-hard);border-radius:3px;">' +
        '<p style="font-size:10px;margin-bottom:10px;color:var(--gold);">' + esc(t().stripePayPending || 'Pagamento pendente — conclua o pagamento abaixo.') + '</p>';
      if (!showRetryPanel) {
        stripePayBlock += '<button type="button" class="btn-gold" style="width:100%;margin-bottom:8px;" onclick="Shop.openStripeRetryPay(\'' + esc(o.pedido_id).replace(/'/g, "\\'") + '\',\'' + esc(String(parseFloat(o.total || 0).toFixed(2))) + '\')">' + esc(t().stripePayNow || 'Pagar agora (Stripe)') + '</button>' +
          '<button type="button" class="btn-order-secondary" style="width:100%;" onclick="Shop.cancelPendingOrder(\'' + esc(o.pedido_id).replace(/'/g, "\\'") + '\')">' + esc(t().stripeCancelOrder || 'Cancelar encomenda') + '</button>';
      } else {
        stripePayBlock += stripeRetryPaymentOptionsHtml_() +
          '<div id="stripe-retry-element" style="margin:10px 0;"></div>' +
          '<button type="button" class="btn-pay" id="btnStripeRetry" onclick="Shop.submitStripeRetryPayment()" ' + (state.checkoutBusy ? 'disabled' : '') + '>' +
          esc(state.checkoutBusy ? (t().payProcessing || 'A processar…') : (t().stripePayNow || 'Pagar agora')) + '</button>' +
          '<button type="button" class="btn-order-secondary" style="width:100%;margin-top:8px;" onclick="Shop.cancelStripeRetry()">' + esc(t().backBtn) + '</button>';
      }
      stripePayBlock += '</div>';
    }
    return '<button type="button" class="acc-link" style="margin-bottom:12px;" onclick="Shop.setAccountView(\'' + backView + '\')">← ' + esc(a.back) + '</button>' +
      '<p class="acc-order-id">#' + esc(o.pedido_id) + '</p>' +
      '<p style="font-size:10px;color:var(--muted);margin:8px 0;">' + esc(o.data) + '</p>' +
      '<p style="font-size:10px;"><strong>' + esc(a.total) + ':</strong> ' + esc(o.total) + ' € · <strong>' + esc(a.status) + ':</strong> ' + esc(orderStateLabel_(o.estado)) + '</p>' +
      '<p style="font-size:10px;"><strong>' + esc(a.pay) + ':</strong> ' + esc(orderStateLabel_(o.estado_pagamento)) + ' · <strong>' + esc(a.ship) + ':</strong> ' + esc(orderStateLabel_(o.estado_envio)) + '</p>' +
      (o.tracking_number ? '<p style="font-size:10px;"><strong>' + esc(a.tracking) + ':</strong> ' + esc(o.tracking_number) + (o.transportadora ? ' (' + esc(o.transportadora) + ')' : '') + '</p>' : '') +
      (o.fiscal_doc_url ? '<p style="font-size:10px;margin:8px 0;"><a href="' + esc(o.fiscal_doc_url) + '" target="_blank" rel="noopener noreferrer" class="acc-legal-link">' + esc(a.fiscalDocLink || t().receiptDownload || 'PDF') + '</a>' +
        (o.fiscal_doc_ref ? ' <span style="color:var(--muted);">(' + esc(o.fiscal_doc_ref) + ')</span>' : '') + '</p>' : '') +
      stripePayBlock +
      orderTrackingHtml(o) +
      (state.clientId && state.token ? renderReturnRequestBlock(o) : '') +
      '<div class="receipt-inline" style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;"><button type="button" class="btn-rc" style="flex:1;min-width:120px;" onclick="Shop.printOrderInvoice(\'' + esc(o.pedido_id).replace(/'/g, "\\'") + '\')">' + esc(t().receiptPrint || 'Imprimer le reçu') + '</button>' +
      '<button type="button" class="btn-rc btn-rc-ghost" style="flex:1;min-width:120px;" onclick="Shop.downloadOrderInvoice(\'' + esc(o.pedido_id).replace(/'/g, "\\'") + '\')">' + esc(t().receiptDownload || 'Descarregar PDF') + '</button></div>' +
      '<ul style="list-style:none;padding:12px 0 0;font-size:10px;color:var(--muted);">' + lines + '</ul>';
  }

  function renderReturnRequestBlock(o) {
    var a = accT();
    var oid = esc(o.pedido_id).replace(/'/g, "\\'");
    if (state.returnFormOrderId === o.pedido_id) {
      return '<div class="order-return-form" style="margin:14px 0;padding:14px;border:1px solid var(--border-hard);border-radius:3px;">' +
        '<p class="form-title">' + esc(a.returnTitle || 'Return') + '</p>' +
        '<div class="field"><label>' + esc(a.returnReason) + '</label><input id="retReasonIn" type="text"/></div>' +
        '<div class="field"><label>' + esc(a.returnNotes) + '</label><textarea id="retNotesIn" rows="2"></textarea></div>' +
        '<button type="button" class="btn-gold" style="width:100%;margin-top:8px;" onclick="Shop.submitClientReturn(\'' + oid + '\')">' + esc(a.returnSubmit) + '</button>' +
        '<button type="button" class="btn-ghost-sm" style="width:100%;margin-top:6px;" onclick="Shop.cancelReturnForm()">' + esc(a.back) + '</button></div>';
    }
    return '<button type="button" class="btn-order-secondary" style="width:100%;margin-top:10px;" onclick="Shop.openReturnForm(\'' + oid + '\')">' + esc(a.returnBtn || 'Return') + '</button>';
  }

  function openReturnForm(orderId) {
    if (!state.clientId || !state.token) {
      global.toast(accT().returnLogin || accT().loginRequired, 'e');
      return;
    }
    state.returnFormOrderId = orderId;
    renderAccount();
  }

  function cancelReturnForm() {
    state.returnFormOrderId = '';
    renderAccount();
  }

  async function submitClientReturn(orderId) {
    orderId = String(orderId || '').trim();
    if (!orderId || !state.token) return;
    var reason = $('retReasonIn') ? String($('retReasonIn').value || '').trim() : '';
    var notes = $('retNotesIn') ? String($('retNotesIn').value || '').trim() : '';
    if (!reason) {
      global.toast(accT().fieldsRequired || t().tReq, 'e');
      return;
    }
    try {
      var res = await erpCall('createClientReturn', { order_id: orderId, reason: reason, notes: notes }, state.token);
      if (!res || !res.success) {
        global.toast((res && res.error) || t().errGeneric || 'Error', 'e');
        return;
      }
      global.toast(accT().returnThanks || t().reviewThanks, 's');
      state.returnFormOrderId = '';
      renderAccount();
    } catch (e) { global.toast(e.message, 'e'); }
  }

  function renderLoggedIn() {
    var a = accT();
    var view = state.accountView;
    if (view === 'orderDetail' && state.selectedOrder) {
      return '<div class="acc-wrap"><h2 class="acc-section-h">' + esc(a.orderDetail) + '</h2>' +
        renderOrderDetail(state.selectedOrder.order, state.selectedOrder.details) + '</div>';
    }
    var panel = '';
    if (view === 'profile') panel = renderProfilePanel();
    else if (view === 'addresses') panel = renderAddressesPanel();
    else if (view === 'wishlist') panel = renderWishlistPanel();
    else panel = renderOrdersPanel();
    return '<div class="acc-wrap">' +
      '<h2 class="acc-welcome">' + esc(a.welcome) + ', ' + esc(state.clientName || '') + '</h2>' +
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
      body.innerHTML = '<div class="acc-wrap"><h2 class="acc-section-h">' + esc(a.orderDetail) + '</h2>' +
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
    body.innerHTML = '<div class="acc-wrap"><h2 class="acc-section-h">' + esc(a.title) + '</h2>' + inner + '</div>';
    if (state.accountView === 'login' || state.accountView === 'register' || !state.accountView) {
      setTimeout(mountGoogleButton_, 0);
    }
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
      var res = await erpCall('clientLogin', { email: email, password: password, device: loginDeviceLabel() });
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
      await processPendingReviewDeepLink_();
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
    if (state.registerInFlight) return;
    var a = accT();
    var d = collectRegisterDraft();
    state.regDraft = d;
    saveRegDraftToStorage();
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
    state.registerInFlight = true;
    try {
      var otpRes = await erpCall('sendRegistrationOTP', { target: d.email, lang: state.lang });
      if (!otpRes || !otpRes.success) {
        global.toast((otpRes && otpRes.error) || 'OTP', 'e');
        return;
      }
      state.otpTarget = d.email;
      saveRegDraftToStorage();
      state.accountView = 'otp';
      renderAccount();
      global.toast(a.codeSent, 's');
    } catch (e) { global.toast(e.message, 'e'); }
    finally { state.registerInFlight = false; }
  }

  async function resendRegisterOtp() {
    if (!state.regDraft || !state.otpTarget) {
      setAccountView('register');
      return;
    }
    await startRegister();
  }

  async function verifyRegisterOtp() {
    if (state.registerInFlight) return;
    var a = accT();
    var code = normalizeOtp($('regOtp') && $('regOtp').value);
    var d = state.regDraft;
    if (!d || !state.otpTarget || code.length < 6) {
      global.toast(a.fieldsRequired, 'e');
      return;
    }
    state.registerInFlight = true;
    try {
      var res = await erpCall('verifyRegistrationOTP', {
        target: state.otpTarget,
        code: code,
        lang: state.lang,
        device: loginDeviceLabel(),
        userData: {
          nome: d.nome,
          email: d.email,
          telefone: d.telefone,
          password: d.password,
          newsletter: d.newsletter,
          lang: state.lang,
          device: loginDeviceLabel()
        }
      });
      if (!res || !res.success) {
        global.toast((res && res.error) || 'OTP', 'e');
        return;
      }
      applySessionFromAuth(res, d.nome, d.email);
      state.clientPhone = d.telefone;
      state.accountView = 'dashboard';
      clearRegDraftStorage();
      await loadClientProfile();
      await loadWishlistServer();
      prefillCheckoutFromProfile();
      renderAccount();
      global.toast(a.created, 's');
      await processPendingReviewDeepLink_();
    } catch (e) { global.toast(e.message, 'e'); }
    finally { state.registerInFlight = false; }
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
      var payload = isEmail ? { email: normEmail(raw), lang: state.lang } : { telefone: raw, lang: state.lang };
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
    clearRegDraftStorage();
    saveSession();
    renderAccount();
    if (!silent) global.toast(accT().logout, 'i');
  }

  async function saveProfile() {
    var a = accT();
    var nome = ($('profName') && $('profName').value.trim()) || '';
    var telefone = ($('profPhone') && $('profPhone').value.trim()) || '';
    var nif = ($('profNif') && $('profNif').value.trim()) || '';
    var newsletter = !!($('profNews') && $('profNews').checked);
    if (!nome) {
      global.toast(a.fieldsRequired, 'e');
      return;
    }
    try {
      var res = await erpCall('updateClient', {
        clientId: state.clientId,
        nome: nome,
        telefone: telefone,
        nif: nif,
        newsletter: newsletter
      }, state.token);
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Profile', 'e');
        return;
      }
      state.clientName = nome;
      state.clientPhone = telefone;
      state.form.nif = nif;
      if (state.profile) {
        state.profile.nome = nome;
        state.profile.telefone = telefone;
        state.profile.nif = nif;
        state.profile.newsletter = newsletter ? 'sim' : 'nao';
      }
      saveSession();
      prefillCheckoutFromProfile();
      global.toast(a.profileSaved, 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  async function changeClientPassword() {
    var a = accT();
    var oldP = $('profOldPass') ? String($('profOldPass').value || '') : '';
    var newP = $('profNewPass') ? String($('profNewPass').value || '') : '';
    var newP2 = $('profNewPass2') ? String($('profNewPass2').value || '') : '';
    if (!oldP || !newP || !newP2) {
      global.toast(a.fieldsRequired, 'e');
      return;
    }
    if (newP.length < 8) {
      global.toast(a.passMin, 'e');
      return;
    }
    if (newP !== newP2) {
      global.toast(a.passMismatch, 'e');
      return;
    }
    try {
      var res = await erpCall('changeClientPassword', {
        clientId: state.clientId,
        oldPassword: oldP,
        newPassword: newP
      }, state.token);
      if (!res || !res.success) {
        var err = (res && res.error) || 'Error';
        if (res && res.code === 'WRONG_PASSWORD') err = a.wrongPass || err;
        global.toast(err, 'e');
        return;
      }
      if ($('profOldPass')) $('profOldPass').value = '';
      if ($('profNewPass')) $('profNewPass').value = '';
      if ($('profNewPass2')) $('profNewPass2').value = '';
      global.toast(a.passChanged, 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  function startEditAddress(addressId) {
    state.editingAddressId = String(addressId || '');
    renderAccount();
  }

  function cancelEditAddress() {
    state.editingAddressId = '';
    renderAccount();
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
      var wasEdit = !!state.editingAddressId;
      var payload = {
        clientId: state.clientId,
        tipo: 'envio',
        morada: morada,
        cidade: cidade,
        codigo_postal: zip,
        pais: pais
      };
      if (state.editingAddressId) payload.address_id = state.editingAddressId;
      var res = await erpCall('saveClientAddress', payload, state.token);
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Address', 'e');
        return;
      }
      state.editingAddressId = '';
      await loadClientAddresses();
      renderAccount();
      global.toast(wasEdit ? (a.addrUpdated || a.addrSaved) : a.addrSaved, 's');
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

  function formatAccOrderDate_(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (s.length >= 10 && s.charAt(4) === '-' && s.charAt(7) === '-') {
      return s.slice(0, 10).split('-').reverse().join('/');
    }
    return s.length > 16 ? s.slice(0, 16) : s;
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
        var meta = esc(formatAccOrderDate_(o.data)) + ' · ' + esc(o.total) + ' €';
        var status = esc(orderStateLabel_(o.estado)) + ' · ' + esc(orderStateLabel_(o.estado_pagamento));
        return '<div class="acc-order">' +
          '<div class="acc-order-main" onclick="Shop.openOrderDetail(\'' + oid + '\')">' +
          '<div class="acc-order-id">#' + esc(o.pedido_id) + '</div>' +
          '<p class="acc-order-meta">' + meta + '</p>' +
          '<p class="acc-order-status">' + status + '</p></div>' +
          '<div class="acc-order-actions">' +
          '<button type="button" class="btn-rc btn-rc-mini" onclick="event.stopPropagation();Shop.printOrderInvoice(\'' + oid + '\')">' + esc(t().receiptPrint || 'Imprimir') + '</button>' +
          '<button type="button" class="btn-rc btn-rc-mini" onclick="event.stopPropagation();Shop.downloadOrderInvoice(\'' + oid + '\')">' + esc(t().receiptDownload || 'PDF') + '</button></div></div>';
      }).join('');
    } catch (e) { box.textContent = e.message; }
  }

  async function openOrderDetail(orderId) {
    orderId = String(orderId || '').trim();
    if (!orderId) return;
    try {
      var res = await erpCall('getOrder', orderAccessPayload({ orderId: orderId }), state.token);
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Order', 'e');
        return;
      }
      state.selectedOrder = { order: res.order, details: res.details || [] };
      state.accountView = 'orderDetail';
      var pids = (res.details || []).map(function (d) { return String(d.produto_id || '').trim(); }).filter(Boolean);
      if (state.token && pids.length) await fetchReviewEligibility(pids);
      if (isPendingStripeOrder_(res.order)) startStripePaymentPoll_(orderId);
      else stopStripePaymentPoll_();
      if ($('accBg')) $('accBg').classList.add('open');
      renderAccount();
      if (state.stripeRetryOrderId === orderId) scheduleStripeRetryMount_();
    } catch (e) { global.toast(e.message, 'e'); }
  }

  // ─── Contact ───────────────────────────────────────────────────────────
  function contactT() { return t().contact || {}; }

  function contactEmailPublic() {
    var emp = state.store && state.store.empresa;
    return state.config.contact_public_email || state.config.store_email ||
      (emp && emp.email) || DEFAULT_CONTACT_EMAIL;
  }

  function contactComplaintEmail() {
    return state.config.contact_complaint_email || DEFAULT_COMPLAINT_EMAIL;
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

  function contactWhatsAppUrl(message) {
    var wa = state.config.contact_whatsapp || '';
    if (!wa) return '';
    var base = '';
    if (String(wa).indexOf('http') === 0) base = wa.split('?')[0];
    else {
      var digits = String(wa).replace(/\D/g, '');
      base = digits ? 'https://wa.me/' + digits : '';
    }
    if (!base) return '';
    if (message) return base + '?text=' + encodeURIComponent(String(message));
    return base;
  }

  function openContact() {
    state.contactSent = false;
    capturePageScroll();
    $('contactBg').classList.add('open');
    renderContact();
    updateScrollLock();
  }

  function closeContact(updateLock) {
    $('contactBg').classList.remove('open');
    if (updateLock !== false) updateScrollLock();
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
    var complaintEmail = contactComplaintEmail();
    var waUrl = contactWhatsAppUrl();
    var phone = contactPhonePublic();
    var phoneUrl = contactPhoneTelUrl();
    var quick = '';
    if (pubEmail || complaintEmail || waUrl || phone) {
      quick = '<p class="acc-hint" style="margin-top:8px;">' + esc(c.or) + '</p><div class="contact-quick">';
      if (pubEmail) {
        quick += '<a href="mailto:' + esc(pubEmail) + '">✉ ' + esc(c.emailUs) + '</a>';
      }
      if (complaintEmail) {
        quick += '<a href="mailto:' + esc(complaintEmail) + '">⚖ ' + esc(c.complaintEmailUs || 'E-mail de reclamações') + '</a>';
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
      { v: 'complaint', l: c.subjectComplaint },
      { v: 'other', l: c.subjectOther }
    ];
    var subjHtml = subjects.map(function (s) {
      return '<option value="' + esc(s.v) + '">' + esc(s.l) + '</option>';
    }).join('');
    body.innerHTML =
      '<div class="acc-wrap">' +
      '<h2 class="co-title">' + esc(c.title) + '</h2>' +
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
    else if (subjKey === 'complaint') subjLabel = c.subjectComplaint;
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
      var res = await erpCall('sendContactMessage', { name: nome, email: email, message: fullMsg, subject: subjKey });
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

  function legalVars() {
    var emp = (state.store && state.store.empresa) || {};
    var storeName = emp.nome || (state.store && state.store.storeName) || state.config.site_name || 'AZAVISION';
    var email = emp.email || contactEmailPublic() || DEFAULT_CONTACT_EMAIL;
    var phone = emp.telefone || contactPhonePublic() || '';
    var morada = String(emp.morada || '').trim();
    var cidade = String(emp.cidade || '').trim();
    var pais = String(emp.pais || 'Portugal').trim() || 'Portugal';
    var nif = String(emp.nif || '').trim();
    var address = [morada, cidade, pais].filter(Boolean).join(', ');
    return {
      storeName: String(storeName).trim(),
      email: String(email).trim(),
      country: pais,
      nif: nif,
      phone: phone,
      morada: morada,
      cidade: cidade,
      address: address || pais,
      livroUrl: 'https://www.livroreclamacoes.pt/Inicio/'
    };
  }

  function fillLegalText(text, vars) {
    return String(text || '')
      .replace(/\{\{storeName\}\}/g, vars.storeName)
      .replace(/\{\{email\}\}/g, vars.email)
      .replace(/\{\{country\}\}/g, vars.country)
      .replace(/\{\{nif\}\}/g, vars.nif || '—')
      .replace(/\{\{phone\}\}/g, vars.phone || vars.email)
      .replace(/\{\{morada\}\}/g, vars.morada || '—')
      .replace(/\{\{address\}\}/g, vars.address || vars.country)
      .replace(/\{\{livroUrl\}\}/g, vars.livroUrl || 'https://www.livroreclamacoes.pt/Inicio/');
  }

  var LS_COOKIE_CONSENT = 'azav_cookie_consent';

  function getCookieConsent() {
    try { return localStorage.getItem(LS_COOKIE_CONSENT) || ''; } catch (e) { return ''; }
  }

  function setCookieConsent(value) {
    try { localStorage.setItem(LS_COOKIE_CONSENT, value); } catch (e2) { /* ignore */ }
  }

  function hideCookieBanner() {
    var el = $('cookieBanner');
    if (!el) return;
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  }

  function renderCookieBanner() {
    var el = $('cookieBanner');
    if (!el) return;
    var tm = t();
    var title = $('cookieBannerTitle');
    var text = $('cookieBannerText');
    var acceptBtn = $('cookieAcceptBtn');
    var essentialBtn = $('cookieEssentialBtn');
    var policyLink = $('cookiePolicyLink');
    if (title) title.textContent = tm.cookieTitle || 'Cookies';
    if (text) text.textContent = tm.cookieText || '';
    if (acceptBtn) acceptBtn.textContent = tm.cookieAccept || 'Accept';
    if (essentialBtn) essentialBtn.textContent = tm.cookieEssential || 'Essential only';
    if (policyLink) {
      policyLink.textContent = tm.cookiePolicy || 'Privacy';
      if (isExternalLegalPage('privacy')) {
        policyLink.href = legalPageHref('privacy');
        policyLink.onclick = null;
      } else {
        policyLink.href = '#';
        policyLink.onclick = function (ev) { ev.preventDefault(); openLegal('privacy'); };
      }
    }
  }

  function initCookieBanner() {
    if (getCookieConsent()) {
      hideCookieBanner();
      return;
    }
    var el = $('cookieBanner');
    if (!el) return;
    renderCookieBanner();
    el.style.display = '';
    el.setAttribute('aria-hidden', 'false');
  }

  function acceptAllCookies() {
    setCookieConsent('all');
    hideCookieBanner();
  }

  function acceptEssentialCookies() {
    setCookieConsent('essential');
    hideCookieBanner();
  }

  function renderLegal(pageKey) {
    renderInfoHub(pageKey || state.legalPage || 'privacy');
  }

  function openLegal(pageKey) {
    if (isExternalLegalPage(pageKey || 'privacy')) {
      global.location.href = legalPageHref(pageKey || 'privacy');
      return;
    }
    openInfo(pageKey || 'privacy');
  }

  function closeLegal() {
    closeInfo();
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
    if (isHeroMotionCanvasOn()) applyBrandUi();
    if (isStripePayMethod_(state.payMethod) && $('coBg') && $('coBg').classList.contains('open') && !state.ordered) {
      state.stripeAmountCents = 0;
      destroyStripeElement();
      scheduleStripeMount_();
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────
  function bindScrollPreserve() {
    if (document.documentElement.dataset.scrollPreserveBound === '1') return;
    document.documentElement.dataset.scrollPreserveBound = '1';
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    document.addEventListener('click', function (ev) {
      if (document.body.classList.contains('scroll-lock')) return;
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.closest('.card, .btn-qv, .btn-add-ov, .nav-info-btn, .nav-info-link, .f-legal a, #fSuppL a, .contact-fab, .icon-btn, .mob-bar button, .nav-ul button, .m-img-zoom, .qv-gthumb')) {
        capturePageScroll();
      }
    }, true);
  }

  async function init() {
    state.theme = getTheme();
    setVitrinePending(true);
    bindScrollPreserve();
    loadSession();
    bindImageZoomEvents();
    showApiBanner(!apiUrlConfigured());
    state.loading = false;

    if (!apiUrlConfigured()) {
      state.productsLoading = false;
      markStoreConfigReady();
      if (global.boot) global.boot();
      renderNav();
      renderFooterShop();
      renderFooterSupport();
      renderFooterLegal();
      initCookieBanner();
      render();
      return;
    }

    state.productsLoading = true;
    tryRestoreCatalogCache();
    if (global.boot) global.boot();
    renderNav();
    renderFooterShop();
    renderFooterSupport();
    renderFooterLegal();
    initCookieBanner();
    render();

    pingApi().then(function (ok) {
      if (!ok) showApiBanner(true);
      else showApiBanner(false);
    }).catch(function () { showApiBanner(true); });

    loadStore().then(function () {
      state.storeLoading = false;
      if (cfgOn('maintenance_mode', false)) {
        var msg = state.config.maintenance_message || t().maintenanceDefault || 'Boutique en maintenance. Revenez bientôt.';
        document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:\'Montserrat\',sans-serif;text-align:center;"><div><h1 style="font-family:\'Cormorant Garamond\',serif;font-size:28px;font-weight:300;margin-bottom:12px;">AZAVISION</h1><p style="font-size:11px;line-height:1.6;color:#666;max-width:420px;">' + esc(msg) + '</p></div></div>';
        return;
      }
      if (global.boot) global.boot();
      applyBrandUi();
      applyPromoBanner();
      renderNav();
      renderFooterShop();
    }).catch(function () {
      state.storeLoading = false;
      markStoreConfigReady();
      applyPromoBanner();
      applyVitrineContent(state.lang);
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
    captureReviewDeepLink_();
    if (state.token) restoreClientSession().then(function () { return processPendingReviewDeepLink_(); }).catch(function () { /* ignore */ });
    else if (state.pendingReview) processPendingReviewDeepLink_();
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
    if ($('infoBg') && $('infoBg').classList.contains('open')) renderInfoHub(state.infoPage || 'returns');
    if ($('soEl') && $('soEl').classList.contains('open')) renderSearchSuggestions();
    renderNav();
    renderFooterShop();
    renderFooterSupport();
    renderFooterLegal();
    if (!getCookieConsent()) renderCookieBanner();
  }

  function diagnoseStripe() {
    refreshStripePk_();
    var pk = getStripePk_();
    console.group('[AZAVISION] Diagnostic Stripe');
    console.log('STRIPE_PK définie :', !!pk);
    console.log('STRIPE_PK (12 premiers chars) :', pk ? pk.slice(0, 12) + '...' : 'VIDE');
    console.log('global.Stripe chargé :', typeof global.Stripe === 'function');
    console.log('isStripeOn() :', isStripeOn());
    console.log('pay_stripe_enabled (config) :', state.config.pay_stripe_enabled);
    console.log('pay_show_stripe (config) :', state.config.pay_show_stripe);
    console.log('state.stripe initialisé :', !!state.stripe);
    console.log('state.stripeElements :', !!state.stripeElements);
    console.log('Montant checkout (cents) :', stripeAmountCents_());
    console.groupEnd();
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
    renderFooterSupport: renderFooterSupport,
    renderFooterLegal: renderFooterLegal,
    toggleMobileNav: toggleMobileNav,
    closeMobileNav: closeMobileNav,
    updateScrollLock: updateScrollLock,
    openOrdersOrLogin: openOrdersOrLogin,
    trackGuestOrder: trackGuestOrder,
    refreshProducts: refreshProducts,
    refreshProductsDebounced: refreshProductsDebounced,
    openSearchOverlay: openSearchOverlay,
    closeSearchOverlay: closeSearchOverlay,
    applySearch: applySearch,
    clearSearch: clearSearch,
    clearActiveFilters: clearActiveFilters,
    pickSearchChip: pickSearchChip,
    syncSearchFromOverlay: syncSearchFromOverlay,
    handleSearchOverlayKey: handleSearchOverlayKey,
    loadMoreProducts: loadMoreProducts,
    renderCats: renderCats,
    render: render,
    addCart: addCart,
    addCartFromQv: addCartFromQv,
    openCartFromQv: openCartFromQv,
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
    setQvInfoTab: setQvInfoTab,
    qvGalleryPrev: qvGalleryPrev,
    qvGalleryNext: qvGalleryNext,
    toggleQvGuide: toggleQvGuide,
    openCo: openCo,
    closeCo: closeCo,
    setForm: setForm,
    setPayMethod: setPayMethod,
    setStripeRetryPayMethod: setStripeRetryPayMethod,
    printInvoice: printInvoice,
    loadOrderReceipt: loadOrderReceipt,
    downloadInvoice: downloadInvoice,
    printOrderInvoice: printOrderInvoice,
    downloadOrderInvoice: downloadOrderInvoice,
    submitOrder: submitOrder,
    openStripeRetryPay: openStripeRetryPay,
    submitStripeRetryPayment: submitStripeRetryPayment,
    cancelStripeRetry: cancelStripeRetry,
    cancelPendingOrder: cancelPendingOrder,
    diagnoseStripe: diagnoseStripe,
    copyLastOrderCode: copyLastOrderCode,
    copyPayIban: copyPayIban,
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
    changeClientPassword: changeClientPassword,
    saveNewAddress: saveNewAddress,
    startEditAddress: startEditAddress,
    cancelEditAddress: cancelEditAddress,
    renderAccountWishlist: renderAccountWishlist,
    useAddress: useAddress,
    deleteAddress: deleteAddress,
    loadMyOrders: loadMyOrders,
    openOrderDetail: openOrderDetail,
    openReviewForProduct: openReviewForProduct,
    subscribeNewsletter: subscribeNewsletter,
    onThemeChange: onThemeChange,
    openContact: openContact,
    closeContact: closeContact,
    submitContact: submitContact,
    openInfo: openInfo,
    closeInfo: closeInfo,
    openLegal: openLegal,
    legalPageHref: legalPageHref,
    closeLegal: closeLegal,
    openSizeGuide: openSizeGuide,
    closeSizeGuide: closeSizeGuide,
    imgError: imgError,
    logoError: logoError,
    applyVitrineContent: applyVitrineContent,
    applyHeroLoadingState: applyHeroLoadingState,
    isStoreConfigReady: isStoreConfigReady,
    applyServicesStrip: applyServicesStrip,
    applyPromoBanner: applyPromoBanner,
    submitProductReview: submitProductReview,
    openReturnForm: openReturnForm,
    cancelReturnForm: cancelReturnForm,
    submitClientReturn: submitClientReturn,
    acceptAllCookies: acceptAllCookies,
    acceptEssentialCookies: acceptEssentialCookies,
    setHeroMotion: setHeroMotion
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
