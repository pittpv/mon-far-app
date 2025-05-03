import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import { APP_URL } from "@/lib/constants";

export function FarcasterActions() {
  const { actions } = useMiniAppContext();

  return (
    <div className="space-y-4 border border-[#333] rounded-md p-4">
      <h2 className="text-xl font-bold text-left">Farcaster actions</h2>
      <div className="flex flex-row space-x-4 justify-start items-start">
        {actions ? (
          <div className="flex flex-col space-y-4 justify-start">
            <button
              className="bg-white text-black rounded-md p-2 text-sm"
              onClick={() =>
                actions?.composeCast({
                  text: "Check out this Monad Farcaster Happy Vote MiniApp",
                  embeds: [`${APP_URL}`],
                })
              }
            >
              Share about Happy World Vote MiniApp
            </button>
            <button
              className="bg-white text-black rounded-md p-2 text-sm"
              onClick={() => actions?.viewProfile({ fid: 888234 })}
            >
              View Author Profile
            </button>
            <button
              className="bg-white text-black rounded-md p-2 text-sm"
              onClick={() => actions?.addFrame()}
            >
              Add this MiniApp
            </button>
            <button
              className="bg-white text-black rounded-md p-2 text-sm"
              onClick={() => actions?.openUrl("https://github.com/pittpv/mon-far-app/tree/main")}
            >
              About app and Repo
            </button>
            <button
              className="bg-white text-black rounded-md p-2 text-sm"
              onClick={() => actions?.openUrl("https://testnet.monad.xyz/z")}
            >
              Open Monad Testnet
            </button>
            <button
              className="bg-white text-black rounded-md p-2 text-sm"
              onClick={() => actions?.signIn({ nonce: "1201" })}
            >
              Sign in with Farcaster
            </button>
          </div>
        ) : (
          <p className="text-sm text-left">Actions not available</p>
        )}
      </div>
    </div>
  );
}
