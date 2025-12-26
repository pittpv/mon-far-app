"use client";

import React, { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { createConfig, http, WagmiProvider, type Connector } from "wagmi";
import { monadTestnet, monadMainnet, baseMainnet } from "@/lib/contract";
import { walletConnect } from "@wagmi/connectors";

// Используем переменную окружения (поддерживаем оба варианта для совместимости)
const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID || process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Функция для получения metadata с правильным origin (только на клиенте)
const getMetadata = () => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    return {
      name: "Happy World Vote",
      description: "Make the world happier with blockchain voting",
      url: origin,
      icons: [`${origin}/images/icon.png`],
    };
  }
  // Fallback для SSR - используем переменную окружения
  const defaultUrl = process.env.NEXT_PUBLIC_URL || "https://farcaster.happyvote.xyz/";
  return {
    name: "Happy World Vote",
    description: "Make the world happier with blockchain voting",
    url: defaultUrl,
    icons: [`${defaultUrl}/images/icon.png`],
  };
};

const queryClient = new QueryClient();

// Создаем коннекторы один раз вне компонента, чтобы избежать двойной инициализации
// Используем any[] для совместимости с разными типами коннекторов
let cachedConnectors: any[] | null = null;
let initLogged = false;

function getConnectors() {
  // Если коннекторы уже созданы, возвращаем их
  if (cachedConnectors !== null) {
    return cachedConnectors;
  }

  const baseConnectors = [farcasterFrame()];

  // На сервере возвращаем только базовые коннекторы
  if (typeof window === 'undefined') {
    cachedConnectors = baseConnectors;
    return cachedConnectors;
  }

  if (!PROJECT_ID) {
    if (!initLogged) {
      console.warn(
        '⚠️ WalletConnect projectId is not defined. ' +
        'WalletConnect connector will not be available. ' +
        'Set NEXT_PUBLIC_PROJECT_ID or NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your .env.local file. ' +
        'Get your Project ID at https://dashboard.reown.com'
      );
      initLogged = true;
    }
    cachedConnectors = baseConnectors;
    return cachedConnectors;
  }

  try {
    const origin = window.location.origin;
    const metadata = getMetadata();

    // Логируем только один раз
    if (!initLogged) {
      console.log('🔗 Initializing WalletConnect/Reown:');
      console.log('  Project ID:', PROJECT_ID ? `${PROJECT_ID.substring(0, 8)}...` : 'NOT SET');
      console.log('  Origin:', origin);
      console.log('  Metadata URL:', metadata.url);
      console.log('  ⚠️ CRITICAL: This exact domain must be added to Reown Dashboard!');
      console.log('  📋 Steps to fix "Unauthorized: origin not allowed":');
      console.log('     1. Go to https://dashboard.reown.com');
      console.log('     2. Select your project');
      console.log('     3. Go to "App Settings" > "Allowed Domains"');
      console.log(`     4. Add this EXACT domain: ${origin}`);
      console.log('     5. Make sure format matches exactly (http://localhost:3000 or https://yourdomain.com)');
      console.log('     6. Save and wait 1-2 minutes for changes to propagate');
      console.log('     7. Refresh the page after adding domain');
      initLogged = true;
    }

    const walletConnectConnector = walletConnect({
      projectId: PROJECT_ID,
      metadata,
      showQrModal: true,
    });

    const allConnectors = [...baseConnectors, walletConnectConnector];

    console.log('✅ WalletConnect connector created successfully');
    console.log('📋 Total connectors:', allConnectors.length, '(including WalletConnect)');

    cachedConnectors = allConnectors;
    return cachedConnectors;
  } catch (error) {
    if (!initLogged) {
      console.error('❌ Failed to initialize WalletConnect:', error);
      console.error('💡 TROUBLESHOOTING:');
      console.error('   1. Verify PROJECT_ID is set correctly in .env.local');
      console.error('   2. Check that domain is added in Reown Dashboard');
      console.error('   3. Domain format must match exactly (including http/https and port)');
      console.error('   4. Current origin:', window.location.origin);
      console.error('   5. Restart dev server after changing .env.local');
      initLogged = true;
    }
    cachedConnectors = baseConnectors;
    return cachedConnectors;
  }
}

export default function FrameWalletProvider({
                                              children,
                                            }: {
  children: React.ReactNode;
}) {
  // Используем useMemo для мемоизации, но функция getConnectors гарантирует создание только один раз
  const connectors = useMemo(() => getConnectors(), []);

  // Создаем конфигурацию с правильными коннекторами
  const config = useMemo(() => {
    return createConfig({
      chains: [baseMainnet, monadMainnet, monadTestnet],
      transports: {
        [baseMainnet.id]: http(),
        [monadMainnet.id]: http(),
        [monadTestnet.id]: http(),
      },
      connectors,
    });
  }, [connectors]);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
