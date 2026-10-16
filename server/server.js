import "dotenv/config";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { Safepay } from "@sfpy/node-sdk";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const legacyDirectory = join(root, "public", "legacy");
const dataDirectory = join(root, ".data");
const ordersPath = join(dataDirectory, "orders.json");
const orderCountersPath = join(dataDirectory, "order-counters.json");
const shippingSettingsPath = join(dataDirectory, "shipping.json");
const app = express();
const port = Number(process.argv[2] || process.env.PORT || 4242);
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
const nextAppUrl = process.env.NEXT_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const defaultShippingSettings = {
  freeDeliveryEnabled: true,
  minAmountForFree: 2999,
  shippingFee: 149,
  bannerText: "Free delivery above Rs 2,999",
  updatedAt: new Date().toISOString()
};
const easypaisaAccountNumber = String(process.env.EASYPAISA_ACCOUNT_NUMBER || "").trim();
const whatsappAccessToken = process.env.WHATSAPP_CLOUD_API_TOKEN || "";
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const whatsappAdminNumber = String(process.env.WHATSAPP_ADMIN_NUMBER || "").replace(/\D/g, "");
const whatsappTemplateName = process.env.WHATSAPP_ORDER_TEMPLATE || "";
const whatsappTemplateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";
const whatsappApiVersion = process.env.WHATSAPP_API_VERSION || "v24.0";
const whatsappConfigured = Boolean(
  whatsappAccessToken && whatsappPhoneNumberId && whatsappAdminNumber && whatsappTemplateName
);
const catalog = new Map([
  [1, 74999],
  [2, 4999],
  [3, 28999],
  [4, 2499],
  [5, 57999],
  [6, 3999],
  [7, 1599],
  [8, 69999],
  [9, 419999],
  [10, 179999],
  [11, 8999],
  [12, 2999],
  [13, 6999],
  [14, 129999],
  [15, 4999],
  [16, 1999],
  [17, 14999],
  [18, 11999],
  [19, 6499],
  [20, 3499],
  [21, 9999],
  [22, 4999],
  [23, 1899],
  [24, 1599],
  [25, 899],
  [26, 3299],
  [27, 10999],
  [28, 24999],
  [29, 5999],
  [30, 2499]
]);

