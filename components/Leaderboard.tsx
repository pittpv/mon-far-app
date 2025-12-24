'use client';

import { useReadContract } from 'wagmi';
import { useMemo, useState, useEffect } from 'react';
import { NETWORKS, getNetworkByChainId, getNetworkByKey } from '@/lib/contract';
import { useAccount } from 'wagmi';

function formatAddressShort(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface LeaderboardProps {
  networkKey?: keyof typeof NETWORKS;
}

export function Leaderboard({ networkKey }: LeaderboardProps) {
  const { chainId } = useAccount();
  const [showExtra, setShowExtra] = useState(false);
  const [selectedNetworkKey, setSelectedNetworkKey] = useState<keyof typeof NETWORKS>('mainnet');

  // Get selected network from localStorage or use provided networkKey
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('happy-vote-network');
      if (stored && NETWORKS[stored as keyof typeof NETWORKS]) {
        setSelectedNetworkKey(stored as keyof typeof NETWORKS);
      }
    }

    // Listen for storage changes (when network is changed in NetworkSelector)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'happy-vote-network' && e.newValue && NETWORKS[e.newValue as keyof typeof NETWORKS]) {
        setSelectedNetworkKey(e.newValue as keyof typeof NETWORKS);
      }
    };

    // Listen for custom event (for same-tab changes)
    const handleNetworkChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail && NETWORKS[customEvent.detail as keyof typeof NETWORKS]) {
        setSelectedNetworkKey(customEvent.detail as keyof typeof NETWORKS);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('network-changed', handleNetworkChange as EventListener);

    // Also poll localStorage periodically to catch changes
    const interval = setInterval(() => {
      const stored = localStorage.getItem('happy-vote-network');
      if (stored && NETWORKS[stored as keyof typeof NETWORKS] && stored !== selectedNetworkKey) {
        setSelectedNetworkKey(stored as keyof typeof NETWORKS);
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('network-changed', handleNetworkChange as EventListener);
      clearInterval(interval);
    };
  }, [selectedNetworkKey]);

  // Determine which network to use
  // Always prefer app's selected network (not wallet network) unless networkKey prop is explicitly provided
  const activeNetwork = useMemo(() => {
    if (networkKey) {
      return NETWORKS[networkKey];
    }
    // Use selected network from app (localStorage), not wallet network
    return getNetworkByKey(selectedNetworkKey);
  }, [networkKey, selectedNetworkKey]);

  const { data: leaderboardData, isLoading } = useReadContract({
    address: activeNetwork.contractAddress,
    abi: activeNetwork.abi,
    functionName: 'getHappyLeaderboard',
    query: {
      enabled: activeNetwork.hasLeaderboard && activeNetwork.contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  const leaderboard = useMemo(() => {
    if (!leaderboardData || !Array.isArray(leaderboardData) || leaderboardData.length !== 2) {
      return [];
    }

    const [addresses, counts] = leaderboardData as [string[], bigint[]];
    if (!addresses || !counts || addresses.length !== counts.length) {
      return [];
    }

    return addresses
      .map((address, index) => ({
        address,
        happyVotes: Number(counts[index] || 0n),
      }))
      .filter((row) => row.address && row.happyVotes > 0)
      .sort((a, b) => b.happyVotes - a.happyVotes);
  }, [leaderboardData]);

  const topLeaderboard = leaderboard.slice(0, 10);
  const extraLeaderboard = leaderboard.slice(10);

  if (!activeNetwork.hasLeaderboard) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-md transition-colors duration-300">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-md transition-colors duration-300">
      <div className="flex justify-between items-baseline gap-2 flex-wrap mb-4">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white m-0">Happy Leaderboard</h3>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Top smiles on {activeNetwork.label}
        </span>
      </div>

      {topLeaderboard.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 my-4">
          Be the first happy voter on {activeNetwork.label}!
        </p>
      ) : (
        <>
          <ol className="list-none p-0 m-4 max-h-[440px] overflow-y-auto overflow-x-hidden">
            {topLeaderboard.map((row, index) => (
              <li
                key={`${row.address}-${index}`}
                className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                <span className="font-bold text-blue-600 dark:text-blue-400 w-12">#{index + 1}</span>
                <span className="flex-1 font-mono text-sm text-gray-800 dark:text-gray-200">
                  {formatAddressShort(row.address)}
                </span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {row.happyVotes} 😊
                </span>
              </li>
            ))}
          </ol>

          {extraLeaderboard.length > 0 && (
            <details className="mt-4">
              <summary
                className="cursor-pointer font-semibold text-blue-600 dark:text-blue-400 mb-2"
                onClick={() => setShowExtra(!showExtra)}
              >
                Show the rest ({extraLeaderboard.length})
              </summary>
              {showExtra && (
                <div className="max-h-[200px] overflow-y-auto pr-2">
                  <ol className="list-none p-0 m-0" start={11}>
                    {extraLeaderboard.map((row, index) => (
                      <li
                        key={`${row.address}-${index + 10}`}
                        className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                      >
                        <span className="font-bold text-blue-600 dark:text-blue-400 w-12">
                          #{index + 11}
                        </span>
                        <span className="flex-1 font-mono text-sm text-gray-800 dark:text-gray-200">
                          {formatAddressShort(row.address)}
                        </span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {row.happyVotes} 😊
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </details>
          )}
        </>
      )}
    </div>
  );
}

