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
    const { event, notificationDetails } = body;

    console.log('📬 Webhook event received:', event);

    // Verify webhook signature (uses Neynar if NEYNAR_API_KEY is set)
    const verifiedData = await verifyWebhookRequest(body);

    if (!verifiedData || !verifiedData.fid) {
      console.warn('⚠️ Could not verify or extract FID from webhook request');
      // Still return 200 to prevent retries, but log the issue
      return NextResponse.json({ success: false, error: 'Verification failed or FID not found' }, { status: 200 });
    }

    const fid = verifiedData.fid;

    // Handle different event types
    // Use verified notification details if available, otherwise fall back to body
    const details = verifiedData.notificationDetails || notificationDetails;

    switch (event) {
      case 'miniapp_added':
        if (details?.token && details?.url) {
          saveNotificationToken(fid, details.token, details.url);
          console.log(`✅ MiniApp added for FID: ${fid}`);
        } else {
          console.warn(`⚠️ MiniApp added event missing notification details for FID: ${fid}`);
        }
        break;

      case 'miniapp_removed':
        removeNotificationToken(fid);
        console.log(`🗑️ MiniApp removed for FID: ${fid}`);
        break;

      case 'notifications_disabled':
        removeNotificationToken(fid);
        console.log(`🔕 Notifications disabled for FID: ${fid}`);
        break;

      case 'notifications_enabled':
        if (details?.token && details?.url) {
          saveNotificationToken(fid, details.token, details.url);
          console.log(`🔔 Notifications enabled for FID: ${fid}`);
        } else {
          console.warn(`⚠️ Notifications enabled event missing notification details for FID: ${fid}`);
        }
        break;

      default:
        console.log(`⚠️ Unknown event type: ${event}`);
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