function variantSlug(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getVariantAttribute(attributes, name) {
  if (!attributes || typeof attributes !== "object") return undefined;
  const target = variantSlug(name);
  const entry = Object.entries(attributes).find(([key]) => variantSlug(key) === target);
  return entry?.[1];
}

function isVariantInStock(combination) {
  return combination.in_stock !== false &&
    combination.inStock !== false &&
    combination.stock !== 0;
}

async function getStorefrontProduct(id) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  let url;
  try {
    url = new URL(`/api/products/${encodeURIComponent(id)}`, nextAppUrl);
  } catch {
    throw new Error("NEXT_APP_URL must be a valid URL to resolve imported products.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("NEXT_APP_URL must use HTTP or HTTPS without embedded credentials.");
  }
  const result = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (result.status === 404) return null;
  if (!result.ok) throw new Error(`Storefront product lookup returned HTTP ${result.status}.`);
  const payload = await result.json();
  const product = payload?.product;
  if (!product || product._id !== id || typeof product.title !== "string" ||
      !Number.isFinite(product.price) || product.price < 0 ||
      !Number.isInteger(product.stock) || product.stock < 0 || product.isActive === false) {
    throw new Error("Storefront product lookup returned invalid product data.");
  }
  return product;
}

async function getShippingSettings() {
  let settings;
  try {
    settings = JSON.parse(await readFile(shippingSettingsPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return defaultShippingSettings;
    throw error;
  }
  if (
    !settings || typeof settings !== "object" ||
    typeof settings.freeDeliveryEnabled !== "boolean" ||
    typeof settings.minAmountForFree !== "number" || !Number.isFinite(settings.minAmountForFree) ||
    settings.minAmountForFree < 0 ||
    typeof settings.shippingFee !== "number" || !Number.isFinite(settings.shippingFee) ||
    settings.shippingFee < 0
  ) {
    throw new Error(".data/shipping.json contains invalid shipping settings.");
  }
  return settings;
}
const productNames = new Map([
  [1, "Samsung Galaxy A35 5G"],
  [2, "Khaadi Lawn Printed Set"],
  [3, "Braun Air Fryer 4.2L"],
  [4, "Hydrating Face Serum"],
  [5, "AirPods Pro 2"],
  [6, "Premium Cotton Bedsheet Set"],
  [7, "Dettol Hygiene Kit"],
  [8, "Haier 8kg Washing Machine"],
  [9, "iPhone 15 Pro"],
  [10, "HP Pavilion 14 Laptop"],
  [11, "Nike Air Max Runner"],
  [12, "Golden Basmati Rice 10kg"],
  [13, "Philips Beard Trimmer"],
  [14, "Hisense 1.5 Ton Inverter AC"],
  [15, "Anker 20W USB-C Fast Charger"],
  [16, "Magnetic Phone Case"],
  [17, "JBL Portable Bluetooth Speaker"],
  [18, "Smart Fitness Watch"],
  [19, "Classic Denim Jacket"],
  [20, "Everyday Crossbody Bag"],
  [21, "Nonstick Cookware Set"],
  [22, "Decorative Table Lamp"],
  [23, "Daily Moisturizing Cream"],
  [24, "Everyday Sunscreen SPF 50"],
  [25, "Premium Green Tea 100 Bags"],
  [26, "Extra Virgin Olive Oil 1L"],
  [27, "Philips 500W Blender"],
  [28, "Cordless Stick Vacuum"],
  [29, "Digital Blood Pressure Monitor"],
  [30, "First Aid Kit 80-Piece"]
]);
const safepayConfigured = Boolean(
  process.env.SAFEPAY_API_KEY &&
    process.env.SAFEPAY_V1_SECRET &&
    process.env.SAFEPAY_WEBHOOK_SECRET
);
const safepay = safepayConfigured
  ? new Safepay({
      environment: process.env.SAFEPAY_ENVIRONMENT || "sandbox",
      apiKey: process.env.SAFEPAY_API_KEY,
      v1Secret: process.env.SAFEPAY_V1_SECRET,
      webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET
    })
  : null;

let orders = {};
let saveQueue = Promise.resolve();
let orderCounters = {};
let orderCounterQueue = Promise.resolve();
let lastGeocodingRequestAt = 0;
const geocodeCache = new Map();

app.use(express.json({ limit: "32kb" }));
app.use(
  "/api/checkout",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false
  })
);

function sendLegacyFile(file, response) {
  response.sendFile(join(legacyDirectory, file));
}

app.use(express.static(join(root, "public")));
app.get("/", (_request, response) => sendLegacyFile("index.html", response));
app.get("/index.html", (_request, response) => sendLegacyFile("index.html", response));
app.get("/checkout.html", (_request, response) => sendLegacyFile("checkout.html", response));
app.get("/payment-result.html", (_request, response) => sendLegacyFile("payment-result.html", response));
app.get("/styles.css", (_request, response) => sendLegacyFile("styles.css", response));
app.get("/script.js", (_request, response) => sendLegacyFile("script.js", response));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    paymentProviderConfigured: Boolean(safepay),
    easypaisaConfigured: Boolean(easypaisaAccountNumber),
    whatsappNotificationConfigured: whatsappConfigured,
    cashOnDeliveryAvailable: true
  });
});

app.get("/api/shipping", async (_request, response) => {
  try {
    const settings = await getShippingSettings();
    return response
      .set("Cache-Control", "no-store, max-age=0")
      .json(settings);
  } catch (error) {
    console.error("Could not load shipping settings:", error);
    return response.status(503).json({ error: "Delivery settings are temporarily unavailable." });
  }
});

