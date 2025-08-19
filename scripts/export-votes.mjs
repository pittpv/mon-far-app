import { createPublicClient, http, parseAbiItem } from 'viem'
import fs from 'fs/promises'
import path from 'path'

// Configuration
const DEFAULT_CONTRACT_ADDRESS = '0x7fB4F5Fc2a6f2FAa86F5F37EAEE8A0db820ad9E0'
const VOTED_EVENT = parseAbiItem('event Voted(address indexed user, bool isHappy)')

// Chain config (copied from app lib to avoid TS import)
const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL] } },
  blockExplorers: { default: { name: 'MonadScan', url: 'https://testnet.monadexplorer.com/' } },
  testnet: true,
}

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [key, val] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), argv[i + 1]]
      if (!a.includes('=') && argv[i + 1] && !argv[i + 1].startsWith('--')) i++
      args[key] = val === undefined ? true : val
    }
  }
  return args
}

function toBigIntOrUndefined(value) {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string' && value.trim().length === 0) return undefined
  try { return BigInt(value) } catch { return undefined }
}

function ensureRpcUrl() {
  const url = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL
  if (!url) {
    throw new Error('RPC URL is not set. Provide NEXT_PUBLIC_RPC_URL or RPC_URL environment variable.')
  }
  return url
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

function toCsv(records) {
  const headers = ['blockNumber', 'blockTimestamp', 'transactionHash', 'logIndex', 'user', 'isHappy']
  const rows = [headers.join(',')]
  for (const r of records) {
    rows.push([
      r.blockNumber,
      r.blockTimestamp,
      r.transactionHash,
      r.logIndex,
      r.user,
      r.isHappy,
    ].join(','))
  }
  return rows.join('\n') + '\n'
}

async function main() {
  const args = parseArgs(process.argv)
  const rpcUrl = ensureRpcUrl()

  const client = createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  const latest = await client.getBlockNumber()
  const fromBlock = toBigIntOrUndefined(args.from) ?? 0n
  const toBlock = toBigIntOrUndefined(args.to) ?? latest
  const step = toBigIntOrUndefined(args.step) ?? 100000n
  const withTimestamps = args.timestamps === 'false' ? false : true
  const contractAddress = (args.address || process.env.CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS)

  if (fromBlock > toBlock) throw new Error('from block must be <= to block')

  const allLogs = []
  for (let start = fromBlock; start <= toBlock; start += step) {
    const end = start + step - 1n <= toBlock ? start + step - 1n : toBlock
    const logs = await client.getLogs({
      address: contractAddress,
      event: VOTED_EVENT,
      fromBlock: start,
      toBlock: end,
    })
    allLogs.push(...logs)
  }

  // Optionally fetch timestamps per unique block
  const blockTimestamps = new Map()
  if (withTimestamps && allLogs.length > 0) {
    const uniqueBlocks = [...new Set(allLogs.map(l => l.blockNumber))]
    for (const bn of uniqueBlocks) {
      const block = await client.getBlock({ blockNumber: bn })
      blockTimestamps.set(bn, Number(block.timestamp))
    }
  }

  const records = allLogs
    .sort((a, b) => {
      if (a.blockNumber === b.blockNumber) return a.logIndex < b.logIndex ? -1 : a.logIndex > b.logIndex ? 1 : 0
      return a.blockNumber < b.blockNumber ? -1 : 1
    })
    .map(l => ({
      blockNumber: Number(l.blockNumber),
      blockTimestamp: withTimestamps ? (blockTimestamps.get(l.blockNumber) ?? null) : null,
      transactionHash: l.transactionHash,
      logIndex: Number(l.logIndex),
      user: l.args.user,
      isHappy: l.args.isHappy,
    }))

  const outDir = args.outDir || 'exports'
  await ensureDir(outDir)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const base = path.join(outDir, `votes_${fromBlock}-${toBlock}_${stamp}`)

  await fs.writeFile(`${base}.json`, JSON.stringify(records, null, 2))
  await fs.writeFile(`${base}.csv`, toCsv(records))

  console.log(`Exported ${records.length} votes to:`)
  console.log(`- ${base}.json`)
  console.log(`- ${base}.csv`)
  console.log(`From block ${fromBlock} to ${toBlock} on address ${contractAddress}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

