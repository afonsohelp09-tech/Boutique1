/**
 * AZAVISION — Icônes SVG (vitrine + admin)
 * Traits visibles en mode clair et sombre (currentColor).
 */
(function (global) {
  'use strict';

  var P = {
    dashboard: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>',
    products: '<path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>',
    categories: '<path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>',
    orders: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>',
    clients: '<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>',
    vitrine: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 22V12h6v10"/>',
    config: '<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
    coupons: '<path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>',
    team: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>',
    shop: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>',
    cart: '<path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4l1-12z"/>',
    account: '<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>',
    search: '<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>',
    wish: '<path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>',
    menu: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>',
    truck: '<path stroke-linecap="round" stroke-linejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0h4m-4 0a2 2 0 104 0m6 0a2 2 0 104 0M5 16h6"/>',
    return: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>',
    lock: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>',
    leaf: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><path stroke-linecap="round" stroke-linejoin="round" d="M17.5 6.5h.01"/>',
    pinterest: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 2C6.48 2 2 6.25 2 11.5c0 3.78 2.36 7.02 5.68 8.3-.08-.72-.15-1.83.03-2.62.17-.72 1.1-4.58 1.1-4.58s-.28-.56-.28-1.39c0-1.3.75-2.27 1.69-2.27.8 0 1.18.6 1.18 1.32 0 .8-.51 2-.77 3.12-.22.94.46 1.7 1.36 1.7 1.63 0 2.89-1.72 2.89-4.2 0-2.19-1.57-3.72-3.82-3.72-2.6 0-4.13 1.95-4.13 3.98 0 .79.3 1.64.68 2.1a.3.3 0 01-.07.28l-.26 1.05c-.04.17-.13.21-.3.13-1.12-.52-1.82-2.15-1.82-3.47 0-2.82 2.05-5.41 5.92-5.41 3.11 0 5.53 2.22 5.53 5.18 0 3.09-1.95 5.58-4.66 5.58-.91 0-1.77-.47-2.06-1.03l-.56 2.14c-.2.78-.75 1.76-1.12 2.36A10 10 0 0012 21c5.52 0 10-4.25 10-9.5S17.52 2 12 2z"/>',
    tiktok: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 6v12m0-12c0 2.5 2 4 5 4m-5-4c0-2.5 2-4 5-4m0 8v4m0-12c2 0 4 1.5 4 4m-4-4c-2 0-4 1.5-4 4m8 0a4 4 0 11-8 0 4 4 0 018 0z"/>',
    facebook: '<path stroke-linecap="round" stroke-linejoin="round" d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>',
    contact: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>'
  };

  var SVC_KEYS = ['truck', 'return', 'lock', 'leaf'];

  function svg(path, size, cls) {
    size = size || 20;
    cls = cls ? ' class="' + cls + '"' : ' class="ui-ico"';
    return '<svg' + cls + ' width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }

  function nav(id, size) {
    return svg(P[id] || P.dashboard, size || 18, 'ui-ico nav-ico-svg');
  }

  function svc(indexOrKey, size) {
    var key = typeof indexOrKey === 'number' ? (SVC_KEYS[indexOrKey] || 'truck') : (indexOrKey || 'truck');
    return svg(P[key] || P.truck, size || 32, 'ui-ico svc-ico-svg');
  }

  function social(name, size) {
    return svg(P[name] || P.instagram, size || 18, 'ui-ico soc-ico-svg');
  }

  function mob(id, size) {
    return nav(id === 'orders' ? 'orders' : id, size || 22);
  }

  function wireSocialButton(el, network) {
    if (!el) return;
    el.innerHTML = social(network, 18);
    el.setAttribute('aria-label', network);
  }

  function logoError(imgEl) {
    if (!imgEl) return;
    var wrap = imgEl.closest('.brand, .f-brand, .sidebar-head, .login-wrap, .login-card');
    if (wrap) wrap.classList.add('logo-missing');
    imgEl.style.display = 'none';
    var fb = imgEl.parentElement && imgEl.parentElement.querySelector('.brand-fallback, .logo-fallback-text');
    if (fb) fb.style.display = '';
  }

  global.IconUi = {
    svg: svg,
    nav: nav,
    svc: svc,
    social: social,
    mob: mob,
    wireSocialButton: wireSocialButton,
    logoError: logoError,
    svcKeys: SVC_KEYS
  };
})(typeof window !== 'undefined' ? window : this);
