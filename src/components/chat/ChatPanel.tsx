'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, PanelRightClose, PanelRight, Loader2, Undo2, Mic } from 'lucide-react';
import { handleVirtualKeyboard, isMobileDevice } from '@/lib/touch-utils';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { VoiceWaveform } from '@/components/chat/VoiceWaveform';
import type { ChatMessageUI, SchemaPatch, QuickAction } from '@/types';
import { cn } from '@/lib/utils';
import { formatShortcut } from '@/components/ui/Kbd';
import { generateChangeSummary } from '@/lib/ai/change-summarizer';

// --- Rotating status messages while AI is working ---
const AI_PHASES = [
  'Understanding your request…',
  'Analyzing available data sources…',
  'Designing widget layout…',
  'Selecting the right visualizations…',
  'Building your dashboard…',
];

function AiStatusText({ patchCount }: { patchCount: number }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (patchCount > 0) return; // stop cycling once patches arrive
    const interval = setInterval(() => {
      setPhase(p => (p + 1) % AI_PHASES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [patchCount]);

  if (patchCount > 0) {
    return <span>Placing widgets on canvas…</span>;
  }

  return (
    <span className="transition-opacity duration-300">{AI_PHASES[phase]}</span>
  );
}

interface ChatPanelProps {
  initialPrompt?: string;
}

interface StreamingState {
  isStreaming: boolean;
  progress: number;
  message: string;
  currentPatches: SchemaPatch[];
  currentQuickActions: QuickAction[];
  explanation: string;
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
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    progress: 0,
    message: '',
    currentPatches: [],
    currentQuickActions: [],
    explanation: ''
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedHistoryRef = useRef(false);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isMobile] = useState(() => isMobileDevice());

  // Speech-to-text
  const onSpeechResult = useCallback((transcript: string) => {
    setInput(prev => {
      const separator = prev && !prev.endsWith(' ') ? ' ' : '';
      return prev + separator + transcript;
    });
  }, []);

  const { isListening, toggle: toggleMic, isSupported: micSupported, interimTranscript, error: micError, audioStream } = useSpeechToText({
    onResult: onSpeechResult,
  });

  // Virtual keyboard handling for mobile devices
  useEffect(() => {
    if (!isMobile || !inputContainerRef.current) return;

    const cleanup = handleVirtualKeyboard(
      inputContainerRef.current,
      (height, isVisible) => {
        setKeyboardHeight(isVisible ? height : 0);

        // Ensure input stays visible when keyboard appears
        if (isVisible && inputRef.current) {
          // Small delay to let the keyboard animation settle
          setTimeout(() => {
            inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 150);
        }
      }
    );

    return cleanup || undefined;
  }, [isMobile]);

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
    if (!dashboardId || hasLoadedHistoryRef.current || isLoadingHistory) return;

    const loadChatHistory = async () => {
      hasLoadedHistoryRef.current = true;
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
  }, [dashboardId]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || streamingState.isStreaming) return;

    // Clean up any existing abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

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

    // Initialize streaming state
    setStreamingState({
      isStreaming: true,
      progress: 0,
      message: 'Starting...',
      currentPatches: [],
      currentQuickActions: [],
      explanation: ''
    });

    try {
      // Build conversation history for context (last 10 messages to keep prompt size reasonable)
      const recentMessages = [...messages, userMessage]
        .filter(m => m.role !== 'system')
        .slice(-10)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // Use fetch with POST to avoid URL length limits and security issues
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          currentSchema: schema,
          conversationHistory: recentMessages,
          sessionId: sessionId || undefined,
          dashboardId: dashboardId || undefined,
          stream: true
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let allPatches: SchemaPatch[] = [];
      let finalQuickActions: QuickAction[] = [];
      let finalExplanation = '';

      // Process server-sent events from the readable stream
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Look for complete SSE events
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;

          const eventLines = eventBlock.split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of eventLines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          if (!eventData) continue;

          try {
            const data = JSON.parse(eventData);

            // Handle different event types
            switch (eventType) {
              case 'progress':
                setStreamingState(prev => ({
                  ...prev,
                  progress: data.progress || 0,
                  message: data.message || 'Processing...'
                }));
                break;

              case 'token':
                setStreamingState(prev => ({
                  ...prev,
                  explanation: prev.explanation + (data.text || ''),
                  progress: data.progress || prev.progress,
                  message: 'Streaming response...'
                }));
                break;

              case 'patch':
                const patch = data.patch;
                if (patch) {
                  allPatches.push(patch);
                  // Apply patch immediately for real-time updates
                  const changeSummary = `AI: Progressive update ${data.index + 1}/${data.total}`;
                  applyPatch([patch], changeSummary);

                  setStreamingState(prev => ({
                    ...prev,
                    currentPatches: [...prev.currentPatches, patch],
                    progress: data.progress || prev.progress
                  }));
                }
                break;

              case 'explanation':
                finalExplanation = data.explanation || '';
                finalQuickActions = data.quickActions || [];

                setStreamingState(prev => ({
                  ...prev,
                  explanation: finalExplanation,
                  currentQuickActions: finalQuickActions,
                  progress: data.progress || 100
                }));
                break;

              case 'complete':
                // Update session ID if returned
                if (data.sessionId && !sessionId) {
                  setSessionId(data.sessionId);
                }

                // Auto-save version for significant AI changes (if dashboard exists)
                if (dashboardId && allPatches.length > 0 && shouldAutoSavePatches(allPatches)) {
                  // Capture schema from store state (not closure) to get post-patch version
                  const schemaToSave = useDashboardStore.getState().schema;
                  setTimeout(async () => {
                    try {
                      const changeSummary = generateChangeSummary(allPatches, finalExplanation);
                      await fetch(`/api/dashboards/${dashboardId}/versions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          schema: schemaToSave,
                          changeNote: `AI: ${changeSummary}`
                        }),
                      });
                    } catch (error) {
                      console.warn('Auto-save failed:', error);
                    }
                  }, 100);
                }

                // Add final assistant message
                const assistantMessage: ChatMessageUI = {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant',
                  content: finalExplanation || 'Done!',
                  schemaPatches: allPatches,
                  quickActions: finalQuickActions,
                  createdAt: new Date(),
                };
                setMessages(prev => [...prev, assistantMessage]);

                // Clean up
                abortControllerRef.current = null;
                setIsLoading(false);
                setAiWorking(false);
                setStreamingState(prev => ({ ...prev, isStreaming: false }));
                return; // Exit the loop on completion

              case 'error':
                const rawMsg = data.error || 'An unexpected error occurred.';

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

                // Clean up
                abortControllerRef.current = null;
                setIsLoading(false);
                setAiWorking(false);
                setStreamingState(prev => ({ ...prev, isStreaming: false }));
                return; // Exit the loop on error
            }
          } catch (parseError) {
            console.error('Failed to parse event data:', parseError);
          }
        }
      }

    } catch (error) {
      // Handle abort errors gracefully
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }

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

      // Clean up
      abortControllerRef.current = null;
      setIsLoading(false);
      setAiWorking(false);
      setStreamingState(prev => ({ ...prev, isStreaming: false }));
    }
  };

  // Clean up AbortController on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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

        {(isLoading || streamingState.isStreaming) && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-3 py-3 w-full max-w-[90%]">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Loader2 size={14} className="animate-spin shrink-0" />
                <AiStatusText patchCount={streamingState.currentPatches.length} />
              </div>
              {/* Indeterminate shimmer bar */}
              <div className="w-full bg-[var(--bg-primary)] rounded-full h-1 overflow-hidden mt-2">
                <div className="h-full rounded-full bg-accent-blue/80 animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
              </div>
              {streamingState.currentPatches.length > 0 && (
                <div className="text-xs text-accent-green mt-1.5">
                  {streamingState.currentPatches.length} widget{streamingState.currentPatches.length !== 1 ? 's' : ''} added
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        ref={inputContainerRef}
        className="p-3 border-t border-[var(--border-color)]"
        style={{
          paddingBottom: isMobile && keyboardHeight > 0 ? '20px' : '12px',
        }}
      >
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
              title={isListening ? `Stop recording ${formatShortcut(['shift', 'mod', 'm'])}` : `Voice input ${formatShortcut(['shift', 'mod', 'm'])}`}
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
          <div className="flex items-center gap-2 mt-1 px-1">
            <VoiceWaveform stream={audioStream} barCount={5} height={16} />
            <p className="text-[10px] text-accent-red truncate italic animate-pulse">
              Recording — speak now...
            </p>
          </div>
        )}
        {!isListening && interimTranscript && (
          <div className="flex items-center gap-1.5 mt-1.5 px-1">
            <Loader2 size={11} className="animate-spin text-accent-blue shrink-0" />
            <p className="text-[11px] text-[var(--text-secondary)] font-medium">
              {interimTranscript}
            </p>
          </div>
        )}
        {micError && !isListening && (
          <p className="text-[10px] text-accent-red mt-1 px-1">
            {micError}
          </p>
        )}
        <p className="text-[10px] text-[var(--text-muted)] mt-1.5 text-center">
          Enter to send · Shift+Enter new line{micSupported ? ` · ${formatShortcut(['shift', 'mod', 'm'])} voice` : ''}
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
