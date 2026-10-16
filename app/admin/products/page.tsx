"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import DepartmentCategoryFields from "../../../components/admin/DepartmentCategoryFields";
import MarkazImportForm from "../../../components/admin/MarkazImportForm";
import AdminCard from "../../../components/admin/AdminCard";
import AdminDrawer from "../../../components/admin/AdminDrawer";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminTable from "../../../components/admin/AdminTable";
import AdminButton from "../../../components/admin/ui/AdminButton";
import styles from "../admin.module.css";

type CreatedProduct = {
  _id: string;
  title: string;
  slug: string;
  category: string;
  departmentId?: string | null;
  categoryId?: string | null;
};

type AdminProduct = CreatedProduct & {
  id?: string;
  price: number;
  stock: number;
  description: string;
  originalPrice: number | null;
  images: string[];
  ratings: number;
  isNewArrival: boolean;
  markazProductId: string;
  markazProductUrl: string;
  brand: string;
  sku: string;
  importSource?: string;
  productCode: string | null;
  originalMarkazTitle: string | null;
};

type ProductSectionTab = "active" | "history" | "deleted";
type AdminProductTab = "import" | "local";

type ProductHistoryRow = {
  id: number;
  productId: string;
  productName: string;
  action: string;
  source: string;
  sourceFileName?: string;
  timestamp: string;
  productSnapshot: Record<string, unknown>;
};

type DeletedProductRow = Record<string, unknown> & {
  _id: string;
  deletedAt: string;
  deletedBy: string;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMarkazProductUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLocaleLowerCase();
    const isMarkazHost = hostname === "markaz" ||
      hostname.startsWith("markaz.") ||
      hostname.endsWith(".markaz") ||
      hostname.includes(".markaz.");
    return ["https:", "http:"].includes(url.protocol) && isMarkazHost;
  } catch {
    return false;
  }
}

function formatAuditDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Date unavailable";
}

function formatImportSource(value: unknown): string {
  if (typeof value !== "string") return "Unknown";
  return value === "bulk-import" ? "Bulk import" : value.toUpperCase() === "CSV" || value.toUpperCase() === "JSON"
    ? value.toUpperCase()
    : value.charAt(0).toUpperCase() + value.slice(1);
}

function productPrice(snapshot: Record<string, unknown>, field: "price" | "originalPrice"): string {
  const value = field === "originalPrice" && typeof snapshot.originalPrice !== "number"
    ? snapshot.price
    : snapshot[field];
  return typeof value === "number" ? `Rs ${value.toLocaleString("en-PK")}` : "—";
}

function toAdminProduct(entry: unknown): AdminProduct | null {
  if (
    typeof entry !== "object" || entry === null ||
    !("_id" in entry) || typeof entry._id !== "string" ||
    !("title" in entry) || typeof entry.title !== "string" ||
    !("slug" in entry) || typeof entry.slug !== "string" ||
    !("category" in entry) || typeof entry.category !== "string" ||
    !("price" in entry) || typeof entry.price !== "number" ||
    !("stock" in entry) || typeof entry.stock !== "number"
  ) return null;

  const product = entry as Record<string, unknown>;
  return {
    _id: entry._id,
    id: typeof product.id === "string" ? product.id : undefined,
    title: entry.title,
    slug: entry.slug,
    category: entry.category,
    departmentId: typeof product.departmentId === "string" ? product.departmentId : null,
    categoryId: typeof product.categoryId === "string" ? product.categoryId : null,
    price: entry.price,
    stock: entry.stock,
    description: typeof product.description === "string" ? product.description : "",
    originalPrice: typeof product.originalPrice === "number" ? product.originalPrice : null,
    images: Array.isArray(product.images)
      ? product.images.filter((image): image is string => typeof image === "string" && image.length > 0)
      : typeof product.image === "string" && product.image
        ? [product.image]
        : [],
    ratings: typeof product.ratings === "number"
      ? product.ratings
      : typeof product.rating === "number"
        ? product.rating
        : 0,
    isNewArrival: product.isNewArrival === true,
    markazProductId: typeof product.markazProductId === "string" ? product.markazProductId : "",
    markazProductUrl: typeof product.markazProductUrl === "string" ? product.markazProductUrl : "",
    brand: typeof product.brand === "string" ? product.brand : "",
    sku: typeof product.sku === "string" ? product.sku : "",
    importSource: typeof product.importSource === "string" ? product.importSource : "manual",
    productCode: typeof product.productCode === "string"
      ? product.productCode
      : typeof product.markazCode === "string"
        ? product.markazCode
        : typeof product.supplierCode === "string" ? product.supplierCode : null,
    originalMarkazTitle: typeof product.originalMarkazTitle === "string"
      ? product.originalMarkazTitle
      : typeof product.markazTitle === "string" ? product.markazTitle : null
  };
}

