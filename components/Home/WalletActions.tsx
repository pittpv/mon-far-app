'use client'

import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import { parseEther } from "viem";
import { monadTestnet } from "viem/chains";
import {
  useAccount,
  // useDisconnect, // No longer needed here
  useSendTransaction,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  // useConnect, // No longer needed here
  useWaitForTransactionReceipt,
} from "wagmi";
import { useEffect, useState } from "react";
// import { FaWallet, FaQrcode } from "react-icons/fa"; // No longer needed here
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";

export function WalletActions() {
  const { isEthProviderAvailable } = useMiniAppContext();
  const { address, isConnected, status, chainId } = useAccount();
  // const { disconnect } = useDisconnect(); // No longer needed here
  const { data: hash, sendTransaction } = useSendTransaction();
  const { switchChain } = useSwitchChain();
  const { data: voteTxHash, writeContract, isPending: isWriteContractPending, reset: resetWriteContract } = useWriteContract();
  // const { connect, connectors, status: connectStatus, error: connectError } = useConnect(); // No longer needed
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentVoteTxHash, setCurrentVoteTxHash] = useState<`0x${string}` | undefined>();

  // === All Hooks Called Unconditionally First ===
  const { data: votes, refetch: refetchVotes } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getVotes",
  });

  const { data: canVote, refetch: refetchCanVote } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "canVote",
    args: [address || "0x0"],
    query: { enabled: !!address },
  });

  const { data: nextVoteTime, refetch: refetchTimeUntilNextVote } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "timeUntilNextVote",
    args: [address || "0x0"],
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (nextVoteTime) {
      setTimeLeft(Number(nextVoteTime));
      const iv = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
      return () => clearInterval(iv);
    }
  }, [nextVoteTime]);

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash: currentVoteTxHash,
    query: {
      enabled: !!currentVoteTxHash,
    }
  });

  useEffect(() => {
    if (isConfirmed) {
      refetchVotes();
      refetchCanVote();
      refetchTimeUntilNextVote();
      setCurrentVoteTxHash(undefined);
      resetWriteContract(); // Reset writeContract state
    }
  }, [isConfirmed, refetchVotes, refetchCanVote, refetchTimeUntilNextVote, resetWriteContract]);

  // === Conditional Rendering Logic (AFTER all hooks) ===
  if (!isConnected && status !== 'connecting' && status !== 'reconnecting') {
    return null;
  }

  if (status === "connecting" || status === "reconnecting") {
    // Consider returning a more specific loading indicator for this panel if desired,
    // or null if global loading indicators are sufficient.
    // For now, returning a simple message or null.
    // Returning null to avoid duplicate "Connecting" messages if FrameProvider handles it.
    return null;
    // return <p className="text-gray-700 dark:text-gray-300">Loading wallet information…</p>;
  }

  // Define handlers and UI logic only if we are going to render the main component
  const handleVote = (isHappy: boolean) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "vote",
      args: [isHappy],
    }, {
      onSuccess: (hash) => {
        setCurrentVoteTxHash(hash);
      }
    });
  };

  async function sendTransactionHandler() {
    sendTransaction({
      to: "0x1f1dd9c30181e8e49D5537Bc3E81c33896e778Bd",
      value: parseEther("0.5"),
    });
  }

  const [happyVotes, sadVotes] = votes || [0n, 0n];
  const total = happyVotes + sadVotes;
  const happyPct = total > 0n ? Math.round(Number((happyVotes * 100n) / total)) : 0;
  const sadPct = total > 0n ? 100 - happyPct : 0;

  return (
    <div className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-md text-black dark:text-white transition-colors duration-300">
      <h2 className="text-2xl font-semibold mb-4">Wallet Control & Voting</h2>

      <div className="space-y-2 mb-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Connected to: <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono break-all">{address}</span>
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Chain ID: <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">{chainId}</span>
        </p>
      </div>

      {chainId === monadTestnet.id ? (
        <>
          <h3 className="text-lg font-semibold mb-2">Vote your feelings</h3>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <button
              onClick={() => handleVote(true)}
              disabled={!canVote || isWriteContractPending || isConfirming}
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded-xl disabled:opacity-50"
            >
              😊 I&apos;m Happy
            </button>
            <button
              onClick={() => handleVote(false)}
              disabled={!canVote || isWriteContractPending || isConfirming}
              className="flex-1 bg-red-500 text-white px-4 py-2 rounded-xl disabled:opacity-50"
            >
              😢 I&apos;m Sad
            </button>
          </div>

          {(isWriteContractPending || isConfirming) && (
            <p className="text-sm text-blue-500 mb-4">
              {isWriteContractPending ? "Submitting your vote..." : "Confirming transaction..."}
            </p>
          )}

          {!canVote && !(isWriteContractPending || isConfirming) && (
            <p className="text-sm text-red-500 mb-4">
              You&apos;ve already voted. Next vote in: {new Date(timeLeft * 1000).toISOString().substr(11, 8)}
            </p>
          )}

          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-4">
            <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Happiness Meter</h4>
            <div className="flex h-6 overflow-hidden rounded-xl text-sm font-medium text-white">
              <div className="bg-green-500 flex items-center justify-center" style={{ width: `${happyPct}%` }}>
                {happyPct > 10 ? `${happyPct}%` : null}
              </div>
              <div className="bg-red-500 flex items-center justify-center" style={{ width: `${sadPct}%` }}>
                {sadPct > 10 ? `${sadPct}%` : null}
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              <p>😊 Happy: {happyPct}%</p>
              <p>😢 Sad: {sadPct}%</p>
              <p>🧮 Total votes: {total.toString()}</p>
            </div>
          </div>

          <button
            className="w-full sm:w-auto bg-pink-500 text-white px-4 py-2 rounded-xl mb-2"
            onClick={sendTransactionHandler}
          >
            ❤️ Donate MON
          </button>

          {hash && (
            <button
              className="w-full sm:w-auto underline text-blue-600 dark:text-blue-400"
              onClick={() => window.open(`https://testnet.monadexplorer.com/tx/${hash}`, "_blank")}
            >
              View Transaction
            </button>
          )}
        </>
      ) : (
        <button
          className="w-full sm:w-auto bg-yellow-300 text-black px-4 py-2 rounded-xl mb-4"
          onClick={() => switchChain({ chainId: monadTestnet.id })}
        >
          Switch to Monad Testnet
        </button>
      )}

      {/* Removed Disconnect button and paragraph from here */}
    </div>
  );
}
