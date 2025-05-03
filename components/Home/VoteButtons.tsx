// components/VoteButtons.tsx
'use client'

import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { useEffect, useState } from 'react'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/lib/contract'

export function VoteButtons() {
    const { address, isConnected, status } = useAccount()
    const { writeContract, isPending } = useWriteContract()
    const [timeLeft, setTimeLeft] = useState(0)

    const { data: votes } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getVotes' })
    const { data: canVote } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'canVote', args: [address || '0x0'], query: { enabled: !!address } })
    const { data: nextVoteTime } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'timeUntilNextVote', args: [address || '0x0'], query: { enabled: !!address } })

    useEffect(() => {
        if (nextVoteTime) {
            setTimeLeft(Number(nextVoteTime))
            const iv = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000)
            return () => clearInterval(iv)
        }
    }, [nextVoteTime])

    const handleVote = (isHappy: boolean) => {
        writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'vote', args: [isHappy] })
    }

    if (status === 'connecting' || status === 'reconnecting') {
        return <p>Connecting wallet…</p>
    }
    if (!isConnected) {
        return <p>Please connect your wallet</p>
    }

    // Приводим к типу bigint для более безопасных вычислений
    const [happyVotes, sadVotes] = votes || [0n, 0n] // Обратите внимание на использование bigint (0n)
    const total = happyVotes + sadVotes
    const happyPct = total > 0n ? Math.round(Number((happyVotes * 100n) / total)) : 0 // Приводим к числу для процента
    const sadPct = total > 0n ? 100 - happyPct : 0

    return (
      <div className="space-y-4" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '400px', margin: '0 auto', textAlign: 'center', padding: '20px' }}>
        <h2 style={{ color: '#4a4a4a', marginBottom: '20px' }}>Make the World Happier</h2>

        <div className="flex justify-center gap-4" style={{ margin: '30px 0' }}>
          <button
            onClick={() => handleVote(true)}
            disabled={!canVote || isPending}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              opacity: (!canVote || isPending) ? 0.6 : 1
            }}
          >
            😊 I&apos;m Happy
          </button>
          <button
            onClick={() => handleVote(false)}
            disabled={!canVote || isPending}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              opacity: (!canVote || isPending) ? 0.6 : 1
            }}
          >
            😢 I&apos;m Sad
          </button>
        </div>

        {!canVote && (
          <p style={{ color: 'red', margin: '15px 0' }}>
            You&apos;ve already voted. Next in: {new Date(timeLeft * 1000).toISOString().substr(11, 8)}
          </p>
        )}

        <div style={{
          marginTop: '30px',
          backgroundColor: '#f5f5f5',
          padding: '15px',
          borderRadius: '8px'
        }}>
          <h3 style={{ color: '#4a4a4a', marginBottom: '15px' }}>Happiness Meter</h3>

          <div style={{ display: 'flex', height: '30px', marginBottom: '15px' }}>
            <div style={{
              width: `${happyPct}%`,
              backgroundColor: '#4CAF50',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white'
            }}>
              {happyPct}%
            </div>
            <div style={{
              width: `${sadPct}%`,
              backgroundColor: '#f44336',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white'
            }}>
              {sadPct}%
            </div>
          </div>

          <div style={{ color: '#666' }}>
            <p>😊 Happy: {happyPct}%</p>
            <p>😢 Sad: {sadPct}%</p>
            <p>🧮 Total votes: {total.toString()}</p>
          </div>
        </div>
      </div>
    )
}
