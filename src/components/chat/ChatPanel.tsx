'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, PanelRightClose, PanelRight, Loader2, Undo2, Mic } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import type { ChatMessageUI, SchemaPatch, QuickAction } from '@/types';
import { cn } from '@/lib/utils';
import { generateChangeSummary } from '@/lib/ai/change-summarizer';

interface ChatPanelProps {
  initialPrompt?: string;
}

export function ChatPanel({ initialPrompt }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageUI[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your dashboard assistant. Tell me what metrics or data you'd like to visualize, and I'll build it for you.\n\nFor example:\n• \"Show me monthly churn rate by region for the past 12 months\"\n• \"Build an executive summary dashboard with MRR, churn, and CSAT\"\n• \"Add a bar chart of support tickets by category\"",
      quickActions: [
        { label: 'Executive Summary', prompt: 'Build me an executive summary dashboard with key KPIs for MRR, churn rate, CSAT score, and open tickets. Include a revenue trend chart and a support tickets breakdown.' },
        { label: 'Churn Analysis', prompt: 'Create a churn analysis dashboard showing churn rate by month, by plan, and by region. Include a KPI card for overall churn rate.' },
        { label: 'Support Overview', prompt: 'Build a support operations dashboard with ticket volume by month, average first response time, CSAT score, and a table of tickets by team.' },
        { label: 'Sales Pipeline', prompt: 'Create a sales pipeline dashboard showing deals by stage, win rate, pipeline value, and deals by source.' },
      ],
      createdAt: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Speech-to-text
  const onSpeechResult = useCallback((transcript: string) => {
    setInput(prev => {
      const separator = prev && !prev.endsWith(' ') ? ' ' : '';
      return prev + separator + transcript;
    });
  }, []);

  const { isListening, toggle: toggleMic, isSupported: micSupported, interimTranscript, error: micError } = useSpeechToText({
    onResult: onSpeechResult,
  });

  // Cmd+Shift+M global shortcut for mic
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMic();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMic]);

  const { schema, applyPatch, canUndo, undo, setAiWorking, dashboardId } = useDashboardStore();

  const hasSentInitialPrompt = useRef(false);

  // Load existing chat session if dashboardId is available
  useEffect(() => {
    if (!dashboardId || isLoadingHistory) return;

    const loadChatHistory = async () => {
      setIsLoadingHistory(true);
      try {
        // Try to find existing session for this dashboard
        const response = await fetch(`/api/chat/sessions?dashboardId=${dashboardId}&limit=1`);
        if (!response.ok) throw new Error('Failed to fetch sessions');

        const { sessions } = await response.json();

        if (sessions && sessions.length > 0) {
          const latestSession = sessions[0];
          setSessionId(latestSession.id);

          // Load messages from this session
          const sessionResponse = await fetch(`/api/chat/sessions/${latestSession.id}`);
          if (!sessionResponse.ok) throw new Error('Failed to fetch session messages');

          const { messages: sessionMessages } = await sessionResponse.json();

          if (sessionMessages && sessionMessages.length > 0) {
            // Convert database messages to UI format
            const uiMessages: ChatMessageUI[] = sessionMessages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              schemaPatches: msg.schemaChange ? JSON.parse(msg.schemaChange) : undefined,
              createdAt: new Date(msg.createdAt),
            }));

            // Replace welcome message with loaded history
            setMessages(uiMessages);
          }
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        // Keep the default welcome message on error
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadChatHistory();
  }, [dashboardId, isLoadingHistory]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessageUI = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setAiWorking(true);

    try {
      // Build conversation history for context (last 10 messages to keep prompt size reasonable)
      const recentMessages = [...messages, userMessage]
        .filter(m => m.role !== 'system')
        .slice(-10)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          currentSchema: schema,
          conversationHistory: recentMessages,
          sessionId: sessionId,
          dashboardId: dashboardId,
        }),
      });

      if (!response.ok) {
        // Parse the server error for a human-readable message
        let serverError = `Request failed (${response.status})`;
        try {
          const errBody = await response.json();
          if (errBody.error) serverError = errBody.error;
        } catch { /* response wasn't JSON, use status code message */ }
        throw new Error(serverError);
      }

      const result = await response.json();

      // Update session ID if returned from API
      if (result.sessionId && !sessionId) {
        setSessionId(result.sessionId);
      }

      const patches: SchemaPatch[] = result.patches || [];
      const quickActions: QuickAction[] = result.quickActions || [];

      if (patches.length > 0) {
        // Generate a concise change summary for the history
        const changeSummary = generateChangeSummary(patches, result.explanation);
        applyPatch(patches, changeSummary);

        // Auto-save version for significant AI changes (if dashboard exists)
        if (dashboardId && shouldAutoSavePatches(patches)) {
          try {
            const currentSchema = useDashboardStore.getState().schema;
            await fetch(`/api/dashboards/${dashboardId}/versions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                schema: currentSchema,
                changeNote: `AI: ${changeSummary}`
              }),
            });
            // Note: We don't show a toast for auto-save to avoid being intrusive
          } catch (error) {
            // Silently fail auto-save - user can still manually save
            console.warn('Auto-save failed:', error);
          }
        }
      }

      const assistantMessage: ChatMessageUI = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.explanation || 'Done!',
        schemaPatches: patches,
        quickActions,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : 'An unexpected error occurred.';

      // Provide actionable guidance based on the error type
      const isApiKeyMissing = rawMsg.includes('ANTHROPIC_API_KEY');
      const guidance = isApiKeyMissing
        ? 'To fix this, add your Anthropic API key to the .env.local file and restart the dev server.'
        : 'You can try rephrasing your request, or check the browser console for details.';

      const errorMessage: ChatMessageUI = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `**Something went wrong:** ${rawMsg}\n\n${guidance}`,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setAiWorking(false);
    }
  };

  // Send initial prompt (e.g. from template link) once after first render
  useEffect(() => {
    if (initialPrompt && !hasSentInitialPrompt.current) {
      hasSentInitialPrompt.current = true;
      sendMessage(initialPrompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed right-4 bottom-4 z-40 p-3 rounded-full bg-accent-blue text-white shadow-lg hover:bg-accent-blue/90 transition-colors"
        title="Open chat"
      >
        <PanelRight size={20} />
      </button>
    );
  }

  return (
    <div className="w-full border-l border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent-blue" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">InsightHub AI</span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
        >
          <PanelRightClose size={16} className="text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[90%] rounded-xl px-3 py-2 text-sm',
                msg.role === 'user'
                  ? 'bg-accent-blue text-white'
                  : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]'
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

              {/* Quick actions — shown on every assistant message */}
              {msg.quickActions && msg.quickActions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {msg.quickActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(action.prompt)}
                      disabled={isLoading}
                      className="text-xs px-2.5 py-1 rounded-full border border-accent-blue/30 text-accent-blue bg-accent-blue/5 hover:bg-accent-blue/15 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Undo button for AI changes */}
              {msg.schemaPatches && msg.schemaPatches.length > 0 && canUndo && (
                <button
                  onClick={undo}
                  className="mt-2 flex items-center gap-1 text-xs text-accent-amber hover:text-accent-amber/80 transition-colors"
                >
                  <Undo2 size={11} />
                  Undo this change
                </button>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-3 py-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Loader2 size={14} className="animate-spin" />
              Building your dashboard...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--border-color)]">
        <div className="flex items-end gap-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to see..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none max-h-32"
            style={{ minHeight: '24px' }}
          />
          {/* Microphone button */}
          {micSupported && (
            <button
              onClick={toggleMic}
              className={cn(
                'relative p-1.5 rounded-lg transition-all',
                isListening
                  ? 'bg-accent-red/15 text-accent-red'
                  : 'text-[var(--text-muted)] hover:text-accent-purple hover:bg-accent-purple/10'
              )}
              title={isListening ? 'Stop recording (⇧⌘M)' : 'Voice input (⇧⌘M)'}
            >
              <Mic size={14} />
              {isListening && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-red opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-red" />
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              input.trim() && !isLoading
                ? 'bg-accent-blue text-white hover:bg-accent-blue/90 scale-100'
                : 'bg-[var(--bg-card-hover)] text-[var(--text-muted)] scale-95'
            )}
          >
            <Send size={14} />
          </button>
        </div>
        {isListening && (
          <p className="text-[10px] text-accent-red mt-1 px-1 truncate italic animate-pulse">
            {interimTranscript ? `${interimTranscript}…` : 'Listening — speak now...'}
          </p>
        )}
        {micError && !isListening && (
          <p className="text-[10px] text-accent-red mt-1 px-1">
            {micError}
          </p>
        )}
        <p className="text-[10px] text-[var(--text-muted)] mt-1.5 text-center">
          Enter to send · Shift+Enter new line{micSupported ? ' · ⇧⌘M voice' : ''}
        </p>
      </div>
    </div>
  );
}

/**
 * Determines whether the given patches are significant enough to warrant auto-saving a version.
 * This helps avoid creating too many versions for minor changes.
 */
function shouldAutoSavePatches(patches: SchemaPatch[]): boolean {
  if (!patches || patches.length === 0) {
    return false;
  }

  // Auto-save for any structural changes (add/remove widgets or major schema changes)
  return patches.some(patch =>
    patch.type === 'add_widget' ||
    patch.type === 'remove_widget' ||
    patch.type === 'replace_all' ||
    patch.type === 'use_widget'
  );
}
