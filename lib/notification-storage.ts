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
  
  // Clean up expired votes before saving
  const now = Math.floor(Date.now() / 1000);
  let votesToSave = migratedToken?.votes || [];
  
  if (votesToSave.length > 0) {
    const activeVotes = votesToSave.filter(vote => vote.cooldownEndTime > now);
    const expiredCount = votesToSave.length - activeVotes.length;
    
    if (expiredCount > 0) {
      console.log(`🧹 Cleaning up ${expiredCount} expired vote record(s) for FID ${fid} when saving token`);
      votesToSave = activeVotes;
    }
  }
  
  await adapter.saveNotificationToken({
    fid,
    token,
    url,
    // Preserve existing votes array if it exists (only active votes)
    votes: votesToSave,
    // Legacy fields removed - all data is in votes array
  });
  console.log(`✅ Notification token saved for FID: ${fid}`);
  
  // Reschedule notifications for all votes that are still in cooldown
  // This is critical for serverless environments where setTimeout is lost between invocations
  if (votesToSave.length > 0) {
    console.log(`🔄 Rescheduling notifications for FID ${fid} (${votesToSave.length} active votes)`);
    rescheduleAllNotifications(fid, votesToSave);
  }
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
  
  // Clean up old votes with expired cooldown before processing new vote
  // This prevents accumulation of stale records in the database
  const now = Math.floor(Date.now() / 1000);
  const activeVotes = existingVotes.filter(vote => vote.cooldownEndTime > now);
  
  if (activeVotes.length < existingVotes.length) {
    const cleanedCount = existingVotes.length - activeVotes.length;
    console.log(`🧹 Cleaning up ${cleanedCount} expired vote record(s) for FID ${fid}`);
  }
  
  // Check if vote for this address+network combination already exists
  // Same address can vote in different networks, so we need to check both
  const existingVoteIndex = activeVotes.findIndex(
    v => v.address.toLowerCase() === address.toLowerCase() && v.network === voteNetwork
  );
  
  let updatedVotes: VoteRecord[];
  const addressMasked = address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : '***';
  if (existingVoteIndex >= 0) {
    // Update existing vote for this address+network combination
    updatedVotes = [...activeVotes];
    updatedVotes[existingVoteIndex] = newVote;
    console.log(`🔄 Updating existing vote for FID ${fid}, address ${addressMasked}, network ${voteNetwork}`);
  } else {
    // Add new vote
    updatedVotes = [...activeVotes, newVote];
    console.log(`➕ Adding new vote for FID ${fid}, address ${addressMasked}, network ${voteNetwork}`);
  }
  
  try {
    await adapter.saveNotificationToken({
      ...migratedToken,
      votes: updatedVotes,
      // All vote data is stored in votes array, no need for legacy fields
    });
    
    console.log(`✅ Vote saved for FID ${fid}, address ${addressMasked}, network ${voteNetwork}, voteTime ${actualVoteTime}, total votes: ${updatedVotes.length}`);
    
    // Check if notifications are already scheduled for this FID
    // In serverless environments, scheduledNotifications may be empty even if votes exist in DB
    const hasScheduledNotifications = scheduledNotifications.has(fid) && scheduledNotifications.get(fid)!.size > 0;
    
    // Only restore notifications for active votes (cooldown not expired)
    const activeVotesToRestore = updatedVotes.filter(v => v.cooldownEndTime > now);
    if (!hasScheduledNotifications && activeVotesToRestore.length > 0) {
      // Notifications were lost (e.g., server restart in serverless), restore them from DB
      console.log(`🔄 Restoring notifications for FID ${fid} from database (serverless restart detected)`);
      rescheduleAllNotifications(fid, activeVotesToRestore);
    }
    
    // Schedule notification for when cooldown ends (24 hours = 86400 seconds)
    scheduleCooldownNotification(fid, address, voteNetwork, actualVoteTime, cooldownEndTime);
    
    // Also reschedule notifications for all other address+network combinations that are still in cooldown
    // This ensures all notifications are up to date
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
 * Remove a specific vote record from database
 * Called after successful cooldown notification to prevent accumulation of old records
 */
async function removeVoteRecord(fid: number, address: string, network: string): Promise<void> {
  try {
    const adapter = getAdapter();
    const tokenData = await adapter.getNotificationToken(fid);
    
    if (!tokenData) {
      return; // Token doesn't exist, nothing to clean
    }
    
    const migratedToken = migrateLegacyData(tokenData);
    const existingVotes = migratedToken.votes || [];
    
    // Remove vote record for this specific address+network combination
    const filteredVotes = existingVotes.filter(
      v => !(v.address.toLowerCase() === address.toLowerCase() && v.network === network)
    );
    
    // Only update if something was removed
    if (filteredVotes.length < existingVotes.length) {
      await adapter.saveNotificationToken({
        ...migratedToken,
        votes: filteredVotes,
      });
      
      const addressMasked = address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : '***';
      console.log(`🗑️ Removed vote record for FID ${fid}, address ${addressMasked}, network ${network} after notification`);
    }
  } catch (error) {
    // Log error but don't throw - cleanup failure shouldn't break notification flow
    const addressMasked = address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : '***';
    console.error(`❌ Error removing vote record for FID ${fid}, address ${addressMasked}, network ${network}:`, error);
  }
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
    // Use void to fire and forget, but handle errors in the function itself
    void sendCooldownNotification(fid, address, network, cooldownEndTime).catch(error => {
      console.error(`❌ Error sending immediate cooldown notification to FID ${fid}:`, error);
    });
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
      // Use void to fire and forget, but handle errors in the function itself
      void sendCooldownNotification(fid, vote.address, vote.network || 'unknown', vote.cooldownEndTime).catch(error => {
        console.error(`❌ Error sending immediate cooldown notification to FID ${fid}:`, error);
      });
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
      
      // Remove the vote record from database after successful notification
      // This prevents accumulation of old records and duplicate notifications
      await removeVoteRecord(fid, address, network);
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

/**
 * Restore all notifications from database
 * This is useful for serverless environments where setTimeout is lost between invocations
 * Call this function periodically or when needed to ensure notifications are scheduled
 */
export async function restoreAllNotifications(): Promise<{ restored: number; errors: number; cleaned: number }> {
  const adapter = getAdapter();
  const allTokens = await adapter.getAllTokens();
  
  let restored = 0;
  let errors = 0;
  let cleaned = 0;
  const now = Math.floor(Date.now() / 1000);
  
  for (const token of allTokens) {
    try {
      const migratedToken = migrateLegacyData(token);
      
      if (migratedToken.votes && migratedToken.votes.length > 0) {
        // Filter out expired votes to prevent duplicate notifications
        const activeVotes = migratedToken.votes.filter(vote => vote.cooldownEndTime > now);
        const expiredCount = migratedToken.votes.length - activeVotes.length;
        
        // Clean up expired votes from database
        if (expiredCount > 0) {
          await adapter.saveNotificationToken({
            ...migratedToken,
            votes: activeVotes,
          });
          cleaned += expiredCount;
          console.log(`🧹 Cleaned up ${expiredCount} expired vote record(s) for FID ${token.fid}`);
        }
        
        // Only restore notifications for active votes
        if (activeVotes.length > 0) {
          // Check if notifications are already scheduled
          const hasScheduledNotifications = scheduledNotifications.has(token.fid) && scheduledNotifications.get(token.fid)!.size > 0;
          
          if (!hasScheduledNotifications) {
            console.log(`🔄 Restoring notifications for FID ${token.fid} (${activeVotes.length} active votes)`);
            rescheduleAllNotifications(token.fid, activeVotes);
            restored++;
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error restoring notifications for FID ${token.fid}:`, error);
      errors++;
    }
  }
  
  console.log(`✅ Restored notifications: ${restored} FIDs, cleaned: ${cleaned} expired records, errors: ${errors}`);
  return { restored, errors, cleaned };
}

