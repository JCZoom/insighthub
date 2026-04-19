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
      alert('PNG export failed: target element not found.');
      return;
    }

    // Resolve CSS custom property to an actual color value html2canvas can use
    const root = document.documentElement;
    const computedBg = getComputedStyle(root).getPropertyValue('--bg-primary').trim();
    const bgColor = computedBg && computedBg !== '' ? computedBg : '#0a0e14';

    // Collect all CSS custom properties before cloning
    const rootStyles = getComputedStyle(root);
    const cssVars: Record<string, string> = {};
    const varsToCopy = [
      '--bg-primary', '--bg-secondary', '--bg-card', '--bg-card-hover', '--bg-hover',
      '--border-color', '--text-primary', '--text-secondary', '--text-muted',
      '--accent-blue', '--accent-purple', '--accent-green', '--accent-red',
      '--accent-cyan', '--accent-amber',
    ];
    varsToCopy.forEach(v => {
      const val = rootStyles.getPropertyValue(v).trim();
      if (val) cssVars[v] = val;
    });

    // html2canvas v1.x may export as .default or as the module itself
    const mod = await import('html2canvas');
    const html2canvas = (typeof mod.default === 'function' ? mod.default : mod) as (
      element: HTMLElement,
      options?: Record<string, unknown>
    ) => Promise<HTMLCanvasElement>;

    const canvas = await html2canvas(element, {
      backgroundColor: bgColor,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      removeContainer: true,
      onclone: (clonedDoc: Document) => {
        const clonedRoot = clonedDoc.documentElement;
        // Copy all CSS custom properties to the cloned document
        Object.entries(cssVars).forEach(([key, val]) => {
          clonedRoot.style.setProperty(key, val);
        });
        // Also set on body for inheritance
        clonedDoc.body.style.setProperty('background-color', bgColor);

        // Remove any backdrop-filter elements (unsupported by html2canvas)
        clonedDoc.querySelectorAll('[class*="backdrop"]').forEach(el => {
          (el as HTMLElement).style.backdropFilter = 'none';
          (el as HTMLElement).style.setProperty('-webkit-backdrop-filter', 'none');
        });
      },
    });

    canvas.toBlob((blob) => {
      if (blob) {
        triggerDownload(blob, `${filename}.png`);
      } else {
        console.error('PNG export: canvas.toBlob returned null');
        alert('PNG export failed: could not generate image. Try a smaller dashboard or fewer widgets.');
      }
    }, 'image/png');
  } catch (error) {
    console.error('PNG export failed:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    alert(`PNG export failed: ${msg}`);
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

  // Find all Recharts chart SVGs (the main chart surface, not tiny legend icons)
  const allChartSvgs = Array.from(
    container.querySelectorAll('.recharts-wrapper > .recharts-surface')
  ) as SVGSVGElement[];

  // Filter for SVGs that are actual charts (larger than 50x50 to exclude legend icons)
  const chartSvgs = allChartSvgs.filter(svg => {
    const w = svg.width?.baseVal?.value || svg.clientWidth || 0;
    const h = svg.height?.baseVal?.value || svg.clientHeight || 0;
    return w > 50 && h > 50;
  });

  if (chartSvgs.length > 0) {
    // If multiple chart SVGs, combine into a single composite SVG
    if (chartSvgs.length === 1) {
      downloadSVG(chartSvgs[0], filename);
    } else {
      downloadCompositeSVG(chartSvgs, filename);
    }
    return;
  }

  // Fallback: find any reasonably-sized SVG
  const allSvgs = Array.from(container.querySelectorAll('svg')) as SVGSVGElement[];
  const fallbackSvg = allSvgs.find(svg => {
    const w = svg.width?.baseVal?.value || svg.clientWidth || 0;
    const h = svg.height?.baseVal?.value || svg.clientHeight || 0;
    return w > 50 && h > 50;
  });

  if (!fallbackSvg) {
    alert('No chart SVG found to export. Try exporting as PNG instead for the full dashboard layout.');
    return;
  }
  downloadSVG(fallbackSvg, filename);
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

function downloadCompositeSVG(svgs: SVGSVGElement[], filename: string): void {
  const GAP = 24;
  const rects = svgs.map(svg => ({
    w: svg.width?.baseVal?.value || svg.clientWidth || 400,
    h: svg.height?.baseVal?.value || svg.clientHeight || 300,
  }));

  const totalHeight = rects.reduce((sum, r) => sum + r.h + GAP, -GAP);
  const maxWidth = Math.max(...rects.map(r => r.w));

  const ns = 'http://www.w3.org/2000/svg';
  const composite = document.createElementNS(ns, 'svg');
  composite.setAttribute('xmlns', ns);
  composite.setAttribute('viewBox', `0 0 ${maxWidth} ${totalHeight}`);
  composite.setAttribute('width', String(maxWidth));
  composite.setAttribute('height', String(totalHeight));

  let yOffset = 0;
  svgs.forEach((svg, i) => {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `translate(0, ${yOffset})`);

    const clone = svg.cloneNode(true) as SVGSVGElement;
    // Inline styles for standalone rendering
    const allEls = clone.querySelectorAll('*');
    const origEls = svg.querySelectorAll('*');
    allEls.forEach((el, j) => {
      if (origEls[j]) {
        const computed = getComputedStyle(origEls[j]);
        ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-family', 'font-weight', 'opacity', 'text-anchor', 'dominant-baseline'].forEach(prop => {
          const val = computed.getPropertyValue(prop);
          if (val) (el as SVGElement).style.setProperty(prop, val);
        });
      }
    });

    // Move children from clone into the group
    while (clone.firstChild) {
      g.appendChild(clone.firstChild);
    }
    composite.appendChild(g);
    yOffset += rects[i].h + GAP;
  });

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(composite);
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
