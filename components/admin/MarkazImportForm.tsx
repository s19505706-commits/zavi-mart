"use client";

import { useEffect, useState, type FormEvent } from "react";
import DepartmentCategoryFields from "./DepartmentCategoryFields";
import { cleanMarkazTitle, cleanProductDescription, extractProductCode } from "../../lib/product-codes";
import { normalizeVariantCombinations, normalizeVariantDefinitions } from "../../lib/markaz-variants";
import type { ProductVariantCombination, ProductVariantDefinition } from "../../lib/markaz-variants";
import styles from "../../app/admin/product-import/product-import.module.css";

type ImportedProduct = { _id: string; title: string; slug: string; profit: number };
const PRODUCT_IMPORT_DRAFT_KEY = "zavimart-markaz-import-draft";

type MarkazImportForm = {
  markazUrl: string;
  markazProductId: string;
  title: string;
  originalMarkazTitle: string;
  category: string;
  departmentId: string;
  categoryId: string;
  supplierName: string;
  images: string;
  wholesalePrice: number;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  supplierInfo: string;
  description: string;
  productCode: string;
  originalDescription: string;
  isNewArrival: boolean;
  variantOptions: unknown[];
  variants: ProductVariantDefinition[];
  variantCombinations: ProductVariantCombination[];
};

