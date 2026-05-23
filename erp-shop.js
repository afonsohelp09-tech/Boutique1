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
    wishLocal: 'azav_wish_local'
  };

  var state = {
    lang: 'fr',
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
    delStep: 0,
    loading: true,
    stripe: null,
    stripeElements: null,
    stripePaymentElement: null
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

  function t() { return global.T[state.lang] || global.T.fr; }
  function nm(p) { return state.lang === 'pt' ? p.pt : p.fr; }
  function desc(p) { return state.lang === 'pt' ? p.dPt : p.dFr; }
  function badge(p) { return state.lang === 'pt' ? p.badgePt : p.badgeFr; }
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

  function colorCss(name) {
    if (!name || name === '—') return '#666';
    if (String(name).charAt(0) === '#') return name;
    var h = 0;
    for (var i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return '#' + (h & 0xffffff).toString(16).padStart(6, '0');
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
    var img = p.imagem || '';
    if (img && img.indexOf('drive.google.com') > -1 && img.indexOf('thumbnail') === -1) {
      var m = img.match(/[-\w]{25,}/);
      if (m) img = 'https://drive.google.com/thumbnail?id=' + m[0] + '&sz=w800';
    }
    if (!img) img = 'https://picsum.photos/seed/' + encodeURIComponent(p.produto_id || 'x') + '/600/800';
    return {
      id: p.produto_id,
      produto_id: p.produto_id,
      fr: p.nome || '',
      pt: p.nome || '',
      cat: p.categoria || '',
      catKey: normalizeCat(p.categoria),
      price: price,
      old: list,
      img: img,
      colors: (p.cores && p.cores.length) ? p.cores : ['—'],
      sizes: (p.tamanhos && p.tamanhos.length) ? p.tamanhos : [state.lang === 'pt' ? 'Tamanho único' : 'Taille unique'],
      rate: 0,
      rev: 0,
      dFr: p.descricao || '',
      dPt: p.descricao || '',
      badgeFr: p.disponivel === false ? 'Épuisé' : (list ? 'Offre' : null),
      badgePt: p.disponivel === false ? 'Esgotado' : (list ? 'Saldo' : null),
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
      if (state.clientName) localStorage.setItem(LS.clientName, state.clientName);
      localStorage.setItem(LS.wishLocal, JSON.stringify(state.wish));
    } catch (e) { /* ignore */ }
  }

  async function loadStore() {
    try {
      var brand = await erpCall('getPublicBrand', {});
      if (brand && brand.success && brand.brand) state.store = brand.brand;
    } catch (e) { /* ignore */ }
    try {
      var cfg = await erpCall('getConfig', {});
      if (cfg && cfg.success && cfg.config) state.config = cfg.config;
    } catch (e2) { /* ignore */ }
    if (state.store && state.store.defaultLang && !global._langSet) {
      state.lang = state.store.defaultLang === 'pt' ? 'pt' : 'fr';
    }
    applyBrandUi();
    applyPromoBanner();
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
    if (navLogo && state.store && state.store.logoUrl && /^https?:\/\//i.test(state.store.logoUrl)) {
      navLogo.src = state.store.logoUrl;
    }
    var footLogo = document.querySelector('.f-logo');
    if (footLogo && state.store && state.store.logoUrl && /^https?:\/\//i.test(state.store.logoUrl)) {
      footLogo.src = state.store.logoUrl;
    }
    if (state.store && state.store.colors) {
      var root = document.documentElement;
      if (state.store.colors.accent) root.style.setProperty('--gold', state.store.colors.accent);
    }
    if (state.store && state.store.tagline && $('fDesc')) {
      $('fDesc').textContent = state.store.tagline;
      $('fDesc').dataset.erp = '1';
    }
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
    if (state.cat !== 'all') filters.categoria = state.cat;
    var q = ($('srchIn') && $('srchIn').value) ? $('srchIn').value.trim() : '';
    if (q) filters.search = q;
    var sort = $('sortSel') ? $('sortSel').value : 'def';
    if (sort === 'asc') filters.sort = 'price_asc';
    else if (sort === 'dsc') filters.sort = 'price_desc';
    else if (sort === 'rat') filters.sort = 'date_desc';
    var res = await erpCall('getProducts', filters);
    if (!res || !res.success) throw new Error((res && res.error) || 'getProducts');
    state.products = (res.products || []).map(mapProduct);
    await enrichReviews();
  }

  async function enrichReviews() {
    for (var i = 0; i < Math.min(state.products.length, 40); i++) {
      var p = state.products[i];
      try {
        var rv = await erpCall('getReviews', { productId: p.produto_id });
        if (rv && rv.success) {
          p.rate = parseFloat(rv.average) || 0;
          p.rev = (rv.reviews && rv.reviews.length) || 0;
        }
      } catch (e) { /* ignore */ }
    }
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
      global.toast((state.lang === 'pt' ? 'Erro: ' : 'Erreur : ') + e.message, 'e');
      state.products = [];
    }
    state.loading = false;
    showLoader(false);
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
    return state.products
      .filter(function (p) {
        if (state.cat === 'all') return true;
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
    var list = getList();
    var n = list.length;
    if ($('resCount')) $('resCount').textContent = n + ' ' + (n > 1 ? t().plural : t().single);
    if (!n) {
      $('grid').innerHTML = '<div class="no-res"><h3>' + esc(t().noT) + '</h3><p>' + esc(t().noD) + '</p>' +
        '<button class="btn-gold" style="margin:0 auto;" onclick="Shop.resetAll()">' + esc(t().noBtn) + '</button></div>';
      return;
    }
    $('grid').innerHTML = list.map(function (p) {
      var b = badge(p);
      var faved = state.wish.some(function (x) { return x.id === p.id; });
      var pid = esc(p.id).replace(/'/g, "\\'");
      return '<div class="card">' +
        '<div class="card-img">' +
        '<img src="' + esc(p.img) + '" alt="' + esc(nm(p)) + '" loading="lazy"/>' +
        '<div class="card-overlay"><div class="ov-btns">' +
        '<button class="btn-qv" onclick="Shop.openQv(\'' + pid + '\')">' + esc(t().qv) + '</button>' +
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

  function updBadge() {
    var n = cartCount();
    if ($('cBadge')) { $('cBadge').textContent = n; $('cBadge').style.display = n ? 'flex' : 'none'; }
    if ($('cDN')) $('cDN').textContent = n;
    var wn = state.wish.length;
    if ($('wBadge')) { $('wBadge').textContent = wn; $('wBadge').style.display = wn ? 'flex' : 'none'; }
    if ($('wDN')) $('wDN').textContent = wn;
  }

  async function addCart(id, sz, cl) {
    var p = state.products.find(function (x) { return x.id === id; });
    if (!p) return;
    if (!p.disponivel) {
      global.toast(state.lang === 'pt' ? 'Artigo esgotado' : 'Article épuisé', 'e');
      return;
    }
    var size = sz || p.sizes[0];
    var color = cl || p.colors[0];
    var variant = findVariant(p, size, color);
    var price = variantPrice(p, variant);
    var varianteId = variant ? variant.variante_id : '';

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
        img: p.img,
        size: size,
        color: color,
        qty: 1,
        price: price
      });
    }
    updBadge();
    global.toast(t().tAdd.replace('{n}', nm(p)), 's');
    if ($('cartBg') && $('cartBg').classList.contains('open')) renderCart();
  }

  function remCart(key) {
    var it = state.cart.find(function (x) { return x.key === key; });
    state.cart = state.cart.filter(function (x) { return x.key !== key; });
    if (apiUrlConfigured() && state.cartId && it && it.variante_id) {
      erpCall('removeFromCart', { cartId: state.cartId, variante_id: it.variante_id }).catch(function () {});
    }
    updBadge();
    global.toast(t().tRem, 'i');
    renderCart();
  }

  function updQty(key, d) {
    var it = state.cart.find(function (x) { return x.key === key; });
    if (it) it.qty = Math.max(1, it.qty + d);
    renderCart();
  }

  function openCart() { $('cartBg').classList.add('open'); renderCart(); }
  function closeCart() { $('cartBg').classList.remove('open'); }

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
        '<img src="' + esc(it.img) + '" alt="' + esc(nm(it)) + '"/>' +
        '<div class="ci-body"><div><p class="ci-name">' + esc(nm(it)) + '</p>' +
        '<p class="ci-meta">' + (state.lang === 'fr' ? 'Taille' : 'Tamanho') + ': ' + esc(it.size) + ' · ' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + colorCss(it.color) + ';vertical-align:middle;"></span></p></div>' +
        '<div class="ci-bot"><div class="qty">' +
        '<button onclick="Shop.updQty(\'' + esc(it.key).replace(/'/g, "\\'") + '\',-1)">−</button><span>' + it.qty + '</span>' +
        '<button onclick="Shop.updQty(\'' + esc(it.key).replace(/'/g, "\\'") + '\',1)">+</button></div>' +
        '<div class="ci-pr"><p class="ci-price">' + (it.price * it.qty).toFixed(2) + ' €</p>' +
        '<button class="btn-rm" onclick="Shop.remCart(\'' + esc(it.key).replace(/'/g, "\\'") + '\')">' + esc(t().remove) + '</button></div></div></div></div>';
    }).join('');

    df.style.display = 'block';
    var sub = cartSub();
    var disc = state.discAmount || (sub * state.discPct / 100);
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
        state.discPct = 10;
        state.discAmount = 0;
        if (el) { el.className = 'promo-ok'; el.textContent = t().promoOk.replace('{n}', '10'); }
      } else if (el) { el.className = 'promo-err'; el.textContent = t().promoErr; state.discPct = 0; }
      renderCart();
      return;
    }
    try {
      var res = await erpCall('validateCoupon', { code: code, total: cartSub() });
      if (res && res.valid) {
        state.couponCode = res.codigo || code;
        state.couponTipo = res.tipo || 'percent';
        state.discAmount = parseFloat(res.discount) || 0;
        state.discPct = res.tipo === 'percent' ? parseFloat(state.config.announcement_promo_pct) || 0 : 0;
        if (el) { el.className = 'promo-ok'; el.textContent = t().promoOk.replace('{n}', res.discount); }
        global.toast(t().promoOk.replace('{n}', res.discount), 's');
      } else {
        state.discAmount = 0;
        state.discPct = 0;
        state.couponCode = '';
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

  function openWish() { $('wishBg').classList.add('open'); renderWish(); }
  function closeWish() { $('wishBg').classList.remove('open'); }

  function renderWish() {
    if ($('wDN')) $('wDN').textContent = state.wish.length;
    if (!state.wish.length) {
      $('wishDb').innerHTML = '<div class="empty"><span class="empty-ico">♥</span><p class="empty-txt">' + esc(t().wishEmpty) + '</p>' +
        '<button class="btn-gold" style="font-size:9px;" onclick="Shop.closeWish()">' + esc(t().wishBrowse) + '</button></div>';
      return;
    }
    $('wishDb').innerHTML = state.wish.map(function (it) {
      var pid = esc(it.id).replace(/'/g, "\\'");
      return '<div class="ci"><img src="' + esc(it.img) + '" alt="' + esc(nm(it)) + '"/>' +
        '<div class="ci-body"><div><p class="ci-name">' + esc(nm(it)) + '</p><p class="ci-price" style="margin-top:5px;">' + it.price.toFixed(2) + ' €</p></div>' +
        '<div class="ci-bot"><button class="btn-gold" style="font-size:8px;padding:8px 10px;" onclick="Shop.addCart(\'' + pid + '\',\'\',\'\');Shop.toggleWish(\'' + pid + '\')">' + esc(t().addCart) + '</button>' +
        '<button class="btn-rm" onclick="Shop.toggleWish(\'' + pid + '\')">' + esc(t().remove) + '</button></div></div></div>';
    }).join('');
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
    state.qvSize = p.sizes[0];
    state.qvColor = p.colors[0];
    state.qvTab = 'desc';
    state.qvGuide = false;
    renderQv();
    $('qvBg').classList.add('open');
  }

  function closeQv() { $('qvBg').classList.remove('open'); }

  function renderQv() {
    var p = state.qvProd;
    if (!p) return;
    var faved = state.wish.some(function (x) { return x.id === p.id; });
    var pid = esc(p.id).replace(/'/g, "\\'");
    var catLabel = p.cat || '';
    getCatList().forEach(function (c) {
      if (c.id === p.catKey) catLabel = c.label;
    });

    $('qvModal').innerHTML =
      '<button class="modal-close" onclick="Shop.closeQv()"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>' +
      '<div class="m-img"><img src="' + esc(p.img) + '" alt="' + esc(nm(p)) + '"/></div>' +
      '<div class="m-body"><p class="m-cat">' + esc(catLabel) + '</p>' +
      '<h2 class="m-name">' + esc(nm(p)) + '</h2>' +
      '<p class="m-stars">' + stars(p.rate) + ' <span>(' + (p.rev || 0) + ')</span></p>' +
      '<div class="m-price"><span class="c">' + p.price.toFixed(2) + ' €</span>' +
      (p.old ? '<span class="o">' + p.old.toFixed(2) + ' €</span>' : '') + '</div>' +
      '<div class="tab-bar">' +
      '<button class="tab-btn ' + (state.qvTab === 'desc' ? 'on' : '') + '" onclick="Shop.setTab(\'desc\')">' + esc(t().tabDesc) + '</button>' +
      '<button class="tab-btn ' + (state.qvTab === 'comp' ? 'on' : '') + '" onclick="Shop.setTab(\'comp\')">' + esc(t().tabComp) + '</button></div>' +
      '<div class="tab-panel">' + (state.qvTab === 'desc' ? '<p>' + esc(desc(p)) + '</p>' : '<ul>' + t().comp.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>') + '</div>' +
      '<span class="opt-label">' + esc(t().colLbl) + '</span>' +
      '<div class="color-opts">' + p.colors.map(function (c) {
        var on = state.qvColor === c ? ' on' : '';
        return '<button class="col-btn' + on + '" style="background:' + colorCss(c) + '" onclick="Shop.setQvColor(\'' + esc(c).replace(/'/g, "\\'") + '\')"></button>';
      }).join('') + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">' +
      '<span class="opt-label" style="margin:0;">' + esc(t().szLbl) + '</span>' +
      '<button style="background:none;border:none;color:var(--gold);font-size:8px;cursor:pointer;" onclick="Shop.toggleQvGuide()">' + esc(t().szGuide) + '</button></div>' +
      (state.qvGuide ? '<div class="size-guide"><span>XS · S · M · L · XL</span></div>' : '') +
      '<div class="size-opts">' + p.sizes.map(function (s) {
        return '<button class="sz-btn ' + (state.qvSize === s ? 'on' : '') + '" onclick="Shop.setQvSize(\'' + esc(s).replace(/'/g, "\\'") + '\')">' + esc(s) + '</button>';
      }).join('') + '</div>' +
      '<div class="m-cta">' +
      '<button class="btn-madd" onclick="Shop.addCart(\'' + pid + '\',\'' + esc(state.qvSize).replace(/'/g, "\\'") + '\',\'' + esc(state.qvColor).replace(/'/g, "\\'") + '\');Shop.closeQv()">' + esc(t().addSel) + '</button>' +
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
    var disc = state.discAmount || 0;
    var after = Math.max(0, sub - disc);
    var ship = state.couponTipo === 'free_shipping' ? 0 : (after >= shippingThreshold() ? 0 : shippingFlat());
    return { sub: sub, disc: disc, after: after, ship: ship, total: after + ship };
  }

  function paymentOptionsHtml() {
    var opts = [];
    if (cfgOn('pay_show_cod', true) && cfgOn('pay_cod_enabled', true)) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="cod" ' + (state.payMethod === 'cod' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'cod\')"/> ' +
        (state.lang === 'pt' ? 'Pagamento à entrega' : 'Paiement à la livraison') + '</label>');
    }
    if (cfgOn('pay_stripe_enabled', false) && cfgOn('pay_show_stripe', true) && STRIPE_PK) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="stripe" ' + (state.payMethod === 'stripe' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'stripe\')"/> Stripe (carte)</label>');
    }
    if (cfgOn('pay_show_transfer', true)) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="transfer" ' + (state.payMethod === 'transfer' ? 'checked' : '') + ' onchange="Shop.setPayMethod(\'transfer\')"/> ' +
        (state.lang === 'pt' ? 'Transferência bancária' : 'Virement bancaire') + '</label>');
    }
    if (!opts.length) {
      opts.push('<label class="pay-opt"><input type="radio" name="payM" value="cod" checked/> ' +
        (state.lang === 'pt' ? 'Encomenda (contacto posterior)' : 'Commande (contact ultérieur)') + '</label>');
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
    if (state.clientName) state.form.name = state.clientName;
    renderCo();
    $('coBg').classList.add('open');
  }

  function closeCo() {
    $('coBg').classList.remove('open');
    destroyStripeElement();
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
    state.stripeElements = state.stripe.elements({ appearance: { theme: 'night' } });
    state.stripePaymentElement = state.stripeElements.create('payment');
    var mount = $('stripe-payment-element');
    if (mount) state.stripePaymentElement.mount('#stripe-payment-element');
  }

  function renderCo() {
    if (state.ordered) {
      $('coBody').innerHTML =
        '<div class="order-ok"><span class="ok-emoji">🎉</span>' +
        '<h2 class="ok-title">' + esc(t().ordTitle) + '</h2>' +
        '<p class="ok-sub">' + esc(t().ordSub.replace('{name}', state.form.name).replace('{ref}', '#' + state.lastOrderId).replace('{email}', state.form.email)) + '</p>' +
        '<div class="tracking"><p class="tr-title">' + esc(t().trTitle) + '</p><div class="tr-steps">' +
        [[t().tr1t, t().tr1d], [t().tr2t, t().tr2d], [t().tr3t, t().tr3d.replace('{address}', state.form.addr).replace('{city}', state.form.city)]].map(function (pair, i) {
          return '<div class="tr-step"><span class="tr-dot ' + (state.delStep > i ? 'done' : '') + '" id="td' + i + '"></span><h4>' + esc(pair[0]) + '</h4><p>' + esc(pair[1]) + '</p></div>';
        }).join('') +
        '</div></div><button class="btn-gold" onclick="Shop.closeCo()">' + esc(t().backBtn) + '</button></div>';
      state.delStep = 1;
      setTimeout(function () { state.delStep = 2; updDots(); }, 5000);
      setTimeout(function () { state.delStep = 3; updDots(); }, 10000);
      return;
    }

    var totals = orderTotals();
    var f = state.form;
    $('coBody').innerHTML =
      '<div class="m-body" style="width:100%;padding:28px 32px;">' +
      '<h2 style="font-family:\'Cormorant Garamond\',serif;font-size:22px;font-weight:300;margin-bottom:5px;">' + esc(t().coTitle) + '</h2>' +
      '<p style="font-size:10px;color:var(--muted);margin-bottom:18px;">' + esc(t().coSub) + '</p>' +
      '<p class="form-title">' + esc(t().s1) + '</p>' +
      '<div class="fgrid">' +
      '<div class="field"><label>' + esc(t().fName) + '</label><input value="' + esc(f.name) + '" oninput="Shop.setForm(\'name\',this.value)" placeholder="Maria Silva"/></div>' +
      '<div class="field"><label>' + esc(t().fEmail) + '</label><input type="email" value="' + esc(f.email) + '" oninput="Shop.setForm(\'email\',this.value)" placeholder="email@exemplo.pt"/></div></div>' +
      '<div class="field" style="margin-bottom:10px;"><label>' + (state.lang === 'pt' ? 'Telefone' : 'Téléphone') + '</label><input value="' + esc(f.phone) + '" oninput="Shop.setForm(\'phone\',this.value)" placeholder="+351 912 345 678"/></div>' +
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
      global.toast(state.lang === 'pt' ? 'Cesto vazio' : 'Panier vide', 'e');
      return;
    }
    if (!apiUrlConfigured()) {
      global.toast('Configure API_URL dans index.html', 'e');
      return;
    }

    var totals = orderTotals();
    var endereco = [f.addr, f.zip, f.city].filter(Boolean).join(', ');
    var awaitStripe = state.payMethod === 'stripe' && STRIPE_PK && cfgOn('pay_stripe_enabled', false);

    try {
      var orderPayload = {
        clientId: state.clientId || 'guest',
        email: f.email,
        telefone: f.phone || '',
        nome: f.name,
        endereco: endereco,
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
      } else if (state.payMethod === 'cod') {
        await erpCall('processPayment', {
          orderId: orderRes.orderId,
          metodo: 'cod',
          valor: totals.total.toFixed(2),
          clientId: state.clientId || 'guest'
        });
      }

      state.cart = [];
      state.promo = '';
      state.discAmount = 0;
      state.couponCode = '';
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
  function openAccount() { $('accBg').classList.add('open'); renderAccount(); }
  function closeAccount() { $('accBg').classList.remove('open'); }

  function renderAccount() {
    var logged = !!state.token;
    $('accBody').innerHTML = logged ? (
      '<div style="padding:28px;"><h2 style="font-family:\'Cormorant Garamond\',serif;font-size:22px;margin-bottom:8px;">' + esc(state.clientName || state.clientId) + '</h2>' +
      '<p style="font-size:10px;color:var(--muted);margin-bottom:16px;">' + esc(state.clientId) + '</p>' +
      '<button class="btn-gold" style="width:100%;margin-bottom:8px;" onclick="Shop.loadMyOrders()">' + (state.lang === 'pt' ? 'As minhas encomendas' : 'Mes commandes') + '</button>' +
      '<button class="btn-ghost" style="width:100%;border-color:#444;color:#aaa;" onclick="Shop.logout()">' + (state.lang === 'pt' ? 'Terminar sessão' : 'Déconnexion') + '</button>' +
      '<div id="accOrders" style="margin-top:16px;font-size:10px;color:var(--muted);"></div></div>'
    ) : (
      '<div style="padding:28px;"><h2 style="font-family:\'Cormorant Garamond\',serif;font-size:22px;margin-bottom:12px;">' + (state.lang === 'pt' ? 'A minha conta' : 'Mon compte') + '</h2>' +
      '<p class="form-title">' + (state.lang === 'pt' ? 'Entrar' : 'Connexion') + '</p>' +
      '<div class="fgrid one"><div class="field"><label>Email</label><input id="loginEmail" type="email"/></div>' +
      '<div class="field"><label>' + (state.lang === 'pt' ? 'Palavra-passe' : 'Mot de passe') + '</label><input id="loginPass" type="password"/></div></div>' +
      '<button class="btn-pay" style="margin-top:8px;" onclick="Shop.login()">' + (state.lang === 'pt' ? 'Entrar' : 'Se connecter') + '</button>' +
      '<p class="form-title" style="margin-top:20px;">' + (state.lang === 'pt' ? 'Criar conta' : 'Créer un compte') + '</p>' +
      '<div class="fgrid one"><div class="field"><label>' + esc(t().fName) + '</label><input id="regName"/></div>' +
      '<div class="field"><label>Email</label><input id="regEmail" type="email"/></div>' +
      '<div class="field"><label>' + (state.lang === 'pt' ? 'Palavra-passe' : 'Mot de passe') + '</label><input id="regPass" type="password"/></div></div>' +
      '<button class="btn-gold" style="width:100%;margin-top:8px;" onclick="Shop.register()">' + (state.lang === 'pt' ? 'Registar' : 'S\'inscrire') + '</button></div>'
    );
  }

  async function login() {
    var email = ($('loginEmail') && $('loginEmail').value) || '';
    var password = ($('loginPass') && $('loginPass').value) || '';
    try {
      var res = await erpCall('clientLogin', { email: email, password: password });
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Login failed', 'e');
        return;
      }
      state.token = res.token;
      state.clientId = res.clientId;
      state.clientName = res.nome || '';
      saveSession();
      await loadWishlistServer();
      renderAccount();
      global.toast(state.lang === 'pt' ? 'Sessão iniciada' : 'Connecté', 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  async function register() {
    var nome = ($('regName') && $('regName').value) || '';
    var email = ($('regEmail') && $('regEmail').value) || '';
    var password = ($('regPass') && $('regPass').value) || '';
    try {
      var res = await erpCall('clientRegister', { nome: nome, email: email, password: password, newsletter: false });
      if (!res || !res.success) {
        global.toast((res && res.error) || 'Register failed', 'e');
        return;
      }
      state.token = res.token;
      state.clientId = res.clientId;
      state.clientName = res.nome || nome;
      saveSession();
      renderAccount();
      global.toast(state.lang === 'pt' ? 'Conta criada' : 'Compte créé', 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  function logout() {
    state.token = '';
    state.clientId = '';
    state.clientName = '';
    saveSession();
    renderAccount();
  }

  async function loadMyOrders() {
    var box = $('accOrders');
    if (!box) return;
    try {
      var res = await erpCall('getOrders', { clientId: state.clientId, email: state.form.email || '' });
      var orders = (res && res.orders) ? res.orders : [];
      if (!orders.length) {
        box.innerHTML = '<p>' + (state.lang === 'pt' ? 'Sem encomendas.' : 'Aucune commande.') + '</p>';
        return;
      }
      box.innerHTML = '<ul style="list-style:none;padding:0;">' + orders.slice(0, 10).map(function (o) {
        return '<li style="padding:8px 0;border-bottom:1px solid #222;">#' + esc(o.pedido_id) + ' — ' + esc(o.total) + ' € · ' + esc(o.estado || '') + '</li>';
      }).join('') + '</ul>';
    } catch (e) { box.textContent = e.message; }
  }

  async function subscribeNewsletter(email) {
    if (!email || !apiUrlConfigured()) return;
    try {
      await erpCall('subscribeNewsletter', { email: email });
      global.toast(state.lang === 'pt' ? 'Subscrição confirmada!' : 'Abonnement confirmé !', 's');
    } catch (e) { global.toast(e.message, 'e'); }
  }

  async function pingApi() {
    try {
      var res = await erpCall('ping', {});
      return res && res.success;
    } catch (e) { return false; }
  }

  // ─── Init ──────────────────────────────────────────────────────────────
  async function init() {
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
      await loadStore();
      await loadCategories();
      await loadProducts();
      if (state.clientId) await loadWishlistServer();
      showApiBanner(false);
    } catch (e) {
      showApiBanner(true);
      global.toast((state.lang === 'pt' ? 'API: ' : 'API : ') + e.message, 'e');
    }
    state.loading = false;
    showLoader(false);
    if (global.boot) global.boot();
    render();
  }

  function setLang(l) {
    window._langSet = true;
    state.lang = l;
    if (global.boot) global.boot();
  }

  global.Shop = {
    init: init,
    setLang: setLang,
    scrollShop: scrollShop,
    selectCat: selectCat,
    resetAll: resetAll,
    refreshProducts: refreshProducts,
    renderCats: renderCats,
    render: render,
    addCart: addCart,
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
    openAccount: openAccount,
    closeAccount: closeAccount,
    login: login,
    register: register,
    logout: logout,
    loadMyOrders: loadMyOrders,
    subscribeNewsletter: subscribeNewsletter
  };

  document.addEventListener('DOMContentLoaded', function () {
    init();
  });
})(typeof window !== 'undefined' ? window : this);
