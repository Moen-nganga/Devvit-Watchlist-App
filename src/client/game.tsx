import './index.css';
import { StrictMode, useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { navigateTo } from '@devvit/web/client';
import type { PendingReport, PendingReportsResponse, ApproveReportResponse, DenyReportResponse } from '../shared/api';

type ViewState =
  | { screen: 'loading' }
  | { screen: 'error'; message: string }
  | { screen: 'not-mod' }
  | { screen: 'empty' }
  | { screen: 'report'; report: PendingReport; remaining: number };

export const ModDashboard = () => {
  const [view, setView] = useState<ViewState>({ screen: 'loading' });
  const [queue, setQueue] = useState<PendingReport[]>([]);
  const [acting, setActing] = useState(false);

  const loadReports = useCallback(async () => {
    setView({ screen: 'loading' });
    try {
      const res = await fetch('/api/pending-reports');
      if (res.status === 403) {
        setView({ screen: 'not-mod' });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PendingReportsResponse = await res.json();
      if (data.reports.length === 0 || !data.reports[0]) {
        setView({ screen: 'empty' });
        setQueue([]);
      } else {
        setQueue(data.reports);
        setView({ screen: 'report', report: data.reports[0], remaining: data.reports.length });
      }
    } catch (err) {
      setView({ screen: 'error', message: 'Failed to load reports. Please try again.' });
    }
  }, []);

  useEffect(() => { void loadReports(); }, [loadReports]);

  const act = useCallback(async (action: 'approve' | 'deny', targetUsername: string) => {
    setActing(true);
    try {
      const res = await fetch(`/api/${action}-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.json() as ApproveReportResponse | DenyReportResponse;

      // Move to next report in local queue
      const next = queue.slice(1);
      setQueue(next);
      if (next.length === 0 || !next[0]) {
        setView({ screen: 'empty' });
      } else {
        setView({ screen: 'report', report: next[0], remaining: next.length });
      }
    } catch (err) {
      setView({ screen: 'error', message: `Failed to ${action} report. Please try again.` });
    } finally {
      setActing(false);
    }
  }, [queue]);

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#0f1a24] text-gray-100">
      <div className="w-full max-w-lg mx-auto p-6 flex flex-col flex-1">
      <h1 className="text-xl font-bold mb-1">Scammer Reports</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Review pending scammer reports from your community.</p>

      {view.screen === 'loading' && (
        <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>
      )}

      {view.screen === 'not-mod' && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-red-500">This dashboard is only available to subreddit moderators.</p>
        </div>
      )}

      {view.screen === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-red-500">{view.message}</p>
          <button onClick={loadReports} className="text-sm text-blue-500 underline">Retry</button>
        </div>
      )}

      {view.screen === 'empty' && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400">No pending reports. You're all caught up ✓</p>
        </div>
      )}

      {view.screen === 'report' && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-400">{view.remaining} pending report{view.remaining !== 1 ? 's' : ''}</p>

          <div className="border border-gray-700 rounded-lg p-4 flex flex-col gap-3 bg-[#1a2535]">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Flagged account</p>
              <p className="font-semibold text-lg">u/{view.report.targetUsername}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Reported by</p>
              <p className="text-sm">u/{view.report.reportedBy}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Reported</p>
              <p className="text-sm">{new Date(view.report.reportedAt).toUTCString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Original comment</p>
              <button
                className="text-sm text-blue-500 underline text-left"
                onClick={() => navigateTo(view.report.sourcePermalink)}
              >
                View on Reddit ↗
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              disabled={acting}
              onClick={() => act('approve', view.report.targetUsername)}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {acting ? '...' : '🚨 Approve — Blacklist'}
            </button>
            <button
              disabled={acting}
              onClick={() => act('deny', view.report.targetUsername)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-800 dark:text-gray-100 font-semibold py-3 rounded-lg transition-colors"
            >
              {acting ? '...' : 'Deny'}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModDashboard />
  </StrictMode>
);