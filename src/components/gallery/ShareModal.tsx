'use client';

import { useState, useEffect } from 'react';
import { Search, X, Users, Mail, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  department?: string;
}

interface DashboardShare {
  id: string;
  userId: string;
  permission: 'VIEW' | 'COMMENT' | 'EDIT';
  createdAt: string;
  user: User;
}

interface ShareModalProps {
  dashboardId: string;
  dashboardTitle: string;
  onClose: () => void;
}

export function ShareModal({ dashboardId, dashboardTitle, onClose }: ShareModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [existingShares, setExistingShares] = useState<DashboardShare[]>([]);
  const [selectedPermission, setSelectedPermission] = useState<'VIEW' | 'COMMENT' | 'EDIT'>('VIEW');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const { toast } = useToast();

  // Load existing shares
  useEffect(() => {
    async function loadShares() {
      try {
        const response = await fetch(`/api/dashboards/${dashboardId}/share`);
        if (response.ok) {
          const data = await response.json();
          setExistingShares(data.shares || []);
        }
      } catch (error) {
        console.error('Failed to load shares:', error);
      }
    }
    loadShares();
  }, [dashboardId]);

  // Search users
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const response = await fetch(`/api/users?q=${encodeURIComponent(searchQuery)}&limit=10`);
        if (response.ok) {
          const data = await response.json();
          // Filter out users who already have access
          const existingUserIds = new Set(existingShares.map(share => share.userId));
          setSearchResults(data.users.filter((user: User) => !existingUserIds.has(user.id)));
        }
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, existingShares]);

  const handleShareWithUser = async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permission: selectedPermission }),
      });

      if (response.ok) {
        const data = await response.json();
        setExistingShares(prev => [...prev, data.share]);
        setSearchQuery('');
        setSearchResults([]);
        toast({
          type: 'success',
          title: 'Dashboard shared',
          description: `${data.share.user.name} now has ${selectedPermission.toLowerCase()} access.`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to share dashboard');
      }
    } catch (error) {
      toast({
        type: 'error',
        title: 'Failed to share',
        description: error instanceof Error ? error.message : 'Could not share dashboard.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string, userId: string) => {
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/share`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setExistingShares(prev => prev.filter(share => share.id !== shareId));
        toast({
          type: 'success',
          title: 'Access removed',
        });
      } else {
        throw new Error('Failed to remove share');
      }
    } catch (error) {
      toast({
        type: 'error',
        title: 'Failed to remove access',
        description: 'Could not remove user access.',
      });
    }
  };

  const handleUpdatePermission = async (userId: string, newPermission: 'VIEW' | 'COMMENT' | 'EDIT') => {
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permission: newPermission }),
      });

      if (response.ok) {
        const data = await response.json();
        setExistingShares(prev =>
          prev.map(share =>
            share.userId === userId
              ? { ...share, permission: newPermission }
              : share
          )
        );
        toast({
          type: 'success',
          title: 'Permission updated',
        });
      } else {
        throw new Error('Failed to update permission');
      }
    } catch (error) {
      toast({
        type: 'error',
        title: 'Failed to update permission',
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--bg-card)] rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-[var(--text-primary)]">
              Share "{dashboardTitle}"
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search and add users */}
          <div className="space-y-4 mb-6">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users by name or email..."
                  className="w-full pl-10 pr-3 py-2 border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
                />
              </div>
              <div className="relative">
                <select
                  value={selectedPermission}
                  onChange={(e) => setSelectedPermission(e.target.value as 'VIEW' | 'COMMENT' | 'EDIT')}
                  className="appearance-none bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
                >
                  <option value="VIEW">View</option>
                  <option value="COMMENT">Comment</option>
                  <option value="EDIT">Edit</option>
                </select>
                <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              </div>
            </div>

            {/* Search results */}
            {searchQuery && (
              <div className="max-h-40 overflow-y-auto border border-[var(--border-color)] rounded-lg">
                {searchLoading ? (
                  <div className="p-3 text-center text-[var(--text-muted)]">
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-[var(--text-muted)]">
                    {searchQuery.trim() ? 'No users found' : 'Start typing to search users'}
                  </div>
                ) : (
                  searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleShareWithUser(user.id)}
                      disabled={loading}
                      className="w-full flex items-center gap-3 p-3 hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded-full bg-accent-blue/10 flex items-center justify-center text-accent-blue font-medium text-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-[var(--text-primary)]">{user.name}</div>
                        <div className="text-xs text-[var(--text-muted)]">{user.email}</div>
                      </div>
                      {user.department && (
                        <div className="text-xs text-[var(--text-muted)]">{user.department}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Existing shares */}
          <div>
            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Users size={16} />
              People with access ({existingShares.length})
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {existingShares.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  No one has been granted access yet.
                </div>
              ) : (
                existingShares.map((share) => (
                  <div key={share.id} className="flex items-center gap-3 p-3 bg-[var(--bg-card-hover)] rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-accent-blue/10 flex items-center justify-center text-accent-blue font-medium text-sm">
                      {share.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--text-primary)]">{share.user.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{share.user.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={share.permission}
                        onChange={(e) => handleUpdatePermission(share.userId, e.target.value as 'VIEW' | 'COMMENT' | 'EDIT')}
                        className="text-xs bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] rounded px-2 py-1"
                      >
                        <option value="VIEW">View</option>
                        <option value="COMMENT">Comment</option>
                        <option value="EDIT">Edit</option>
                      </select>
                      <button
                        onClick={() => handleRemoveShare(share.id, share.userId)}
                        className="text-xs text-[var(--text-muted)] hover:text-accent-red transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border-color)]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}