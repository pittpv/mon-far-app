// Webhook verification utilities
// In production, always verify webhook signatures to ensure requests are from Farcaster

import { parseWebhookEvent, verifyAppKeyWithNeynar } from "@farcaster/miniapp-node";
import type { ParseWebhookEvent } from "@farcaster/miniapp-node";

export interface VerifiedWebhookData {
  fid: number;
  event: 'miniapp_added' | 'miniapp_removed' | 'notifications_enabled' | 'notifications_disabled';
  notificationDetails?: {
    token: string;
    url: string;
  };
}

/**
 * Verify and parse webhook event from Farcaster
 * @param requestBody - Raw request body from webhook
 * @returns Verified webhook data or null if verification fails
 */
export async function verifyWebhookRequest(
  requestBody: any
): Promise<VerifiedWebhookData | null> {
  // Check if Neynar API key is configured
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    console.warn(
      '⚠️ NEYNAR_API_KEY not set. Webhook verification disabled. ' +
      'Set NEYNAR_API_KEY environment variable for production.'
    );
    // In development, allow unverified requests but log a warning
    return extractFidUnverified(requestBody);
  }

  try {
    // Verify the webhook signature using Neynar
    const verifiedData = await parseWebhookEvent(
      requestBody,
      verifyAppKeyWithNeynar
    );

    // Extract event type from verified data
    // The verifiedData contains the event information
    const event = requestBody.event as VerifiedWebhookData['event'];
    
    return {
      fid: verifiedData.fid,
      event,
      notificationDetails: requestBody.notificationDetails,
    };
  } catch (error: unknown) {
    const parseError = error as ParseWebhookEvent.ErrorType;
    
    switch (parseError.name) {
      case "VerifyJsonFarcasterSignature.InvalidDataError":
      case "VerifyJsonFarcasterSignature.InvalidEventDataError":
        console.error('❌ Invalid webhook data:', parseError.message);
        return null;
      
      case "VerifyJsonFarcasterSignature.InvalidAppKeyError":
        console.error('❌ Invalid app key:', parseError.message);
        return null;
      
      case "VerifyJsonFarcasterSignature.VerifyAppKeyError":
        console.error('❌ Error verifying app key:', parseError.message);
        // This might be a temporary error, could retry
        throw error;
      
      default:
        console.error('❌ Unknown verification error:', error);
        return null;
    }
  }
}

/**
 * Extract FID from unverified request (development only)
 * In production, always use verifyWebhookRequest
 */
function extractFidUnverified(requestBody: any): VerifiedWebhookData | null {
  // Try to extract from signature header if present
  if (requestBody.header) {
    try {
      // Header is base64 encoded JSON
      // Use globalThis.Buffer for Node.js compatibility
      const buffer = typeof Buffer !== 'undefined' ? Buffer : (globalThis as any).Buffer;
      const decoded = buffer.from(requestBody.header, 'base64').toString('utf-8');
      const headerData = JSON.parse(decoded);
      if (headerData.fid) {
        return {
          fid: parseInt(headerData.fid, 10),
          event: requestBody.event,
          notificationDetails: requestBody.notificationDetails,
        };
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  // Try direct fid field
  if (requestBody.fid) {
    return {
      fid: parseInt(requestBody.fid, 10),
      event: requestBody.event,
      notificationDetails: requestBody.notificationDetails,
    };
  }
  
  return null;
}

