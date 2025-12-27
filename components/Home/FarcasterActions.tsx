import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import { APP_URL } from "@/lib/constants";
import { useEffect, useState } from "react";

export function FarcasterActions() {
  const { actions, context } = useMiniAppContext();
  const [isMiniAppAdded, setIsMiniAppAdded] = useState<boolean | null>(null);
  const fid = context?.user?.fid;

  useEffect(() => {
    const checkMiniAppStatus = async () => {
      if (!fid) {
        setIsMiniAppAdded(null);
        return;
      }

      try {
        const response = await fetch(`/api/check-miniapp-status?fid=${fid}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setIsMiniAppAdded(data.hasToken === true);
      } catch (error) {
        console.error("Error checking MiniApp status:", error);
        setIsMiniAppAdded(null);
      }
    };

    checkMiniAppStatus();
  }, [fid]);

  const handleAddMiniApp = async () => {
    if (actions) {
      actions.addFrame();
      // Refresh status after a short delay to check if MiniApp was added
      setTimeout(async () => {
        if (fid) {
          try {
            const response = await fetch(`/api/check-miniapp-status?fid=${fid}`);
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setIsMiniAppAdded(data.hasToken === true);
          } catch (error) {
            console.error("Error checking MiniApp status after add:", error);
          }
        }
      }, 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-md w-full transition-colors duration-300">
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Farcaster Actions</h2>
      {actions ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isMiniAppAdded === false && (
            <ActionButton onClick={handleAddMiniApp}>
              ➕ Add MiniApp
            </ActionButton>
          )}
          <ActionButton onClick={() =>
            actions.composeCast({
              text: "Check out this Monad Farcaster Happy Vote MiniApp",
              embeds: [`${APP_URL}`],
            })
          }>
            📣 Share MiniApp
          </ActionButton>
          <ActionButton onClick={() => actions.viewProfile({ fid: 888234 })}>
            👤 View Author
          </ActionButton>
          <ActionButton onClick={() =>
            actions.openUrl("https://github.com/pittpv/mon-far-app/tree/main")
          }>
            📁 View Github
          </ActionButton>
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Actions not available</p>
      )}
    </div>
  );
}

function ActionButton({
                        children,
                        onClick,
                      }: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 font-medium text-sm sm:text-base transition-colors"
    >
      {children}
    </button>
  );
}
