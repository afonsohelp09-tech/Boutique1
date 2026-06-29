/**
 * AZAVISION — Page légale autonome (privacy.html)
 * Contenu éditable dans legal/privacy.js — voir legal/README.md
 */
(function (global) {
  'use strict';

  var LIVRO_URL = 'https://www.livroreclamacoes.pt/Inicio/';
  var DEFAULT_CONTACT_EMAIL = 'azavision1@gmail.com';

  var PAGE_COPY = {
    pt: { back: '← Voltar à loja', loading: 'A carregar…' },
    fr: { back: '← Retour à la boutique', loading: 'Chargement…' },
    en: { back: '← Back to shop', loading: 'Loading…' },
    es: { back: '← Volver a la tienda', loading: 'Cargando…' }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getLang() {
    try {
      var q = new URLSearchParams(global.location.search || '').get('lang');
      if (q && global.T && global.T[q]) return q;
    } catch (e) { /* ignore */ }
    try {
      var saved = localStorage.getItem('azav_lang');
      if (saved && global.T && global.T[saved]) return saved;
    } catch (e2) { /* ignore */ }
    return 'pt';
  }

  function pageCopy(lang) {
    return PAGE_COPY[lang] || PAGE_COPY.pt;
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
      .replace(/\{\{livroUrl\}\}/g, vars.livroUrl || LIVRO_URL);
  }

  function buildLegalDocHtml(pageKey, lang, vars) {
    var lc = global.LegalContent;
    if (!lc || !lc[pageKey]) return '<article class="legal-doc"><p>—</p></article>';
    var doc = lc[pageKey][lang] || lc[pageKey].pt;
    if (!doc) return '';
    var html = '<article class="legal-doc">';
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

  function defaultVars() {
    return {
      storeName: 'AZAVISION',
      email: DEFAULT_CONTACT_EMAIL,
      country: 'Portugal',
      nif: '',
      phone: '',
      morada: '',
      cidade: '',
      address: 'Portugal',
      livroUrl: LIVRO_URL
    };
  }

  function mergeEmpresaVars(base, emp) {
    emp = emp || {};
    var morada = String(emp.morada || '').trim();
    var cidade = String(emp.cidade || '').trim();
    var pais = String(emp.pais || base.country || 'Portugal').trim() || 'Portugal';
    var address = [morada, cidade, pais].filter(Boolean).join(', ');
    return {
      storeName: String(emp.nome || base.storeName || 'AZAVISION').trim() || base.storeName,
      email: String(emp.email || base.email || DEFAULT_CONTACT_EMAIL).trim(),
      country: pais,
      nif: String(emp.nif || '').trim(),
      phone: String(emp.telefone || '').trim(),
      morada: morada,
      cidade: cidade,
      address: address || pais,
      livroUrl: LIVRO_URL
    };
  }

  function apiUrl() {
    return String(global.API_URL || global.ERP_API_URL_DEFAULT || '').trim();
  }

  function apiPost(action) {
    var url = apiUrl();
    if (!url) return Promise.reject(new Error('no api'));
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: {} })
    }).then(function (res) { return res.json(); });
  }

  function fetchConfigVars() {
    var base = defaultVars();
    if (!apiUrl()) return Promise.resolve(base);
    return apiPost('getPublicBrand').then(function (res) {
      if (res && res.success && res.brand) {
        var cfg = res.brand.config || {};
        base = {
          storeName: String(res.brand.storeName || cfg.site_name || 'AZAVISION').trim() || 'AZAVISION',
          email: String(cfg.contact_public_email || cfg.store_email || DEFAULT_CONTACT_EMAIL).trim(),
          country: 'Portugal',
          nif: '',
          phone: '',
          morada: '',
          cidade: '',
          address: 'Portugal',
          livroUrl: LIVRO_URL
        };
        if (res.brand.empresa) return mergeEmpresaVars(base, res.brand.empresa);
        return base;
      }
      return apiPost('getConfig').then(function (cfgRes) {
        var cfg = (cfgRes && cfgRes.config) || {};
        return {
          storeName: String(cfg.site_name || 'AZAVISION').trim() || 'AZAVISION',
          email: String(cfg.contact_public_email || cfg.store_email || DEFAULT_CONTACT_EMAIL).trim(),
          country: 'Portugal',
          nif: '',
          phone: '',
          morada: '',
          cidade: '',
          address: 'Portugal',
          livroUrl: LIVRO_URL
        };
      });
    }).catch(function () {
      return base;
    });
  }

  function renderLangButtons(lang) {
    var box = document.getElementById('legalLang');
    if (!box) return;
    box.innerHTML = ['fr', 'pt', 'en', 'es'].map(function (code) {
      var href = 'privacy.html?lang=' + encodeURIComponent(code);
      return '<a href="' + href + '" class="legal-lang-btn' + (lang === code ? ' on' : '') + '">' + code.toUpperCase() + '</a>';
    }).join('');
  }

  function renderPage() {
    var pageKey = (document.body && document.body.dataset.legalPage) || 'privacy';
    var lang = getLang();
    var copy = pageCopy(lang);
    try { localStorage.setItem('azav_lang', lang); } catch (e) { /* ignore */ }
    document.documentElement.lang = lang === 'pt' ? 'pt-PT' : lang;

    var back = document.getElementById('legalBack');
    if (back) {
      back.textContent = copy.back;
      back.href = 'index.html';
    }
    renderLangButtons(lang);

    var body = document.getElementById('legalPageBody');
    if (body) body.innerHTML = '<p class="legal-loading">' + esc(copy.loading) + '</p>';

    fetchConfigVars().then(function (vars) {
      var html = buildLegalDocHtml(pageKey, lang, vars);
      if (body) body.innerHTML = html;
      try {
        var lc = global.LegalContent;
        var doc = lc && lc[pageKey] && (lc[pageKey][lang] || lc[pageKey].pt);
        if (doc && doc.title) document.title = fillLegalText(doc.title, vars) + ' — AZAVISION';
      } catch (eTitle) { /* ignore */ }
    });
  }

  document.addEventListener('DOMContentLoaded', renderPage);
})(typeof window !== 'undefined' ? window : this);
