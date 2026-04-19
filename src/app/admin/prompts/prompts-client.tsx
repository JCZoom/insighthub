'use client';

import { useState, useEffect, useRef } from 'react';

interface PromptData {
  fullPrompt: string;
  customInstructions: string;
  lastModified: string;
  lastModifiedBy: string;
}

export default function PromptsClient() {
  const [data, setData] = useState<PromptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<'full' | 'edit'>('full');
  const [searchQuery, setSearchQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/prompts');
      if (!res.ok) throw new Error('Failed to fetch prompts');
      const result = await res.json();
      setData(result);
      setCustomInstructions(result.customInstructions || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const saveCustomInstructions = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/admin/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customInstructions }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Failed to save');
      }

      const result = await res.json();
      setData(result);
      setDirty(false);
      setSuccessMessage('Custom instructions saved — changes take effect on the next AI request.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleCustomInstructionsChange = (value: string) => {
    setCustomInstructions(value);
    setDirty(true);
  };

  // Count occurrences of search query in prompt
  const getSearchHighlightCount = () => {
    if (!searchQuery || !data?.fullPrompt) return 0;
    try {
      const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      return (data.fullPrompt.match(regex) || []).length;
    } catch {
      return 0;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400">Failed to load prompt data: {error}</p>
      </div>
    );
  }

  const promptLines = data.fullPrompt.split('\n').length;
  const promptChars = data.fullPrompt.length;
  const searchCount = getSearchHighlightCount();

  return (
    <div className="space-y-6">
      {/* Save bar */}
      {dirty && (
        <div className="sticky top-4 z-10 flex items-center justify-between bg-accent-blue/10 border border-accent-blue/30 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-accent-blue">
            You have unsaved changes to custom instructions
          </span>
          <button
            onClick={saveCustomInstructions}
            disabled={saving}
            className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-700 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-6 text-xs text-[var(--text-muted)]">
        <span>{promptLines.toLocaleString()} lines</span>
        <span>{promptChars.toLocaleString()} characters</span>
        {data.lastModified && (
          <span>
            Last edited by {data.lastModifiedBy} on{' '}
            {new Date(data.lastModified).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-color)]">
        <button
          onClick={() => setActiveTab('full')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'full'
              ? 'border-accent-blue text-accent-blue'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          Full System Prompt
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'edit'
              ? 'border-accent-purple text-accent-purple'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          Custom Instructions
          {dirty && <span className="ml-1.5 w-2 h-2 rounded-full bg-accent-amber inline-block" />}
        </button>
      </div>

      {/* Full Prompt Tab */}
      {activeTab === 'full' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-muted)]">
              Read-only view of the complete system prompt as sent to Claude. Includes glossary, data sources, rules, and any custom instructions.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search prompt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-1.5 w-48"
              />
              {searchQuery && (
                <span className="text-[10px] text-[var(--text-muted)]">
                  {searchCount} match{searchCount !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <pre className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 text-xs text-[var(--text-secondary)] leading-relaxed overflow-auto max-h-[70vh] font-mono whitespace-pre-wrap break-words">
              {searchQuery
                ? data.fullPrompt.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) =>
                    part.toLowerCase() === searchQuery.toLowerCase() ? (
                      <mark key={i} className="bg-accent-amber/30 text-[var(--text-primary)] rounded px-0.5">
                        {part}
                      </mark>
                    ) : (
                      part
                    )
                  )
                : data.fullPrompt}
            </pre>
          </div>
        </div>
      )}

      {/* Custom Instructions Tab */}
      {activeTab === 'edit' && (
        <div className="space-y-4">
          <div className="bg-accent-purple/5 border border-accent-purple/20 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-accent-purple mb-1">How Custom Instructions Work</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Text you enter here is appended as a <code className="px-1 py-0.5 rounded bg-[var(--bg-primary)] text-[10px]">## Custom Instructions</code> section
              at the end of the system prompt. Use this to add company-specific rules, override default behaviors, or experiment with new instructions
              without modifying the codebase. Changes take effect on the <strong>next AI request</strong> — no deploy needed.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                Custom Instructions
              </label>
              <span className="text-[10px] text-[var(--text-muted)]">
                {customInstructions.length} characters
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={customInstructions}
              onChange={(e) => handleCustomInstructionsChange(e.target.value)}
              placeholder="Add custom instructions here. For example:&#10;&#10;- Always use the 'cool' color scheme for revenue dashboards&#10;- When the user asks for 'overview', include customer count, MRR, churn rate, and NRR&#10;- Never use pie charts for data with more than 5 categories"
              rows={16}
              className="w-full font-mono text-xs border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] rounded-xl px-4 py-3 resize-y leading-relaxed focus:outline-none focus:border-accent-purple/50 focus:ring-1 focus:ring-accent-purple/20 placeholder:text-[var(--text-muted)]"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[var(--text-muted)]">
              Supports plain text and markdown formatting. Numbered rules and bullet points work well.
            </p>
            <button
              onClick={saveCustomInstructions}
              disabled={saving || !dirty}
              className="px-5 py-2.5 bg-accent-purple text-white rounded-lg hover:bg-accent-purple/90 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Custom Instructions'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