function deduplicateImages(images: string[]): string[] {
  return [...new Set(images
    .map((image) => image.trim())
    .filter((image) => image && !image.toLocaleLowerCase().includes("example.com")))];
}

export default function AdminPage() {
  const [adminProductTab, setAdminProductTab] = useState<AdminProductTab>("import");
  const [adminKey, setAdminKey] = useState("");
  const [departmentLabels, setDepartmentLabels] = useState<Record<string, string>>({});
  const [newClassification, setNewClassification] = useState({ departmentId: "", categoryId: "", categoryName: "" });
  const [usingDefaultAdminKey, setUsingDefaultAdminKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [createdProduct, setCreatedProduct] = useState<CreatedProduct | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [refreshingProducts, setRefreshingProducts] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [editProductTab, setEditProductTab] = useState<"basic" | "details" | "seo">("basic");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [updatingProduct, setUpdatingProduct] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newProductImage, setNewProductImage] = useState("");
  const [imageToast, setImageToast] = useState("");
  const [newMarkazUrl, setNewMarkazUrl] = useState("");
  const [productSectionTab, setProductSectionTab] = useState<ProductSectionTab>("active");
  const [productSearch, setProductSearch] = useState("");
  const [productDrawerOpen, setProductDrawerOpen] = useState(false);
  const [productHistory, setProductHistory] = useState<ProductHistoryRow[]>([]);
  const [deletedProducts, setDeletedProducts] = useState<DeletedProductRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditActionId, setAuditActionId] = useState<string | null>(null);
  const [expandedAuditRow, setExpandedAuditRow] = useState<string | null>(null);
  const visibleProducts = products.filter((product) =>
    `${product.title} ${product.category} ${product.productCode ?? ""}`
      .toLocaleLowerCase()
      .includes(productSearch.trim().toLocaleLowerCase())
  );

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "local" || requestedTab === "import") setAdminProductTab(requestedTab);
  }, []);

  useEffect(() => {
    if (!imageToast) return;
    const timer = window.setTimeout(() => setImageToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [imageToast]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/departments", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || !Array.isArray(result.departments)) {
          throw new Error("Could not load department names.");
        }
        const labels: Record<string, string> = {};
        for (const entry of result.departments) {
          if (isRecord(entry) && typeof entry.id === "string" && typeof entry.name === "string") {
            labels[entry.id] = entry.name;
          }
        }
        if (!cancelled) setDepartmentLabels(labels);
      })
      .catch((error: unknown) => console.error("Could not load product department labels.", error));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (productSectionTab === "active") return;
    let cancelled = false;
    const endpoint = productSectionTab === "history"
      ? "/api/product-history?type=imported"
      : "/api/deleted-products";
    setAuditLoading(true);
    fetch(endpoint, {
      headers: { "x-admin-key": adminKey.trim() || "" },
      cache: "no-store"
    })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result)) {
          throw new Error(isRecord(result) && typeof result.error === "string"
            ? result.error
            : "Could not load product audit data.");
        }
        if (productSectionTab === "history") {
          if (!Array.isArray(result.history)) throw new Error("The server returned invalid product history.");
          const entries = result.history.filter((entry): entry is ProductHistoryRow =>
            isRecord(entry) && typeof entry.id === "number" && typeof entry.productId === "string" &&
            typeof entry.productName === "string" && typeof entry.action === "string" &&
            typeof entry.source === "string" && typeof entry.timestamp === "string" &&
            isRecord(entry.productSnapshot)
          );
          if (!cancelled) setProductHistory(entries);
        } else {
          if (!Array.isArray(result.deletedProducts)) throw new Error("The server returned an invalid deleted products list.");
          const entries = result.deletedProducts.filter((entry): entry is DeletedProductRow =>
            isRecord(entry) && typeof entry._id === "string" && typeof entry.deletedAt === "string" &&
            typeof entry.deletedBy === "string" && typeof entry.reason === "string"
          );
          if (!cancelled) setDeletedProducts(entries);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessageIsError(true);
        setMessage(error instanceof Error ? error.message : "Could not load product audit data.");
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productSectionTab, adminKey]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products?limit=100&includeAdminFields=true", {
      headers: { "x-admin-key": adminKey.trim() || "" },
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Admin configuration request failed with status ${response.status}.`);
        const result: unknown = await response.json();
        if (typeof result !== "object" || result === null || !("usingDefaultAdminKey" in result) ||
            typeof result.usingDefaultAdminKey !== "boolean" || !("products" in result) ||
            !Array.isArray(result.products)) {
          throw new Error("The server returned invalid admin configuration.");
        }
        const loadedProducts = result.products.flatMap((entry): AdminProduct[] => {
          const product = toAdminProduct(entry);
          return product ? [product] : [];
        });
        if (!cancelled) {
          setUsingDefaultAdminKey(result.usingDefaultAdminKey);
          setProducts(loadedProducts);
        }
      })
      .catch((error: unknown) => console.error("Could not check admin key configuration.", error));
    return () => {
      cancelled = true;
    };
  }, [adminKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setCreatedProduct(null);

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "").trim();
    const image = String(form.get("image") ?? "").trim();
    const originalPriceValue = String(form.get("originalPrice") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const price = Number(form.get("price"));
    const stock = Number(form.get("stock"));
    if (!title) {
      toast.error("Product name is required.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Price must be greater than zero.");
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      toast.error("Stock must be zero or greater.");
      return;
    }
    if (!newClassification.departmentId || !newClassification.categoryId || !newClassification.categoryName) {
      setMessageIsError(true);
      setMessage("Select a department and category before saving.");
      toast.error("Select a department and category before saving.");
      return;
    }

    const payload = {
      title,
      category: newClassification.categoryName,
      departmentId: newClassification.departmentId,
      categoryId: newClassification.categoryId,
      price,
      ...(originalPriceValue ? { originalPrice: Number(originalPriceValue) } : {}),
      images: deduplicateImages([image || "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500"]),
      stock,
      description,
      source: "local",
      isNewArrival: form.get("isNewArrival") === "on",
      markazProductId: String(form.get("markazProductId") ?? "").trim() || null,
      markazProductUrl: String(form.get("markazProductUrl") ?? "").trim() || null,
      ratings: Number.parseFloat(String(form.get("ratings"))) || 4.5
    };

    setSaving(true);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim() || ""
        },
        body: JSON.stringify(payload)
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const errorMessage = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Could not save the product.";
        throw new Error(errorMessage);
      }

      if (
        typeof result !== "object" ||
        result === null ||
        !("product" in result) ||
        typeof result.product !== "object" ||
        result.product === null ||
        !("_id" in result.product) ||
        !("title" in result.product) ||
        !("slug" in result.product) ||
        !("category" in result.product)
      ) {
        throw new Error("The server returned an invalid product response.");
      }

      const product: CreatedProduct = {
        _id: String(result.product._id),
        title: String(result.product.title),
        slug: String(result.product.slug),
        category: String(result.product.category)
      };
      setCreatedProduct(product);
      setMessageIsError(false);
      setMessage("Product saved.");
      toast.success(`Added "${product.title}".`);
      formElement.reset();
      setNewProductImage("");
      setNewMarkazUrl("");
      setNewClassification({ departmentId: "", categoryId: "", categoryName: "" });
      const productsResponse = await fetch("/api/products?limit=100&includeAdminFields=true", {
        headers: { "x-admin-key": adminKey.trim() || "" },
        cache: "no-store"
      });
      const productsResult: unknown = await productsResponse.json();
      if (!productsResponse.ok || typeof productsResult !== "object" || productsResult === null ||
          !("products" in productsResult) || !Array.isArray(productsResult.products)) {
        throw new Error("Product saved, but the product list could not be refreshed.");
      }
      setProducts(productsResult.products.flatMap((entry): AdminProduct[] => {
        const product = toAdminProduct(entry);
        return product ? [product] : [];
      }));
    } catch (error) {
      setMessageIsError(true);
      const errorMessage = error instanceof Error ? error.message : "Could not save the product.";
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(product: AdminProduct) {
    if (!window.confirm(`Are you sure you want to delete "${product.title}"? This cannot be undone.`)) return;
    setDeletingProductId(product._id);
    setMessage("");
    try {
      const response = await fetch(`/api/products?id=${encodeURIComponent(product._id)}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey.trim() || "" }
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const errorMessage = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Could not delete the product.";
        throw new Error(errorMessage);
      }
      setProducts((current) => current.filter((entry) => entry._id !== product._id));
      setMessageIsError(false);
      setMessage(`Deleted "${product.title}".`);
      toast.success(`Deleted "${product.title}".`);
    } catch (error) {
      setMessageIsError(true);
      const errorMessage = error instanceof Error ? error.message : "Could not delete the product.";
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeletingProductId(null);
    }
  }

  async function handleRefreshProducts() {
    setRefreshingProducts(true);
    setMessage("");
    try {
      const response = await fetch(`/api/products?limit=100&includeAdminFields=true&_=${Date.now()}`, {
        headers: { "x-admin-key": adminKey.trim() || "" },
        cache: "no-store"
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null ||
          !("products" in result) || !Array.isArray(result.products)) {
        const errorMessage = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Could not refresh the product list.";
        throw new Error(errorMessage);
      }
      setProducts(result.products.flatMap((entry): AdminProduct[] => {
        const product = toAdminProduct(entry);
        return product ? [product] : [];
      }));
      if ("usingDefaultAdminKey" in result && typeof result.usingDefaultAdminKey === "boolean") {
        setUsingDefaultAdminKey(result.usingDefaultAdminKey);
      }
      setMessageIsError(false);
      setMessage("Product list refreshed.");
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not refresh the product list.");
    } finally {
      setRefreshingProducts(false);
    }
  }

  async function handleRestoreProduct(product: DeletedProductRow) {
    setAuditActionId(product._id);
    setMessage("");
    try {
      const response = await fetch("/api/deleted-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim() || ""
        },
        body: JSON.stringify({ productId: product._id })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not restore the product.");
      }
      setDeletedProducts((current) => current.filter((entry) => entry._id !== product._id));
      setProducts((current) => {
        const restored = isRecord(result) ? toAdminProduct(result.product) : null;
        return restored && !current.some((entry) => entry._id === restored._id)
          ? [restored, ...current]
          : current;
      });
      setMessageIsError(false);
      setMessage(`Restored "${typeof product.title === "string" ? product.title : "product"}".`);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not restore the product.");
    } finally {
      setAuditActionId(null);
    }
  }

  async function handlePermanentlyDeleteProduct(product: DeletedProductRow) {
    const productName = typeof product.title === "string" ? product.title : "this product";
    if (!window.confirm(`Permanently delete "${productName}"? This cannot be undone.`)) return;
    setAuditActionId(product._id);
    setMessage("");
    try {
      const response = await fetch(`/api/deleted-products?productId=${encodeURIComponent(product._id)}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey.trim() || "" }
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not permanently delete the product.");
      }
      setDeletedProducts((current) => current.filter((entry) => entry._id !== product._id));
      setMessageIsError(false);
      setMessage(`Permanently deleted "${productName}".`);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not permanently delete the product.");
    } finally {
      setAuditActionId(null);
    }
  }

  async function handleUpdateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;
    setUpdatingProduct(true);
    setMessage("");
    try {
      const productId = editingProduct._id || editingProduct.id;
      if (!productId) throw new Error("A product ID is required to save changes.");
      const title = editingProduct.title.trim();
      if (!title) throw new Error("Product name is required.");
      if (!Number.isFinite(editingProduct.price) || editingProduct.price <= 0) {
        throw new Error("Price must be greater than zero.");
      }
      if (!Number.isFinite(editingProduct.stock) || editingProduct.stock < 0) {
        throw new Error("Stock must be zero or greater.");
      }
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim() || ""
        },
        body: JSON.stringify({
          title,
          description: editingProduct.description,
          category: editingProduct.category,
          departmentId: editingProduct.departmentId ?? null,
          categoryId: editingProduct.categoryId ?? null,
          price: Number(editingProduct.price),
          originalPrice: editingProduct.originalPrice,
          images: deduplicateImages(editingProduct.images),
          stock: Number(editingProduct.stock),
          ratings: Number(editingProduct.ratings),
          isNewArrival: editingProduct.isNewArrival,
          markazProductId: editingProduct.markazProductId.trim() || null,
          markazProductUrl: editingProduct.markazProductUrl.trim() || null,
          brand: editingProduct.brand,
          sku: editingProduct.sku
        })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const errorMessage = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Could not update the product.";
        throw new Error(errorMessage);
      }
      const updatedProduct = typeof result === "object" && result !== null && "product" in result
        ? toAdminProduct(result.product)
        : null;
      if (!updatedProduct) throw new Error("The server returned an invalid updated product.");
      setProducts((current) => current.map((product) =>
        product._id === productId ? updatedProduct : product
      ));
      setMessageIsError(false);
      setMessage(`Updated "${editingProduct.title}".`);
      toast.success(`Updated "${editingProduct.title}".`);
      setEditingProduct(null);
      setNewImageUrl("");
    } catch (error) {
      setMessageIsError(true);
      const errorMessage = error instanceof Error ? error.message : "Could not update the product.";
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUpdatingProduct(false);
    }
  }

  return (
    <main className={`${styles.page} admin-content`}>
      <AdminPageHeader
        title="Products"
        count={productSectionTab === "active" ? visibleProducts.length : undefined}
        description="Manage your catalog and supplier imports."
        searchValue={productSearch}
        searchPlaceholder="Search products..."
        onSearchChange={setProductSearch}
        action={
          <AdminButton variant="primary" onClick={() => {
            setAdminProductTab("local");
            setProductDrawerOpen(true);
          }}>
            + Add Product
          </AdminButton>
        }
      />

      <AdminCard className={styles.productsPanel} aria-labelledby="productsHeading">
        <div className={styles.productsHeading}>
          <h2 id="productsHeading">Product Catalog</h2>
          {productSectionTab === "active" && <span>{visibleProducts.length} products</span>}
          {productSectionTab === "active" && (
            <AdminButton
              variant="secondary"
              className={styles.refreshButton}
              type="button"
              disabled={refreshingProducts}
              onClick={handleRefreshProducts}
            >
              {refreshingProducts ? "Refreshing..." : "Refresh"}
            </AdminButton>
          )}
        </div>
        <div className={styles.productTabs} role="tablist" aria-label="Product management">
          {([
            ["active", "Active Products"],
            ["history", "Import History"],
            ["deleted", "Deleted Products (Archive)"]
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              className={productSectionTab === tab ? styles.productTabActive : styles.productTab}
              type="button"
              role="tab"
              id={`product-tab-${tab}`}
              aria-selected={productSectionTab === tab}
              aria-controls={`product-panel-${tab}`}
              onClick={() => setProductSectionTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          id={`product-panel-${productSectionTab}`}
          role="tabpanel"
          aria-labelledby={`product-tab-${productSectionTab}`}
          className={styles.productTabPanel}
        >
          {productSectionTab === "active" && (
            visibleProducts.length === 0 ? (
              <p className={styles.productsEmpty}>No products found.</p>
            ) : (
              <ul className={styles.productList}>
                {visibleProducts.map((product) => (
                  <li className={styles.productRow} key={product._id}>
                      <button
                        className={styles.productIdentity}
                        type="button"
                        aria-label={`Edit ${product.title}`}
                        onClick={() => {
                          setEditingProduct(product);
                          setEditProductTab("basic");
                          setNewImageUrl("");
                        }}
                      >
                        {product.images[0] ? (
                          <img src={product.images[0]} alt="" width={48} height={48} loading="lazy" />
                        ) : (
                          <span className={styles.productImagePlaceholder} aria-hidden="true">—</span>
                        )}
                        <div>
                          <strong>{product.title}</strong>
                          {product.originalMarkazTitle && product.originalMarkazTitle !== product.title && (
                            <span className={styles.productSupplierTitle}>
                              Original supplier title: {product.originalMarkazTitle}
                            </span>
                          )}
                          <span>
                            {product.departmentId && departmentLabels[product.departmentId]
                              ? `${departmentLabels[product.departmentId]} > ${product.category}`
                              : product.category}
                            {" · Rs "}{product.price.toLocaleString("en-PK")} · Stock {product.stock} · Code {product.productCode || "N/A"}
                          </span>
                        </div>
                      </button>
                    <div className={styles.productActions}>
                      <AdminButton
                        variant="secondary"
                        type="button"
                        onClick={() => {
                          setEditingProduct(product);
                          setEditProductTab("basic");
                          setNewImageUrl("");
                        }}
                      >
                        Edit
                      </AdminButton>
                      <AdminButton
                        variant="danger"
                        type="button"
                        disabled={deletingProductId === product._id}
                        onClick={() => handleDeleteProduct(product)}
                      >
                        {deletingProductId === product._id ? "Deleting..." : "Delete"}
                      </AdminButton>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
          {productSectionTab === "history" && (
            auditLoading ? (
              <p className={styles.productsEmpty}>Loading import history...</p>
            ) : productHistory.length === 0 ? (
              <p className={styles.productsEmpty}>No import history yet.</p>
            ) : (
              <AdminTable className={styles.auditTableWrap}>
                <table className={styles.auditTable}>
                  <thead>
                    <tr>
                      <th>Product Name</th><th>Source</th><th>File Name</th>
                      <th>Imported On</th><th>Price</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productHistory.map((entry) => {
                      const rowId = `history-${entry.id}`;
                      const expanded = expandedAuditRow === rowId;
                      return (
                        <Fragment key={rowId}>
                          <tr key={rowId}>
                            <td>{entry.productName}</td>
                            <td>{formatImportSource(entry.source)}</td>
                            <td>{entry.sourceFileName || "—"}</td>
                            <td>{formatAuditDate(entry.timestamp)}</td>
                            <td>{productPrice(entry.productSnapshot, "price")}</td>
                            <td>
                              <button
                                className={styles.auditAction}
                                type="button"
                                aria-expanded={expanded}
                                onClick={() => setExpandedAuditRow(expanded ? null : rowId)}
                              >
                                {expanded ? "Hide" : "View"}
                              </button>
                            </td>
                          </tr>
                          {expanded && (
                            <tr className={styles.snapshotRow} key={`${rowId}-snapshot`}>
                              <td colSpan={6}><pre>{JSON.stringify(entry.productSnapshot, null, 2)}</pre></td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </AdminTable>
            )
          )}
          {productSectionTab === "deleted" && (
            auditLoading ? (
              <p className={styles.productsEmpty}>Loading deleted products...</p>
            ) : deletedProducts.length === 0 ? (
              <p className={styles.productsEmpty}>No deleted products</p>
            ) : (
              <AdminTable className={styles.auditTableWrap}>
                <table className={styles.auditTable}>
                  <thead>
                    <tr>
                      <th>Product Name</th><th>Deleted On</th><th>Original Price</th>
                      <th>Source</th><th>Reason</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedProducts.map((product) => {
                      const rowId = `deleted-${product._id}`;
                      const expanded = expandedAuditRow === rowId;
                      return (
                        <Fragment key={rowId}>
                          <tr key={rowId}>
                            <td>{typeof product.title === "string" ? product.title : "Unnamed product"}</td>
                            <td>{formatAuditDate(product.deletedAt)}</td>
                            <td>{productPrice(product, "originalPrice")}</td>
                            <td>{formatImportSource(product.importSource)}</td>
                            <td>{product.reason}</td>
                            <td>
                              <div className={styles.auditActions}>
                                <button
                                  className={styles.auditAction}
                                  type="button"
                                  disabled={auditActionId === product._id}
                                  onClick={() => void handleRestoreProduct(product)}
                                >
                                  Restore
                                </button>
                                <button
                                  className={styles.auditDanger}
                                  type="button"
                                  disabled={auditActionId === product._id}
                                  onClick={() => void handlePermanentlyDeleteProduct(product)}
                                >
                                  Permanent Delete
                                </button>
                                <button
                                  className={styles.auditAction}
                                  type="button"
                                  aria-expanded={expanded}
                                  onClick={() => setExpandedAuditRow(expanded ? null : rowId)}
                                >
                                  {expanded ? "Hide JSON" : "View JSON"}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expanded && (
                            <tr className={styles.snapshotRow} key={`${rowId}-snapshot`}>
                              <td colSpan={6}><pre>{JSON.stringify(product, null, 2)}</pre></td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </AdminTable>
            )
          )}
        </div>
      </AdminCard>

      <AdminDrawer
        title={adminProductTab === "import" ? "Import from Markaz" : "Add local product"}
        open={productDrawerOpen}
        onClose={() => setProductDrawerOpen(false)}
      >
        <div className={styles.adminProductTabs} role="tablist" aria-label="Add products">
          <button
            id="admin-product-tab-import"
            type="button"
            role="tab"
            aria-selected={adminProductTab === "import"}
            aria-controls="admin-product-panel"
            className={adminProductTab === "import" ? styles.adminProductTabActive : styles.adminProductTab}
            onClick={() => setAdminProductTab("import")}
          >
            Import from Markaz
          </button>
          <button
            id="admin-product-tab-local"
            type="button"
            role="tab"
            aria-selected={adminProductTab === "local"}
            aria-controls="admin-product-panel"
            className={adminProductTab === "local" ? styles.adminProductTabActive : styles.adminProductTab}
            onClick={() => setAdminProductTab("local")}
          >
            Add Local Product
          </button>
        </div>
        <div id="admin-product-panel" role="tabpanel" aria-labelledby={`admin-product-tab-${adminProductTab}`}>
          {adminProductTab === "import" ? <MarkazImportForm /> : (
            <form className={styles.form} onSubmit={handleSubmit}>
              {usingDefaultAdminKey && (
                <p className={`${styles.keyWarning} ${styles.fullWidth}`} role="note">
                  Using the built-in fallback admin key. Set ADMIN_KEY in the project-root .env.local to change it.
                </p>
              )}
              <label className={styles.fullWidth}>
                Admin API key
                <input type="password" autoComplete="off" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} placeholder="Optional API key (admin session is used automatically)" />
                <span className={styles.hint}>This key is sent only with the product request and is not stored.</span>
              </label>
              <label>Product name<input name="title" type="text" maxLength={200} required /></label>
              <DepartmentCategoryFields departmentId={newClassification.departmentId} categoryId={newClassification.categoryId} onChange={setNewClassification} />
              <label>Price (Rs)<input name="price" type="number" min="0.01" step="0.01" required /></label>
              <label>Original price (Rs)<input name="originalPrice" type="number" min="0" step="0.01" /></label>
              <label>Stock<input name="stock" type="number" min="0" step="1" defaultValue="100" required /></label>
              <label>Rating (0-5)<input name="ratings" type="number" min="0" max="5" step="0.1" defaultValue="0" required /></label>
              <label className={styles.fullWidth}>Image URL<input name="image" type="url" value={newProductImage} onChange={(event) => setNewProductImage(event.target.value)} placeholder="Paste image URL" /></label>
              {newProductImage.trim() && (
                <div className={styles.fullWidth}>
                  <span className={styles.hint}>Image preview</span>
                  <img
                    src={newProductImage}
                    alt="New product preview"
                    width={160}
                    height={160}
                    style={{ objectFit: "contain", borderRadius: 8, background: "#f8fafc" }}
                  />
                </div>
              )}
              <label className={styles.fullWidth}>Description<textarea name="description" rows={4} maxLength={5000} /></label>
              <fieldset className={`${styles.fullWidth} ${styles.markazMapping}`}>
                <legend>Dropshipping / Markaz Mapping (optional)</legend>
                <label>Markaz Product Link<input name="markazProductUrl" type="url" value={newMarkazUrl} onChange={(event) => setNewMarkazUrl(event.target.value)} placeholder="https://markaz.app.link/product/..." /></label>
                <label>Markaz Product ID<input name="markazProductId" type="text" maxLength={1000} placeholder="Optional product ID" /></label>
                {!newMarkazUrl.trim() && <p className={styles.markazWarning}>Markaz link not set. Add one only if this local product is dropshipped.</p>}
                {newMarkazUrl.trim() && !isMarkazProductUrl(newMarkazUrl) && <p className={styles.markazError} role="alert">The product link must contain a Markaz domain.</p>}
              </fieldset>
              <div className={`${styles.checkboxes} ${styles.fullWidth}`}><label><input name="isNewArrival" type="checkbox" />Mark as New Arrival</label></div>
              <button className={styles.submit} type="submit" disabled={saving}>{saving ? "Saving product..." : "Save Local Product"}</button>
              <p className={`${styles.message} ${messageIsError ? styles.error : styles.success}`} role={messageIsError ? "alert" : "status"} aria-live="polite">{message}</p>
              {createdProduct && <p className={`${styles.created} ${styles.fullWidth}`}>Saved <strong>{createdProduct.title}</strong> ({createdProduct.category}) with slug <code>{createdProduct.slug}</code>.</p>}
            </form>
          )}
        </div>
      </AdminDrawer>

      {editingProduct && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.editModal} role="dialog" aria-modal="true" aria-labelledby="editProductHeading">
            <h2 id="editProductHeading">Edit product</h2>
            <div className={styles.productTabs} role="tablist" aria-label="Product details">
              {([
                ["basic", "Basic"],
                ["details", "Details"],
                ["seo", "SEO / Deals"]
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={editProductTab === tab}
                  className={editProductTab === tab ? styles.productTabActive : styles.productTab}
                  onClick={() => {
                    setEditProductTab(tab);
                    document.getElementById(`edit-product-${tab}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <form className={styles.modalForm} onSubmit={handleUpdateProduct}>
              <label id="edit-product-basic">
                Name
                <input
                  type="text"
                  value={editingProduct.title}
                  onChange={(event) => setEditingProduct({ ...editingProduct, title: event.target.value })}
                  maxLength={200}
                  required
                />
              </label>
              <div id="edit-product-details" className={styles.modalFullWidth}>
                <DepartmentCategoryFields
                  departmentId={editingProduct.departmentId ?? ""}
                  categoryId={editingProduct.categoryId ?? ""}
                  onChange={(classification) => setEditingProduct({
                    ...editingProduct,
                    departmentId: classification.departmentId,
                    categoryId: classification.categoryId,
                    category: classification.categoryName
                  })}
                />
              </div>
              <fieldset id="edit-product-seo" className={`${styles.modalFullWidth} ${styles.markazMapping}`}>
                <legend>Dropshipping / Markaz Mapping</legend>
                <label>
                  Markaz Product Link
                  <input
                    type="url"
                    value={editingProduct.markazProductUrl}
                    onChange={(event) => setEditingProduct((current) => current
                      ? { ...current, markazProductUrl: event.target.value }
                      : current)}
                    placeholder="https://markaz.app.link/product/..."
                  />
                </label>
                <label>
                  Markaz Product ID
                  <input
                    type="text"
                    maxLength={1000}
                    value={editingProduct.markazProductId}
                    onChange={(event) => setEditingProduct((current) => current
                      ? { ...current, markazProductId: event.target.value }
                      : current)}
                    placeholder="Optional product ID"
                  />
                </label>
                {!editingProduct.markazProductUrl.trim() ? (
                  <p className={styles.markazWarning}>Markaz link not set - fulfillment will be slow</p>
                ) : !isMarkazProductUrl(editingProduct.markazProductUrl) ? (
                  <p className={styles.markazError} role="alert">The product link must contain a Markaz domain.</p>
                ) : null}
              </fieldset>
              <label className={styles.modalFullWidth}>
                Description
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={editingProduct.description}
                  onChange={(event) => setEditingProduct({ ...editingProduct, description: event.target.value })}
                />
              </label>
              <label>
                Price (Rs)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editingProduct.price}
                  onChange={(event) => setEditingProduct({ ...editingProduct, price: Number(event.target.value) })}
                  required
                />
              </label>
              <label>
                Original price (Rs)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingProduct.originalPrice ?? ""}
                  onChange={(event) => setEditingProduct({
                    ...editingProduct,
                    originalPrice: event.target.value === "" ? null : Number(event.target.value)
                  })}
                />
              </label>
              <label>
                Stock
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editingProduct.stock}
                  onChange={(event) => setEditingProduct({ ...editingProduct, stock: Number(event.target.value) })}
                  required
                />
              </label>
              <label>
                Rating (0-5)
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={editingProduct.ratings}
                  onChange={(event) => setEditingProduct({ ...editingProduct, ratings: Number(event.target.value) })}
                />
              </label>
              <div className={`${styles.imageFields} ${styles.modalFullWidth}`}>
                <span>Images</span>
                {editingProduct.images.map((image, index) => (
                  <div className={styles.imageRow} key={`${image}-${index}`}>
                    <input
                      aria-label={`Image URL ${index + 1}`}
                      type="url"
                      value={image}
                      onChange={(event) => setEditingProduct({
                        ...editingProduct,
                        images: editingProduct.images.map((currentImage, currentIndex) =>
                          currentIndex === index ? event.target.value : currentImage
                        )
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingProduct({
                        ...editingProduct,
                        images: editingProduct.images.filter((_, currentIndex) => currentIndex !== index)
                      })}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className={styles.imageRow}>
                  <input
                    type="url"
                    aria-label="New image URL"
                    placeholder="Paste image URL"
                    value={newImageUrl}
                    onChange={(event) => setNewImageUrl(event.target.value)}
                  />
                  <button
                    type="button"
                    disabled={!newImageUrl.trim()}
                    onClick={() => {
                      const imageUrl = newImageUrl.trim();
                      if (editingProduct.images.some((image) =>
                        image.trim().toLocaleLowerCase() === imageUrl.toLocaleLowerCase()
                      )) {
                        setImageToast("Image already added");
                        return;
                      }
                      setEditingProduct({
                        ...editingProduct,
                        images: [...editingProduct.images, imageUrl]
                      });
                      setNewImageUrl("");
                      setImageToast("");
                    }}
                  >
                    Add image
                  </button>
                </div>
                {imageToast && <p className={styles.imageToast} role="status">{imageToast}</p>}
                {newImageUrl.trim() && (
                  <img
                    className={styles.modalFullWidth}
                    src={newImageUrl}
                    alt="New product image preview"
                    width={160}
                    height={160}
                    style={{ objectFit: "contain", borderRadius: 8, background: "#f8fafc" }}
                  />
                )}
              </div>
              <label>
                Brand
                <input
                  type="text"
                  value={editingProduct.brand}
                  onChange={(event) => setEditingProduct({ ...editingProduct, brand: event.target.value })}
                />
              </label>
              <label>
                SKU
                <input
                  type="text"
                  value={editingProduct.sku}
                  onChange={(event) => setEditingProduct({ ...editingProduct, sku: event.target.value })}
                />
              </label>
              <div className={`${styles.checkboxes} ${styles.modalFullWidth}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={editingProduct.isNewArrival}
                    onChange={(event) => setEditingProduct({ ...editingProduct, isNewArrival: event.target.checked })}
                  />
                  Mark as New Arrival (Shows in Department New Arrivals)
                </label>
              </div>
              <div className={`${styles.modalActions} ${styles.modalFullWidth}`}>
                <button type="submit" disabled={updatingProduct}>
                  {updatingProduct ? "Saving..." : "Save changes"}
                </button>
                <button type="button" disabled={updatingProduct} onClick={() => setEditingProduct(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
