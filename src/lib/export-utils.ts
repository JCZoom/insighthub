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

// --- PNG Export (html-to-image) ---
// Uses the browser's native rendering engine via SVG foreignObject → canvas,
// so it handles ALL modern CSS (oklab, oklch, color-mix, etc.) without issues.

export async function exportToPNG(elementId: string, filename: string): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`PNG export: element #${elementId} not found`);
      alert('PNG export failed: target element not found.');
      return;
    }

    const { toPng } = await import('html-to-image');

    // Resolve background color for the export
    const root = document.documentElement;
    const bgRaw = getComputedStyle(root).getPropertyValue('--bg-primary').trim();
    const bgColor = bgRaw || '#0a0e14';

    // Inject a system font fallback into the element BEFORE cloning.
    // html-to-image may fail to embed Next.js optimized font files on production
    // (CORS / opaque responses). This ensures sans-serif fallback instead of serif.
    const fontFixStyle = document.createElement('style');
    fontFixStyle.setAttribute('data-export-font-fix', '1');
    fontFixStyle.textContent = `
      *:not(svg):not(svg *) {
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                     "Helvetica Neue", Arial, sans-serif !important;
      }
    `;
    element.prepend(fontFixStyle);

    try {
      const dataUrl = await toPng(element, {
        pixelRatio: 2,
        backgroundColor: bgColor,
        cacheBust: true,
        // Let html-to-image TRY to embed fonts — if it succeeds, great.
        // If it fails, our injected fallback style ensures sans-serif.
        fetchRequestInit: {
          cache: 'force-cache',
        },
        // Skip elements that shouldn't be in the export
        filter: (node: HTMLElement) => {
          if (node.dataset?.exportIgnore === 'true') return false;
          return true;
        },
      });

      // Convert data URL to blob without fetch() (avoids CORS/mixed-content issues)
      const byteString = atob(dataUrl.split(',')[1]);
      const mimeType = dataUrl.split(',')[0].match(/:(.*?);/)?.[1] || 'image/png';
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeType });
      triggerDownload(blob, `${filename}.png`);
    } finally {
      // Always clean up the injected style so the page isn't affected
      fontFixStyle.remove();
    }

  } catch (error) {
    console.error('PNG export failed:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    alert(`PNG export failed: ${msg}`);
  }
}

// --- SVG Export (full dashboard via foreignObject) ---

