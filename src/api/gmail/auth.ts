const CLIENT_ID = '133285269289-a6csmhsg8olfmm11i9fp05i38th2vm9f.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let accessToken: string | null = null;

export function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
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
