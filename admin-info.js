/**
 * AZAVISION Admin — Centro de informações (admin uniquement)
 * Toutes les pages vitrine : returns, sizeguide, delivery, privacy, terms, legal, faq, care
 */
(function (global) {
  'use strict';

  var d = null;
  var PAGES = ['returns', 'sizeguide', 'delivery', 'privacy', 'terms', 'legal', 'faq', 'care'];
  var LANGS = ['pt', 'fr', 'en', 'es'];
  var LEGAL_PAGES = { privacy: true, terms: true, legal: true };

  function t() { return d.t(); }
  function esc(s) { return d.esc(s); }
  function toast(msg, type) { if (global.toast) global.toast(msg, type); }

  function clone(o) {
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; }
  }

  function pageLabel(page) {
    var p = (t().info && t().info.pages) || {};
    return p[page] || page;
  }

  function langLabel(lang) {
    return ({ pt: 'PT', fr: 'FR', en: 'EN', es: 'ES' })[lang] || lang;
  }

  function isSizeGuidePage(page) { return page === 'sizeguide'; }
  function hasPromiseField(page) { return page === 'returns'; }

  function emptyDoc() {
    return { title: '', promise: '', updated: '', sections: [{ h: '', p: [''] }] };
  }

  function getDefaultDoc(page, lang) {
    lang = lang || 'pt';
    if (LEGAL_PAGES[page]) {
      var lc = global.LegalContent;
      if (lc && lc[page] && lc[page][lang]) return clone(lc[page][lang]);
      if (lc && lc[page] && lc[page].pt) return clone(lc[page].pt);
      return emptyDoc();
    }
    if (isSizeGuidePage(page)) {
      var sg = global.SizeGuideContent;
      if (!sg) return emptyDoc();
      var doc = clone(sg[lang] || sg.pt || {});
      doc.rows = clone(sg.rows || []);
      if (!doc.sections) doc.sections = [];
      return doc;
    }
    var ic = global.InfoContent;
    if (ic && ic[page] && ic[page][lang]) return clone(ic[page][lang]);
    if (ic && ic[page] && ic[page].pt) return clone(ic[page].pt);
    return emptyDoc();
  }

  function mergeDoc(base, stored) {
    if (!stored) return clone(base || emptyDoc());
    if (!base) return clone(stored);
    var out = clone(base);
    if (stored.title != null && String(stored.title).trim()) out.title = stored.title;
    if (stored.promise != null && String(stored.promise).trim()) out.promise = stored.promise;
    if (stored.updated != null && String(stored.updated).trim()) out.updated = stored.updated;
    if (stored.subtitle != null) out.subtitle = stored.subtitle;
    if (stored.howToTitle != null) out.howToTitle = stored.howToTitle;
    if (stored.steps && stored.steps.length) out.steps = clone(stored.steps);
    if (stored.rows && stored.rows.length) out.rows = clone(stored.rows);
    if (stored.cols && stored.cols.length) out.cols = clone(stored.cols);
    if (stored.colHint != null) out.colHint = stored.colHint;
    if (stored.unit != null) out.unit = stored.unit;
    if (stored.tip != null) out.tip = stored.tip;
    if (stored.note != null) out.note = stored.note;
    if (stored.oneSize != null) out.oneSize = stored.oneSize;
    if (stored.sections && stored.sections.length) out.sections = clone(stored.sections);
    return out;
  }

  function ensureState() {
    if (!d.state.infoCenter) {
      d.state.infoCenter = {
        content: {},
        page: 'returns',
        lang: d.state.lang || 'pt',
        loading: false,
        loaded: false
      };
    }
    return d.state.infoCenter;
  }

  function getDoc(st, page, lang) {
    var def = getDefaultDoc(page, lang);
    var stored = (st.content && st.content[page] && st.content[page][lang]) ? st.content[page][lang] : null;
    var doc = mergeDoc(def, stored);
    if (!doc.sections || !doc.sections.length) doc.sections = [{ h: '', p: [''] }];
    return doc;
  }

  function setDoc(st, page, lang, doc) {
    if (!st.content[page]) st.content[page] = {};
    st.content[page][lang] = doc;
  }

  function parseRowsText(raw) {
    return String(raw || '').split(/\n/).map(function (ln) {
      ln = ln.trim();
      if (!ln) return null;
      var parts = ln.split('|').map(function (x) { return x.trim(); });
      if (parts.length < 4) return null;
      return { size: parts[0], chest: parts[1], length: parts[2], shoulder: parts[3] };
    }).filter(Boolean);
  }

  function rowsToText(rows) {
    return (rows || []).map(function (r) {
      return [r.size, r.chest, r.length, r.shoulder].join('|');
    }).join('\n');
  }

  function readFormDoc(page) {
    var title = ($('ic_title') && $('ic_title').value) || '';
    var promise = ($('ic_promise') && $('ic_promise').value) || '';
    var updated = ($('ic_updated') && $('ic_updated').value) || '';
    var sections = [];
    var wraps = document.querySelectorAll('[data-ic-section]');
    wraps.forEach(function (wrap) {
      var hEl = wrap.querySelector('[data-ic-sec-h]');
      var pEl = wrap.querySelector('[data-ic-sec-p]');
      var h = hEl ? String(hEl.value || '').trim() : '';
      var raw = pEl ? String(pEl.value || '') : '';
      var paras = raw.split(/\n/).map(function (ln) { return ln.trim(); }).filter(Boolean);
      if (h || paras.length) sections.push({ h: h, p: paras.length ? paras : [''] });
    });
    if (!sections.length) sections.push({ h: '', p: [''] });
    var doc = { title: title.trim(), updated: updated.trim(), sections: sections };
    if (hasPromiseField(page) && promise.trim()) doc.promise = promise.trim();
    if (isSizeGuidePage(page)) {
      doc.subtitle = ($('ic_subtitle') && $('ic_subtitle').value) || '';
      doc.howToTitle = ($('ic_howto') && $('ic_howto').value) || '';
      doc.steps = String(($('ic_steps') && $('ic_steps').value) || '').split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      doc.rows = parseRowsText($('ic_rows') && $('ic_rows').value);
      doc.cols = String(($('ic_cols') && $('ic_cols').value) || '').split('|').map(function (c) { return c.trim(); }).filter(Boolean);
      doc.colHint = ($('ic_colhint') && $('ic_colhint').value) || '';
      doc.unit = ($('ic_unit') && $('ic_unit').value) || 'cm';
      doc.tip = ($('ic_tip') && $('ic_tip').value) || '';
      doc.note = ($('ic_note') && $('ic_note').value) || '';
      doc.oneSize = ($('ic_onesize') && $('ic_onesize').value) || '';
    }
    return doc;
  }

  function syncFormToState() {
    var st = ensureState();
    setDoc(st, st.page, st.lang, readFormDoc(st.page));
  }

  function renderSections(doc) {
    var i = t().info || {};
    return (doc.sections || []).map(function (sec, idx) {
      var body = (sec.p || []).join('\n');
      return '<div class="panel" style="margin-bottom:10px" data-ic-section="' + idx + '">' +
        '<div class="field"><label>' + esc(i.sectionTitle || 'Section') + ' ' + (idx + 1) + '</label>' +
        '<input data-ic-sec-h type="text" value="' + esc(sec.h || '') + '"/></div>' +
        '<div class="field"><label>' + esc(i.sectionBody || 'Contenu') + '</label>' +
        '<textarea data-ic-sec-p rows="4">' + esc(body) + '</textarea></div>' +
        '<button type="button" class="btn-sm danger" onclick="Admin.removeInfoSection(' + idx + ')">' + esc(i.removeSection || 'Supprimer') + '</button></div>';
    }).join('');
  }

  function renderSizeGuideFields(doc) {
    var i = t().info || {};
    var cols = (doc.cols || []).join(' | ');
    return '<div class="field"><label>' + esc(i.subtitle || 'Sous-titre') + '</label><input id="ic_subtitle" value="' + esc(doc.subtitle || '') + '"/></div>' +
      '<div class="field"><label>' + esc(i.howToTitle || 'Titre « comment mesurer »') + '</label><input id="ic_howto" value="' + esc(doc.howToTitle || '') + '"/></div>' +
      '<div class="field"><label>' + esc(i.steps || 'Étapes (une par ligne)') + '</label><textarea id="ic_steps" rows="4">' + esc((doc.steps || []).join('\n')) + '</textarea></div>' +
      '<div class="field"><label>' + esc(i.tableCols || 'Colonnes tableau (séparées par |)') + '</label><input id="ic_cols" value="' + esc(cols) + '"/></div>' +
      '<div class="field"><label>' + esc(i.tableRows || 'Lignes tableau (Taille|Peito|Comprimento|Ombros)') + '</label>' +
      '<p class="field-help">' + esc(i.tableRowsHelp || 'Une ligne par taille. Ex : S|86-90|68|42') + '</p>' +
      '<textarea id="ic_rows" rows="8">' + esc(rowsToText(doc.rows)) + '</textarea></div>' +
      '<div class="field"><label>' + esc(i.colHint || 'Légende colonnes') + '</label><input id="ic_colhint" value="' + esc(doc.colHint || '') + '"/></div>' +
      '<div class="field"><label>' + esc(i.unit || 'Unité') + '</label><input id="ic_unit" value="' + esc(doc.unit || 'cm') + '"/></div>' +
      '<div class="field"><label>' + esc(i.tip || 'Conseil') + '</label><input id="ic_tip" value="' + esc(doc.tip || '') + '"/></div>' +
      '<div class="field"><label>' + esc(i.note || 'Note') + '</label><input id="ic_note" value="' + esc(doc.note || '') + '"/></div>' +
      '<div class="field"><label>' + esc(i.oneSize || 'Taille unique (TU)') + '</label><input id="ic_onesize" value="' + esc(doc.oneSize || '') + '"/></div>';
  }

  function renderEditor() {
    var st = ensureState();
    var i = t().info || {};
    var doc = getDoc(st, st.page, st.lang);
    var pageOpts = PAGES.map(function (p) {
      return '<option value="' + p + '"' + (st.page === p ? ' selected' : '') + '>' + esc(pageLabel(p)) + '</option>';
    }).join('');
    var langTabs = LANGS.map(function (lg) {
      return '<button type="button" class="tab' + (st.lang === lg ? ' on' : '') + '" onclick="Admin.setInfoLang(\'' + lg + '\')">' + esc(langLabel(lg)) + '</button>';
    }).join('');
    var promiseField = hasPromiseField(st.page)
      ? '<div class="field"><label>' + esc(i.promise || 'Engagement') + '</label><input id="ic_promise" value="' + esc(doc.promise || '') + '"/></div>'
      : '';
    var sizeGuideBlock = isSizeGuidePage(st.page) ? renderSizeGuideFields(doc) : '';
    var sectionsBlock = isSizeGuidePage(st.page) ? '' :
      ('<h3 style="font-size:12px;margin:14px 0 8px">' + esc(i.sections || 'Sections') + '</h3>' +
        '<div id="ic_sections">' + renderSections(doc) + '</div>' +
        '<button type="button" class="btn-sm" style="margin-top:8px" onclick="Admin.addInfoSection()">' + esc(i.addSection || '+ Section') + '</button>');
    var ph = LEGAL_PAGES[st.page]
      ? (i.placeholdersLegal || '{{storeName}}, {{email}}, {{country}}, {{nif}}, {{address}}')
      : (i.placeholders || '{{storeName}}, {{email}}, {{country}}');
    return '<p class="hint-block">' + esc(i.subtitle || '') + '</p>' +
      '<p class="field-help">' + esc(i.defaultsHint || 'Le texte affiché provient des contenus vitrine ; vos modifications remplacent le défaut après enregistrement.') + '</p>' +
      '<div class="fgrid" style="margin-bottom:12px">' +
      '<div class="field"><label>' + esc(i.page || 'Page') + '</label><select id="ic_page" onchange="Admin.setInfoPage(this.value)">' + pageOpts + '</select></div>' +
      '<div class="field"><label>' + esc(i.lang || 'Langue') + '</label><div class="tabs">' + langTabs + '</div></div></div>' +
      '<section class="panel"><h2>' + esc(pageLabel(st.page)) + ' · ' + esc(langLabel(st.lang)) + '</h2>' +
      '<div class="field"><label>' + esc(i.docTitle || 'Titre') + '</label><input id="ic_title" value="' + esc(doc.title || '') + '"/></div>' +
      promiseField +
      '<div class="field"><label>' + esc(i.updated || 'Mise à jour') + '</label><input id="ic_updated" value="' + esc(doc.updated || '') + '"/></div>' +
      '<p class="field-help">' + esc(i.placeholdersLabel || 'Variables :') + ' ' + esc(ph) + '</p>' +
      sizeGuideBlock +
      sectionsBlock +
      '</section>' +
      '<div class="modal-actions" style="margin-top:16px;justify-content:flex-start;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn-primary" onclick="Admin.saveInfoContent()">' + esc(i.save || t().save) + '</button>' +
      '<button type="button" class="btn-ghost" onclick="Admin.resetInfoCurrent()">' + esc(i.resetPage || 'Rétablir défaut') + '</button></div>';
  }

  function render() {
    var st = ensureState();
    if (st.loading) return '<p class="muted">' + esc(t().loading) + '</p>';
    if (!st.loaded) return '<p class="muted">' + esc(t().loading) + '</p>';
    if (!global.InfoContent && !global.LegalContent) {
      return '<p class="hint-block">' + esc((t().info && t().info.scriptsMissing) || 'Contenus par défaut non chargés — vérifiez index.html admin.') + '</p>' + renderEditor();
    }
    return renderEditor();
  }

  function buildAllDefaultContent() {
    var full = {};
    PAGES.forEach(function (p) {
      full[p] = {};
      LANGS.forEach(function (lg) {
        full[p][lg] = getDefaultDoc(p, lg);
      });
    });
    return full;
  }

  async function seedSheetFromDefaultsIfEmpty(st, res) {
    if (!res || !res.sheetEmpty) return;
    var payload = buildAllDefaultContent();
    if (st.content && Object.keys(st.content).length) {
      PAGES.forEach(function (p) {
        if (!st.content[p]) return;
        LANGS.forEach(function (lg) {
          if (st.content[p][lg]) payload[p][lg] = mergeDoc(payload[p][lg], st.content[p][lg]);
        });
      });
    }
    try {
      var seed = await d.erpCall('updateInfoContent', { content: payload });
      if (seed && seed.success) {
        st.content = seed.content || payload;
        toast((t().info && t().info.sheetSeeded) || t().saved, 's');
      }
    } catch (e) {
      toast(e.message || t().error, 'e');
    }
  }

  async function load() {
    var st = ensureState();
    st.loading = true;
    d.renderMain();
    try {
      var res = await d.erpCall('getInfoContent', {});
      if (res && res.success) st.content = res.content || {};
      else st.content = {};
      st.loaded = true;
      await seedSheetFromDefaultsIfEmpty(st, res);
    } catch (e) {
      toast(e.message || t().error, 'e');
      st.content = {};
      st.loaded = true;
    }
    st.loading = false;
    d.renderMain();
  }

  function setPage(page) {
    syncFormToState();
    var st = ensureState();
    st.page = page || 'returns';
    d.renderMain();
  }

  function setLang(lang) {
    syncFormToState();
    var st = ensureState();
    st.lang = lang || 'pt';
    d.renderMain();
  }

  function addSection() {
    syncFormToState();
    var st = ensureState();
    var doc = getDoc(st, st.page, st.lang);
    doc.sections.push({ h: '', p: [''] });
    setDoc(st, st.page, st.lang, doc);
    d.renderMain();
  }

  function removeSection(idx) {
    syncFormToState();
    var st = ensureState();
    var doc = getDoc(st, st.page, st.lang);
    doc.sections.splice(idx, 1);
    if (!doc.sections.length) doc.sections.push({ h: '', p: [''] });
    setDoc(st, st.page, st.lang, doc);
    d.renderMain();
  }

  async function resetCurrent() {
    var st = ensureState();
    if (st.content[st.page]) delete st.content[st.page][st.lang];
    if (st.content[st.page] && !Object.keys(st.content[st.page]).length) delete st.content[st.page];
    try {
      var res = await d.erpCall('updateInfoContent', { content: st.content });
      if (!res || !res.success) {
        toast((res && res.error) || t().error, 'e');
        return;
      }
      st.content = res.content || st.content;
      toast((t().info && t().info.resetOk) || t().saved, 's');
    } catch (e) {
      toast(e.message || t().error, 'e');
    }
    d.renderMain();
  }

  async function save() {
    syncFormToState();
    var st = ensureState();
    try {
      var res = await d.erpCall('updateInfoContent', { content: st.content });
      if (!res || !res.success) {
        toast((res && res.error) || t().error, 'e');
        return;
      }
      st.content = res.content || st.content;
      toast((t().info && t().info.saved) || t().saved, 's');
    } catch (e) {
      toast(e.message || t().error, 'e');
    }
  }

  function install(deps) {
    d = deps;
    return { render: render, load: load, setPage: setPage, setLang: setLang, addSection: addSection, removeSection: removeSection, resetCurrent: resetCurrent, save: save };
  }

  global.AdminInfo = { install: install };
})(typeof window !== 'undefined' ? window : this);
