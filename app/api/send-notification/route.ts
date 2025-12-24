import { NextRequest, NextResponse } from 'next/server';
import { saveUserVote } from '@/lib/notification-storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, address, voteTime, blockTimestamp } = body;

    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    // Save user vote information for cooldown tracking
    // Use blockTimestamp if available for more accurate cooldown calculation
    if (address && voteTime) {
      await saveUserVote(fid, address, voteTime, blockTimestamp);
      console.log(`✅ Vote saved for FID ${fid}, notification scheduled (using ${blockTimestamp ? 'block' : 'approximate'} timestamp)`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Send notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

