import { NextRequest, NextResponse } from 'next/server';
import { saveUserVote } from '@/lib/notification-storage';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

// Maximum request body size: 10KB
const MAX_BODY_SIZE = 10 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(clientId, RATE_LIMITS.sendNotification);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.sendNotification.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

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
    const { fid, address, voteTime, blockTimestamp, network } = body;

    console.log(`📥 Received vote data:`, { 
      fid, 
      hasAddress: !!address, 
      addressPrefix: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,
      voteTime, 
      blockTimestamp,
      network 
    });

    // Validate FID
    if (!fid || typeof fid !== 'number' || fid <= 0) {
      console.warn('⚠️ Invalid FID in request');
      return NextResponse.json(
        { error: 'Valid FID is required' },
        { status: 400 }
      );
    }

    // Validate address format (basic Ethereum address validation)
    if (address && typeof address === 'string') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        console.warn('⚠️ Invalid address format');
        return NextResponse.json(
          { error: 'Invalid address format' },
          { status: 400 }
        );
      }
    }

    // Validate voteTime (should be a reasonable timestamp)
    if (voteTime && typeof voteTime === 'number') {
      const now = Math.floor(Date.now() / 1000);
      const maxAge = 7 * 24 * 60 * 60; // 7 days
      if (voteTime < now - maxAge || voteTime > now + 60) {
        console.warn('⚠️ Invalid voteTime');
        return NextResponse.json(
          { error: 'Invalid voteTime' },
          { status: 400 }
        );
      }
    }

    // Validate blockTimestamp if provided
    if (blockTimestamp !== undefined && blockTimestamp !== null) {
      if (typeof blockTimestamp !== 'number' || blockTimestamp <= 0) {
        return NextResponse.json(
          { error: 'blockTimestamp must be a positive number' },
          { status: 400 }
        );
      }
      const now = Math.floor(Date.now() / 1000);
      const maxAge = 7 * 24 * 60 * 60; // 7 days
      if (blockTimestamp < now - maxAge || blockTimestamp > now + 60) {
        return NextResponse.json(
          { error: 'blockTimestamp is out of valid range' },
          { status: 400 }
        );
      }
    }

    // Validate network parameter if provided
    if (network !== undefined && network !== null) {
      if (typeof network !== 'string') {
        return NextResponse.json(
          { error: 'network must be a string' },
          { status: 400 }
        );
      }
      // Limit network string length to prevent DoS
      if (network.length > 50) {
        return NextResponse.json(
          { error: 'network parameter is too long' },
          { status: 400 }
        );
      }
      // Sanitize network: only allow alphanumeric characters, hyphens, and underscores
      if (!/^[a-zA-Z0-9_-]+$/.test(network)) {
        return NextResponse.json(
          { error: 'network contains invalid characters' },
          { status: 400 }
        );
      }
    }

    // Save user vote information for cooldown tracking
    // Use blockTimestamp if available for more accurate cooldown calculation
    if (address && voteTime) {
      const addressMasked = address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : '***';
      console.log(`💾 Saving vote for FID ${fid}, address ${addressMasked}, network ${network || 'unknown'}`);
      await saveUserVote(fid, address, voteTime, blockTimestamp, network);
      console.log(`✅ Vote saved for FID ${fid}, notification scheduled (using ${blockTimestamp ? 'block' : 'approximate'} timestamp)`);
    } else {
      console.warn(`⚠️ Missing address or voteTime for FID ${fid}`);
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          'X-RateLimit-Limit': RATE_LIMITS.sendNotification.maxRequests.toString(),
          'X-RateLimit-Remaining': (rateLimitResult.remaining - 1).toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );
  } catch (error) {
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    console.error('❌ Send notification error:', error);
    if (error instanceof Error) {
      // Only log stack in development
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error stack:', error.stack);
      }
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

