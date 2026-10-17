"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Image as ImageIcon,
  LoaderCircle,
  Maximize2,
  Megaphone,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
  Volume2,
  X
} from "lucide-react";
import KineticAd, { type KineticAdHandle } from "../../../components/ads/KineticAd";
import {
  AD_ANIMATION_SPEEDS,
  AD_ANIMATION_STYLES,
  AD_AUDIO_TYPES,
  AD_DISPLAY_LOCATIONS,
  AD_DURATIONS,
  AD_FILTER_PRESETS,
  AD_FONT_STYLES,
  AD_IMAGE_POSITIONS,
  AD_PRODUCT_ANIMATIONS,
  AD_PRODUCT_CARD_STYLES,
  AD_TEXT_ALIGNMENTS,
  AD_TEXT_EFFECTS,
  DEFAULT_AD,
  type AdAnimationSpeed,
  type AdAnimationStyle,
  type AdAudioType,
  type AdCustomImage,
  type AdData,
  type AdDisplayLocation,
  type AdDuration,
  type AdFilterPreset,
  type AdFontStyle,
  type AdImagePosition,
  type AdProductAnimation,
  type AdProductCardStyle,
  type AdProductPreview,
  type AdTextAlignment,
  type AdTextEffect
} from "../../../lib/ad-types";
import styles from "./ads.module.css";

type CatalogProduct = AdProductPreview;

const FILTER_LABELS: Record<AdFilterPreset, string> = {
  none: "None",
  "luxury-dark": "Luxury Dark",
  "gold-tint": "Gold Tint",
  "blur-bg": "Blur BG",
  "grayscale-luxury": "Grayscale Luxury",
  vintage: "Vintage",
  "neon-glow": "Neon Glow",
  cinematic: "Cinematic"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseChoice<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  return typeof value === "string" && options.some((option) => option === value)
    ? value as T[number]
    : fallback;
}

function parseProducts(value: unknown): CatalogProduct[] {
  if (!isRecord(value) || !Array.isArray(value.products)) return [];
  return value.products.flatMap((entry): CatalogProduct[] => {
    if (!isRecord(entry)) return [];
    const id = typeof entry._id === "string" ? entry._id : typeof entry.id === "string" ? entry.id : "";
    const title = typeof entry.title === "string" ? entry.title : typeof entry.name === "string" ? entry.name : "";
    if (!id || !title) return [];
    const images = Array.isArray(entry.images) ? entry.images : [];
    return [{
      id,
      title,
      image: typeof entry.image === "string" ? entry.image : typeof images[0] === "string" ? images[0] : "",
      price: typeof entry.price === "number" ? entry.price : Number(entry.price) || 0
    }];
  });
}

