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

export interface SyncProgress {
  message: string;
  fetchedMessages?: number;
  stagedTransactions?: number;
}

interface SyncOptions {
  onProgress?: (progress: SyncProgress) => void;
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

function emitProgress(options: SyncOptions | undefined, progress: SyncProgress): void {
  options?.onProgress?.(progress);
}

export async function syncGmail(options?: SyncOptions): Promise<SyncResult> {
  const result: SyncResult = { newTransactions: 0, duplicatesSkipped: 0, errors: [] };


  emitProgress(options, { message: '認証完了、メール検索中…' });

  let afterMs: number | undefined;
  let isInitialSync = false;
  try {
    const syncRecord = await db.gmail_sync.get(1);
    if (syncRecord?.last_sync_at) {
      afterMs = new Date(syncRecord.last_sync_at).getTime();
    } else {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      afterMs = ninetyDaysAgo.getTime();
      isInitialSync = true;
    }
  } catch (err) {
    result.errors.push(`DB read error: ${err instanceof Error ? err.message : String(err)}`);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    afterMs = ninetyDaysAgo.getTime();
    isInitialSync = true;

  emitProgress(options, { message: '認証完了、メール取得中…' });

  let afterMs: number | undefined;
  try {
    const syncRecord = await db.gmail_sync.get(1);
    afterMs = syncRecord?.last_sync_at
      ? new Date(syncRecord.last_sync_at).getTime()
      : undefined;
  } catch (err) {
    result.errors.push(`DB read error: ${err instanceof Error ? err.message : String(err)}`);

  }

  let messages: GmailMessage[];
  try {
    messages = await listVpassMessages(afterMs);
  } catch (err) {
    throw new Error(`Gmail API list error: ${err instanceof Error ? err.message : String(err)}`);
  }

  emitProgress(options, {

    message: isInitialSync
      ? `${messages.length}件のメールが見つかりました（直近90日）`
      : `${messages.length}件のメールを取得、解析中…`,

    message: `${messages.length}件のメールを取得、解析中…`,

    fetchedMessages: messages.length,
  });

  if (messages.length === 0) {
    emitProgress(options, { message: '同期完了：新規0件、重複0件' });
    return result;
  }


  let merchantMap: Map<string, string>;

  try {
    merchantMap = buildMerchantMap(await getMerchantMap());
  } catch (err) {
    throw new Error(`Merchant map load error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const transactionInputs: TransactionInput[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const processed = Math.min(i + batch.length, messages.length);

    emitProgress(options, {
      message: `${processed} / ${messages.length} 件処理中…`,
      fetchedMessages: messages.length,
      stagedTransactions: transactionInputs.length,
    });

    const settled = await Promise.allSettled(
      batch.map(async (msg) => {
        const full = await getMessageFull(msg.id);
        const body = extractPlainTextBody(full);
        if (!body) {
          return { status: 'skip' as const, reason: `Message ${msg.id}: Could not extract text body` };
        }

        const parsed = parseVpassEmail(body);
        if (!parsed) {
          return { status: 'skip' as const, reason: `Message ${msg.id}: Could not parse Vpass format` };
        }

        return { status: 'ok' as const, parsed, msgId: msg.id };
      }),
    );

    for (const item of settled) {
      if (item.status === 'rejected') {
        result.errors.push(`Fetch error: ${item.reason instanceof Error ? item.reason.message : String(item.reason)}`);
        continue;
      }

      if (item.value.status === 'skip') {
        result.errors.push(item.value.reason);
        continue;
      }

      const { parsed, msgId } = item.value;
      try {
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
        result.errors.push(`Message ${msgId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  emitProgress(options, {
    message: `${transactionInputs.length}件の取引を登録中…`,
    stagedTransactions: transactionInputs.length,
  });

  if (transactionInputs.length > 0) {
    try {
      const insertResult = await bulkCreateTransactions(transactionInputs);
      result.newTransactions = insertResult.inserted;
      result.duplicatesSkipped += insertResult.skipped;
    } catch (err) {
      throw new Error(`DB write error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }


  emitProgress(options, {
    message: `${transactionInputs.length}件の取引を登録中…`,
    stagedTransactions: transactionInputs.length,
  });

  if (transactionInputs.length > 0) {
    try {
      const insertResult = await bulkCreateTransactions(transactionInputs);
      result.newTransactions = insertResult.inserted;
      result.duplicatesSkipped += insertResult.skipped;
    } catch (err) {
      throw new Error(`DB write error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  try {
    await db.gmail_sync.put({
      id: 1,
      email: 'katonichika@gmail.com',
      last_sync_at: new Date().toISOString(),
      last_history_id: messages[0]?.id ?? '',
    });
  } catch (err) {
    result.errors.push(`DB write error (sync metadata): ${err instanceof Error ? err.message : String(err)}`);
  }

  emitProgress(options, {
    message: `同期完了：新規${result.newTransactions}件、重複${result.duplicatesSkipped}件`,
    fetchedMessages: messages.length,
    stagedTransactions: transactionInputs.length,
  });

  return result;
}
