/**
 * AZAVISION Admin — Gestion produits & promotions (module pro)
 */
(function (global) {
  'use strict';

  var d = null;

  function t() { return d.t(); }
  function esc(s) { return d.esc(s); }
  function toast(msg, type) { if (global.toast) global.toast(msg, type); }

  function normCat(p) {
    return String((p && p.catalogo_status) || 'publicado').toLowerCase().trim();
  }

  function productThumb(url) {
    if (!url) return '<span class="prod-thumb empty">—</span>';
    var u = String(url);
    if (u.indexOf('drive.google.com') >= 0 && u.indexOf('thumbnail') < 0) {
      var m = u.match(/[?&]id=([^&]+)/);
      if (m) u = 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w120';
    }
    return '<img class="prod-thumb" src="' + esc(u) + '" alt=""/>';
  }

  function statusBadge(p) {
    var pr = t().prod;
    var cs = normCat(p);
    var cls = cs === 'publicado' ? 'badge-pub' : cs === 'agendado' ? 'badge-sched' : 'badge-draft';
    var lbl = cs === 'publicado' ? pr.statusPublished : cs === 'agendado' ? pr.statusScheduled : pr.statusDraft;
    var extra = cs === 'agendado' && p.publicar_em ? ' · ' + esc(formatDate(p.publicar_em)) : '';
    return '<span class="badge ' + cls + '">' + esc(lbl) + extra + '</span>';
  }

  function formatDate(v) {
    if (!v) return '';
    try {
      var dt = new Date(v);
      if (isNaN(dt.getTime())) return String(v);
      var loc = { fr: 'fr-FR', pt: 'pt-PT', en: 'en-GB', es: 'es-ES' };
      return dt.toLocaleString(loc[d.state.lang] || 'pt-PT', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) { return String(v); }
  }

  function productStatusNorm(p) {
    return String((p && p.status) || '').toLowerCase().trim();
  }

  function isTrashProduct(p) {
    return productStatusNorm(p) === 'lixeira';
  }

  function filteredProducts() {
    var rows = d.state.products.slice();
    var f = d.state.productFilter;
    if (f === 'trash') {
      return rows.filter(isTrashProduct);
    }
    rows = rows.filter(function (p) { return !isTrashProduct(p); });
    if (f === 'published') rows = rows.filter(function (p) { return normCat(p) === 'publicado'; });
    else if (f === 'scheduled') rows = rows.filter(function (p) { return normCat(p) === 'agendado'; });
    else if (f === 'draft') rows = rows.filter(function (p) { return normCat(p) === 'rascunho'; });
    return rows;
  }

  function productTabCounts() {
    var rows = d.state.products || [];
    var isTrash = d.state.productFilter === 'trash';
    if (isTrash) return { all: 0, published: 0, scheduled: 0, draft: 0, trash: rows.length };
    var c = { all: rows.length, published: 0, scheduled: 0, draft: 0, trash: null };
    rows.forEach(function (p) {
      var cs = normCat(p);
      if (cs === 'publicado') c.published++;
      else if (cs === 'agendado') c.scheduled++;
      else if (cs === 'rascunho') c.draft++;
    });
    return c;
  }

  function tabLabel(key, lbl, counts) {
    var n = counts && counts[key];
    if (n == null || n === '') return lbl;
    return lbl + ' (' + n + ')';
  }

  function selectedIds() {
    var sel = d.state.productSelected || {};
    return Object.keys(sel).filter(function (k) { return sel[k]; });
  }

  function renderProducts() {
    var p = t().prod;
    var rows = filteredProducts();
    var isTrash = d.state.productFilter === 'trash';
    var counts = productTabCounts();
    var selCount = selectedIds().length;
    var bulkBar = selCount > 0 ? '<div class="bulk-bar">' +
      '<span>' + selCount + ' ' + esc(p.selected) + '</span>' +
      (isTrash
        ? '<button type="button" class="btn-sm" onclick="Admin.bulkProducts(\'restore\')">' + esc(p.bulkRestore) + '</button>' +
          '<button type="button" class="btn-sm danger" onclick="Admin.bulkProducts(\'purge\')">' + esc(p.bulkPurge) + '</button>'
        : '<button type="button" class="btn-sm" onclick="Admin.bulkProducts(\'catalog_publish\')">' + esc(p.bulkPublish) + '</button>' +
          '<button type="button" class="btn-sm" onclick="Admin.bulkProducts(\'catalog_draft\')">' + esc(p.bulkDraft) + '</button>' +
          '<button type="button" class="btn-sm danger" onclick="Admin.bulkProducts(\'delete\')">' + esc(p.bulkTrash) + '</button>') +
      '</div>' : '';

    return bulkBar +
      '<div class="toolbar">' +
      '<div class="tabs tabs-scroll">' +
      ['all', 'published', 'scheduled', 'draft', 'trash'].map(function (m) {
        var lbl = m === 'all' ? p.all : m === 'published' ? p.published : m === 'scheduled' ? p.scheduled : m === 'draft' ? p.draft : p.trash;
        lbl = tabLabel(m, lbl, counts);
        return '<button type="button" class="tab' + (d.state.productFilter === m ? ' on' : '') + '" onclick="Admin.setProductFilter(\'' + m + '\')">' + esc(lbl) + '</button>';
      }).join('') +
      '</div>' +
      (!isTrash ? '<input class="search-in" placeholder="' + esc(t().search) + '" value="' + esc(d.state.productSearch) + '" oninput="Admin.setProductSearch(this.value)"/>' : '') +
      '<button type="button" class="btn-ghost" onclick="Admin.syncDrive()">' + esc((t().wiz && t().wiz.syncDrive) || 'Sync Drive') + '</button>' +
      (!isTrash ? '<button type="button" class="btn-primary" onclick="Admin.editProduct(null)">' + esc(p.new) + '</button>' : '') +
      '</div>' +
      '<div class="table-wrap"><table class="data-table prod-table"><thead><tr>' +
      '<th class="chk-cell"><input type="checkbox" onchange="Admin.toggleAllProducts(this.checked)"/></th>' +
      '<th></th><th>' + esc(p.name) + '</th><th>' + esc(p.category) + '</th><th>€</th><th>' + esc(p.stockTotal) + '</th><th>' + esc(p.catalogStatus) + '</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (pr) {
        var pid = esc(pr.produto_id).replace(/'/g, "\\'");
        var checked = d.state.productSelected[pr.produto_id] ? ' checked' : '';
        var vCount = (pr.variantes && pr.variantes.length) || 0;
        var actions = '';
        if (isTrash) {
          actions = '<button type="button" class="btn-sm" onclick="Admin.restoreProduct(\'' + pid + '\')">' + esc(p.restore) + '</button>' +
            '<button type="button" class="btn-sm danger" onclick="Admin.purgeProduct(\'' + pid + '\')">' + esc(p.purge) + '</button>';
        } else {
          actions = '<button type="button" class="btn-sm" onclick="Admin.editProduct(\'' + pid + '\')">' + esc(t().edit) + '</button>' +
            '<button type="button" class="btn-sm" onclick="Admin.duplicateProduct(\'' + pid + '\')" title="' + esc(p.duplicate) + '">⧉</button>';
          if (normCat(pr) !== 'publicado') {
            actions += '<button type="button" class="btn-sm" onclick="Admin.quickPublishProduct(\'' + pid + '\')">' + esc(p.publishNow) + '</button>';
          }
          if (normCat(pr) === 'publicado') {
            actions += '<button type="button" class="btn-sm" onclick="Admin.quickDraftProduct(\'' + pid + '\')">' + esc(p.toDraft) + '</button>';
          }
          actions += '<button type="button" class="btn-sm danger" onclick="Admin.deleteProduct(\'' + pid + '\')">' + esc(t().delete) + '</button>';
        }
        return '<tr>' +
          '<td class="chk-cell"><input type="checkbox"' + checked + ' onchange="Admin.toggleProductSelect(\'' + pid + '\', this.checked)"/></td>' +
          '<td class="thumb-cell">' + productThumb(pr.imagem_thumb_sm || pr.imagem) + '</td>' +
          '<td><strong>' + esc(pr.nome) + '</strong><br/><span class="row-meta">' + esc(pr.produto_id) + (vCount ? ' · ' + vCount + ' ' + esc(p.variants) : '') + '</span></td>' +
          '<td>' + esc(pr.categoria) + '</td><td>' + esc(pr.preco_final) + '</td><td>' + esc(pr.stock_total != null ? pr.stock_total : '—') + '</td>' +
          '<td>' + statusBadge(pr) + '</td><td class="actions">' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="8" class="muted">' + esc(t().noData) + '</td></tr>') +
      '</tbody></table></div>';
  }

  function renderPromotions() {
    var pm = t().promo || { title: 'Promotions' };
    var tab = d.state.promoTab || 'coupons';
    var html = '<div class="tabs" style="margin-bottom:16px">' +
      '<button type="button" class="tab' + (tab === 'coupons' ? ' on' : '') + '" onclick="Admin.setPromoTab(\'coupons\')">' + esc(pm.couponsTab || t().cup.title) + '</button>' +
      '<button type="button" class="tab' + (tab === 'banner' ? ' on' : '') + '" onclick="Admin.setPromoTab(\'banner\')">' + esc(pm.bannerTab || 'Bandeau') + '</button>' +
      '</div>';
    if (tab === 'banner') return html + renderPromoBanner();
    return html + renderCouponsTable();
  }

  function renderPromoBanner() {
    var pm = t().promo || {};
    var vit = t().vit || {};
    var cfg = t().cfg || {};
    var cv = d.cfgVal;
    var on = cv('promo_banner_enabled', '0');
    var txt = cv('promo_banner_text', '');
    var annOn = cv('announcement_enabled', '0');
    return '<section class="panel"><h2>' + esc(pm.bannerTab || 'Bandeau') + '</h2>' +
      '<p class="hint-block">' + esc(pm.bannerDesc || vit.promoSectionHint || '') + '</p>' +
      '<label class="check-row"><input type="checkbox" id="promo_bar_display"' + (cv('promo_bar_display', '1') === '1' ? ' checked' : '') + '/> ' + esc(cfg.promoBarShow || vit.promoBarShow || 'Afficher le bandeau en haut') + '</label>' +
      '<label class="check-row"><input type="checkbox" id="promo_faixa_display"' + (cv('vitrine_display_promo_faixa', '1') === '1' ? ' checked' : '') + '/> ' + esc(vit.showPromoFaixa || 'Afficher le contenu de la faixa') + '</label>' +
      '<label class="check-row"><input type="checkbox" id="promo_banner_on"' + (on === '1' ? ' checked' : '') + '/> ' + esc(pm.bannerOn || cfg.promoOn || '') + '</label>' +
      '<div class="field"><label>' + esc(pm.bannerText || cfg.promoText || '') + '</label><input id="promo_banner_text" value="' + esc(txt) + '" placeholder="✦ {{promo_label}} · -{{pct}}% COM O CÓDIGO {{code}} ✦"/></div>' +
      '<p class="field-help">' + esc(vit.annHint || 'Variables : {{code}}, {{pct}}, {{promo_label}}, {{valid_until}}…') + '</p>' +
      '<label class="check-row"><input type="checkbox" id="promo_show_default"' + (cv('promo_banner_show_default', '0') === '1' ? ' checked' : '') + '/> ' + esc(cfg.promoShowDefault || vit.promoShowDefault || 'Texte par défaut si faixa vide') + '</label>' +
      '<p class="field-help" style="margin:16px 0 8px"><strong>' + esc(vit.annTitle || 'Campanha / Anúncio') + '</strong></p>' +
      '<label class="check-row"><input type="checkbox" id="ann_enabled"' + (annOn === '1' ? ' checked' : '') + '/> ' + esc(vit.annOn || 'Ativar campanha (prioridade sobre faixa)') + '</label>' +
      '<label class="check-row"><input type="checkbox" id="ann_marquee"' + (cv('announcement_marquee', '1') === '1' ? ' checked' : '') + '/> ' + esc(vit.annMarquee || 'Texto deslizante') + '</label>' +
      '<div class="field"><label>' + esc(vit.annText || 'Texto do anúncio') + '</label><input id="ann_text" value="' + esc(cv('announcement_text', '')) + '"/></div>' +
      '<div class="fgrid"><div class="field"><label>{{code}}</label><input id="ann_code" value="' + esc(cv('announcement_promo_code', '')) + '" placeholder="BIENVENUE10"/></div>' +
      '<div class="field"><label>{{pct}}</label><input id="ann_pct" value="' + esc(cv('announcement_promo_pct', '')) + '" placeholder="10"/></div></div>' +
      '<div class="fgrid"><div class="field"><label>' + esc(vit.annStart || 'Data início') + '</label><input id="ann_start" type="date" value="' + esc(String(cv('announcement_date_start', '')).slice(0, 10)) + '"/></div>' +
      '<div class="field"><label>' + esc(vit.annEnd || 'Data fim') + '</label><input id="ann_end" type="date" value="' + esc(String(cv('announcement_date_end', '')).slice(0, 10)) + '"/></div></div>' +
      '<button type="button" class="btn-primary" onclick="Admin.savePromoBanner()">' + esc(pm.saveBanner || t().save) + '</button></section>';
  }

  function renderCouponsTable() {
    var c = t().cup;
    var rows = (d.state.coupons || []).filter(function (cup) {
      var st = String(cup.status || 'ativo').toLowerCase();
      return d.state.couponFilter === 'inactive' ? st === 'inativo' : st !== 'inativo';
    });
    return '<div class="toolbar">' +
      '<div class="tabs">' +
      '<button type="button" class="tab' + (d.state.couponFilter === 'active' ? ' on' : '') + '" onclick="Admin.setCouponFilter(\'active\')">' + esc(c.active) + '</button>' +
      '<button type="button" class="tab' + (d.state.couponFilter === 'inactive' ? ' on' : '') + '" onclick="Admin.setCouponFilter(\'inactive\')">' + esc(c.inactive) + '</button>' +
      '</div>' +
      '<button type="button" class="btn-primary" onclick="Admin.editCoupon(null)">' + esc(c.new) + '</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>' + esc(c.code) + '</th><th>' + esc(c.type) + '</th><th>' + esc(c.value) + '</th><th>' + esc(c.minOrder) + '</th><th>' + esc(c.internalNoteShort || c.internalNote || 'Note') + '</th><th>' + esc(c.startDate) + '</th><th>' + esc(c.endDate) + '</th><th>' + esc(c.usage) + '</th><th>' + esc(c.status) + '</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (cup) {
        var id = esc(cup.cupon_id || cup.cupom_id || cup.codigo).replace(/'/g, "\\'");
        var tipoLbl = cup.tipo === 'percent' ? c.percent : cup.tipo === 'fixed' ? c.fixed : c.freeShip;
        var uso = esc(cup.uso_atual || 0) + (cup.uso_max ? ' / ' + esc(cup.uso_max) : '');
        var minO = cup.pedido_minimo ? esc(cup.pedido_minimo) + ' €' : '—';
        var noteRaw = String(cup.nota_interna || '').trim();
        var noteCell = noteRaw
          ? '<span class="cup-internal-note" title="' + esc(noteRaw) + '">' + esc(noteRaw.length > 42 ? noteRaw.slice(0, 42) + '…' : noteRaw) + '</span>'
          : '<span class="muted">—</span>';
        return '<tr><td><strong>' + esc(cup.codigo) + '</strong></td><td>' + esc(tipoLbl) + '</td><td>' + esc(cup.valor) + '</td><td>' + minO + '</td><td>' + noteCell + '</td>' +
          '<td>' + esc(formatDate(cup.data_inicio)) + '</td><td>' + esc(formatDate(cup.data_fim) || '—') + '</td><td>' + uso + '</td>' +
          '<td><span class="badge ' + (String(cup.status).toLowerCase() === 'ativo' ? 'badge-pub' : 'badge-draft') + '">' + esc(cup.status || 'ativo') + '</span></td>' +
          '<td class="actions">' +
          (d.state.couponFilter === 'active'
            ? '<button type="button" class="btn-sm" onclick="Admin.editCoupon(\'' + id + '\')">' + esc(t().edit) + '</button>' +
              '<button type="button" class="btn-sm danger" onclick="Admin.removeCoupon(\'' + id + '\')">' + esc(t().delete) + '</button>'
            : '') +
          '</td></tr>';
      }).join('') : '<tr><td colspan="10" class="muted">' + esc(t().noData) + '</td></tr>') +
      '</tbody></table></div>';
  }

  function cupValueHint(tipo) {
    var c = t().cup;
    if (tipo === 'fixed') return c.valueHintFixed || '';
    if (tipo === 'free_shipping') return c.valueHintShip || '';
    return c.valueHintPercent || '';
  }

  function couponModalHtml(cup) {
    var c = t().cup;
    var isEdit = !!cup;
    var tipo = cup ? cup.tipo : 'percent';
    var cats = (d.state.categories || []).map(function (cat) {
      var n = cat.nome || '';
      var sel = cup && String(cup.categoria || '') === n ? ' selected' : '';
      return '<option value="' + esc(n) + '"' + sel + '>' + esc(n) + '</option>';
    }).join('');
    return '<div class="modal-inner modal-coupon"><h2>' + esc(isEdit ? c.edit : c.new) + '</h2>' +
      '<p class="hint-block">' + esc(c.formComplete || '') + '</p>' +
      '<section class="panel" style="margin-bottom:12px"><h2 style="font-size:11px;margin-bottom:10px">' + esc(c.code) + '</h2>' +
      '<div class="field"><label>' + esc(c.code) + ' *</label><input id="cup_code" value="' + esc(cup ? cup.codigo : '') + '"' + (isEdit ? ' readonly' : '') + ' placeholder="PROMO2026"/></div>' +
      '<div class="field"><label>' + esc(c.desc) + '</label><input id="cup_desc" value="' + esc(cup ? (cup.descricao || '') : '') + '"/></div>' +
      '<div class="field"><label>' + esc(c.internalNote || 'Note interne (admin)') + '</label>' +
      '<textarea id="cup_internal_note" rows="2" placeholder="' + esc(c.internalNotePlaceholder || 'Ex. : groupe VIP, client Marie…') + '">' + esc(cup ? (cup.nota_interna || '') : '') + '</textarea>' +
      '<p class="field-help">' + esc(c.internalNoteHelp || 'Visible uniquement dans l\'admin — jamais sur la vitrine client.') + '</p></div>' +
      '<div class="field"><label>' + esc(c.status) + '</label><select id="cup_status">' +
      '<option value="ativo"' + (!cup || String(cup.status).toLowerCase() !== 'inativo' ? ' selected' : '') + '>' + esc(c.active) + '</option>' +
      '<option value="inativo"' + (cup && String(cup.status).toLowerCase() === 'inativo' ? ' selected' : '') + '>' + esc(c.inactive) + '</option></select></div></section>' +
      '<section class="panel" style="margin-bottom:12px"><h2 style="font-size:11px;margin-bottom:10px">' + esc(c.type) + ' & ' + esc(c.value) + '</h2>' +
      '<div class="field"><label>' + esc(c.type) + '</label><select id="cup_type" onchange="var h=document.getElementById(\'cup_val_hint\');if(h){var t=this.value;h.textContent=t===\'fixed\'' + "?'"+ esc(c.valueHintFixed || '').replace(/'/g, "\\'") + "':t==='free_shipping'?'"+ esc(c.valueHintShip || '').replace(/'/g, "\\'") + "':'"+ esc(c.valueHintPercent || '').replace(/'/g, "\\'") + "';}\">" +
      '<option value="percent"' + (tipo === 'percent' ? ' selected' : '') + '>' + esc(c.percent) + '</option>' +
      '<option value="fixed"' + (tipo === 'fixed' ? ' selected' : '') + '>' + esc(c.fixed) + '</option>' +
      '<option value="free_shipping"' + (tipo === 'free_shipping' ? ' selected' : '') + '>' + esc(c.freeShip) + '</option></select></div>' +
      '<div class="field"><label>' + esc(c.value) + '</label><input id="cup_val" type="number" step="0.01" min="0" value="' + esc(cup ? cup.valor : '') + '"/>' +
      '<span class="hint-block" id="cup_val_hint" style="margin-top:4px">' + esc(cupValueHint(tipo)) + '</span></div>' +
      '<div class="fgrid"><div class="field"><label>' + esc(c.minOrder) + '</label><input id="cup_min" type="number" step="0.01" min="0" value="' + esc(cup && cup.pedido_minimo ? cup.pedido_minimo : '') + '" placeholder="0"/></div>' +
      '<div class="field"><label>' + esc(c.maxUsage) + '</label><input id="cup_max" type="number" min="0" value="' + esc(cup ? (cup.uso_max || 0) : '0') + '"/><span class="hint-block">' + (isEdit ? esc(c.currentUsage) + ': ' + esc(cup.uso_atual || 0) : '') + '</span></div></div></section>' +
      '<section class="panel" style="margin-bottom:12px"><h2 style="font-size:11px;margin-bottom:10px">' + esc(c.startDate) + '</h2>' +
      '<div class="fgrid"><div class="field"><label>' + esc(c.startDate) + '</label><input id="cup_start" type="date" value="' + esc(cup && cup.data_inicio ? String(cup.data_inicio).slice(0, 10) : '') + '"/></div>' +
      '<div class="field"><label>' + esc(c.endDate) + '</label><input id="cup_end" type="date" value="' + esc(cup && cup.data_fim ? String(cup.data_fim).slice(0, 10) : '') + '"/></div></div>' +
      '<div class="field"><label>' + esc(c.category) + '</label><select id="cup_cat"><option value="">' + esc(c.categoryHint || '—') + '</option>' + cats + '</select></div></section>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" onclick="Admin.closeModal()">' + esc(t().cancel) + '</button>' +
      '<button type="button" class="btn-primary" onclick="Admin.saveCoupon(\'' + esc(isEdit ? (cup.cupon_id || cup.cupom_id || '') : '').replace(/'/g, "\\'") + '\')">' + esc(t().save) + '</button></div></div>';
  }

  async function setProductFilter(m) {
    m = String(m || 'all');
    if (d.state.productFilter === m && d.state.view === 'products') {
      d.renderMain();
      return;
    }
    d.state.productFilter = m;
    d.state.productSelected = {};
    d.state.products = [];
    d.state.loading = true;
    d.renderMain();
    try {
      await d.loadProducts();
    } catch (e) {
      toast((e && e.message) || t().error, 'e');
    } finally {
      d.state.loading = false;
    }
    d.renderMain();
  }

  var _prodSearchT;
  function setProductSearch(v) {
    d.state.productSearch = v;
    clearTimeout(_prodSearchT);
    _prodSearchT = setTimeout(async function () {
      d.state.products = [];
      d.state.loading = true;
      d.renderMain();
      try {
        await d.loadProducts();
      } catch (e) {
        toast((e && e.message) || t().error, 'e');
      } finally {
        d.state.loading = false;
      }
      d.renderMain();
    }, 400);
  }

  function toggleProductSelect(id, on) {
    if (!d.state.productSelected) d.state.productSelected = {};
    if (on) d.state.productSelected[id] = true;
    else delete d.state.productSelected[id];
    d.renderMain();
  }

  function toggleAllProducts(on) {
    d.state.productSelected = {};
    if (on) filteredProducts().forEach(function (p) { d.state.productSelected[p.produto_id] = true; });
    d.renderMain();
  }

  async function bulkProducts(action) {
    var ids = selectedIds();
    if (!ids.length) return;
    var p = t().prod;
    if (action === 'purge' && !confirm(p.confirmPurge)) return;
    if (action === 'delete' && !confirm(p.confirmDelete)) return;
    try {
      var res = await d.erpCall('bulkProductAction', { ids: ids, action: action });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      d.state.productSelected = {};
      toast(t().saved + (res.processed != null ? ' (' + res.processed + '/' + res.total + ')' : ''), 's');
      await d.loadProducts();
      d.renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  async function restoreProduct(id) {
    if (!confirm(t().prod.confirmRestore)) return;
    try {
      var res = await d.erpCall('restoreProduct', { id: id, produto_id: id });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      await d.loadProducts();
      d.renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  async function purgeProduct(id) {
    if (!confirm(t().prod.confirmPurge)) return;
    try {
      var res = await d.erpCall('permanentlyDeleteProduct', { id: id, produto_id: id });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      await d.loadProducts();
      d.renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  async function duplicateProduct(id) {
    try {
      var res = await d.erpCall('duplicateProduct', { id: id });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      d.state.productFilter = 'draft';
      await d.loadProducts();
      d.renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  async function quickPublishProduct(id) {
    try {
      var res = await d.erpCall('updateProduct', { produto_id: id, catalogo_status: 'publicado', publicar_em: '' });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      await d.loadProducts();
      d.renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  async function quickDraftProduct(id) {
    try {
      var res = await d.erpCall('updateProduct', { produto_id: id, catalogo_status: 'rascunho', publicar_em: '' });
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      toast(t().saved, 's');
      await d.loadProducts();
      d.renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  function setPromoTab(tab) {
    d.state.promoTab = tab;
    if (tab === 'banner') d.loadConfig().then(function () { d.renderMain(); });
    else d.renderMain();
  }

  function setCouponFilter(f) {
    d.state.couponFilter = f;
    d.renderMain();
  }

  async function savePromoBanner() {
    try {
      var txt = ($('promo_banner_text') && $('promo_banner_text').value) || '';
      var faixaOn = ($('promo_banner_on') && $('promo_banner_on').checked) || !!String(txt).trim();
      var res = await d.erpCall('updateConfig', {
        promo_bar_display: ($('promo_bar_display') && $('promo_bar_display').checked) ? '1' : '0',
        vitrine_display_promo_faixa: ($('promo_faixa_display') && $('promo_faixa_display').checked) ? '1' : '0',
        promo_banner_enabled: faixaOn ? '1' : '0',
        promo_banner_text: txt,
        promo_banner_show_default: ($('promo_show_default') && $('promo_show_default').checked) ? '1' : '0',
        announcement_enabled: ($('ann_enabled') && $('ann_enabled').checked) ? '1' : '0',
        announcement_display: '1',
        announcement_marquee: ($('ann_marquee') && $('ann_marquee').checked) ? '1' : '0',
        announcement_text: ($('ann_text') && $('ann_text').value) || '',
        announcement_promo_code: ($('ann_code') && $('ann_code').value.trim()) || '',
        announcement_promo_pct: ($('ann_pct') && $('ann_pct').value.trim()) || '',
        announcement_date_start: ($('ann_start') && $('ann_start').value) || '',
        announcement_date_end: ($('ann_end') && $('ann_end').value) || ''
      });
      if (!res || !res.success) { toast(t().error, 'e'); return; }
      toast(t().saved, 's');
      await d.loadConfig();
    } catch (e) { toast(e.message, 'e'); }
  }

  function $(id) { return document.getElementById(id); }

  function editCoupon(id) {
    var cup = null;
    if (id) {
      cup = (d.state.coupons || []).find(function (x) {
        return String(x.cupon_id || x.cupom_id || '') === id || String(x.codigo || '').toUpperCase() === String(id).toUpperCase();
      });
    }
    var open = function () { d.openModal(couponModalHtml(cup), { wide: true }); };
    if (!d.state.categories || !d.state.categories.length) {
      (d.loadCategories ? d.loadCategories() : Promise.resolve()).then(open);
    } else open();
  }

  async function saveCoupon(id) {
    var code = ($('cup_code') && $('cup_code').value.trim()) || '';
    if (!code) { toast(t().noData, 'e'); return; }
    var payload = {
      codigo: code,
      tipo: ($('cup_type') && $('cup_type').value) || 'percent',
      valor: parseFloat($('cup_val') && $('cup_val').value) || 0,
      data_inicio: ($('cup_start') && $('cup_start').value) || '',
      data_fim: ($('cup_end') && $('cup_end').value) || '',
      uso_max: parseInt($('cup_max') && $('cup_max').value, 10) || 0,
      descricao: ($('cup_desc') && $('cup_desc').value) || '',
      nota_interna: ($('cup_internal_note') && $('cup_internal_note').value.trim()) || '',
      pedido_minimo: ($('cup_min') && $('cup_min').value) ? parseFloat($('cup_min').value) : '',
      categoria: ($('cup_cat') && $('cup_cat').value) || '',
      status: ($('cup_status') && $('cup_status').value) || 'ativo'
    };
    try {
      var res;
      if (id) {
        payload.cupon_id = id;
        res = await d.erpCall('updateCoupon', payload);
      } else {
        res = await d.erpCall('createCoupon', payload);
      }
      if (!res || !res.success) { toast((res && res.error) || t().error, 'e'); return; }
      d.closeModal();
      toast(t().saved, 's');
      await d.loadCoupons();
      d.renderMain();
    } catch (e) { toast(e.message, 'e'); }
  }

  function install(deps) {
    d = deps;
    return {
      renderProducts: renderProducts,
      renderPromotions: renderPromotions,
      setProductFilter: setProductFilter,
      setProductSearch: setProductSearch,
      toggleProductSelect: toggleProductSelect,
      toggleAllProducts: toggleAllProducts,
      bulkProducts: bulkProducts,
      restoreProduct: restoreProduct,
      purgeProduct: purgeProduct,
      duplicateProduct: duplicateProduct,
      quickPublishProduct: quickPublishProduct,
      quickDraftProduct: quickDraftProduct,
      setPromoTab: setPromoTab,
      setCouponFilter: setCouponFilter,
      savePromoBanner: savePromoBanner,
      editCoupon: editCoupon,
      saveCoupon: saveCoupon
    };
  }

  global.AdminPro = { install: install };
})(typeof window !== 'undefined' ? window : this);
