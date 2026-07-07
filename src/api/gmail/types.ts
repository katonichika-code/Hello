export interface GmailMessage {
  id: string;
  threadId: string;
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessageFull {
  id: string;
  payload: {
    headers: GmailHeader[];
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

export interface ParsedTransaction {
  date: string;
  merchant: string;
  amount: number;
}

export interface ParseFailure {
  providerId: string;
  messageId?: string;
  subject: string;
  reason: string;
}

export type ParseResult = ParsedTransaction | ParseFailure;

export interface MailForProvider {
  id?: string;
  headers: GmailHeader[];
  subject: string;
  body: string;
}

export interface MailProvider {
  id: string;
  matches(headers: GmailHeader[]): boolean;
  parse(mail: MailForProvider): ParseResult;
}

export interface SyncResult {
  newTransactions: number;
  duplicatesSkipped: number;
  errors: string[];
  parseFailures: ParseFailure[];
}

export interface SyncProgress {
  message: string;
  fetchedMessages?: number;
  stagedTransactions?: number;
}

export interface SyncOptions {
  onProgress?: (progress: SyncProgress) => void;
}
