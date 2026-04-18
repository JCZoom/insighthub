'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, Home, MessageCircle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileTabBarProps {
  /** Current phone mode for dashboard pages */
  phoneMode?: 'canvas' | 'chat';
  /** Callback to change phone mode */
  onPhoneModeChange?: (mode: 'canvas' | 'chat') => void;
  /** Whether this is a dashboard editor page */
  isDashboardEditor?: boolean;
}

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
  { href: '/glossary', label: 'Glossary', icon: BookOpen },
];

export function MobileTabBar({ phoneMode, onPhoneModeChange, isDashboardEditor }: MobileTabBarProps) {
  const pathname = usePathname();

  // If this is a dashboard editor, show Canvas/Chat toggle instead of regular navigation
  if (isDashboardEditor && onPhoneModeChange) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
        {/* Safe area padding for devices with home indicator */}
        <div className="px-4 py-2 pb-safe">
          <div className="flex gap-2">
            <button
              onClick={() => onPhoneModeChange('canvas')}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 px-4 rounded-lg text-xs font-medium transition-colors min-h-[44px]',
                phoneMode === 'canvas'
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
              )}
            >
              <BarChart3 size={18} />
              Canvas
            </button>
            <button
              onClick={() => onPhoneModeChange('chat')}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 px-4 rounded-lg text-xs font-medium transition-colors min-h-[44px]',
                phoneMode === 'chat'
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
              )}
            >
              <MessageCircle size={18} />
              Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Regular navigation for non-dashboard pages
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
      {/* Safe area padding for devices with home indicator */}
      <div className="px-2 py-1 pb-safe">
        <div className="flex">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-lg text-xs font-medium transition-colors min-h-[44px] min-w-0',
                  isActive
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                )}
              >
                <item.icon size={18} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}