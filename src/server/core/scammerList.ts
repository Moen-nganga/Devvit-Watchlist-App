import { redis } from '@devvit/web/server';

/**
 * All scammer-list entries live under one Redis hash so we can list/inspect
 * them later (e.g. for a mod dashboard) without scanning arbitrary keys.
 *
 * Key:   scammerwatchlist:entries          (hash)
 * Field: lowercased reddit username (without "u/")
 * Value: JSON-stringified ScammerEntry
 */
const SCAMMER_HASH_KEY = 'scammerwatchlist:entries';

export type ScammerEntry = {
  username: string; // original-case username, no "u/" prefix
  addedBy: string; // username of the redditor who flagged them
  addedAt: number; // epoch ms
  sourcePostId: string; // post the flag happened on, for audit/debug
  sourceCommentId: string; // comment that triggered the flag
};

const normalize = (username: string): string => username.trim().toLowerCase();

/**
 * Returns the entry for a username if they're on the scammer list, else null.
 */
export async function getScammerEntry(username: string): Promise<ScammerEntry | null> {
  const raw = await redis.hGet(SCAMMER_HASH_KEY, normalize(username));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ScammerEntry;
  } catch {
    // Corrupt entry shouldn't crash the trigger; treat as "not found".
    return null;
  }
}

export async function isScammer(username: string): Promise<boolean> {
  return (await getScammerEntry(username)) !== null;
}

/**
 * Adds a username to the scammer list. Overwrites any existing entry
 * (e.g. re-flagging updates addedBy/addedAt) — that's fine since we only
 * ever check existence, not history.
 */
export async function addScammer(entry: ScammerEntry): Promise<void> {
  await redis.hSet(SCAMMER_HASH_KEY, { [normalize(entry.username)]: JSON.stringify(entry) });
}

/**
 * Removes a username from the scammer list. No-op if they weren't on it.
 */
export async function removeScammer(username: string): Promise<void> {
  await redis.hDel(SCAMMER_HASH_KEY, [normalize(username)]);
}