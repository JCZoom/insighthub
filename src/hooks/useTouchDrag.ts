'use client';

import { useCallback, useRef, useEffect } from 'react';

interface UseTouchDragOptions {
  /** Duration in milliseconds before drag starts (default: 300ms for touch) */
  holdThreshold?: number;
  /** Called when drag starts */
  onDragStart: (event: PointerEvent) => void;
  /** Called during drag */
  onDragMove: (event: PointerEvent) => void;
  /** Called when drag ends */
  onDragEnd: (event: PointerEvent) => void;
  /** Called when hold begins (for visual feedback) */
  onHoldStart?: () => void;
  /** Called when hold is cancelled */
  onHoldEnd?: () => void;
  /** Minimum distance before starting drag (default: 5px) */
  dragThreshold?: number;
  /** Whether this element should handle mouse events immediately */
  enableMouseDrag?: boolean;
}

export function useTouchDrag({
  holdThreshold = 300,
  onDragStart,
  onDragMove,
  onDragEnd,
  onHoldStart,
  onHoldEnd,
  dragThreshold = 5,
  enableMouseDrag = true,
}: UseTouchDragOptions) {
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startPosition = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const isHolding = useRef(false);
  const hasStartedDrag = useRef(false);

  const clear = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (isHolding.current) {
      onHoldEnd?.();
    }
    isDragging.current = false;
    isHolding.current = false;
    hasStartedDrag.current = false;
    startPosition.current = null;
  }, [onHoldEnd]);

  useEffect(() => {
    return clear;
  }, [clear]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    const isTouch = event.pointerType !== 'mouse';

    // For mouse events, start immediately if enabled
    if (!isTouch && enableMouseDrag) {
      startPosition.current = { x: event.clientX, y: event.clientY };
      isDragging.current = true;
      hasStartedDrag.current = true;
      onDragStart(event.nativeEvent);
      return;
    }

    // For touch events, require a hold
    if (isTouch) {
      startPosition.current = { x: event.clientX, y: event.clientY };
      isHolding.current = true;
      hasStartedDrag.current = false;

      // Visual feedback for hold start
      onHoldStart?.();

      // Set timer for hold threshold
      holdTimeoutRef.current = setTimeout(() => {
        if (isHolding.current && !isDragging.current) {
          isDragging.current = true;
          // Haptic feedback for drag start
          if ('vibrate' in navigator) {
            navigator.vibrate([30]);
          }
          onDragStart(event.nativeEvent);
          hasStartedDrag.current = true;
        }
      }, holdThreshold);
    }
  }, [holdThreshold, onDragStart, onHoldStart, enableMouseDrag]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!startPosition.current) return;

    const dx = event.clientX - startPosition.current.x;
    const dy = event.clientY - startPosition.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If we're holding but haven't started dragging yet
    if (isHolding.current && !hasStartedDrag.current) {
      // Cancel hold if moved too far before hold completes
      if (distance > dragThreshold) {
        clear();
      }
      return;
    }

    // If we're dragging, call the move handler
    if (isDragging.current && hasStartedDrag.current) {
      onDragMove(event.nativeEvent);
    }
  }, [dragThreshold, onDragMove, clear]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    if (hasStartedDrag.current && isDragging.current) {
      onDragEnd(event.nativeEvent);
    }
    clear();
  }, [onDragEnd, clear]);

  const handlePointerCancel = useCallback(() => {
    clear();
  }, [clear]);

  const handlePointerLeave = useCallback((event: React.PointerEvent) => {
    // Only cancel if we haven't started dragging yet
    if (!hasStartedDrag.current) {
      clear();
    }
  }, [clear]);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onPointerLeave: handlePointerLeave,
    isDragging: isDragging.current,
    isHolding: isHolding.current,
  };
}