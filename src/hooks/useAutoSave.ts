'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';

const AUTO_SAVE_DELAY_MS = 30_000; // 30 seconds

interface AutoSaveOptions {
  onSave?: (dashboardId: string, schema: unknown, title: string) => Promise<void>;
  enabled?: boolean;
}

export function useAutoSave({ onSave, enabled = true }: AutoSaveOptions = {}) {
  const { dashboardId, schema, title, isDirty, markSaved } = useDashboardStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  const save = useCallback(async () => {
    if (!dashboardId || !isDirty || isSavingRef.current) return;
    isSavingRef.current = true;

    try {
      if (onSave) {
        await onSave(dashboardId, schema, title);
      } else {
        // Default save: POST to versions API
        const res = await fetch(`/api/dashboards/${dashboardId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schema,
            changeNote: 'Auto-saved',
          }),
        });
        if (!res.ok) {
          console.error('Auto-save failed:', await res.text());
          return;
        }
      }
      markSaved();
    } catch (err) {
      console.error('Auto-save error:', err);
    } finally {
      isSavingRef.current = false;
    }
  }, [dashboardId, schema, title, isDirty, markSaved, onSave]);

  // Reset timer on every schema change
  useEffect(() => {
    if (!enabled || !isDirty || !dashboardId) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, AUTO_SAVE_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, isDirty, dashboardId, schema, save]);

  // Manual save (for Cmd+S)
  // Return a getter to avoid accessing ref.current during render
  return { save, getIsSaving: () => isSavingRef.current };
}
