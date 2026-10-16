"use client";

import { useCallback, useRef, useState } from "react";
import NotificationBell from "../../app/admin/NotificationBell";

export default function AdminBellWithSound() {
  const mutedRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);

  const playFallback = useCallback(async () => {
    const context = new AudioContext();
    try {
      await context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.16, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
      window.setTimeout(() => void context.close(), 250);
    } catch {
      await context.close();
    }
  }, []);

  const playSound = useCallback(() => {
    if (mutedRef.current) return;
    void playFallback();
  }, [playFallback]);

  const toggleMuted = useCallback(() => {
    setIsMuted((muted) => {
      mutedRef.current = !muted;
      return !muted;
    });
  }, []);

  return (
    <NotificationBell
      onBellActivate={playSound}
      onNewOrder={playSound}
      soundMuted={isMuted}
      onToggleSound={toggleMuted}
    />
  );
}
