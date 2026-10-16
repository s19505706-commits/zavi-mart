"use client";

import { useCallback, useRef, useState } from "react";
import NotificationBell from "../../app/admin/NotificationBell";

export default function AdminBellWithSound() {
  const mutedRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);

  const playNotificationBeep = useCallback(async () => {
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      await context.resume();
      const startTime = context.currentTime;
      for (const [index, frequency] of [800, 1000].entries()) {
        const beepStart = startTime + index * 0.2;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.001, beepStart);
        gain.gain.linearRampToValueAtTime(0.16, beepStart + 0.01);
        gain.gain.setValueAtTime(0.16, beepStart + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, beepStart + 0.2);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(beepStart);
        oscillator.stop(beepStart + 0.2);
      }
    } catch (error) {
      if (context && context.state !== "closed") await context.close();
      throw error;
    }
    window.setTimeout(() => {
      if (context?.state !== "closed") {
        void context?.close().catch((error: unknown) => {
          console.warn("Could not close the admin notification audio context.", error);
        });
      }
    }, 500);
  }, []);

  const playSound = useCallback(() => {
    if (mutedRef.current) return;
    void playNotificationBeep().catch((error: unknown) => {
      console.warn("Could not initialize the admin notification beep.", error);
    });
  }, [playNotificationBeep]);

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
