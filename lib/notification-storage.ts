// Storage for notification tokens and cooldown tracking
// Uses database adapter for persistence (supports in-memory, file, PostgreSQL, MongoDB)

import { getDatabaseAdapter, type DatabaseAdapter, type NotificationToken, type VoteRecord } from './db-adapter';

// Get database adapter instance
let dbAdapter: DatabaseAdapter | null = null;

function getAdapter(): DatabaseAdapter {
  if (!dbAdapter) {
    dbAdapter = getDatabaseAdapter();
  }
  return dbAdapter;
}

// Store scheduled notifications: fid -> Map<address, timeout ID>
// Note: In production with multiple servers, use a job queue (Bull, BullMQ, etc.)
// Changed to support multiple addresses per FID
const scheduledNotifications = new Map<number, Map<string, NodeJS.Timeout>>();

export async function getNotificationToken(fid: number): Promise<NotificationToken | null> {
  return await getAdapter().getNotificationToken(fid);
}

/**
 * Migrate legacy data (address, lastVoteTime) to new votes array format
 */
function migrateLegacyData(token: NotificationToken): NotificationToken {
  // If votes array exists, use it (but ensure all votes have network field)
  if (token.votes && token.votes.length > 0) {
    // Migrate votes without network field (set to "unknown" for legacy data)
    const migratedVotes = token.votes.map(vote => ({
      ...vote,
      network: vote.network || 'unknown', // Default network for legacy data
    }));
    
    return {
      ...token,
      votes: migratedVotes,
    };
  }
  
  // If legacy fields exist, migrate to votes array
  if (token.address && token.lastVoteTime) {
    const cooldownSeconds = 24 * 60 * 60;
    const voteRecord: VoteRecord = {
      address: token.address,
      network: 'unknown', // Default network for legacy data
      voteTime: token.lastVoteTime,
      cooldownEndTime: token.lastVoteTime + cooldownSeconds,
    };
    
    return {
      ...token,
      votes: [voteRecord],
      // Keep legacy fields for backward compatibility during migration
    };
  }
  
  return token;
}

export async function saveNotificationToken(fid: number, token: string, url: string) {
  const adapter = getAdapter();
  
  // Preserve existing vote data (votes array) when updating token
  // This prevents losing vote history when token is refreshed
  const existingToken = await adapter.getNotificationToken(fid);
  
  // Migrate legacy data if needed
  const migratedToken = existingToken ? migrateLegacyData(existingToken) : null;
  
  await adapter.saveNotificationToken({
    fid,
    token,
    url,
    // Preserve existing votes array if it exists
    votes: migratedToken?.votes,
    // Legacy fields removed - all data is in votes array
  });
  console.log(`✅ Notification token saved for FID: ${fid}`);
}

export async function removeNotificationToken(fid: number) {
  const adapter = getAdapter();
  await adapter.removeNotificationToken(fid);
  
  // Cancel all scheduled notifications for this FID (all addresses)
  const fidNotifications = scheduledNotifications.get(fid);
  if (fidNotifications) {
    for (const timeoutId of fidNotifications.values()) {
      clearTimeout(timeoutId);
    }
    scheduledNotifications.delete(fid);
  }
  console.log(`🗑️ Notification token removed for FID: ${fid}`);
}

