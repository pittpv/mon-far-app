'use client'

import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import { parseEther } from "viem";
import { monadTestnet } from "viem/chains";
import {
  useAccount,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useConnect,
} from "wagmi";
import { useEffect, useState } from "react";
import { FaWallet, FaQrcode } from "react-icons/fa";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";

export function WalletActions() {
  const { isEthProviderAvailable } = useMiniAppContext();
  const { address, isConnected, status, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: hash, sendTransaction } = useSendTransaction();
  const { switchChain } = useSwitchChain();
  const { writeContract, isPending } = useWriteContract();
  const { connect, connectors, status: connectStatus, error: connectError } = useConnect();
  const [timeLeft, setTimeLeft] = useState(0);

  const { data: votes } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getVotes",
  });

  const { data: canVote } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "canVote",
    args: [address || "0x0"],
    query: { enabled: !!address },
  });

  const { data: nextVoteTime } = useReadContract({
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

  const handleVote = (isHappy: boolean) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "vote",
      args: [isHappy],
    });
  };

  async function sendTransactionHandler() {
    sendTransaction({
      to: "0x1f1dd9c30181e8e49D5537Bc3E81c33896e778Bd",
      value: parseEther("0.5"),
    });
  }

  if (status === "connecting" || status === "reconnecting") {
    return <p>Connecting wallet…</p>;
  }

  if (!isConnected) {
    return (
      <div className="grid gap-4 p-4">
        {connectors.map((connector) => (
          <button
            key={connector.id}
            onClick={() => connect({ connector })}
            className="flex items-center justify-center gap-2 p-4 border rounded-xl shadow-md hover:bg-gray-50 transition text-base font-medium"
          >
            {connector.name === 'WalletConnect' ? (
              <FaQrcode className="text-blue-500" />
            ) : (
              <FaWallet className="text-yellow-500" />
            )}
            Connect with {connector.name}
          </button>
        ))}
      </div>
    );
  }

  const [happyVotes, sadVotes] = votes || [0n, 0n];
  const total = happyVotes + sadVotes;
  const happyPct = total > 0n ? Math.round(Number((happyVotes * 100n) / total)) : 0;
  const sadPct = total > 0n ? 100 - happyPct : 0;

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Wallet Control & Voting</h2>

      <div className="space-y-2 mb-4">
        <p className="text-sm text-gray-700">
          Connected to: <span className="bg-gray-100 px-2 py-1 rounded font-mono break-all">{address}</span>
        </p>
        <p className="text-sm text-gray-700">
          Chain ID: <span className="bg-gray-100 px-2 py-1 rounded font-mono">{chainId}</span>
        </p>
      </div>

      {chainId === monadTestnet.id ? (
        <>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Vote your feelings</h3>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <button
              onClick={() => handleVote(true)}
              disabled={!canVote || isPending}
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded-xl disabled:opacity-50"
            >
              😊 I&apos;m Happy
            </button>
            <button
              onClick={() => handleVote(false)}
              disabled={!canVote || isPending}
              className="flex-1 bg-red-500 text-white px-4 py-2 rounded-xl disabled:opacity-50"
            >
              😢 I&apos;m Sad
            </button>
          </div>

          {!canVote && (
            <p className="text-sm text-red-500 mb-4">
              You&apos;ve already voted. Next vote in: {new Date(timeLeft * 1000).toISOString().substr(11, 8)}
            </p>
          )}

          <div className="bg-gray-100 rounded-xl p-4 mb-4">
            <h4 className="font-semibold mb-2 text-gray-700">Happiness Meter</h4>
            <div className="flex h-6 overflow-hidden rounded-xl text-sm font-medium text-white">
              <div className="bg-green-500 flex items-center justify-center" style={{ width: `${happyPct}%` }}>
                {happyPct > 10 ? `${happyPct}%` : null}
              </div>
              <div className="bg-red-500 flex items-center justify-center" style={{ width: `${sadPct}%` }}>
                {sadPct > 10 ? `${sadPct}%` : null}
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-600">
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
              className="w-full sm:w-auto underline text-blue-600"
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

      <br/>
      <button
        className="text-sm underline text-gray-600 mt-4"
        onClick={() => disconnect()}
      >
        Disconnect Wallet
      </button>
      <p className="text-xs text-gray-400">Click Disconnect to use WalletConnect</p>
    </div>
  );
}
