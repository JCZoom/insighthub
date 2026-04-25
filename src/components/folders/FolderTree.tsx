'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, Plus, Edit2, Trash2, Move, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  children?: FolderNode[];
  dashboards?: Array<{
    id: string;
    title: string;
    isTemplate?: boolean;
  }>;
  sortOrder?: number;
  createdAt?: string | Date;
  _count?: {
    children: number;
    dashboards: number;
  };
}

export type FolderSortMode = 'manual' | 'az' | 'za' | 'newest' | 'oldest';

// Produce a new array of siblings sorted according to the given mode. The API
// returns folders in sortOrder+name order already, but we re-sort client-side
// so manual/A-Z/Newest toggles are instant (no refetch).
export function sortFolderNodes(nodes: FolderNode[], mode: FolderSortMode): FolderNode[] {
  const cloned = nodes.map((n) => ({
    ...n,
    children: n.children ? sortFolderNodes(n.children, mode) : n.children,
  }));
  const nameCmp = (a: FolderNode, b: FolderNode) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const timeOf = (n: FolderNode) => {
    if (!n.createdAt) return 0;
    return typeof n.createdAt === 'string'
      ? new Date(n.createdAt).getTime()
      : n.createdAt.getTime();
  };
  switch (mode) {
    case 'az':
      cloned.sort(nameCmp);
      break;
    case 'za':
      cloned.sort((a, b) => nameCmp(b, a));
      break;
    case 'newest':
      cloned.sort((a, b) => timeOf(b) - timeOf(a) || nameCmp(a, b));
      break;
    case 'oldest':
      cloned.sort((a, b) => timeOf(a) - timeOf(b) || nameCmp(a, b));
      break;
    case 'manual':
    default:
      cloned.sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || nameCmp(a, b)
      );
      break;
  }
  return cloned;
}

