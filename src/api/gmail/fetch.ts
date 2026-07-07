import { clearAccessToken, getAccessToken } from './auth';
import type { GmailMessage, GmailMessageFull } from './types';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function gmailFetch<T>(endpoint: string): Promise<T> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error('Not authenticated. Call requestAccessToken() first.');

  const res = await fetch(`${GMAIL_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    clearAccessToken();
    throw new Error('Gmail接続の有効期限が切れました。設定画面から再接続してください。');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function listGmailMessages(searchQuery: string, afterEpochMs?: number): Promise<GmailMessage[]> {
  let query = searchQuery.trim();
  if (afterEpochMs) {
    const afterSec = Math.floor(afterEpochMs / 1000);
    query = `${query} after:${afterSec}`.trim();
  }

  const allMessages: GmailMessage[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ q: query, maxResults: '50' });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await gmailFetch<{
      messages?: GmailMessage[];
      nextPageToken?: string;
    }>(`/messages?${params}`);

    if (data.messages) {
      allMessages.push(...data.messages);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allMessages;
}

export async function getMessageFull(messageId: string): Promise<GmailMessageFull> {
  return gmailFetch<GmailMessageFull>(`/messages/${messageId}?format=full`);
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  const base64 = normalized.padEnd(normalized.length + padding, '=');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function findPlainTextPart(parts: NonNullable<GmailMessageFull['payload']['parts']>): string | null {
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      const nested = findPlainTextPart(part.parts);
      if (nested) return nested;
    }
  }
  return null;
}

export function extractPlainTextBody(message: GmailMessageFull): string | null {
  const { payload } = message;

  if (payload.parts) {
    const text = findPlainTextPart(payload.parts);
    if (text) return text;
  }

  if (payload.body?.data && payload.mimeType === 'text/plain') {
    return decodeBase64Url(payload.body.data);
  }

  return null;
}
