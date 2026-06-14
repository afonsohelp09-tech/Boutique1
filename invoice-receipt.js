/**
 * AZAVISION — Reçu / facture (aperçu + impression)
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function money(v) {
    var n = parseFloat(v);
    return isNaN(n) ? '0.00' : n.toFixed(2);
  }

  /** Aperçu compact après paiement (léger, pas de re-fetch). */
  function previewHtml(inv, labels) {
    labels = labels || {};
    if (!inv || !inv.success) return '';
    var order = inv.order || {};
    var totals = inv.totals || {};
    var lines = (inv.lines || []).slice(0, 4);
    var more = (inv.lines || []).length > 4 ? (inv.lines.length - 4) : 0;
    var rows = lines.map(function (ln) {
      return '<div class="rc-line"><span class="rc-name">' + esc(ln.nome) + ' × ' + esc(ln.quantidade) + '</span>' +
        '<span class="rc-amt">' + money(ln.subtotal_ttc) + ' €</span></div>';
    }).join('');
    if (more > 0) {
      rows += '<p class="rc-more">+' + more + ' ' + esc(labels.moreItems || 'articles') + '</p>';
    }
    return '<div class="receipt-card">' +
      '<div class="rc-head"><span class="rc-type">' + esc(labels.receiptTitle || 'Comprovativo') + '</span>' +
      '<span class="rc-ref">' + esc(inv.invoiceRef || order.pedido_id || '') + '</span></div>' +
      '<div class="rc-body">' + rows +
      (totals.iva && parseFloat(totals.iva) > 0
        ? '<div class="rc-line rc-iva"><span>' + esc(labels.iva || 'IVA') + ' (23 %)</span><span class="rc-amt">' + money(totals.iva) + ' €</span></div>'
        : '') +
      '<div class="rc-total"><span>' + esc(labels.total || 'Total c/ IVA') + '</span><strong>' + money(totals.total) + ' €</strong></div>' +
      (labels.disclaimer ? '<p class="rc-disc">' + esc(labels.disclaimer) + '</p>' : '') +
      (inv.fiscal_doc_url ? '<p class="rc-disc"><a href="' + esc(inv.fiscal_doc_url) + '" target="_blank" rel="noopener noreferrer">' + esc(labels.fiscalPdf || 'Fatura oficial (PDF)') + '</a></p>' : '') + '</div>' +
      '<div class="rc-actions">' +
      '<button type="button" class="btn-rc" onclick="Shop.printInvoice()">' + esc(labels.print || 'Imprimer') + '</button>' +
      '<button type="button" class="btn-rc btn-rc-ghost" onclick="Shop.downloadInvoice()">' + esc(labels.download || 'Télécharger PDF') + '</button>' +
      '</div></div>';
  }

  function openPrintDocument(html) {
    if (!html) return false;
    var w = global.open('', '_blank', 'noopener,noreferrer,width=820,height=960');
    if (!w) return false;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function () {
      try { w.print(); } catch (e) { /* ignore */ }
    }, 450);
    return true;
  }

  global.InvoiceReceipt = {
    previewHtml: previewHtml,
    openPrintDocument: openPrintDocument
  };

  // Guide API : ce module n’a pas de clé — voir 01-vitrine-client/index.html (fin)
  // et 03-google-apps-script/api_apps_script.gs (fin, Ctrl+End)
})(typeof window !== 'undefined' ? window : this);
