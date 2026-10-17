"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Howl } from "howler";
import { ShoppingBag, Volume2, VolumeX } from "lucide-react";
import type { AdData } from "../../lib/ad-types";
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
  adData: AdData;
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
  const audioUrl = adData.audioUrl || PRESET_AUDIO[adData.audioType === "custom" ? "punchy-beat" : adData.audioType];

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
    setElapsed(0);
    clockRef.current = 0;
    setHtmlAudioFallback(false);
    const player = new Howl({
      src: [audioUrl],
      html5: true,
      loop: true,
      volume: Math.min(100, Math.max(0, adData.volume)) / 100,
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
  }, [adData.audioType, adData.audioUrl, adData.volume, audioUrl, autoPlay]);

  useEffect(() => {
    const player = playerRef.current;
    if (player) {
      player.mute(muted);
      player.volume(Math.min(100, Math.max(0, adData.volume)) / 100);
    }
    if (audioRef.current) {
      audioRef.current.muted = muted;
      audioRef.current.volume = Math.min(100, Math.max(0, adData.volume)) / 100;
    }
  }, [adData.volume, muted]);

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

  const firstBeat = adData.beatSync ? 0.5 : 0.68;
  const firstCount = Math.min(adData.titleLines.length, Math.floor(elapsed / firstBeat) + 1);
  const secondCount = Math.min(adData.secondLines.length, Math.floor((elapsed - 3) / (adData.beatSync ? 0.34 : 0.48)) + 1);
  const finalCount = Math.min(adData.finalLines.length, Math.floor((elapsed - 5) / (adData.beatSync ? 0.68 : 0.82)) + 1);
  const featuredProduct = adData.productDetails?.[0];
  const cssVars = {
    "--ad-bg": adData.bgColor,
    "--ad-text": adData.textColor,
    "--ad-gold": adData.goldColor
  } as React.CSSProperties;

  return (
    <section
      className={`${styles.stage} ${compact ? styles.compact : ""}`}
      style={cssVars}
      aria-label="Animated Zavi Mart advertisement preview"
    >
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.beatFlash} style={{ opacity: adData.beatSync ? Math.max(0, 1 - (elapsed % 0.5) * 8) * 0.16 : 0 }} />
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
              {adData.titleLines.slice(0, firstCount).map((line, index) => (
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
                href={adData.ctaLink}
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
              {adData.productDetails?.slice(0, 4).map((product, index) => (
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
              {adData.secondLines.slice(0, secondCount).map((line, index) => (
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
              {adData.finalLines.slice(0, finalCount).map((line, index) => (
                <motion.span
                  key={`${line}-${index}`}
                  className={index === adData.finalLines.length - 1 ? styles.goldWord : ""}
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
            <strong>{adData.logoText}</strong>
            <a href={adData.ctaLink} className={styles.startButton}>{adData.ctaText}</a>
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
