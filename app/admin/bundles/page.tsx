"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, X, Clock } from "lucide-react";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import styles from "./bundles.module.css";

type BundleItem = { title: string; image: string; price: number };
type Bundle = {
  _id: string;
  name: string;
  tag: string;
  images: string[];
  items: BundleItem[];
  setPrice: number;
  valuePrice: number;
  savings: number;
  timerHours: number;
  timerExpiry: string;
  stockTotal: number;
  stockClaimed: number;
  isActive: boolean;
  createdAt: string;
};
type BundleForm = {
  name: string;
  tag: string;
  images: string[];
  items: Array<{ title: string; image: string; price: string }>;
  setPrice: string;
  valuePrice: string;
  timerHours: string;
  stockTotal: string;
  isActive: boolean;
};

const EMPTY_FORM: BundleForm = {
  name: "",
  tag: "VALUE SET",
  images: ["", "", ""],
  items: [],
  setPrice: "",
  valuePrice: "",
  timerHours: "4",
  stockTotal: "50",
  isActive: true
};

function money(value: number): string {
  return `Rs ${value.toLocaleString("en-PK")}`;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not set";
}

function countdown(value: string, now: number): string {
  const remaining = Math.max(0, Date.parse(value) - now);
  if (!Number.isFinite(remaining) || remaining === 0) return "Ended";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function AdminBundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [form, setForm] = useState<BundleForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());

  const loadBundles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/bundles", { cache: "no-store" });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Could not load value sets.";
        throw new Error(message);
      }
      if (!Array.isArray(result)) throw new Error("The value set service returned an invalid response.");
      setBundles(result as Bundle[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load value sets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBundles();
  }, [loadBundles]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function startNewBundle() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setNotice("");
    setIsOpen(true);
  }

  function editBundle(bundle: Bundle) {
    setEditingId(bundle._id);
    setForm({
      name: bundle.name,
      tag: bundle.tag,
      images: [...bundle.images, "", "", ""].slice(0, 3),
      items: bundle.items.map((item) => ({ ...item, price: String(item.price) })),
      setPrice: String(bundle.setPrice),
      valuePrice: String(bundle.valuePrice),
      timerHours: String(bundle.timerHours),
      stockTotal: String(bundle.stockTotal),
      isActive: bundle.isActive
    });
    setError("");
    setIsOpen(true);
  }

  async function saveBundle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      ...form,
      images: form.images.filter((image) => image.trim()),
      items: form.items.filter((item) => item.title.trim()).map((item) => ({
        ...item,
        price: Number(item.price)
      })),
      setPrice: Number(form.setPrice),
      valuePrice: Number(form.valuePrice),
      timerHours: Number(form.timerHours),
      stockTotal: Number(form.stockTotal),
      timerExpiry: new Date(Date.now() + Number(form.timerHours) * 60 * 60 * 1000).toISOString()
    };
    try {
      const response = await fetch(editingId ? `/api/bundles/${encodeURIComponent(editingId)}` : "/api/bundles", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Could not save the value set.";
        throw new Error(message);
      }
      setIsOpen(false);
      setNotice(editingId ? "Value set updated." : "Value set created.");
      await loadBundles();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the value set.");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(bundle: Bundle, isActive: boolean) {
    setError("");
    try {
      const response = await fetch(`/api/bundles/${encodeURIComponent(bundle._id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Could not update the value set.";
        throw new Error(message);
      }
      setBundles((current) => current.map((item) => item._id === bundle._id ? { ...item, isActive } : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update the value set.");
    }
  }

  async function deleteBundle(bundle: Bundle) {
    if (!window.confirm(`Delete "${bundle.name}" permanently?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/bundles/${encodeURIComponent(bundle._id)}`, { method: "DELETE" });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Could not delete the value set.";
        throw new Error(message);
      }
      setBundles((current) => current.filter((item) => item._id !== bundle._id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the value set.");
    }
  }

  function patchItem(index: number, key: "title" | "image" | "price", value: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
    }));
  }

  const previewImage = form.images.find(Boolean) || form.items.find((item) => item.image)?.image || "";
  const previewSetPrice = Number(form.setPrice) || 0;
  const previewValuePrice = Number(form.valuePrice) || 0;

  return (
    <main className={styles.page}>
      <AdminPageHeader
        title="Value Sets"
        description="Create curated bundles, manage limited stock, and set promotional timers."
        action={
          <button className={styles.primaryButton} type="button" onClick={startNewBundle}>
            <Plus size={17} aria-hidden="true" /> Add New Bundle
          </button>
        }
      />

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <section className={styles.tableCard} aria-label="Value sets">
        {loading ? <p className={styles.empty}>Loading value sets…</p> : bundles.length === 0 ? (
          <p className={styles.empty}>No bundles yet. Create your first Value Set.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Image</th><th>Name</th><th>Set Price</th><th>Value</th><th>Timer Expiry</th>
                  <th>Stock</th><th>Claimed</th><th>Active</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bundles.map((bundle) => {
                  const claimedPercent = bundle.stockTotal > 0
                    ? Math.min(100, Math.round(bundle.stockClaimed / bundle.stockTotal * 100))
                    : 0;
                  return (
                    <tr key={bundle._id}>
                      <td>
                        {bundle.images[0]
                          ? <Image className={styles.bundleImage} src={bundle.images[0]} alt="" width={48} height={48} unoptimized />
                          : <span className={styles.bundleImagePlaceholder}>—</span>}
                      </td>
                      <td>
                        <strong>{bundle.name}</strong>
                        <small className={styles.tag}>{bundle.tag}</small>
                      </td>
                      <td>{money(bundle.setPrice)}</td>
                      <td>{money(bundle.valuePrice)}</td>
                      <td>
                        <span className={styles.timer}><Clock size={13} aria-hidden="true" />{countdown(bundle.timerExpiry, now)}</span>
                        <small className={styles.expiryDate}>{dateLabel(bundle.timerExpiry)}</small>
                      </td>
                      <td>{bundle.stockTotal - bundle.stockClaimed}/{bundle.stockTotal} left</td>
                      <td>
                        <div className={styles.progressCell}>
                          <span className={styles.progressTrack}><span style={{ width: `${claimedPercent}%` }} /></span>
                          <small>{claimedPercent}%</small>
                        </div>
                      </td>
                      <td>
                        <button
                          className={`${styles.toggle} ${bundle.isActive ? styles.toggleOn : ""}`}
                          type="button"
                          aria-pressed={bundle.isActive}
                          onClick={() => void setActive(bundle, !bundle.isActive)}
                        >
                          {bundle.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button type="button" aria-label={`Edit ${bundle.name}`} onClick={() => editBundle(bundle)}><Pencil size={16} /></button>
                          <button type="button" aria-label={`Delete ${bundle.name}`} onClick={() => void deleteBundle(bundle)}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setIsOpen(false);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="bundle-form-title">
            <div className={styles.modalHeading}>
              <div>
                <span className={styles.eyebrow}>CURATED COLLECTION</span>
                <h2 id="bundle-form-title">{editingId ? "Edit Value Set" : "Create Value Set"}</h2>
              </div>
              <button className={styles.closeButton} type="button" aria-label="Close form" onClick={() => setIsOpen(false)} disabled={saving}><X size={20} /></button>
            </div>
            <form className={styles.formLayout} onSubmit={saveBundle}>
              <div className={styles.formFields}>
                <label>Bundle name<input required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                <label>Tag<select value={form.tag} onChange={(event) => setForm({ ...form, tag: event.target.value })}>
                  <option>VALUE SET</option><option>LIMITED EDITION</option><option>CURATED SET</option>
                </select></label>
                <div className={styles.twoColumns}>
                  <label>Set price (Rs)<input required type="number" min="0" step="1" value={form.setPrice} onChange={(event) => setForm({ ...form, setPrice: event.target.value })} /></label>
                  <label>Value price (Rs)<input required type="number" min="0" step="1" value={form.valuePrice} onChange={(event) => setForm({ ...form, valuePrice: event.target.value })} /></label>
                </div>
                <div className={styles.twoColumns}>
                  <label>Timer (1–72 hours)<input required type="number" min="1" max="72" value={form.timerHours} onChange={(event) => setForm({ ...form, timerHours: event.target.value })} /></label>
                  <label>Stock total<input required type="number" min={editingId ? bundles.find((bundle) => bundle._id === editingId)?.stockClaimed ?? 0 : 0} value={form.stockTotal} onChange={(event) => setForm({ ...form, stockTotal: event.target.value })} /></label>
                </div>
                <fieldset className={styles.fieldset}>
                  <legend>Image URLs (up to 3)</legend>
                  {form.images.map((image, index) => (
                    <label key={`image-${index}`}>Image {index + 1}<input type="url" placeholder="https://…" value={image} onChange={(event) => setForm((current) => ({
                      ...current,
                      images: current.images.map((url, imageIndex) => imageIndex === index ? event.target.value : url)
                    }))} /></label>
                  ))}
                </fieldset>
                <fieldset className={styles.fieldset}>
                  <legend>What’s inside</legend>
                  {form.items.map((item, index) => (
                    <div className={styles.itemFields} key={`item-${index}`}>
                      <label>Item title<input required value={item.title} maxLength={200} onChange={(event) => patchItem(index, "title", event.target.value)} /></label>
                      <label>Image URL<input type="url" value={item.image} placeholder="https://…" onChange={(event) => patchItem(index, "image", event.target.value)} /></label>
                      <label>Value (Rs)<input required type="number" min="0" value={item.price} onChange={(event) => patchItem(index, "price", event.target.value)} /></label>
                      <button type="button" className={styles.removeItem} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}>Remove item</button>
                    </div>
                  ))}
                  <button className={styles.secondaryButton} type="button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { title: "", image: "", price: "" }] }))}>
                    <Plus size={15} /> Add item
                  </button>
                </fieldset>
                <label className={styles.activeCheck}><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active on storefront</label>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <div className={styles.formActions}>
                  <button className={styles.secondaryButton} type="button" onClick={() => setIsOpen(false)} disabled={saving}>Cancel</button>
                  <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save Changes" : "Create Bundle"}</button>
                </div>
              </div>
              <aside className={styles.preview}>
                <span className={styles.eyebrow}>STOREFRONT PREVIEW</span>
                <div className={styles.previewImage}>
                  {previewImage ? <Image src={previewImage} alt="" fill sizes="300px" unoptimized /> : <span>Bundle image preview</span>}
                  <span className={styles.previewBadge}>SAVE {money(Math.max(0, previewValuePrice - previewSetPrice))}</span>
                </div>
                <small>{form.tag}</small>
                <h3>{form.name || "Your curated value set"}</h3>
                <p><strong>{money(previewSetPrice)}</strong> <del>{money(previewValuePrice)}</del></p>
                <span className={styles.previewSavings}>You save {money(Math.max(0, previewValuePrice - previewSetPrice))}</span>
                <small className={styles.expiryPreview}>
                  Expires {new Date(Date.now() + (Number(form.timerHours) || 4) * 60 * 60 * 1000).toLocaleString()}
                </small>
                <button className={styles.previewButton} type="button" disabled>Add Set to Bag</button>
              </aside>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
