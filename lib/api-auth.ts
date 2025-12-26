// API authentication utilities
// Used to protect test/debug endpoints

import { timingSafeEqual } from 'crypto';

/**
 * Secure string comparison using constant-time algorithm to prevent timing attacks
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  // Use Node.js crypto.timingSafeEqual for constant-time comparison
  try {
    const aBuffer = Buffer.from(a, 'utf8');
    const bBuffer = Buffer.from(b, 'utf8');
    return timingSafeEqual(aBuffer, bBuffer);
  } catch {
    // Fallback: constant-time comparison if timingSafeEqual fails
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}

/**
 * Check if API request is authorized
 * Uses API_KEY environment variable for authentication
 * 
 * @param request - Next.js request object
 * @returns true if authorized, false otherwise
 */
export function isAuthorized(request: Request): boolean {
  // In development, allow requests without auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // In production, require API key
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    // If no API_KEY is set, deny all requests to protected endpoints
    return false;
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return false;
  }

  // Support both "Bearer <token>" and direct token
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  // Use secure comparison to prevent timing attacks
  return secureCompare(token, apiKey);
}

/**
 * Get API key from request
 * @param request - Next.js request object
 * @returns API key or null
 */
export function getApiKey(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return null;
  }

  return authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
}