app.get("/api/geocode", rateLimit({ windowMs: 60_000, limit: 10 }), async (request, response) => {
  const query = String(request.query.q || "").trim().slice(0, 240);
  if (query.length < 8) {
    return response.status(400).json({ error: "Enter a more complete delivery address." });
  }

  const cachedResult = geocodeCache.get(query.toLowerCase());
  if (cachedResult) return response.json(cachedResult);

  const waitRemaining = 1000 - (Date.now() - lastGeocodingRequestAt);
  if (waitRemaining > 0) {
    return response.status(429).json({ error: "Please wait a moment before searching for another address." });
  }
  lastGeocodingRequestAt = Date.now();

  try {
    const geocodeUrl = new URL("https://nominatim.openstreetmap.org/search");
    geocodeUrl.searchParams.set("format", "jsonv2");
    geocodeUrl.searchParams.set("limit", "1");
    geocodeUrl.searchParams.set("countrycodes", "pk");
    geocodeUrl.searchParams.set("q", query);
    const geocodeResponse = await fetch(geocodeUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ZaviMart/1.0 (checkout address lookup)"
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!geocodeResponse.ok) {
      return response.status(502).json({ error: "Address lookup is temporarily unavailable." });
    }

    const results = await geocodeResponse.json();
    if (!results.length) {
      return response.status(404).json({ error: "No match found. Try a nearby landmark or select a pin manually." });
    }

    const result = {
      latitude: Number(results[0].lat),
      longitude: Number(results[0].lon),
      displayName: String(results[0].display_name || "Located address").slice(0, 220)
    };
    geocodeCache.set(query.toLowerCase(), result);
    return response.json(result);
  } catch (error) {
    console.error("Address lookup failed:", error.message);
    return response.status(502).json({ error: "Address lookup failed. Try again or select a pin manually." });
  }
});

function getOrderDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}${values.month}${values.day}`;
}

function allocateOrderId() {
  const date = getOrderDateKey();
  const counterKey = `zavimart_last_order_${date}`;
  const allocation = orderCounterQueue.then(async () => {
    const existingDailyCount = Object.values(orders).reduce((highest, order) => {
      const match = String(order.id || order.orderId || "").match(new RegExp(`^ZV-${date}-(\\d+)$`));
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 1000);
    const nextCounter = Math.max(Number(orderCounters[counterKey]) || 1000, existingDailyCount) + 1;
    const nextCounters = { ...orderCounters, [counterKey]: nextCounter };
    await mkdir(dataDirectory, { recursive: true });
    const temporaryPath = `${orderCountersPath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(nextCounters, null, 2), { mode: 0o600 });
    await rename(temporaryPath, orderCountersPath);
    orderCounters = nextCounters;
    return `ZV-${date}-${String(nextCounter).padStart(4, "0")}`;
  });
  orderCounterQueue = allocation.then(() => undefined, () => undefined);
  return allocation;
}

