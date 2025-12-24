'use client';

import React from 'react';
import type { Connector } from 'wagmi';
import { useAccount } from 'wagmi';
import { FaWallet, FaQrcode } from 'react-icons/fa';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectors: readonly Connector[];
  connect: (args: { connector: Connector; chainId?: number | undefined; }) => void;
  connectError?: Error | null;
}

export function ConnectionModal({ isOpen, onClose, connectors, connect, connectError }: ConnectionModalProps) {
  const [connectingConnectorId, setConnectingConnectorId] = React.useState<string | null>(null);
  const { isConnected, status } = useAccount();
  
  // Логируем изменения статуса подключения
  React.useEffect(() => {
    console.log('📊 Account status changed:', { isConnected, status });
  }, [isConnected, status]);

  // Отслеживаем успешное подключение
  React.useEffect(() => {
    // Закрываем модальное окно когда подключение успешно завершено
    if (isConnected && connectingConnectorId) {
      console.log('✅ Connection successful, closing modal');
      // Небольшая задержка для WalletConnect, чтобы убедиться что подключение полностью завершено
      const timer = setTimeout(() => {
        onClose();
        setConnectingConnectorId(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isConnected, connectingConnectorId, onClose]);

  // Обрабатываем ошибки подключения
  React.useEffect(() => {
    if (connectError) {
      console.error('❌ Connection error detected:', connectError);
      console.error('Error details:', {
        message: connectError.message,
        name: connectError.name,
        stack: connectError.stack,
        cause: (connectError as any).cause,
      });
      
      // Проверяем, является ли это ошибкой авторизации домена
      const isDomainError = connectError.message?.includes('Unauthorized') || 
                           connectError.message?.includes('origin not allowed') ||
                           connectError.message?.includes('3000');
      
      if (isDomainError) {
        console.error('🚨 DOMAIN AUTHORIZATION ERROR');
        console.error('   This domain must be added to Reown Dashboard:');
        console.error(`   ${typeof window !== 'undefined' ? window.location.origin : 'unknown'}`);
        console.error('   Go to: https://dashboard.reown.com');
      }
      
      if (connectingConnectorId) {
        setConnectingConnectorId(null);
      }
    }
  }, [connectError, connectingConnectorId]);
  
  // Отслеживаем застревание в состоянии connecting
  React.useEffect(() => {
    if (connectingConnectorId && status === 'connecting') {
      const timeout = setTimeout(() => {
        if (status === 'connecting' && !isConnected) {
          console.warn('⚠️ Connection stuck in "connecting" state - likely domain authorization issue');
          console.warn('   Check Reown Dashboard: https://dashboard.reown.com');
          console.warn(`   Domain: ${typeof window !== 'undefined' ? window.location.origin : 'unknown'}`);
          setConnectingConnectorId(null);
        }
      }, 5000); // 5 секунд таймаут
      
      return () => clearTimeout(timeout);
    }
  }, [connectingConnectorId, status, isConnected]);

  React.useEffect(() => {
    if (!isOpen) {
      setConnectingConnectorId(null);
    }
  }, [isOpen]);

  // Дополнительная проверка: закрываем модальное окно если подключение завершено, даже если connectingConnectorId был сброшен
  React.useEffect(() => {
    if (isOpen && isConnected && !connectingConnectorId) {
      // Если модальное окно открыто, но подключение уже завершено, закрываем его
      const timer = setTimeout(() => {
        onClose();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isConnected, connectingConnectorId, onClose]);

  const handleConnect = async (connector: Connector) => {
    setConnectingConnectorId(connector.id);
    
    console.log(`🔌 Attempting to connect with ${connector.name} (${connector.id})`);
    console.log('📊 Connector state:', {
      id: connector.id,
      name: connector.name,
      ready: connector.ready,
      type: connector.type,
    });
    
    // Для WalletConnect проверяем готовность и показываем сообщение об ошибке домена
    const isWalletConnect = connector.id === 'walletConnect' || connector.name === 'WalletConnect';
    
    if (isWalletConnect && connector.ready === undefined) {
      console.warn('⚠️ WalletConnect connector is not ready - this usually means domain authorization error');
      console.warn('💡 Check Reown Dashboard: https://dashboard.reown.com');
      console.warn(`   Domain: ${typeof window !== 'undefined' ? window.location.origin : 'unknown'}`);
      
      // Показываем сообщение пользователю
      // Ошибка будет обработана через connectError, но попробуем подключиться
    }
    
    try {
      console.log('📞 Calling connect()...');
      connect({ connector });
      console.log('✅ connect() called successfully');
      
      // Логируем через небольшую задержку для отслеживания изменений
      setTimeout(() => {
        console.log('📊 Status after connect:', {
          isConnected,
          connectingConnectorId,
          hasError: !!connectError,
        });
      }, 1000);
      
      // Если подключение не удастся, ошибка будет обработана через connectError prop
      // Таймаут для сброса состояния подключения, если подключение не произошло
      setTimeout(() => {
        if (!isConnected && connectingConnectorId === connector.id) {
          console.warn('⚠️ Connection timeout - resetting state');
          setConnectingConnectorId(null);
        }
      }, 10000);
    } catch (err: any) {
      console.error(`❌ Failed to connect with ${connector.name}:`, err);
      console.error('Error details:', {
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
      });
      setConnectingConnectorId(null);
    }
  };

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

        {(connectError || (connectingConnectorId && !isConnected && (status === 'disconnected' || status === 'connecting'))) && (
          <div className={`mb-4 p-3 border rounded-lg ${
            connectError 
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
              : status === 'connecting'
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            {connectError ? (
              <>
                <p className="text-sm text-red-800 dark:text-red-200 font-semibold mb-1">
                  Connection Failed
                </p>
                <p className="text-sm text-red-800 dark:text-red-200">
                  {connectError.message || 'Failed to connect wallet'}
                </p>
                {(connectError.message?.includes('Unauthorized') || 
                    connectError.message?.includes('origin not allowed') ||
                    connectError.message?.includes('3000')) && (
                  <div className="mt-2">
                    <p className="text-xs text-red-700 dark:text-red-300 mb-1">
                      Domain not authorized. Add this domain to Reown Dashboard:
                    </p>
                    <a
                      href="https://dashboard.reown.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-red-600 dark:text-red-400 underline"
                    >
                      Open Reown Dashboard →
                    </a>
                    {typeof window !== 'undefined' && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">
                        Domain: {window.location.origin}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : connectingConnectorId && status === 'connecting' ? (
              <div>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold mb-1">
                  ⏳ Connecting...
                </p>
                {connectingConnectorId === 'walletConnect' && (
                  <div className="mt-2">
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-1">
                      If connection doesn&apos;t complete, it&apos;s likely a domain authorization issue:
                    </p>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1 mb-2">
                      <li>Domain must be added to Reown Dashboard</li>
                      <li>Check browser console for &quot;Unauthorized: origin not allowed&quot; error</li>
                    </ul>
                    <a
                      href="https://dashboard.reown.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-yellow-600 dark:text-yellow-400 underline"
                    >
                      Open Reown Dashboard →
                    </a>
                    {typeof window !== 'undefined' && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 font-mono">
                        Required domain: {window.location.origin}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : connectingConnectorId && !isConnected ? (
              <div>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold mb-1">
                  ⏳ Waiting for connection...
                </p>
                {connectingConnectorId === 'walletConnect' && (
                  <div className="mt-2">
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-1">
                      If WalletConnect doesn&apos;t open, check:
                    </p>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                      <li>Domain is added to Reown Dashboard</li>
                      <li>Check browser console for errors</li>
                    </ul>
                    {typeof window !== 'undefined' && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 font-mono">
                        Required domain: {window.location.origin}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        <div className="space-y-4">
          {connectors.map((connector) => {
            const isConnecting = connectingConnectorId === connector.id;
            const isWalletConnect = connector.name === 'WalletConnect' || connector.id.includes('walletConnect');
            
            return (
              <button
                key={connector.id}
                onClick={() => handleConnect(connector)}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-3 p-4 border border-gray-300 dark:border-gray-700 rounded-xl shadow-md bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-medium transition-all duration-200 ease-in-out hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isWalletConnect ? (
                  <FaQrcode className="text-blue-500 h-5 w-5" />
                ) : (
                  <FaWallet className="text-yellow-500 h-5 w-5" />
                )}
                <span>
                  {isConnecting ? `Connecting to ${connector.name}...` : connector.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
