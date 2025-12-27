import { NextRequest, NextResponse } from 'next/server';
import { getNotificationToken } from '@/lib/notification-storage';

/**
 * Public endpoint to check if MiniApp is added for a specific FID
 * Returns only boolean status, no sensitive data
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fidParam = searchParams.get('fid');
  
  if (!fidParam) {
    return NextResponse.json(
      { error: 'fid parameter is required' },
      { status: 400 }
    );
  }

  const fid = parseInt(fidParam, 10);
  
  if (isNaN(fid) || fid <= 0) {
    return NextResponse.json(
      { error: 'Invalid fid parameter' },
      { status: 400 }
    );
  }

  try {
    const tokenData = await getNotificationToken(fid);
    return NextResponse.json({
      hasToken: !!tokenData,
    });
  } catch (error) {
    console.error('Error checking MiniApp status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



