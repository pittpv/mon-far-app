import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { getNetworkByKey, NETWORKS } from '@/lib/contract';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const blockNumber = searchParams.get('blockNumber');
    const networkKey = searchParams.get('network') as keyof typeof NETWORKS || 'mainnet';

    if (!blockNumber) {
      return NextResponse.json(
        { error: 'blockNumber is required' },
        { status: 400 }
      );
    }

    // Validate blockNumber is a valid positive integer
    if (!/^\d+$/.test(blockNumber)) {
      return NextResponse.json(
        { error: 'blockNumber must be a valid positive integer' },
        { status: 400 }
      );
    }

    // Validate blockNumber is within reasonable bounds (prevent DoS)
    const blockNumberBigInt = BigInt(blockNumber);
    if (blockNumberBigInt < 0n || blockNumberBigInt > 2n ** 64n - 1n) {
      return NextResponse.json(
        { error: 'blockNumber is out of valid range' },
        { status: 400 }
      );
    }

    // Validate network key is one of the allowed values
    const allowedNetworks = Object.keys(NETWORKS) as Array<keyof typeof NETWORKS>;
    if (!allowedNetworks.includes(networkKey)) {
      return NextResponse.json(
        { error: `Invalid network. Allowed values: ${allowedNetworks.join(', ')}` },
        { status: 400 }
      );
    }

    const network = getNetworkByKey(networkKey);
    if (!network) {
      return NextResponse.json(
        { error: 'Invalid network' },
        { status: 400 }
      );
    }

    // Create public client for the network
    const publicClient = createPublicClient({
      chain: network.chain,
      transport: http(),
    });

    // Get block by number
    const block = await publicClient.getBlock({
      blockNumber: blockNumberBigInt,
    });

    // Return timestamp in seconds
    return NextResponse.json({
      timestamp: Number(block.timestamp),
      blockNumber: block.number.toString(),
    });
  } catch (error) {
    console.error('❌ Error getting block timestamp:', error);
    return NextResponse.json(
      { error: 'Failed to get block timestamp' },
      { status: 500 }
    );
  }
}



