'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Copy, Check, Link2, Lock, Users, Search, Trash2, ChevronDown, Globe } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { formatShortcut } from '@/components/ui/Kbd';

interface ShareUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface ShareEntry {
  id: string;
  permission: string;
  user: ShareUser;
}

interface ShareModalProps {
  onClose: () => void;
}

const PERMISSIONS = [
  { value: 'VIEW', label: 'Can view' },
  { value: 'COMMENT', label: 'Can comment' },
  { value: 'EDIT', label: 'Can edit' },
] as const;

function UserAvatar({ user, size = 28 }: { user: ShareUser; size?: number }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full bg-accent-blue/15 flex items-center justify-center text-accent-blue font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

export function ShareModal({ onClose }: ShareModalProps) {
  const { dashboardId, title } = useDashboardStore();
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  // User search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ShareUser[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Current shares
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [openPermDropdown, setOpenPermDropdown] = useState<string | null>(null);

  // Fetch current public status + shares
  useEffect(() => {
    if (!dashboardId) return;
    fetch(`/api/dashboards/${dashboardId}`)
      .then(r => r.json())
      .then(d => { if (d.dashboard) setIsPublic(d.dashboard.isPublic); })
      .catch(() => {});

    setSharesLoading(true);
    fetch(`/api/dashboards/${dashboardId}/share`)
      .then(r => r.json())
      .then(d => { if (d.shares) setShares(d.shares); })
      .catch(() => {})
      .finally(() => setSharesLoading(false));
  }, [dashboardId]);

  // Debounced user search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(searchQuery.trim())}&limit=5`);
        if (res.ok) {
          const { users } = await res.json();
          // Filter out users who already have a share
          const sharedIds = new Set(shares.map(s => s.user.id));
          setSearchResults((users || []).filter((u: ShareUser) => !sharedIds.has(u.id)));
        }
      } catch { /* silent */ }
      setSearching(false);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, shares]);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard/${dashboardId}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePublic = async () => {
    if (!dashboardId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      if (res.ok) setIsPublic(!isPublic);
    } catch { /* silent */ }
    setSaving(false);
  };

  const addShare = async (user: ShareUser, permission = 'VIEW') => {
    if (!dashboardId) return;
    setAddingUserId(user.id);
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, permission }),
      });
      if (res.ok) {
        const { share } = await res.json();
        setShares(prev => [...prev, share]);
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch { /* silent */ }
    setAddingUserId(null);
  };

  const updatePermission = async (shareEntry: ShareEntry, newPerm: string) => {
    if (!dashboardId) return;
    setOpenPermDropdown(null);
    // Optimistic update
    setShares(prev => prev.map(s => s.id === shareEntry.id ? { ...s, permission: newPerm } : s));
    try {
      await fetch(`/api/dashboards/${dashboardId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: shareEntry.user.id, permission: newPerm }),
      });
    } catch {
      // Revert on failure
      setShares(prev => prev.map(s => s.id === shareEntry.id ? shareEntry : s));
    }
  };

  const removeShare = async (shareEntry: ShareEntry) => {
    if (!dashboardId) return;
    setShares(prev => prev.filter(s => s.id !== shareEntry.id));
    try {
      await fetch(`/api/dashboards/${dashboardId}/share`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: shareEntry.user.id }),
      });
    } catch {
      setShares(prev => [...prev, shareEntry]);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (openPermDropdown) {
        setOpenPermDropdown(null);
      } else {
        onClose();
      }
    }
  }, [onClose, openPermDropdown]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close permission dropdown on outside click
  useEffect(() => {
    if (!openPermDropdown) return;
    const close = () => setOpenPermDropdown(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openPermDropdown]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl shadow-black/20 fade-in max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-accent-blue" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">Share Dashboard</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {!dashboardId ? (
            <div className="rounded-xl border border-accent-amber/30 bg-accent-amber/5 p-4 text-center">
              <p className="text-xs text-accent-amber font-medium">Save the dashboard first</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                Click the Save button or press {formatShortcut(['mod', 's']).slice(1, -1)} before sharing.
              </p>
            </div>
          ) : (
            <>
              {/* User search */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
                  Invite People
                </label>
                <div className="relative">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]">
                    <Search size={14} className="text-[var(--text-muted)] shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search by name or email…"
                      className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                    />
                    {searching && (
                      <div className="w-3.5 h-3.5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
                    )}
                  </div>

                  {/* Search results dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-xl shadow-black/10 z-20 overflow-hidden">
                      {searchResults.map(user => (
                        <button
                          key={user.id}
                          onClick={() => addShare(user)}
                          disabled={addingUserId === user.id}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-50"
                        >
                          <UserAvatar user={user} size={28} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[var(--text-primary)] truncate">{user.name}</p>
                            <p className="text-[10px] text-[var(--text-muted)] truncate">{user.email}</p>
                          </div>
                          <span className="text-[10px] text-accent-blue font-medium shrink-0">
                            {addingUserId === user.id ? 'Adding…' : '+ Invite'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery.trim() && !searching && searchResults.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-xl shadow-black/10 z-20 p-3 text-center">
                      <p className="text-[11px] text-[var(--text-muted)]">No users found</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Current shares */}
              {(shares.length > 0 || sharesLoading) && (
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
                    People with Access
                  </label>
                  <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] divide-y divide-[var(--border-color)]">
                    {sharesLoading ? (
                      <div className="p-4 text-center">
                        <div className="w-4 h-4 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin mx-auto" />
                      </div>
                    ) : shares.map(share => (
                      <div key={share.id} className="flex items-center gap-3 px-3 py-2.5">
                        <UserAvatar user={share.user} size={28} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{share.user.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">{share.user.email}</p>
                        </div>
                        {/* Permission dropdown */}
                        <div className="relative">
                          <button
                            onClick={e => { e.stopPropagation(); setOpenPermDropdown(openPermDropdown === share.id ? null : share.id); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                          >
                            {PERMISSIONS.find(p => p.value === share.permission)?.label || share.permission}
                            <ChevronDown size={10} />
                          </button>
                          {openPermDropdown === share.id && (
                            <div
                              className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-xl shadow-black/10 z-30 overflow-hidden"
                              onClick={e => e.stopPropagation()}
                            >
                              {PERMISSIONS.map(p => (
                                <button
                                  key={p.value}
                                  onClick={() => updatePermission(share, p.value)}
                                  className={`w-full text-left px-3 py-2 text-[11px] hover:bg-[var(--bg-card-hover)] transition-colors ${
                                    share.permission === p.value ? 'text-accent-blue font-medium' : 'text-[var(--text-secondary)]'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                              <div className="border-t border-[var(--border-color)]">
                                <button
                                  onClick={() => { removeShare(share); setOpenPermDropdown(null); }}
                                  className="w-full text-left px-3 py-2 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
                                >
                                  <Trash2 size={10} /> Remove
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Copy link */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
                  Share Link
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-secondary)] overflow-hidden">
                    <Link2 size={12} className="text-[var(--text-muted)] shrink-0" />
                    <span className="truncate">{shareUrl}</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-xs font-medium hover:bg-accent-blue/20 transition-colors shrink-0"
                  >
                    {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                  </button>
                </div>
              </div>

              {/* Visibility toggle */}
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isPublic ? 'bg-accent-green/10' : 'bg-accent-blue/10'
                    }`}>
                      {isPublic
                        ? <Globe size={14} className="text-accent-green" />
                        : <Lock size={14} className="text-accent-blue" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {isPublic ? 'Published' : 'Private'}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {isPublic ? 'Visible to everyone in the gallery' : 'Only you and shared users can access'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={togglePublic}
                    disabled={saving}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      isPublic ? 'bg-accent-green' : 'bg-[var(--bg-card-hover)] border border-[var(--border-color)]'
                    } ${saving ? 'opacity-50' : ''}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      isPublic ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Embed snippet */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
                  Embed Code
                </label>
                <div className="relative">
                  <pre className="px-3 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap break-all">
{`<iframe
  src="${shareUrl}?embed=1"
  width="100%" height="600"
  frameBorder="0"
  allow="clipboard-write"
/>`}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--border-color)] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
