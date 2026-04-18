import { NextResponse } from 'next/server';

/**
 * Structured API error with consistent shape.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Log structure for API requests — machine-readable JSON.
 */
interface ApiLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
  error?: string;
}

function logEntry(entry: ApiLogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(line);
  } else if (entry.level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Wrap an API route handler with consistent error handling and logging.
 *
 * Usage:
 * ```
 * export const GET = withErrorHandler(async (request) => {
 *   // ... your handler logic
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withErrorHandler(
  handler: (request: Request, context?: unknown) => Promise<NextResponse>,
) {
  return async (request: Request, context?: unknown): Promise<NextResponse> => {
    const start = Date.now();
    const url = new URL(request.url);

    try {
      const response = await handler(request, context);

      logEntry({
        timestamp: new Date().toISOString(),
        level: response.status >= 400 ? 'warn' : 'info',
        method: request.method,
        path: url.pathname,
        statusCode: response.status,
        durationMs: Date.now() - start,
      });

      return response;
    } catch (error) {
      const isApiError = error instanceof ApiError;
      const statusCode = isApiError ? error.statusCode : 500;
      const message = isApiError ? error.message : 'Internal server error';

      logEntry({
        timestamp: new Date().toISOString(),
        level: 'error',
        method: request.method,
        path: url.pathname,
        statusCode,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        {
          error: message,
          ...(isApiError && error.code ? { code: error.code } : {}),
        },
        { status: statusCode },
      );
    }
  };
}