function parseAd(value: unknown): AdData | null {
  if (!isRecord(value)) return null;
  const stringArray = (input: unknown, fallback: string[]) =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === "string") : fallback;
  const productDetails = Array.isArray(value.productDetails)
    ? value.productDetails.flatMap((item): AdProductPreview[] => {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.title !== "string") return [];
      return [{
        id: item.id,
        title: item.title,
        image: typeof item.image === "string" ? item.image : "",
        price: typeof item.price === "number" ? item.price : 0
      }];
    })
    : [];
  const customImages = Array.isArray(value.customImages)
    ? value.customImages.flatMap((item): AdCustomImage[] => {
      if (!isRecord(item) || typeof item.url !== "string") return [];
      return [{
        url: item.url,
        position: parseChoice(item.position, AD_IMAGE_POSITIONS, "foreground"),
        x: typeof item.x === "number" ? item.x : 50,
        y: typeof item.y === "number" ? item.y : 50,
        scale: typeof item.scale === "number" ? item.scale : 1
      }];
    })
    : [];
  return {
    ...DEFAULT_AD,
    id: typeof value.id === "string" ? value.id : undefined,
    campaignName: typeof value.campaignName === "string" ? value.campaignName : DEFAULT_AD.campaignName,
    displayLocation: parseChoice(value.displayLocation, AD_DISPLAY_LOCATIONS, DEFAULT_AD.displayLocation),
    titleLines: stringArray(value.titleLines, DEFAULT_AD.titleLines),
    secondLines: stringArray(value.secondLines, DEFAULT_AD.secondLines),
    finalLines: stringArray(value.finalLines, DEFAULT_AD.finalLines),
    products: stringArray(value.products, []),
    productDetails,
    ctaText: typeof value.ctaText === "string" ? value.ctaText : DEFAULT_AD.ctaText,
    ctaLink: typeof value.ctaLink === "string" ? value.ctaLink : DEFAULT_AD.ctaLink,
    logoText: typeof value.logoText === "string" ? value.logoText : DEFAULT_AD.logoText,
    bgColor: typeof value.bgColor === "string" ? value.bgColor : DEFAULT_AD.bgColor,
    textColor: typeof value.textColor === "string" ? value.textColor : DEFAULT_AD.textColor,
    goldColor: typeof value.goldColor === "string" ? value.goldColor : DEFAULT_AD.goldColor,
    audioUrl: typeof value.audioUrl === "string" ? value.audioUrl : DEFAULT_AD.audioUrl,
    audioType: parseChoice(value.audioType, AD_AUDIO_TYPES, DEFAULT_AD.audioType),
    beatSync: value.beatSync === true,
    volume: typeof value.volume === "number" ? value.volume : DEFAULT_AD.volume,
    customImages,
    animationStyle: parseChoice(value.animationStyle, AD_ANIMATION_STYLES, DEFAULT_AD.animationStyle),
    animationSpeed: parseChoice(value.animationSpeed, AD_ANIMATION_SPEEDS, DEFAULT_AD.animationSpeed),
    textEffect: parseChoice(value.textEffect, AD_TEXT_EFFECTS, DEFAULT_AD.textEffect),
    filterPreset: parseChoice(value.filterPreset, AD_FILTER_PRESETS, DEFAULT_AD.filterPreset),
    customBg: typeof value.customBg === "string" ? value.customBg : DEFAULT_AD.customBg,
    overlayOpacity: typeof value.overlayOpacity === "number" ? value.overlayOpacity : DEFAULT_AD.overlayOpacity,
    brightness: typeof value.brightness === "number" ? value.brightness : DEFAULT_AD.brightness,
    contrast: typeof value.contrast === "number" ? value.contrast : DEFAULT_AD.contrast,
    blurAmount: typeof value.blurAmount === "number" ? value.blurAmount : DEFAULT_AD.blurAmount,
    goldTintOpacity: typeof value.goldTintOpacity === "number" ? value.goldTintOpacity : DEFAULT_AD.goldTintOpacity,
    fontStyle: parseChoice(value.fontStyle, AD_FONT_STYLES, DEFAULT_AD.fontStyle),
    textSize: typeof value.textSize === "number" ? value.textSize : DEFAULT_AD.textSize,
    textAlignment: parseChoice(value.textAlignment, AD_TEXT_ALIGNMENTS, DEFAULT_AD.textAlignment),
    productAnimation: parseChoice(value.productAnimation, AD_PRODUCT_ANIMATIONS, DEFAULT_AD.productAnimation),
    productCardStyle: parseChoice(value.productCardStyle, AD_PRODUCT_CARD_STYLES, DEFAULT_AD.productCardStyle),
    duration: parseChoice(value.duration, AD_DURATIONS, DEFAULT_AD.duration),
    beatIntensity: typeof value.beatIntensity === "number" ? value.beatIntensity : DEFAULT_AD.beatIntensity,
    isActive: value.isActive === true,
    placement: "homepage",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined
  };
}

function errorMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function splitWords(value: string): string[] {
  return value.split(",").map((word) => word.trim()).filter(Boolean);
}

