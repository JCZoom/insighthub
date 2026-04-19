'use client';

import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  id: string | null;
  name: string;
  isRoot?: boolean;
}

interface FolderBreadcrumbsProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigate?: (folderId: string | null) => void;
  className?: string;
}

export function FolderBreadcrumbs({ breadcrumbs, onNavigate, className }: FolderBreadcrumbsProps) {
  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className={cn('flex items-center gap-1 text-sm', className)} aria-label="Breadcrumb">
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <div key={item.id || 'root'} className="flex items-center gap-1">
            {item.isRoot ? (
              <button
                onClick={() => onNavigate?.(item.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors',
                  isLast
                    ? 'text-[var(--text-primary)] bg-[var(--bg-card-hover)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                <Home size={14} />
                <span>{item.name}</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate?.(item.id)}
                className={cn(
                  'px-2 py-1 rounded-md transition-colors truncate max-w-[200px]',
                  isLast
                    ? 'text-[var(--text-primary)] bg-[var(--bg-card-hover)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                )}
                aria-current={isLast ? 'page' : undefined}
                title={item.name}
              >
                {item.name}
              </button>
            )}

            {!isLast && (
              <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// Helper function to build breadcrumbs from a folder path
export function buildBreadcrumbs(
  currentFolderId: string | null,
  folders: Array<{ id: string; name: string; parentId: string | null }>
): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [
    { id: null, name: 'All Dashboards', isRoot: true }
  ];

  if (currentFolderId === null) {
    return breadcrumbs;
  }

  // Build path from current folder back to root
  const path: Array<{ id: string; name: string }> = [];
  let currentId: string | null = currentFolderId;

  while (currentId) {
    const folder = folders.find(f => f.id === currentId);
    if (!folder) break;

    path.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  // Add folders to breadcrumbs
  path.forEach(folder => {
    breadcrumbs.push({ id: folder.id, name: folder.name });
  });

  return breadcrumbs;
}