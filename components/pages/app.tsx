"use client";

import { SafeAreaContainer } from "@/components/safe-area-container";
import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import { useFrame } from "@/components/farcaster-provider";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Demo = dynamic(() => import("@/components/Home"), {
  ssr: false,
  loading: () => <div>Loading...</div>,
});

export default function Home() {
  const { context } = useMiniAppContext();
  const { actions, isSDKLoaded } = useFrame();
  const [isComponentReady, setIsComponentReady] = useState(false);

  // Call ready() when SDK is loaded and component is mounted
  // This follows Farcaster guidelines: call ready() when interface is ready to be displayed
  useEffect(() => {
    if (isSDKLoaded && actions && !isComponentReady) {
      // Wait for next frame to ensure UI is stable and avoid jitter/reflows
      // This ensures the dynamic component has rendered
      let rafId: number;
      let timeoutId: NodeJS.Timeout;
      
      rafId = requestAnimationFrame(() => {
        timeoutId = setTimeout(() => {
          actions.ready().then(() => {
            setIsComponentReady(true);
            console.log("App ready - splash screen hidden");
          }).catch((err) => {
            console.error("Error calling ready():", err);
          });
        }, 50);
      });

      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }
  }, [isSDKLoaded, actions, isComponentReady]);

  return (
    <SafeAreaContainer insets={context?.client.safeAreaInsets}>
      <Demo />
    </SafeAreaContainer>
  );
}