export async function saveUserVote(
  fid: number, 
  address: string, 
  voteTime: number,
  blockTimestamp?: number, // Optional: exact block timestamp for precise cooldown
  network?: string // Optional: network identifier (e.g., "mainnet", "base", "monad")
) {
  const adapter = getAdapter();
  const tokenData = await adapter.getNotificationToken(fid);
  
  if (!tokenData) {
    console.warn(`⚠️ No notification token found for FID ${fid}. Vote data will not be saved. User needs to add MiniApp first via webhook.`);
    return;
  }
  
  // Use block timestamp if available for more accurate cooldown calculation
  const actualVoteTime = blockTimestamp || voteTime;
  
  // Default network if not provided
  const voteNetwork = network || 'unknown';
  
  // Migrate legacy data if needed
  const migratedToken = migrateLegacyData(tokenData);
  
  // Cooldown is 24 hours (86400 seconds)
  const cooldownSeconds = 24 * 60 * 60;
  const cooldownEndTime = actualVoteTime + cooldownSeconds;
  
  // Create new vote record
  const newVote: VoteRecord = {
    address,
    network: voteNetwork,
    voteTime: actualVoteTime,
    cooldownEndTime,
  };
  
  // Get existing votes array or create new one
  const existingVotes = migratedToken.votes || [];
  
  // Check if vote for this address+network combination already exists
  // Same address can vote in different networks, so we need to check both
  const existingVoteIndex = existingVotes.findIndex(
    v => v.address.toLowerCase() === address.toLowerCase() && v.network === voteNetwork
  );
  
  let updatedVotes: VoteRecord[];
  const addressMasked = address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : '***';
  if (existingVoteIndex >= 0) {
    // Update existing vote for this address+network combination
    updatedVotes = [...existingVotes];
    updatedVotes[existingVoteIndex] = newVote;
    console.log(`🔄 Updating existing vote for FID ${fid}, address ${addressMasked}, network ${voteNetwork}`);
  } else {
    // Add new vote
    updatedVotes = [...existingVotes, newVote];
    console.log(`➕ Adding new vote for FID ${fid}, address ${addressMasked}, network ${voteNetwork}`);
  }
  
  try {
    await adapter.saveNotificationToken({
      ...migratedToken,
      votes: updatedVotes,
      // All vote data is stored in votes array, no need for legacy fields
    });
    
    console.log(`✅ Vote saved for FID ${fid}, address ${addressMasked}, network ${voteNetwork}, voteTime ${actualVoteTime}, total votes: ${updatedVotes.length}`);
    
    // Schedule notification for when cooldown ends (24 hours = 86400 seconds)
    scheduleCooldownNotification(fid, address, voteNetwork, actualVoteTime, cooldownEndTime);
    
    // Also reschedule notifications for all other address+network combinations that are still in cooldown
    rescheduleAllNotifications(fid, updatedVotes);
  } catch (error) {
    console.error(`❌ Failed to save vote for FID ${fid}:`, error);
    throw error;
  }
}

/**
 * Generate unique key for address+network combination
 */
function getVoteKey(address: string, network: string): string {
  return `${address.toLowerCase()}:${network}`;
}

/**
 * Schedule notification for a specific address+network combination when its cooldown ends
 */
function scheduleCooldownNotification(
  fid: number, 
  address: string, 
  network: string,
  voteTime: number, 
  cooldownEndTime: number
) {
  // Get or create notifications map for this FID
  let fidNotifications = scheduledNotifications.get(fid);
  if (!fidNotifications) {
    fidNotifications = new Map();
    scheduledNotifications.set(fid, fidNotifications);
  }
  
  // Use address+network as unique key
  const voteKey = getVoteKey(address, network);
  
  // Cancel existing notification for this address+network combination if any
  const existingTimeout = fidNotifications.get(voteKey);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  
  const now = Math.floor(Date.now() / 1000);
  const timeUntilNotification = Math.max(0, cooldownEndTime - now) * 1000; // Convert to milliseconds

  const addressMasked = address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : '***';
  if (timeUntilNotification <= 0) {
    // Cooldown already ended, send notification immediately
    console.log(`⏰ Cooldown already ended for FID ${fid}, address ${addressMasked}, network ${network}, sending notification immediately`);
    sendCooldownNotification(fid, address, network, cooldownEndTime);
    return;
  }

  console.log(`⏰ Scheduling notification for FID ${fid}, address ${addressMasked}, network ${network} in ${Math.floor(timeUntilNotification / 1000)}s`);

  const timeoutId = setTimeout(async () => {
    await sendCooldownNotification(fid, address, network, cooldownEndTime);
    // Remove this specific notification from map
    const fidMap = scheduledNotifications.get(fid);
    if (fidMap) {
      fidMap.delete(voteKey);
      // Clean up empty map
      if (fidMap.size === 0) {
        scheduledNotifications.delete(fid);
      }
    }
  }, timeUntilNotification);

  fidNotifications.set(voteKey, timeoutId);
}

