'use client';

import React, { useState } from 'react';
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { ThemeToggle } from './ThemeToggle';
import { NetworkSelector } from './NetworkSelector';
import { ConnectionModal } from './ConnectionModal';

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.6667 4.16667H15.8333V2.5C15.8333 1.57917 15.0875 0.833336 14.1667 0.833336H2.5C1.57917 0.833336 0.833336 1.57917 0.833336 2.5V17.5C0.833336 18.4208 1.57917 19.1667 2.5 19.1667H14.1667C15.0875 19.1667 15.8333 18.4208 15.8333 17.5V15.8333H16.6667C17.5875 15.8333 18.3333 15.0875 18.3333 14.1667V5.83333C18.3333 4.9125 17.5875 4.16667 16.6667 4.16667ZM14.1667 17.5H2.5V2.5H14.1667V4.16667H8.33334C7.4125 4.16667 6.66667 4.9125 6.66667 5.83333V14.1667C6.66667 15.0875 7.4125 15.8333 8.33334 15.8333H14.1667V17.5ZM16.6667 14.1667H8.33334V5.83333H16.6667V14.1667Z" fill="currentColor"/>
    </svg>
  );
}

function formatAddressShort(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function HeaderActions() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors, error: connectError } = useConnect();
  
  // Логируем доступные коннекторы для отладки
  React.useEffect(() => {
    if (connectors.length > 0) {
      console.log('🔌 Available wallet connectors:', connectors.map(c => ({ id: c.id, name: c.name, ready: c.ready })));
    }
  }, [connectors]);
  
  // Логируем ошибки подключения
  React.useEffect(() => {
    if (connectError) {
      console.error('❌ Connection error:', connectError);
      if (connectError.message?.includes('Unauthorized') || connectError.message?.includes('origin not allowed')) {
        console.error('💡 This is a Reown/WalletConnect domain authorization error!');
        console.error('   Make sure your domain is added to Reown Dashboard: https://dashboard.reown.com');
        console.error('   Current origin:', typeof window !== 'undefined' ? window.location.origin : 'unknown');
      }
    }
  }, [connectError]);

  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 flex-wrap">
        <NetworkSelector />
        
        {isConnected && address ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm h-9">
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {formatAddressShort(address)}
            </span>
            <button
              onClick={() => disconnect()}
              className="px-2 py-0.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors font-semibold"
              aria-label="Disconnect wallet"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer transition-all text-sm font-medium text-gray-800 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 h-9"
            aria-label="Connect wallet"
          >
            <WalletIcon />
            <span className="hidden sm:inline">Connect Wallet</span>
          </button>
        )}

        <ThemeToggle />
      </div>
      <ConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        connectors={connectors}
        connect={connect}
        connectError={connectError}
      />
    </>
  );
}
