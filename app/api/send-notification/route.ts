import { NextRequest, NextResponse } from 'next/server';
import { saveUserVote } from '@/lib/notification-storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, address, voteTime, blockTimestamp } = body;

    console.log(`📥 Received vote data:`, JSON.stringify({ fid, hasAddress: !!address, voteTime, blockTimestamp }, null, 2));

    if (!fid) {
      console.warn('⚠️ FID is missing in request');
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    // Save user vote information for cooldown tracking
    // Use blockTimestamp if available for more accurate cooldown calculation
    if (address && voteTime) {
      console.log(`💾 Saving vote for FID ${fid}, address ${address}`);
      await saveUserVote(fid, address, voteTime, blockTimestamp);
      console.log(`✅ Vote saved for FID ${fid}, notification scheduled (using ${blockTimestamp ? 'block' : 'approximate'} timestamp)`);
    } else {
      console.warn(`⚠️ Missing address or voteTime:`, JSON.stringify({ address, voteTime }, null, 2));
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

