'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Plus, MoreVertical, Edit2, Trash2, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  _count?: {
    children: number;
    dashboards: number;
  };
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

  const handleContextMenu = useCallback((e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, folderId });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const renderFolder = useCallback((folder: FolderNode, depth = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;
    const hasDashboards = folder.dashboards && folder.dashboards.length > 0;

    return (
      <div key={folder.id} className="select-none">
        <div
          className={cn(
            'flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer group hover:bg-[var(--bg-card-hover)] transition-colors',
            isSelected && 'bg-accent-blue/10 text-accent-blue',
            'ml-' + (depth * 4)
          )}
          onClick={() => onFolderSelect?.(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, folder.id)}
        >
          {hasChildren || hasDashboards ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.id);
              }}
              className="p-0.5 hover:bg-[var(--bg-card)] rounded"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-[var(--text-muted)]" />
              ) : (
                <ChevronRight size={14} className="text-[var(--text-muted)]" />
              )}
            </button>
          ) : (
            <div className="w-[18px]" /> // Spacer for alignment
          )}

          {isExpanded ? (
            <FolderOpen size={16} className="text-accent-blue shrink-0" />
          ) : (
            <Folder size={16} className="text-[var(--text-muted)] shrink-0" />
          )}

          <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
            {folder.name}
          </span>

          {(folder._count?.children || 0) + (folder._count?.dashboards || 0) > 0 && (
            <span className="text-xs text-[var(--text-muted)] shrink-0">
              {(folder._count?.children || 0) + (folder._count?.dashboards || 0)}
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateFolder?.(folder.id);
            }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-card)] rounded transition-opacity"
            title="Create subfolder"
          >
            <Plus size={12} className="text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Render children and dashboards when expanded */}
        {isExpanded && (
          <div className="ml-4">
            {/* Subfolders */}
            {folder.children?.map(child => renderFolder(child, depth + 1))}

            {/* Dashboards */}
            {showDashboards && folder.dashboards?.map(dashboard => (
              <div
                key={dashboard.id}
                className={cn(
                  'flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer group hover:bg-[var(--bg-card-hover)] transition-colors',
                  'ml-4'
                )}
                onClick={() => window.location.href = `/dashboard/${dashboard.id}`}
              >
                <div className="w-[18px]" /> {/* Spacer for alignment */}
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
                    // TODO: Show move dashboard context menu
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-card)] rounded transition-opacity"
                  title="Move dashboard"
                >
                  <Move size={12} className="text-[var(--text-muted)]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [expandedFolders, selectedFolderId, onFolderSelect, onCreateFolder, handleContextMenu, showDashboards, toggleFolder]);

  return (
    <div className={cn('space-y-1', className)}>
      {/* Root level */}
      <div
        className={cn(
          'flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer group hover:bg-[var(--bg-card-hover)] transition-colors',
          selectedFolderId === null && 'bg-accent-blue/10 text-accent-blue'
        )}
        onClick={() => onFolderSelect?.(null)}
      >
        <div className="w-[18px]" /> {/* Spacer for alignment */}
        <FolderOpen size={16} className="text-accent-blue shrink-0" />
        <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
          All Dashboards
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateFolder?.();
          }}
          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-card)] rounded transition-opacity"
          title="Create folder"
        >
          <Plus size={12} className="text-[var(--text-muted)]" />
        </button>
      </div>

      {/* Folder tree */}
      {folders.map(folder => renderFolder(folder))}

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