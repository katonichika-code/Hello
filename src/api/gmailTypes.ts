// Type declarations for Google Identity Services (loaded via script tag)

export {}; // Make this a module

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
          }): {
            requestAccessToken(): void;
          };
          revoke(token: string, callback?: () => void): void;
        };
      };
    };
  }

  const google: Window['google'];
}
