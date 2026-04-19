'use client';

import { useEffect, useState, useCallback } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('insighthub-theme');
    const prefersDark = saved ? saved !== 'light' : true;
    setIsDark(prefersDark);
    if (prefersDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        localStorage.setItem('insighthub-theme', 'dark');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
        localStorage.setItem('insighthub-theme', 'light');
      }
      return next;
    });
  }, []);

  // Prevent hydration mismatch — render nothing meaningful until mounted
  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] transition-colors"
        aria-label="Toggle theme"
      >
        <Sun size={16} className="text-[var(--text-secondary)] opacity-0" />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] transition-colors"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun size={16} className="text-[var(--text-secondary)]" /> : <Moon size={16} className="text-[var(--text-secondary)]" />}
    </button>
  );
}
