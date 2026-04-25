'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Users, Star, Trash2, ExternalLink, Pencil, Copy, Share2, UserPlus, Globe, Lock, FolderInput, FolderPlus, Link2, FolderMinus } from 'lucide-react';
import { relativeTime } from '@/lib/utils';
import { DashboardThumbnail } from './DashboardThumbnail';
import { ShareModal } from './ShareModal';
import { Tooltip } from '@/components/ui/Tooltip';

export interface DashboardCardData {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  ownerId?: string;
  ownerName: string;
  updatedAt: Date;
  widgetCount: number;
  isTemplate?: boolean;
  isPublic?: boolean;
  isShared?: boolean;
  isFavorite?: boolean;
  folderId?: string | null;
  folder?: {
    id: string;
    name: string;
  } | null;
  // IDs of folders this dashboard is aliased into (in addition to its primary folderId).
  aliasFolderIds?: string[];
}

interface DashboardCardProps {
  dashboard: DashboardCardData;
  viewMode?: 'grid' | 'list';
  isSelected?: boolean;
  // The folder the user is currently viewing in the gallery. Used to decide whether
  // this card is being displayed as an alias (i.e. the card's primary folder differs
  // from the folder being viewed). Null means "All Dashboards / root".
  viewingFolderId?: string | null;
  onToggleFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, currentTitle: string) => void;
  onDuplicate?: (id: string) => void;
  onShare?: (id: string, title: string) => void;
  onTogglePublic?: (id: string, isPublic: boolean) => void;
  // Folder-management callbacks. All three operate on dashboard.id.
  onMoveToFolder?: (id: string) => void;
  onAddToFolders?: (id: string) => void;
  onRemoveAlias?: (dashboardId: string, folderId: string) => void;
}

interface CtxMenu {
  x: number;
  y: number;
}

