# Zavi Collection

Professional e-commerce storefront and admin dashboard.

## Quick start

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and configure `MONGODB_URI` for persistent product and order storage. MongoDB is required for production persistence.
3. Start the development server: `npm run dev`
4. Open the admin dashboard at `/admin`.

For Vercel production, configure `MONGODB_URI`, `ADMIN_KEY`, and `ADMIN_SESSION_SECRET` in the project's environment variables. `ADMIN_SESSION_SECRET` must contain at least 32 bytes. The current admin login uses `ADMIN_KEY` and `ADMIN_SESSION_SECRET`.

# ZaviMart local payment setup

ZaviMart supports Safepay hosted checkout, manual Easypaisa wallet transfers, and Cash on Delivery (COD). The browser never receives payment credentials or decides the payable amount. The server calculates prices from its catalog and creates orders. Safepay orders are marked paid only after a verified webhook; Easypaisa transfers remain pending until checked manually; COD orders are confirmed but remain payable on delivery. When configured, the backend automatically sends an order summary to the shop WhatsApp number through Meta's WhatsApp Cloud API.

Checkout includes an optional delivery map. The customer explicitly requests an address lookup, then may drag the marker or click the map to refine the location. Selected coordinates are saved with the order. Lookup uses OpenStreetMap tiles and the public Nominatim service, restricted to Pakistan and throttled to one upstream search per second; availability depends on that public service.

## Requirements

- Node.js 20 or newer and npm
- A Safepay merchant account with sandbox credentials
- A Meta WhatsApp Business app with Cloud API access, a sender phone-number ID, and an approved order-update template
- A publicly reachable HTTPS URL for Safepay's webhook callback when testing outside your local environment

## Run locally

1. Copy `config/.env.example` to `.env`.
2. Add your Safepay sandbox API key, v1 secret, and webhook secret to `.env`. Set `EASYPAISA_ACCOUNT_NUMBER` to the Easypaisa receiving number customers should pay. Keep `.env` private and never commit it.
3. For automatic WhatsApp order summaries, set `WHATSAPP_CLOUD_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_ADMIN_NUMBER` in `.env`. Create and approve a WhatsApp message template named by `WHATSAPP_ORDER_TEMPLATE`; it must have twelve body placeholders in this order: order ID, order/payment status, customer name, customer email, customer phone, delivery address, delivery map link, item names/quantities/unit prices/line totals, subtotal, shipping, grand total, and payment method/Easypaisa reference. Match `WHATSAPP_TEMPLATE_LANGUAGE` to its approved language.
4. Install dependencies with `npm install`.
5. Set `NEXT_APP_URL` to the storefront origin and `APP_BASE_URL` to the payment backend origin in your local environment. Start the payment backend with `npm run dev:backend` and the Next.js app with `npm run dev` in separate terminals. The backend uses `NEXT_APP_URL` to validate imported product prices, stock, and required variant selections; open the storefront URL printed by the Next.js development server.
6. For local webhook testing, expose port 4242 using a trusted HTTPS tunnel and set `APP_BASE_URL` to that HTTPS URL.
7. In the Safepay merchant dashboard, configure the webhook URL as `https://YOUR_PUBLIC_HOST/api/payments/safepay/webhook` and enable payment status events.

Use Safepay sandbox credentials and sandbox environment for testing. Switch `SAFEPAY_ENVIRONMENT` and credentials only after Safepay activates your live merchant account. Never test live charges with real customer card details.

## Important deployment notes

- Deploy the frontend and API together behind HTTPS, or configure the frontend API origin deliberately; the browser calls same-origin `/api` endpoints.
- Set `APP_BASE_URL` to the canonical public HTTPS origin.
- Set `NEXT_APP_URL` on the payment backend to the canonical public HTTPS origin of the Next.js storefront so imported products can be securely validated during checkout.
- `.data/orders.json` is a small local development store, not a production database. Replace it with a transactional database before serving real customers, and define retention/access controls for customer delivery data.
- Configure Safepay's webhook URL in its dashboard. A redirect back to the result page is not proof of payment; only the signature-verified webhook changes the stored payment status to `paid`.
- Product prices are duplicated in `server/server.js` intentionally: the server copy is authoritative. Update the server catalog whenever product prices change in `public/legacy/script.js`.
- The payment result page keeps the cart until the server confirms the payment. Failed, cancelled, or pending payments do not clear it.
- Easypaisa manual transfer is not an automatic gateway integration. The customer submits a transaction reference; an operator must verify it in Easypaisa before fulfilling the order. Do not mark these orders paid based only on the submitted reference.
- COD orders are saved as confirmed orders with `pay_on_delivery` status. Collect cash at delivery and update the order status through your order-management process.
- Automatic WhatsApp sending requires Meta's approved template and Cloud API credentials. If they are not configured, order completion opens a prefilled WhatsApp draft to the owner number and shows a fallback link; the user must review and tap Send. The health endpoint reports `whatsappNotificationConfigured` so setup can be checked without exposing credentials.

