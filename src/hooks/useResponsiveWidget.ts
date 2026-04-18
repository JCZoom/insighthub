'use client';

import { useEffect, useState, RefObject } from 'react';

export type WidgetSize = 'mobile' | 'tablet' | 'desktop';

interface ResponsiveConfig {
  size: WidgetSize;
  width: number;
  height: number;
  // Chart-specific configurations
  showAxis: boolean;
  showLegend: boolean;
  showLabels: boolean;
  fontSize: number;
  tickCount: number;
  margin: { top: number; right: number; bottom: number; left: number };
  // Touch-specific
  isTouchDevice: boolean;
}

/**
 * Hook to detect widget container size and provide responsive configurations
 */
export function useResponsiveWidget(containerRef: RefObject<HTMLElement | null>): ResponsiveConfig {
  const [config, setConfig] = useState<ResponsiveConfig>({
    size: 'desktop',
    width: 400,
    height: 300,
    showAxis: true,
    showLegend: true,
    showLabels: true,
    fontSize: 11,
    tickCount: 5,
    margin: { top: 10, right: 20, bottom: 20, left: 20 },
    isTouchDevice: false,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const updateConfig = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      let size: WidgetSize;
      let showAxis = true;
      let showLegend = true;
      let showLabels = true;
      let fontSize = 11;
      let tickCount = 5;
      let margin = { top: 10, right: 20, bottom: 20, left: 20 };

      // Determine size breakpoints based on actual container dimensions
      if (width < 200 || height < 150) {
        size = 'mobile';
        showAxis = false;
        showLegend = false;
        showLabels = false;
        fontSize = 9;
        tickCount = 3;
        margin = { top: 5, right: 5, bottom: 5, left: 5 };
      } else if (width < 400 || height < 250) {
        size = 'tablet';
        showAxis = true;
        showLegend = height > 200;
        showLabels = true;
        fontSize = 10;
        tickCount = 4;
        margin = { top: 8, right: 15, bottom: 15, left: 15 };
      } else {
        size = 'desktop';
        showAxis = true;
        showLegend = true;
        showLabels = true;
        fontSize = 11;
        tickCount = 5;
        margin = { top: 10, right: 20, bottom: 20, left: 20 };
      }

      setConfig({
        size,
        width,
        height,
        showAxis,
        showLegend,
        showLabels,
        fontSize,
        tickCount,
        margin,
        isTouchDevice,
      });
    };

    // Use ResizeObserver for accurate container size tracking
    const resizeObserver = new ResizeObserver(updateConfig);
    resizeObserver.observe(container);

    // Initial call
    updateConfig();

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  return config;
}