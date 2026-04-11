/**
 * Expo Push Notification sender.
 *
 * Batches recipient tokens into chunks of 100 (the Expo API limit per request)
 * and POSTs each chunk to https://exp.host/--/api/v2/push/send.
 *
 * Returns a structured `{sent, errors}` summary. NEVER throws — network and
 * non-2xx responses are converted into per-token error entries so the caller
 * (typically a request handler) can decide how to react without crashing.
 */

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK_SIZE = 100;

export interface SendPushError {
  token: string;
  reason: string;
}

export interface SendPushResult {
  sent: number;
  errors: SendPushError[];
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Send a push notification to one or more Expo push tokens.
 *
 * @param tokens - Recipient Expo push tokens (e.g. "ExponentPushToken[abc]").
 * @param title - Notification title.
 * @param body - Notification body.
 * @param data - Optional data payload delivered with the notification.
 * @returns Result with `sent` count and per-token `errors` array. Never throws.
 */
export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<SendPushResult> {
  const errors: SendPushError[] = [];
  let sent = 0;

  if (!Array.isArray(tokens) || tokens.length === 0) {
    return { sent: 0, errors: [] };
  }

  const batches = chunk(tokens, EXPO_CHUNK_SIZE);

  for (const batch of batches) {
    const messages: ExpoPushMessage[] = batch.map((to) => ({
      to,
      title,
      body,
      data: data ?? {},
    }));

    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        let reason = `HTTP ${response.status}`;
        try {
          const text = await response.text();
          if (text) {
            reason = `HTTP ${response.status}: ${text}`;
          }
        } catch {
          // Body read failure — fall back to status-only reason.
        }
        for (const t of batch) {
          errors.push({ token: t, reason });
        }
        continue;
      }

      sent += batch.length;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      for (const t of batch) {
        errors.push({ token: t, reason });
      }
    }
  }

  return { sent, errors };
}
