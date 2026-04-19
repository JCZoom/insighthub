'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  _count?: {
    children: number;
    dashboards: number;
  };
}

interface FolderManagerProps {
  onFoldersUpdate: () => void;
}

export function FolderManager({ onFoldersUpdate }: FolderManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);
  const [targetFolder, setTargetFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createFolder = async (name: string, parentId?: string, visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC' = 'PRIVATE') => {
    setLoading(true);
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId, visibility }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create folder');
      }

      toast({ type: 'success', title: 'Folder created', description: `"${name}" has been created.` });
      onFoldersUpdate();
      setShowCreateModal(false);
    } catch (error) {
      toast({
        type: 'error',
        title: 'Failed to create folder',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const renameFolder = async (folderId: string, newName: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rename folder');
      }

      toast({ type: 'success', title: 'Folder renamed', description: `Folder has been renamed to "${newName}".` });
      onFoldersUpdate();
      setShowRenameModal(false);
      setTargetFolder(null);
    } catch (error) {
      toast({
        type: 'error',
        title: 'Failed to rename folder',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteFolder = async (folderId: string, force = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/folders/${folderId}?force=${force}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409 && !force) {
          // Folder not empty, show confirmation
          const confirmDelete = window.confirm(
            `This folder contains ${error.details.children} subfolders and ${error.details.dashboards} dashboards. ` +
            'Deleting it will move the contents to the parent folder. Are you sure?'
          );
          if (confirmDelete) {
            return deleteFolder(folderId, true);
          }
          return;
        }
        throw new Error(error.error || 'Failed to delete folder');
      }

      toast({ type: 'success', title: 'Folder deleted', description: 'The folder has been deleted.' });
      onFoldersUpdate();
      setShowDeleteModal(false);
      setTargetFolder(null);
    } catch (error) {
      toast({
        type: 'error',
        title: 'Failed to delete folder',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Expose methods that can be called by parent components
  const showCreateDialog = (parentId?: string) => {
    setParentFolderId(parentId || null);
    setShowCreateModal(true);
  };

  const showRenameDialog = (folder: Folder) => {
    setTargetFolder(folder);
    setShowRenameModal(true);
  };

  const showDeleteDialog = (folder: Folder) => {
    setTargetFolder(folder);
    setShowDeleteModal(true);
  };

  return {
    // Export the dialog trigger functions
    createFolder: showCreateDialog,
    renameFolder: showRenameDialog,
    deleteFolder: showDeleteDialog,

    // Export the modal components
    modals: (
      <>
        {/* Create Folder Modal */}
        {showCreateModal && (
          <CreateFolderModal
            parentFolderId={parentFolderId}
            onClose={() => setShowCreateModal(false)}
            onSubmit={createFolder}
            loading={loading}
          />
        )}

        {/* Rename Folder Modal */}
        {showRenameModal && targetFolder && (
          <RenameFolderModal
            folder={targetFolder}
            onClose={() => {
              setShowRenameModal(false);
              setTargetFolder(null);
            }}
            onSubmit={(newName) => renameFolder(targetFolder.id, newName)}
            loading={loading}
          />
        )}

        {/* Delete Folder Modal */}
        {showDeleteModal && targetFolder && (
          <DeleteFolderModal
            folder={targetFolder}
            onClose={() => {
              setShowDeleteModal(false);
              setTargetFolder(null);
            }}
            onSubmit={() => deleteFolder(targetFolder.id)}
            loading={loading}
          />
        )}
      </>
    )
  };
}

// Create Folder Modal Component
function CreateFolderModal({
  parentFolderId,
  onClose,
  onSubmit,
  loading
}: {
  parentFolderId: string | null;
  onClose: () => void;
  onSubmit: (name: string, parentId?: string, visibility?: 'PRIVATE' | 'TEAM' | 'PUBLIC') => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'TEAM' | 'PUBLIC'>('PRIVATE');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim(), parentFolderId || undefined, visibility);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--bg-card)] rounded-lg max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">
            Create New Folder
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Folder Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter folder name..."
                className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Visibility
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'PRIVATE' | 'TEAM' | 'PUBLIC')}
                className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
              >
                <option value="PRIVATE">Private</option>
                <option value="TEAM">Team</option>
                <option value="PUBLIC">Public</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-[var(--text-secondary)] bg-[var(--bg-card-hover)] rounded-lg hover:bg-[var(--bg-card-hover)]/80 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || loading}
                className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 disabled:bg-[var(--text-muted)] disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Rename Folder Modal Component
function RenameFolderModal({
  folder,
  onClose,
  onSubmit,
  loading
}: {
  folder: Folder;
  onClose: () => void;
  onSubmit: (newName: string) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(folder.name);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== folder.name) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--bg-card)] rounded-lg max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">
            Rename Folder
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Folder Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
                required
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-[var(--text-secondary)] bg-[var(--bg-card-hover)] rounded-lg hover:bg-[var(--bg-card-hover)]/80 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || name.trim() === folder.name || loading}
                className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 disabled:bg-[var(--text-muted)] disabled:cursor-not-allowed"
              >
                {loading ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Delete Folder Modal Component
function DeleteFolderModal({
  folder,
  onClose,
  onSubmit,
  loading
}: {
  folder: Folder;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const hasContent = (folder._count?.children || 0) + (folder._count?.dashboards || 0) > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--bg-card)] rounded-lg max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">
            Delete Folder
          </h3>
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Are you sure you want to delete the folder <strong>"{folder.name}"</strong>?
            </p>

            {hasContent && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  This folder contains {folder._count?.children || 0} subfolders and {folder._count?.dashboards || 0} dashboards.
                  The contents will be moved to the parent folder.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-[var(--text-secondary)] bg-[var(--bg-card-hover)] rounded-lg hover:bg-[var(--bg-card-hover)]/80 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                disabled={loading}
                className="px-4 py-2 bg-accent-red text-white rounded-lg hover:bg-accent-red/90 disabled:bg-[var(--text-muted)] disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : 'Delete Folder'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}