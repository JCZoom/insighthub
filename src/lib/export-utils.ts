'use client';

// --- CSV Export ---

function escapeCSVField(field: unknown): string {
  if (field == null) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.map(escapeCSVField).join(','),
    ...data.map(row => headers.map(header => escapeCSVField(row[header])).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

// --- PNG Export (html2canvas) ---

export async function exportToPNG(elementId: string, filename: string): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`PNG export: element #${elementId} not found`);
      return;
    }

    // Resolve CSS custom property to an actual color value html2canvas can use
    const root = document.documentElement;
    const computedBg = getComputedStyle(root).getPropertyValue('--bg-primary').trim();
    // Fallback to a sensible dark background if variable is empty or unresolvable
    const bgColor = computedBg && computedBg !== '' ? computedBg : '#0a0e14';

    const html2canvasModule = await import('html2canvas');
    const html2canvas = html2canvasModule.default;

    const canvas = await html2canvas(element, {
      backgroundColor: bgColor,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      // Resolve CSS variables in the cloned DOM so html2canvas can read them
      onclone: (clonedDoc: Document) => {
        const clonedRoot = clonedDoc.documentElement;
        const rootStyles = getComputedStyle(root);
        // Copy all CSS custom properties to the cloned document
        const varsToCopy = ['--bg-primary', '--bg-card', '--bg-card-hover', '--border-color', '--text-primary', '--text-secondary', '--text-muted'];
        varsToCopy.forEach(v => {
          const val = rootStyles.getPropertyValue(v).trim();
          if (val) clonedRoot.style.setProperty(v, val);
        });
      },
    });

    const dataUrl = canvas.toDataURL('image/png');
    triggerDownload(dataURLtoBlob(dataUrl), `${filename}.png`);
  } catch (error) {
    console.error('PNG export failed:', error);
  }
}

function dataURLtoBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(parts[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

// --- SVG Export (Recharts SVG extraction) ---

export function exportToSVG(containerId: string, filename: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const svgElement = container.querySelector('.recharts-wrapper svg') as SVGSVGElement | null;
  if (!svgElement) {
    const anySvg = container.querySelector('svg') as SVGSVGElement | null;
    if (!anySvg) {
      console.warn('No SVG chart found in widget for export');
      return;
    }
    downloadSVG(anySvg, filename);
    return;
  }
  downloadSVG(svgElement, filename);
}

function downloadSVG(svgElement: SVGSVGElement, filename: string): void {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!clone.getAttribute('viewBox')) {
    const bbox = svgElement.getBBox();
    clone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
  }

  // Inline computed styles so the SVG looks correct standalone
  const allElements = clone.querySelectorAll('*');
  const originalElements = svgElement.querySelectorAll('*');
  allElements.forEach((el, i) => {
    if (originalElements[i]) {
      const computed = getComputedStyle(originalElements[i]);
      const important = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-family', 'font-weight', 'opacity', 'text-anchor', 'dominant-baseline'];
      important.forEach(prop => {
        const val = computed.getPropertyValue(prop);
        if (val) (el as SVGElement).style.setProperty(prop, val);
      });
    }
  });

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, `${filename}.svg`);
}

// --- Helper ---

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
