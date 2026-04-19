'use client';

import { useState } from 'react';
import { MessageSquare, BarChart3, ArrowRight, Lightbulb, Sparkles, Send, Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FirstDashboardGuideProps {
  onNext: () => void;
  onSkip: () => void;
}

const SAMPLE_PROMPTS = [
  {
    category: 'Revenue Analysis',
    prompts: [
      'Show me monthly revenue growth for the past year',
      'Create a dashboard with MRR, churn rate, and customer acquisition cost',
      'Build a revenue breakdown by plan type and region',
    ],
  },
  {
    category: 'Customer Support',
    prompts: [
      'Display ticket volume and resolution times by team',
      'Show CSAT scores and first response time trends',
      'Create a support overview with open tickets and agent performance',
    ],
  },
  {
    category: 'Sales Performance',
    prompts: [
      'Show me the sales pipeline with deals by stage',
      'Create a sales dashboard with win rates and revenue forecasts',
      'Display lead conversion rates and sales rep performance',
    ],
  },
];

export function FirstDashboardGuide({ onNext, onSkip }: FirstDashboardGuideProps) {
  const router = useRouter();
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');

  const handleCreateDashboard = () => {
    const prompt = customPrompt.trim() || selectedPrompt;
    if (!prompt) return;

    const encoded = encodeURIComponent(prompt);
    router.push(`/dashboard/new?prompt=${encoded}&guided=true`);
  };

  const handlePromptSelect = (prompt: string) => {
    setSelectedPrompt(prompt);
    setCustomPrompt(prompt);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-4">
          Let's Create Your First Dashboard
        </h1>
        <p className="text-lg text-[var(--text-secondary)] mb-6">
          Just describe what you'd like to see, and our AI will build it for you.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Left side - Chat Interface Demo */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-accent-blue" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Try It Out
            </h2>
          </div>

          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
            <div className="space-y-4 mb-6">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-blue/10 flex items-center justify-center text-accent-blue text-xs font-bold">
                  AI
                </div>
                <div className="flex-1 bg-[var(--bg-card-hover)] rounded-lg px-3 py-2">
                  <p className="text-sm text-[var(--text-primary)]">
                    Hi! I'm your AI dashboard assistant. What would you like to visualize today?
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                Describe your dashboard:
              </label>
              <div className="relative">
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Show me customer churn rate by region and plan type..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none focus:border-accent-blue/50 transition-colors"
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <button className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-accent-blue hover:bg-accent-blue/10 transition-colors">
                    <Mic size={14} />
                  </button>
                  <button
                    onClick={handleCreateDashboard}
                    disabled={!customPrompt.trim()}
                    className="p-1.5 rounded-md bg-accent-blue text-white disabled:opacity-30 hover:bg-accent-blue/90 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleCreateDashboard}
              disabled={!customPrompt.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent-blue text-white font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <BarChart3 size={16} />
              Create This Dashboard
            </button>
          </div>
        </div>

        {/* Right side - Example prompts */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={18} className="text-accent-amber" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Need Ideas?
            </h2>
          </div>

          <div className="space-y-4">
            {SAMPLE_PROMPTS.map((category) => (
              <div key={category.category}>
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.prompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handlePromptSelect(prompt)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedPrompt === prompt
                          ? 'border-accent-blue/50 bg-accent-blue/5'
                          : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]'
                      }`}
                    >
                      <p className="text-sm text-[var(--text-primary)]">"{prompt}"</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-accent-green/10 to-accent-green/5 border border-accent-green/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent-green/20 flex items-center justify-center mt-0.5">
                <Sparkles size={16} className="text-accent-green" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  Pro Tip
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Be specific about what you want to see. Mention metrics, time periods,
                  and how you'd like the data grouped or filtered.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[var(--border-color)]">
        <div className="text-center sm:text-left">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            Not ready to create a dashboard yet?
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            You can always come back and create one later from the home page.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors text-sm font-medium"
          >
            Skip for Now
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-green text-white text-sm font-medium hover:bg-accent-green/90 transition-colors"
          >
            Finish Tour
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}