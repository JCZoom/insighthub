'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Link2, Globe, Lock, Users } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboard-store';

interface ShareModalProps {
  onClose: () => void;
}

export function ShareModal({ onClose }: ShareModalProps) {
  const { dashboardId, title } = useDashboardStore();
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch current public status
  useEffect(() => {
    if (!dashboardId) return;
    fetch(`/api/dashboards/${dashboardId}`)
      .then(r => r.json())
      .then(d => { if (d.dashboard) setIsPublic(d.dashboard.isPublic); })
      .catch(() => {});
  }, [dashboardId]);

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
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl shadow-black/20 fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
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

        <div className="p-6 space-y-5">
          {/* Dashboard title */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center">
              <Link2 size={14} className="text-accent-blue" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
              <p className="text-[10px] text-[var(--text-muted)]">
                {dashboardId ? `ID: ${dashboardId.slice(0, 8)}…` : 'Not saved yet'}
              </p>
            </div>
          </div>

          {!dashboardId ? (
            <div className="rounded-xl border border-accent-amber/30 bg-accent-amber/5 p-4 text-center">
              <p className="text-xs text-accent-amber font-medium">Save the dashboard first</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                Click the Save button or press ⌘S before sharing.
              </p>
            </div>
          ) : (
            <>
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
                    {isPublic ? (
                      <div className="w-8 h-8 rounded-lg bg-accent-green/10 flex items-center justify-center">
                        <Globe size={14} className="text-accent-green" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[var(--bg-card-hover)] flex items-center justify-center">
                        <Lock size={14} className="text-[var(--text-muted)]" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {isPublic ? 'Public' : 'Private'}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {isPublic ? 'Anyone with the link can view' : 'Only you and shared users can access'}
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
        <div className="px-6 py-3 border-t border-[var(--border-color)] flex justify-end">
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
