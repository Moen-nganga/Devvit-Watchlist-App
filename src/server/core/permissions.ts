import { context, reddit } from '@devvit/web/server';

/**
 * Returns true if the currently-invoking user is a moderator of the
 * subreddit this request is running in. Used as a server-side check for
 * any mod-only menu item, form, or action — declaring "forUserType":
 * "moderator" in devvit.json only controls whether the UI entry point is
 * *shown*; it doesn't stop the underlying endpoint from being hit directly.
 */
export async function isCurrentUserModerator(): Promise<boolean> {
  const subredditName = context.subredditName;
  if (!subredditName) return false;

  const user = await reddit.getCurrentUser();
  if (!user) return false;

  const permissions = await user.getModPermissionsForSubreddit(subredditName);
  return permissions.length > 0;
}