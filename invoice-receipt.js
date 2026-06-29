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

  function printViaIframe_(html) {
    try {
      var existing = document.getElementById('azv-print-frame');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      var iframe = document.createElement('iframe');
      iframe.id = 'azv-print-frame';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
      document.body.appendChild(iframe);
      var doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(function () {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) { /* ignore */ }
      }, 500);
      return true;
    } catch (e) {
      return false;
    }
  }

  function openPrintDocument(html) {
    if (!html) return false;
    var w = null;
    // Pas de "noopener" : sinon window.open renvoie null et l'impression échoue.
    try { w = global.open('', '_blank', 'width=820,height=960'); } catch (e) { w = null; }
    if (w && w.document) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(function () {
        try { w.print(); } catch (e) { /* ignore */ }
      }, 450);
      return true;
    }
    // Repli (popup bloqué, fréquent sur mobile) : impression via iframe caché.
    return printViaIframe_(html);
  }

  /** Extrait styles + corps d'un document HTML complet pour le rendu PDF. */
  function extractBody_(html) {
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var styles = '';
      var st = doc.head ? doc.head.querySelectorAll('style') : [];
      for (var i = 0; i < st.length; i++) styles += st[i].outerHTML;
      return styles + (doc.body ? doc.body.innerHTML : html);
    } catch (e) { return html; }
  }

  /**
   * Vrai téléchargement PDF via html2pdf (chargé dans index.html).
   * Repli automatique vers l'impression (« Enregistrer en PDF ») si la librairie est absente
   * ou échoue — utile aussi sur mobile.
   */
  function downloadPdf(html, filename) {
    if (!html) return false;
    if (!global.html2pdf) return openPrintDocument(html);
    try {
      var container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;';
      container.innerHTML = extractBody_(html);
      document.body.appendChild(container);
      var cleanup = function () { if (container.parentNode) container.parentNode.removeChild(container); };
      global.html2pdf().set({
        margin: 8,
        filename: filename || 'comprovativo.pdf',
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(container).save().then(cleanup).catch(function () {
        cleanup();
        openPrintDocument(html);
      });
      return true;
    } catch (e) {
      return openPrintDocument(html);
    }
  }

  global.InvoiceReceipt = {
    previewHtml: previewHtml,
    openPrintDocument: openPrintDocument,
    downloadPdf: downloadPdf
  };

  // Guide API : ce module n’a pas de clé — voir 01-vitrine-client/index.html (fin)
  // et 03-google-apps-script/api_apps_script.gs (fin, Ctrl+End)
})(typeof window !== 'undefined' ? window : this);
