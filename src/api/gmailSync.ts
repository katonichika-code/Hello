// Backward-compatible entrypoint for Gmail sync callers.
export { GMAIL_READONLY_SCOPE, hasGoogleClientId, isConnected, requestAccessToken, revokeAccessToken, syncGmail } from './gmail';
export type { ParseFailure, SyncProgress, SyncResult } from './gmail';
