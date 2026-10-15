"use client";

import { useEffect, useState } from "react";
import type { ShippingSettings } from "../../../lib/shippingSettings";
import styles from "./free-delivery.module.css";

const initialSettings: ShippingSettings = {
  freeDeliveryEnabled: true,
  minAmountForFree: 2999,
  shippingFee: 149,
  bannerText: "Free delivery above Rs 2,999",
  updatedAt: ""
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSettings(value: unknown): ShippingSettings {
  if (
    !isRecord(value) ||
    typeof value.freeDeliveryEnabled !== "boolean" ||
    typeof value.minAmountForFree !== "number" ||
    typeof value.shippingFee !== "number" ||
    typeof value.bannerText !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("Shipping settings returned an invalid response.");
  }
  return {
    freeDeliveryEnabled: value.freeDeliveryEnabled,
    minAmountForFree: value.minAmountForFree,
    shippingFee: value.shippingFee,
    bannerText: value.bannerText,
    updatedAt: value.updatedAt
  };
}

function previewFor(settings: ShippingSettings, amount: number): string {
  if (amount <= 0) return "Add products to your cart to see the delivery fee.";
  if (settings.freeDeliveryEnabled && amount >= settings.minAmountForFree) return "Free Delivery";
  if (!settings.freeDeliveryEnabled) return `Shipping Fee: Rs ${settings.shippingFee.toLocaleString("en-PK")}`;
  return `Shipping Fee: Rs ${settings.shippingFee.toLocaleString("en-PK")} | Add Rs ${(settings.minAmountForFree - amount).toLocaleString("en-PK")} more for Free Delivery`;
}

export default function FreeDeliverySettingsPage() {
  const [settings, setSettings] = useState<ShippingSettings>(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shipping", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          throw new Error(isRecord(result) && typeof result.error === "string"
            ? result.error
            : "Could not load shipping settings.");
        }
        const loadedSettings = parseSettings(result);
        if (!cancelled) setSettings(loadedSettings);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load shipping settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/shipping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": sessionStorage.getItem("zavimart-admin-key")?.trim() || ""
        },
        body: JSON.stringify({
          freeDeliveryEnabled: settings.freeDeliveryEnabled,
          minAmountForFree: settings.minAmountForFree,
          shippingFee: settings.shippingFee,
          bannerText: settings.bannerText
        })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not save shipping settings.");
      }
      const savedSettings = parseSettings(result);
      setSettings(savedSettings);
      localStorage.setItem("shipping_updated", Date.now().toString());
      window.dispatchEvent(new Event("shipping_updated"));
      setNotice("Shipping settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save shipping settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`${styles.page} admin-content`}>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>ZaviMart operations</span>
        <h1>Free Delivery Settings</h1>
        <p>Control free delivery eligibility and standard shipping fees.</p>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}

      <form className={styles.card} onSubmit={saveSettings}>
        <h2>Delivery rules</h2>
        <label className={styles.toggleRow}>
          <span>
            <strong>Free Delivery Enabled</strong>
            <small>{settings.freeDeliveryEnabled ? "Customers can qualify for free delivery." : "Standard shipping applies to all orders."}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Free Delivery Enabled"
            checked={settings.freeDeliveryEnabled}
            onChange={(event) => setSettings((current) => ({ ...current, freeDeliveryEnabled: event.target.checked }))}
          />
        </label>

        <label className={styles.field}>
          Minimum Order Amount for Free Delivery
          <span className={styles.inputWithPrefix}>
            <span>Rs</span>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={settings.minAmountForFree}
              onChange={(event) => setSettings((current) => ({ ...current, minAmountForFree: Number(event.target.value) }))}
            />
          </span>
        </label>
        <label className={styles.field}>
          Standard Shipping Fee
          <span className={styles.inputWithPrefix}>
            <span>Rs</span>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={settings.shippingFee}
              onChange={(event) => setSettings((current) => ({ ...current, shippingFee: Number(event.target.value) }))}
            />
          </span>
        </label>
        <label className={styles.field}>
          Banner Text
          <input
            type="text"
            maxLength={160}
            required
            value={settings.bannerText}
            onChange={(event) => setSettings((current) => ({ ...current, bannerText: event.target.value }))}
          />
        </label>
        <button className={styles.saveButton} type="submit" disabled={saving || loading}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>

      <section className={styles.preview} aria-labelledby="previewTitle">
        <span className={styles.eyebrow}>Storefront calculation</span>
        <h2 id="previewTitle">Live Preview</h2>
        <div className={styles.previewGrid}>
          <article className={styles.previewExample}>
            <span>Cart total: Rs 1,200</span>
            <strong>{previewFor(settings, 1200)}</strong>
          </article>
          <article className={styles.previewExample}>
            <span>Cart total: Rs 2,000</span>
            <strong>{previewFor(settings, 2000)}</strong>
          </article>
        </div>
      </section>
    </main>
  );
}
