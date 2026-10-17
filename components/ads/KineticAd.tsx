"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Howl } from "howler";
import { ShoppingBag, Volume2, VolumeX } from "lucide-react";
import { DEFAULT_AD, normalizeAdLines, type AdData, type AdProductPreview, type KineticAdInput } from "../../lib/ad-types";
import styles from "./KineticAd.module.css";

const PRESET_AUDIO: Record<Exclude<AdData["audioType"], "custom">, string> = {
  "punchy-beat": "/sounds/punchy-beat.wav",
  "luxury-tick": "/sounds/luxury-tick.wav",
  "deep-bass": "/sounds/deep-bass.wav"
};

export type KineticAdHandle = {
  playWithSound: () => void;
  stop: () => void;
  toggleSound: () => void;
};

type KineticAdProps = {
  adData: AdData | KineticAdInput;
  autoPlay?: boolean;
  showControls?: boolean;
  compact?: boolean;
};

const KineticAd = forwardRef<KineticAdHandle, KineticAdProps>(function KineticAd({
  adData,
  autoPlay = true,
  showControls = true,
  compact = false
}, ref) {
  const playerRef = useRef<Howl | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clockRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(true);
  const [htmlAudioFallback, setHtmlAudioFallback] = useState(false);
  const normalizedAd = {
    ...DEFAULT_AD,
    ...adData,
    titleLines: normalizeAdLines(adData.titleLines, DEFAULT_AD.titleLines),
    secondLines: normalizeAdLines(adData.secondLines, DEFAULT_AD.secondLines),
    finalLines: normalizeAdLines(adData.finalLines, DEFAULT_AD.finalLines)
  };
  const productIds = (adData.products ?? []).flatMap((product) =>
    typeof product === "string" ? [product] : product.id ? [product.id] : []
  );
  const suppliedProductDetails = [
    ...(adData.productDetails ?? []),
    ...(adData.products ?? []).flatMap((product) =>
      typeof product === "string" ? [] : [product]
    )
  ];
  const [fetchedProductDetails, setFetchedProductDetails] = useState<AdProductPreview[]>([]);
  const productDetails = [...suppliedProductDetails, ...fetchedProductDetails].filter((product, index, all) =>
    all.findIndex((entry) => entry.id === product.id) === index
  );
  const audioType = normalizedAd.audioType === "custom" ? "punchy-beat" : normalizedAd.audioType;
  const audioUrl = normalizedAd.audioUrl || PRESET_AUDIO[audioType];

  useImperativeHandle(ref, () => ({
    playWithSound() {
      setMuted(false);
      if (htmlAudioFallback && audioRef.current) {
        audioRef.current.muted = false;
        void audioRef.current.play();
        return;
      }
      const player = playerRef.current;
      if (player) {
        player.mute(false);
        if (!player.playing()) player.play();
      }
    },
    stop() {
      playerRef.current?.stop();
      audioRef.current?.pause();
    },
    toggleSound() {
      setMuted((current) => !current);
    }
  }), [htmlAudioFallback]);

  useEffect(() => {
    let cancelled = false;
    const missingIds = productIds.filter((id) =>
      !suppliedProductDetails.some((product) => product.id === id)
    );
    setFetchedProductDetails([]);
    if (missingIds.length) {
      void Promise.all(missingIds.map(async (id): Promise<AdProductPreview | null> => {
        try {
          const response = await fetch(`/api/products?id=${encodeURIComponent(id)}`, { cache: "no-store" });
          if (!response.ok) return null;
          const result: unknown = await response.json();
          if (typeof result !== "object" || result === null || !("product" in result) ||
              typeof result.product !== "object" || result.product === null) return null;
          const product = result.product as Record<string, unknown>;
          const images = Array.isArray(product.images) ? product.images : [];
          const image = typeof product.image === "string" ? product.image :
            typeof images[0] === "string" ? images[0] : "";
          if (typeof product.title !== "string" || !image) return null;
          return {
            id,
            title: product.title,
            image,
            price: typeof product.price === "number" ? product.price : 0
          };
        } catch (error) {
          console.error("Could not load a featured product for the homepage ad.", error);
          return null;
        }
      })).then((results) => {
        if (!cancelled) setFetchedProductDetails(results.filter((product): product is AdProductPreview => product !== null));
      });
    }
    return () => { cancelled = true; };
  }, [JSON.stringify(productIds), JSON.stringify(suppliedProductDetails)]);

  useEffect(() => {
    setElapsed(0);
    clockRef.current = 0;
    setHtmlAudioFallback(false);
    const player = new Howl({
      src: [audioUrl],
      html5: true,
      loop: true,
      volume: Math.min(100, Math.max(0, normalizedAd.volume)) / 100,
      mute: true,
      onload: () => {
        if (autoPlay) player.play();
      },
      onloaderror: () => {
        setHtmlAudioFallback(true);
        const fallbackAudio = audioRef.current;
        if (fallbackAudio && autoPlay) void fallbackAudio.play().catch(() => undefined);
      },
      onplayerror: () => {
        player.once("unlock", () => {
          if (autoPlay) player.play();
        });
      }
    });
    playerRef.current = player;

    return () => {
      player.stop();
      player.unload();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [normalizedAd.audioType, normalizedAd.audioUrl, normalizedAd.volume, audioUrl, autoPlay]);

  useEffect(() => {
    const player = playerRef.current;
    if (player) {
      player.mute(muted);
      player.volume(Math.min(100, Math.max(0, normalizedAd.volume)) / 100);
    }
    if (audioRef.current) {
      audioRef.current.muted = muted;
      audioRef.current.volume = Math.min(100, Math.max(0, normalizedAd.volume)) / 100;
    }
  }, [normalizedAd.volume, muted]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const player = playerRef.current;
      const audio = audioRef.current;
      const rawTime = htmlAudioFallback
        ? audio?.currentTime ?? 0
        : Number(player?.seek() ?? 0);
      const duration = htmlAudioFallback
        ? audio?.duration || 10
        : Number(player?.duration() ?? 10) || 10;
      const normalized = (rawTime % duration) * (10 / duration);
      clockRef.current = normalized;
      setElapsed(normalized);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [htmlAudioFallback]);

  const firstBeat = normalizedAd.beatSync ? 0.5 : 0.68;
  const firstCount = Math.min(normalizedAd.titleLines.length, Math.floor(elapsed / firstBeat) + 1);
  const secondCount = Math.min(normalizedAd.secondLines.length, Math.floor((elapsed - 3) / (normalizedAd.beatSync ? 0.34 : 0.48)) + 1);
  const finalCount = Math.min(normalizedAd.finalLines.length, Math.floor((elapsed - 5) / (normalizedAd.beatSync ? 0.68 : 0.82)) + 1);
  const featuredProduct = productDetails[0];
  const cssVars = {
    "--ad-bg": normalizedAd.bgColor,
    "--ad-text": normalizedAd.textColor,
    "--ad-gold": normalizedAd.goldColor
  } as React.CSSProperties;

  return (
    <section
      className={`${styles.stage} ${compact ? styles.compact : ""}`}
      style={cssVars}
      aria-label="Animated Zavi Mart advertisement"
    >
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.beatFlash} style={{ opacity: normalizedAd.beatSync ? Math.max(0, 1 - (elapsed % 0.5) * 8) * 0.16 : 0 }} />
      <audio ref={audioRef} src={audioUrl} preload="auto" loop muted aria-hidden="true" />
      <AnimatePresence mode="wait">
        {elapsed < 3 && (
          <motion.div
            key="intro"
            className={styles.phase}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.22 }}
          >
            <div className={styles.words}>
              {normalizedAd.titleLines.slice(0, firstCount).map((line, index) => (
                <motion.span
                  key={`${line}-${index}`}
                  initial={{ opacity: 0, y: 36, scale: 0.78 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18 }}
                >
                  {line}
                </motion.span>
              ))}
            </div>
            {featuredProduct && (
              <motion.a
                className={styles.productCard}
                href={normalizedAd.ctaLink}
                initial={{ opacity: 0, y: 22, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.12 }}
              >
                {featuredProduct.image && <img src={featuredProduct.image} alt="" />}
                <span className={styles.productCta}>Buy with Zavi Mart</span>
              </motion.a>
            )}
          </motion.div>
        )}
        {elapsed >= 3 && elapsed < 5 && (
          <motion.div
            key="more"
            className={`${styles.phase} ${styles.morePhase}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <div className={styles.parallax} aria-hidden="true">
              {productDetails.slice(0, 4).map((product, index) => (
                <motion.img
                  key={product.id}
                  src={product.image}
                  alt=""
                  initial={{ x: index % 2 ? 120 : -120, y: index * 22, rotate: index % 2 ? 12 : -12 }}
                  animate={{ x: index % 2 ? -180 : 180, y: -index * 30, rotate: index % 2 ? -8 : 8 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                />
              ))}
            </div>
            <div className={styles.words}>
              {normalizedAd.secondLines.slice(0, secondCount).map((line, index) => (
                <motion.span
                  key={`${line}-${index}`}
                  className={index === secondCount - 1 ? styles.goldWord : ""}
                  initial={{ opacity: 0, y: 22, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 240, damping: 20 }}
                >
                  {line}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
        {elapsed >= 5 && elapsed < 8 && (
          <motion.div
            key="checkout"
            className={styles.phase}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.24 }}
          >
            <div className={styles.words}>
              {normalizedAd.finalLines.slice(0, finalCount).map((line, index) => (
                <motion.span
                  key={`${line}-${index}`}
                  className={index === normalizedAd.finalLines.length - 1 ? styles.goldWord : ""}
                  initial={{ opacity: 0, scale: 0.65 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 16 }}
                >
                  {line}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
        {elapsed >= 8 && (
          <motion.div
            key="brand"
            className={`${styles.phase} ${styles.brandPhase}`}
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
          >
            <ShoppingBag className={styles.bagIcon} strokeWidth={1.4} aria-hidden="true" />
            <strong>{normalizedAd.logoText}</strong>
            <a href={normalizedAd.ctaLink} className={styles.startButton}>{normalizedAd.ctaText}</a>
          </motion.div>
        )}
      </AnimatePresence>
      {!compact && <div className={styles.progress} style={{ transform: `scaleX(${elapsed / 10})` }} />}
      {showControls && (
        <button
          type="button"
          className={styles.soundButton}
          onClick={() => {
            if (muted) {
              setMuted(false);
              playerRef.current?.mute(false);
              if (!htmlAudioFallback && playerRef.current && !playerRef.current.playing()) playerRef.current.play();
              if (htmlAudioFallback && audioRef.current) {
                audioRef.current.muted = false;
                void audioRef.current.play();
              }
            } else {
              setMuted(true);
            }
          }}
          aria-label={muted ? "Turn advertisement sound on" : "Mute advertisement"}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      )}
    </section>
  );
});

export default KineticAd;