export default function AdminAdsPage() {
  const [ads, setAds] = useState<AdData[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [draft, setDraft] = useState<AdData>(DEFAULT_AD);
  const [openingWords, setOpeningWords] = useState(DEFAULT_AD.titleLines.join(", "));
  const [momentumWords, setMomentumWords] = useState(DEFAULT_AD.secondLines.join(", "));
  const [finalWords, setFinalWords] = useState(DEFAULT_AD.finalLines.join(", "));
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [playingAudio, setPlayingAudio] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [imageDragging, setImageDragging] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<KineticAdHandle>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const adminHeaders = useCallback((): HeadersInit => {
    const key = sessionStorage.getItem("zavimart-admin-key")?.trim();
    return key ? { "x-admin-key": key } : {};
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = adminHeaders();
      const [adsResponse, productsResponse] = await Promise.all([
        fetch("/api/admin/ads", { cache: "no-store", headers }),
        fetch("/api/products?includeAdminFields=true&limit=100", { cache: "no-store", headers })
      ]);
      const [adsPayload, productsPayload]: [unknown, unknown] = await Promise.all([
        adsResponse.json(),
        productsResponse.json()
      ]);
      if (!adsResponse.ok) throw new Error(errorMessage(adsPayload, "Could not load campaigns."));
      if (!productsResponse.ok) throw new Error(errorMessage(productsPayload, "Could not load products."));
      setAds(isRecord(adsPayload) && Array.isArray(adsPayload.ads)
        ? adsPayload.ads.map(parseAd).filter((ad): ad is AdData => ad !== null)
        : []);
      setProducts(parseProducts(productsPayload));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Ads Studio data.");
    } finally {
      setLoading(false);
    }
  }, [adminHeaders]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedProducts = useMemo(
    () => products.filter((product) => draft.products.includes(product.id)).slice(0, 4),
    [draft.products, products]
  );
  const visibleProducts = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase();
    return products
      .filter((product) => !term || product.title.toLocaleLowerCase().includes(term))
      .slice(0, 40);
  }, [productSearch, products]);
  const previewAd = useMemo<AdData>(() => ({
    ...draft,
    titleLines: splitWords(openingWords),
    secondLines: splitWords(momentumWords),
    finalLines: splitWords(finalWords),
    productDetails: selectedProducts
  }), [draft, openingWords, momentumWords, finalWords, selectedProducts]);

  function updateDraft<K extends keyof AdData>(key: K, value: AdData[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function newCampaign() {
    setDraft({ ...DEFAULT_AD, customImages: [], products: [], productDetails: [] });
    setOpeningWords(DEFAULT_AD.titleLines.join(", "));
    setMomentumWords(DEFAULT_AD.secondLines.join(", "));
    setFinalWords(DEFAULT_AD.finalLines.join(", "));
    setEditingId(undefined);
    setNotice("Ready to create a new campaign.");
    setError("");
  }

  function editCampaign(ad: AdData) {
    setDraft({ ...ad, customImages: [...ad.customImages], products: [...ad.products] });
    setOpeningWords(ad.titleLines.join(", "));
    setMomentumWords(ad.secondLines.join(", "));
    setFinalWords(ad.finalLines.join(", "));
    setEditingId(ad.id);
    setNotice(`Editing ${ad.campaignName}.`);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleProduct(id: string) {
    setDraft((current) => {
      if (current.products.includes(id)) {
        return { ...current, products: current.products.filter((productId) => productId !== id) };
      }
      if (current.products.length >= 4) {
        setError("Choose up to 4 products for a campaign.");
        return current;
      }
      setError("");
      return { ...current, products: [...current.products, id] };
    });
  }

  async function uploadImages(files: FileList | File[]) {
    const selected = Array.from(files);
    if (!selected.length) return;
    if (draft.customImages.length + selected.length > 4) {
      setError("Upload up to 4 custom pictures.");
      return;
    }
    if (selected.some((file) => !/^image\/(?:png|jpeg|webp|gif)$/i.test(file.type) || file.size > 350_000)) {
      setError("Choose PNG, JPG, WebP, or GIF files no larger than 350 KB each.");
      return;
    }
    try {
      const formData = new FormData();
      selected.forEach((file) => formData.append("images", file));
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: adminHeaders(),
        body: formData
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Could not upload the selected pictures."));
      if (!isRecord(payload) || !Array.isArray(payload.images) ||
          payload.images.length !== selected.length ||
          payload.images.some((url) => typeof url !== "string")) {
        throw new Error("The image upload returned an invalid response.");
      }
      const images = payload.images.map((url): AdCustomImage => ({
        url: url as string,
        position: "foreground",
        x: 50,
        y: 50,
        scale: 1
      }));
      updateDraft("customImages", [...draft.customImages, ...images]);
      setError("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not read the selected pictures.");
    }
  }

  function updateImage(index: number, patch: Partial<AdCustomImage>) {
    updateDraft("customImages", draft.customImages.map((image, imageIndex) =>
      imageIndex === index ? { ...image, ...patch } : image
    ));
  }

  async function saveCampaign(event: ChangeEvent<HTMLFormElement> | React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/ads", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({
          ...draft,
          titleLines: splitWords(openingWords),
          secondLines: splitWords(momentumWords),
          finalLines: splitWords(finalWords),
          id: editingId
        })
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Could not save the campaign."));
      const savedId = isRecord(payload) && isRecord(payload.ad) && typeof payload.ad.id === "string"
        ? payload.ad.id
        : editingId;
      setEditingId(savedId);
      setNotice(draft.isActive ? "Campaign saved and set live." : "Campaign saved.");
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCampaign(ad: AdData) {
    if (!ad.id || !window.confirm(`Delete "${ad.campaignName}"?`)) return;
    setError("");
    try {
      const response = await fetch("/api/admin/ads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ id: ad.id })
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Could not delete the campaign."));
      if (editingId === ad.id) newCampaign();
      setNotice("Campaign deleted.");
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the campaign.");
    }
  }

  async function previewFullscreen() {
    try {
      await previewRef.current?.requestFullscreen();
    } catch (fullscreenError) {
      setError(fullscreenError instanceof Error ? fullscreenError.message : "Could not open the fullscreen preview.");
    }
  }

  function updateAudioType(value: string) {
    const audioType = parseChoice(value, AD_AUDIO_TYPES, DEFAULT_AD.audioType);
    updateDraft("audioType", audioType);
    if (audioType === "none" || audioType !== "custom") updateDraft("audioUrl", "");
  }

  return (
    <main className={`${styles.page} ${styles.proStudio} admin-content`}>
      <header className={styles.proHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.titleIcon}><Megaphone size={20} /></span>
          <div>
            <p className={styles.eyebrow}>ZAVI MART · CREATIVE CAMPAIGNS</p>
            <h1>PRO Ad Studio</h1>
            <p className={styles.subtitle}>Build, preview, and publish your next campaign.</p>
          </div>
        </div>
        <div className={styles.proHeaderActions}>
          <label className={styles.setLiveToggle}>
            <input type="checkbox" checked={draft.isActive} onChange={(event) => updateDraft("isActive", event.target.checked)} />
            <span className={styles.switch} />
            <span>{draft.isActive ? "Live" : "Set Live"}</span>
          </label>
          <button type="button" className={styles.secondaryButton} onClick={() => void previewFullscreen()}>
            <Maximize2 size={15} /> Preview
          </button>
          <button type="submit" form="pro-ad-builder" className={styles.primaryButton} disabled={saving}>
            {saving ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}
            {saving ? "Saving…" : "Save Ad"}
          </button>
        </div>
      </header>

      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <form id="pro-ad-builder" className={styles.proBuilder} onSubmit={(event) => void saveCampaign(event)}>
        <div className={styles.proFormColumn}>
          <section className={styles.proSection}>
            <h2><span>01</span> Campaign Settings</h2>
            <label className={styles.proField}>
              <span>Campaign name</span>
              <input value={draft.campaignName} onChange={(event) => updateDraft("campaignName", event.target.value)} maxLength={100} placeholder="e.g. Autumn Edit" required />
            </label>
            <div className={styles.proTwoFields}>
              <label className={styles.proField}>
                <span>Status</span>
                <span className={styles.setLiveToggle}>
                  <input type="checkbox" checked={draft.isActive} onChange={(event) => updateDraft("isActive", event.target.checked)} />
                  <span className={styles.switch} />
                  <span>{draft.isActive ? "Active" : "Inactive"}</span>
                </span>
              </label>
              <label className={styles.proField}>
                <span>Display location</span>
                <select value={draft.displayLocation} onChange={(event) => updateDraft("displayLocation", event.target.value as AdDisplayLocation)}>
                  <option value="homepage-hero">Homepage Hero</option>
                  <option value="product-page">Product Page</option>
                  <option value="fullscreen">Fullscreen</option>
                </select>
              </label>
            </div>
          </section>

          <section className={styles.proSection}>
            <h2><span>02</span> Story Beats / Text Layers</h2>
            <label className={styles.proField}>
              <span>Opening words</span>
              <textarea rows={2} value={openingWords} onChange={(event) => setOpeningWords(event.target.value)} placeholder="WHAT, EVER, YOU, BUY" required />
            </label>
            <label className={styles.proField}>
              <span>Momentum words</span>
              <textarea rows={2} value={momentumWords} onChange={(event) => setMomentumWords(event.target.value)} placeholder="SELL, MORE, MORE" required />
            </label>
            <label className={styles.proField}>
              <span>Final words</span>
              <textarea rows={2} value={finalWords} onChange={(event) => setFinalWords(event.target.value)} placeholder="MORE, PROFIT" required />
            </label>
            <p className={styles.proHelp}>Use comma to separate words, they will animate one by one.</p>
            <div className={styles.proThreeFields}>
              <label className={styles.proField}>
                <span>Font style</span>
                <select value={draft.fontStyle} onChange={(event) => updateDraft("fontStyle", event.target.value as AdFontStyle)}>
                  <option value="black">Black</option>
                  <option value="bold">Bold</option>
                  <option value="luxury-serif">Luxury Serif</option>
                </select>
              </label>
              <label className={styles.proField}>
                <span>Alignment</span>
                <select value={draft.textAlignment} onChange={(event) => updateDraft("textAlignment", event.target.value as AdTextAlignment)}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label className={styles.proRange}>
                <span>Text size <b>{draft.textSize}px</b></span>
                <input type="range" min="24" max="128" value={draft.textSize} onChange={(event) => updateDraft("textSize", Number(event.target.value))} />
              </label>
            </div>
          </section>

          <section className={styles.proSection}>
            <div className={styles.proSectionHeader}>
              <h2><span>03</span> Product Showcase</h2>
              <b>{draft.products.length}/4</b>
            </div>
            <label className={styles.proSearch}>
              <Search size={16} />
              <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products" aria-label="Search products" />
            </label>
            <div className={styles.proProductGrid}>
              {visibleProducts.map((product) => {
                const selected = draft.products.includes(product.id);
                return (
                  <button type="button" key={product.id} className={`${styles.proProductOption} ${selected ? styles.proProductSelected : ""}`} onClick={() => toggleProduct(product.id)} aria-pressed={selected}>
                    <span className={styles.proProductImage}>
                      {product.image ? <img src={product.image} alt="" /> : <ImageIcon size={19} />}
                    </span>
                    <span>{product.title}<small>Rs. {product.price.toLocaleString()}</small></span>
                    {selected && <Check size={14} />}
                  </button>
                );
              })}
              {!visibleProducts.length && <p className={styles.proHelp}>{products.length ? "No matching products." : "No products available."}</p>}
            </div>
            {selectedProducts.length > 0 && (
              <div className={styles.proSelectedProducts}>
                {selectedProducts.map((product) => (
                  <article key={product.id} className={styles.proSelectedProduct}>
                    {product.image ? <img src={product.image} alt="" /> : <ImageIcon size={18} />}
                    <span>{product.title}<small>Rs. {product.price.toLocaleString()}</small></span>
                    <button type="button" onClick={() => toggleProduct(product.id)} aria-label={`Remove ${product.title}`}><X size={15} /></button>
                  </article>
                ))}
              </div>
            )}
            <div className={styles.proTwoFields}>
              <label className={styles.proField}>
                <span>Product animation</span>
                <select value={draft.productAnimation} onChange={(event) => updateDraft("productAnimation", event.target.value as AdProductAnimation)}>
                  <option value="float">Float</option>
                  <option value="slide">Slide</option>
                  <option value="rotate-3d">3D Rotate</option>
                  <option value="static">Static</option>
                </select>
              </label>
              <label className={styles.proField}>
                <span>Card style</span>
                <select value={draft.productCardStyle} onChange={(event) => updateDraft("productCardStyle", event.target.value as AdProductCardStyle)}>
                  <option value="minimal">Minimal</option>
                  <option value="luxury-gold">Luxury Gold</option>
                  <option value="glass">Glass</option>
                  <option value="neon">Neon</option>
                </select>
              </label>
            </div>
          </section>

          <section className={styles.proSection}>
            <h2><span>04</span> Visual Studio</h2>
            <div
              className={`${styles.imageDropzone} ${imageDragging ? styles.imageDropzoneActive : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => imageInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") imageInputRef.current?.click();
              }}
              onDragOver={(event) => { event.preventDefault(); setImageDragging(true); }}
              onDragLeave={() => setImageDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setImageDragging(false);
                void uploadImages(event.dataTransfer.files);
              }}
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                hidden
                onChange={(event) => {
                  void uploadImages(event.currentTarget.files ?? []);
                  event.currentTarget.value = "";
                }}
              />
              <Upload size={19} />
              <strong>Upload Custom Picture</strong>
              <small>Drop up to 4 JPG, PNG, WebP, or GIF - 350KB each</small>
            </div>
            {draft.customImages.map((image, index) => (
              <div className={styles.proImageRow} key={`${image.url.slice(0, 50)}-${index}`}>
                <img src={image.url} alt={`Custom image ${index + 1}`} />
                <div className={styles.proImageControls}>
                  <label className={styles.proField}>
                    <span>Position</span>
                    <select value={image.position} onChange={(event) => updateImage(index, { position: event.target.value as AdImagePosition })}>
                      <option value="background">Background</option>
                      <option value="foreground">Foreground</option>
                      <option value="floating">Floating</option>
                    </select>
                  </label>
                  <label className={styles.proRange}><span>X <b>{image.x}%</b></span><input type="range" min="0" max="100" value={image.x} onChange={(event) => updateImage(index, { x: Number(event.target.value) })} /></label>
                  <label className={styles.proRange}><span>Y <b>{image.y}%</b></span><input type="range" min="0" max="100" value={image.y} onChange={(event) => updateImage(index, { y: Number(event.target.value) })} /></label>
                  <label className={styles.proRange}><span>Scale <b>{Math.round(image.scale * 100)}%</b></span><input type="range" min="25" max="200" value={Math.round(image.scale * 100)} onChange={(event) => updateImage(index, { scale: Number(event.target.value) / 100 })} /></label>
                </div>
                <button type="button" className={styles.proRemoveImage} onClick={() => updateDraft("customImages", draft.customImages.filter((_, imageIndex) => imageIndex !== index))} aria-label={`Delete image ${index + 1}`}><Trash2 size={15} /></button>
              </div>
            ))}
            <label className={styles.proField}>
              <span>Custom background</span>
              <input value={draft.customBg} onChange={(event) => updateDraft("customBg", event.target.value)} placeholder="https://... or linear-gradient(...)" maxLength={2048} />
            </label>
            <div className={styles.proTwoFields}>
              <label className={styles.proField}>
                <span>Animation style</span>
                <select value={draft.animationStyle} onChange={(event) => updateDraft("animationStyle", event.target.value as AdAnimationStyle)}>
                  <option value="kinetic-shopify">Kinetic Shopify</option><option value="fade-up">Fade Up</option>
                  <option value="zoom-in">Zoom In</option><option value="slide-left">Slide Left</option>
                  <option value="typewriter">Typewriter</option><option value="bounce">Bounce</option><option value="rotate-3d">Rotate 3D</option>
                </select>
              </label>
              <label className={styles.proField}>
                <span>Animation speed</span>
                <select value={draft.animationSpeed} onChange={(event) => updateDraft("animationSpeed", event.target.value as AdAnimationSpeed)}>
                  <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option><option value="beat-sync">Beat Sync</option>
                </select>
              </label>
            </div>
            <label className={styles.proField}>
              <span>Text effect</span>
              <select value={draft.textEffect} onChange={(event) => updateDraft("textEffect", event.target.value as AdTextEffect)}>
                <option value="none">None</option><option value="glow-gold">Glow Gold</option><option value="stroke">Stroke</option>
                <option value="shadow-3d">Shadow 3D</option><option value="gradient-gold">Gradient Gold</option>
              </select>
            </label>
            <div className={styles.proFilterGrid}>
              {AD_FILTER_PRESETS.map((preset) => (
                <button type="button" key={preset} onClick={() => updateDraft("filterPreset", preset)} className={`${styles.proFilter} ${draft.filterPreset === preset ? styles.proFilterSelected : ""}`} aria-pressed={draft.filterPreset === preset}>
                  <span className={`${styles.filterSample} ${styles[`filterSample-${preset}`]}`} />
                  <span>{FILTER_LABELS[preset]}</span>
                </button>
              ))}
            </div>
            <div className={styles.proTwoFields}>
              <label className={styles.proRange}><span>Brightness <b>{draft.brightness}%</b></span><input type="range" min="0" max="200" value={draft.brightness} onChange={(event) => updateDraft("brightness", Number(event.target.value))} /></label>
              <label className={styles.proRange}><span>Contrast <b>{draft.contrast}%</b></span><input type="range" min="0" max="200" value={draft.contrast} onChange={(event) => updateDraft("contrast", Number(event.target.value))} /></label>
              <label className={styles.proRange}><span>Blur <b>{draft.blurAmount}px</b></span><input type="range" min="0" max="20" value={draft.blurAmount} onChange={(event) => updateDraft("blurAmount", Number(event.target.value))} /></label>
              <label className={styles.proRange}><span>Gold tint <b>{draft.goldTintOpacity}%</b></span><input type="range" min="0" max="100" value={draft.goldTintOpacity} onChange={(event) => updateDraft("goldTintOpacity", Number(event.target.value))} /></label>
            </div>
          </section>

          <section className={styles.proSection}>
            <h2><span>05</span> Sound &amp; Motion</h2>
            <label className={styles.proField}>
              <span>Audio track</span>
              <select value={draft.audioType} onChange={(event) => updateAudioType(event.target.value)}>
                <option value="punchy-beat">Punchy Shopify Beat</option>
                <option value="deep-bass">Luxury Trap</option>
                <option value="none">No Audio</option>
                <option value="custom">Custom URL</option>
                <option value="luxury-tick">Luxury Tick</option>
              </select>
            </label>
            {draft.audioType === "custom" && (
              <label className={styles.proField}>
                <span>Custom audio URL</span>
                <input value={draft.audioUrl} onChange={(event) => updateDraft("audioUrl", event.target.value)} placeholder="https://example.com/track.mp3" />
              </label>
            )}
            <label className={styles.proRange}>
              <span><span><Volume2 size={15} /> Volume</span><b>{draft.volume}%</b></span>
              <input type="range" min="0" max="100" value={draft.volume} onChange={(event) => updateDraft("volume", Number(event.target.value))} />
            </label>
            <label className={styles.proRange}>
              <span>Beat intensity <b>{draft.beatIntensity}%</b></span>
              <input type="range" min="0" max="100" value={draft.beatIntensity} onChange={(event) => updateDraft("beatIntensity", Number(event.target.value))} />
            </label>
            <label className={styles.setLiveToggle}>
              <input type="checkbox" checked={draft.beatSync} onChange={(event) => updateDraft("beatSync", event.target.checked)} />
              <span className={styles.switch} />
              <span>Sync motion to beat</span>
            </label>
            <div className={styles.waveform} aria-label="Audio waveform visualization">
              {Array.from({ length: 42 }, (_, index) => <i key={index} style={{ height: `${10 + ((index * 17 + index % 7 * 9) % 34)}px` }} />)}
            </div>
            <button type="button" className={styles.proAudioButton} disabled={draft.audioType === "none"} onClick={() => {
              if (playingAudio) {
                playerRef.current?.stop();
                setPlayingAudio(false);
              } else {
                playerRef.current?.playWithSound();
                setPlayingAudio(true);
              }
            }}>
              <Play size={15} fill="currentColor" /> {playingAudio ? "Stop audio preview" : "Play audio preview"}
            </button>
          </section>

          <section className={styles.proSection}>
            <h2><span>06</span> Advanced</h2>
            <div className={styles.proTwoFields}>
              <label className={styles.proField}>
                <span>Duration</span>
                <select value={draft.duration} onChange={(event) => updateDraft("duration", event.target.value as AdDuration)}>
                  <option value="6">6 seconds</option><option value="8">8 seconds</option><option value="10">10 seconds</option><option value="loop">Loop</option>
                </select>
              </label>
              <label className={styles.proRange}>
                <span>Overlay opacity <b>{draft.overlayOpacity}%</b></span>
                <input type="range" min="0" max="100" value={draft.overlayOpacity} onChange={(event) => updateDraft("overlayOpacity", Number(event.target.value))} />
              </label>
            </div>
            <label className={styles.proField}>
              <span>CTA text</span>
              <select value={draft.ctaText} onChange={(event) => updateDraft("ctaText", event.target.value)}>
                <option value="Shop Now">Shop Now</option><option value="Explore">Explore</option><option value="Discover">Discover</option>
                {!["Shop Now", "Explore", "Discover"].includes(draft.ctaText) && <option value={draft.ctaText}>{draft.ctaText}</option>}
              </select>
            </label>
            <label className={styles.proField}>
              <span>CTA link</span>
              <input value={draft.ctaLink} onChange={(event) => updateDraft("ctaLink", event.target.value)} placeholder="/shop or https://..." maxLength={2048} required />
            </label>
          </section>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}
          <div className={styles.proBottomActions}>
            <button type="button" className={styles.secondaryButton} onClick={newCampaign}><Plus size={15} /> New Campaign</button>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}
              {saving ? "Saving…" : "Save Ad"}
            </button>
          </div>
        </div>

        <aside className={styles.proPreview}>
          <div className={styles.proPreviewHeader}>
            <div><p className={styles.eyebrow}>STUDIO MONITOR</p><h2>Live Preview</h2></div>
            <div className={styles.proPreviewModes}>
              <button type="button" className={previewMode === "desktop" ? styles.proModeSelected : ""} onClick={() => setPreviewMode("desktop")}>Desktop</button>
              <button type="button" className={previewMode === "mobile" ? styles.proModeSelected : ""} onClick={() => setPreviewMode("mobile")}>Mobile</button>
            </div>
          </div>
          <div className={`${styles.proPreviewFrame} ${previewMode === "mobile" ? styles.proPreviewMobile : ""}`} ref={previewRef}>
            <KineticAd ref={playerRef} adData={previewAd} />
          </div>
          <div className={styles.proPreviewFooter}>
            <span>{draft.campaignName || "Untitled campaign"}</span>
            <button type="button" onClick={() => void previewFullscreen()} aria-label="Open preview fullscreen"><Maximize2 size={15} /> Fullscreen</button>
          </div>
        </aside>
      </form>

      <section className={styles.proCampaigns}>
        <div className={styles.proSectionHeader}>
          <div><p className={styles.eyebrow}>LIBRARY</p><h2>Saved campaigns</h2></div>
          <span>{ads.length} total</span>
        </div>
        {loading ? (
          <p className={styles.proHelp}><LoaderCircle size={16} className={styles.spinner} /> Loading campaigns…</p>
        ) : ads.length ? (
          <div className={styles.proCampaignGrid}>
            {ads.map((ad) => (
              <article className={styles.proCampaignCard} key={ad.id}>
                <div className={styles.proCampaignThumb}>
                  {ad.productDetails?.[0]?.image ? <img src={ad.productDetails[0].image} alt="" /> : <Megaphone size={24} />}
                  <span>{ad.isActive ? "LIVE" : "DRAFT"}</span>
                </div>
                <div className={styles.proCampaignInfo}>
                  <div><h3>{ad.campaignName}</h3><p>{ad.titleLines.join(", ")}</p></div>
                  <div className={styles.proCampaignActions}>
                    <button type="button" onClick={() => editCampaign(ad)} aria-label={`Edit ${ad.campaignName}`}><Pencil size={15} /></button>
                    <button type="button" onClick={() => void deleteCampaign(ad)} aria-label={`Delete ${ad.campaignName}`}><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <p className={styles.proHelp}>No saved campaigns yet. Build your first ad above.</p>}
      </section>
    </main>
  );
}
