"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion, type TargetAndTransition, type Transition } from "framer-motion";
import { Howl } from "howler";
import { ShoppingBag, Volume2, VolumeX } from "lucide-react";
import {
  DEFAULT_AD,
  normalizeAdLines,
  type AdAnimationSpeed,
  type AdAnimationStyle,
  type AdData,
  type AdProductPreview,
  type AdTextEffect,
  type KineticAdInput
} from "../../lib/ad-types";
import styles from "./KineticAd.module.css";

function getAnimationVariants(
  style: AdAnimationStyle,
  speed: AdAnimationSpeed,
  beatSync: boolean,
  index: number
): { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition } {
  const duration = (speed === "slow" ? 1.15 : speed === "fast" ? 0.38 : speed === "beat-sync" && beatSync ? 0.42 : 0.68);
  const base = { opacity: 0 };
  let initial: TargetAndTransition = base;
  let animate: TargetAndTransition = { opacity: 1 };
  let transition: Transition = { duration, delay: Math.min(index * 0.035, 0.18), ease: "easeOut" };

  switch (style) {
    case "fade-up":
      initial = { ...base, y: 42 };
      animate = { opacity: 1, y: 0 };
      break;
    case "zoom-in":
      initial = { ...base, scale: 0.5 };
      animate = { opacity: 1, scale: 1 };
      break;
    case "slide-left":
      initial = { ...base, x: 56 };
      animate = { opacity: 1, x: 0 };
      break;
    case "typewriter":
      initial = { ...base, clipPath: "inset(0 100% 0 0)" };
      animate = { opacity: 1, clipPath: "inset(0 0% 0 0)" };
      break;
    case "bounce":
      initial = { ...base, y: -38, scale: 0.75 };
      animate = { opacity: 1, y: 0, scale: 1 };
      transition = { type: "spring", stiffness: 240, damping: 13, delay: Math.min(index * 0.035, 0.18) };
      break;
    case "rotate-3d":
      initial = { ...base, rotateY: 85, scale: 0.88 };
      animate = { opacity: 1, rotateY: 0, scale: 1 };
      transition = { duration, delay: Math.min(index * 0.035, 0.18), ease: "easeOut" };
      break;
    case "kinetic-shopify":
      initial = { ...base, y: 34, scale: 0.78 };
      animate = { opacity: 1, y: 0, scale: 1 };
      break;
  }

  return { initial, animate, transition };
}

function textEffectClass(effect: AdTextEffect): string {
  switch (effect) {
    case "glow-gold": return styles.textGlow;
    case "stroke": return styles.textStroke;
    case "shadow-3d": return styles.textShadow3d;
    case "gradient-gold": return styles.textGradient;
    default: return "";
  }
}

