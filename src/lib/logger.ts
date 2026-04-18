/**
 * Structured logger for InsightHub.
 * Outputs JSON lines in production for easy parsing by log aggregators.
 * Human-readable format in development.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const isProduction = process.env.NODE_ENV === 'production';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  if (isProduction) {
    return JSON.stringify(entry);
  }

  const { level, message, timestamp, ...extra } = entry;
  const prefix = {
    debug: '🔍',
    info: 'ℹ️ ',
    warn: '⚠️ ',
    error: '❌',
  }[level];

  const extraStr = Object.keys(extra).length > 0
    ? ` ${JSON.stringify(extra)}`
    : '';

  return `${prefix} [${timestamp}] ${message}${extraStr}`;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),

  /** Log an API request with timing */
  request: (method: string, path: string, status: number, durationMs: number, meta?: Record<string, unknown>) => {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    log(level, `${method} ${path} ${status}`, {
      method,
      path,
      status,
      durationMs,
      ...meta,
    });
  },

  /** Log an error with stack trace */
  exception: (message: string, error: unknown, meta?: Record<string, unknown>) => {
    const errorMeta: Record<string, unknown> = {
      ...meta,
    };

    if (error instanceof Error) {
      errorMeta.errorName = error.name;
      errorMeta.errorMessage = error.message;
      if (!isProduction) {
        errorMeta.stack = error.stack;
      }
    } else {
      errorMeta.errorRaw = String(error);
    }

    log('error', message, errorMeta);
  },
};
