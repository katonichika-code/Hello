// Backward-compatible entrypoint for Gmail sync callers.
export { isConnected, requestAccessToken, revokeAccessToken, syncGmail } from './gmail';
export type { ParseFailure, SyncProgress, SyncResult } from './gmail';
