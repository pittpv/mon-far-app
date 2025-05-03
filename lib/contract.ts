// utils/contract.ts
import { Chain } from 'viem/chains'

export const monadTestnet: Chain = {
  id: 1001,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL!],
    },
  },
  blockExplorers: {
    default: {
      name: 'MonadScan',
      url: 'https://testnet-explorer.monad.xyz',
    },
  },
  testnet: true, // Добавляем это вместо network
}

export const CONTRACT_ADDRESS = '0x7fB4F5Fc2a6f2FAa86F5F37EAEE8A0db820ad9E0'
export const CONTRACT_ABI = [
    { inputs: [{ name: 'isHappy', type: 'bool' }], name: 'vote', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'getVotes', outputs: [{ name: '', type: 'uint256' }, { name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'user', type: 'address' }], name: 'canVote', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'user', type: 'address' }], name: 'timeUntilNextVote', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const
