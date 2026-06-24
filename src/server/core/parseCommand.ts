/**
 * Parses a comment body to figure out which scammerwatchlist command (if any)
 * the commenter is issuing. Kept as a pure function, independent of the
 * Reddit API, so the matching logic is easy to reason about and test.
 *
 * Recognized commands (case-insensitive, "u/" or "/u/" both accepted):
 *   "u/scammerwatchlist remove blacklist"  -> REMOVE
 *   "u/scammerwatchlist blacklist"         -> ADD
 *   "u/scammerwatchlist"                   -> CHECK
 *
 * "remove blacklist" is checked before "blacklist" since it's the more
 * specific match and "blacklist" is a substring of "remove blacklist".
 */

export type ScammerCommand = 'ADD' | 'REMOVE' | 'CHECK' | 'NONE';

// Matches "u/scammerwatchlist" or "/u/scammerwatchlist" as a whole mention,
// not as a substring of a longer username (e.g. "u/scammerwatchlist2" should
// not match). \b after the name enforces a word boundary.
const MENTION_RE = /\/?u\/scammerwatchlist\b/i;

export function parseCommand(commentBody: string, botUsername = 'scammerwatchlist'): ScammerCommand {
  const mentionRe = new RegExp(`\\/?u\\/${escapeRegex(botUsername)}\\b`, 'i');
  const match = mentionRe.exec(commentBody);
  if (!match) return 'NONE';

  // Look only at text *after* the mention, so phrasing like
  // "blacklist this guy, u/scammerwatchlist" still resolves to CHECK
  // (no command keyword after the mention) rather than misfiring on
  // a keyword that appeared before it.
  const after = commentBody.slice(match.index + match[0].length).toLowerCase();

  if (/\bremove\s+blacklist\b/.test(after)) return 'REMOVE';
  if (/\bblacklist\b/.test(after)) return 'ADD';
  return 'CHECK';
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Exported for reuse/testing if needed elsewhere.
export { MENTION_RE };