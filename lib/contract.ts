// utils/contract.ts
import { defineChain } from 'viem'
import testnetAbi from './abi-testnet.json'
import mainnetAbi from './abi-mainnet.json'

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`

// Monad Testnet Chain
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'MonadScan',
      url: 'https://testnet.monadexplorer.com/',
    },
  },
  testnet: true,
})

// Monad Mainnet Chain
export const monadMainnet = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc1.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://monadvision.com',
    },
  },
  testnet: false,
})

// Base Mainnet Chain
export const baseMainnet = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://base-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Base',
      url: 'https://basescan.org',
    },
  },
  testnet: false,
})

// Network configurations
export const NETWORKS = {
  mainnet: {
    key: 'mainnet',
    label: 'Monad',
    chainId: 143,
    chain: monadMainnet,
    contractAddress: (process.env.NEXT_PUBLIC_MAINNET_CONTRACT_ADDRESS || '0xdFFEFD8eF040702A4657a98f189860169104257A') as `0x${string}`,
    abi: mainnetAbi,
    hasLeaderboard: true,
  },
  testnet: {
    key: 'testnet',
    label: 'Monad Testnet',
    chainId: 10143,
    chain: monadTestnet,
    contractAddress: (process.env.NEXT_PUBLIC_TESTNET_CONTRACT_ADDRESS || '0x40198e59306181e69affa25c69c5ba50f8f4cd0e') as `0x${string}`,
    abi: testnetAbi,
    hasLeaderboard: false,
  },
  baseMainnet: {
    key: 'baseMainnet',
    label: 'Base',
    chainId: 8453,
    chain: baseMainnet,
    contractAddress: (process.env.NEXT_PUBLIC_BASE_MAINNET_CONTRACT_ADDRESS || ZERO_ADDRESS) as `0x${string}`,
    abi: mainnetAbi,
    hasLeaderboard: true,
  },
} as const

// Default contract address and ABI (for backward compatibility)
export const CONTRACT_ADDRESS = NETWORKS.testnet.contractAddress as `0x${string}`
export const CONTRACT_ABI = NETWORKS.testnet.abi

// Helper function to get network config by chain ID
export function getNetworkByChainId(chainId: number) {
  return Object.values(NETWORKS).find(network => network.chainId === chainId) || NETWORKS.testnet
}

// Helper function to get network config by key
export function getNetworkByKey(key: keyof typeof NETWORKS) {
  return NETWORKS[key] || NETWORKS.testnet
}
