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
}

/**
 * Catches render errors in individual widgets so one broken widget
 * doesn't take down the entire dashboard canvas.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error) {
    // Log for debugging but don't expose internals to the user
    console.error(`[WidgetErrorBoundary] "${this.props.widgetTitle}" crashed:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-4 h-full flex flex-col items-center justify-center gap-2 border-accent-amber/30">
          <AlertTriangle size={20} className="text-accent-amber" />
          <p className="text-xs font-medium text-[var(--text-primary)]">
            Widget failed to render
          </p>
          <p className="text-[10px] text-[var(--text-muted)] text-center max-w-[200px]">
            &ldquo;{this.props.widgetTitle}&rdquo; encountered an error. This is usually caused by unexpected data.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, errorMessage: '' })}
            className="mt-1 flex items-center gap-1 text-[10px] text-accent-blue hover:underline"
          >
            <RotateCcw size={10} />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
