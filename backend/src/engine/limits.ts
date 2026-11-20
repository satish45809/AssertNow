// Defines maximum bounds, operational timeouts, and polling limits for workflow runs.
// All execution limits and node setting ranges are defined here in one central place.

export const MAX_NODES_PER_WORKFLOW = 100;
export const MAX_RUN_TIME_MILLISECONDS = 300000; // 5 minutes
export const DEFAULT_POLL_TIMEOUT_MILLISECONDS = 30000; // 30 seconds
export const DEFAULT_POLL_INTERVAL_MILLISECONDS = 2000; // 2 seconds

export const MIN_POLL_TIMEOUT_MILLISECONDS = 100;
export const MAX_POLL_TIMEOUT_MILLISECONDS = 120000; // 2 minutes
export const MIN_POLL_INTERVAL_MILLISECONDS = 50;
export const MAX_POLL_INTERVAL_MILLISECONDS = 30000; // 30 seconds