app.post("/api/checkout", async (request, response) => {
  const paymentMethod = request.body?.paymentMethod || "cod";
  if (!new Set(["safepay", "easypaisa", "cod"]).has(paymentMethod)) {
    return response.status(400).json({ error: "Choose a supported payment method." });
  }
  if (paymentMethod === "safepay" && !safepay) {
    return response.status(503).json({
      error: "Online payments are not configured. Add Safepay credentials to the server environment."
    });
  }
  if (paymentMethod === "easypaisa" && !easypaisaAccountNumber) {
    return response.status(503).json({ error: "Easypaisa transfers are not configured." });
  }

  const { items, customer } = request.body || {};
  if (!Array.isArray(items) || items.length === 0 || items.length > 40 || !customer) {
    return response.status(400).json({ error: "Your cart or customer details are invalid." });
  }
  const couponCode = String(request.body?.couponCode || "").trim().toUpperCase();
  if (couponCode && couponCode !== "ZAVI10") {
    return response.status(400).json({ error: "The coupon code is invalid." });
  }

  const customerDetails = {
    name: String(customer.name || "").trim().slice(0, 120),
    email: String(customer.email || "").trim().slice(0, 254),
    phone: String(customer.phone || "").trim().slice(0, 24),
    alternatePhone: String(customer.alternatePhone || "").trim().slice(0, 24),
    city: String(customer.city || "").trim().slice(0, 100),
    areaSector: String(customer.areaSector || "").trim().slice(0, 160),
    streetAddress: String(customer.streetAddress || customer.address || "").trim().slice(0, 240),
    postalCode: String(customer.postalCode || "").trim().slice(0, 20)
  };
  customerDetails.address = [customerDetails.streetAddress, customerDetails.areaSector]
    .filter(Boolean)
    .join(", ");
  customerDetails.fullAddress = [customerDetails.streetAddress, customerDetails.areaSector, customerDetails.city]
    .filter(Boolean)
    .join(", ");

  const rawLatitude = customer.deliveryLocation?.latitude;
  const rawLongitude = customer.deliveryLocation?.longitude;
  const hasLatitude = rawLatitude !== undefined && rawLatitude !== null && rawLatitude !== "";
  const hasLongitude = rawLongitude !== undefined && rawLongitude !== null && rawLongitude !== "";
  if (hasLatitude !== hasLongitude) {
    return response.status(400).json({ error: "The delivery pin must include both map coordinates." });
  }

  if (hasLatitude) {
    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return response.status(400).json({ error: "The selected delivery pin is invalid." });
    }
    customerDetails.deliveryLocation = { latitude, longitude };
  }

  const normalizedPhone = customerDetails.phone.replace(/[()\s-]/g, "");
  const normalizedAlternatePhone = customerDetails.alternatePhone.replace(/[()\s-]/g, "");
  if (
    !customerDetails.name ||
    !/^(?:\+92|0092|0)?3\d{9}$/.test(normalizedPhone) ||
    (customerDetails.alternatePhone && !/^(?:\+92|0092|0)?3\d{9}$/.test(normalizedAlternatePhone)) ||
    !customerDetails.areaSector ||
    !customerDetails.streetAddress ||
    !customerDetails.city
  ) {
    return response.status(400).json({ error: "Please provide valid delivery and contact details." });
  }

  const resolvedItems = new Map();
  const productQuantities = new Map();
  try {
    for (const item of items) {
      const id = typeof item?.id === "string" || typeof item?.id === "number" ? String(item.id).trim() : "";
      const quantity = Number(item?.quantity);
      if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        return response.status(400).json({ error: "One or more cart items are invalid." });
      }

      const staticId = /^\d+$/.test(id) ? Number(id) : NaN;
      let product;
      let unitPrice;
      if (Number.isSafeInteger(staticId) && catalog.has(staticId)) {
        product = { id: staticId, title: productNames.get(staticId) || `Product ${staticId}`, stock: 100 };
        unitPrice = catalog.get(staticId);
      } else {
        product = await getStorefrontProduct(id);
        if (!product) return response.status(400).json({ error: "One or more cart products are no longer available." });
        unitPrice = product.price;
      }

      const definitions = Array.isArray(product.variants) ? product.variants : [];
      if (product.hasVariants === true && definitions.length === 0) {
        return response.status(409).json({ error: `Options for ${product.title} are temporarily unavailable.` });
      }
      const rawSelected = item?.selectedVariants ?? {};
      if (!rawSelected || typeof rawSelected !== "object" || Array.isArray(rawSelected) ||
          !Object.entries(rawSelected).every(([key, value]) => key && typeof value === "string")) {
        return response.status(400).json({ error: "Product variant selections are invalid." });
      }
      const selectedVariants = {};
      for (const definition of definitions) {
        const selected = rawSelected[definition.name] ??
          rawSelected[definition.slug] ??
          rawSelected[variantSlug(definition.name)];
        if (definition.required && (typeof selected !== "string" || !definition.options.includes(selected))) {
          return response.status(400).json({ error: `Please select ${definition.name} for ${product.title}.` });
        }
        if (selected !== undefined) {
          if (typeof selected !== "string" || !definition.options.includes(selected)) {
            return response.status(400).json({ error: `The selected ${definition.name} is not available.` });
          }
          selectedVariants[definition.name] = selected;
        }
      }
      if (Object.keys(rawSelected).some((key) => !definitions.some((definition) =>
        key === definition.name || key === definition.slug || key === variantSlug(definition.name)
      ))) {
        return response.status(400).json({ error: "One or more selected product options are invalid." });
      }

      const combinations = Array.isArray(product.variantCombinations) ? product.variantCombinations : [];
      const matchedCombination = combinations.find((combination) =>
        isVariantInStock(combination) &&
        Object.keys(selectedVariants).length > 0 &&
        Object.entries(selectedVariants).every(([key, value]) => getVariantAttribute(combination.attributes, key) === value)
      );
      if (combinations.length && !matchedCombination) {
        return response.status(400).json({ error: `That variant combination is not available for ${product.title}.` });
      }
      if (matchedCombination && Number.isInteger(matchedCombination.stock) &&
          quantity > matchedCombination.stock) {
        return response.status(409).json({ error: `Only ${matchedCombination.stock} of the selected ${product.title} variant are available.` });
      }
      if (quantity > product.stock) {
        return response.status(409).json({ error: `Insufficient stock for ${product.title}.` });
      }

      const key = `${id}:${JSON.stringify(Object.entries(selectedVariants).sort(([a], [b]) => a.localeCompare(b)))}`;
      const existing = resolvedItems.get(key);
      if (existing) {
        existing.quantity += quantity;
        if (Number.isInteger(matchedCombination?.stock) && existing.quantity > matchedCombination.stock) {
          return response.status(409).json({ error: `Only ${matchedCombination.stock} of the selected ${product.title} variant are available.` });
        }
      } else resolvedItems.set(key, {
        id: product.id && Number.isSafeInteger(Number(product.id)) ? Number(product.id) : id,
        quantity,
        unitPrice,
        name: product.title,
        image: product.image || product.images?.[0] || "",
        selectedVariants,
        variantId: matchedCombination?.id || matchedCombination?.sku || "",
        variantString: definitions
          .map((definition) => selectedVariants[definition.name])
          .filter(Boolean)
          .join("-"),
        isMarkazProduct: product.isMarkazProduct === true,
        markazProductId: product.markazProductId || "",
        markazProductUrl: product.markazProductUrl || product.supplier?.productUrl || "",
        supplier: product.supplier || {}
      });
      const productQuantity = (productQuantities.get(id) || 0) + quantity;
      productQuantities.set(id, productQuantity);
      if (productQuantity > product.stock) {
        return response.status(409).json({ error: `Insufficient stock for ${product.title}.` });
      }
    }
  } catch (error) {
    console.error("Could not validate imported products for checkout:", error);
    return response.status(503).json({ error: "Imported products could not be verified right now. Please try again." });
  }
  const orderItems = [...resolvedItems.values()];
  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  let shippingSettings;
  try {
    shippingSettings = await getShippingSettings();
  } catch (error) {
    console.error("Could not load delivery settings for checkout:", error);
    return response.status(503).json({ error: "Delivery settings are temporarily unavailable." });
  }
  const qualifiesForFreeShipping = shippingSettings.freeDeliveryEnabled &&
    subtotal >= shippingSettings.minAmountForFree;
  const shipping = subtotal === 0 || qualifiesForFreeShipping ? 0 : shippingSettings.shippingFee;
  const discount = couponCode === "ZAVI10" ? Math.round(subtotal * 0.1) : 0;
  const orderId = await allocateOrderId();
  const order = {
    id: orderId,
    orderId,
    items: orderItems,
    customer: customerDetails,
    subtotal,
    couponCode: couponCode || null,
    discount,
    shipping,
    amount: subtotal - discount + shipping,
    currency: "PKR",
    paymentMethod,
    paymentStatus: paymentMethod === "easypaisa"
      ? "awaiting_easypaisa_transfer"
      : paymentMethod === "cod"
        ? "pay_on_delivery"
        : "pending",
    orderStatus: paymentMethod === "cod" ? "confirmed" : "awaiting_payment",
    createdAt: new Date().toISOString()
  };

  orders[order.id] = order;
  try {
    await persistOrders();
    if (paymentMethod === "easypaisa") {
      return response.status(201).json({
        orderId: order.orderId,
        amount: order.amount,
        subtotal: order.subtotal,
        discount: order.discount,
        shipping: order.shipping,
        currency: order.currency,
        accountNumber: easypaisaAccountNumber
      });
    }
    if (paymentMethod === "cod") {
      const whatsappNotificationSent = await notifyOrderOnWhatsApp(order);
      return response.status(201).json({
        orderId: order.orderId,
        amount: order.amount,
        subtotal: order.subtotal,
        discount: order.discount,
        shipping: order.shipping,
        currency: order.currency,
        paymentMethod: "cod",
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        whatsappNotificationSent,
        items: orderItems
      });
    }

    const { token } = await safepay.payments.create({ amount: order.amount, currency: "PKR" });
    const resultUrl = new URL("/payment-result.html", appBaseUrl);
    resultUrl.searchParams.set("order", order.id);
    const cancelUrl = new URL(resultUrl);
    cancelUrl.searchParams.set("cancelled", "1");
    const checkoutUrl = await safepay.checkout.create({
      token,
      orderId: order.orderId,
      cancelUrl: cancelUrl.toString(),
      redirectUrl: resultUrl.toString(),
      source: "custom",
      webhooks: true
    });

    response.status(201).json({
      checkoutUrl,
      orderId: order.orderId,
      amount: order.amount,
      subtotal: order.subtotal,
      discount: order.discount,
      shipping: order.shipping
    });
  } catch (error) {
    order.paymentStatus = "checkout_error";
    await persistOrders().catch(() => {});
    console.error("Safepay checkout creation failed:", error.message);
    response.status(502).json({ error: "Could not start secure checkout. Please try again." });
  }
});

