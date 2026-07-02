import { redis } from '@devvit/web/server';
import type { PendingReport } from '../../shared/api';

export type { PendingReport };

const PENDING_HASH_KEY = 'scammerwatchlist:pending';

const normalize = (username: string): string => username.trim().toLowerCase();

export async function getPendingReport(targetUsername: string): Promise<PendingReport | null> {
  const raw = await redis.hGet(PENDING_HASH_KEY, normalize(targetUsername));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingReport;
  } catch {
    return null;
  }
}

export async function hasPendingReport(targetUsername: string): Promise<boolean> {
  return (await getPendingReport(targetUsername)) !== null;
}

export async function addPendingReport(report: PendingReport): Promise<void> {
  await redis.hSet(PENDING_HASH_KEY, {
    [normalize(report.targetUsername)]: JSON.stringify(report),
  });
}

export async function removePendingReport(targetUsername: string): Promise<void> {
  await redis.hDel(PENDING_HASH_KEY, [normalize(targetUsername)]);
}

export async function getAllPendingReports(): Promise<PendingReport[]> {
  const all: Record<string, string> = await redis.hGetAll(PENDING_HASH_KEY);
  return Object.values(all)
    .map((raw) => {
      try {
        return JSON.parse(raw) as PendingReport;
      } catch {
        return null;
      }
    })
    .filter((r): r is PendingReport => r !== null)
    .sort((a, b) => a.reportedAt - b.reportedAt);
}

export async function getPendingReportCount(): Promise<number> {
  return (await getAllPendingReports()).length;
}