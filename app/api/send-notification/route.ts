import { NextRequest, NextResponse } from 'next/server';
import { saveUserVote } from '@/lib/notification-storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Send notification error:', error);
    if (error instanceof Error) {
      console.error('❌ Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

