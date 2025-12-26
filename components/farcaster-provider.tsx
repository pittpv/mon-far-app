"use client";

import { sdk } from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-core";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import FrameWalletProvider from "./frame-wallet-provider";

interface FrameContextValue {
  context: Context.MiniAppContext | null;
  isSDKLoaded: boolean;
  isEthProviderAvailable: boolean;
  error: string | null;
  actions: typeof sdk.actions | null;
}

const FrameProviderContext = createContext<FrameContextValue | undefined>(
  undefined
);

export function useFrame() {
  const context = useContext(FrameProviderContext);
  if (context === undefined) {
    throw new Error("useFrame must be used within a FrameProvider");
  }
  return context;
}

interface FrameProviderProps {
  children: ReactNode;
}

export function FrameProvider({ children }: FrameProviderProps) {
  const [context, setContext] = useState<Context.MiniAppContext | null>(null);
  const [actions, setActions] = useState<typeof sdk.actions | null>(null);
  const [isEthProviderAvailable, setIsEthProviderAvailable] =
    useState<boolean>(false);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSDKLoaded) return;

    const load = async () => {
      try {
        // Check if SDK is available
        if (typeof window === "undefined" || !sdk) {
          console.warn("SDK not available (likely running outside Farcaster)");
          setIsSDKLoaded(true); // Mark as loaded even if not in Farcaster context
          return;
        }

        const context = await sdk.context;
        if (context) {
          setContext(context);
          setActions(sdk.actions);
          setIsEthProviderAvailable(sdk.wallet?.ethProvider ? true : false);
          setIsSDKLoaded(true);
          console.log("✅ SDK loaded successfully");
        } else {
          // Context might be null if not in Farcaster miniapp
          console.warn("Farcaster context is null (likely running outside Farcaster)");
          setIsSDKLoaded(true); // Mark as loaded to prevent infinite waiting
        }
        // Don't call ready() here - it should be called when UI is ready
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize SDK";
        setError(errorMessage);
        console.error("❌ SDK initialization error:", err);
        setIsSDKLoaded(true); // Mark as loaded even on error to prevent blocking
      }
    };

    load();
  }, [isSDKLoaded]);

  return (
    <FrameProviderContext.Provider
      value={{
        context,
        actions,
        isSDKLoaded,
        isEthProviderAvailable,
        error,
      }}
    >
      <FrameWalletProvider>{children}</FrameWalletProvider>
    </FrameProviderContext.Provider>
  );
}
