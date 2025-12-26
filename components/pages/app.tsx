"use client";

import { SafeAreaContainer } from "@/components/safe-area-container";
import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import { useFrame } from "@/components/farcaster-provider";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { sdk } from "@farcaster/miniapp-sdk";

const Demo = dynamic(() => import("@/components/Home"), {
  ssr: false,
  loading: () => <div>Loading...</div>,
});

export default function Home() {
  const { context } = useMiniAppContext();
  const readyCalledRef = useRef(false);
  
  // Get frame context - FrameProvider should wrap this component in layout.tsx
  const frameContext = useFrame();
  const actions = frameContext?.actions || null;
  const isSDKLoaded = frameContext?.isSDKLoaded || false;

  // Call ready() immediately when component mounts
  // This follows Farcaster guidelines: call ready() when interface is ready to be displayed
  useEffect(() => {
    const initialize = async () => {
      if (readyCalledRef.current) return;

      try {
        if (typeof window === "undefined") {
          console.log("⏳ Skipping ready() - server side");
          return;
        }

        console.log("🔍 Checking SDK availability...", {
          sdkExists: !!sdk,
          actionsExists: !!sdk?.actions,
          readyExists: typeof sdk?.actions?.ready === "function",
          contextActionsExists: !!actions,
          contextReadyExists: typeof actions?.ready === "function",
          isSDKLoaded,
        });

        // Try direct SDK call first - this is the recommended approach
        if (sdk && sdk.actions && typeof sdk.actions.ready === "function") {
          console.log("📞 Calling sdk.actions.ready() directly...");
          await sdk.actions.ready();
          readyCalledRef.current = true;
          console.log("✅ App ready - splash screen hidden (direct SDK call)");
          return;
        }

        // Fallback: use actions from context
        if (actions && typeof actions.ready === "function") {
          console.log("📞 Calling actions.ready() from context...");
          await actions.ready();
          readyCalledRef.current = true;
          console.log("✅ App ready - splash screen hidden (via context actions)");
          return;
        }

        console.warn("⚠️ SDK actions.ready() not available yet, will retry...");
      } catch (err) {
        console.error("❌ Error calling ready():", err);
        // Retry after a delay
        setTimeout(() => {
          if (!readyCalledRef.current) {
            console.log("🔄 Retrying ready() call...");
            initialize();
          }
        }, 500);
      }
    };

    // Small delay to ensure SDK is loaded
    const timeoutId = setTimeout(() => {
      initialize();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []); // Empty deps - call once on mount

  // Also call ready() when SDK becomes available via context
  useEffect(() => {
    if (readyCalledRef.current) return;
    if (!isSDKLoaded || !actions) return;

    const callReady = async () => {
      if (readyCalledRef.current) return;

      try {
        if (actions && typeof actions.ready === "function") {
          await actions.ready();
          readyCalledRef.current = true;
          console.log("✅ App ready - splash screen hidden (SDK loaded via context)");
        }
      } catch (err) {
        console.error("❌ Error calling ready() after SDK load:", err);
      }
    };

    // Small delay to ensure UI is rendered
    const timeoutId = setTimeout(() => {
      callReady();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isSDKLoaded, actions]);

  return (
    <SafeAreaContainer insets={context?.client.safeAreaInsets}>
      <Demo />
    </SafeAreaContainer>
  );
}