interface FolderTreeProps {
  folders: FolderNode[];
  selectedFolderId?: string | null;
  onFolderSelect?: (folderId: string | null) => void;
  onCreateFolder?: (parentId?: string) => void;
  onRenameFolder?: (folderId: string, currentName: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onMoveDashboard?: (dashboardId: string, toFolderId: string | null) => void;
  showDashboards?: boolean;
  className?: string;
}

export function FolderTree({
  folders,
  selectedFolderId,
  onFolderSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveDashboard,
  showDashboards = true,
  className
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [prevFolderIds, setPrevFolderIds] = useState<Set<string>>(new Set());

  // Auto-expand parent folders when new subfolders are created
  useEffect(() => {
    const currentIds = new Set<string>();
    const collectIds = (nodes: FolderNode[]) => {
      for (const f of nodes) {
        currentIds.add(f.id);
        if (f.children) collectIds(f.children);
      }
    };
    collectIds(folders);

    // Find newly added folders and auto-expand their parents
    if (prevFolderIds.size > 0) {
      const newIds = [...currentIds].filter(id => !prevFolderIds.has(id));
      if (newIds.length > 0) {
        setExpandedFolders(prev => {
          const next = new Set(prev);
          for (const newId of newIds) {
            const parent = findParentOfFolder(folders, newId);
            if (parent) next.add(parent.id);
          }
          return next;
        });
      }
    }
    setPrevFolderIds(currentIds);
  }, [folders]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const expandFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      if (prev.has(folderId)) return prev;
      const next = new Set(prev);
      next.add(folderId);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, folderId });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Drag-and-drop handlers for moving dashboards into folders. A 600ms hover
  // timer auto-expands collapsed folders so users can drop into subfolders
  // they can't currently see — this is the Finder/Explorer behavior users
  // expect and removes a major friction point from the tree interaction.
  const expandTimerRef = useRef<{ id: string | null; timer: ReturnType<typeof setTimeout> } | null>(null);

  const cancelExpandTimer = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current.timer);
      expandTimerRef.current = null;
    }
  }, []);

  const scheduleExpand = useCallback((folderId: string) => {
    if (expandTimerRef.current?.id === folderId) return; // already scheduled
    cancelExpandTimer();
    const timer = setTimeout(() => {
      setExpandedFolders((prev) => {
        if (prev.has(folderId)) return prev;
        const next = new Set(prev);
        next.add(folderId);
        return next;
      });
      expandTimerRef.current = null;
    }, 600);
    expandTimerRef.current = { id: folderId, timer };
  }, [cancelExpandTimer]);

  const handleDragOver = useCallback((e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
    if (folderId && folderId !== '__root__') {
      scheduleExpand(folderId);
    }
  }, [scheduleExpand]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
    cancelExpandTimer();
  }, [cancelExpandTimer]);

  const handleDrop = useCallback((e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    cancelExpandTimer();
    const dashboardId = e.dataTransfer.getData('application/dashboard-id');
    if (dashboardId && onMoveDashboard) {
      onMoveDashboard(dashboardId, folderId);
    }
  }, [onMoveDashboard, cancelExpandTimer]);

  // Cleanup: cancel any pending expand timer if the tree unmounts
  useEffect(() => () => cancelExpandTimer(), [cancelExpandTimer]);

  const renderFolder = useCallback((folder: FolderNode, depth = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;
    const hasDashboards = folder.dashboards && folder.dashboards.length > 0;
    const hasExpandableContent = hasChildren || hasDashboards || (folder._count?.children || 0) > 0;
    const isDragOver = dragOverFolderId === folder.id;

    return (
      <div key={folder.id} className="select-none">
        <div
          className={cn(
            'flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer group transition-colors',
            isSelected && !isDragOver && 'bg-accent-blue/10 text-accent-blue',
            isDragOver && 'bg-accent-blue/20 ring-1 ring-accent-blue/50',
            !isSelected && !isDragOver && 'hover:bg-[var(--bg-card-hover)]'
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => {
            onFolderSelect?.(folder.id);
            if (hasExpandableContent) expandFolder(folder.id);
          }}
          onContextMenu={(e) => handleContextMenu(e, folder.id)}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id)}
        >
          {hasExpandableContent ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.id);
              }}
              className="p-0.5 hover:bg-[var(--bg-card)] rounded shrink-0"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-[var(--text-muted)]" />
              ) : (
                <ChevronRight size={14} className="text-[var(--text-muted)]" />
              )}
            </button>
          ) : (
            <div className="w-[18px] shrink-0" />
          )}

          {isExpanded ? (
            <FolderOpen size={16} className="text-accent-blue shrink-0" />
          ) : (
            <Folder size={16} className={cn('shrink-0', isSelected ? 'text-accent-blue' : 'text-[var(--text-muted)]')} />
          )}

          <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
            {folder.name}
          </span>

          {(folder._count?.children || 0) + (folder._count?.dashboards || 0) > 0 && (
            <span className="text-[10px] text-[var(--text-muted)] shrink-0 tabular-nums">
              {(folder._count?.children || 0) + (folder._count?.dashboards || 0)}
            </span>
          )}

          <Tooltip content="New subfolder" side="right">
            <button
              onClick={(e) => {
                e.stopPropagation();
                expandFolder(folder.id);
                onCreateFolder?.(folder.id);
              }}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-card)] rounded transition-opacity shrink-0"
            >
              <Plus size={12} className="text-[var(--text-muted)]" />
            </button>
          </Tooltip>
          <Tooltip content="Delete folder" side="right">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder?.(folder.id);
              }}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-accent-red/10 rounded transition-opacity shrink-0"
            >
              <Trash2 size={12} className="text-[var(--text-muted)] hover:text-accent-red" />
            </button>
          </Tooltip>
        </div>

        {/* Render children and dashboards when expanded */}
        {isExpanded && (
          <div className="relative">
            {/* Tree connector line */}
            <div
              className="absolute top-0 bottom-0 border-l border-[var(--border-color)]"
              style={{ left: `${16 + depth * 16}px` }}
            />

            {/* Subfolders */}
            {folder.children?.map(child => renderFolder(child, depth + 1))}

            {/* Dashboards */}
            {showDashboards && folder.dashboards?.map(dashboard => (
              <div
                key={dashboard.id}
                className="flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer group hover:bg-[var(--bg-card-hover)] transition-colors"
                style={{ paddingLeft: `${24 + (depth + 1) * 16}px` }}
                onClick={() => window.location.href = `/dashboard/${dashboard.id}`}
              >
                <div className="w-4 h-4 rounded bg-gradient-to-br from-accent-blue/10 to-accent-purple/10 border border-[var(--border-color)] shrink-0" />
                <span className="text-sm text-[var(--text-secondary)] truncate flex-1">
                  {dashboard.title}
                  {dashboard.isTemplate && (
                    <span className="ml-1 text-xs text-accent-purple">(Template)</span>
                  )}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveDashboard?.(dashboard.id, null);
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-card)] rounded transition-opacity"
                >
                  <Move size={12} className="text-[var(--text-muted)]" />
                </button>
              </div>
            ))}

          </div>
        )}
      </div>
    );
  }, [expandedFolders, selectedFolderId, onFolderSelect, onCreateFolder, onDeleteFolder, onMoveDashboard, handleContextMenu, showDashboards, toggleFolder, expandFolder, dragOverFolderId, handleDragOver, handleDragLeave, handleDrop]);

  const isRootDragOver = dragOverFolderId === '__root__';

  return (
    <div className={cn('space-y-0.5', className)}>
      {/* Root level — "All Dashboards" */}
      <div
        className={cn(
          'flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer group transition-colors',
          selectedFolderId === null && !isRootDragOver && 'bg-accent-blue/10 text-accent-blue',
          isRootDragOver && 'bg-accent-blue/20 ring-1 ring-accent-blue/50',
          selectedFolderId !== null && !isRootDragOver && 'hover:bg-[var(--bg-card-hover)]'
        )}
        onClick={() => onFolderSelect?.(null)}
        onDragOver={(e) => handleDragOver(e, '__root__')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        <div className="w-[18px] shrink-0" />
        <FolderOpen size={16} className="text-accent-blue shrink-0" />
        <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
          All Dashboards
        </span>
      </div>

      {/* Folder tree */}
      {folders.map(folder => renderFolder(folder))}

      {/* Add Folder button — always visible at bottom */}
      <div className="pt-3 mt-2 border-t border-[var(--border-color)]">
        <button
          onClick={() => onCreateFolder?.()}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-accent-blue hover:bg-accent-blue/5 transition-colors"
        >
          <FolderPlus size={15} />
          New Folder
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
          />
          <div
            className="fixed z-50 min-w-[160px] py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]/95 backdrop-blur-md shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                const folder = findFolderById(folders, contextMenu.folderId);
                if (folder) {
                  onRenameFolder?.(contextMenu.folderId, folder.name);
                }
                closeContextMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <Edit2 size={12} />
              Rename
            </button>
            <button
              onClick={() => {
                expandFolder(contextMenu.folderId);
                onCreateFolder?.(contextMenu.folderId);
                closeContextMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <Plus size={12} />
              New Subfolder
            </button>
            <div className="my-1 border-t border-[var(--border-color)]" />
            <button
              onClick={() => {
                onDeleteFolder?.(contextMenu.folderId);
                closeContextMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-accent-red hover:bg-accent-red/10 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Helper function to find a folder by ID in the tree
function findFolderById(folders: FolderNode[], id: string): FolderNode | null {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    if (folder.children) {
      const found = findFolderById(folder.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Helper function to find the parent of a folder by its ID
function findParentOfFolder(folders: FolderNode[], targetId: string, parent: FolderNode | null = null): FolderNode | null {
  for (const folder of folders) {
    if (folder.id === targetId) return parent;
    if (folder.children) {
      const found = findParentOfFolder(folder.children, targetId, folder);
      if (found) return found;
    }
  }
  return null;
}