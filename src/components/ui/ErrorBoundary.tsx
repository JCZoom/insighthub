'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary] Page-level error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
          <div className="card p-8 max-w-md w-full text-center">
            <AlertTriangle size={40} className="text-accent-amber mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {this.state.errorMessage || 'An unexpected error occurred. Please try again.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => this.setState({ hasError: false, errorMessage: '' })}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-sm font-medium hover:bg-accent-blue/20 transition-colors"
              >
                <RotateCcw size={14} />
                Try Again
              </button>
              <a
                href="/"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-card-hover)] text-[var(--text-secondary)] text-sm font-medium hover:text-[var(--text-primary)] transition-colors"
              >
                <Home size={14} />
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