app.post("/api/orders/:orderId/easypaisa-reference", async (request, response) => {
  const order = orders[request.params.orderId];
  if (!order || order.paymentMethod !== "easypaisa") {
    return response.status(404).json({ error: "Easypaisa order not found." });
  }
  if (order.paymentStatus !== "awaiting_easypaisa_transfer") {
    return response.status(409).json({ error: "A payment reference was already submitted for this order." });
  }

  const transactionReference = String(request.body?.transactionReference || "").trim();
  if (!/^[A-Za-z0-9-]{6,64}$/.test(transactionReference)) {
    return response.status(400).json({ error: "Enter a valid Easypaisa transaction ID." });
  }

  order.paymentReference = transactionReference;
  order.paymentStatus = "awaiting_manual_review";
  order.referenceSubmittedAt = new Date().toISOString();

  try {
    await persistOrders();
    const whatsappNotificationSent = await notifyOrderOnWhatsApp(order);
    return response.status(202).json({
      orderId: order.orderId,
      paymentStatus: order.paymentStatus,
      whatsappNotificationSent
    });
  } catch (error) {
    console.error("Could not save Easypaisa payment reference:", error.message);
    return response.status(500).json({ error: "Could not save your reference. Please try again." });
  }
});

app.post("/api/payments/safepay/webhook", async (request, response) => {
  if (!safepay) return response.sendStatus(503);

  let valid = false;
  try {
    valid = await safepay.verify.webhook(request);
  } catch (error) {
    console.error("Safepay webhook verification failed:", error.message);
  }
  if (!valid) return response.sendStatus(401);

  const payload = request.body || {};
  const detail = payload.data?.object || payload.data || payload;
  const orderId = String(
    detail.order_id || detail.orderId || detail.reference || payload.order_id || payload.orderId || ""
  );
  const paymentState = String(
    detail.status || detail.state || payload.type || payload.event || ""
  ).toLowerCase();
  const order = orders[orderId];
  if (!order) return response.sendStatus(404);
  let shouldNotifyWhatsApp = false;

  if (["paid", "success", "succeeded", "payment.succeeded", "payment.paid"].includes(paymentState)) {
    order.paymentStatus = "paid";
    order.paidAt = new Date().toISOString();
    shouldNotifyWhatsApp = true;
  } else if (["failed", "cancelled", "canceled", "payment.failed", "payment.cancelled"].includes(paymentState)) {
    order.paymentStatus = "failed";
  } else {
    return response.sendStatus(202);
  }

  try {
    await persistOrders();
    if (shouldNotifyWhatsApp) {
      await notifyOrderOnWhatsApp(order);
    }
    return response.sendStatus(204);
  } catch (error) {
    console.error("Could not persist Safepay payment update:", error.message);
    return response.sendStatus(500);
  }
});

