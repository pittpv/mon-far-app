'use client'

import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import { parseEther } from "viem";
import { getNetworkByChainId, getNetworkByKey, NETWORKS, ZERO_ADDRESS } from "@/lib/contract";
import {
  useAccount,
  useSendTransaction,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnect,
  usePublicClient,
} from "wagmi";
import { useEffect, useState, useMemo } from "react";
import { ConnectionModal } from "../ConnectionModal";

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function WalletActions() {
  const { isEthProviderAvailable, context } = useMiniAppContext();
  const { address, isConnected, status, chainId } = useAccount();
  const { data: hash, sendTransaction, isPending: isDonatePending } = useSendTransaction();
  const { switchChain } = useSwitchChain();
  const { data: voteTxHash, writeContract, isPending: isWriteContractPending, reset: resetWriteContract } = useWriteContract();
  const { connect, connectors, error: connectError } = useConnect();
  const publicClient = usePublicClient();
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentVoteTxHash, setCurrentVoteTxHash] = useState<`0x${string}` | undefined>();
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);
  const [isEstimatingGas, setIsEstimatingGas] = useState(false);

  // Get selected network from localStorage
  const [selectedNetworkKey, setSelectedNetworkKey] = useState<keyof typeof NETWORKS>('mainnet');

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

  // Get selected network from app (not wallet network)
  const selectedNetwork = useMemo(() => {
    return getNetworkByKey(selectedNetworkKey);
  }, [selectedNetworkKey]);

  // Get wallet network (if connected)
  const walletNetwork = useMemo(() => {
    if (chainId) {
      return getNetworkByChainId(chainId);
    }
    return null;
  }, [chainId]);

  // Check if wallet network matches selected app network
  const isNetworkMismatch = useMemo(() => {
    if (!isConnected || !chainId || !walletNetwork) return false;
    return walletNetwork.chainId !== selectedNetwork.chainId;
  }, [isConnected, chainId, walletNetwork, selectedNetwork]);

  // Use selected network for contract (app network, not wallet network)
  const currentNetwork = selectedNetwork;
  const contractAddress = currentNetwork?.contractAddress || ZERO_ADDRESS;
  const contractAbi = currentNetwork?.abi || [];
  // Statistics should always be available, voting requires wallet connection
  const isNetworkSupported = currentNetwork && contractAddress !== ZERO_ADDRESS && !isNetworkMismatch;
  const isNetworkAvailableForRead = currentNetwork && contractAddress !== ZERO_ADDRESS;

  // === All Hooks Called Unconditionally First ===
  // Statistics (votes) are always fetched regardless of wallet connection
  const { data: votes, refetch: refetchVotes } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "getVotes",
    query: { enabled: isNetworkAvailableForRead },
  });

  const { data: canVote, refetch: refetchCanVote } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "canVote",
    args: [address || "0x0"],
    query: { enabled: !!address && isNetworkSupported },
  });

  const { data: nextVoteTime, refetch: refetchTimeUntilNextVote } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "timeUntilNextVote",
    args: [address || "0x0"],
    query: { enabled: !!address && isNetworkSupported },
  });

  useEffect(() => {
    if (nextVoteTime) {
      setTimeLeft(Number(nextVoteTime));
      const iv = setInterval(() => setTimeLeft((t: number) => (t > 0 ? t - 1 : 0)), 1000);
      return () => clearInterval(iv);
    }
  }, [nextVoteTime]);

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash: currentVoteTxHash,
    query: {
      enabled: !!currentVoteTxHash,
    }
  });

  useEffect(() => {
    if (isConfirmed && address && receipt?.blockNumber) {
      // Always refetch votes (statistics) after vote
      if (isNetworkAvailableForRead) {
        refetchVotes();
      }
      // Only refetch user-specific data if wallet is connected
      if (isNetworkSupported) {
        refetchCanVote();
        refetchTimeUntilNextVote();
      }
      setCurrentVoteTxHash(undefined);
      resetWriteContract(); // Reset writeContract state
      
      // Register vote for notification cooldown tracking
      const fid = context?.user?.fid;
      if (fid && address) {
        // Get block timestamp for accurate cooldown calculation
        const blockNumber = receipt.blockNumber.toString();
        const networkKey = selectedNetworkKey;
        
        fetch(`/api/block-timestamp?blockNumber=${blockNumber}&network=${networkKey}`)
          .then(res => res.json())
          .then(data => {
            const blockTimestamp = data.timestamp || Math.floor(Date.now() / 1000);
            
            // Send vote information to server to schedule notification
            const addressMasked = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;
            console.log('📤 Sending vote to /api/send-notification:', { fid, addressMasked, voteTime: blockTimestamp, blockTimestamp, network: networkKey });
            return fetch('/api/send-notification', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                fid,
                address,
                voteTime: blockTimestamp, // Block timestamp in seconds
                blockTimestamp, // Explicit block timestamp
                network: networkKey, // Network identifier (e.g., "mainnet", "baseMainnet", "testnet")
              }),
            })
            .then(res => {
              console.log('📥 Response from /api/send-notification:', res.status, res.statusText);
              return res.json();
            })
            .then(data => {
              console.log('✅ Vote registration response:', data);
            });
          })
          .catch((error) => {
            console.error('❌ Failed to register vote for notifications:', error);
            // Fallback: send without block timestamp
            console.log('🔄 Trying fallback without block timestamp');
            fetch('/api/send-notification', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                fid,
                address,
                voteTime: Math.floor(Date.now() / 1000),
              }),
            })
            .then(res => {
              console.log('📥 Fallback response:', res.status);
              return res.json();
            })
            .then(data => {
              console.log('✅ Fallback response:', data);
            })
            .catch(err => console.error('❌ Fallback notification registration failed:', err));
          });
      }
    }
  }, [isConfirmed, address, receipt, context, selectedNetworkKey, isNetworkAvailableForRead, isNetworkSupported, refetchVotes, refetchCanVote, refetchTimeUntilNextVote, resetWriteContract]);

  // Refetch data when network changes
  useEffect(() => {
    if (isNetworkAvailableForRead) {
      refetchVotes();
    }
    if (isNetworkSupported) {
      refetchCanVote();
      refetchTimeUntilNextVote();
    }
  }, [selectedNetworkKey, isNetworkSupported, isNetworkAvailableForRead, refetchVotes, refetchCanVote, refetchTimeUntilNextVote]);

  // Close donate modal when wallet is connected
  useEffect(() => {
    if (isConnected && isDonateModalOpen) {
      setIsDonateModalOpen(false);
    }
  }, [isConnected, isDonateModalOpen]);

  // Statistics are always shown, voting controls only when connected

  // Define handlers and UI logic only if we are going to render the main component
  const handleVote = async (isHappy: boolean) => {
    if (!isNetworkSupported || !publicClient || !address) return;
    
    setIsEstimatingGas(true);
    
    try {
      // Estimate gas for the transaction
      const voteType = isHappy ? "Happy" : "Sad";
      console.log(`📊 [Vote] Estimating gas for ${voteType} vote...`);
      
      let estimatedGas: bigint;
      try {
        estimatedGas = await publicClient.estimateContractGas({
          address: contractAddress,
          abi: contractAbi,
          functionName: "vote",
          args: [isHappy],
          account: address,
        });
      } catch (estErr) {
        console.error(`❌ [Vote] Gas estimation failed:`, estErr);
        // If estimation fails, use default values
        estimatedGas = isHappy ? 95000n : 110000n;
        console.warn(`⚠️ [Vote] Using default gas limit:`, estimatedGas.toString());
      }

      // Increase gas limit: 1.5x for Happy, 1.7x for Sad
      const multiplier = isHappy ? 150n : 170n; // 1.5x for Happy, 1.7x for Sad
      const increasedGasLimit = (estimatedGas * multiplier) / 100n;

      console.log(`✅ [Vote] Gas estimation for ${voteType} vote:`, {
        estimated: estimatedGas.toString(),
        increased: increasedGasLimit.toString(),
        multiplier: isHappy ? "1.5x" : "1.7x",
        voteType
      });

      console.log(`📤 [Vote] Sending ${voteType} vote transaction with gasLimit:`, increasedGasLimit.toString());

      // Send transaction with increased gas limit
      writeContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: "vote",
        args: [isHappy],
        gas: increasedGasLimit, // Explicitly set increased gas limit
      }, {
        onSuccess: (hash: `0x${string}`) => {
          console.log(`✅ [Vote] ${voteType} vote transaction sent, hash:`, hash);
          setCurrentVoteTxHash(hash);
        },
        onError: (error) => {
          console.error(`❌ [Vote] Error sending ${voteType} vote transaction:`, error);
        }
      });
    } catch (error) {
      console.error(`❌ [Vote] Error in vote transaction:`, error);
    } finally {
      setIsEstimatingGas(false);
    }
  };

  // Get donation amount and token based on selected network
  const donationConfig = useMemo(() => {
    if (selectedNetworkKey === 'mainnet') {
      return { amount: '50', token: 'MON' };
    } else if (selectedNetworkKey === 'testnet') {
      return { amount: '1', token: 'MON' };
    } else if (selectedNetworkKey === 'baseMainnet') {
      return { amount: '0.0005', token: 'ETH' };
    }
    return { amount: '1', token: 'MON' }; // default
  }, [selectedNetworkKey]);

  async function sendTransactionHandler() {
    if (!isConnected) {
      setIsDonateModalOpen(true);
      return;
    }
    
    sendTransaction({
      to: "0x1f1dd9c30181e8e49D5537Bc3E81c33896e778Bd",
      value: parseEther(donationConfig.amount),
    });
  }

  const votesData: [bigint, bigint] | undefined = Array.isArray(votes) ? votes as [bigint, bigint] : undefined;
  const [happyVotes, sadVotes] = votesData || [0n, 0n];
  const total = happyVotes + sadVotes;
  const happyPct = total > 0n ? Math.round(Number((happyVotes * 100n) / total)) : 0;
  const sadPct = total > 0n ? 100 - happyPct : 0;

  return (
    <div className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-md text-black dark:text-white transition-colors duration-300">
      <h2 className="text-2xl font-semibold mb-4">Vote Your Feelings</h2>

      {/* Statistics - Always visible */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-4">
        <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Current Mood</h4>
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex relative mb-2">
          <div className="bg-green-500 h-full flex items-center justify-center transition-all duration-500" style={{ width: `${happyPct}%` }}>
            {happyPct > 10 && <span className="text-sm font-medium text-white">{happyPct}%</span>}
          </div>
          <div className="bg-red-500 h-full flex items-center justify-center transition-all duration-500" style={{ width: `${sadPct}%` }}>
            {sadPct > 10 && <span className="text-sm font-medium text-white">{sadPct}%</span>}
          </div>
        </div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
          <span>😊 Happy ({happyPct}%)</span>
          <span>😢 Sad ({sadPct}%)</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Total votes: <strong>{total.toString()}</strong>
        </p>
      </div>

      {/* Voting controls - Only when connected */}
      {!isConnected && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
          <strong>Connect a wallet to vote and track your cooldown.</strong>
        </p>
      )}

      {isConnected && isNetworkMismatch && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
            ⚠️ Wrong network. Your wallet is on {walletNetwork?.label || 'unknown network'}, but the app is configured for {selectedNetwork.label}.
          </p>
          {selectedNetwork && switchChain && (
            <button
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-semibold transition-colors"
              onClick={() => switchChain({ chainId: selectedNetwork.chainId })}
            >
              Switch to {selectedNetwork.label}
            </button>
          )}
        </div>
      )}

      {isConnected && isNetworkSupported && (
        <>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <button
              onClick={() => handleVote(true)}
              disabled={!canVote || isWriteContractPending || isConfirming || isEstimatingGas}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
            >
              😊 I&apos;m Happy
            </button>
            <button
              onClick={() => handleVote(false)}
              disabled={!canVote || isWriteContractPending || isConfirming || isEstimatingGas}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
            >
              😢 I&apos;m Sad
            </button>
          </div>

          {(isEstimatingGas || isWriteContractPending || isConfirming) && (
            <p className="text-sm text-blue-500 mb-4 text-center">
              {isEstimatingGas ? "Estimating gas..." : isWriteContractPending ? "Submitting your vote..." : "Confirming transaction..."}
            </p>
          )}

          {!canVote && !(isWriteContractPending || isConfirming) && timeLeft > 0 && (
            <div className="mb-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                You&apos;ve already voted. Next vote in:
              </p>
              <p className="text-lg font-bold text-orange-500 dark:text-orange-400">
                {formatTime(timeLeft)}
              </p>
            </div>
          )}
        </>
      )}

      {/* Donate button - always visible */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={sendTransactionHandler}
          disabled={isDonatePending}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
        >
          {isDonatePending ? '⏳ Sending...' : `💝 Donate ${donationConfig.amount} ${donationConfig.token}`}
        </button>
        {!isConnected && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Connect wallet to donate
          </p>
        )}
        {hash && (
          <p className="text-sm text-blue-500 mt-2 text-center">
            Transaction sent! Hash: {hash.slice(0, 10)}...
          </p>
        )}
      </div>

      <ConnectionModal
        isOpen={isDonateModalOpen}
        onClose={() => setIsDonateModalOpen(false)}
        connectors={connectors}
        connect={connect}
        connectError={connectError}
      />
    </div>
  );
}