## Next.js catalog and COD API

When MongoDB is not configured, supplier imports are saved locally to `data/markaz-products.json`; the data directory is created on first import. The mock catalog API and homepage include these products. This demo storage can be lost on redeploy; configure `MONGODB_URI` for persistent storage.

Markaz option definitions and variant combinations (including stock status) are imported from the public product page data without splitting combined option labels. Required selections are checked again by the checkout backend, unavailable combinations are disabled on the storefront, and selected options plus the matched supplier variant ID are saved with the order for manual supplier fulfillment. With the Next.js app running and `ADMIN_KEY` set in `.env.local`, run `node scripts/fix-variants.js` to re-fetch variant data for existing imported products. Products whose public pages do not expose structured options are reported as skipped. The project does not currently place orders through a Markaz fulfillment API.

The App Router catalog API uses MongoDB. Copy `config/.env.local.example` to `.env.local`, replace the `MONGODB_URI` placeholders with a MongoDB Atlas connection string, and set a private `ZAVIMART_ADMIN_API_KEY`. In Atlas, create a database user and allow your development machine's IP under Network Access. Keep both values server-only. When `MONGODB_URI` is unset, catalog reads use the in-memory mock catalog; writes and order operations require MongoDB. Product creation/update/deletion and order listing require `Authorization: Bearer <ZAVIMART_ADMIN_API_KEY>`; product reads and COD order creation remain public.

Open `/admin` to add catalog products. The key field defaults to `zavi123` and can be changed to the configured admin key.
Open `/admin/product-import` to import supplier product details, calculate the per-item profit and margin, and load COD orders containing imported products. The page defaults to the admin key `zavi123` and can be changed to the configured key; order details are copied to the clipboard for supplier fulfillment. Product/order profit is the gross product margin (selling price minus wholesale price), before delivery or other costs.

Admin pages require a signed, HTTP-only session. Set the server-only `ADMIN_KEY` and a separate `ADMIN_SESSION_SECRET` containing at least 32 bytes of random data. Sign in at `/admin/login`; sessions expire after eight hours. Unauthenticated visits to admin pages redirect to `/admin/login`. The admin login page is a client component, so it submits the entered key to the server-side `/api/admin/session` handler, which reads `process.env.ADMIN_KEY` without exposing it to the browser. Existing API routes continue to enforce their own API-key authorization.

- `GET /api/products` accepts `id` to fetch one product, or `category`, `search`, `flashDeals=true`, and `limit` for a product list. Responses include storefront aliases (`name`, `image`, `oldPrice`, `rating`, and `reviews`).
- `POST /api/products` creates a product. `GET`, `PUT`, and `DELETE /api/products/:id` read or manage one product.
- `POST /api/products/import` imports a supplier product and requires the admin key. Provide the source URL, title, category, wholesale price, selling price, selected main image, image list, and optional supplier details and rating/review metadata. Imported products are marked `isMarkazProduct` internally; the 18 seeded and mock catalog products remain non-imported.
- `GET /api/scrape?url=...` fetches Markaz product metadata, including product images, rating, review count, and description.
- Supplier products link to `/product/:id`, where customers can view product details and add them to the cart.
- `GET /api/categories` returns the storefront categories with their product counts. `GET /api/search?q=...` searches product titles.
- `POST /api/orders` accepts `products: [{ productId, qty }]` and customer `name`, `phone`, `address`, and `city`; it creates a COD order using current catalog prices. Delivery is free for subtotals above Rs 2,999 and otherwise costs Rs 299.
- `GET /api/orders` returns orders newest-first and requires the admin key because order records contain customer contact and delivery information.

These routes are separate from the existing Express `/api/checkout` flow used by the current checkout form.

The Next.js app runs with `npm run dev` (port 3001), builds with `npm run build`, and starts in production with `npm start` (port 3000). The Express payment service is a separate process: use `npm run dev:backend` during development or `npm run start:backend` in production. Configure `NEXT_PUBLIC_API_URL` to point the checkout proxy at that backend.

Legacy standalone storefront and payment pages remain in `public/legacy/` for the Express payment flow. The primary storefront is the Next.js page in `app/`. Shared images and icons are in `public/logos/` and `public/images/`. Next.js environment files (such as `.env.local`) remain at the project root as required by the framework.

To populate the catalog with repeatable development data, configure `MONGODB_URI` in the environment, `.env.local`, or `.env` and run `npm run seed`. The script upserts 18 sample products (two in each category), including one flash deal per category; re-running it updates the same seed products instead of duplicating them.
