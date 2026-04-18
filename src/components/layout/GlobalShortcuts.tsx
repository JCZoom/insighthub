'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { GlobalShortcutOverlay } from './GlobalShortcutOverlay';

export function GlobalShortcuts({ children }: { children: React.ReactNode }) {
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept when typing in an input/textarea/contenteditable
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // ? (Shift+/) — toggle shortcut help (works even in inputs for discoverability)
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Only trigger if not in an input (except when it's just ?)
      if (!isInput) {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }
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
  }, [router, pathname]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {children}
      {showHelp && <GlobalShortcutOverlay onClose={() => setShowHelp(false)} />}
    </>
  );
}
