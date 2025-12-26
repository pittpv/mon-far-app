// Webhook verification utilities
// In production, always verify webhook signatures to ensure requests are from Farcaster

import { parseWebhookEvent, verifyAppKeyWithNeynar } from "@farcaster/miniapp-node";
import type { ParseWebhookEvent } from "@farcaster/miniapp-node";

export interface VerifiedWebhookData {
  fid: number;
  event: 'miniapp_added' | 'miniapp_removed' | 'notifications_enabled' | 'notifications_disabled' | 'frame_added' | 'frame_removed';
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

    // Don't log verified data - may contain sensitive token information
    console.log('🔍 Webhook verified successfully');
    console.log('🔍 Request body event:', requestBody.event);
    console.log('🔍 Request body keys:', Object.keys(requestBody));

    // parseWebhookEvent returns structure:
    // { fid: number, appFid: number, event: { event: 'miniapp_added', notificationDetails: { token, url } } }
    const eventData = (verifiedData as any).event;
    
    let event: VerifiedWebhookData['event'];
    let notificationDetails: { token: string; url: string } | undefined;
    
    if (eventData && typeof eventData === 'object' && 'event' in eventData) {
      // Event is an object with nested event and notificationDetails
      event = eventData.event as VerifiedWebhookData['event'];
      notificationDetails = eventData.notificationDetails;
      // Don't log notificationDetails - contains sensitive token data
      console.log('🔍 Extracted from eventData object:', { event, hasNotificationDetails: !!notificationDetails });
    } else {
      // Fallback: try to extract from request body or verifiedData directly
      event = (verifiedData as any).event || requestBody.event as VerifiedWebhookData['event'];
      notificationDetails = 
        (verifiedData as any).notificationDetails || 
        requestBody.notificationDetails;
      console.log('🔍 Using fallback extraction');
    }
    
    console.log('🔍 Final extracted event:', event);
    // Don't log notificationDetails - contains sensitive token data
    console.log('🔍 Final extracted notificationDetails:', notificationDetails ? 'present' : 'missing');
    
    return {
      fid: verifiedData.fid,
      event: event || 'miniapp_added', // Default to miniapp_added if event is missing
      notificationDetails,
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
  console.log('🔍 Extracting FID unverified, body keys:', Object.keys(requestBody));
  
  // Try to extract from signature header if present
  if (requestBody.header) {
    try {
      // Header is base64 encoded JSON
      // Use globalThis.Buffer for Node.js compatibility
      const buffer = typeof Buffer !== 'undefined' ? Buffer : (globalThis as any).Buffer;
      const decoded = buffer.from(requestBody.header, 'base64').toString('utf-8');
      const headerData = JSON.parse(decoded);
      // Don't log full header data - may contain sensitive information
      if (headerData.fid) {
        return {
          fid: parseInt(headerData.fid, 10),
          event: requestBody.event || requestBody.type || 'miniapp_added',
          notificationDetails: requestBody.notificationDetails || requestBody.data,
        };
      }
    } catch (e) {
      console.error('🔍 Error parsing header:', e);
    }
  }
  
  // Try direct fid field
  if (requestBody.fid) {
    return {
      fid: parseInt(requestBody.fid, 10),
      event: requestBody.event || requestBody.type || 'miniapp_added',
      notificationDetails: requestBody.notificationDetails || requestBody.data,
    };
  }
  
  return null;
}

