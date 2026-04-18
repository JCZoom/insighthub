'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Copy, Trash2, GripVertical, Maximize2, Minimize2,
  PlusCircle, BarChart3, Table2, Gauge, Type, Library, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLongPress } from '@/hooks/useLongPress';
import { isTouchDevice } from '@/lib/touch-utils';

export interface ContextMenuAction {
  label: string;
  icon: typeof Copy;
  onClick: () => void;
  variant?: 'default' | 'danger';
  separator?: boolean;
}

interface LongPressRingProps {
  visible: boolean;
  x: number;
  y: number;
}

function LongPressRing({ visible, x, y }: LongPressRingProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{ left: x - 20, top: y - 20 }}
    >
      <div className="w-10 h-10 rounded-full border-2 border-accent-blue/60 animate-ping" />
    </div>
  );
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Position menu appropriately for touch vs mouse
  const isTouch = isTouchDevice();
  const menuWidth = 220;
  const itemHeight = 36;
  const menuHeight = actions.length * itemHeight + 16;

  // For touch devices, position menu above the touch point to avoid finger occlusion
  // For mouse, position at cursor location
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const adjustedY = isTouch
    ? Math.max(8, y - menuHeight - 20) // Position above touch point
    : Math.min(y, window.innerHeight - menuHeight - 8); // Standard positioning

  const style: React.CSSProperties = {
    position: 'fixed',
    left: adjustedX,
    top: adjustedY,
    zIndex: 100,
  };

  return (
    <div ref={ref} style={style} className="w-52 py-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl shadow-black/20 backdrop-blur-xl">
      {actions.map((action, i) => (
        <div key={i}>
          {action.separator && i > 0 && (
            <div className="my-1 border-t border-[var(--border-color)]" />
          )}
          <button
            onClick={() => { action.onClick(); onClose(); }}
            className={cn(
              'flex items-center gap-2.5 w-full px-3 py-1.5 text-xs transition-colors',
              action.variant === 'danger'
                ? 'text-accent-red hover:bg-accent-red/10'
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
            )}
          >
            <action.icon size={13} className={action.variant === 'danger' ? 'text-accent-red' : 'text-[var(--text-muted)]'} />
            {action.label}
          </button>
        </div>
      ))}
    </div>
  );
}

export function getCanvasActions(callbacks: {
  addKpi: () => void;
  addChart: () => void;
  addTable: () => void;
  addText: () => void;
  openLibrary: () => void;
}): ContextMenuAction[] {
  return [
    { label: 'Add KPI Card', icon: Gauge, onClick: callbacks.addKpi },
    { label: 'Add Bar Chart', icon: BarChart3, onClick: callbacks.addChart },
    { label: 'Add Table', icon: Table2, onClick: callbacks.addTable },
    { label: 'Add Text Block', icon: Type, onClick: callbacks.addText },
    { label: 'Browse Widget Library', icon: Library, onClick: callbacks.openLibrary, separator: true },
  ];
}

export function getWidgetActions(callbacks: {
  duplicate: () => void;
  delete: () => void;
  widen: () => void;
  narrow: () => void;
  editConfig?: () => void;
}): ContextMenuAction[] {
  return [
    ...(callbacks.editConfig ? [{ label: 'Edit Config', icon: Settings2, onClick: callbacks.editConfig }] : []),
    { label: 'Duplicate Widget', icon: Copy, onClick: callbacks.duplicate, separator: !!callbacks.editConfig },
    { label: 'Make Wider', icon: Maximize2, onClick: callbacks.widen, separator: true },
    { label: 'Make Narrower', icon: Minimize2, onClick: callbacks.narrow },
    { label: 'Drag to Reposition', icon: GripVertical, onClick: () => {}, separator: true },
    { label: 'Delete Widget', icon: Trash2, onClick: callbacks.delete, variant: 'danger', separator: true },
  ];
}

/**
 * Hook to add long-press context menu support to any element
 */
export function useLongPressContextMenu() {
  const [showRing, setShowRing] = useState(false);
  const [ringPosition, setRingPosition] = useState({ x: 0, y: 0 });

  const longPressProps = useLongPress({
    threshold: 500,
    onLongPress: (event) => {
      // This will be overridden by the component using this hook
    },
    onLongPressStart: () => {
      setShowRing(true);
    },
    onLongPressEnd: () => {
      setShowRing(false);
    },
  });

  const createLongPressHandler = (onContextMenu: (event: PointerEvent) => void) => ({
    ...longPressProps,
    onPointerDown: (e: React.PointerEvent) => {
      setRingPosition({ x: e.clientX, y: e.clientY });

      // Override the onLongPress in longPressProps
      const modifiedProps = useLongPress({
        threshold: 500,
        onLongPress: onContextMenu,
        onLongPressStart: () => setShowRing(true),
        onLongPressEnd: () => setShowRing(false),
      });

      modifiedProps.onPointerDown(e);
    },
  });

  const LongPressRingComponent = () => (
    <LongPressRing visible={showRing} x={ringPosition.x} y={ringPosition.y} />
  );

  return {
    createLongPressHandler,
    LongPressRing: LongPressRingComponent,
  };
}
