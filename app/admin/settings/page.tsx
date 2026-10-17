"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import styles from "./settings.module.css";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = sessionStorage.getItem("zavimart-admin-key")?.trim() || "";
    fetch("/api/admin/auto-import", {
      headers: { "x-admin-key": key },
      cache: "no-store"
    })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || result.enabled !== false) {
          throw new Error(isRecord(result) && typeof result.error === "string"
            ? result.error
            : "Could not load import settings.");
        }
        if (!cancelled) setDisabled(typeof result.disabledAt === "string");
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load import settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function disableAutoImport() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const key = sessionStorage.getItem("zavimart-admin-key")?.trim() || "";
      const response = await fetch("/api/admin/auto-import", {
        method: "POST",
        headers: { "x-admin-key": key }
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result) || result.success !== true || result.enabled !== false) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not disable automatic imports.");
      }
      setDisabled(true);
      setNotice("Automatic Markaz imports are disabled. Products now appear only when saved to the store.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not disable automatic imports.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`${styles.page} admin-content`}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>STORE CONTROL</p>
        <h1>Admin Settings</h1>
        <p>Manage product sourcing and store operations.</p>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <section className={styles.card}>
        <div className={styles.cardIcon}><ShieldCheck size={22} /></div>
        <div className={styles.cardBody}>
          <span className={styles.eyebrow}>PRODUCT SOURCING</span>
          <h2>Automatic Markaz imports</h2>
          <p>
            Products are no longer pulled from bundled Markaz samples during page loads.
            Only saved store products and imports you explicitly start are listed.
          </p>
          <div className={styles.stateLine}>
            <span className={disabled ? styles.statusOff : styles.statusPending} />
            {loading ? "Checking settings…" : disabled ? "Auto-import disabled" : "Auto-import disabled by default"}
          </div>
        </div>
        <button
          className={styles.disableButton}
          type="button"
          onClick={() => void disableAutoImport()}
          disabled={loading || saving || disabled}
        >
          {saving ? <LoaderCircle className={styles.spinner} size={16} /> : disabled ? <Check size={16} /> : <Sparkles size={16} />}
          {saving ? "Disabling…" : disabled ? "Disabled" : "Disable Auto-Import"}
        </button>
      </section>

      <Link className={styles.settingsLink} href="/admin/free-delivery">
        <span><strong>Free delivery settings</strong><small>Manage shipping fees and free delivery thresholds.</small></span>
        <ArrowRight size={18} />
      </Link>
    </main>
  );
}
