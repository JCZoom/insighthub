'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Send, BarChart3, TrendingUp, HeadphonesIcon, PieChart, Sparkles, Mic, MicOff, Settings, LogOut, User, ArrowRight, LayoutGrid } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import Link from 'next/link';

const QUICK_ACTIONS = [
  {
    icon: BarChart3,
    label: 'Executive Summary',
    prompt: 'Build me an executive summary dashboard with key KPIs for MRR, churn rate, CSAT score, and open tickets. Include a revenue trend chart and a support tickets breakdown.',
    color: 'from-accent-blue/20 to-accent-blue/5 border-accent-blue/20',
    iconColor: 'text-accent-blue',
  },
  {
    icon: TrendingUp,
    label: 'Churn Analysis',
    prompt: 'Create a churn analysis dashboard showing churn rate by month, by plan, and by region. Include a KPI card for overall churn rate.',
    color: 'from-accent-purple/20 to-accent-purple/5 border-accent-purple/20',
    iconColor: 'text-accent-purple',
  },
  {
    icon: HeadphonesIcon,
    label: 'Support Overview',
    prompt: 'Build a support operations dashboard with ticket volume by month, average first response time, CSAT score, and a table of tickets by team.',
    color: 'from-accent-green/20 to-accent-green/5 border-accent-green/20',
    iconColor: 'text-accent-green',
  },
  {
    icon: PieChart,
    label: 'Sales Pipeline',
    prompt: 'Create a sales pipeline dashboard showing deals by stage, win rate, pipeline value, and deals by source.',
    color: 'from-accent-cyan/20 to-accent-cyan/5 border-accent-cyan/20',
    iconColor: 'text-accent-cyan',
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [greeting, setGreeting] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Speech-to-text
  const onSpeechResult = useCallback((transcript: string) => {
    setInput(prev => {
      const separator = prev && !prev.endsWith(' ') ? ' ' : '';
      return prev + separator + transcript;
    });
  }, []);

  const { isListening, toggle: toggleMic, isSupported: micSupported, interimTranscript } = useSpeechToText({
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

  useEffect(() => {
    setGreeting(getGreeting());
    inputRef.current?.focus();
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);

  const handleSubmit = (prompt: string) => {
    if (!prompt.trim()) return;
    const encoded = encodeURIComponent(prompt.trim());
    router.push(`/dashboard/new?prompt=${encoded}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal top bar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 text-accent-blue font-bold text-lg tracking-tight">
          <Sparkles size={20} />
          <span>InsightHub</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboards"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            My Dashboards
          </Link>
          <Link
            href="/glossary"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Glossary
          </Link>
          <ThemeToggle />
          {/* Profile bubble with dropdown */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen(prev => !prev)}
              className="w-8 h-8 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center text-xs font-bold hover:ring-2 hover:ring-accent-purple/30 transition-all cursor-pointer"
            >
              JC
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg shadow-black/10 py-1.5 fade-in z-50">
                <div className="px-3 py-2 border-b border-[var(--border-color)]">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Jeffrey Coy</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Admin</p>
                </div>
                <Link
                  href="#"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors"
                  onClick={() => setProfileOpen(false)}
                >
                  <User size={14} />
                  Profile
                </Link>
                <Link
                  href="#"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors"
                  onClick={() => setProfileOpen(false)}
                >
                  <Settings size={14} />
                  Settings
                </Link>
                <div className="border-t border-[var(--border-color)] mt-1 pt-1">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                    onClick={() => setProfileOpen(false)}
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl text-center">
          {/* Greeting */}
          <p className="fade-up stagger-1 text-sm text-[var(--text-secondary)] mb-2">{greeting || '\u00A0'}</p>
          <h1 className="fade-up stagger-2 text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-2">
            What would you like to visualize?
          </h1>
          <p className="fade-up stagger-2 text-[var(--text-secondary)] text-sm mb-8 max-w-md mx-auto">
            Describe your data in plain English and AI will build a live, interactive dashboard in seconds.
          </p>

          {/* Input */}
          <div className="fade-up stagger-3 relative w-full mb-8">
            <div className="hero-glow flex items-center gap-2 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] px-4 py-3 shadow-lg shadow-black/5 focus-within:border-accent-blue/40 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Show me monthly churn rate by region for the past year..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none min-h-[24px] max-h-32"
              />
              {micSupported && (
                <button
                  onClick={toggleMic}
                  className={`p-2 rounded-xl transition-all ${
                    isListening
                      ? 'bg-accent-red/20 text-accent-red animate-pulse'
                      : 'text-[var(--text-muted)] hover:text-accent-purple hover:bg-accent-purple/10'
                  }`}
                  title={isListening ? 'Stop recording (⇧⌘M)' : 'Voice input (⇧⌘M)'}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
              <button
                onClick={() => handleSubmit(input)}
                disabled={!input.trim()}
                className="p-2 rounded-xl bg-accent-blue text-white disabled:opacity-30 hover:bg-accent-blue/90 transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
          {isListening && interimTranscript && (
            <p className="text-xs text-accent-purple mb-4 italic truncate">
              {interimTranscript}…
            </p>
          )}

          {/* Quick start templates */}
          <div className="fade-up stagger-4 flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[var(--border-color)]" />
            <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-widest">or start from a template</span>
            <div className="flex-1 h-px bg-[var(--border-color)]" />
          </div>
          <div className="fade-up stagger-5 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => handleSubmit(action.prompt)}
                className={`group flex flex-col items-center gap-2.5 p-4 rounded-xl border bg-gradient-to-b ${action.color} hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer`}
              >
                <action.icon size={22} className={action.iconColor} />
                <span className="text-xs font-medium text-[var(--text-primary)]">{action.label}</span>
              </button>
            ))}
          </div>

          {/* Browse existing */}
          <div className="fade-up stagger-5">
            <Link
              href="/dashboards"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-accent-blue/30 hover:bg-accent-blue/5 transition-all group"
            >
              <LayoutGrid size={14} className="text-[var(--text-muted)] group-hover:text-accent-blue transition-colors" />
              Browse saved dashboards
              <ArrowRight size={12} className="text-[var(--text-muted)] group-hover:text-accent-blue group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
