import { NextRequest, NextResponse } from 'next/server';
import { getNotificationToken, getAllTokens } from '@/lib/notification-storage';
import { sendFrameNotification } from '@/lib/notifs';
import { isAuthorized } from '@/lib/api-auth';

/**
 * Test notification endpoint
 * 
 * GET /api/test-notification?fid=12345
 *   - Sends test notification to specific FID
 * 
 * GET /api/test-notification
 *   - Sends test notification to first available FID (for quick testing)
 * 
 * POST /api/test-notification
 *   - Body: { fid?: number, title?: string, body?: string }
 *   - Sends custom test notification
 * 
 * PROTECTED: Requires API key authentication in production
 */
export async function GET(request: NextRequest) {
  // Protect this endpoint - requires authentication in production
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. This endpoint requires API key authentication.' },
      { status: 401 }
    );
  }
  try {
    const searchParams = request.nextUrl.searchParams;
    const fidParam = searchParams.get('fid');
    
    let fid: number | null = null;
    
    if (fidParam) {
      fid = parseInt(fidParam, 10);
      if (isNaN(fid)) {
        return NextResponse.json(
          { error: 'Invalid FID parameter. Must be a number.' },
          { status: 400 }
        );
      }
    } else {
      // If no FID provided, use first available token
      const allTokens = await getAllTokens();
      if (allTokens.length === 0) {
        return NextResponse.json(
          { 
            error: 'No notification tokens found. Please add MiniApp first.',
            hint: 'Use ?fid=YOUR_FID to test with specific FID'
          },
          { status: 404 }
        );
      }
      fid = allTokens[0].fid;
      console.log(`📧 No FID provided, using first available: ${fid}`);
    }
    
    // Get notification token
    const tokenData = await getNotificationToken(fid);
    
    if (!tokenData || !tokenData.token || !tokenData.url) {
      return NextResponse.json(
        { 
          error: `No notification token found for FID ${fid}`,
          hint: 'User needs to add MiniApp first via webhook'
        },
        { status: 404 }
      );
    }
    
    // Send test notification
    const result = await sendFrameNotification({
      fid,
      title: 'Test Notification',
      body: `This is a test notification sent at ${new Date().toISOString()}`,
      notificationId: `test-${fid}-${Date.now()}`,
    });
    
    if (result.state === 'success') {
      return NextResponse.json({
        success: true,
        message: `Test notification sent successfully to FID ${fid}`,
        fid,
        result,
      });
    } else if (result.state === 'no_token') {
      return NextResponse.json(
        { 
          error: `No valid token for FID ${fid}`,
          result,
          hint: 'Token was invalid and removed. User needs to re-add MiniApp.'
        },
        { status: 404 }
      );
    } else if (result.state === 'rate_limit') {
      return NextResponse.json(
        { 
          error: `Rate limited for FID ${fid}`,
          result,
          hint: 'Please wait before sending another notification'
        },
        { status: 429 }
      );
    } else {
      return NextResponse.json(
        { 
          error: `Failed to send notification to FID ${fid}`,
          result,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Test notification error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Protect this endpoint - requires authentication in production
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. This endpoint requires API key authentication.' },
      { status: 401 }
    );
  }

  try {
    // Maximum request body size: 10KB
    const MAX_BODY_SIZE = 10 * 1024;
    
    // Check Content-Length header to prevent DoS
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }

    // Read body with size limit
    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }

    const body = JSON.parse(bodyText);
    const { fid, title, body: notificationBody } = body;
    
    // Validate fid if provided
    if (fid !== undefined && fid !== null) {
      if (typeof fid !== 'number' || !Number.isInteger(fid) || fid <= 0) {
        return NextResponse.json(
          { error: 'fid must be a positive integer' },
          { status: 400 }
        );
      }
    }
    
    // Validate title and body length (prevent DoS)
    if (title && typeof title === 'string' && title.length > 1000) {
      return NextResponse.json(
        { error: 'title exceeds maximum length of 1000 characters' },
        { status: 400 }
      );
    }
    
    if (notificationBody && typeof notificationBody === 'string' && notificationBody.length > 10000) {
      return NextResponse.json(
        { error: 'body exceeds maximum length of 10000 characters' },
        { status: 400 }
      );
    }
    
    let targetFid: number | null = fid;
    
    // If no FID provided, use first available token
    if (!targetFid) {
      const allTokens = await getAllTokens();
      if (allTokens.length === 0) {
        return NextResponse.json(
          { 
            error: 'No notification tokens found. Please add MiniApp first.',
            hint: 'Provide fid in request body or add MiniApp first'
          },
          { status: 404 }
        );
      }
      targetFid = allTokens[0].fid;
      console.log(`📧 No FID provided, using first available: ${targetFid}`);
    }
    
    // Get notification token
    const tokenData = await getNotificationToken(targetFid);
    
    if (!tokenData || !tokenData.token || !tokenData.url) {
      return NextResponse.json(
        { 
          error: `No notification token found for FID ${targetFid}`,
          hint: 'User needs to add MiniApp first via webhook'
        },
        { status: 404 }
      );
    }
    
    // Send custom notification
    const result = await sendFrameNotification({
      fid: targetFid,
      title: title || 'Test Notification',
      body: notificationBody || `This is a test notification sent at ${new Date().toISOString()}`,
      notificationId: `test-${targetFid}-${Date.now()}`,
    });
    
    if (result.state === 'success') {
      return NextResponse.json({
        success: true,
        message: `Test notification sent successfully to FID ${targetFid}`,
        fid: targetFid,
        result,
      });
    } else if (result.state === 'no_token') {
      return NextResponse.json(
        { 
          error: `No valid token for FID ${targetFid}`,
          result,
          hint: 'Token was invalid and removed. User needs to re-add MiniApp.'
        },
        { status: 404 }
      );
    } else if (result.state === 'rate_limit') {
      return NextResponse.json(
        { 
          error: `Rate limited for FID ${targetFid}`,
          result,
          hint: 'Please wait before sending another notification'
        },
        { status: 429 }
      );
    } else {
      return NextResponse.json(
        { 
          error: `Failed to send notification to FID ${targetFid}`,
          result,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Test notification error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

