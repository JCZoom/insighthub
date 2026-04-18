'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  widgetTitle: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  retryCount: number;
}

const MAX_RETRIES = 1;

/**
 * Catches render errors in individual widgets so one broken widget
 * doesn't take down the entire dashboard canvas.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '', retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error) {
    // Log for debugging but don't expose internals to the user
    console.error(`[WidgetErrorBoundary] "${this.props.widgetTitle}" crashed:`, error);
  }

  handleRetry = () => {
    this.setState(prev => ({
      hasError: false,
      errorMessage: '',
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const exhausted = this.state.retryCount >= MAX_RETRIES;

      return (
        <div className="card p-4 h-full flex flex-col items-center justify-center gap-2 border-accent-amber/30">
          <AlertTriangle size={20} className="text-accent-amber" />
          <p className="text-xs font-medium text-[var(--text-primary)]">
            Widget failed to render
          </p>
          <p className="text-[10px] text-[var(--text-muted)] text-center max-w-[200px]">
            &ldquo;{this.props.widgetTitle}&rdquo; encountered an error.{' '}
            {exhausted
              ? 'Try editing or removing this widget via the chat.'
              : 'This is usually caused by unexpected data.'}
          </p>
          {!exhausted ? (
            <button
              onClick={this.handleRetry}
              className="mt-1 flex items-center gap-1 text-[10px] text-accent-blue hover:underline"
            >
              <RotateCcw size={10} />
              Retry
            </button>
          ) : (
            <p className="mt-1 text-[9px] text-[var(--text-muted)] font-mono max-w-[220px] text-center truncate" title={this.state.errorMessage}>
              {this.state.errorMessage}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
