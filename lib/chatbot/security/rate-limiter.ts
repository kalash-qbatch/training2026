import { CHATBOT_CONFIG } from "../config";

interface RateLimitRecord {
  timestamps: number[];
}

const sessionStore = new Map<string, RateLimitRecord>();

// Clean up stale sessions every 5 minutes to avoid memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function purgeStaleSessions() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - CHATBOT_CONFIG.SESSION_RATE_LIMIT_WINDOW_MS;
  for (const [sessionId, record] of sessionStore.entries()) {
    const validTimestamps = record.timestamps.filter((t) => t > cutoff);
    if (validTimestamps.length === 0) {
      sessionStore.delete(sessionId);
    } else {
      record.timestamps = validTimestamps;
    }
  }
}

/**
 * Checks and updates rate limit for a given session.
 * Returns { allowed: boolean, remaining: number, retryAfterMs?: number }
 */
export function checkRateLimit(sessionId: string): {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
} {
  purgeStaleSessions();

  const now = Date.now();
  const windowStart = now - CHATBOT_CONFIG.SESSION_RATE_LIMIT_WINDOW_MS;

  const record = sessionStore.get(sessionId) ?? { timestamps: [] };
  // Filter out timestamps outside current rolling window
  const activeTimestamps = record.timestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= CHATBOT_CONFIG.SESSION_RATE_LIMIT_MAX) {
    const oldestTimestamp = activeTimestamps[0];
    const retryAfterMs = Math.max(
      0,
      oldestTimestamp + CHATBOT_CONFIG.SESSION_RATE_LIMIT_WINDOW_MS - now
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  activeTimestamps.push(now);
  sessionStore.set(sessionId, { timestamps: activeTimestamps });

  return {
    allowed: true,
    remaining: CHATBOT_CONFIG.SESSION_RATE_LIMIT_MAX - activeTimestamps.length,
  };
}

/** Reset rate limiter store (useful in automated tests) */
export function resetRateLimits() {
  sessionStore.clear();
}