export function DashboardCard({ dashboard, viewMode = 'grid', isSelected, viewingFolderId, onToggleFavorite, onDelete, onRename, onDuplicate, onShare, onTogglePublic, onMoveToFolder, onAddToFolders, onRemoveAlias }: DashboardCardProps) {
  void onShare; // reserved for future inline-share action; referenced to keep the prop public
  const router = useRouter();
  const [timeLabel, setTimeLabel] = useState('');
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
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

  // Are we viewing this dashboard from a folder it's aliased into (not its primary home)?
  // When true, we show a small "alias" overlay on the thumbnail and expose the
  // "Remove from this folder" menu item. This keeps the mental model clear:
  // aliases are shortcuts, not copies.
  const aliasFolderIds = dashboard.aliasFolderIds ?? [];
  const isViewingAlias =
    viewingFolderId != null &&
    viewingFolderId !== (dashboard.folderId ?? null) &&
    aliasFolderIds.includes(viewingFolderId);
  const aliasCount = aliasFolderIds.length;

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/dashboard-id', dashboard.id);
    e.dataTransfer.effectAllowed = 'move';
    // Give the browser a richer drag preview — the default thumbnail is usually
    // a blurry screenshot of the full card. Using the card itself keeps the
    // visual context tight.
    const target = e.currentTarget as HTMLElement;
    if (target && typeof e.dataTransfer.setDragImage === 'function') {
      e.dataTransfer.setDragImage(target, 20, 20);
    }
  }, [dashboard.id]);

  const listRow = (
    <Link
      href={`/dashboard/${dashboard.id}`}
      className={`block group ${isSelected ? 'ring-2 ring-accent-blue rounded-xl' : ''}`}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={handleDragStart}
    >
      <div className="card p-0 overflow-hidden flex items-center gap-4 px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-accent-blue transition-colors truncate min-w-0 flex-1">
          {dashboard.isTemplate && (
            <span className="pill pill-purple text-[9px] mr-2 align-middle">Template</span>
          )}
          {isViewingAlias && (
            <Tooltip
              content={`Shortcut — lives in ${dashboard.folder?.name ?? 'root'}`}
              side="top"
            >
              <span className="inline-flex items-center mr-2 align-middle text-accent-purple">
                <Link2 size={11} />
              </span>
            </Tooltip>
          )}
          {dashboard.title}
        </h3>
        <p className="hidden md:block text-xs text-[var(--text-secondary)] truncate max-w-[260px]">
          {dashboard.description || 'No description'}
        </p>
        <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] shrink-0">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {timeLabel}
          </span>
          <span className="hidden sm:flex items-center gap-1">
            <Users size={10} />
            {dashboard.ownerName}
          </span>
          <span>{dashboard.widgetCount} widgets</span>
        </div>
        {dashboard.tags.length > 0 && (
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            {dashboard.tags.slice(0, 2).map(tag => (
              <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-card-hover)] text-[var(--text-muted)]">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip content={dashboard.isFavorite ? 'Remove from favorites' : 'Add to favorites'} side="top">
            <button
              onClick={handleFavoriteClick}
              tabIndex={-1}
              className="p-1 rounded-md hover:bg-black/10 transition-colors"
            >
              <Star
                size={13}
                className={
                  dashboard.isFavorite
                    ? 'text-accent-amber fill-accent-amber'
                    : 'text-[var(--text-muted)] hover:text-accent-amber'
                }
              />
            </button>
          </Tooltip>
          {isOwned && onDelete && (
            <Tooltip content="Delete dashboard" side="top">
              <button
                onClick={handleDeleteClick}
                tabIndex={-1}
                className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent-red/20 transition-all"
              >
                <Trash2 size={13} className="text-[var(--text-muted)] hover:text-accent-red transition-colors" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </Link>
  );

  const gridCard = (
    <Link
      href={`/dashboard/${dashboard.id}`}
      className={`block group ${isSelected ? 'ring-2 ring-accent-blue rounded-xl' : ''}`}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={handleDragStart}
    >
      <div className="card p-0 overflow-hidden h-full flex flex-col">
        {/* Dashboard thumbnail */}
        <div className="h-28 bg-gradient-to-br from-accent-blue/10 via-accent-purple/5 to-accent-cyan/10 flex items-center justify-center relative shrink-0">
          <DashboardThumbnail
            dashboardId={dashboard.id}
            title={dashboard.title}
            widgetCount={dashboard.widgetCount}
            isTemplate={dashboard.isTemplate}
            className="absolute inset-0"
          />
          {/* Alias overlay badge — only when viewing this card from a folder it's
              aliased into (i.e. this is a shortcut, not its primary home). */}
          {isViewingAlias && (
            <Tooltip
              content={`Shortcut — primary folder: ${dashboard.folder?.name ?? 'root'}`}
              side="right"
            >
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--bg-card)]/85 backdrop-blur-sm border border-accent-purple/30 text-accent-purple shadow-sm">
                <Link2 size={10} />
                <span className="text-[9px] font-medium uppercase tracking-wide">Alias</span>
              </div>
            </Tooltip>
          )}
          {/* Favorite button */}
          <Tooltip content={dashboard.isFavorite ? 'Remove from favorites' : 'Add to favorites'} side="left">
          <button
            onClick={handleFavoriteClick}
            tabIndex={-1}
            className="absolute top-2 right-2 p-1 rounded-md hover:bg-black/10 transition-colors z-10"
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
          </Tooltip>
          {/* Delete button — visible on hover, only for owned dashboards */}
          {isOwned && onDelete && (
            <Tooltip content="Delete dashboard" side="left">
            <button
              onClick={handleDeleteClick}
              tabIndex={-1}
              className="absolute top-2 right-8 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent-red/20 transition-all z-10"
            >
              <Trash2 size={14} className="text-[var(--text-muted)] hover:text-accent-red transition-colors" />
            </button>
            </Tooltip>
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
  );

  const contextMenuEl = ctxMenu && (
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

      {/* Folder actions. Only available for owned dashboards — templates/shared items live in
          read-only conceptual space and aren't moved around the user's personal folder tree. */}
      {isOwned && (onMoveToFolder || onAddToFolders || (isViewingAlias && onRemoveAlias)) && (
        <div className="my-1 border-t border-[var(--border-color)]" />
      )}
      {isOwned && onMoveToFolder && (
        <button
          onClick={() => ctxAction(() => onMoveToFolder(dashboard.id))}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          <FolderInput size={12} /> Move to folder…
        </button>
      )}
      {isOwned && onAddToFolders && (
        <button
          onClick={() => ctxAction(() => onAddToFolders(dashboard.id))}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          <FolderPlus size={12} /> Add to folder…
          {aliasCount > 0 && (
            <span className="ml-auto text-[10px] text-[var(--text-muted)] tabular-nums">
              in {aliasCount + 1} folders
            </span>
          )}
        </button>
      )}
      {isOwned && isViewingAlias && onRemoveAlias && viewingFolderId && (
        <button
          onClick={() => ctxAction(() => onRemoveAlias(dashboard.id, viewingFolderId))}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          <FolderMinus size={12} /> Remove from this folder
        </button>
      )}

      <div className="my-1 border-t border-[var(--border-color)]" />
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
      {isOwned && (
        <button
          onClick={() => ctxAction(() => setShowShareModal(true))}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          <UserPlus size={12} /> Share with users
        </button>
      )}
      {isOwned && onTogglePublic && (
        <button
          onClick={() => ctxAction(() => onTogglePublic(dashboard.id, !dashboard.isPublic))}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          {dashboard.isPublic ? (
            <>
              <Lock size={12} /> Unpublish from gallery
            </>
          ) : (
            <>
              <Globe size={12} /> Publish to gallery
            </>
          )}
        </button>
      )}
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
  );

  return (
    <>
      {viewMode === 'list' ? listRow : gridCard}
      {contextMenuEl}
      {showShareModal && (
        <ShareModal
          dashboardId={dashboard.id}
          dashboardTitle={dashboard.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  );
}
