'use client';

import { useEffect, useRef, useCallback } from 'react';

interface VoiceWaveformProps {
  /** Live MediaStream from the microphone. Pass null to stop. */
  stream: MediaStream | null;
  /** Number of bars in the visualizer. Default 5. */
  barCount?: number;
  /** Height of the container in pixels. Default 24. */
  height?: number;
  /** CSS color for the bars. Default uses accent-red. */
  color?: string;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Real-time audio waveform visualizer using Web Audio API.
 * Renders animated bars that pulse with microphone input amplitude.
 *
 * Automatically creates/tears down AudioContext when stream changes.
 * Zero CPU usage when stream is null.
 */
export function VoiceWaveform({
  stream,
  barCount = 5,
  height = 24,
  color,
  className = '',
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = Math.max(2, Math.floor(canvas.width / (barCount * 2 - 1)));
    const gap = barWidth;
    const totalWidth = barCount * barWidth + (barCount - 1) * gap;
    const startX = (canvas.width - totalWidth) / 2;
    const minBarHeight = 3;

    // Sample frequency bins evenly across the spectrum (skip very low/high)
    const usableBins = Math.floor(bufferLength * 0.6);
    const binStep = Math.max(1, Math.floor(usableBins / barCount));

    // Resolve color from CSS custom property or use default
    const barColor = color || getComputedStyle(canvas).getPropertyValue('--waveform-color').trim() || '#ef4444';

    for (let i = 0; i < barCount; i++) {
      // Average a range of bins for smoother response
      const binStart = Math.floor(i * binStep) + Math.floor(bufferLength * 0.05);
      const binEnd = Math.min(binStart + binStep, bufferLength);
      let sum = 0;
      for (let b = binStart; b < binEnd; b++) {
        sum += dataArray[b];
      }
      const avg = sum / (binEnd - binStart);

      // Normalize to 0-1 and apply power curve for more dynamic range
      const normalized = Math.pow(avg / 255, 0.8);
      const barHeight = Math.max(minBarHeight, normalized * (canvas.height - 2));

      const x = startX + i * (barWidth + gap);
      const y = (canvas.height - barHeight) / 2;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      ctx.fillStyle = barColor;
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [barCount, color]);

  useEffect(() => {
    if (!stream) {
      // Clean up when stream is removed
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (contextRef.current) {
        contextRef.current.close().catch(() => {});
        contextRef.current = null;
      }
      analyserRef.current = null;

      // Clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    // Set up Web Audio API pipeline
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    contextRef.current = audioContext;
    analyserRef.current = analyser;
    sourceRef.current = source;

    // Start animation loop
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
      source.disconnect();
      audioContext.close().catch(() => {});
      contextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, [stream, draw]);

  if (!stream) return null;

  return (
    <canvas
      ref={canvasRef}
      width={barCount * 8}
      height={height}
      className={className}
      style={{
        height,
        width: barCount * 8,
        ['--waveform-color' as string]: 'var(--accent-red, #ef4444)',
      }}
    />
  );
}
