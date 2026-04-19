'use client';

import { useCallback, useRef } from 'react';
import { useAutoSave } from './useAutoSave';
import { captureDashboardThumbnail } from '@/lib/thumbnail-generator';

interface AutoSaveWithThumbnailsOptions {
  /** Function to get the dashboard canvas element for screenshot */
  getDashboardElement: () => HTMLElement | null;
  /** Whether to generate thumbnails automatically */
  enableThumbnails?: boolean;
  /** Custom save handler */
  onSave?: (dashboardId: string, schema: unknown, title: string) => Promise<void>;
  /** Whether auto-save is enabled */
  enabled?: boolean;
}

export function useAutoSaveWithThumbnails({
  getDashboardElement,
  enableThumbnails = true,
  onSave,
  enabled = true
}: AutoSaveWithThumbnailsOptions) {
  const isGeneratingThumbnailRef = useRef(false);

  // Custom save handler that includes thumbnail generation
  const saveWithThumbnail = useCallback(async (
    dashboardId: string,
    schema: unknown,
    title: string
  ) => {
    // First, save the dashboard
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
        throw new Error('Failed to save dashboard');
      }
    }

    // After successful save, generate thumbnail if enabled
    if (enableThumbnails && !isGeneratingThumbnailRef.current) {
      isGeneratingThumbnailRef.current = true;

      try {
        const dashboardElement = getDashboardElement();
        if (dashboardElement) {
          // Wait a bit for any pending renders after save
          await new Promise(resolve => setTimeout(resolve, 300));

          await captureDashboardThumbnail(dashboardId, dashboardElement, {
            width: 400,
            height: 250,
            quality: 0.85
          });

          console.log(`Thumbnail generated for dashboard ${dashboardId}`);
        } else {
          console.warn('Dashboard element not found for thumbnail generation');
        }
      } catch (error) {
        // Don't fail the save if thumbnail generation fails
        console.error('Thumbnail generation failed:', error);
      } finally {
        isGeneratingThumbnailRef.current = false;
      }
    }
  }, [getDashboardElement, enableThumbnails, onSave]);

  // Use the enhanced save handler with the original auto-save hook
  const { save, getIsSaving } = useAutoSave({
    onSave: saveWithThumbnail,
    enabled
  });

  // Manual save that includes thumbnail generation
  const saveManually = useCallback(async () => {
    await save();
  }, [save]);

  return {
    save: saveManually,
    getIsSaving: () => getIsSaving() || isGeneratingThumbnailRef.current,
    getIsGeneratingThumbnail: () => isGeneratingThumbnailRef.current
  };
}