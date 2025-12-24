'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSwitchChain, useChainId } from 'wagmi';
import { NETWORKS, getNetworkByChainId, getNetworkByKey } from '@/lib/contract';

interface NetworkIconProps {
  networkKey: string;
  isMainnet: boolean;
}

function NetworkIcon({ networkKey, isMainnet }: NetworkIconProps) {
  // Base Mainnet icon
  if (networkKey === 'baseMainnet') {
    return (
      <svg width="20" height="20" viewBox="0 0 249 249" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 19.671C0 12.9332 0 9.56425 1.26956 6.97276C2.48511 4.49151 4.49151 2.48511 6.97276 1.26956C9.56425 0 12.9332 0 19.671 0H229.329C236.067 0 239.436 0 242.027 1.26956C244.508 2.48511 246.515 4.49151 247.73 6.97276C249 9.56425 249 12.9332 249 19.671V229.329C249 236.067 249 239.436 247.73 242.027C246.515 244.508 244.508 246.515 242.027 247.73C239.436 249 236.067 249 229.329 249H19.671C12.9332 249 9.56425 249 6.97276 247.73C4.49151 246.515 2.48511 244.508 1.26956 242.027C0 239.436 0 236.067 0 229.329V19.671Z" fill="#0000FF"/>
      </svg>
    );
  }
  
  // Monad icon
  const iconColor = isMainnet ? "#836EF9" : "#9CA3AF";
  
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_3845_96712)">
        <path d="M9.99994 0C7.11219 0 0 7.112 0 9.99994C0 12.8879 7.11219 20 9.99994 20C12.8877 20 20 12.8877 20 9.99994C20 7.11212 12.8878 0 9.99994 0ZM8.44163 15.7183C7.22388 15.3864 3.94988 9.65938 4.28177 8.44163C4.61366 7.22381 10.3406 3.94987 11.5583 4.28175C12.7761 4.61358 16.0501 10.3406 15.7183 11.5584C15.3864 12.7761 9.65938 16.0501 8.44163 15.7183Z" fill={iconColor}></path>
      </g>
      <defs>
        <clipPath id="clip0_3845_96712">
          <rect width="20" height="20" fill="white"></rect>
        </clipPath>
      </defs>
    </svg>
  );
}

export function NetworkSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<keyof typeof NETWORKS>('mainnet');
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const currentChainId = useChainId();

  // Initialize from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('happy-vote-network');
      if (stored && NETWORKS[stored as keyof typeof NETWORKS]) {
        setSelectedNetwork(stored as keyof typeof NETWORKS);
      }
    }
  }, []);

  // Sync with current chain
  useEffect(() => {
    if (currentChainId) {
      const network = getNetworkByChainId(currentChainId);
      if (network) {
        setSelectedNetwork(network.key as keyof typeof NETWORKS);
      }
    }
  }, [currentChainId]);

  // Save to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('happy-vote-network', selectedNetwork);
    }
  }, [selectedNetwork]);

  const handleNetworkChange = useCallback(async (networkKey: keyof typeof NETWORKS) => {
    const network = getNetworkByKey(networkKey);
    if (!network) return;

    setSelectedNetwork(networkKey);
    setIsOpen(false);

    // Dispatch custom event to notify other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('network-changed', { detail: networkKey }));
    }

    if (switchChain && currentChainId !== network.chainId) {
      try {
        await switchChain({ chainId: network.chainId });
      } catch (error) {
        console.error('Failed to switch network:', error);
      }
    }
  }, [switchChain, currentChainId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.network-dropdown-container')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentNetwork = getNetworkByKey(selectedNetwork);
  const isMainnet = selectedNetwork === 'mainnet' || selectedNetwork === 'baseMainnet';

  return (
    <div className="network-dropdown-container relative">
      <button
        className="network-selector-button flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer transition-all text-sm font-medium text-gray-800 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 h-9"
        onClick={() => setIsOpen(!isOpen)}
      >
        <NetworkIcon networkKey={selectedNetwork} isMainnet={isMainnet} />
        <span className="hidden sm:inline">
          {currentNetwork?.label}
        </span>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 12 12" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg" 
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M6 9L1 4H11L6 9Z" fill="currentColor"/>
        </svg>
      </button>

      {isOpen && (
        <div className="network-dropdown absolute top-full left-0 right-auto mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg min-w-[180px] z-50 overflow-hidden">
          {/* Порядок сетей: Base, Monad, Monad Testnet */}
          {(['baseMainnet', 'mainnet', 'testnet'] as Array<keyof typeof NETWORKS>).map((networkKey) => {
            const network = NETWORKS[networkKey];
            if (!network) return null;
            const isNetworkMainnet = networkKey === 'mainnet' || networkKey === 'baseMainnet';
            return (
              <button
                key={networkKey}
                className={`network-dropdown-item flex items-center gap-2 w-full px-3 py-2.5 bg-transparent border-none text-left cursor-pointer text-sm font-medium transition-colors ${
                  selectedNetwork === networkKey
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => handleNetworkChange(networkKey)}
              >
                <NetworkIcon networkKey={networkKey} isMainnet={isNetworkMainnet} />
                <span>
                  {network.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

