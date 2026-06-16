/**
 * @deprecated Ce fichier a été remplacé par le dossier legal/
 *
 * Voir legal/README.md pour mettre à jour les textes juridiques :
 *   legal/meta.js    — dates
 *   legal/privacy.js — politique de confidentialité
 *   legal/terms.js   — CGV
 *   legal/notice.js  — mentions légales
 *
 * index.html charge désormais legal/*.js directement.
 */
(function (global) {
  'use strict';
  if (global.LegalContent) return;
  console.warn('[AZAVISION] legal-content.js est obsolète — chargez legal/meta.js … legal/index.js');
})(typeof window !== 'undefined' ? window : this);
