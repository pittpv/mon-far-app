'use client';

import { useState } from 'react';
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { ThemeToggle } from './ThemeToggle';
import { FiLogIn, FiLogOut } from 'react-icons/fi';
import { ConnectionModal } from './ConnectionModal';

export function HeaderActions() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();

  return (
    <>
      <div className="flex items-center space-x-3">
        <ThemeToggle />
        {isConnected ? (
          <button
            onClick={() => disconnect()}
            className="p-2 rounded-lg transition-colors duration-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            aria-label="Disconnect wallet"
          >
            <FiLogOut className="h-5 w-5 text-gray-700 dark:text-gray-200" />
          </button>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)} // Open modal
            className="p-2 rounded-lg transition-colors duration-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            aria-label="Connect wallet"
          >
            <FiLogIn className="h-5 w-5 text-gray-700 dark:text-gray-200" />
          </button>
        )}
      </div>
      <ConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        connectors={connectors}
        connect={connect}
      />
    </>
  );
}
