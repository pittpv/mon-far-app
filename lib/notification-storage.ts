// Storage for notification tokens and cooldown tracking
// Uses database adapter for persistence (supports in-memory, file, PostgreSQL, MongoDB)

import { getDatabaseAdapter, type DatabaseAdapter, type NotificationToken } from './db-adapter';

// Get database adapter instance
let dbAdapter: DatabaseAdapter | null = null;

function getAdapter(): DatabaseAdapter {
  if (!dbAdapter) {
    dbAdapter = getDatabaseAdapter();
  }
  return dbAdapter;
}

// Store scheduled notifications: fid -> timeout ID
// Note: In production with multiple servers, use a job queue (Bull, BullMQ, etc.)
const scheduledNotifications = new Map<number, NodeJS.Timeout>();

export async function getNotificationToken(fid: number): Promise<NotificationToken | null> {
  return await getAdapter().getNotificationToken(fid);
}

export async function saveNotificationToken(fid: number, token: string, url: string) {
  const adapter = getAdapter();
  await adapter.saveNotificationToken({
    fid,
    token,
    url,
  });
  console.log(`✅ Notification token saved for FID: ${fid}`);
}

export async function removeNotificationToken(fid: number) {
  const adapter = getAdapter();
  await adapter.removeNotificationToken(fid);
  
  // Cancel any scheduled notifications
  const timeoutId = scheduledNotifications.get(fid);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledNotifications.delete(fid);
  }
  console.log(`🗑️ Notification token removed for FID: ${fid}`);
}

export async function saveUserVote(
  fid: number, 
  address: string, 
  voteTime: number,
  blockTimestamp?: number // Optional: exact block timestamp for precise cooldown
) {
  const adapter = getAdapter();
  const tokenData = await adapter.getNotificationToken(fid);
  
  if (!tokenData) {
    console.warn(`⚠️ No notification token found for FID ${fid}. Vote data will not be saved. User needs to add MiniApp first via webhook.`);
    return;
  }
  
  // Use block timestamp if available for more accurate cooldown calculation
  const actualVoteTime = blockTimestamp || voteTime;
  
  try {
    await adapter.saveNotificationToken({
      ...tokenData,
      address,
      lastVoteTime: actualVoteTime,
    });
    
    console.log(`✅ Vote saved for FID ${fid}, address ${address}, voteTime ${actualVoteTime}`);
    
    // Schedule notification for when cooldown ends (24 hours = 86400 seconds)
    scheduleCooldownNotification(fid, address, actualVoteTime);
  } catch (error) {
    console.error(`❌ Failed to save vote for FID ${fid}:`, error);
    throw error;
  }
}

// Schedule notification to be sent when cooldown ends
function scheduleCooldownNotification(fid: number, address: string, voteTime: number) {
  // Cancel any existing scheduled notification
  const existingTimeout = scheduledNotifications.get(fid);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Cooldown is 24 hours (86400 seconds)
  const cooldownSeconds = 24 * 60 * 60;
  const cooldownEndTime = voteTime + cooldownSeconds;
  const now = Math.floor(Date.now() / 1000);
  const timeUntilNotification = Math.max(0, cooldownEndTime - now) * 1000; // Convert to milliseconds

  if (timeUntilNotification <= 0) {
    // Cooldown already ended, send notification immediately
    console.log(`⏰ Cooldown already ended for FID ${fid}, sending notification immediately`);
    sendCooldownNotification(fid, address);
    return;
  }

  console.log(`⏰ Scheduling notification for FID ${fid} in ${Math.floor(timeUntilNotification / 1000)}s`);

  const timeoutId = setTimeout(async () => {
    await sendCooldownNotification(fid, address);
    scheduledNotifications.delete(fid);
  }, timeUntilNotification);

  scheduledNotifications.set(fid, timeoutId);
}

// Send notification when cooldown ends
async function sendCooldownNotification(fid: number, address: string) {
  const adapter = getAdapter();
  const tokenData = await adapter.getNotificationToken(fid);
  
  if (!tokenData || !tokenData.token || !tokenData.url) {
    console.log(`⚠️ No notification token found for FID ${fid}`);
    return;
  }

  try {
    const { APP_URL } = await import('@/lib/constants');
    const notificationId = `cooldown-ended-${fid}-${Date.now()}`;
    
    // Format address for display (first 6 and last 4 characters)
    const formattedAddress = address.length > 10 
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address;
    
    const response = await fetch(tokenData.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId,
        title: 'Voting is available!',
        body: `The cooldown has expired for address ${formattedAddress}. Please vote again!`,
        targetUrl: APP_URL,
        tokens: [tokenData.token],
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Notification sent to FID ${fid}:`, result);
      
      // Handle invalid tokens
      if (result.invalidTokens?.length > 0) {
        console.log(`🗑️ Invalid tokens for FID ${fid}, removing...`);
        await adapter.removeNotificationToken(fid);
      }
    } else {
      console.error(`❌ Failed to send notification to FID ${fid}:`, response.statusText);
    }
  } catch (error) {
    console.error(`❌ Error sending notification to FID ${fid}:`, error);
  }
}

export async function getAllTokens(): Promise<NotificationToken[]> {
  return await getAdapter().getAllTokens();
}

