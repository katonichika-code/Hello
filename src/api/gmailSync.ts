// Gmail sync via Google Identity Services (browser-only, no server)

import { db } from '../db/database';
import {
  bulkCreateTransactions,
  generateHash,
  getMerchantMap,
  type TransactionInput,
} from '../db/repo';
import { buildMerchantMap, categorizeWithLearning } from './categorizationAdapter';

const CLIENT_ID = '133285269289-a6csmhsg8olfmm11i9fp05i38th2vm9f.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageFull {
  id: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: Array<{
      mimeType: string;
      body: { data?: string; size: number };
      parts?: GmailMessageFull['payload']['parts'];
    }>;
    body?: { data?: string; size: number };
    mimeType: string;
  };
  internalDate: string;
}

export interface SyncResult {
  newTransactions: number;
  duplicatesSkipped: number;
  errors: string[];
}

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

async function gmailFetch<T>(endpoint: string): Promise<T> {
  if (!accessToken) throw new Error('Not authenticated. Call requestAccessToken() first.');

  const res = await fetch(`${GMAIL_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    accessToken = null;
    throw new Error('Token expired. Please sync again.');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail API error ${res.status}: ${text}`);
  }

  return res.json();
}

async function listVpassMessages(afterEpochMs?: number): Promise<GmailMessage[]> {
  let query = 'from:statement@vpass.ne.jp subject:ご利用のお知らせ';
  if (afterEpochMs) {
    const afterSec = Math.floor(afterEpochMs / 1000);
    query += ` after:${afterSec}`;
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

async function getMessageFull(messageId: string): Promise<GmailMessageFull> {
  return gmailFetch<GmailMessageFull>(`/messages/${messageId}?format=full`);
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
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

function extractPlainTextBody(message: GmailMessageFull): string | null {
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

interface ParsedTransaction {
  date: string;
  merchant: string;
  amount: number;
}

function parseVpassEmail(body: string): ParsedTransaction | null {
  const dateMatch = body.match(/◇利用日：(\d{4})\/(\d{2})\/(\d{2})\s+\d{2}:\d{2}/);
  const merchantMatch = body.match(/◇利用先：(.+)/);
  const amountMatch = body.match(/◇利用金額：([\d,]+)円/);

  if (!dateMatch || !merchantMatch || !amountMatch) {
    return null;
  }

  const [, year, month, day] = dateMatch;
  const merchant = merchantMatch[1].trim();
  const amount = -parseInt(amountMatch[1].replace(/,/g, ''), 10);

  return {
    date: `${year}-${month}-${day}`,
    merchant,
    amount,
  };
}

export async function syncGmail(): Promise<SyncResult> {
  const result: SyncResult = { newTransactions: 0, duplicatesSkipped: 0, errors: [] };

  const syncRecord = await db.gmail_sync.get(1);
  const afterMs = syncRecord?.last_sync_at
    ? new Date(syncRecord.last_sync_at).getTime()
    : undefined;

  const messages = await listVpassMessages(afterMs);
  if (messages.length === 0) {
    return result;
  }

  const merchantMap = buildMerchantMap(await getMerchantMap());
  const transactionInputs: TransactionInput[] = [];

  for (const msg of messages) {
    try {
      const full = await getMessageFull(msg.id);
      const body = extractPlainTextBody(full);
      if (!body) {
        result.errors.push(`Message ${msg.id}: Could not extract text body`);
        continue;
      }

      const parsed = parseVpassEmail(body);
      if (!parsed) {
        result.errors.push(`Message ${msg.id}: Could not parse Vpass format`);
        continue;
      }

      const hash = await generateHash(parsed.date, parsed.amount, parsed.merchant);
      const existing = await db.transactions.where('hash').equals(hash).first();
      if (existing) {
        result.duplicatesSkipped += 1;
        continue;
      }

      const categorization = categorizeWithLearning(parsed.merchant, merchantMap);
      transactionInputs.push({
        date: parsed.date,
        amount: parsed.amount,
        category: categorization.category,
        account: 'card',
        wallet: 'personal',
        source: 'gmail',
        description: parsed.merchant,
        hash,
        isPending: 1,
        merchant_key: categorization.merchantKey,
        category_source: categorization.categorySource,
        confidence: categorization.confidence,
      });
    } catch (err) {
      result.errors.push(`Message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (transactionInputs.length > 0) {
    const insertResult = await bulkCreateTransactions(transactionInputs);
    result.newTransactions = insertResult.inserted;
    result.duplicatesSkipped += insertResult.skipped;
  }

  await db.gmail_sync.put({
    id: 1,
    email: 'katonichika@gmail.com',
    last_sync_at: new Date().toISOString(),
    last_history_id: messages[0]?.id ?? '',
  });

  return result;
}
