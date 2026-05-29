# AGENTS.md

## Cursor Cloud specific instructions

This is a **static e-commerce storefront** (AZAVISION) with no build system, no package manager, and no dependencies to install. The site is vanilla HTML/CSS/JavaScript.

### Running the dev server

Serve the repository root with any static HTTP server:

```bash
python3 -m http.server 8080 --directory /workspace
```

Then open `http://localhost:8080/` in a browser.

### Linting / validation

There is no project-level lint config. Use these commands to validate:

- **HTML**: `npx htmlhint index.html` (or install htmlhint locally)
- **JS syntax**: `node --check erp-shop.js && node --check i18n.js && node --check icons-ui.js`

### Key files

| File | Purpose |
|------|---------|
| `index.html` | Main page + API/Stripe config at bottom of file |
| `erp-shop.js` | Core app logic (catalog, cart, orders, accounts) |
| `i18n.js` | Translations (FR, PT, EN, ES) |
| `icons-ui.js` | SVG icon definitions |
| `site.webmanifest` | PWA manifest |

### External dependencies

The backend is a **Google Apps Script** web app (not in this repo). The API URL is configured at the bottom of `index.html` in a `<script>` block (`ERP_API_URL_DEFAULT`). Products will not load without a valid deployed Apps Script backend.

### Notes

- No `package.json` exists; do not run `npm install` in the workspace root.
- The site uses `file://` protocol-incompatible fetch calls — always use an HTTP server.
- Theme (dark/light) and language (PT/EN/ES/FR) are toggled client-side via JS.
