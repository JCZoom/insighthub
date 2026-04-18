'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, Clock, Users, Star, Trash2, ExternalLink, Pencil, Copy, Share2 } from 'lucide-react';
import { relativeTime } from '@/lib/utils';

export interface DashboardCardData {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  ownerName: string;
  updatedAt: Date;
  widgetCount: number;
  isTemplate?: boolean;
  isPublic?: boolean;
  isFavorite?: boolean;
}

interface DashboardCardProps {
  dashboard: DashboardCardData;
  onToggleFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, currentTitle: string) => void;
  onDuplicate?: (id: string) => void;
}

interface CtxMenu {
  x: number;
  y: number;
}

export function DashboardCard({ dashboard, onToggleFavorite, onDelete, onRename, onDuplicate }: DashboardCardProps) {
  const router = useRouter();
  const [timeLabel, setTimeLabel] = useState('');
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeLabel(relativeTime(dashboard.updatedAt));
  }, [dashboard.updatedAt]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(dashboard.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(dashboard.id);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const ctxAction = (fn: () => void) => {
    setCtxMenu(null);
    fn();
  };

  const isOwned = !dashboard.isTemplate;

  return (
    <>
      <Link
        href={`/dashboard/${dashboard.id}`}
        className="block group"
        onContextMenu={handleContextMenu}
      >
        <div className="card p-0 overflow-hidden h-full flex flex-col">
          {/* Thumbnail placeholder */}
          <div className="h-28 bg-gradient-to-br from-accent-blue/10 via-accent-purple/5 to-accent-cyan/10 flex items-center justify-center relative shrink-0">
            <BarChart3 size={32} className="text-accent-blue/30" />
            {/* Favorite button */}
            <button
              onClick={handleFavoriteClick}
              className="absolute top-2 right-2 p-1 rounded-md hover:bg-black/10 transition-colors"
              title={dashboard.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                size={14}
                className={
                  dashboard.isFavorite
                    ? 'text-accent-amber fill-accent-amber'
                    : 'text-[var(--text-muted)] hover:text-accent-amber'
                }
              />
            </button>
            {/* Delete button — visible on hover, only for owned dashboards */}
            {isOwned && onDelete && (
              <button
                onClick={handleDeleteClick}
                className="absolute top-2 right-8 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent-red/20 transition-all"
                title="Delete dashboard"
              >
                <Trash2 size={14} className="text-[var(--text-muted)] hover:text-accent-red transition-colors" />
              </button>
            )}
            {dashboard.isTemplate && (
              <span className="absolute top-2 left-2 pill pill-purple text-[10px]">Template</span>
            )}
          </div>

          {/* Content — flex-1 so all cards have equal height */}
          <div className="p-3 flex flex-col flex-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-accent-blue transition-colors line-clamp-1 mb-1">
              {dashboard.title}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2 min-h-[2rem]">
              {dashboard.description || 'No description'}
            </p>
            <div className="mt-auto">
              <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {timeLabel}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={10} />
                  {dashboard.ownerName}
                </span>
                <span>{dashboard.widgetCount} widgets</span>
              </div>
              {dashboard.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {dashboard.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-card-hover)] text-[var(--text-muted)]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]/95 backdrop-blur-md shadow-lg"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            onClick={() => ctxAction(() => router.push(`/dashboard/${dashboard.id}`))}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <ExternalLink size={12} /> Open
          </button>
          {isOwned && onRename && (
            <button
              onClick={() => ctxAction(() => onRename(dashboard.id, dashboard.title))}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <Pencil size={12} /> Rename
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={() => ctxAction(() => onDuplicate(dashboard.id))}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <Copy size={12} /> Duplicate
            </button>
          )}
          <button
            onClick={() => ctxAction(() => onToggleFavorite?.(dashboard.id))}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <Star size={12} /> {dashboard.isFavorite ? 'Unfavorite' : 'Favorite'}
          </button>
          <button
            onClick={() => ctxAction(() => navigator.clipboard.writeText(`${window.location.origin}/dashboard/${dashboard.id}`))}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <Share2 size={12} /> Copy link
          </button>
          {isOwned && onDelete && (
            <>
              <div className="my-1 border-t border-[var(--border-color)]" />
              <button
                onClick={() => ctxAction(() => onDelete(dashboard.id))}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-accent-red hover:bg-accent-red/10 transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
