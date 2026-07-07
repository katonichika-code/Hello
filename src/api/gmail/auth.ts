const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

let accessToken: string | null = null;

export function hasGoogleClientId(): boolean {
  return GOOGLE_CLIENT_ID.length > 0;
}

export function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!hasGoogleClientId()) {
      reject(new Error('Google OAuth の Client ID が未設定です。.env の VITE_GOOGLE_CLIENT_ID を設定してください。'));
      return;
    }
    if (!window.google?.accounts) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GMAIL_READONLY_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(`OAuth error: ${response.error}`));
          return;
        }
        if (response.access_token) {
          accessToken = response.access_token;
          resolve(response.access_token);
          return;
        }
        reject(new Error('No access token received'));
      },
    });

    tokenClient.requestAccessToken();
  });
}

export function revokeAccessToken(): void {
  if (accessToken && window.google?.accounts) {
    window.google.accounts.oauth2.revoke(accessToken);
    accessToken = null;
  }
}

export function isConnected(): boolean {
  return accessToken !== null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}
