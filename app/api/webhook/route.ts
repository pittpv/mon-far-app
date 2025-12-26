import { NextRequest, NextResponse } from 'next/server';
import {
  saveNotificationToken,
  removeNotificationToken,
  getNotificationToken,
} from '@/lib/notification-storage';
import { verifyWebhookRequest } from '@/lib/webhook-verification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log event info without sensitive data
    const { event, notificationDetails } = body;
    
    // Also check for alternative field names that Farcaster might use
    const altEvent = body.type || body.action || body.eventType;
    const altDetails = body.data || body.payload || body.notification || body.details;
    
    console.log('📬 Webhook event received:', { 
      event, 
      altEvent,
      hasNotificationDetails: !!notificationDetails,
      hasAltDetails: !!altDetails,
      bodyKeys: Object.keys(body)
    });

    // Verify webhook signature (uses Neynar if NEYNAR_API_KEY is set)
    const verifiedData = await verifyWebhookRequest(body);
    console.log('🔍 Verification result:', verifiedData ? `FID: ${verifiedData.fid}` : 'Failed');

    if (!verifiedData || !verifiedData.fid) {
      console.warn('⚠️ Could not verify or extract FID from webhook request');
      // Don't log full body - may contain sensitive data
      // Still return 200 to prevent retries, but log the issue
      return NextResponse.json({ success: false, error: 'Verification failed or FID not found' }, { status: 200 });
    }

    const fid = verifiedData.fid;
    console.log(`✅ Verified FID: ${fid}`);

    // Handle different event types
    // PRIORITY: Use event from verifiedData first (it's extracted from signed payload)
    // Fallback to body only if verifiedData doesn't have event
    const actualEvent = verifiedData.event || event || altEvent;
    const details = verifiedData.notificationDetails || notificationDetails || altDetails;
    
    console.log(`📋 Event details:`, { 
      event: actualEvent, 
      eventSource: verifiedData.event ? 'verifiedData' : (event ? 'body' : 'altEvent'),
      hasDetails: !!details, 
      hasToken: !!details?.token, 
      hasUrl: !!details?.url,
      detailsKeys: details ? Object.keys(details) : []
    });

    // If event is undefined but we have FID, assume it's miniapp_added
    // This handles cases where Farcaster sends webhook without explicit event type
    // BUT only if we don't have a verified event from the signed payload
    if (!actualEvent) {
      console.log(`⚠️ Event type is undefined, assuming miniapp_added for FID: ${fid}`);
      // Try to extract token and url from body directly if details are missing
      const token = details?.token || body.token || body.notificationToken;
      const url = details?.url || body.url || body.notificationUrl;
      
      if (token && url) {
        console.log(`💾 Saving notification token for FID: ${fid} (extracted from body)`);
        await saveNotificationToken(fid, token, url);
        console.log(`✅ MiniApp added for FID: ${fid}`);
      } else {
        console.warn(`⚠️ Cannot save token - missing token or url for FID: ${fid}`);
        console.warn(`⚠️ Token: ${token ? 'present' : 'missing'}, URL: ${url ? 'present' : 'missing'}`);
        // Don't log full body - may contain sensitive data
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    switch (actualEvent) {
      case 'miniapp_added':
      case 'frame_added': // Legacy event name support
        console.log(`🔄 Processing miniapp_added for FID: ${fid}`);
        if (details?.token && details?.url) {
          console.log(`💾 Saving notification token for FID: ${fid}`);
          await saveNotificationToken(fid, details.token, details.url);
          console.log(`✅ MiniApp added for FID: ${fid}`);
        } else {
          console.warn(`⚠️ MiniApp added event missing notification details for FID: ${fid}`);
          // Don't log details - may contain sensitive token data
        }
        break;

      case 'miniapp_removed':
      case 'frame_removed': // Legacy event name support (as seen in your logs)
        console.log(`🔄 Processing miniapp_removed for FID: ${fid}`);
        await removeNotificationToken(fid);
        console.log(`🗑️ MiniApp removed for FID: ${fid}`);
        break;

      case 'notifications_disabled':
        console.log(`🔄 Processing notifications_disabled for FID: ${fid}`);
        await removeNotificationToken(fid);
        console.log(`🔕 Notifications disabled for FID: ${fid}`);
        break;

      case 'notifications_enabled':
        console.log(`🔄 Processing notifications_enabled for FID: ${fid}`);
        if (details?.token && details?.url) {
          console.log(`💾 Saving notification token for FID: ${fid}`);
          await saveNotificationToken(fid, details.token, details.url);
          console.log(`🔔 Notifications enabled for FID: ${fid}`);
        } else {
          console.warn(`⚠️ Notifications enabled event missing notification details for FID: ${fid}`);
          // Don't log details - may contain sensitive token data
        }
        break;

      default:
        console.log(`⚠️ Unknown event type: ${actualEvent}`);
        // Don't log full body - may contain sensitive data
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


// Export function to manually check token (for testing)
// PROTECTED: Requires API key authentication in production
export async function GET(request: NextRequest) {
  // Protect this endpoint - requires authentication in production
  const { isAuthorized } = await import('@/lib/api-auth');
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. This endpoint requires API key authentication.' },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');
  
  if (fid) {
    const fidNum = parseInt(fid, 10);
    const { getNotificationToken } = await import('@/lib/notification-storage');
    const tokenData = await getNotificationToken(fidNum);
    return NextResponse.json({
      hasToken: !!tokenData,
      tokenData: tokenData ? {
        fid: tokenData.fid,
        hasAddress: !!tokenData.address,
        lastVoteTime: tokenData.lastVoteTime,
        votesCount: tokenData.votes?.length || 0,
      } : null,
    });
  }

  const { getAllTokens } = await import('@/lib/notification-storage');
  const allTokens = await getAllTokens();
  return NextResponse.json({
    totalTokens: allTokens.length,
    fids: allTokens.map(t => t.fid),
  });
}

