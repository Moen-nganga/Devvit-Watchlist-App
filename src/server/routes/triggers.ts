import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnCommentSubmitRequest,
  OnPostSubmitRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';
import { createPost } from '../core/post';
import { parseCommand } from '../core/parseCommand';
import { addScammer, getScammerEntry, isScammer, removeScammer } from '../core/scammerList';

export const triggers = new Hono();

const BOT_USERNAME = 'scammerwatchlist';

/* --------------------------- existing scaffold trigger --------------------------- */

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Post created in subreddit ${context.subredditName} with id ${post.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});

/* --------------------------- comment submit: commands + enforcement --------------------------- */

triggers.post('/on-comment-submit', async (c) => {
  try {
    const event = await c.req.json<OnCommentSubmitRequest>();
    await handleCommentSubmit(event);
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  } catch (error) {
    console.error(`Error handling comment submit: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Failed to process comment' }, 400);
  }
});

async function handleCommentSubmit(event: OnCommentSubmitRequest): Promise<void> {
  const comment = event.comment;
  const commenterName = event.author?.name;

  if (!comment || !commenterName) return;

  // Never act on the bot's own comments (avoid loops from our auto-replies).
  if (commenterName.toLowerCase() === BOT_USERNAME.toLowerCase()) return;

  // --- Enforcement: is the commenter themself a known scammer? Runs on every comment. ---
  await warnIfScammer(commenterName, comment.id);

  // --- Command parsing: did this comment invoke u/scammerwatchlist? ---
  const command = parseCommand(comment.body ?? '', BOT_USERNAME);
  if (command === 'NONE') return;

  const target = await resolveTarget(comment);
  const replyTarget = await reddit.getCommentById(asCommentId(comment.id));

  if (!target) {
    await replyTarget.reply({
      text: "I couldn't figure out who you're referring to. Reply directly to the comment or post of the account in question.",
    });
    return;
  }

  // Block self-flagging / self-removal.
  if (target.toLowerCase() === commenterName.toLowerCase() && (command === 'ADD' || command === 'REMOVE')) {
    await replyTarget.reply({ text: "You can't add or remove yourself from the scammer watchlist." });
    return;
  }

  switch (command) {
    case 'CHECK': {
      const entry = await getScammerEntry(target);
      await replyTarget.reply({
        text: entry
          ? `⚠️ u/${target} is on the scammer watchlist (flagged on ${new Date(entry.addedAt).toUTCString()}). Be cautious interacting with this account.`
          : `u/${target} is not currently on the scammer watchlist.`,
      });
      break;
    }
    case 'ADD': {
      const already = await isScammer(target);
      await addScammer({
        username: target,
        addedBy: commenterName,
        addedAt: Date.now(),
        sourcePostId: comment.postId,
        sourceCommentId: comment.id,
      });
      await replyTarget.reply({
        text: already
          ? `u/${target} was already on the scammer watchlist. Record updated.`
          : `🚨 u/${target} has been added to the SCAMMER watchlist. This account will now be flagged automatically on future posts and comments in this subreddit.`,
      });
      break;
    }
    case 'REMOVE': {
      const existed = await isScammer(target);
      await removeScammer(target);
      await replyTarget.reply({
        text: existed
          ? `u/${target} has been removed from the scammer watchlist.`
          : `u/${target} was not on the scammer watchlist, so there's nothing to remove.`,
      });
      break;
    }
  }
}

/* --------------------------- post submit: enforcement only --------------------------- */

triggers.post('/on-post-submit', async (c) => {
  try {
    const event = await c.req.json<OnPostSubmitRequest>();
    await handlePostSubmit(event);
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  } catch (error) {
    console.error(`Error handling post submit: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Failed to process post' }, 400);
  }
});

async function handlePostSubmit(event: OnPostSubmitRequest): Promise<void> {
  const post = event.post;
  const authorName = event.author?.name;
  if (!post || !authorName) return;

  if (authorName.toLowerCase() === BOT_USERNAME.toLowerCase()) return;

  await warnIfScammerOnPost(authorName, post.id);
}

/* --------------------------- helpers --------------------------- */

// CommentV2/PostV2 ids come through the trigger payload as plain strings
// (e.g. "abc123"), not the "t1_"/"t3_"-prefixed branded IDs that the
// @devvit/reddit client methods require. asCommentId/asPostId add the
// prefix back so we can pass them to getCommentById/getPostById.
function asCommentId(id: string) {
  return (id.startsWith('t1_') ? id : `t1_${id}`) as `t1_${string}`;
}
function asPostId(id: string) {
  return (id.startsWith('t3_') ? id : `t3_${id}`) as `t3_${string}`;
}

/**
 * Determines which account a comment is "about":
 *  - reply to another comment -> that comment's author
 *  - top-level comment on a post -> the post's author (OP)
 */
async function resolveTarget(comment: { parentId: string; postId: string }): Promise<string | undefined> {
  const isTopLevel = comment.parentId === comment.postId;

  if (isTopLevel) {
    const post = await reddit.getPostById(asPostId(comment.postId));
    return post?.authorName;
  }

  const parentComment = await reddit.getCommentById(asCommentId(comment.parentId));
  return parentComment?.authorName;
}

async function warnIfScammer(username: string | undefined, commentId: string): Promise<void> {
  if (!username) return;
  const entry = await getScammerEntry(username);
  if (!entry) return;

  const comment = await reddit.getCommentById(asCommentId(commentId));
  await comment.reply({
    text: `⚠️ Heads up — u/${username} is on this subreddit's scammer watchlist. Exercise caution before interacting with this account.`,
  });
}

async function warnIfScammerOnPost(username: string | undefined, postId: string): Promise<void> {
  if (!username) return;
  const entry = await getScammerEntry(username);
  if (!entry) return;

  const post = await reddit.getPostById(asPostId(postId));
  await post.addComment({
    text: `⚠️ Heads up — u/${username} is on this subreddit's scammer watchlist. Exercise caution before interacting with this account.`,
  });
}