# Admin ERP — AZAVISION (02-admin-erp)

Interface d’administration pour gérer tout ce qui s’affiche sur la **vitrine client** (`01-vitrine-client`).

## Fichiers

| Fichier | Rôle |
|---------|------|
| `index.html` | Interface admin (connexion, navigation, mobile) |
| `erp-admin.js` | Logique : produits, catégories, commandes, config vitrine |
| `i18n.js` | Traductions FR / PT / EN / ES |
| `icons/` | Logos et favicons (copiés depuis la vitrine) |

## Configuration API

Ouvrir `index.html` (Ctrl+End) et coller **la même URL `/exec`** que la vitrine :

```html
var ERP_API_URL_DEFAULT = 'https://script.google.com/macros/s/VOTRE_ID/exec';
var API_URL = ERP_API_URL_DEFAULT;
```

## Connexion admin

Utilisez un compte de la feuille **USERS** (Google Sheets), créé lors de l’initialisation ERP, avec le rôle **admin** et le statut **ativo**.

## Modules

| Section | Actions API |
|---------|-------------|
| **Tableau de bord** | `getDashboard` — KPI, commandes récentes, alertes stock |
| **Produits** | `getProducts`, `createProduct`, `updateProduct`, `deleteProduct` |
| **Catégories** | `getCategories`, `createCategory`, `updateCategory`, `deleteCategory` |
| **Commandes** | `getOrders`, `getOrder`, `updateOrderStatus`, `updateEntrega`, `exportOrdersCsv` |
| **Clients** | `getClients` |
| **Boutique (config)** | `getConfig`, `updateConfig` — livraison, paiements, bandeau promo, contact |
| **Codes promo** | `getCoupons`, `createCoupon`, `deleteCoupon` |

## Configuration vitrine (section « Boutique »)

Ces clés alimentent directement la vitrine client :

- `free_shipping_threshold`, `shipping_flat_rate`
- `pay_stripe_enabled`, `pay_cod_enabled`, `pay_show_*`
- `promo_banner_enabled`, `promo_banner_text`
- `store_email`, `contact_public_email`, `contact_whatsapp`
- `default_lang`

## Mobile

- Menu latéral (☰) sur écran &lt; 900 px
- Barre du bas : Tableau de bord · Produits · Commandes · Plus
- Formulaires et tableaux adaptés au tactile (boutons 44 px, champs 16 px)

## Publication

Publier le dossier `02-admin-erp` entier (HTML + JS + icons) sur le même hébergeur que la vitrine, ou ouvrir `index.html` en local si l’API est déployée en accès public.

**Important :** ne partagez pas l’URL admin publiquement sans protection ; réservez l’accès aux administrateurs.
