"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { PRODUCT_CATEGORIES } from "../../../lib/product-categories";
import styles from "./product-import.module.css";

type MarkazOrderProduct = {
  title: string;
  qty: number;
  price: number;
  isMarkazProduct?: boolean;
  wholesalePrice?: number;
  profit?: number;
  markazProductId?: string;
  supplier?: { name?: string; productUrl?: string; info?: string };
};

type MarkazOrder = {
  _id: string;
  orderId: string;
  customer: { name: string; phone: string; address: string; city: string };
  products: MarkazOrderProduct[];
  profit?: number;
  total: number;
  createdAt: string;
};

type ImportedProduct = { _id: string; title: string; slug: string; profit: number };
const DEFAULT_ADMIN_KEY = "zavi123";
const PRODUCT_IMPORT_DRAFT_KEY = "zavimart-markaz-import-draft";

type MarkazImportForm = {
  markazUrl: string;
  markazProductId: string;
  title: string;
  category: string;
  supplierName: string;
  images: string;
  wholesalePrice: number;
  sellingPrice: number;
  stock: number;
  supplierInfo: string;
  description: string;
};

const EMPTY_IMPORT_FORM: MarkazImportForm = {
  markazUrl: "",
  markazProductId: "",
  title: "",
  category: "",
  supplierName: "Supplier",
  images: "",
  wholesalePrice: 0,
  sellingPrice: 0,
  stock: 100,
  supplierInfo: "",
  description: ""
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMarkazOrder(value: unknown): MarkazOrder | null {
  if (
    !isRecord(value) ||
    typeof value._id !== "string" ||
    typeof value.orderId !== "string" ||
    typeof value.total !== "number" ||
    typeof value.createdAt !== "string" ||
    !isRecord(value.customer) ||
    typeof value.customer.name !== "string" ||
    typeof value.customer.phone !== "string" ||
    typeof value.customer.address !== "string" ||
    typeof value.customer.city !== "string" ||
    !Array.isArray(value.products)
  ) {
    return null;
  }

  const products: MarkazOrderProduct[] = [];
  for (const entry of value.products) {
    if (
      !isRecord(entry) ||
      typeof entry.title !== "string" ||
      typeof entry.qty !== "number" ||
      typeof entry.price !== "number"
    ) {
      return null;
    }
    const supplier = isRecord(entry.supplier)
      ? {
          name: typeof entry.supplier.name === "string" ? entry.supplier.name : undefined,
          productUrl: typeof entry.supplier.productUrl === "string" ? entry.supplier.productUrl : undefined,
          info: typeof entry.supplier.info === "string" ? entry.supplier.info : undefined
        }
      : undefined;
    products.push({
      title: entry.title,
      qty: entry.qty,
      price: entry.price,
      isMarkazProduct: entry.isMarkazProduct === true,
      wholesalePrice: typeof entry.wholesalePrice === "number" ? entry.wholesalePrice : undefined,
      profit: typeof entry.profit === "number" ? entry.profit : undefined,
      markazProductId: typeof entry.markazProductId === "string" ? entry.markazProductId : undefined,
      supplier
    });
  }

  return {
    _id: value._id,
    orderId: value.orderId,
    customer: {
      name: value.customer.name,
      phone: value.customer.phone,
      address: value.customer.address,
      city: value.customer.city
    },
    products,
    profit: typeof value.profit === "number" ? value.profit : undefined,
    total: value.total,
    createdAt: value.createdAt
  };
}

function formatRs(value: number) {
  return `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(value)}`;
}

export default function MarkazImportPage() {
  const [form, setForm] = useState<MarkazImportForm>(EMPTY_IMPORT_FORM);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [adminKey, setAdminKey] = useState(DEFAULT_ADMIN_KEY);
  const [usingDefaultAdminKey, setUsingDefaultAdminKey] = useState(false);
  const [usingDemoMode, setUsingDemoMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [urlAutofillMessage, setUrlAutofillMessage] = useState("");
  const [scrapedImages, setScrapedImages] = useState<string[]>([]);
  const [includedScrapedImages, setIncludedScrapedImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [scrapedRating, setScrapedRating] = useState(4.5);
  const [scrapedReviews, setScrapedReviews] = useState(100);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [importedProduct, setImportedProduct] = useState<ImportedProduct | null>(null);
  const [orders, setOrders] = useState<MarkazOrder[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/products?limit=100", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check admin key configuration.");
        const result: unknown = await response.json();
        if (
          !isRecord(result) ||
          typeof result.usingDefaultAdminKey !== "boolean" ||
          typeof result.usingDemoMode !== "boolean"
        ) {
          throw new Error("The server returned an invalid admin key configuration.");
        }
        if (!cancelled) {
          setUsingDefaultAdminKey(result.usingDefaultAdminKey);
          setUsingDemoMode(result.usingDemoMode);
        }
      })
      .catch((error: unknown) => {
        console.error("Could not check admin key configuration.", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(PRODUCT_IMPORT_DRAFT_KEY);
      if (savedDraft) {
        const parsed: unknown = JSON.parse(savedDraft);
        if (isRecord(parsed)) {
          setForm({
            markazUrl: typeof parsed.markazUrl === "string" ? parsed.markazUrl : EMPTY_IMPORT_FORM.markazUrl,
            markazProductId: typeof parsed.markazProductId === "string" ? parsed.markazProductId : EMPTY_IMPORT_FORM.markazProductId,
            title: typeof parsed.title === "string" ? parsed.title : EMPTY_IMPORT_FORM.title,
            category: typeof parsed.category === "string" ? parsed.category : EMPTY_IMPORT_FORM.category,
            supplierName: typeof parsed.supplierName === "string" ? parsed.supplierName : EMPTY_IMPORT_FORM.supplierName,
            images: typeof parsed.images === "string" ? parsed.images : EMPTY_IMPORT_FORM.images,
            wholesalePrice: typeof parsed.wholesalePrice === "number" ? parsed.wholesalePrice : EMPTY_IMPORT_FORM.wholesalePrice,
            sellingPrice: typeof parsed.sellingPrice === "number" ? parsed.sellingPrice : EMPTY_IMPORT_FORM.sellingPrice,
            stock: typeof parsed.stock === "number" ? parsed.stock : EMPTY_IMPORT_FORM.stock,
            supplierInfo: typeof parsed.supplierInfo === "string" ? parsed.supplierInfo : EMPTY_IMPORT_FORM.supplierInfo,
            description: typeof parsed.description === "string" ? parsed.description : EMPTY_IMPORT_FORM.description
          });
        }
      }
    } catch (error) {
      console.error("Could not restore the product import draft.", error);
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(PRODUCT_IMPORT_DRAFT_KEY, JSON.stringify(form));
    } catch (error) {
      console.error("Could not save the product import draft.", error);
    }
  }, [draftLoaded, form]);

  useEffect(() => {
    const rawUrl = form.markazUrl.trim();
    if (!rawUrl) {
      setScrapedImages([]);
      setIncludedScrapedImages([]);
      setSelectedImage("");
      setUrlAutofillMessage("");
      return;
    }

    try {
      const url = new URL(rawUrl);
      const pathSegments = url.pathname.split("/").filter(Boolean);
      const productId = pathSegments.at(-1) ?? "";
      const productSlug = url.pathname.match(/\/product\/([^/]+)/i)?.[1] ?? "";
      const title = productSlug
        .split("-")
        .filter(Boolean)
        .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
        .join(" ");

      if (!productId && !title) return;
      setForm((current) => ({
        ...current,
        ...(productId ? { markazProductId: productId } : {}),
        ...(title ? { title } : {})
      }));
      setUrlAutofillMessage("Auto-filled from URL slug, you can edit");
    } catch {
      setUrlAutofillMessage("");
    }
  }, [form.markazUrl]);

  async function fetchSupplierDetails() {
    const supplierUrl = form.markazUrl.trim();
    if (!supplierUrl) {
      setMessageIsError(true);
      setMessage("Enter a supplier product URL before fetching details.");
      return;
    }

    setFetchingDetails(true);
    setMessage("");
    try {
      const response = await fetch(`/api/scrape?url=${encodeURIComponent(supplierUrl)}`);
      const result: unknown = await response.json();
      if (!response.ok) {
        const errorMessage = isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not fetch supplier product details.";
        throw new Error(errorMessage);
      }
      if (!isRecord(result)) throw new Error("The scraper returned an invalid response.");

      const updates: Partial<MarkazImportForm> = {};
      if (typeof result.title === "string" && result.title.trim()) updates.title = result.title.trim();
      let images: string[] = [];
      if (Array.isArray(result.images)) {
        images = [...new Set(result.images.filter((image): image is string =>
          typeof image === "string" && /^https:\/\/[^/\s]+/i.test(image.trim())
        ).map((image) => image.trim()))];
        updates.images = images.join("\n");
      }
      if (Object.keys(updates).length === 0) {
        throw new Error("No title or product images were found. You can enter them manually.");
      }
      setScrapedImages(images);
      setIncludedScrapedImages(images);
      setSelectedImage(images[0] ?? "");
      setScrapedRating(typeof result.rating === "number" && result.rating >= 0 && result.rating <= 5 ? result.rating : 4.5);
      setScrapedReviews(typeof result.reviews === "number" && Number.isInteger(result.reviews) && result.reviews >= 0 ? result.reviews : 100);
      if (typeof result.description === "string" && result.description.trim()) {
        updates.description = result.description.trim().slice(0, 5000);
      }
      setForm((current) => ({ ...current, ...updates }));
      setUrlAutofillMessage("Product details fetched. You can edit them before importing.");
      setMessageIsError(false);
      setMessage("Supplier details fetched.");
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not fetch supplier product details.");
    } finally {
      setFetchingDetails(false);
    }
  }

  function toggleScrapedImage(image: string) {
    const nextIncluded = includedScrapedImages.includes(image)
      ? includedScrapedImages.filter((entry) => entry !== image)
      : [...includedScrapedImages, image];
    const nextSelected = nextIncluded.includes(selectedImage) ? selectedImage : nextIncluded[0] ?? "";
    const orderedImages = nextSelected
      ? [nextSelected, ...nextIncluded.filter((entry) => entry !== nextSelected)]
      : nextIncluded;
    setIncludedScrapedImages(nextIncluded);
    setSelectedImage(nextSelected);
    updateFormField("images", orderedImages.join("\n"));
  }

  function chooseMainImage(image: string) {
    if (!includedScrapedImages.includes(image)) return;
    setSelectedImage(image);
    updateFormField("images", [image, ...includedScrapedImages.filter((entry) => entry !== image)].join("\n"));
  }

  function updateFormField<K extends keyof MarkazImportForm>(field: K, value: MarkazImportForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const wholesale = Number(form.wholesalePrice) || 0;
  const selling = Number(form.sellingPrice) || 0;
  const shouldValidatePrices = wholesale > 0 && selling > 0;
  const pricesAreValid = !shouldValidatePrices || selling >= wholesale;
  const profit = shouldValidatePrices ? selling - wholesale : 0;
  const profitMargin = shouldValidatePrices ? (profit / selling) * 100 : 0;
  const markupOnWholesale = shouldValidatePrices ? (profit / wholesale) * 100 : 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setImportedProduct(null);
    const wholesale = Number(form.wholesalePrice) || 0;
    const selling = Number(form.sellingPrice) || 0;
    if (wholesale > 0 && selling > 0 && selling < wholesale) {
      setMessageIsError(true);
      setMessage("Selling price must be at least the wholesale price.");
      return;
    }
    if (wholesale <= 0 || selling <= 0) {
      setMessageIsError(true);
      setMessage("Enter a wholesale price and a selling price greater than zero.");
      return;
    }

    const images = form.images
      .split(/[\n,]+/)
      .map((image) => image.trim())
      .filter(Boolean);
    const selectedImages = selectedImage && images.includes(selectedImage)
      ? [selectedImage, ...images.filter((image) => image !== selectedImage)]
      : images;
    const primaryImage = selectedImages[0] || selectedImage || "";
    const stock = Number.parseInt(String(form.stock), 10);
    const supplierId = form.markazProductId.trim() ||
      form.markazUrl.split(/[/?#]/).filter(Boolean).at(-1) ||
      "";
    const payload = {
      name: form.title.trim(),
      price: selling,
      stock: Number.isInteger(stock) && stock >= 0 ? stock : 100,
      category: form.category,
      image: primaryImage,
      images: selectedImages,
      supplierId,
      supplierUrl: form.markazUrl.trim(),
      supplierPrice: wholesale,
      isActive: true,
      isMarkazProduct: true,
      rating: scrapedRating || 4.5,
      reviews: scrapedReviews || 100,
      title: form.title.trim(),
      markazUrl: form.markazUrl.trim(),
      markazProductId: form.markazProductId.trim(),
      wholesalePrice: wholesale,
      sellingPrice: selling,
      description: form.description.trim(),
      supplier: {
        name: form.supplierName.trim() || "Supplier",
        info: form.supplierInfo.trim()
      }
    };

    setSaving(true);
    try {
      console.log("Supplier import prices:", { wholesale, selling });
      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey.trim() || DEFAULT_ADMIN_KEY },
        body: JSON.stringify(payload)
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const errorMessage = isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not import the supplier product.";
        throw new Error(errorMessage);
      }

      if (!isRecord(result) || !isRecord(result.product)) {
        throw new Error("The server returned an invalid product response.");
      }
      const product = result.product;
      if (typeof product._id !== "string" || typeof product.title !== "string" ||
          typeof product.slug !== "string" || typeof product.profit !== "number") {
        throw new Error("The server returned an invalid product response.");
      }

      setImportedProduct({ _id: product._id, title: product.title, slug: product.slug, profit: product.profit });
      setMessageIsError(false);
      setMessage(
        `Product imported and saved ${isRecord(result) && result.storage === "local" ? "locally" : "to MongoDB"}. ` +
        `Admin key used: ${adminKey.trim() || DEFAULT_ADMIN_KEY}`
      );
      window.alert("Imported! Now check storefront");
      setForm(EMPTY_IMPORT_FORM);
      setScrapedImages([]);
      setIncludedScrapedImages([]);
      setSelectedImage("");
      setScrapedRating(4.5);
      setScrapedReviews(100);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not import the supplier product.");
    } finally {
      setSaving(false);
    }
  }

  async function loadOrders() {
    setMessage("");
    setLoadingOrders(true);
    try {
      const response = await fetch("/api/orders", {
        headers: { "x-admin-key": adminKey.trim() || DEFAULT_ADMIN_KEY },
        cache: "no-store"
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const errorMessage = isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not load orders.";
        throw new Error(errorMessage);
      }
      if (!isRecord(result) || !Array.isArray(result.orders)) {
        throw new Error("The server returned an invalid orders response.");
      }
      const parsedOrders = result.orders.map(parseMarkazOrder).filter((order): order is MarkazOrder => order !== null);
      setOrders(parsedOrders.filter((order) => order.products.some((product) => product.isMarkazProduct === true)));
      setOrdersLoaded(true);
      setMessageIsError(false);
      setMessage("Supplier orders updated.");
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not load orders.");
    } finally {
      setLoadingOrders(false);
    }
  }

  async function copyMarkazOrder(order: MarkazOrder) {
    const markazProducts = order.products.filter((product) => product.isMarkazProduct === true);
    const text = [
      `ZaviMart order: ${order.orderId}`,
      "",
      "Customer details",
      `Name: ${order.customer.name}`,
      `Phone: ${order.customer.phone}`,
      `Address: ${order.customer.address}`,
      `City: ${order.customer.city}`,
      "",
      "Supplier products",
      ...markazProducts.flatMap((product) => [
        `${product.title} x ${product.qty}`,
        ...(product.markazProductId ? [`Supplier product ID: ${product.markazProductId}`] : []),
        ...(product.supplier?.productUrl ? [`Product URL: ${product.supplier.productUrl}`] : [])
      ]),
      "",
      `Customer total: ${formatRs(order.total)}`
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setMessageIsError(false);
      setMessage(`Order ${order.orderId} copied. Paste it into your supplier's ordering app.`);
    } catch (error) {
      console.error("Could not copy supplier order details.", error);
      setMessageIsError(true);
      setMessage("Clipboard access failed. Check browser permissions and try again.");
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ZaviMart supplier tools</span>
          <h1>ZaviMart product import</h1>
          <p>Import a supplier listing, set your price, and prepare customer details for fulfillment.</p>
        </div>
        <div className={styles.headerLinks}>
          <Link href="/admin">Product admin</Link>
          <Link href="/">Storefront</Link>
        </div>
      </header>

      <div className={styles.badges} aria-label="Store benefits">
        <span>Cash on delivery available</span>
        <span>Free delivery above Rs 2,999</span>
      </div>

      <section className={styles.panel} aria-labelledby="importHeading">
        {usingDefaultAdminKey && (
          <p className={styles.defaultKeyBanner} role="note">
            Using default admin key: zavi123 - Set ZAVIMART_ADMIN_API_KEY in .env.local to change
          </p>
        )}
        {usingDemoMode && (
          <p className={styles.demoModeBanner} role="note">
            Running in demo mode - products saved locally, will reset on redeploy. Add MONGODB_URI for permanent storage
          </p>
        )}
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Product listing</span>
            <h2 id="importHeading">Import a supplier product</h2>
          </div>
          <p>Paste the listing details below. Images can be entered one per line or separated with commas.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.fullWidth}>
            Admin API key
            <input
              type="password"
              autoComplete="off"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Enter ZAVIMART_ADMIN_API_KEY"
            />
            <span className={styles.hint}>Kept in this page only; used to authenticate admin requests.</span>
          </label>

          <div className={`${styles.fullWidth} ${styles.supplierUrlField}`}>
            <label htmlFor="supplier-product-url">Supplier product URL</label>
            <div className={styles.supplierUrlControls}>
              <input
                id="supplier-product-url"
                name="markazUrl"
                type="url"
                value={form.markazUrl}
                onChange={(event) => updateFormField("markazUrl", event.target.value)}
                placeholder="https://..."
                required
              />
              <button className={styles.secondaryButton} type="button" onClick={fetchSupplierDetails} disabled={fetchingDetails}>
                {fetchingDetails ? "Fetching..." : "Fetch Details"}
              </button>
            </div>
            {urlAutofillMessage && <span className={styles.hint} role="status">{urlAutofillMessage}</span>}
          </div>
          <label>
            Supplier product ID <span className={styles.optional}>(optional)</span>
            <input
              name="markazProductId"
              type="text"
              maxLength={1000}
              value={form.markazProductId}
              onChange={(event) => updateFormField("markazProductId", event.target.value)}
              placeholder="Auto-detected from URL if omitted"
            />
            <span className={styles.hint}>Only short ID, not full URL. Example: abc-123</span>
          </label>
          <label>
            Product title
            <input
              name="title"
              type="text"
              maxLength={200}
              value={form.title}
              onChange={(event) => updateFormField("title", event.target.value)}
              required
            />
          </label>
          <label>
            Category
            <select
              name="category"
              value={form.category}
              onChange={(event) => updateFormField("category", event.target.value)}
              required
            >
              <option value="" disabled>Select a category</option>
              {PRODUCT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            Supplier name
            <input
              name="supplierName"
              type="text"
              maxLength={120}
              value={form.supplierName}
              onChange={(event) => updateFormField("supplierName", event.target.value)}
            />
          </label>
          <div className={`${styles.fullWidth} ${styles.productImagesField}`}>
            <label htmlFor="product-image-urls">Product image URLs</label>
            <textarea
              id="product-image-urls"
              name="images"
              rows={3}
              value={form.images}
              onChange={(event) => {
                setScrapedImages([]);
                setIncludedScrapedImages([]);
                setSelectedImage("");
                updateFormField("images", event.target.value);
              }}
              placeholder={"https://.../image-1.jpg\nhttps://.../image-2.jpg (optional)"}
            />
            {scrapedImages.length > 0 && (
              <div className={styles.scrapedImages} aria-label="Select product images">
                {scrapedImages.map((image, index) => (
                <div className={styles.scrapedImageOption} key={image}>
                    <input
                    id={`scraped-image-${index}`}
                    type="checkbox"
                    checked={includedScrapedImages.includes(image)}
                    onChange={() => toggleScrapedImage(image)}
                    aria-label={`Include product image ${index + 1}`}
                  />
                  <label htmlFor={`scraped-image-${index}`}>Include image {index + 1}</label>
                  <button
                      className={`${styles.scrapedImageButton} ${selectedImage === image ? styles.selectedScrapedImage : ""}`}
                      type="button"
                      onClick={() => chooseMainImage(image)}
                      aria-label={`Make image ${index + 1} the main product image`}
                      aria-pressed={selectedImage === image}
                    >
                      <img src={image} alt={`Supplier product image ${index + 1}`} loading="lazy" />
                    </button>
                    <span>{selectedImage === image ? "Main image" : `Image ${index + 1}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <label>
            Wholesale price (Rs)
            <input
              name="wholesalePrice"
              type="number"
              min="0"
              step="0.01"
              value={form.wholesalePrice}
              onChange={(event) => updateFormField("wholesalePrice", Number.parseFloat(event.target.value) || 0)}
              required
            />
          </label>
          <label>
            Selling price (Rs)
            <input
              name="sellingPrice"
              type="number"
              min="0"
              step="0.01"
              value={form.sellingPrice}
              onChange={(event) => updateFormField("sellingPrice", Number.parseFloat(event.target.value) || 0)}
              required
            />
          </label>

          <div className={`${styles.calculator} ${styles.fullWidth}`} aria-live="polite">
            <span>Profit per item <strong>{formatRs(profit)}</strong></span>
            <span>Profit margin <strong>{profitMargin.toFixed(1)}%</strong></span>
            <span>Markup on wholesale <strong>{markupOnWholesale.toFixed(1)}%</strong></span>
            {shouldValidatePrices && !pricesAreValid && (
              <span className={styles.validation}>
                Selling price must be at least the wholesale price.
              </span>
            )}
          </div>

          <label>
            Stock quantity
            <input
              name="stock"
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(event) => updateFormField("stock", Number.parseInt(event.target.value, 10) || 0)}
              required
            />
          </label>
          <label>
            Supplier notes <span className={styles.optional}>(optional)</span>
            <input
              name="supplierInfo"
              type="text"
              maxLength={1000}
              value={form.supplierInfo}
              onChange={(event) => updateFormField("supplierInfo", event.target.value)}
              placeholder="Supplier contact or fulfillment notes"
            />
          </label>
          <label className={styles.fullWidth}>
            Product description <span className={styles.optional}>(optional)</span>
            <textarea
              name="description"
              rows={4}
              maxLength={5000}
              value={form.description}
              onChange={(event) => updateFormField("description", event.target.value)}
            />
          </label>

          <button className={styles.submit} type="submit" disabled={saving}>
            {saving ? "Importing product..." : "Import product"}
          </button>
        </form>
      </section>

      <p className={`${styles.message} ${messageIsError ? styles.error : styles.success}`} role={messageIsError ? "alert" : "status"} aria-live="polite">
        {message}
      </p>
      {importedProduct && (
        <p className={styles.importSuccess}>
          Saved <strong>{importedProduct.title}</strong> with estimated profit {formatRs(importedProduct.profit)} per item.
        </p>
      )}

      <section className={styles.panel} aria-labelledby="ordersHeading">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Supplier fulfillment</span>
            <h2 id="ordersHeading">Supplier orders</h2>
          </div>
          <button className={styles.secondaryButton} type="button" onClick={loadOrders} disabled={loadingOrders}>
            {loadingOrders ? "Loading orders..." : ordersLoaded ? "Refresh orders" : "Load orders"}
          </button>
        </div>
        <p className={styles.hint}>
          Orders containing imported supplier products appear here. Copy the customer and item details to place the supplier order.
        </p>
        {ordersLoaded && orders.length === 0 && (
          <p className={styles.empty}>No orders containing imported supplier products yet.</p>
        )}
        <div className={styles.orderList}>
          {orders.map((order) => (
            <article className={styles.orderCard} key={order._id}>
              <div className={styles.orderHeader}>
                <div>
                  <strong>{order.orderId}</strong>
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                </div>
                <button className={styles.copyButton} type="button" onClick={() => copyMarkazOrder(order)}>
                  Copy supplier order
                </button>
              </div>
              <div className={styles.orderDetails}>
                <span><strong>Customer:</strong> {order.customer.name} · {order.customer.phone}</span>
                <span><strong>Ship to:</strong> {order.customer.address}, {order.customer.city}</span>
                <span><strong>Estimated gross profit:</strong> {formatRs(order.profit ?? 0)}</span>
              </div>
              <ul className={styles.itemList}>
                {order.products.filter((product) => product.isMarkazProduct === true).map((product, index) => (
                  <li key={`${product.markazProductId ?? product.title}-${index}`}>
                    {product.title} × {product.qty}
                    {product.markazProductId && <span> · Supplier ID {product.markazProductId}</span>}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