const EMPTY_IMPORT_FORM: MarkazImportForm = {
  markazUrl: "",
  markazProductId: "",
  title: "",
  originalMarkazTitle: "",
  category: "",
  departmentId: "",
  categoryId: "",
  supplierName: "Supplier",
  images: "",
  wholesalePrice: 0,
  costPrice: 0,
  sellingPrice: 0,
  stock: 100,
  supplierInfo: "",
  description: "",
  productCode: "",
  originalDescription: "",
  isNewArrival: false,
  variantOptions: [],
  variants: [],
  variantCombinations: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPrice(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function readStock(value: unknown): number | undefined {
  const stock = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isInteger(stock) && stock >= 0 ? stock : undefined;
}

function extractMarkazProductId(value: string): string {
  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
  } catch {
    return value.split(/[/?#]/).filter(Boolean).at(-1) ?? "";
  }
}

function isMarkazProductUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && /(^|\.)markaz\./i.test(url.hostname);
  } catch {
    return false;
  }
}

function formatRs(value: number) {
  return `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(value)}`;
}

export default function MarkazImportForm() {
  const [form, setForm] = useState<MarkazImportForm>(EMPTY_IMPORT_FORM);
  const [marginPercent, setMarginPercent] = useState(30);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [adminKey, setAdminKey] = useState("");
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
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [importedProduct, setImportedProduct] = useState<ImportedProduct | null>(null);
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
          const draftWholesale = typeof parsed.wholesalePrice === "number" ? parsed.wholesalePrice : 0;
          const draftCost = typeof parsed.costPrice === "number" ? parsed.costPrice : draftWholesale;
          const draftSelling = typeof parsed.sellingPrice === "number" ? parsed.sellingPrice : 0;
          setForm({
            markazUrl: typeof parsed.markazUrl === "string" ? parsed.markazUrl : EMPTY_IMPORT_FORM.markazUrl,
            markazProductId: typeof parsed.markazProductId === "string" ? parsed.markazProductId : EMPTY_IMPORT_FORM.markazProductId,
            title: typeof parsed.title === "string" ? parsed.title : EMPTY_IMPORT_FORM.title,
            originalMarkazTitle: typeof parsed.originalMarkazTitle === "string"
              ? parsed.originalMarkazTitle
              : EMPTY_IMPORT_FORM.originalMarkazTitle,
            category: typeof parsed.category === "string" ? parsed.category : EMPTY_IMPORT_FORM.category,
            departmentId: typeof parsed.departmentId === "string" ? parsed.departmentId : EMPTY_IMPORT_FORM.departmentId,
            categoryId: typeof parsed.categoryId === "string" ? parsed.categoryId : EMPTY_IMPORT_FORM.categoryId,
            supplierName: typeof parsed.supplierName === "string" ? parsed.supplierName : EMPTY_IMPORT_FORM.supplierName,
            images: typeof parsed.images === "string" ? parsed.images : EMPTY_IMPORT_FORM.images,
            wholesalePrice: draftWholesale,
            costPrice: draftCost,
            sellingPrice: draftSelling,
            stock: typeof parsed.stock === "number" ? parsed.stock : EMPTY_IMPORT_FORM.stock,
            supplierInfo: typeof parsed.supplierInfo === "string" ? parsed.supplierInfo : EMPTY_IMPORT_FORM.supplierInfo,
            description: typeof parsed.description === "string" ? parsed.description : EMPTY_IMPORT_FORM.description,
            productCode: typeof parsed.productCode === "string" ? parsed.productCode : EMPTY_IMPORT_FORM.productCode,
            originalDescription: typeof parsed.originalDescription === "string"
              ? parsed.originalDescription
              : EMPTY_IMPORT_FORM.originalDescription,
            isNewArrival: parsed.isNewArrival === true,
            variantOptions: Array.isArray(parsed.variantOptions) ? parsed.variantOptions : [],
            variants: normalizeVariantDefinitions(parsed.variants),
            variantCombinations: normalizeVariantCombinations(parsed.variantCombinations)
          });
          setMarginPercent(draftWholesale > 0
            ? Number((((draftSelling - draftWholesale) / draftWholesale) * 100).toFixed(1))
            : 30);
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
      console.log("Markaz Data:", result);
      const productData = isRecord(result.data)
        ? result.data
        : isRecord(result.product) ? result.product : result;

      const updates: Partial<MarkazImportForm> = {};
      const rawTitleFromMarkaz = typeof productData.title === "string"
        ? productData.title
        : typeof productData.name === "string" ? productData.name : "";
      if (rawTitleFromMarkaz.trim()) {
        updates.originalMarkazTitle = rawTitleFromMarkaz.trim().slice(0, 200);
        updates.title = cleanMarkazTitle(rawTitleFromMarkaz).slice(0, 200);
      }
      let images: string[] = [];
      if (Array.isArray(productData.images)) {
        images = [...new Set(productData.images.filter((image): image is string =>
          typeof image === "string" && /^https:\/\/[^/\s]+/i.test(image.trim())
        ).map((image) => image.trim()))];
        updates.images = images.join("\n");
      }
      const variants = normalizeVariantDefinitions(productData.variants);
      const variantCombinations = normalizeVariantCombinations(productData.variantCombinations);
      const firstVariant = Array.isArray(productData.variants)
        ? productData.variants.find(isRecord)
        : undefined;
      const markazWholesale =
        readPrice(productData.wholesalePrice) ??
        readPrice(productData.resellerPrice) ??
        readPrice(productData.wholesale) ??
        readPrice(productData.price) ??
        readPrice(productData.cost) ??
        readPrice(firstVariant?.price) ??
        readPrice(productData.productPrice);
      const markazStock =
        readStock(productData.stock) ??
        readStock(productData.quantity) ??
        readStock(productData.availableStock) ??
        (productData.inStock === true ? 100 : productData.inStock === false ? 0 : undefined);
      console.log(
        "Parsed Wholesale:",
        markazWholesale ?? 0,
        "Stock:",
        markazStock ?? 100
      );
      if (markazWholesale !== undefined) {
        updates.wholesalePrice = markazWholesale;
        updates.sellingPrice = Math.round(markazWholesale * 1.3);
        setMarginPercent(30);
      }
      updates.stock = markazStock ?? 100;
      updates.variantOptions = Array.isArray(productData.variantOptions) ? productData.variantOptions : [];
      updates.variants = variants;
      updates.variantCombinations = variantCombinations;
      if (Object.keys(updates).length === 0) {
        throw new Error("No title or product images were found. You can enter them manually.");
      }
      setScrapedImages(images);
      setIncludedScrapedImages(images);
      setSelectedImage(images[0] ?? "");
      setScrapedRating(typeof productData.rating === "number" && productData.rating >= 0 && productData.rating <= 5 ? productData.rating : 4.5);
      setScrapedReviews(typeof productData.reviews === "number" && Number.isInteger(productData.reviews) && productData.reviews >= 0 ? productData.reviews : 100);
      const rawDescription = typeof productData.description === "string"
        ? productData.description.trim().slice(0, 5000)
        : "";
      updates.productCode = extractProductCode(rawDescription) ?? "";
      updates.originalDescription = rawDescription;
      updates.description = cleanProductDescription(rawDescription);
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

  function handleMarkazUrlChange(url: string) {
    const markazProductId = extractMarkazProductId(url);
    setForm((current) => ({ ...current, markazUrl: url, markazProductId }));
  }

  function handleWholesaleChange(value: string) {
    const wholesalePrice = Number.parseFloat(value) || 0;
    setForm((current) => ({
      ...current,
      wholesalePrice,
      costPrice: current.costPrice || wholesalePrice,
      sellingPrice: Math.round(wholesalePrice * (1 + marginPercent / 100))
    }));
  }

  function handleMarginChange(value: number) {
    const nextMargin = Number.isFinite(value) ? value : 0;
    setMarginPercent(nextMargin);
    setForm((current) => ({
      ...current,
      sellingPrice: Math.round(current.wholesalePrice * (1 + nextMargin / 100))
    }));
  }

  function handleSellingChange(value: string) {
    const sellingPrice = Number.parseFloat(value) || 0;
    setForm((current) => ({ ...current, sellingPrice }));
    if (form.wholesalePrice > 0) {
      setMarginPercent(Number((((sellingPrice - form.wholesalePrice) / form.wholesalePrice) * 100).toFixed(1)));
    }
  }

  const wholesale = Number(form.wholesalePrice) || 0;
  const selling = Number(form.sellingPrice) || 0;
  const shouldValidatePrices = wholesale > 0 && selling > 0;
  const pricesAreValid = !shouldValidatePrices || selling >= wholesale;
  const profit = shouldValidatePrices ? selling - wholesale : 0;

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

    const images = [...new Set(form.images
      .split(/[\r\n,]+/)
      .map((image) => image.trim())
      .filter(Boolean))];
    const includeImage = images.map((image) =>
      !scrapedImages.includes(image) || includedScrapedImages.includes(image)
    );
    const includedImages = images.filter((_, index) => includeImage[index]);
    const selectedImages = selectedImage && includedImages.includes(selectedImage)
      ? [selectedImage, ...includedImages.filter((image) => image !== selectedImage)]
      : includedImages;
    const primaryImage = selectedImages[0] ?? "";
    const stock = Number.parseInt(String(form.stock), 10);
    const supplierId = form.markazProductId.trim() ||
      form.markazUrl.split(/[/?#]/).filter(Boolean).at(-1) ||
      "";
    const payload = {
      name: form.title.trim(),
      price: selling,
      stock: Number.isInteger(stock) && stock >= 0 ? stock : 100,
      category: form.category,
      departmentId: form.departmentId,
      categoryId: form.categoryId,
      image: primaryImage,
      images: selectedImages,
      supplierId,
      supplierUrl: form.markazUrl.trim(),
      supplierPrice: wholesale,
      costPrice: Number(form.costPrice),
      source: "markaz",
      isActive: true,
      isMarkazProduct: true,
      isDropship: true,
      isNewArrival: form.isNewArrival,
      rating: scrapedRating || 4.5,
      reviews: scrapedReviews || 100,
      title: form.title.trim(),
      markazUrl: form.markazUrl.trim(),
      markazProductId: form.markazProductId.trim(),
      markazProductUrl: form.markazUrl.trim(),
      originalMarkazTitle: form.originalMarkazTitle.trim() || null,
      wholesalePrice: wholesale,
      sellingPrice: selling,
      description: form.description.trim(),
      productCode: form.productCode.trim() || null,
      originalDescription: form.originalDescription.trim() || null,
      variantOptions: form.variantOptions,
      variants: form.variants,
      variantCombinations: form.variantCombinations,
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
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey.trim() },
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
      setMessage(`Product imported and saved ${isRecord(result) && result.storage === "local" ? "locally" : "to MongoDB"}.`);
      window.alert("Imported! Now check storefront");
      setForm(EMPTY_IMPORT_FORM);
      setMarginPercent(30);
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

  return (
    <section className={styles.page}>
      <section className={styles.panel} aria-labelledby="importHeading">
        {usingDefaultAdminKey && (
          <p className={styles.defaultKeyBanner} role="note">
            Using the built-in fallback admin key. Set ADMIN_KEY in the project-root .env.local to change it.
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
            <h2 id="importHeading">Import Product from Markaz</h2>
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
              placeholder="Optional API key (admin session is used automatically)"
            />
            <span className={styles.hint}>Kept in this page only; used to authenticate admin requests.</span>
          </label>

          <div className={`${styles.fullWidth} ${styles.supplierUrlField}`}>
            <label htmlFor="importMarkazUrl">Markaz Product Link (For Import + Dropshipping Mapping)</label>
            <div className={styles.supplierUrlControls}>
              <input
                id="importMarkazUrl"
                name="markazUrl"
                type="url"
                value={form.markazUrl}
                onChange={(event) => handleMarkazUrlChange(event.target.value)}
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
          <DepartmentCategoryFields
            departmentId={form.departmentId}
            categoryId={form.categoryId}
            onChange={(classification) => setForm((current) => ({
              ...current,
              departmentId: classification.departmentId,
              categoryId: classification.categoryId,
              category: classification.categoryName
            }))}
          />
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
                      <img
                        src={image}
                        alt={`Product ${index + 1}`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(event) => {
                          const preview = event.currentTarget;
                          preview.onerror = null;
                          preview.src = "/placeholder.svg";
                        }}
                      />
                    </button>
                    <span>{selectedImage === image ? "Main image" : `Image ${index + 1}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={`${styles.priceFields} ${styles.fullWidth}`}>
            <label>
              Wholesale price (Rs)
              <input
                name="wholesalePrice"
                type="number"
                min="0"
                step="0.01"
                value={form.wholesalePrice}
                onChange={(event) => handleWholesaleChange(event.target.value)}
                required
              />
              <span className={styles.hint}>Auto-filled from Markaz</span>
            </label>
            <label>
              Cost price (Rs)
              <input
                name="costPrice"
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(event) => updateFormField("costPrice", Number.parseFloat(event.target.value) || 0)}
                required
              />
              <span className={styles.hint}>Used to calculate dashboard profit.</span>
            </label>
            <div className={styles.marginField}>
              <label htmlFor="marginPercent">Margin %</label>
              <div className={styles.marginInputWrap}>
                <input
                  id="marginPercent"
                  type="number"
                  step="0.1"
                  value={marginPercent}
                  onChange={(event) => handleMarginChange(Number.parseFloat(event.target.value) || 0)}
                  placeholder="30"
                />
                <span aria-hidden="true">%</span>
              </div>
              <span className={styles.marginHint}>Add % to auto-set price</span>
              <div className={styles.marginPresets} aria-label="Margin presets">
                {[20, 30, 50, 70, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={marginPercent === preset ? styles.marginPresetActive : undefined}
                    onClick={() => handleMarginChange(preset)}
                    aria-pressed={marginPercent === preset}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
            <label>
              Selling price (Rs)
              <input
                name="sellingPrice"
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={(event) => handleSellingChange(event.target.value)}
                required
              />
              <span className={styles.hint}>Auto-calculated; editable before import.</span>
            </label>
          </div>

          <div className={`${styles.calculator} ${styles.fullWidth}`} aria-live="polite">
            <div>
              <p>Profit per item</p>
              <strong className={styles.profitValue}>{formatRs(profit)}</strong>
            </div>
            <div>
              <p>Profit margin</p>
              <strong>{marginPercent.toFixed(1)}%</strong>
            </div>
            <div>
              <p>Markup on wholesale</p>
              <strong>{marginPercent.toFixed(1)}%</strong>
            </div>
            <p className={styles.calculationSummary}>
              Selling = {wholesale} + {marginPercent}% = Rs {selling} | Customer pays Rs {selling} (delivery calculated at checkout)
            </p>
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
            <span className={styles.hint}>Auto-filled from Markaz stock when available; editable before import.</span>
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

          <fieldset className={`${styles.fullWidth} ${styles.markazMapping}`}>
            <legend>Dropshipping / Markaz Mapping</legend>
            <label>
              Markaz Product Link
              <input
                type="url"
                value={form.markazUrl}
                readOnly
                placeholder="https://markaz.app.link/product/..."
              />
            </label>
            <label>
              Markaz Product ID
              <input
                type="text"
                value={form.markazProductId}
                readOnly
                placeholder="Auto-filled from import link"
              />
            </label>
            <p className={styles.hint}>Auto-filled from import link above - No need to paste again.</p>
            {form.markazUrl.trim() && isMarkazProductUrl(form.markazUrl) && (
              <p className={styles.markazLinked} role="status">✓ Auto-linked to mapping</p>
            )}
            {form.markazUrl.trim() && isMarkazProductUrl(form.markazUrl) && (
              <a className={styles.secondaryButton} href={form.markazUrl} target="_blank" rel="noopener noreferrer">
                Open in Markaz
              </a>
            )}
            {form.markazUrl.trim() && !isMarkazProductUrl(form.markazUrl) && (
              <p className={styles.markazError} role="alert">Enter a URL from a Markaz domain.</p>
            )}
            {!form.markazUrl.trim() && (
              <p className={styles.markazWarning}>Markaz link not set - fulfillment will be slow.</p>
            )}
          </fieldset>
          <div className={`${styles.checkboxes} ${styles.fullWidth}`}>
            <label>
              <input
                type="checkbox"
                checked={form.isNewArrival}
                onChange={(event) => updateFormField("isNewArrival", event.target.checked)}
              />
              Mark as New Arrival (Shows in Department New Arrivals)
            </label>
          </div>

          <button className={styles.submit} type="submit" disabled={saving}>
            {saving ? "Importing product..." : "Import & Save Product"}
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

    </section>
  );
}
