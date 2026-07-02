export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

// Inlined here (not imported from server/core) to keep shared/ cross-boundary clean.
export type PendingReport = {
  targetUsername: string;
  reportedBy: string;
  reportedAt: number;
  sourcePostId: string;
  sourceCommentId: string;
  sourcePermalink: string;
};

export type PendingReportsResponse = {
  type: 'pending-reports';
  reports: PendingReport[];
  username: string;
};

export type ApproveReportResponse = {
  type: 'approve-report';
  targetUsername: string;
};

export type DenyReportResponse = {
  type: 'deny-report';
  targetUsername: string;
};