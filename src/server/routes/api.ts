import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import type {
  InitResponse,
  IncrementResponse,
  DecrementResponse,
  PendingReportsResponse,
  ApproveReportResponse,
  DenyReportResponse,
} from '../../shared/api';
import { redis, context } from '@devvit/web/server';
import { getAllPendingReports, getPendingReport, removePendingReport } from '../core/pendingReports';
import { addScammer } from '../core/scammerList';
import { isCurrentUserModerator } from '../core/permissions';

type ErrorResponse = {
  status: 'error';
  message: string;
};

export const api = new Hono();

/* -------------------- existing counter routes (scaffold) -------------------- */

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required but missing from context' }, 400);
  }
  try {
    const [count, username] = await Promise.all([redis.get('count'), reddit.getCurrentUsername()]);
    return c.json<InitResponse>({
      type: 'init',
      postId,
      count: count ? parseInt(count) : 0,
      username: username ?? 'anonymous',
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    return c.json<ErrorResponse>({ status: 'error', message: 'Initialization failed' }, 400);
  }
});

api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({ count, postId, type: 'increment' });
});

api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({ count, postId, type: 'decrement' });
});

/* -------------------- mod dashboard routes -------------------- */

/** Returns all pending reports + current username (for mod permission check on client) */
api.get('/pending-reports', async (c) => {
  if (!(await isCurrentUserModerator())) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Moderators only.' }, 403);
  }
  const reports = await getAllPendingReports();
  const username = await reddit.getCurrentUsername();
  return c.json<PendingReportsResponse>({ type: 'pending-reports', reports, username: username ?? '' });
});

/** Approve a pending report — adds the flagged account to the confirmed blacklist */
api.post('/approve-report', async (c) => {
  if (!(await isCurrentUserModerator())) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Moderators only.' }, 403);
  }

  const { targetUsername } = await c.req.json<{ targetUsername: string }>();
  const report = await getPendingReport(targetUsername);

  if (!report) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Report not found.' }, 404);
  }

  await addScammer({
    username: report.targetUsername,
    addedBy: await reddit.getCurrentUsername() ?? 'moderator',
    addedAt: Date.now(),
    sourcePostId: report.sourcePostId,
    sourceCommentId: report.sourceCommentId,
  });

  await removePendingReport(targetUsername);

  return c.json<ApproveReportResponse>({ type: 'approve-report', targetUsername: report.targetUsername });
});

/** Deny a pending report — removes it without blacklisting */
api.post('/deny-report', async (c) => {
  if (!(await isCurrentUserModerator())) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Moderators only.' }, 403);
  }

  const { targetUsername } = await c.req.json<{ targetUsername: string }>();
  await removePendingReport(targetUsername);

  return c.json<DenyReportResponse>({ type: 'deny-report', targetUsername });
});