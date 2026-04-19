'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles, BarChart3, MessageSquare, Mouse, Keyboard, ChevronDown } from 'lucide-react';

interface WelcomeModalProps {
  onClose: () => void;
  onGetStarted: () => void;
}

const SLIDES = [
  {
    id: 1,
    title: 'Welcome to InsightHub',
    subtitle: 'Your AI-powered dashboard platform',
    content: (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center mx-auto mb-6">
          <Sparkles size={32} className="text-white" />
        </div>
        <p className="text-[var(--text-secondary)] mb-6">
          Transform your data into beautiful, interactive dashboards using plain English.
          No SQL or technical knowledge required.
        </p>
        <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
          <div className="text-center">
            <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center mx-auto mb-2">
              <MessageSquare size={18} className="text-accent-blue" />
            </div>
            <p className="text-xs text-[var(--text-muted)]">Describe in English</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-lg bg-accent-green/10 flex items-center justify-center mx-auto mb-2">
              <Sparkles size={18} className="text-accent-green" />
            </div>
            <p className="text-xs text-[var(--text-muted)]">AI builds it</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center mx-auto mb-2">
              <BarChart3 size={18} className="text-accent-purple" />
            </div>
            <p className="text-xs text-[var(--text-muted)]">Get insights</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    title: 'Chat-Driven Analytics',
    subtitle: 'Just describe what you want to see',
    content: (
      <div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 mb-6">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-accent-blue/10 flex items-center justify-center text-accent-blue text-xs font-bold">
                You
              </div>
              <div className="flex-1 bg-accent-blue/5 rounded-lg px-3 py-2">
                <p className="text-sm text-[var(--text-primary)]">
                  "Show me monthly churn rate by region for the past year"
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-accent-green/10 flex items-center justify-center">
                <Sparkles size={14} className="text-accent-green" />
              </div>
              <div className="flex-1 bg-[var(--bg-card-hover)] rounded-lg px-3 py-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  ✨ Creating your dashboard with churn analysis widgets...
                </p>
                <div className="mt-2 w-full bg-[var(--bg-primary)] rounded-full h-1.5">
                  <div className="bg-accent-green h-1.5 rounded-full animate-pulse" style={{ width: '75%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)] text-center">
          Our AI understands your intent and builds the perfect visualization automatically.
        </p>
      </div>
    ),
  },
  {
    id: 3,
    title: 'Interactive Dashboards',
    subtitle: 'Explore your data with live widgets',
    content: (
      <div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-lg border border-[var(--border-color)] bg-gradient-to-br from-accent-blue/5 to-accent-blue/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-accent-blue" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Revenue KPI</h4>
            </div>
            <div className="space-y-2">
              <div className="h-2 bg-accent-blue/20 rounded-full">
                <div className="h-2 bg-accent-blue rounded-full animate-pulse" style={{ width: '85%' }} />
              </div>
              <p className="text-xs text-[var(--text-muted)]">$127K MRR ↗ 12%</p>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border-color)] bg-gradient-to-br from-accent-green/5 to-accent-green/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-accent-green" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Churn Analysis</h4>
            </div>
            <div className="space-y-1">
              {[65, 45, 80].map((width, i) => (
                <div key={i} className="h-1.5 bg-accent-green/20 rounded-full">
                  <div className="h-1.5 bg-accent-green rounded-full animate-pulse" style={{ width: `${width}%`, animationDelay: `${i * 0.2}s` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5">
            <Mouse size={12} />
            <span>Click & drag to explore</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Keyboard size={12} />
            <span>Keyboard shortcuts</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 4,
    title: 'Ready to Start?',
    subtitle: 'Let\'s build your first dashboard together',
    content: (
      <div className="text-center">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
            <div className="w-12 h-12 rounded-full bg-accent-blue/10 flex items-center justify-center mx-auto mb-3">
              <BarChart3 size={20} className="text-accent-blue" />
            </div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Templates</h4>
            <p className="text-xs text-[var(--text-muted)]">Start with pre-built examples</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
            <div className="w-12 h-12 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto mb-3">
              <MessageSquare size={20} className="text-accent-green" />
            </div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Guided Tour</h4>
            <p className="text-xs text-[var(--text-muted)]">Build your first dashboard</p>
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Choose your path to get started. You can always come back and explore more options later.
        </p>
      </div>
    ),
  },
];

export function WelcomeModal({ onClose, onGetStarted }: WelcomeModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'Enter' && currentSlide === SLIDES.length - 1) {
      e.preventDefault();
      onGetStarted();
    }
  }, [currentSlide, onClose, onGetStarted]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const nextSlide = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const slide = SLIDES[currentSlide];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-500 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div className={`relative z-10 w-full max-w-lg mx-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl shadow-black/20 transition-all duration-500 ${
        isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {currentSlide + 1} of {SLIDES.length}
            </span>
            <div className="flex gap-1">
              {SLIDES.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentSlide ? 'bg-accent-blue' : 'bg-[var(--border-color)]'
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Slide content */}
        <div className="px-6 py-8">
          <div key={slide.id} className="animate-fadeIn">
            <h2 className="text-xl font-bold text-[var(--text-primary)] text-center mb-2">
              {slide.title}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
              {slide.subtitle}
            </p>
            <div className="mb-8">
              {slide.content}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              Skip Tour
            </button>

            {currentSlide === SLIDES.length - 1 ? (
              <button
                onClick={onGetStarted}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 transition-colors"
              >
                Get Started
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={nextSlide}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 transition-colors"
              >
                Next
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}