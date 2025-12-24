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
    
    // Log full body for debugging
    console.log('📬 Full webhook body:', JSON.stringify(body, null, 2));
    
    const { event, notificationDetails } = body;
    
    // Also check for alternative field names that Farcaster might use
    const altEvent = body.type || body.action || body.eventType;
    const altDetails = body.data || body.payload || body.notification || body.details;
    
    console.log('📬 Webhook event received:', JSON.stringify({ 
      event, 
      altEvent,
      hasNotificationDetails: !!notificationDetails,
      hasAltDetails: !!altDetails,
      bodyKeys: Object.keys(body)
    }, null, 2));

    // Verify webhook signature (uses Neynar if NEYNAR_API_KEY is set)
    const verifiedData = await verifyWebhookRequest(body);
    console.log('🔍 Verification result:', verifiedData ? `FID: ${verifiedData.fid}` : 'Failed');

    if (!verifiedData || !verifiedData.fid) {
      console.warn('⚠️ Could not verify or extract FID from webhook request');
      console.warn('⚠️ Request body:', JSON.stringify(body, null, 2));
      // Still return 200 to prevent retries, but log the issue
      return NextResponse.json({ success: false, error: 'Verification failed or FID not found' }, { status: 200 });
    }

    const fid = verifiedData.fid;
    console.log(`✅ Verified FID: ${fid}`);

    // Handle different event types
    // Use verified notification details if available, otherwise fall back to body
    const details = verifiedData.notificationDetails || notificationDetails || altDetails;
    const actualEvent = event || altEvent;
    
    console.log(`📋 Event details:`, JSON.stringify({ 
      event: actualEvent, 
      hasDetails: !!details, 
      hasToken: !!details?.token, 
      hasUrl: !!details?.url,
      detailsKeys: details ? Object.keys(details) : []
    }, null, 2));

    // If event is undefined but we have FID, assume it's miniapp_added
    // This handles cases where Farcaster sends webhook without explicit event type
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
        console.warn(`⚠️ Full body structure:`, JSON.stringify(body, null, 2));
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    switch (actualEvent) {
      case 'miniapp_added':
        console.log(`🔄 Processing miniapp_added for FID: ${fid}`);
        if (details?.token && details?.url) {
          console.log(`💾 Saving notification token for FID: ${fid}`);
          await saveNotificationToken(fid, details.token, details.url);
          console.log(`✅ MiniApp added for FID: ${fid}`);
        } else {
          console.warn(`⚠️ MiniApp added event missing notification details for FID: ${fid}`);
          console.warn(`⚠️ Details:`, JSON.stringify(details, null, 2));
        }
        break;

      case 'miniapp_removed':
        await removeNotificationToken(fid);
        console.log(`🗑️ MiniApp removed for FID: ${fid}`);
        break;

      case 'notifications_disabled':
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
          console.warn(`⚠️ Details:`, JSON.stringify(details, null, 2));
        }
        break;

      default:
        console.log(`⚠️ Unknown event type: ${actualEvent}`);
        console.log(`⚠️ Full body:`, JSON.stringify(body, null, 2));
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
export async function GET(request: NextRequest) {
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

