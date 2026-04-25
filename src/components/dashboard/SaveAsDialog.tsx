'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Copy, Loader2, X, FolderOpen, ChevronRight } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useToast } from '@/components/ui/toast';
import { FolderPicker } from '@/components/folders/FolderPicker';
import { cn } from '@/lib/utils';

/**
 * SaveAsDialog — the unified "Save As…" flow.
 *
 * Behavior:
 *   - When dashboardId is set (editing an existing dashboard), POSTs to
 *     /api/dashboards/[id]/duplicate with { title, folderId } so server-side
 *     cloning can copy over the schema, description, tags, etc. exactly.
 *   - When dashboardId is null (unsaved new dashboard), POSTs to
 *     /api/dashboards with { title, schema, folderId } to create it fresh.
 *
 * Either way, the dialog collects a title + folder, then navigates to the
 * new dashboard on success.
 */

export function SaveAsDialog() {
  const showSaveAsDialog = useDashboardStore((s) => s.showSaveAsDialog);
  const closeSaveAsDialog = useDashboardStore((s) => s.closeSaveAsDialog);
  const initialize = useDashboardStore((s) => s.initialize);
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderLabel, setFolderLabel] = useState('All Dashboards (root)');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Seed title from the store whenever the dialog opens
  useEffect(() => {
    if (!showSaveAsDialog) return;
    const store = useDashboardStore.getState();
    const suggested =
      store.dashboardId == null
        ? store.title || 'Untitled Dashboard'
        : `${store.title.replace(/\s*\(Copy(?: \d+)?\)$/, '')} (Copy)`;
    setTitle(suggested);
    setFolderId(null);
    setFolderLabel('All Dashboards (root)');
  }, [showSaveAsDialog]);

  // Close on Escape
  useEffect(() => {
    if (!showSaveAsDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showFolderPicker && !submitting) {
        closeSaveAsDialog();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSaveAsDialog, showFolderPicker, submitting, closeSaveAsDialog]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    const trimmed = title.trim();
    if (!trimmed) {
      toast({ type: 'error', title: 'Title is required' });
      return;
    }
    setSubmitting(true);
    try {
      const store = useDashboardStore.getState();
      const { dashboardId, schema } = store;
      let newId: string | null = null;
      let newTitle = trimmed;

      if (dashboardId) {
        // Duplicate flow — server clones schema/description/tags
        const res = await fetch(`/api/dashboards/${dashboardId}/duplicate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed, folderId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Could not duplicate dashboard');
        }
        const { dashboard } = await res.json();
        newId = dashboard.id;
        newTitle = dashboard.title;
      } else {
        // Fresh create flow — schema comes from the in-memory store
        const res = await fetch('/api/dashboards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed, schema, folderId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Could not create dashboard');
        }
        const { dashboard } = await res.json();
        newId = dashboard.id;
        newTitle = dashboard.title;
      }

      if (newId) {
        initialize(newId, newTitle, useDashboardStore.getState().schema);
        closeSaveAsDialog();
        toast({
          type: 'success',
          title: 'Saved',
          description: `"${newTitle}" saved${folderId ? ` to ${folderLabel}` : ''}.`,
        });
        router.replace(`/dashboard/${newId}`);
      }
    } catch (err) {
      toast({
        type: 'error',
        title: 'Save As failed',
        description: err instanceof Error ? err.message : 'Network error.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [submitting, title, folderId, folderLabel, initialize, closeSaveAsDialog, toast, router]);

  const handleFolderSelected = useCallback(
    async (selection: (string | null)[]) => {
      const picked = selection[0];
      setFolderId(picked ?? null);
      setShowFolderPicker(false);
      // Fetch the folder name for the chip label. Lightweight — we already
      // have a folder API and this isn't in a hot path.
      if (picked) {
        try {
          const res = await fetch(`/api/folders/${picked}`);
          if (res.ok) {
            const { folder } = await res.json();
            setFolderLabel(folder?.name || 'Selected folder');
          }
        } catch {
          setFolderLabel('Selected folder');
        }
      } else {
        setFolderLabel('All Dashboards (root)');
      }
    },
    []
  );

  if (!showSaveAsDialog || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => !submitting && closeSaveAsDialog()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-4 pt-4 pb-3 border-b border-[var(--border-color)] flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-green/10 flex items-center justify-center">
              <Copy size={14} className="text-accent-green" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Save As…</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Create a new dashboard from this one. Pick a name and destination.
              </p>
            </div>
          </div>
          <button
            onClick={closeSaveAsDialog}
            disabled={submitting}
            className="p-1 rounded hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Dashboard title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              autoFocus
              placeholder="My dashboard"
              className="w-full px-3 py-1.5 text-sm rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent-blue/50"
            />
          </div>

          {/* Folder picker row */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Save to folder
            </label>
            <button
              type="button"
              onClick={() => setShowFolderPicker(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors text-left"
            >
              <FolderOpen size={14} className="text-accent-blue shrink-0" />
              <span className="text-sm text-[var(--text-primary)] flex-1 truncate">
                {folderLabel}
              </span>
              <ChevronRight size={12} className="text-[var(--text-muted)] shrink-0" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--border-color)] flex items-center justify-end gap-2 bg-[var(--bg-card)]/40">
          <button
            onClick={closeSaveAsDialog}
            disabled={submitting}
            className="px-3 py-1.5 text-xs rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className={cn(
              'px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5',
              submitting || !title.trim()
                ? 'bg-[var(--bg-card)] text-[var(--text-muted)] cursor-not-allowed'
                : 'bg-accent-green text-white hover:bg-accent-green/90'
            )}
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
            Save as new dashboard
          </button>
        </div>
      </div>

      {showFolderPicker && (
        <FolderPicker
          mode="single"
          includeRoot
          initialSelection={[folderId]}
          title="Save to folder"
          description="Pick where this dashboard should live in your folder tree."
          confirmLabel="Select"
          onConfirm={handleFolderSelected}
          onClose={() => setShowFolderPicker(false)}
        />
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
