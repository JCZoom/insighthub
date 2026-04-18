'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { GlobalShortcutOverlay } from './GlobalShortcutOverlay';
import { CommandPalette } from './CommandPalette';

export function GlobalShortcuts({ children }: { children: React.ReactNode }) {
  const [showHelp, setShowHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const gPrefixRef = useRef(false);
  const gPrefixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept when typing in an input/textarea/contenteditable
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // Escape key hierarchy: overlays → modals → panels → selection → input blur
    if (e.key === 'Escape') {
      // 1. Close command palette
      if (showCommandPalette) { setShowCommandPalette(false); return; }
      // 2. Close shortcut overlay
      if (showHelp) { setShowHelp(false); return; }
      // 3. Blur active input/textarea
      if (isInput) { (target as HTMLElement).blur(); return; }
      // Let remaining Escape handling propagate to page-level components
      return;
    }

    // ? (Shift+/) — toggle shortcut help (works even in inputs for discoverability)
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (!isInput) {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }
    }

    // g-prefix "Go To" navigation (g then h/d/g/n/a within 500ms)
    if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      if (gPrefixRef.current) {
        gPrefixRef.current = false;
        if (gPrefixTimerRef.current) { clearTimeout(gPrefixTimerRef.current); gPrefixTimerRef.current = null; }
        const goToRoutes: Record<string, string> = {
          h: '/',
          d: '/dashboards',
          g: '/glossary',
          n: '/dashboard/new',
          a: '/about',
        };
        const route = goToRoutes[e.key];
        if (route) {
          e.preventDefault();
          if (pathname !== route) router.push(route);
          return;
        }
      }
      if (e.key === 'g') {
        gPrefixRef.current = true;
        if (gPrefixTimerRef.current) clearTimeout(gPrefixTimerRef.current);
        gPrefixTimerRef.current = setTimeout(() => { gPrefixRef.current = false; }, 500);
        return;
      }
    }

    // ⌘K — toggle command palette
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setShowCommandPalette(prev => !prev);
      return;
    }

    // ⌘+1 through ⌘+4 — navigation (always active)
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      const routes: Record<string, string> = {
        '1': '/',
        '2': '/dashboards',
        '3': '/glossary',
        '4': '/about',
        '5': '/dashboard/new',
      };
      if (routes[e.key]) {
        e.preventDefault();
        if (pathname !== routes[e.key]) {
          router.push(routes[e.key]);
        }
        return;
      }
    }

    // ⌘F / Ctrl+F — focus in-page search if one exists (otherwise let browser handle it)
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
      const searchEl = document.querySelector('input[placeholder*="search" i], input[placeholder*="Search" i], input[type="search"]') as HTMLElement | null;
      if (searchEl) {
        e.preventDefault();
        searchEl.focus();
        return;
      }
      // No in-page search — let browser native find open
    }

    // / — focus search/prompt input (skip if already in input)
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !isInput) {
      e.preventDefault();
      // Try common input selectors used across pages
      const selectors = [
        'textarea[placeholder]',         // Home prompt, chat input
        'input[type="search"]',           // Gallery search
        'input[placeholder*="search" i]', // Gallery search fallback
        'input[placeholder*="Search" i]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) {
          el.focus();
          return;
        }
      }
    }
  }, [router, pathname, showCommandPalette, showHelp]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {children}
      {showHelp && <GlobalShortcutOverlay onClose={() => setShowHelp(false)} />}
      {showCommandPalette && <CommandPalette onClose={() => setShowCommandPalette(false)} />}
    </>
  );
}
