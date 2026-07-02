import { redis } from '@devvit/web/server';

/**
 * Tracks which posts have already received a scammer warning for a given user.
 * Enforces the "warn once per post" rule — if a blacklisted user makes
 * multiple comments in the same thread, we only reply to the first one.
 *
 * Key pattern: scammerwatchlist:warned:<postId>:<lowercased-username>
 * Value:       "1" (existence flag)
 * Expiration:  30 days (posts go stale; no need to keep forever)
 */
const TTL_DAYS = 30;

function warnedKey(postId: string, username: string): string {
  return `scammerwatchlist:warned:${postId}:${username.trim().toLowerCase()}`;
}

function expirationDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + TTL_DAYS);
  return d;
}

/** Returns true if we've already warned about this user in this post. */
export async function hasWarnedInPost(postId: string, username: string): Promise<boolean> {
  const val = await redis.get(warnedKey(postId, username));
  return val !== null && val !== undefined;
}

/** Marks that we've warned about this user in this post. */
export async function markWarnedInPost(postId: string, username: string): Promise<void> {
  await redis.set(warnedKey(postId, username), '1', {
    expiration: expirationDate(),
  });
}