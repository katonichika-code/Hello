import { db } from '../../db/database';
import { bulkCreateTransactions, generateHash, getMerchantMap, getSettings, type TransactionInput } from '../../db/repo';
import { buildMerchantMap, categorizeWithLearning } from '../categorizationAdapter';
import { extractPlainTextBody, getMessageFull, listGmailMessages } from './fetch';
import { vpassProvider } from './providers/vpass';
import type { GmailHeader, MailForProvider, MailProvider, ParsedTransaction, SyncOptions, SyncResult, SyncProgress } from './types';

export { hasGoogleClientId, isConnected, requestAccessToken, revokeAccessToken, GMAIL_READONLY_SCOPE } from './auth';
export type { ParseFailure, ParsedTransaction, SyncResult, SyncProgress } from './types';

const providers: MailProvider[] = [vpassProvider];

function emitProgress(options: SyncOptions | undefined, progress: SyncProgress): void {
  options?.onProgress?.(progress);
}

function headerValue(headers: GmailHeader[], name: string): string {
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function isParseFailure(value: ParsedTransaction | import('./types').ParseFailure): value is import('./types').ParseFailure {
  return 'reason' in value;
}

function providerFor(mail: MailForProvider): MailProvider | null {
  return providers.find((provider) => provider.matches(mail.headers)) ?? null;
}

export async function syncGmail(options?: SyncOptions): Promise<SyncResult> {
  const result: SyncResult = { newTransactions: 0, duplicatesSkipped: 0, errors: [], parseFailures: [] };

  const settings = await getSettings();
  const searchQuery = settings.gmail_search_query?.trim();
  if (!searchQuery) {
    throw new Error('Gmail検索クエリが未設定です。設定画面で検索条件を保存してください。');
  }

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
  }

  let messages;
  try {
    messages = await listGmailMessages(searchQuery, afterMs);
  } catch (err) {
    throw new Error(`Gmail API list error: ${err instanceof Error ? err.message : String(err)}`);
  }

  emitProgress(options, {
    message: isInitialSync
      ? `${messages.length}件のメールが見つかりました（直近90日）`
      : `${messages.length}件のメールを取得、解析中…`,
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
        const subject = headerValue(full.payload.headers, 'Subject');
        const body = extractPlainTextBody(full);
        if (!body) {
          return { status: 'skip' as const, failure: { providerId: 'unknown', messageId: msg.id, subject, reason: 'Could not extract text body' } };
        }

        const mail: MailForProvider = { id: msg.id, headers: full.payload.headers, subject, body };
        const provider = providerFor(mail);
        if (!provider) {
          return { status: 'skip' as const, failure: { providerId: 'unknown', messageId: msg.id, subject, reason: 'No provider matched message headers' } };
        }

        const parsed = provider.parse(mail);
        if (isParseFailure(parsed)) {
          return { status: 'skip' as const, failure: { ...parsed, messageId: parsed.messageId ?? msg.id, subject: parsed.subject || subject } };
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
        result.parseFailures.push(item.value.failure);
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

  try {
    await db.gmail_sync.put({
      id: 1,
      email: '',
      last_sync_at: new Date().toISOString(),
      last_history_id: messages[0]?.id ?? '',
      last_parse_failure_count: result.parseFailures.length,
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