app.get("/api/orders/:orderId", (request, response) => {
  const order = orders[request.params.orderId];
  if (!order) return response.status(404).json({ error: "Order not found." });

  response.json({
    orderId: order.orderId,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    orderStatus: order.orderStatus,
    amount: order.amount,
    currency: order.currency,
    whatsappNotificationSent: Boolean(order.whatsappNotificationSentAt)
  });
});

app.use((error, _request, response, _next) => {
  console.error("Request failed:", error.message);
  response.status(500).json({ error: "Something went wrong. Please try again." });
});

async function notifyOrderOnWhatsApp(order) {
  if (!whatsappConfigured) return false;
  if (order.whatsappNotificationSentAt) return true;

  const formatRupees = (amount) => `Rs ${new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 0
  }).format(amount)}`;
  const items = order.items
    .map((item) => {
      const itemName = item.name || productNames.get(item.id) || `Product ${item.id}`;
      const options = item.selectedVariants && Object.keys(item.selectedVariants).length
        ? ` (${Object.entries(item.selectedVariants).map(([name, value]) => `${name}: ${value}`).join(", ")})`
        : "";
      return `${itemName}${options} x ${item.quantity}`;
    })
    .join("\n");
  const address = [order.customer.address, order.customer.city]
    .filter(Boolean)
    .join(", ");
  const deliveryMapLink = order.customer.deliveryLocation
    ? `https://www.openstreetmap.org/?mlat=${order.customer.deliveryLocation.latitude}&mlon=${order.customer.deliveryLocation.longitude}#map=17/${order.customer.deliveryLocation.latitude}/${order.customer.deliveryLocation.longitude}`
    : "";
  const paymentDetails = [
    order.paymentMethod === "cod" ? "COD" : order.paymentMethod,
    order.paymentReference ? `Easypaisa ref: ${order.paymentReference}` : ""
  ].filter(Boolean).join(" | ");
  const parameters = [
    order.orderId,
    `New Order *${order.orderId}* Received`,
    order.customer.name,
    order.customer.email,
    order.customer.phone,
    address,
    deliveryMapLink || "Map pin not selected",
    items,
    formatRupees(order.subtotal),
    formatRupees(order.shipping),
    formatRupees(order.amount),
    paymentDetails
  ].map((text) => ({ type: "text", text: String(text).slice(0, 900) }));

  try {
    const endpoint = `https://graph.facebook.com/${whatsappApiVersion}/${whatsappPhoneNumberId}/messages`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${whatsappAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: whatsappAdminNumber,
        type: "template",
        template: {
          name: whatsappTemplateName,
          language: { code: whatsappTemplateLanguage },
          components: [{ type: "body", parameters }]
        }
      }),
      signal: AbortSignal.timeout(10000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("WhatsApp order notification failed:", result.error?.message || response.statusText);
      return false;
    }

    order.whatsappNotificationSentAt = new Date().toISOString();
    order.whatsappMessageId = result.messages?.[0]?.id || null;
    await persistOrders();
    return true;
  } catch (error) {
    console.error("WhatsApp order notification failed:", error.message);
    return false;
  }
}

async function persistOrders() {
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    await mkdir(dataDirectory, { recursive: true });
    const temporaryPath = `${ordersPath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(orders, null, 2), { mode: 0o600 });
    await rename(temporaryPath, ordersPath);
  });
  return saveQueue;
}

async function start() {
  await mkdir(dataDirectory, { recursive: true });
  try {
    orders = JSON.parse(await readFile(ordersPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    orderCounters = JSON.parse(await readFile(orderCountersPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  app.listen(port, () => {
    console.log(`ZaviMart server running at ${appBaseUrl}`);
    if (!safepay) console.warn("Safepay keys are missing; payment initiation is disabled.");
  });
}

start().catch((error) => {
  console.error("Server startup failed:", error);
  process.exitCode = 1;
});