function getCustomBackground(value: string): React.CSSProperties {
  if (!value) return {};
  if (/^https:\/\//i.test(value)) return { backgroundImage: `url("${value}")`, backgroundPosition: "center", backgroundSize: "cover" };
  return { background: value };
}

const PRESET_AUDIO: Record<Exclude<AdData["audioType"], "custom" | "none">, string> = {
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
  const audioType = normalizedAd.audioType === "custom" || normalizedAd.audioType === "none"
    ? "punchy-beat"
    : normalizedAd.audioType;
  const audioUrl = normalizedAd.audioType === "none" ? "" : normalizedAd.audioUrl || PRESET_AUDIO[audioType];
  const customImages = normalizedAd.customImages ?? [];
  const backdropFilter = [
    `brightness(${normalizedAd.brightness / 100})`,
    `contrast(${normalizedAd.contrast / 100})`,
    `blur(${normalizedAd.blurAmount}px)`,
    normalizedAd.filterPreset === "blur-bg" ? "blur(10px)" : "",
    normalizedAd.filterPreset === "luxury-dark" ? "brightness(0.8) contrast(1.2)" : "",
    normalizedAd.filterPreset === "grayscale-luxury" ? "grayscale(1)" : "",
    normalizedAd.filterPreset === "vintage" ? "sepia(0.5)" : ""
  ].filter(Boolean).join(" ");

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
    if (normalizedAd.audioType === "none") {
      const startedAt = performance.now();
      let frame = 0;
      const tick = (now: number) => {
        const normalized = ((now - startedAt) / 1000) % 10;
        clockRef.current = normalized;
        setElapsed(normalized);
        frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(frame);
    }
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
    "--ad-gold": normalizedAd.goldColor,
    "--ad-overlay-opacity": normalizedAd.overlayOpacity / 100,
    "--ad-gold-tint-opacity": normalizedAd.filterPreset === "gold-tint"
      ? normalizedAd.goldTintOpacity / 100
      : 0
  } as React.CSSProperties;

  function renderWord(line: string, index: number, key: string, className = "") {
    const motionProps = getAnimationVariants(
      normalizedAd.animationStyle,
      normalizedAd.animationSpeed,
      normalizedAd.beatSync,
      index
    );
    return (
      <motion.span key={key} className={className} {...motionProps}>
        {normalizedAd.animationStyle === "typewriter"
          ? Array.from(line).map((character, characterIndex) => (
            <motion.span
              key={`${character}-${characterIndex}`}
              className={styles.typewriterCharacter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: normalizedAd.animationSpeed === "fast" ? 0.12 : 0.2,
                delay: index * 0.04 + characterIndex * 0.035
              }}
            >
              {character}
            </motion.span>
          ))
          : line}
      </motion.span>
    );
  }

  return (
    <section
      className={`${styles.stage} ${compact ? styles.compact : ""}`}
      style={cssVars}
      aria-label="Animated Zavi Mart advertisement"
    >
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" loop muted aria-hidden="true" />}
      <div className={styles.backdropLayer} style={{ filter: backdropFilter }} aria-hidden="true">
        <div className={styles.customBackground} style={getCustomBackground(normalizedAd.customBg)} />
        {customImages.filter((image) => image.position === "background").map((image, index) => (
          <img
            key={`background-${index}`}
            className={styles.backgroundImage}
            src={image.url}
            alt=""
            style={{ objectPosition: `${image.x}% ${image.y}%`, transform: `scale(${image.scale})` }}
          />
        ))}
      </div>
      <div className={styles.glow} aria-hidden="true" />
      {normalizedAd.filterPreset === "gold-tint" && <div className={styles.goldTint} aria-hidden="true" />}
      {normalizedAd.filterPreset === "cinematic" && <div className={styles.vignette} aria-hidden="true" />}
      {normalizedAd.overlayOpacity > 0 && <div className={styles.dimOverlay} aria-hidden="true" />}
      <div
        className={styles.beatFlash}
        style={{ opacity: normalizedAd.beatSync ? Math.max(0, 1 - (elapsed % 0.5) * 8) * 0.16 : 0 }}
        aria-hidden="true"
      />
      {customImages.filter((image) => image.position !== "background").map((image, index) => (
        <img
          key={`overlay-${index}`}
          className={`${styles.customImage} ${image.position === "floating" ? styles.floatingImage : styles.foregroundImage}`}
          src={image.url}
          alt=""
          aria-hidden="true"
          style={{
            left: `${image.x}%`,
            top: `${image.y}%`,
            transform: `translate(-50%, -50%) scale(${image.scale})`
          }}
        />
      ))}
      <AnimatePresence mode="wait">
        {elapsed < 3 && (
          <motion.div
            key="intro"
            className={`${styles.phase} ${featuredProduct ? styles.introWithProduct : ""}`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.22 }}
          >
            <div className={`${styles.words} ${textEffectClass(normalizedAd.textEffect)} ${normalizedAd.filterPreset === "neon-glow" ? styles.textNeonGlow : ""}`}>
              {normalizedAd.titleLines.slice(0, firstCount).map((line, index) =>
                renderWord(line, index, `title-${line}-${index}`)
              )}
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
            <div className={`${styles.words} ${textEffectClass(normalizedAd.textEffect)} ${normalizedAd.filterPreset === "neon-glow" ? styles.textNeonGlow : ""}`}>
              {normalizedAd.secondLines.slice(0, secondCount).map((line, index) =>
                renderWord(line, index, `momentum-${line}-${index}`, index === secondCount - 1 ? styles.goldWord : "")
              )}
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
            <div className={`${styles.words} ${textEffectClass(normalizedAd.textEffect)} ${normalizedAd.filterPreset === "neon-glow" ? styles.textNeonGlow : ""}`}>
              {normalizedAd.finalLines.slice(0, finalCount).map((line, index) =>
                renderWord(line, index, `final-${line}-${index}`, index === normalizedAd.finalLines.length - 1 ? styles.goldWord : "")
              )}
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
      {showControls && normalizedAd.audioType !== "none" && (
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
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      )}
    </section>
  );
});

export default KineticAd;