export function exportToSVG(containerId: string, filename: string): void {
  const container = document.getElementById(containerId);
  if (!container) {
    alert('SVG export: target element not found.');
    return;
  }

  const rect = container.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);

  // Resolve theme background
  const root = document.documentElement;
  const bgRaw = getComputedStyle(root).getPropertyValue('--bg-primary').trim();
  const bgColor = bgRaw || '#0a0e14';

  // Clone the container and inline all computed styles so the SVG is self-contained
  const clone = container.cloneNode(true) as HTMLElement;
  inlineComputedStyles(container, clone);

  // Build SVG with foreignObject embedding the full dashboard HTML
  const ns = 'http://www.w3.org/2000/svg';
  const xhtmlNs = 'http://www.w3.org/1999/xhtml';

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // Background rect
  const bgRect = document.createElementNS(ns, 'rect');
  bgRect.setAttribute('width', '100%');
  bgRect.setAttribute('height', '100%');
  bgRect.setAttribute('fill', bgColor);
  svg.appendChild(bgRect);

  // Embed a system font fallback so SVGs render with a clean sans-serif
  // (Next.js font-optimized names like __Inter_aabb won't exist outside the app)
  // Also ensure no-wrap on metric change indicators to prevent overflow
  const svgStyle = document.createElementNS(ns, 'style');
  svgStyle.textContent = `
    foreignObject * {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
  `;
  svg.appendChild(svgStyle);

  // Also try to extract native Recharts SVGs and render them directly for vector quality
  const chartSvgs = Array.from(
    container.querySelectorAll('.recharts-wrapper > .recharts-surface')
  ) as SVGSVGElement[];

  const cloneChartSvgs = Array.from(
    clone.querySelectorAll('.recharts-wrapper > .recharts-surface')
  ) as SVGSVGElement[];

  // Replace Recharts SVGs in the clone with placeholders (we'll render them natively)
  const chartPositions: Array<{ x: number; y: number; w: number; h: number; svg: SVGSVGElement }> = [];
  chartSvgs.forEach((origSvg, i) => {
    const svgRect = origSvg.getBoundingClientRect();
    const relX = svgRect.left - rect.left;
    const relY = svgRect.top - rect.top;
    const w = svgRect.width;
    const h = svgRect.height;
    if (w > 50 && h > 50) {
      chartPositions.push({ x: relX, y: relY, w, h, svg: origSvg });
      // Hide the Recharts SVG in the foreignObject clone so it doesn't render twice
      if (cloneChartSvgs[i]) {
        (cloneChartSvgs[i] as SVGSVGElement).style.visibility = 'hidden';
      }
    }
  });

  // ForeignObject — full dashboard HTML
  const fo = document.createElementNS(ns, 'foreignObject');
  fo.setAttribute('width', String(width));
  fo.setAttribute('height', String(height));
  fo.setAttribute('x', '0');
  fo.setAttribute('y', '0');
  clone.setAttribute('xmlns', xhtmlNs);
  clone.style.width = width + 'px';
  clone.style.height = height + 'px';
  clone.style.overflow = 'hidden';
  fo.appendChild(clone);
  svg.appendChild(fo);

  // Overlay native chart SVGs for vector rendering
  chartPositions.forEach(({ x, y, w, h, svg: origSvg }) => {
    const chartClone = origSvg.cloneNode(true) as SVGSVGElement;
    // Inline styles for standalone rendering
    const origEls = origSvg.querySelectorAll('*');
    const cloneEls = chartClone.querySelectorAll('*');
    cloneEls.forEach((el, j) => {
      if (origEls[j]) {
        const computed = getComputedStyle(origEls[j]);
        ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-family', 'font-weight', 'opacity', 'text-anchor', 'dominant-baseline', 'color'].forEach(prop => {
          let val = computed.getPropertyValue(prop);
          if (!val) return;
          // Normalize Next.js obfuscated font names
          if (prop === 'font-family' && val.includes('__Inter')) {
            val = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
          }
          (el as SVGElement).style.setProperty(prop, val);
        });
      }
    });

    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `translate(${x}, ${y})`);
    chartClone.setAttribute('width', String(w));
    chartClone.setAttribute('height', String(h));
    // Move children from chartClone into the group
    while (chartClone.firstChild) {
      g.appendChild(chartClone.firstChild);
    }
    svg.appendChild(g);
  });

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, `${filename}.svg`);
}

/** Walk original + cloned DOM trees in parallel, inlining computed styles onto the clone */
function inlineComputedStyles(original: HTMLElement, clone: HTMLElement): void {
  const origEls = original.querySelectorAll('*');
  const cloneEls = clone.querySelectorAll('*');

  // Inline on the root element too
  inlineElementStyles(original, clone);

  origEls.forEach((origEl, i) => {
    if (!cloneEls[i]) return;
    inlineElementStyles(origEl as HTMLElement, cloneEls[i] as HTMLElement);
  });
}

function inlineElementStyles(orig: HTMLElement, clone: HTMLElement): void {
  try {
    const cs = getComputedStyle(orig);
    // Comprehensive visual properties to inline for SVG foreignObject fidelity
    const props = [
      'color', 'background-color', 'background-image', 'background',
      'border', 'border-color', 'border-radius', 'border-width', 'border-style',
      'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color',
      'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
      'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
      'text-align', 'text-decoration', 'text-transform', 'text-overflow', 'white-space',
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'display', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink',
      'align-items', 'justify-content', 'gap', 'row-gap', 'column-gap',
      'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
      'overflow', 'overflow-x', 'overflow-y', 'opacity', 'box-shadow', 'outline',
      'position', 'top', 'left', 'right', 'bottom', 'z-index',
      'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
      'grid-gap', 'grid-auto-flow', 'grid-auto-rows', 'grid-auto-columns',
      'transform', 'visibility', 'vertical-align', 'box-sizing',
      'border-collapse', 'table-layout', 'word-break', 'overflow-wrap',
    ];
    props.forEach(prop => {
      let val = cs.getPropertyValue(prop);
      if (val && val !== 'none' && val !== 'normal' && val !== '0px' && val !== 'auto' && val !== 'rgba(0, 0, 0, 0)') {
        // Normalize Next.js obfuscated font names back to Inter
        if (prop === 'font-family' && val.includes('__Inter')) {
          val = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        }
        clone.style.setProperty(prop, val);
      }
    });
  } catch {
    // Skip elements that can't be styled
  }
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
