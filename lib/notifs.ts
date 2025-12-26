import { APP_URL } from "@/lib/constants";
import {
  SendNotificationRequest,
  sendNotificationResponseSchema,
} from "@farcaster/frame-sdk";
import { getNotificationToken, removeNotificationToken } from "./notification-storage";

type SendFrameNotificationResult =
  | {
      state: "error";
      error: unknown;
    }
  | { state: "no_token" }
  | { state: "rate_limit" }
  | { state: "validation_error"; error: string }
  | { state: "success" };

/**
 * Validate notification fields according to Farcaster specification
 * @see https://miniapps.farcaster.xyz/docs/specification#notifications
 */
function validateNotificationFields({
  notificationId,
  title,
  body,
  targetUrl,
}: {
  notificationId: string;
  title: string;
  body: string;
  targetUrl: string;
}): { valid: boolean; error?: string } {
  // Validate notificationId: max 128 characters
  if (notificationId.length > 128) {
    return {
      valid: false,
      error: `notificationId exceeds maximum length of 128 characters (got ${notificationId.length})`,
    };
  }

  // Validate title: max 32 characters
  if (title.length > 32) {
    return {
      valid: false,
      error: `title exceeds maximum length of 32 characters (got ${title.length})`,
    };
  }

  // Validate body: max 128 characters
  if (body.length > 128) {
    return {
      valid: false,
      error: `body exceeds maximum length of 128 characters (got ${body.length})`,
    };
  }

  // Validate targetUrl: max 1024 characters
  if (targetUrl.length > 1024) {
    return {
      valid: false,
      error: `targetUrl exceeds maximum length of 1024 characters (got ${targetUrl.length})`,
    };
  }

  // Validate targetUrl is on the same domain as Mini App
  try {
    const targetUrlObj = new URL(targetUrl);
    const appUrlObj = new URL(APP_URL);
    
    // Check if hostname matches (same domain)
    if (targetUrlObj.hostname !== appUrlObj.hostname) {
      return {
        valid: false,
        error: `targetUrl must be on the same domain as the Mini App. Expected ${appUrlObj.hostname}, got ${targetUrlObj.hostname}`,
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: `targetUrl is not a valid URL: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return { valid: true };
}

type BatchNotificationToken = {
  fid: number;
  token: string;
  url: string;
};

type BatchSendResult = {
  successfulFids: number[];
  invalidFids: number[];
  rateLimitedFids: number[];
  errors: Array<{ fid: number; error: unknown }>;
};

/**
 * Send a notification to a single user
 * @param fid - Farcaster ID of the user
 * @param title - Notification title (max 32 characters)
 * @param body - Notification body (max 128 characters)
 * @param notificationId - Optional stable notification ID for idempotency (max 128 characters)
 *                         If not provided, a UUID will be generated
 * @param targetUrl - Optional target URL (defaults to APP_URL)
 */
export async function sendFrameNotification({
  fid,
  title,
  body,
  notificationId,
  targetUrl,
}: {
  fid: number;
  title: string;
  body: string;
  notificationId?: string;
  targetUrl?: string;
}): Promise<SendFrameNotificationResult> {
  // Get notification token from storage
  const notificationDetails = await getNotificationToken(fid);

  if (!notificationDetails || !notificationDetails.token || !notificationDetails.url) {
    return { state: "no_token" };
  }

  // Use provided notificationId or generate a UUID
  // For idempotency, use a stable ID based on content (e.g., "daily-reminder-05-06-2024")
  const stableNotificationId = notificationId || crypto.randomUUID();
  const finalTargetUrl = targetUrl || APP_URL;

  // Validate fields according to Farcaster specification
  const validation = validateNotificationFields({
    notificationId: stableNotificationId,
    title,
    body,
    targetUrl: finalTargetUrl,
  });

  if (!validation.valid) {
    console.error(`❌ Validation error for FID ${fid}:`, validation.error);
    return { state: "validation_error", error: validation.error! };
  }

  const response = await fetch(notificationDetails.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notificationId: stableNotificationId,
      title,
      body,
      targetUrl: finalTargetUrl,
      tokens: [notificationDetails.token],
    } satisfies SendNotificationRequest),
  });

  const responseJson = await response.json();

  // According to Farcaster spec, server MUST return HTTP 200 OK with JSON body containing:
  // { successfulTokens: string[], invalidTokens: string[], rateLimitedTokens: string[] }
  // @see https://miniapps.farcaster.xyz/docs/specification#notifications
  if (response.status === 200) {
    const responseBody = sendNotificationResponseSchema.safeParse(responseJson);
    if (responseBody.success === false) {
      // Malformed response - doesn't match expected schema
      console.error(`❌ Malformed response from notification server for FID ${fid}:`, responseBody.error.errors);
      return { state: "error", error: responseBody.error.errors };
    }

    // Handle invalid tokens - remove them from storage
    // According to spec: "Tokens which are no longer valid and should never be used again"
    if (responseBody.data.result.invalidTokens?.length > 0) {
      console.log(`🗑️ Invalid token for FID ${fid}, removing from storage...`);
      await removeNotificationToken(fid);
      return { state: "no_token" };
    }

    // Handle rate-limited tokens
    // According to spec: "Tokens for which the rate limit was exceeded. Mini App server can try later."
    if (responseBody.data.result.rateLimitedTokens?.length > 0) {
      // Rate limited
      return { state: "rate_limit" };
    }

    // Success - notification was sent successfully
    // According to spec: "Tokens for which the notification succeeded"
    return { state: "success" };
  } else {
    // Non-200 response - server error
    // According to spec, server MUST return 200 OK, so this is unexpected
    console.error(`❌ Unexpected HTTP status ${response.status} from notification server for FID ${fid}`);
    return { state: "error", error: responseJson };
  }
}

/**
 * Send the same notification to multiple users in a single batch request
 * Supports up to 100 tokens per request as per Farcaster documentation
 * 
 * @param tokens - Array of notification tokens (up to 100)
 * @param title - Notification title (max 32 characters)
 * @param body - Notification body (max 128 characters)
 * @param notificationId - Stable notification ID for idempotency (max 128 characters)
 *                         Can be reused across batches for the same notification
 * @param targetUrl - Optional target URL (defaults to APP_URL)
 * @returns Result with successful, invalid, and rate-limited FIDs
 */
export async function sendBatchNotification({
  tokens,
  title,
  body,
  notificationId,
  targetUrl,
}: {
  tokens: BatchNotificationToken[];
  title: string;
  body: string;
  notificationId: string;
  targetUrl?: string;
}): Promise<BatchSendResult> {
  if (tokens.length === 0) {
    return {
      successfulFids: [],
      invalidFids: [],
      rateLimitedFids: [],
      errors: [],
    };
  }

  if (tokens.length > 100) {
    throw new Error("Maximum 100 tokens per batch request (per Farcaster spec)");
  }

  // Group tokens by URL (different clients may use different URLs)
  const tokensByUrl = new Map<string, BatchNotificationToken[]>();
  
  for (const token of tokens) {
    const url = token.url;
    if (!tokensByUrl.has(url)) {
      tokensByUrl.set(url, []);
    }
    tokensByUrl.get(url)!.push(token);
  }

  const result: BatchSendResult = {
    successfulFids: [],
    invalidFids: [],
    rateLimitedFids: [],
    errors: [],
  };

  // Send batch requests grouped by URL
  const finalTargetUrl = targetUrl || APP_URL;

  // Validate fields according to Farcaster specification
  const validation = validateNotificationFields({
    notificationId,
    title,
    body,
    targetUrl: finalTargetUrl,
  });

  if (!validation.valid) {
    // Mark all tokens as errors due to validation failure
    for (const token of tokens) {
      result.errors.push({
        fid: token.fid,
        error: validation.error!,
      });
    }
    return result;
  }

  for (const [url, urlTokens] of tokensByUrl.entries()) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationId,
          title,
          body,
          targetUrl: finalTargetUrl,
          tokens: urlTokens.map(t => t.token),
        } satisfies SendNotificationRequest),
      });

      const responseJson = await response.json();

      if (response.status === 200) {
        const responseBody = sendNotificationResponseSchema.safeParse(responseJson);
        if (responseBody.success === false) {
          // Malformed response - mark all tokens as errors
          for (const token of urlTokens) {
            result.errors.push({
              fid: token.fid,
              error: responseBody.error.errors,
            });
          }
          continue;
        }

        // Map tokens back to FIDs
        const tokenToFid = new Map(urlTokens.map(t => [t.token, t.fid]));

        // Process successful tokens
        for (const token of responseBody.data.result.successfulTokens || []) {
          const fid = tokenToFid.get(token);
          if (fid !== undefined) {
            result.successfulFids.push(fid);
          }
        }

        // Process invalid tokens - remove them from storage
        for (const token of responseBody.data.result.invalidTokens || []) {
          const fid = tokenToFid.get(token);
          if (fid !== undefined) {
            result.invalidFids.push(fid);
            await removeNotificationToken(fid);
          }
        }

        // Process rate-limited tokens
        for (const token of responseBody.data.result.rateLimitedTokens || []) {
          const fid = tokenToFid.get(token);
          if (fid !== undefined) {
            result.rateLimitedFids.push(fid);
          }
        }
      } else {
        // Error response - mark all tokens as errors
        for (const token of urlTokens) {
          result.errors.push({
            fid: token.fid,
            error: responseJson,
          });
        }
      }
    } catch (error) {
      // Network or other errors - mark all tokens as errors
      for (const token of urlTokens) {
        result.errors.push({
          fid: token.fid,
          error: error,
        });
      }
    }
  }

  return result;
}

/**
 * Send notification to multiple users by FIDs
 * Automatically batches requests (up to 100 tokens per request)
 * 
 * @param fids - Array of Farcaster IDs
 * @param title - Notification title (max 32 characters)
 * @param body - Notification body (max 128 characters)
 * @param notificationId - Stable notification ID for idempotency (max 128 characters)
 * @param targetUrl - Optional target URL (defaults to APP_URL)
 * @returns Result with successful, invalid, and rate-limited FIDs
 */
export async function sendNotificationToMultipleUsers({
  fids,
  title,
  body,
  notificationId,
  targetUrl,
}: {
  fids: number[];
  title: string;
  body: string;
  notificationId: string;
  targetUrl?: string;
}): Promise<BatchSendResult> {
  // Fetch all notification tokens
  const { getAllTokens } = await import("./notification-storage");
  const allTokens = await getAllTokens();
  
  // Filter tokens for requested FIDs
  const tokensToSend: BatchNotificationToken[] = [];
  for (const fid of fids) {
    const tokenData = allTokens.find(t => t.fid === fid);
    if (tokenData?.token && tokenData?.url) {
      tokensToSend.push({
        fid: tokenData.fid,
        token: tokenData.token,
        url: tokenData.url,
      });
    }
  }

  if (tokensToSend.length === 0) {
    return {
      successfulFids: [],
      invalidFids: [],
      rateLimitedFids: [],
      errors: [],
    };
  }

  // Split into batches of 100 (Farcaster limit)
  const batches: BatchNotificationToken[][] = [];
  for (let i = 0; i < tokensToSend.length; i += 100) {
    batches.push(tokensToSend.slice(i, i + 100));
  }

  const result: BatchSendResult = {
    successfulFids: [],
    invalidFids: [],
    rateLimitedFids: [],
    errors: [],
  };

  // Send each batch
  for (const batch of batches) {
    const batchResult = await sendBatchNotification({
      tokens: batch,
      title,
      body,
      notificationId,
      targetUrl,
    });

    // Merge results
    result.successfulFids.push(...batchResult.successfulFids);
    result.invalidFids.push(...batchResult.invalidFids);
    result.rateLimitedFids.push(...batchResult.rateLimitedFids);
    result.errors.push(...batchResult.errors);
  }

  return result;
}
