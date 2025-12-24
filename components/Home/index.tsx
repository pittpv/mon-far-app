"use client";

import { FarcasterActions } from "@/components/Home/FarcasterActions";
import { User } from "@/components/Home/User";
import { WalletActions } from "@/components/Home/WalletActions";
import { Leaderboard } from "@/components/Leaderboard";
import { HeaderActions } from "@/components/HeaderActions";
import { motion } from "framer-motion";
import { useAccount, useReadContract } from "wagmi";
import { getNetworkByChainId, getNetworkByKey, NETWORKS, ZERO_ADDRESS } from "@/lib/contract";
import { useMemo, useState, useEffect } from "react";

export default function Home() {
  const { chainId } = useAccount();
  const [selectedNetworkKey, setSelectedNetworkKey] = useState<keyof typeof NETWORKS>('mainnet');
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Get selected network from localStorage
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

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!tooltipVisible) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!event || !event.target) return;

      try {
        const container = document.querySelector('.refund-badge-container');
        if (container && typeof container === 'object' && container.nodeType === 1) {
          if (container.contains && container.contains(event.target as Node)) {
            return; // Click inside container
          }
          setTooltipVisible(false);
        }
      } catch (err) {
        console.warn("Error in handleClickOutside:", err);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [tooltipVisible]);
  
  // Get network label - prefer connected chain, otherwise use selected network from localStorage
  const currentNetwork = useMemo(() => {
    if (chainId) {
      const network = getNetworkByChainId(chainId);
      if (network) return network;
    }
    // Use selected network from state
    return getNetworkByKey(selectedNetworkKey);
  }, [chainId, selectedNetworkKey]);
  
  const networkLabel = currentNetwork?.label || 'Monad';

  // Check if refund is enabled (only if function exists in ABI)
  const hasRefundEnabled = currentNetwork?.abi?.some((item: any) => 
    item.type === 'function' && item.name === 'refundEnabled'
  ) || false;

  const contractAddress = currentNetwork?.contractAddress || ZERO_ADDRESS;
  const contractAbi = currentNetwork?.abi || [];
  const isNetworkSupported = currentNetwork && contractAddress !== ZERO_ADDRESS;

  const { data: refundEnabled } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "refundEnabled",
    query: { enabled: hasRefundEnabled && isNetworkSupported },
  });

  // Convert refundEnabled to boolean
  const isRefundEnabled = useMemo(() => {
    if (!hasRefundEnabled || refundEnabled === undefined) return false;
    if (typeof refundEnabled === 'boolean') return refundEnabled;
    if (typeof refundEnabled === 'string') {
      return refundEnabled.toLowerCase() === 'true' || refundEnabled === '1';
    }
    if (typeof refundEnabled === 'number' || typeof refundEnabled === 'bigint') {
      return Number(refundEnabled) !== 0;
    }
    return Boolean(refundEnabled);
  }, [refundEnabled, hasRefundEnabled]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 transition-colors duration-300">
      <HeaderActions />
      
      <motion.div
        className="flex justify-center items-center gap-3 flex-wrap mb-10 mt-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-center text-black dark:text-white leading-tight">
          Make the world happier 🌍
        </h1>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${
          currentNetwork.key === 'mainnet' || currentNetwork.key === 'baseMainnet'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
        }`}>
          {currentNetwork.label}
        </span>
        {isRefundEnabled && (
          <div
            className={`refund-badge-container ${tooltipVisible ? 'tooltip-visible' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setTooltipVisible(!tooltipVisible);
            }}
          >
            <span className="refund-badge" title="Gas refund is enabled">
              💰 Gas Refund
            </span>
            <div className="refund-tooltip">
              Gas refund is active! When you vote, a portion of your transaction fee will be automatically refunded to your wallet.
            </div>
          </div>
        )}
      </motion.div>

      <motion.p
        className="text-sm text-gray-600 dark:text-gray-400 text-center mb-8 max-w-2xl mx-auto leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        The app is designed to highlight the abundance of positivity around us and to track the overall mood of users across the {networkLabel} network.
      </motion.p>

      <div className="w-full max-w-5xl space-y-6">
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <WalletActions />
        </motion.div>

        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <Leaderboard />
        </motion.div>

        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          <User />
        </motion.div>

        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
        >
          <FarcasterActions />
        </motion.div>
      </div>
    </div>
  );
}