/**
 * Reschedule notifications for all address+network combinations that are still in cooldown
 */
function rescheduleAllNotifications(fid: number, votes: VoteRecord[]) {
  const now = Math.floor(Date.now() / 1000);
  
  for (const vote of votes) {
    // Only schedule if cooldown hasn't ended yet
    if (vote.cooldownEndTime > now) {
      scheduleCooldownNotification(
        fid, 
        vote.address, 
        vote.network || 'unknown', 
        vote.voteTime, 
        vote.cooldownEndTime
      );
    } else {
      // Cooldown already ended, send notification immediately
      const addressMasked = vote.address.length > 10 ? `${vote.address.slice(0, 6)}...${vote.address.slice(-4)}` : '***';
      console.log(`⏰ Cooldown already ended for FID ${fid}, address ${addressMasked}, network ${vote.network || 'unknown'}, sending notification immediately`);
      sendCooldownNotification(fid, vote.address, vote.network || 'unknown', vote.cooldownEndTime);
    }
  }
}

/**
 * Send notification when cooldown ends for a specific address+network combination
 */
async function sendCooldownNotification(
  fid: number, 
  address: string, 
  network: string,
  cooldownEndTime: number
) {
  const adapter = getAdapter();
  const tokenData = await adapter.getNotificationToken(fid);
  
  if (!tokenData || !tokenData.token || !tokenData.url) {
    console.log(`⚠️ No notification token found for FID ${fid}`);
    return;
  }

  try {
    const { APP_URL } = await import('@/lib/constants');
    
    // Use stable notificationId based on cooldown end time for idempotency
    // Format: cooldown-ended-{fid}-{addressHash}-{network}-{cooldownEndTimestamp}
    // Include address and network to make it unique per address+network combination
    const addressHash = address.slice(0, 8).toLowerCase();
    const networkHash = network.slice(0, 6).toLowerCase();
    const notificationId = `cooldown-ended-${fid}-${addressHash}-${networkHash}-${cooldownEndTime}`;
    
    // Format address for display (first 6 and last 4 characters)
    const formattedAddress = address.length > 10 
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address;
    
    // Format network name for display
    // Map network keys to readable names
    const networkLabels: Record<string, string> = {
      'mainnet': 'Monad Mainnet',
      'testnet': 'Monad Testnet',
      'baseMainnet': 'Base Mainnet',
      'base': 'Base',
      'unknown': 'Unknown Network',
    };
    const formattedNetwork = networkLabels[network] || network.charAt(0).toUpperCase() + network.slice(1).toLowerCase();
    
    // Use the improved sendFrameNotification function which handles invalidTokens automatically
    const { sendFrameNotification } = await import('./notifs');
    const result = await sendFrameNotification({
      fid,
      title: 'Voting is available!',
      body: `The cooldown has expired for address ${formattedAddress} on ${formattedNetwork}. Please vote again!`,
      notificationId,
      targetUrl: APP_URL,
    });

    if (result.state === 'success') {
      console.log(`✅ Cooldown notification sent to FID ${fid} for address ${formattedAddress} on ${formattedNetwork}`);
      
      // Optionally remove the vote record after notification is sent
      // Or keep it for history - depends on requirements
      // For now, we keep it but could add cleanup logic here
    } else if (result.state === 'no_token') {
      console.log(`⚠️ No valid token for FID ${fid} (token was invalid and removed)`);
    } else if (result.state === 'rate_limit') {
      console.log(`⏳ Rate limited for FID ${fid}, notification will be retried later`);
      // Could schedule a retry here if needed
    } else {
      const addressMasked = address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : '***';
      console.error(`❌ Error sending cooldown notification to FID ${fid} for address ${addressMasked} on ${network}:`, result);
    }
  } catch (error) {
    const addressMasked = address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : '***';
    console.error(`❌ Error sending notification to FID ${fid} for address ${addressMasked} on ${network}:`, error);
  }
}

export async function getAllTokens(): Promise<NotificationToken[]> {
  return await getAdapter().getAllTokens();
}

