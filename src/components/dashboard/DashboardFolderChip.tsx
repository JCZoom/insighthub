'use client';

import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, ChevronDown, Loader2 } from 'lucide-react';
import { FolderPicker } from '@/components/folders/FolderPicker';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

interface DashboardFolderChipProps {
  /** Dashboard id. When null (new/unsaved dashboard), the chip is inert. */
  dashboardId: string | null;
  /** Visual density variant. */
  size?: 'sm' | 'md';
  /** Optional className override (e.g. to hide on small screens). */
  className?: string;
}

/**
 * DashboardFolderChip — persistent "In: [folder] ▾" indicator for the editor.
 *
 * Clicking opens a single-select FolderPicker; confirming calls the move API
 * and updates the chip label in place. For unsaved dashboards (dashboardId == null)
 * we render a subtle disabled state because there's nothing to move yet — the
 * user should pick a folder through Save As instead.
 */
export function DashboardFolderChip({
  dashboardId,
  size = 'md',
  className,
}: DashboardFolderChipProps) {
  const { toast } = useToast();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Load current primary folder when dashboardId changes
  useEffect(() => {
    if (!dashboardId) {
      setFolderId(null);
      setFolderName(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}`);
        if (!res.ok) return;
        const { dashboard } = await res.json();
        if (cancelled) return;
        setFolderId(dashboard?.folderId ?? null);
        setFolderName(dashboard?.folder?.name ?? null);
      } catch {
        // Non-fatal — chip will simply show "All Dashboards"
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardId]);

  const handleConfirm = useCallback(
    async (selection: (string | null)[]) => {
      if (!dashboardId) {
        setShowPicker(false);
        return;
      }
      const target = selection[0] ?? null;
      // No-op if unchanged
      if (target === folderId) {
        setShowPicker(false);
        return;
      }
      setMoving(true);
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: target }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Move failed');
        }
        // Refresh the folder name from the response payload
        const { dashboard } = await res.json();
        setFolderId(dashboard?.folderId ?? null);
        setFolderName(dashboard?.folder?.name ?? null);
        toast({
          type: 'success',
          title: target ? 'Moved to folder' : 'Moved to root',
          description: target ? `Now living in ${dashboard?.folder?.name || 'folder'}.` : undefined,
        });
        setShowPicker(false);
      } catch (err) {
        toast({
          type: 'error',
          title: 'Move failed',
          description: err instanceof Error ? err.message : 'Network error.',
        });
      } finally {
        setMoving(false);
      }
    },
    [dashboardId, folderId, toast]
  );

  const disabled = !dashboardId;
  const label = folderName ?? 'All Dashboards';

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px]'
      : 'px-2.5 py-1 text-xs';

  return (
    <>
      <Tooltip
        content={disabled ? 'Save this dashboard first to assign a folder' : 'Change folder'}
        side="bottom"
      >
        <button
          type="button"
          onClick={() => !disabled && setShowPicker(true)}
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border transition-colors shrink-0',
            sizeClasses,
            disabled
              ? 'border-[var(--border-color)] bg-[var(--bg-card)]/60 text-[var(--text-muted)] cursor-not-allowed'
              : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-accent-blue/30',
            className
          )}
        >
          {loading || moving ? (
            <Loader2 size={11} className="animate-spin text-[var(--text-muted)]" />
          ) : (
            <FolderOpen size={11} className="text-accent-blue/80" />
          )}
          <span className="truncate max-w-[160px]">{label}</span>
          {!disabled && <ChevronDown size={10} className="text-[var(--text-muted)]" />}
        </button>
      </Tooltip>

      {showPicker && (
        <FolderPicker
          mode="single"
          includeRoot
          initialSelection={[folderId]}
          title="Move dashboard to folder"
          description="This changes the dashboard's primary folder. Aliases (if any) stay where they are."
          confirmLabel="Move here"
          onConfirm={handleConfirm}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}
