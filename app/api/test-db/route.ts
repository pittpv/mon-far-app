import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseAdapter } from '@/lib/db-adapter';

export async function GET(request: NextRequest) {
  try {
    const adapter = getDatabaseAdapter();
    
    // Test 1: Try to get all tokens (tests connection)
    let allTokens;
    try {
      allTokens = await adapter.getAllTokens();
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }, { status: 500 });
    }
    
    // Test 2: Try to insert a test record
    let testInsertSuccess = false;
    let testInsertError = null;
    try {
      await adapter.saveNotificationToken({
        fid: 999999,
        token: 'test-token',
        url: 'https://test.com',
      });
      testInsertSuccess = true;
      
      // Clean up test record
      try {
        await adapter.removeNotificationToken(999999);
      } catch (e) {
        // Ignore cleanup errors
      }
    } catch (error: any) {
      testInsertError = error.message;
    }
    
    // Test 3: Check environment variables
    const envVars = {
      NOTIFICATION_STORAGE_TYPE: process.env.NOTIFICATION_STORAGE_TYPE,
      DATABASE_URL: process.env.DATABASE_URL ? '***set***' : 'not set',
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? '***set***' : 'not set',
      POSTGRES_HOST: process.env.POSTGRES_HOST || 'not set',
      POSTGRES_DATABASE: process.env.POSTGRES_DATABASE || 'not set',
      POSTGRES_USER: process.env.POSTGRES_USER || 'not set',
      POSTGRES_PORT: process.env.POSTGRES_PORT || 'not set',
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ? '***set***' : 'not set',
    };
    
    return NextResponse.json({
      success: true,
      connection: 'OK',
      totalTokens: allTokens.length,
      testInsert: testInsertSuccess ? 'OK' : `Failed: ${testInsertError}`,
      environment: envVars,
      tokens: allTokens.map(t => ({
        fid: t.fid,
        hasToken: !!t.token,
        hasAddress: !!t.address,
        lastVoteTime: t.lastVoteTime,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

