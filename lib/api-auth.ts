// API authentication utilities
// Used to protect test/debug endpoints

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

  return token === apiKey;
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

