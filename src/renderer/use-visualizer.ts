import { useEffect, useRef } from "react";

import { calculatePulseLevel, smoothPulse } from "./visualizer";

export function useVisualizer(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  appShellRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean
): void {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const pulseFrameRef = useRef<number | null>(null);
  const mainPulseRef = useRef(0);
  const footerPulseRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const audio = audioRef.current;
    const AudioContextCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!audio || !AudioContextCtor) {
      applyShellPulse(appShellRef, 0, 0);
      return;
    }

    function applyPulse(mainPulse: number, footerPulse: number): void {
      applyShellPulse(appShellRef, mainPulse, footerPulse);
    }

    const ensureAnalyser = (): boolean => {
      if (analyserRef.current && audioContextRef.current) {
        return true;
      }

      try {
        const context = new AudioContextCtor();
        const analyser = context.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;

        const source = context.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(context.destination);

        audioContextRef.current = context;
        analyserRef.current = analyser;
        analyserDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        mediaSourceRef.current = source;
        return true;
      } catch {
        return false;
      }
    };

    const stopLoop = () => {
      if (pulseFrameRef.current != null) {
        window.cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }
    };

    const tick = () => {
      pulseFrameRef.current = null;

      const analyser = analyserRef.current;
      const data = analyserDataRef.current;
      const context = audioContextRef.current;
      const isActive =
        !audio.paused &&
        !audio.ended &&
        analyser != null &&
        data != null &&
        context?.state === "running";

      let targetPulse = 0;

      if (isActive && analyser && data) {
        analyser.getByteFrequencyData(data);
        targetPulse = calculatePulseLevel(data);
      }

      mainPulseRef.current = smoothPulse(mainPulseRef.current, targetPulse, isActive);
      footerPulseRef.current = smoothPulse(
        footerPulseRef.current,
        Math.min(targetPulse * 1.18, 1),
        isActive
      );

      applyPulse(mainPulseRef.current, footerPulseRef.current);

      if (isActive || mainPulseRef.current > 0 || footerPulseRef.current > 0) {
        pulseFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    const startLoop = async () => {
      if (!ensureAnalyser()) {
        return;
      }

      if (audioContextRef.current?.state === "suspended") {
        try {
          await audioContextRef.current.resume();
        } catch {
          // Ignore resume failures and leave pulse idle.
        }
      }

      if (pulseFrameRef.current == null) {
        pulseFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    const decayLoop = () => {
      if (pulseFrameRef.current == null) {
        pulseFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    const handlePlay = () => {
      void startLoop();
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("playing", handlePlay);
    audio.addEventListener("pause", decayLoop);
    audio.addEventListener("ended", decayLoop);

    if (!audio.paused) {
      void startLoop();
    } else {
      applyPulse(0, 0);
    }

    return () => {
      stopLoop();
      applyPulse(0, 0);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("playing", handlePlay);
      audio.removeEventListener("pause", decayLoop);
      audio.removeEventListener("ended", decayLoop);
      audioContextRef.current?.close().catch(() => {});
      mediaSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      mediaSourceRef.current = null;
      analyserRef.current = null;
      analyserDataRef.current = null;
      audioContextRef.current = null;
    };
  }, [appShellRef, audioRef, enabled]);
}

function applyShellPulse(
  appShellRef: React.RefObject<HTMLDivElement | null>,
  mainPulse: number,
  footerPulse: number
): void {
  const appShell = appShellRef.current;
  if (!appShell) {
    return;
  }

  appShell.style.setProperty("--streamer-main-pulse", mainPulse.toFixed(3));
  appShell.style.setProperty("--streamer-footer-pulse", footerPulse.toFixed(3));
}
