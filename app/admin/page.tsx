"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { PRODUCT_CATEGORIES } from "../../lib/product-categories";
import styles from "./admin.module.css";

type CreatedProduct = {
  _id: string;
  title: string;
  slug: string;
  category: string;
};

type AdminProduct = CreatedProduct & {
  price: number;
  stock: number;
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("zavi123");
  const [usingDefaultAdminKey, setUsingDefaultAdminKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [createdProduct, setCreatedProduct] = useState<CreatedProduct | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [updatingProduct, setUpdatingProduct] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products?limit=100", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Admin configuration request failed with status ${response.status}.`);
        const result: unknown = await response.json();
        if (typeof result !== "object" || result === null || !("usingDefaultAdminKey" in result) ||
            typeof result.usingDefaultAdminKey !== "boolean" || !("products" in result) ||
            !Array.isArray(result.products)) {
          throw new Error("The server returned invalid admin configuration.");
        }
        const loadedProducts = result.products.flatMap((entry): AdminProduct[] => {
          if (
            typeof entry !== "object" || entry === null ||
            !("_id" in entry) || typeof entry._id !== "string" ||
            !("title" in entry) || typeof entry.title !== "string" ||
            !("slug" in entry) || typeof entry.slug !== "string" ||
            !("category" in entry) || typeof entry.category !== "string" ||
            !("price" in entry) || typeof entry.price !== "number" ||
            !("stock" in entry) || typeof entry.stock !== "number"
          ) return [];
          return [{
            _id: entry._id,
            title: entry.title,
            slug: entry.slug,
            category: entry.category,
            price: entry.price,
            stock: entry.stock
          }];
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
  }, []);

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

    const payload = {
      title,
      category: String(form.get("category") ?? ""),
      price: Number(form.get("price")),
      ...(originalPriceValue ? { originalPrice: Number(originalPriceValue) } : {}),
      images: [image || "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500"],
      stock: Number.parseInt(String(form.get("stock")).replace(/^0+/, ""), 10) || 100,
      description,
      isFlashDeal: form.get("isFlashDeal") === "on",
      isFeatured: form.get("isFeatured") === "on",
      ratings: Number.parseFloat(String(form.get("ratings"))) || 4.5
    };

    setSaving(true);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim() || "zavi123"
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
      setMessage(`Product saved. Admin key used: ${adminKey.trim() || "zavi123"}`);
      formElement.reset();
      const productsResponse = await fetch("/api/products?limit=100", { cache: "no-store" });
      const productsResult: unknown = await productsResponse.json();
      if (!productsResponse.ok || typeof productsResult !== "object" || productsResult === null ||
          !("products" in productsResult) || !Array.isArray(productsResult.products)) {
        throw new Error("Product saved, but the product list could not be refreshed.");
      }
      setProducts(productsResult.products.flatMap((entry): AdminProduct[] => {
        if (
          typeof entry !== "object" || entry === null ||
          !("_id" in entry) || typeof entry._id !== "string" ||
          !("title" in entry) || typeof entry.title !== "string" ||
          !("slug" in entry) || typeof entry.slug !== "string" ||
          !("category" in entry) || typeof entry.category !== "string" ||
          !("price" in entry) || typeof entry.price !== "number" ||
          !("stock" in entry) || typeof entry.stock !== "number"
        ) return [];
        return [{
          _id: entry._id,
          title: entry.title,
          slug: entry.slug,
          category: entry.category,
          price: entry.price,
          stock: entry.stock
        }];
      }));
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not save the product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(product: AdminProduct) {
    if (!window.confirm(`Delete "${product.title}"? This cannot be undone.`)) return;
    setDeletingProductId(product._id);
    setMessage("");
    try {
      const response = await fetch(`/api/products?id=${encodeURIComponent(product._id)}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey.trim() || "zavi123" }
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
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not delete the product.");
    } finally {
      setDeletingProductId(null);
    }
  }

  async function handleUpdateProduct() {
    if (!editingProduct) return;
    setUpdatingProduct(true);
    setMessage("");
    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim() || "zavi123"
        },
        body: JSON.stringify({
          _id: editingProduct._id,
          title: editingProduct.title,
          price: Number(editingProduct.price),
          stock: Number(editingProduct.stock)
        })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const errorMessage = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Could not update the product.";
        throw new Error(errorMessage);
      }
      setProducts((current) => current.map((product) =>
        product._id === editingProduct._id ? editingProduct : product
      ));
      setMessageIsError(false);
      setMessage(`Updated "${editingProduct.title}".`);
      setEditingProduct(null);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not update the product.");
    } finally {
      setUpdatingProduct(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ZaviMart catalog</span>
          <h1>Add a product</h1>
          <p>New products are saved to MongoDB and become available in the catalog API.</p>
        </div>
        <div className={styles.headerLinks}>
          <Link className={styles.backLink} href="/admin/product-import">Product import</Link>
          <Link className={styles.backLink} href="/">Back to storefront</Link>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        {usingDefaultAdminKey && (
          <p className={`${styles.keyWarning} ${styles.fullWidth}`} role="note">
            Using default admin key: zavi123 - Set ZAVIMART_ADMIN_API_KEY in .env.local to change
          </p>
        )}
        <label className={styles.fullWidth}>
          Admin API key
          <input
            type="password"
            autoComplete="off"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="Enter ZAVIMART_ADMIN_API_KEY"
          />
          <span className={styles.hint}>This key is sent only with the product request and is not stored.</span>
        </label>

        <label>
          Product name
          <input name="title" type="text" maxLength={200} required />
        </label>

        <label>
          Category
          <select name="category" required defaultValue="">
            <option value="" disabled>Select a category</option>
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>

        <label>
          Price (Rs)
          <input name="price" type="number" min="0" step="0.01" required />
        </label>

        <label>
          Original price (Rs)
          <input name="originalPrice" type="number" min="0" step="0.01" />
        </label>

        <label>
          Stock
          <input name="stock" type="number" min="0" step="1" defaultValue="0" required />
        </label>

        <label>
          Rating (0-5)
          <input name="ratings" type="number" min="0" max="5" step="0.1" defaultValue="0" required />
        </label>

        <label className={styles.fullWidth}>
          Image URL
          <input name="image" type="url" placeholder="https://example.com/product.jpg" />
        </label>

        <label className={styles.fullWidth}>
          Description
          <textarea name="description" rows={4} maxLength={5000} />
        </label>

        <div className={`${styles.checkboxes} ${styles.fullWidth}`}>
          <label><input name="isFlashDeal" type="checkbox" /> Flash deal</label>
          <label><input name="isFeatured" type="checkbox" /> Featured product</label>
        </div>

        <button className={styles.submit} type="submit" disabled={saving}>
          {saving ? "Saving product..." : "Save product"}
        </button>
        <p className={`${styles.message} ${messageIsError ? styles.error : styles.success}`} role={messageIsError ? "alert" : "status"} aria-live="polite">
          {message}
        </p>
        {createdProduct && (
          <p className={`${styles.created} ${styles.fullWidth}`}>
            Saved <strong>{createdProduct.title}</strong> ({createdProduct.category}) with slug{" "}
            <code>{createdProduct.slug}</code>.
          </p>
        )}
      </form>

      <section className={styles.productsPanel} aria-labelledby="productsHeading">
        <div className={styles.productsHeading}>
          <h2 id="productsHeading">Manage products</h2>
          <span>{products.length} products</span>
        </div>
        {products.length === 0 ? (
          <p className={styles.productsEmpty}>No products found.</p>
        ) : (
          <ul className={styles.productList}>
            {products.map((product) => (
              <li className={styles.productRow} key={product._id}>
                <div>
                  <strong>{product.title}</strong>
                  <span>{product.category} · Rs {product.price.toLocaleString("en-PK")} · Stock {product.stock}</span>
                </div>
                <div className={styles.productActions}>
                  <button type="button" onClick={() => setEditingProduct({ ...product })}>Edit</button>
                  <button
                    type="button"
                    disabled={deletingProductId === product._id}
                    onClick={() => handleDeleteProduct(product)}
                  >
                    {deletingProductId === product._id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editingProduct && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.editModal} role="dialog" aria-modal="true" aria-labelledby="editProductHeading">
            <h2 id="editProductHeading">Edit product</h2>
            <label>
              Name
              <input
                value={editingProduct.title}
                onChange={(event) => setEditingProduct({ ...editingProduct, title: event.target.value })}
                maxLength={200}
              />
            </label>
            <label>
              Price (Rs)
              <input
                type="number"
                min="0"
                step="0.01"
                value={editingProduct.price}
                onChange={(event) => setEditingProduct({ ...editingProduct, price: Number(event.target.value) })}
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
              />
            </label>
            <div className={styles.modalActions}>
              <button type="button" disabled={updatingProduct} onClick={handleUpdateProduct}>
                {updatingProduct ? "Saving..." : "Save changes"}
              </button>
              <button type="button" disabled={updatingProduct} onClick={() => setEditingProduct(null)}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
