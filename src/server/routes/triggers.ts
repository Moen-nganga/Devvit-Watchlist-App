import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnCommentSubmitRequest,
  OnPostSubmitRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';
import type { T5 } from '@devvit/shared-types/tid.js';
import { createPost } from '../core/post';
import { parseCommand } from '../core/parseCommand';
import { getScammerEntry, isScammer, removeScammer } from '../core/scammerList';
import { addPendingReport, hasPendingReport } from '../core/pendingReports';
import { hasWarnedInPost, markWarnedInPost } from '../core/warnedPosts';
import { isCurrentUserModerator } from '../core/permissions';

export const triggers = new Hono();

const BOT_USERNAME = 'scammerwatchlist';

/* -------------------- existing scaffold trigger -------------------- */

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
    return c.json<TriggerResponse>({ status: 'error', message: 'Failed to create post' }, 400);
  }
});

/* -------------------- comment submit -------------------- */

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

  // Never act on the bot's own comments.
  if (commenterName.toLowerCase() === BOT_USERNAME.toLowerCase()) return;

  // --- Enforcement: is the commenter a known scammer? ---
  // Throttled: only warn once per post thread.
  await warnIfScammer(commenterName, comment.id, comment.postId);

  // --- Command parsing ---
  const command = parseCommand(comment.body ?? '', BOT_USERNAME);
  if (command === 'NONE') return;

  const replyTarget = await reddit.getCommentById(asCommentId(comment.id));
  const target = await resolveTarget(comment);

  if (!target) {
    await replyTarget.reply({
      text: "I couldn't figure out who you're referring to. Reply directly to a comment or post made by the account you want to report.",
    });
    return;
  }

  // Block self-actions.
  if (target.toLowerCase() === commenterName.toLowerCase() && (command === 'ADD' || command === 'REMOVE')) {
    await replyTarget.reply({ text: "You can't report or remove yourself." });
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
      // Check if already confirmed blacklisted
      if (await isScammer(target)) {
        await replyTarget.reply({
          text: `u/${target} is already on the confirmed scammer watchlist.`,
        });
        return;
      }

      // Check if already pending
      if (await hasPendingReport(target)) {
        await replyTarget.reply({
          text: `u/${target} has already been reported and is awaiting moderator review.`,
        });
        return;
      }

      // Build permalink: Reddit comment permalink format
      const subredditName = context.subredditName ?? 'unknown';
      const permalink = `https://reddit.com/r/${subredditName}/comments/${comment.postId.replace('t3_', '')}/-/${comment.id.replace('t1_', '')}`;

      // Store pending report
      await addPendingReport({
        targetUsername: target,
        reportedBy: commenterName,
        reportedAt: Date.now(),
        sourcePostId: comment.postId,
        sourceCommentId: comment.id,
        sourcePermalink: permalink,
      });

      // Notify mods via modmail
      const subredditId = context.subredditId as T5;
      await reddit.modMail.createModNotification({
        subject: `Scammer report pending review: u/${target}`,
        bodyMarkdown: [
          `**New scammer report submitted** — moderator action required.`,
          ``,
          `- **Reported account:** u/${target}`,
          `- **Reported by:** u/${commenterName}`,
          `- **Original comment:** [View here](${permalink})`,
          ``,
          `To review and approve or deny this report, go to the **Scammer Reports** menu item in the subreddit menu.`,
        ].join('\n'),
        subredditId,
      });

      await replyTarget.reply({
        text: `Your report of u/${target} has been submitted to the moderators for review. If approved, this account will be added to the scammer watchlist.`,
      });
      break;
    }

    case 'REMOVE': {
      // Remove is mod-only
      const isMod = await isCurrentUserModerator();
      if (!isMod) {
        await replyTarget.reply({
          text: 'Only moderators can remove accounts from the scammer watchlist.',
        });
        return;
      }

      const existed = await isScammer(target);
      await removeScammer(target);
      await replyTarget.reply({
        text: existed
          ? `u/${target} has been removed from the scammer watchlist.`
          : `u/${target} was not on the scammer watchlist.`,
      });
      break;
    }
  }
}

/* -------------------- post submit: enforcement only -------------------- */

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

/* -------------------- helpers -------------------- */

function asCommentId(id: string) {
  return (id.startsWith('t1_') ? id : `t1_${id}`) as `t1_${string}`;
}
function asPostId(id: string) {
  return (id.startsWith('t3_') ? id : `t3_${id}`) as `t3_${string}`;
}

async function resolveTarget(comment: { parentId: string; postId: string }): Promise<string | undefined> {
  const isTopLevel = comment.parentId === comment.postId;
  if (isTopLevel) {
    const post = await reddit.getPostById(asPostId(comment.postId));
    return post?.authorName;
  }
  const parentComment = await reddit.getCommentById(asCommentId(comment.parentId));
  return parentComment?.authorName;
}

async function warnIfScammer(username: string, commentId: string, postId: string): Promise<void> {
  const entry = await getScammerEntry(username);
  if (!entry) return;

  // Once-per-post throttle
  if (await hasWarnedInPost(postId, username)) return;
  await markWarnedInPost(postId, username);

  const comment = await reddit.getCommentById(asCommentId(commentId));
  await comment.reply({
    text: `⚠️ Heads up — u/${username} is on this subreddit's scammer watchlist. Exercise caution before interacting with this account.`,
  });
}

async function warnIfScammerOnPost(username: string, postId: string): Promise<void> {
  const entry = await getScammerEntry(username);
  if (!entry) return;

  // Once-per-post throttle (posts count as their own postId)
  if (await hasWarnedInPost(postId, username)) return;
  await markWarnedInPost(postId, username);

  const post = await reddit.getPostById(asPostId(postId));
  await post.addComment({
    text: `⚠️ Heads up — u/${username} is on this subreddit's scammer watchlist. Exercise caution before interacting with this account.`,
  });
}