'use client';

import { useRef } from 'react';
import type { WidgetConfig } from '@/types';
import { getMinWidgetSize } from '@/components/widgets/widget-utils';

interface ResizeHandlesProps {
  widget: WidgetConfig;
  isActive?: boolean;
  onResizeStart: (e: React.PointerEvent, direction: ResizeDirection) => void;
}

export type ResizeDirection = 'se' | 'e' | 's' | 'sw' | 'w' | 'nw' | 'n' | 'ne';

interface ResizeHandleProps {
  direction: ResizeDirection;
  className: string;
  onPointerDown: (e: React.PointerEvent) => void;
  cursor: string;
}

function ResizeHandle({ direction, className, onPointerDown, cursor }: ResizeHandleProps) {
  return (
    <div
      className={`absolute z-20 transition-opacity hover:opacity-100 ${className}`}
      onPointerDown={onPointerDown}
      style={{ cursor }}
      title={`Resize ${direction.toUpperCase()}`}
    >
      {/* Corner handles get a visual indicator */}
      {['se', 'sw', 'nw', 'ne'].includes(direction) && (
        <div className="w-2 h-2 bg-accent-purple border border-white/50 rounded-sm shadow-sm" />
      )}
      {/* Edge handles are invisible but functional */}
    </div>
  );
}

export function ResizeHandles({ widget, isActive = false, onResizeStart }: ResizeHandlesProps) {
  const { minW, minH } = getMinWidgetSize(widget.type);
  const canResizeHorizontally = widget.position.w > minW;
  const canResizeVertically = widget.position.h > minH;

  const handlePointerDown = (direction: ResizeDirection) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onResizeStart(e, direction);
  };

  // Base opacity for handles - show on hover or when actively resizing
  const baseOpacity = isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

  return (
    <>
      {/* Corner handles */}
      <ResizeHandle
        direction="se"
        className={`bottom-0 right-0 w-3 h-3 flex items-end justify-end ${baseOpacity}`}
        onPointerDown={handlePointerDown('se')}
        cursor="nwse-resize"
      />
      <ResizeHandle
        direction="sw"
        className={`bottom-0 left-0 w-3 h-3 flex items-end justify-start ${baseOpacity}`}
        onPointerDown={handlePointerDown('sw')}
        cursor="nesw-resize"
      />
      <ResizeHandle
        direction="nw"
        className={`top-0 left-0 w-3 h-3 flex items-start justify-start ${baseOpacity}`}
        onPointerDown={handlePointerDown('nw')}
        cursor="nwse-resize"
      />
      <ResizeHandle
        direction="ne"
        className={`top-0 right-0 w-3 h-3 flex items-start justify-end ${baseOpacity}`}
        onPointerDown={handlePointerDown('ne')}
        cursor="nesw-resize"
      />

      {/* Edge handles */}
      <ResizeHandle
        direction="n"
        className={`top-0 left-3 right-3 h-1 ${baseOpacity}`}
        onPointerDown={handlePointerDown('n')}
        cursor="ns-resize"
      />
      <ResizeHandle
        direction="s"
        className={`bottom-0 left-3 right-3 h-1 ${baseOpacity}`}
        onPointerDown={handlePointerDown('s')}
        cursor="ns-resize"
      />
      <ResizeHandle
        direction="w"
        className={`left-0 top-3 bottom-3 w-1 ${baseOpacity}`}
        onPointerDown={handlePointerDown('w')}
        cursor="ew-resize"
      />
      <ResizeHandle
        direction="e"
        className={`right-0 top-3 bottom-3 w-1 ${baseOpacity}`}
        onPointerDown={handlePointerDown('e')}
        cursor="ew-resize"
      />
    </>
  );
}