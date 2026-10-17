"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Image as ImageIcon,
  LoaderCircle,
  Megaphone,
  Music2,
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
  AD_FILTER_PRESETS,
  AD_IMAGE_POSITIONS,
  AD_TEXT_EFFECTS,
  DEFAULT_AD,
  type AdAnimationSpeed,
  type AdAnimationStyle,
  type AdAudioType,
  type AdCustomImage,
  type AdData,
  type AdFilterPreset,
  type AdImagePosition,
  type AdProductPreview,
  type AdTextEffect
} from "../../../lib/ad-types";
import styles from "./ads.module.css";

type CatalogProduct = AdProductPreview;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  const strings = (field: unknown, fallback: string[]) =>
    Array.isArray(field) ? field.filter((entry): entry is string => typeof entry === "string") : fallback;
  const productDetails = Array.isArray(value.productDetails)
    ? value.productDetails.flatMap((entry): AdProductPreview[] => {
      if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.title !== "string") return [];
      return [{
        id: entry.id,
        title: entry.title,
        image: typeof entry.image === "string" ? entry.image : "",
        price: typeof entry.price === "number" ? entry.price : 0
      }];
    })
    : [];
  const customImages = Array.isArray(value.customImages)
    ? value.customImages.flatMap((entry): AdCustomImage[] => {
      if (!isRecord(entry) || typeof entry.url !== "string") return [];
      return [{
        url: entry.url,
        position: parseChoice(entry.position, AD_IMAGE_POSITIONS, "foreground"),
        x: typeof entry.x === "number" ? entry.x : 50,
        y: typeof entry.y === "number" ? entry.y : 50,
        scale: typeof entry.scale === "number" ? entry.scale : 1
      }];
    })
    : [];
  const audioType = typeof value.audioType === "string" && AD_AUDIO_TYPES.some((type) => type === value.audioType)
    ? value.audioType as AdAudioType
    : "punchy-beat";
  return {
    ...DEFAULT_AD,
    id: typeof value.id === "string" ? value.id : undefined,
    titleLines: strings(value.titleLines, DEFAULT_AD.titleLines),
    secondLines: strings(value.secondLines, DEFAULT_AD.secondLines),
    finalLines: strings(value.finalLines, DEFAULT_AD.finalLines),
    products: strings(value.products, []),
    productDetails,
    ctaText: typeof value.ctaText === "string" ? value.ctaText : DEFAULT_AD.ctaText,
    ctaLink: typeof value.ctaLink === "string" ? value.ctaLink : DEFAULT_AD.ctaLink,
    logoText: typeof value.logoText === "string" ? value.logoText : DEFAULT_AD.logoText,
    bgColor: typeof value.bgColor === "string" ? value.bgColor : DEFAULT_AD.bgColor,
    textColor: typeof value.textColor === "string" ? value.textColor : DEFAULT_AD.textColor,
    goldColor: typeof value.goldColor === "string" ? value.goldColor : DEFAULT_AD.goldColor,
    audioUrl: typeof value.audioUrl === "string" ? value.audioUrl : "",
    audioType,
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
    isActive: value.isActive === true,
    placement: "homepage",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined
  };
}

function errorMessage(payload: unknown, fallback: string): string {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function linesToText(lines: string[]): string {
  return lines.join(", ");
}

function textToLines(text: string): string[] {
  return text.split(",").map((line) => line.trim()).filter(Boolean);
}

function parseChoice<T extends readonly string[]>(value: unknown, choices: T, fallback: T[number]): T[number] {
  return typeof value === "string" && choices.some((choice) => choice === value)
    ? value as T[number]
    : fallback;
}

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read audio file."));
    reader.onerror = () => reject(new Error("Could not read audio file."));
    reader.readAsDataURL(file);
  });
}

