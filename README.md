# ANYAI Digital Store

A professional static storefront for selling digital products (AI tools, software subscriptions, entertainment) — inspired by the layout of justeasysell.com, with original design and copy in English.

**Live site:** auto-deploys from this repo via Vercel (see "How deploy works" below).

## How it works

- Zero backend. All products, categories, FAQs and store info live in [`assets/products.js`](assets/products.js) as `window.ANYAI_DATA`.
- [`assets/app.js`](assets/app.js) renders everything from that data: product grid, live search, category chips, quick-view modal with plan selector, FAQ accordion.
- Every Buy / checkout button opens the store's Telegram shop (`store.telegram`) in a new tab — payments happen in the Telegram bot, where the wallet and USDT deposits already work.
- No external images: brand tiles are CSS gradients. No fabricated stats — products with `rating: null` show a "New" badge instead of fake stars.

## How to update products / prices

**Easy way** — edit the data file directly:

1. Open `products.json` (the source of truth).
2. Add, remove or edit products. Each product:
   ```json
   {
     "id": "unique-id",
     "name": "Product Name — Plan",
     "brand": "BrandName",
     "logo": "assets/logos/brandname.svg",
     "color": "#F26207",
     "price": 10.00,
     "compare_at": 29.99,
     "badge": "-67%",
     "access": "Redeem / on mail",
     "description": "Short customer-facing description.",
     "plans": [{ "label": "12 Months", "price": 10.00 }],
     "rating": null,
     "reviews": 0,
     "stock": null
   }
   ```
   - `logo`: path to the brand logo in `assets/logos/` (shown on the product card tile and in the quick-view modal). Omit or set `null` to fall back to the initial-letter gradient tile.
   - `color`: brand color hex — tints the logo tile background and its hover glow.
   - `compare_at`: struck-through original price; discount % is computed automatically. Use `null` for no strikethrough.
   - `badge`: ribbon text shown on the card (e.g. `"New"`, `"Best seller"`, `"Low stock"`, `"-67%"`). Use `null` for none.
   - `rating: null` hides stars and shows a "New" badge; `reviews: 0` hides the review count; `stock: null` hides the stock line. `stock <= 10` shows "Low stock".
   - `store.telegram` in the same file is the URL all Buy buttons open.
3. Regenerate the JS data file:
   ```bash
   python3 - <<'EOF'
   import json
   data = json.load(open('products.json'))
   js = "/* Edit this file to update products, or regenerate from products.json. */\n"
   js += "window.ANYAI_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";"
   open('assets/products.js','w').write(js + "\n")
   EOF
   ```
4. Commit and push — the site redeploys automatically.

**Quick way** — edit `assets/products.js` directly (same structure, plain JS). Keep `products.json` in sync when you do.

## How deploy works

- The site is deployed on **Vercel** as a static site, connected to this GitHub repo.
- **Push to `main` → Vercel auto-deploys.** Every push (or merged PR) triggers a new production deployment within a minute or two. No build step needed.
- Preview deployments are created automatically for pull requests.

## Local preview

Just open `index.html` in a browser, or serve the folder:

```bash
cd anyai-digital-store && python3 -m http.server 8080
# then open http://localhost:8080
```

## Project structure

```
anyai-digital-store/
├── index.html            # full page (all sections)
├── products.json         # editable source data: store, categories, products, faqs
├── assets/
│   ├── products.js       # generated from products.json (window.ANYAI_DATA)
│   ├── styles.css        # light theme, responsive
│   └── app.js            # rendering, search, filters, modal, FAQ
└── README.md
```
