import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { isCurrentUserModerator } from '../core/permissions';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    // Defense in depth: devvit.json gates this menu item to moderators via
    // "forUserType": "moderator", but that only controls whether the menu
    // entry is *shown* to the user. We re-verify mod status here server-side
    // before performing the action, in case the endpoint is ever hit directly.
    if (!(await isCurrentUserModerator())) {
      return c.json<UiResponse>(
        { showToast: 'Only moderators of this subreddit can create a post.' },
        403
      );
    }

    const post = await createPost();

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});