export default function AdminAdsPage() {
  const [ads, setAds] = useState<AdData[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [draft, setDraft] = useState<AdData>(DEFAULT_AD);
  const [openingWords, setOpeningWords] = useState(linesToText(DEFAULT_AD.titleLines));
  const [momentumWords, setMomentumWords] = useState(linesToText(DEFAULT_AD.secondLines));
  const [finalWords, setFinalWords] = useState(linesToText(DEFAULT_AD.finalLines));
  const [editingId, setEditingId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [playingAudio, setPlayingAudio] = useState(false);
  const playerRef = useRef<KineticAdHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
      if (!adsResponse.ok) throw new Error(errorMessage(adsPayload, "Could not load ads."));
      if (!productsResponse.ok) throw new Error(errorMessage(productsPayload, "Could not load products."));
      const adRecords = isRecord(adsPayload) && Array.isArray(adsPayload.ads)
        ? adsPayload.ads.map(parseAd).filter((ad): ad is AdData => ad !== null)
        : [];
      setAds(adRecords);
      setProducts(parseProducts(productsPayload));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Ads Manager data.");
    } finally {
      setLoading(false);
    }
  }, [adminHeaders]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredAds = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return ads.filter((ad) =>
      !needle || [...ad.titleLines, ...ad.secondLines, ...ad.finalLines].join(" ").toLocaleLowerCase().includes(needle)
    );
  }, [ads, search]);

  const visibleProducts = useMemo(() => {
    const needle = productSearch.trim().toLocaleLowerCase();
    return products.filter((product) => !needle || product.title.toLocaleLowerCase().includes(needle));
  }, [productSearch, products]);

  const previewAd = useMemo(() => ({
    ...draft,
    id: editingId,
    productDetails: products.filter((product) => draft.products.includes(product.id))
  }), [draft, editingId, products]);

  function openNewAd() {
    setDraft({ ...DEFAULT_AD, products: [], productDetails: [] });
    setOpeningWords(linesToText(DEFAULT_AD.titleLines));
    setMomentumWords(linesToText(DEFAULT_AD.secondLines));
    setFinalWords(linesToText(DEFAULT_AD.finalLines));
    setEditingId(undefined);
    setProductSearch("");
    setPlayingAudio(false);
    setNotice("");
    setError("");
    setModalOpen(true);
  }

  function openEditAd(ad: AdData) {
    setDraft({ ...ad, productDetails: products.filter((product) => ad.products.includes(product.id)) });
    setOpeningWords(linesToText(ad.titleLines));
    setMomentumWords(linesToText(ad.secondLines));
    setFinalWords(linesToText(ad.finalLines));
    setEditingId(ad.id);
    setProductSearch("");
    setPlayingAudio(false);
    setNotice("");
    setError("");
    setModalOpen(true);
  }

  function updateDraft<K extends keyof AdData>(key: K, value: AdData[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleProduct(productId: string) {
    setDraft((current) => ({
      ...current,
      products: current.products.includes(productId)
        ? current.products.filter((id) => id !== productId)
        : [...current.products, productId]
    }));
  }

  async function uploadAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!/^audio\/(?:mpeg|mp3|wav|ogg|mp4|aac)$/i.test(file.type) || file.size > 4 * 1024 * 1024) {
      setError("Upload an audio file no larger than 4 MB.");
      return;
    }
    try {
      updateDraft("audioUrl", await fileAsDataUrl(file));
      updateDraft("audioType", "custom");
      setError("");
      setNotice(`Loaded ${file.name}. Save the ad to store its audio.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not read audio file.");
    }
  }

  async function uploadCustomImages(files: FileList | File[]) {
    const selected = Array.from(files);
    if (!selected.length) return;
    if (draft.customImages.length + selected.length > 4) {
      setError("An ad can contain up to 4 custom images.");
      return;
    }
    const invalidFile = selected.find((file) =>
      !/^image\/(?:jpeg|png|webp|gif)$/i.test(file.type) || file.size > 350_000
    );
    if (invalidFile) {
      setError("Choose JPG, PNG, WebP, or GIF images no larger than 350 KB each.");
      return;
    }
    try {
      const images = await Promise.all(selected.map(async (file) => ({
        url: await fileAsDataUrl(file),
        position: "foreground" as AdImagePosition,
        x: 50,
        y: 50,
        scale: 1
      })));
      updateDraft("customImages", [...draft.customImages, ...images]);
      setError("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not read the selected images.");
    }
  }

  function updateCustomImage(index: number, patch: Partial<AdCustomImage>) {
    updateDraft("customImages", draft.customImages.map((image, imageIndex) =>
      imageIndex === index ? { ...image, ...patch } : image
    ));
  }

  async function saveAd(event: FormEvent<HTMLFormElement>) {
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
          titleLines: textToLines(openingWords),
          secondLines: textToLines(momentumWords),
          finalLines: textToLines(finalWords),
          id: editingId
        })
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Could not save this ad."));
      setModalOpen(false);
      setNotice(editingId ? "Ad updated." : "Ad created.");
      setPlayingAudio(false);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this ad.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(ad: AdData) {
    if (!ad.id) return;
    setError("");
    try {
      const response = await fetch("/api/admin/ads", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ ...ad, id: ad.id, isActive: !ad.isActive })
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Could not update ad status."));
      await loadData();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update ad status.");
    }
  }

  async function deleteAd(ad: AdData) {
    if (!ad.id || !window.confirm(`Delete this ad: ${ad.titleLines.join(" ")}?`)) return;
    setError("");
    try {
      const response = await fetch("/api/admin/ads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ id: ad.id })
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Could not delete ad."));
      setNotice("Ad deleted.");
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete ad.");
    }
  }

  function exportAd(ad: AdData) {
    const blob = new Blob([JSON.stringify(ad, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ad.logoText.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-ad.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={`${styles.page} admin-content`}>
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.titleIcon}><Megaphone size={20} /></span>
          <div>
            <p className={styles.eyebrow}>CAMPAIGN STUDIO</p>
            <h1>Ads Manager</h1>
            <p className={styles.subtitle}>Create sound-synced product stories for the Zavi Mart homepage.</p>
          </div>
        </div>
        <button type="button" className={styles.primaryButton} onClick={openNewAd}>
          <Plus size={17} /> New Ad
        </button>
      </header>

      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.listSection} aria-label="Ads">
        <div className={styles.listHeader}>
          <div>
            <h2>Your campaigns</h2>
            <span>{ads.length} {ads.length === 1 ? "ad" : "ads"} · Homepage placement</span>
          </div>
          <label className={styles.searchBox}>
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ads" aria-label="Search ads" />
          </label>
        </div>

        {loading ? (
          <div className={styles.loading}><LoaderCircle size={22} className={styles.spinner} />Loading campaigns…</div>
        ) : filteredAds.length === 0 ? (
          <div className={styles.emptyState}>
            <span><Megaphone size={27} /></span>
            <h3>{ads.length ? "No matching campaigns" : "Your next campaign starts here"}</h3>
            <p>{ads.length ? "Try a different search." : "Build a ten-second sound-synced ad and preview it before publishing."}</p>
            {!ads.length && <button className={styles.primaryButton} type="button" onClick={openNewAd}><Plus size={16} /> Create your first ad</button>}
          </div>
        ) : (
          <div className={styles.adGrid}>
            {filteredAds.map((ad) => (
              <article className={styles.adCard} key={ad.id}>
                <div className={styles.thumbnail}>
                  {ad.productDetails?.[0]?.image
                    ? <img src={ad.productDetails[0].image} alt="" />
                    : <ImageIcon size={27} aria-hidden="true" />}
                  <div className={styles.thumbnailText}>
                    <strong>{ad.titleLines.slice(0, 2).join(" ")}</strong>
                    <span>{ad.secondLines.slice(0, 2).join(" ")}</span>
                  </div>
                  <span className={styles.duration}>10s · SOUND</span>
                </div>
                <div className={styles.adMeta}>
                  <div>
                    <h3>{ad.titleLines.join(" ")}</h3>
                    <p>{ad.products.length} products · {ad.audioType.replace("-", " ")}</p>
                  </div>
                  <button
                    type="button"
                    className={`${styles.statusToggle} ${ad.isActive ? styles.statusOn : ""}`}
                    onClick={() => void toggleActive(ad)}
                    aria-pressed={ad.isActive}
                    aria-label={`${ad.isActive ? "Deactivate" : "Activate"} ${ad.titleLines.join(" ")}`}
                  >
                    <span />
                    {ad.isActive ? "Live" : "Off"}
                  </button>
                </div>
                <div className={styles.cardActions}>
                  <button type="button" onClick={() => openEditAd(ad)}><Pencil size={15} /> Edit</button>
                  <button type="button" onClick={() => exportAd(ad)}><Download size={15} /> Export JSON</button>
                  <button type="button" className={styles.deleteAction} onClick={() => void deleteAd(ad)} aria-label="Delete ad"><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            playerRef.current?.stop();
            setModalOpen(false);
          }
        }}>
          <section className={styles.editor} role="dialog" aria-modal="true" aria-labelledby="ads-editor-title">
            <header className={styles.editorHeader}>
              <div>
                <p className={styles.eyebrow}>KINETIC CAMPAIGN</p>
                <h2 id="ads-editor-title">{editingId ? "Edit ad" : "Create a new ad"}</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => {
                playerRef.current?.stop();
                setModalOpen(false);
              }} aria-label="Close editor"><X size={20} /></button>
            </header>
            <form onSubmit={(event) => void saveAd(event)} className={styles.editorForm}>
              <div className={styles.editorContent}>
                <div className={styles.formColumn}>
                  <section className={styles.formSection}>
                    <h3><span>01</span> Story beats</h3>
                    <label className={styles.field}>
                      <span>Opening words <small>comma-separated</small></span>
                      <input type="text" value={openingWords} onChange={(event) => setOpeningWords(event.target.value)} placeholder="e.g. WHAT, EVER, YOU, BUY" required />
                    </label>
                    <label className={styles.field}>
                      <span>Momentum words <small>comma-separated</small></span>
                      <input type="text" value={momentumWords} onChange={(event) => setMomentumWords(event.target.value)} placeholder="e.g. SELL, MORE, MORE" required />
                    </label>
                    <label className={styles.field}>
                      <span>Final words <small>comma-separated</small></span>
                      <input type="text" value={finalWords} onChange={(event) => setFinalWords(event.target.value)} placeholder="e.g. THE, WORLD'S, BEST, CHECKOUT" required />
                    </label>
                  </section>

                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <h3><span>02</span> Featured products</h3>
                      <small>{draft.products.length} selected</small>
                    </div>
                    {draft.products.length > 0 && (
                      <div className={styles.selectedProducts}>
                        {products.filter((product) => draft.products.includes(product.id)).map((product) => (
                          <button type="button" key={product.id} onClick={() => toggleProduct(product.id)} title={`Remove ${product.title}`}>
                            {product.image && <img src={product.image} alt="" />}
                            <span>{product.title}</span><X size={13} />
                          </button>
                        ))}
                      </div>
                    )}
                    <label className={styles.searchBox}>
                      <Search size={15} aria-hidden="true" />
                      <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Find products by name" aria-label="Search products" />
                    </label>
                    <div className={styles.productPicker}>
                      {visibleProducts.length ? visibleProducts.map((product) => {
                        const selected = draft.products.includes(product.id);
                        return (
                          <button
                            type="button"
                            key={product.id}
                            className={selected ? styles.productSelected : ""}
                            onClick={() => toggleProduct(product.id)}
                            aria-pressed={selected}
                          >
                            <span className={styles.productCheck}>{selected ? "✓" : ""}</span>
                            <span className={styles.productImage}>
                              {product.image ? <img src={product.image} alt="" /> : <ImageIcon size={17} />}
                            </span>
                            <span className={styles.productName}>{product.title}<small>Rs. {product.price.toLocaleString()}</small></span>
                          </button>
                        );
                      }) : <p className={styles.mutedText}>{products.length ? "No matching products." : "No products available to select."}</p>}
                    </div>
                  </section>

                  <section className={styles.formSection}>
                    <h3><span>03</span> Sound design</h3>
                    <label className={styles.field}>
                      <span>Audio track</span>
                      <select
                        value={draft.audioType}
                        onChange={(event) => {
                          const type = event.target.value as AdAudioType;
                          updateDraft("audioType", type);
                          if (type !== "custom") updateDraft("audioUrl", "");
                        }}
                      >
                        <option value="punchy-beat">Punchy Shopify Beat</option>
                        <option value="luxury-tick">Luxury Tick</option>
                        <option value="deep-bass">Deep Bass Drop</option>
                        <option value="custom">Upload Custom MP3</option>
                      </select>
                    </label>
                    {draft.audioType === "custom" && (
                      <div className={styles.uploadRow}>
                        <input ref={fileInputRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,audio/aac" onChange={(event) => void uploadAudio(event)} hidden />
                        <button type="button" className={styles.secondaryButton} onClick={() => fileInputRef.current?.click()}>
                          <Music2 size={15} /> {draft.audioUrl.startsWith("data:audio/") ? "Replace uploaded audio" : "Upload audio (max 4 MB)"}
                        </button>
                        {draft.audioUrl.startsWith("data:audio/") && <span className={styles.uploadedLabel}>Custom track ready</span>}
                      </div>
                    )}
                    <div className={styles.audioControls}>
                      <label className={styles.volumeControl}>
                        <span><Volume2 size={15} /> Volume <b>{draft.volume}%</b></span>
                        <input type="range" min="0" max="100" value={draft.volume} onChange={(event) => updateDraft("volume", Number(event.target.value))} />
                      </label>
                      <label className={styles.syncToggle}>
                        <input type="checkbox" checked={draft.beatSync} onChange={(event) => updateDraft("beatSync", event.target.checked)} />
                        <span className={styles.switch} />
                        <span>Sync motion to beat</span>
                      </label>
                    </div>
                    <div className={styles.waveform} aria-label="Audio rhythm preview">
                      {Array.from({ length: 36 }, (_, index) => (
                        <i key={index} style={{ height: `${12 + ((index * 19 + index % 5 * 13) % 38)}px` }} />
                      ))}
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => {
                        if (playingAudio) {
                          playerRef.current?.stop();
                          setPlayingAudio(false);
                        } else {
                          playerRef.current?.playWithSound();
                          setPlayingAudio(true);
                        }
                      }}
                    >
                      <Play size={15} fill="currentColor" /> {playingAudio ? "Stop audio preview" : "Play audio preview"}
                    </button>
                  </section>

                  <section className={styles.formSection}>
                    <h3><span>04</span> Visual Studio</h3>
                    <div
                      className={styles.imageDropzone}
                      role="button"
                      tabIndex={0}
                      onClick={() => imageInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") imageInputRef.current?.click();
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        void uploadCustomImages(event.dataTransfer.files);
                      }}
                    >
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        hidden
                        onChange={(event) => {
                          void uploadCustomImages(event.currentTarget.files ?? []);
                          event.currentTarget.value = "";
                        }}
                      />
                      <Upload size={18} />
                      <span>Upload Custom Picture</span>
                      <small>Drop up to 4 JPG, PNG, WebP, or GIF files · 350 KB each</small>
                    </div>
                    {draft.customImages.map((image, index) => (
                      <div className={styles.customImageEditor} key={`${image.url.slice(0, 64)}-${index}`}>
                        <img src={image.url} alt={`Custom ad layer ${index + 1}`} />
                        <div className={styles.customImageControls}>
                          <label className={styles.field}>
                            <span>Layer position</span>
                            <select
                              value={image.position}
                              onChange={(event) => updateCustomImage(index, { position: event.target.value as AdImagePosition })}
                            >
                              <option value="background">Background</option>
                              <option value="foreground">Foreground</option>
                              <option value="floating">Floating</option>
                            </select>
                          </label>
                          <label className={styles.rangeControl}>
                            <span>X position <b>{image.x}%</b></span>
                            <input type="range" min="0" max="100" value={image.x} onChange={(event) => updateCustomImage(index, { x: Number(event.target.value) })} />
                          </label>
                          <label className={styles.rangeControl}>
                            <span>Y position <b>{image.y}%</b></span>
                            <input type="range" min="0" max="100" value={image.y} onChange={(event) => updateCustomImage(index, { y: Number(event.target.value) })} />
                          </label>
                          <label className={styles.rangeControl}>
                            <span>Scale <b>{Math.round(image.scale * 100)}%</b></span>
                            <input type="range" min="25" max="200" value={Math.round(image.scale * 100)} onChange={(event) => updateCustomImage(index, { scale: Number(event.target.value) / 100 })} />
                          </label>
                        </div>
                        <button
                          type="button"
                          className={styles.removeImage}
                          onClick={() => updateDraft("customImages", draft.customImages.filter((_, imageIndex) => imageIndex !== index))}
                          aria-label={`Remove custom image ${index + 1}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    <label className={styles.field}>
                      <span>Custom background <small>HTTPS image, hex color, or CSS gradient</small></span>
                      <input
                        value={draft.customBg}
                        onChange={(event) => updateDraft("customBg", event.target.value)}
                        placeholder="https://... or linear-gradient(...)"
                        maxLength={2048}
                      />
                    </label>
                    <div className={styles.twoFields}>
                      <label className={styles.field}>
                        <span>Animation style</span>
                        <select value={draft.animationStyle} onChange={(event) => updateDraft("animationStyle", event.target.value as AdAnimationStyle)}>
                          <option value="kinetic-shopify">Kinetic Shopify</option>
                          <option value="fade-up">Fade Up</option>
                          <option value="zoom-in">Zoom In</option>
                          <option value="slide-left">Slide Left</option>
                          <option value="typewriter">Typewriter</option>
                          <option value="bounce">Bounce</option>
                          <option value="rotate-3d">Rotate 3D</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Animation speed</span>
                        <select value={draft.animationSpeed} onChange={(event) => updateDraft("animationSpeed", event.target.value as AdAnimationSpeed)}>
                          <option value="slow">Slow</option>
                          <option value="normal">Normal</option>
                          <option value="fast">Fast</option>
                          <option value="beat-sync">Beat Sync</option>
                        </select>
                      </label>
                    </div>
                    <label className={styles.field}>
                      <span>Text effect</span>
                      <select value={draft.textEffect} onChange={(event) => updateDraft("textEffect", event.target.value as AdTextEffect)}>
                        <option value="none">None</option>
                        <option value="glow-gold">Glow Gold</option>
                        <option value="stroke">Stroke</option>
                        <option value="shadow-3d">Shadow 3D</option>
                        <option value="gradient-gold">Gradient Gold</option>
                      </select>
                    </label>
                    <div className={styles.filterGrid} aria-label="Visual filter presets">
                      {AD_FILTER_PRESETS.map((preset) => (
                        <button
                          type="button"
                          key={preset}
                          className={`${styles.filterCard} ${draft.filterPreset === preset ? styles.filterSelected : ""}`}
                          onClick={() => updateDraft("filterPreset", preset as AdFilterPreset)}
                          aria-pressed={draft.filterPreset === preset}
                        >
                          <span className={`${styles.filterSample} ${styles[`filterSample-${preset}`]}`} />
                          <span>{preset.replaceAll("-", " ")}</span>
                        </button>
                      ))}
                    </div>
                    <div className={styles.visualRanges}>
                      <label className={styles.rangeControl}>
                        <span>Brightness <b>{draft.brightness}%</b></span>
                        <input type="range" min="0" max="200" value={draft.brightness} onChange={(event) => updateDraft("brightness", Number(event.target.value))} />
                      </label>
                      <label className={styles.rangeControl}>
                        <span>Contrast <b>{draft.contrast}%</b></span>
                        <input type="range" min="0" max="200" value={draft.contrast} onChange={(event) => updateDraft("contrast", Number(event.target.value))} />
                      </label>
                      <label className={styles.rangeControl}>
                        <span>Blur <b>{draft.blurAmount}px</b></span>
                        <input type="range" min="0" max="20" value={draft.blurAmount} onChange={(event) => updateDraft("blurAmount", Number(event.target.value))} />
                      </label>
                      <label className={styles.rangeControl}>
                        <span>Gold tint opacity <b>{draft.goldTintOpacity}%</b></span>
                        <input type="range" min="0" max="100" value={draft.goldTintOpacity} onChange={(event) => updateDraft("goldTintOpacity", Number(event.target.value))} />
                      </label>
                      <label className={styles.rangeControl}>
                        <span>Dark overlay <b>{draft.overlayOpacity}%</b></span>
                        <input type="range" min="0" max="100" value={draft.overlayOpacity} onChange={(event) => updateDraft("overlayOpacity", Number(event.target.value))} />
                      </label>
                    </div>
                  </section>

                  <section className={styles.formSection}>
                    <h3><span>05</span> Brand and call to action</h3>
                    <div className={styles.twoFields}>
                      <label className={styles.field}><span>CTA text</span><input value={draft.ctaText} onChange={(event) => updateDraft("ctaText", event.target.value)} required maxLength={60} /></label>
                      <label className={styles.field}><span>CTA link</span><input value={draft.ctaLink} onChange={(event) => updateDraft("ctaLink", event.target.value)} required maxLength={2048} /></label>
                    </div>
                    <label className={styles.field}><span>Logo text</span><input value={draft.logoText} onChange={(event) => updateDraft("logoText", event.target.value)} required maxLength={60} /></label>
                    <div className={styles.colorFields}>
                      <label><span>Background</span><input type="color" value={draft.bgColor} onChange={(event) => updateDraft("bgColor", event.target.value)} /></label>
                      <label><span>Text</span><input type="color" value={draft.textColor} onChange={(event) => updateDraft("textColor", event.target.value)} /></label>
                      <label><span>Gold accent</span><input type="color" value={draft.goldColor} onChange={(event) => updateDraft("goldColor", event.target.value)} /></label>
                    </div>
                    <label className={styles.syncToggle}>
                      <input type="checkbox" checked={draft.isActive} onChange={(event) => updateDraft("isActive", event.target.checked)} />
                      <span className={styles.switch} />
                      <span>Publish as active homepage ad</span>
                    </label>
                  </section>
                </div>

                <aside className={styles.previewColumn}>
                  <div className={styles.previewHeading}>
                    <div><h3>Live preview</h3><p>10-second story · sound starts muted</p></div>
                    <span>PREVIEW</span>
                  </div>
                  <div className={styles.playerFrame}>
                    <KineticAd ref={playerRef} adData={previewAd} />
                  </div>
                  <p className={styles.previewHint}>Tap the sound button in the preview or use Play audio preview to hear the track.</p>
                  {error && <p className={styles.error} role="alert">{error}</p>}
                  {notice && <p className={styles.notice} role="status">{notice}</p>}
                </aside>
              </div>
              <footer className={styles.editorFooter}>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <button type="button" className={styles.secondaryButton} onClick={() => {
                  playerRef.current?.stop();
                  setModalOpen(false);
                }}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  {saving ? <LoaderCircle size={16} className={styles.spinner} /> : null}
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create ad"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
