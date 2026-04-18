'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, Sparkles, Plus, Home, Settings, LogOut, User, Keyboard, Info, Menu, X } from 'lucide-react';
import { GlobalShortcutOverlay } from './GlobalShortcutOverlay';
import { ThemeToggle } from './ThemeToggle';
import { useViewport } from '@/hooks/useViewport';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
  { href: '/glossary', label: 'Glossary', icon: BookOpen },
  { href: '/about', label: 'About', icon: Info },
];

export function Navbar() {
  const pathname = usePathname();
  const isSubPage = pathname !== '/';
  const viewport = useViewport();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Hide navbar on mobile when bottom nav is active
  if (viewport.isMobileNav) {
    return null;
  }

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);

  // Close mobile menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mobileMenuOpen]);

  return (
    <>
    <nav className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
      <div className="px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Logo + nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-accent-blue font-bold text-lg tracking-tight">
              <Sparkles size={20} />
              <span>InsightHub</span>
            </Link>

            <div className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-accent-blue/10 text-accent-blue'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                  )}
                >
                  <item.icon size={15} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile hamburger menu */}
            <div ref={mobileMenuRef} className="relative sm:hidden">
              <button
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className="p-3 rounded-lg hover:bg-[var(--bg-card)] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Menu"
              >
                {mobileMenuOpen ? (
                  <X size={16} className="text-[var(--text-primary)]" />
                ) : (
                  <Menu size={16} className="text-[var(--text-primary)]" />
                )}
              </button>
              {mobileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg shadow-black/10 py-1.5 fade-in z-50">
                  {NAV_ITEMS.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                        pathname === item.href
                          ? 'bg-accent-blue/10 text-accent-blue'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]'
                      )}
                    >
                      <item.icon size={15} />
                      {item.label}
                    </Link>
                  ))}
                  {isSubPage && (
                    <Link
                      href="/"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors border-t border-[var(--border-color)] mt-1 pt-2"
                      title="Back to Home (g h)"
                    >
                      <Home size={15} />
                      Home
                    </Link>
                  )}
                </div>
              )}
            </div>

            {isSubPage && (
              <Link
                href="/"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                title="Back to Home (g h)"
              >
                <Home size={15} />
                <span className="hidden sm:inline">Home</span>
              </Link>
            )}
            <Link
              href="/dashboard/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 transition-colors min-h-[44px]"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New Dashboard</span>
            </Link>
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-3 rounded-lg hover:bg-[var(--bg-card)] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Keyboard shortcuts (?) • ⌘K palette"
            >
              <Keyboard size={14} className="text-[var(--text-muted)]" />
            </button>
            <ThemeToggle />
            {/* Profile bubble with dropdown */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(prev => !prev)}
                className="w-11 h-11 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center text-xs font-bold hover:ring-2 hover:ring-accent-purple/30 transition-all cursor-pointer"
              >
                JC
              </button>
              {profileOpen && (
                <div className="absolute right-0 sm:right-0 -right-4 top-full mt-2 w-48 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg shadow-black/10 py-1.5 fade-in z-50">
                  <div className="px-3 py-2 border-b border-[var(--border-color)]">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Jeffrey Coy</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Admin</p>
                  </div>
                  <Link
                    href="#"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors"
                    onClick={() => setProfileOpen(false)}
                  >
                    <User size={14} />
                    Profile
                  </Link>
                  <Link
                    href="#"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Settings size={14} />
                    Settings
                  </Link>
                  <div className="border-t border-[var(--border-color)] mt-1 pt-1">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                      onClick={() => setProfileOpen(false)}
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
    {showShortcuts && <GlobalShortcutOverlay onClose={() => setShowShortcuts(false)} />}
    </>
  );
}
