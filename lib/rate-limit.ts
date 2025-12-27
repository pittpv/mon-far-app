// Rate limiting utilities
// Simple in-memory rate limiter for API endpoints
// For production with multiple servers, use Redis-based rate limiting

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// In production with multiple servers, use Redis instead
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Check if request should be rate limited
 * @param identifier - Unique identifier for rate limiting (e.g., IP address, FID)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(identifier, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Entry exists and is still valid
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client identifier from request (IP address or other identifier)
 * @param request - Next.js request object
 * @returns Client identifier
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take first IP if multiple are present
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback: use a default identifier if IP is not available
  // In production, ensure your reverse proxy sets x-forwarded-for or x-real-ip
  return 'unknown';
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // Public endpoints: 100 requests per 15 minutes per IP
  public: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Webhook endpoint: 1000 requests per hour per IP (Farcaster may send many)
  webhook: {
    maxRequests: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Send notification: 50 requests per minute per IP
  sendNotification: {
    maxRequests: 50,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;



