'use client';

import { useCallback, useRef, useEffect } from 'react';

interface UseLongPressOptions {
  /** Duration in milliseconds before long press triggers (default: 500ms) */
  threshold?: number;
  /** Called when long press is triggered */
  onLongPress: (event: PointerEvent) => void;
  /** Called when long press starts (for visual feedback) */
  onLongPressStart?: () => void;
  /** Called when long press is cancelled */
  onLongPressEnd?: () => void;
  /** Maximum movement in pixels before cancelling (default: 10px) */
  moveThreshold?: number;
}

export function useLongPress({
  threshold = 500,
  onLongPress,
  onLongPressStart,
  onLongPressEnd,
  moveThreshold = 10,
}: UseLongPressOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startPosition = useRef<{ x: number; y: number } | null>(null);
  const isLongPressed = useRef(false);
  const isPressed = useRef(false);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (isPressed.current) {
      onLongPressEnd?.();
    }
    isPressed.current = false;
    isLongPressed.current = false;
    startPosition.current = null;
  }, [onLongPressEnd]);

  useEffect(() => {
    return clear;
  }, [clear]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    // Only handle touch/pen events for long press
    if (event.pointerType === 'mouse') return;

    // Store starting position
    startPosition.current = { x: event.clientX, y: event.clientY };
    isPressed.current = true;
    isLongPressed.current = false;

    // Trigger feedback
    onLongPressStart?.();

    // Set timer for long press
    timeoutRef.current = setTimeout(() => {
      if (isPressed.current && !isLongPressed.current) {
        isLongPressed.current = true;
        // Trigger vibration feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        onLongPress(event.nativeEvent);
      }
    }, threshold);
  }, [threshold, onLongPress, onLongPressStart]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!isPressed.current || !startPosition.current) return;

    const dx = event.clientX - startPosition.current.x;
    const dy = event.clientY - startPosition.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Cancel if moved too far
    if (distance > moveThreshold) {
      clear();
    }
  }, [moveThreshold, clear]);

  const handlePointerUp = useCallback(() => {
    clear();
  }, [clear]);

  const handlePointerLeave = useCallback(() => {
    clear();
  }, [clear]);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerLeave,
    isLongPressed: isLongPressed.current,
  };
}