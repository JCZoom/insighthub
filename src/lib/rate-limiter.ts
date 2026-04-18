import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

interface RateLimitWindow {
  requests: number[];
  lastCleanup: number;
}

// In-memory store for rate limiting windows
const rateLimitStore = new Map<string, RateLimitWindow>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastGlobalCleanup = Date.now();

/**
 * Sliding window rate limiter implementation
 * Tracks requests per user per endpoint with a sliding window approach
 */
export class SlidingWindowRateLimiter {
  private windowSizeMs: number;
  private maxRequests: number;

  constructor(maxRequests: number, windowSizeMs: number) {
    this.maxRequests = maxRequests;
    this.windowSizeMs = windowSizeMs;
  }

  /**
   * Check if a request should be rate limited
   * @param userId - User ID to rate limit
   * @param endpoint - API endpoint identifier
   * @returns { allowed: boolean, remaining: number, resetTime: number, retryAfter?: number }
   */
  async checkRateLimit(userId: string, endpoint: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const key = `${userId}:${endpoint}`;
    const now = Date.now();

    // Perform periodic cleanup to prevent memory leaks
    if (now - lastGlobalCleanup > CLEANUP_INTERVAL) {
      this.cleanupExpiredEntries();
      lastGlobalCleanup = now;
    }

    // Get or create window for this user+endpoint
    let window = rateLimitStore.get(key);
    if (!window) {
      window = { requests: [], lastCleanup: now };
      rateLimitStore.set(key, window);
    }

    // Remove requests outside the sliding window
    const windowStart = now - this.windowSizeMs;
    window.requests = window.requests.filter(timestamp => timestamp > windowStart);

    // Check if we're at the limit
    const currentRequests = window.requests.length;

    if (currentRequests >= this.maxRequests) {
      // Find when the oldest request will expire
      const oldestRequest = Math.min(...window.requests);
      const resetTime = oldestRequest + this.windowSizeMs;
      const retryAfter = Math.ceil((resetTime - now) / 1000); // seconds

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.max(1, retryAfter) // At least 1 second
      };
    }

    // Allow the request and record it
    window.requests.push(now);
    window.lastCleanup = now;

    // Calculate when the window resets (when oldest request expires)
    const oldestRequest = Math.min(...window.requests);
    const resetTime = oldestRequest + this.windowSizeMs;

    return {
      allowed: true,
      remaining: this.maxRequests - window.requests.length,
      resetTime
    };
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expireThreshold = now - (this.windowSizeMs * 2); // Keep windows for twice the window size

    for (const [key, window] of rateLimitStore.entries()) {
      // Remove old requests from the window
      window.requests = window.requests.filter(timestamp => timestamp > expireThreshold);

      // Remove entirely empty windows that haven't been accessed recently
      if (window.requests.length === 0 && window.lastCleanup < expireThreshold) {
        rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Get current usage for a user+endpoint combination
   */
  async getCurrentUsage(userId: string, endpoint: string): Promise<{
    current: number;
    limit: number;
    resetTime: number;
  }> {
    const key = `${userId}:${endpoint}`;
    const window = rateLimitStore.get(key);

    if (!window) {
      return {
        current: 0,
        limit: this.maxRequests,
        resetTime: Date.now() + this.windowSizeMs
      };
    }

    const now = Date.now();
    const windowStart = now - this.windowSizeMs;
    const validRequests = window.requests.filter(timestamp => timestamp > windowStart);

    const oldestRequest = validRequests.length > 0 ? Math.min(...validRequests) : now;
    const resetTime = oldestRequest + this.windowSizeMs;

    return {
      current: validRequests.length,
      limit: this.maxRequests,
      resetTime
    };
  }
}

// Pre-configured rate limiters
export const dashboardRateLimiter = new SlidingWindowRateLimiter(60, 60 * 1000); // 60 req/min
export const chatRateLimiter = new SlidingWindowRateLimiter(30, 60 * 1000); // 30 req/min

/**
 * Rate limiting middleware factory
 */
export function createRateLimitMiddleware(
  rateLimiter: SlidingWindowRateLimiter,
  endpointName: string
) {
  return async function rateLimitMiddleware(
    request: NextRequest
  ): Promise<NextResponse | null> {
    try {
      // Get current user for rate limiting
      const user = await getCurrentUser();

      // Check rate limit
      const result = await rateLimiter.checkRateLimit(user.id, endpointName);

      if (!result.allowed) {
        // Return 429 Too Many Requests with Retry-After header
        const response = NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
            retryAfter: result.retryAfter
          },
          { status: 429 }
        );

        // Set standard rate limiting headers
        response.headers.set('X-RateLimit-Limit', rateLimiter['maxRequests'].toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
        response.headers.set('Retry-After', result.retryAfter!.toString());

        return response;
      }

      // Request is allowed, but we'll add rate limit headers to the response
      // This is handled by the consuming API route
      return null; // Continue processing
    } catch (error) {
      console.error('Rate limiting error:', error);
      // On rate limiting errors, allow the request to proceed
      // This ensures the API remains functional even if rate limiting fails
      return null;
    }
  };
}

/**
 * Add rate limit headers to a successful response
 */
export async function addRateLimitHeaders(
  response: NextResponse,
  rateLimiter: SlidingWindowRateLimiter,
  userId: string,
  endpointName: string
): Promise<void> {
  try {
    const usage = await rateLimiter.getCurrentUsage(userId, endpointName);

    response.headers.set('X-RateLimit-Limit', usage.limit.toString());
    response.headers.set('X-RateLimit-Remaining', (usage.limit - usage.current).toString());
    response.headers.set('X-RateLimit-Reset', usage.resetTime.toString());
  } catch (error) {
    console.error('Error adding rate limit headers:', error);
    // Silently fail - don't break the response
  }
}

/**
 * Utility to apply rate limiting to an API route
 */
export async function withRateLimit<T>(
  request: NextRequest,
  rateLimiter: SlidingWindowRateLimiter,
  endpointName: string,
  handler: () => Promise<T>
): Promise<T | NextResponse> {
  // Apply rate limiting
  const rateLimitResponse = await createRateLimitMiddleware(rateLimiter, endpointName)(request);

  if (rateLimitResponse) {
    return rateLimitResponse; // Rate limit exceeded
  }

  // Execute the handler
  const result = await handler();

  // Add rate limit headers to successful responses
  if (result instanceof NextResponse) {
    try {
      const user = await getCurrentUser();
      await addRateLimitHeaders(result, rateLimiter, user.id, endpointName);
    } catch (error) {
      console.error('Error adding rate limit headers to response:', error);
    }
  }

  return result;
}