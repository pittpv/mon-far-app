'use client';

import type { Connector } from 'wagmi';
// No longer need ConnectVariables from wagmi/query for this specific typing
import { FaWallet, FaQrcode } from 'react-icons/fa';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectors: readonly Connector[];
  connect: (args: { connector: Connector; chainId?: number | undefined; }) => void;
}

export function ConnectionModal({ isOpen, onClose, connectors, connect }: ConnectionModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300 ease-in-out"
      onClick={onClose} // Close on overlay click
    >
      <div
        className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="space-y-4">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => {
                connect({ connector });
                onClose();
              }}
              className="w-full flex items-center justify-center gap-3 p-4 border border-gray-300 dark:border-gray-700 rounded-xl shadow-md bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-medium transition-all duration-200 ease-in-out hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              {connector.name === 'WalletConnect' ? <FaQrcode className="text-blue-500 h-5 w-5" /> : <FaWallet className="text-yellow-500 h-5 w-5" />}
              <span>{connector.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
