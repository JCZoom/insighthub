import html2canvas from 'html2canvas';

export interface ThumbnailOptions {
  /** Target width for the thumbnail */
  width?: number;
  /** Target height for the thumbnail */
  height?: number;
  /** Quality of the image (0-1) */
  quality?: number;
  /** Background color if transparent elements exist */
  backgroundColor?: string;
  /** Whether to use CORS for external images */
  useCORS?: boolean;
}

const DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
  width: 400,
  height: 250,
  quality: 0.8,
  backgroundColor: 'var(--bg-primary)',
  useCORS: true
};

/**
 * Generate a thumbnail from a DOM element
 */
export async function generateThumbnail(
  element: HTMLElement,
  options: ThumbnailOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Use html2canvas to capture the element
    const canvas = await html2canvas(element, {
      width: opts.width,
      height: opts.height,
      backgroundColor: opts.backgroundColor,
      useCORS: opts.useCORS,
      allowTaint: false,
      scale: 1,
      logging: false,
      // Ignore elements that might cause issues
      ignoreElements: (el) => {
        // Skip iframes, videos, and other problematic elements
        return el.tagName === 'IFRAME' || el.tagName === 'VIDEO' || el.tagName === 'EMBED';
      }
    });

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to generate thumbnail blob'));
            return;
          }

          // Create data URL from blob
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read thumbnail blob'));
          reader.readAsDataURL(blob);
        },
        'image/png',
        opts.quality
      );
    });
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    throw new Error('Failed to generate thumbnail');
  }
}

/**
 * Save thumbnail to server storage
 */
export async function saveThumbnail(
  dashboardId: string,
  thumbnailDataUrl: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/thumbnails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dashboardId,
        thumbnail: thumbnailDataUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save thumbnail: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Failed to save thumbnail:', error);
    return false;
  }
}

/**
 * Generate and save dashboard thumbnail
 */
export async function captureDashboardThumbnail(
  dashboardId: string,
  dashboardElement: HTMLElement,
  options?: ThumbnailOptions
): Promise<boolean> {
  try {
    // Wait for any pending renders
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate thumbnail
    const thumbnailDataUrl = await generateThumbnail(dashboardElement, options);

    // Save to server
    const success = await saveThumbnail(dashboardId, thumbnailDataUrl);

    if (success) {
      console.log(`Thumbnail generated successfully for dashboard ${dashboardId}`);
    }

    return success;
  } catch (error) {
    console.error(`Failed to capture thumbnail for dashboard ${dashboardId}:`, error);
    return false;
  }
}

/**
 * Delete thumbnail from server
 */
export async function deleteThumbnail(dashboardId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/thumbnails?dashboardId=${dashboardId}`, {
      method: 'DELETE',
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to delete thumbnail:', error);
    return false;
  }
}