import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { isCurrentUserModerator } from '../core/permissions';
import { getPendingReportCount } from '../core/pendingReports';

export const menu = new Hono();

/**
 * Opens the mod dashboard (game.html webview) showing pending scammer reports.
 * Declared as forUserType: "moderator" in devvit.json; also verified server-side.
 */
menu.post('/scammer-reports', async (c) => {
  if (!(await isCurrentUserModerator())) {
    return c.json<UiResponse>({ showToast: 'Only moderators can access the scammer reports dashboard.' }, 403);
  }

  const count = await getPendingReportCount();
  const post = await createPost();

  return c.json<UiResponse>(
    {
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}?label=${count > 0 ? `${count} pending` : 'no pending reports'}`,
    },
    200
  );
});

/**
 * Example form — scaffold route, kept for reference.
 */
menu.post('/example-form', async (c) => {
  if (!(await isCurrentUserModerator())) {
    return c.json<UiResponse>({ showToast: 'Only moderators can access this.' }, 403);
  }
  return c.json<UiResponse>({ showToast: 'Example form triggered.' }, 200);
});

/**
 * Original post-create route — kept for scaffold compatibility.
 */
menu.post('/post-create', async (c) => {
  if (!(await isCurrentUserModerator())) {
    return c.json<UiResponse>({ showToast: 'Only moderators can create a post.' }, 403);
  }
  try {
    const post = await createPost();
    return c.json<UiResponse>(
      { navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}` },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to create post' }, 400);
  }
});