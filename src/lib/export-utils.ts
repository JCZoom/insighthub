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

    // html2canvas cannot parse oklab()/oklch() color functions used by Tailwind v4.
    // Convert all computed colors to rgb() before cloning.
    function resolveToRgb(value: string): string {
      if (!value || (!value.includes('oklab') && !value.includes('oklch') && !value.includes('color('))) return value;
      // Use a temp element to let the browser resolve the color
      const temp = document.createElement('div');
      temp.style.color = value;
      temp.style.display = 'none';
      document.body.appendChild(temp);
      const resolved = getComputedStyle(temp).color; // always returns rgb()/rgba()
      document.body.removeChild(temp);
      return resolved || value;
    }

    // Strip modern CSS color functions from a CSS text block so html2canvas's parser doesn't choke.
    // Replaces oklab(), oklch(), color-mix(), color() with rgba(0,0,0,0). The real colors
    // are inlined on each element in the onclone walk below, so this is safe.
    function neutralizeModernColors(css: string): string {
      const fns = ['color-mix', 'oklab', 'oklch'];
      for (const fn of fns) {
        let result = '';
        let searchFrom = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const idx = css.indexOf(fn + '(', searchFrom);
          if (idx === -1) { result += css.slice(searchFrom); break; }
          result += css.slice(searchFrom, idx) + 'rgba(0,0,0,0)';
          // Skip past balanced parentheses
          let depth = 0;
          let j = idx + fn.length;
          for (; j < css.length; j++) {
            if (css[j] === '(') depth++;
            if (css[j] === ')') { depth--; if (depth === 0) { j++; break; } }
          }
          searchFrom = j;
        }
        css = result;
      }
      // Also handle standalone color() function (e.g. color(display-p3 ...))
      // but avoid matching 'background-color' or 'border-color' property names.
      css = css.replace(/(?<![\w-])color\([^)]+\)/g, 'rgba(0,0,0,0)');
      return css;
    }

    // Resolve the bgColor in case it's an oklab value
    const resolvedBg = resolveToRgb(bgColor);

    const canvas = await html2canvas(element, {
      backgroundColor: resolvedBg,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      removeContainer: true,
      onclone: (clonedDoc: Document) => {
        const clonedRoot = clonedDoc.documentElement;

        // --- Step 1: Neutralize modern color functions in all <style> tags ---
        clonedDoc.querySelectorAll('style').forEach(style => {
          const text = style.textContent || '';
          if (text.includes('oklab') || text.includes('oklch') || text.includes('color-mix') || text.includes('color(')) {
            style.textContent = neutralizeModernColors(text);
          }
        });

        // Remove <link> stylesheets that may also contain oklab —
        // computed styles are inlined on elements below so they're not needed.
        clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
          link.remove();
        });

        // --- Step 2: Copy CSS custom properties, resolving oklab→rgb ---
        Object.entries(cssVars).forEach(([key, val]) => {
          clonedRoot.style.setProperty(key, resolveToRgb(val));
        });
        clonedDoc.body.style.setProperty('background-color', resolvedBg);

        // --- Step 3: Inline all color-related computed styles on every element ---
        clonedDoc.querySelectorAll('*').forEach(node => {
          const el = node as HTMLElement;
          const cs = clonedDoc.defaultView?.getComputedStyle(el);
          if (!cs) return;
          // Fix color, background-color, border-color
          const colorProps = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'] as const;
          colorProps.forEach(prop => {
            const v = cs[prop as keyof CSSStyleDeclaration] as string;
            if (v && typeof v === 'string') {
              if (v.includes('oklab') || v.includes('oklch') || v.includes('color(')) {
                el.style[prop as 'color'] = resolveToRgb(v);
              } else {
                // Inline ALL color values so the cloned doc doesn't depend on external sheets
                el.style[prop as 'color'] = v;
              }
            }
          });
          // Strip backdrop-filter (unsupported by html2canvas)
          if (cs.backdropFilter && cs.backdropFilter !== 'none') {
            el.style.backdropFilter = 'none';
            el.style.setProperty('-webkit-backdrop-filter', 'none');
          }
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
          const val = computed.getPropertyValue(prop);
          if (val) (el as SVGElement).style.setProperty(prop, val);
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
    // Key visual properties to inline
    const props = [
      'color', 'background-color', 'background-image', 'background',
      'border', 'border-color', 'border-radius', 'border-width', 'border-style',
      'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
      'text-align', 'text-decoration', 'text-transform',
      'padding', 'margin', 'display', 'flex-direction', 'align-items', 'justify-content', 'gap',
      'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
      'overflow', 'opacity', 'box-shadow',
      'position', 'top', 'left', 'right', 'bottom',
      'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
    ];
    props.forEach(prop => {
      const val = cs.getPropertyValue(prop);
      if (val && val !== 'none' && val !== 'normal' && val !== '0px' && val !== 'auto' && val !== 'rgba(0, 0, 0, 0)') {
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
