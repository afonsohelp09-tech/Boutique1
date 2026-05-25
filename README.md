# Vitrine client — AZAVISION (01-vitrine-client)

Boutique en ligne basée sur le modèle **L'ATELIER** (`SITE/latelier-shop.html`), connectée à l’API **Google Apps Script** (`03-google-apps-script/api_apps_script.gs`).

## Fichiers (dossier vitrine)

Tout ce que vous voyez dans l’explorateur sous **`01-vitrine-client/`** sert la boutique en ligne :

| Emplacement | Fichiers | Rôle |
|-------------|----------|------|
| Racine | `index.html` | Page boutique + config API / Stripe en bas de fichier |
| Racine | `erp-shop.js` | Catalogue, panier, commandes, compte, images produits |
| Racine | `i18n.js` | Traductions **FR / PT / EN / ES** |
| Racine | `favicon.ico`, `site.webmanifest` | Onglet navigateur + PWA |
| **`icons/`** | `logo-nav.png`, `logo.png`, `favicon-*.png`, `icon-192/512.png`, … | **Logo barre de navigation**, pied de page, icônes app |
| **`icons/`** | `generate-icons.ps1`, `logo-source.jpeg` | Régénération des PNG depuis `LOGO/aza vision logos3.jpeg` |

Le logo en haut de la boutique est **`icons/logo-nav.png`** (référencé dans `index.html`). Ne pas le confondre avec `02-admin-erp/` (back-office).

## 1. Préparer Google Sheets

1. Coller `api_apps_script.gs` dans [script.google.com](https://script.google.com) (projet lié à votre classeur).
2. Ouvrir le Google Sheet → menu **ERP Vente en ligne** → **Initialiser les feuilles**.
3. Ajouter au moins un produit avec `catalogo_status` = **publicado** et `status` = **ativo**.
4. (Optionnel) Créer un cupom dans la feuille **CUPONS** (ex. `BIENVENUE10`, type `percent`, valeur `10`).

## 2. Déployer l’API Web

1. Apps Script → **Déployer** → **Nouveau déploiement** → **Application Web**.
2. Exécuter en tant que : **Moi** · Accès : **Tout le monde**.
3. Copier l’URL se terminant par **`/exec`**.

## 3. Configurer la vitrine

Ouvrir `index.html` et modifier le bloc **en bas du fichier** (Ctrl+End) :

```html
<script>
  // ▼▼▼ COLAR O URL AQUI — APENAS NESTA LINHA ▼▼▼
  var ERP_API_URL_DEFAULT = 'https://script.google.com/macros/s/VOTRE_ID_ICI/exec';
  var API_URL = ERP_API_URL_DEFAULT;
  // ▲▲▲

  // Stripe (si pay_stripe_enabled = 1 dans CONFIG Sheets)
  var STRIPE_PUBLISHABLE_KEY = 'pk_test_...';
</script>
```

**Important :** utilisez la **même URL `/exec`** dans `02-admin-erp` (admin) lorsque vous le créerez.

## 4. Publier la vitrine

- **GitHub Pages / hébergement** : publier **tout** le dossier `01-vitrine-client`, y compris le sous-dossier **`icons/`** (sinon le logo et les favicons ne s’affichent pas).
- **Local** : ouvrir `index.html` dans un navigateur — l’API doit être déployée en accès public.
- **Régénérer les logos** : `powershell -File icons/generate-icons.ps1` depuis ce dossier.

## Fonctions connectées à l’API

| Fonction boutique | Action API |
|-------------------|------------|
| Catalogue produits | `getProducts`, `getProduct`, `getCategories` |
| Avis (aperçu) | `getReviews` |
| Panier | `addToCart`, `getCart`, `removeFromCart`, `clearCart` |
| Code promo | `validateCoupon` |
| Commande | `createOrder`, `processPayment` |
| Paiement Stripe | `createStripePaymentIntent`, `confirmStripePayment` |
| Compte client | Inscription OTP (`sendRegistrationOTP`, `verifyRegistrationOTP`), `clientLogin`, mot de passe oublié, profil, adresses, `getOrders` / `getOrder` |
| Contact | Bouton flottant + formulaire → API `sendContactMessage` (e-mail admin + réponse au client) |
| Favoris (si connecté) | `addToWishlist`, `getWishlist`, `removeFromWishlist` |
| Newsletter | `subscribeNewsletter` |
| Marque / config | `getPublicBrand`, `getConfig`, `ping` |

## Paramètres CONFIG (Google Sheets)

Exemples de clés lues par la vitrine :

| Clé | Exemple | Effet |
|-----|---------|--------|
| `free_shipping_threshold` | `150` | Seuil livraison gratuite |
| `shipping_flat_rate` | `7.90` | Frais de port |
| `pay_stripe_enabled` | `1` | Active Stripe ( + clé `STRIPE_PUBLISHABLE_KEY` dans HTML ) |
| `pay_cod_enabled` | `1` | Paiement à la livraison |
| `promo_banner_text` | texte | Bandeau promo en haut |

## Dépannage

| Problème | Solution |
|----------|----------|
| Bandeau « API non configurée » | Remplacer `INSEREZ_VOTRE` par votre URL `/exec` |
| Aucun produit | Vérifier `catalogo_status=publicado`, `status=ativo` |
| Erreur CORS / fetch | Redéployer la Web App ; accès « Tout le monde » |
| Stripe échoue | `STRIPE_SECRET_KEY` dans propriétés du script + `STRIPE_PUBLISHABLE_KEY` dans HTML |
| Stock insuffisant | Vérifier feuilles **STOCK** / **VARIANTES** |

## Test rapide API

Dans la console du navigateur (après configuration) :

```javascript
fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action: 'ping', data: {} })
}).then(r => r.json()).then(console.log);
// Attendu : { success: true, message: 'pong', ... }
```
