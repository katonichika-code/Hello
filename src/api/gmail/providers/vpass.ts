import type { GmailHeader, MailForProvider, MailProvider, ParseFailure, ParseResult, ParsedTransaction } from '../types';

const PROVIDER_ID = 'vpass';

function headerValue(headers: GmailHeader[], name: string): string {
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function failure(mail: Pick<MailForProvider, 'id' | 'subject'>, reason: string): ParseFailure {
  return {
    providerId: PROVIDER_ID,
    messageId: mail.id,
    subject: mail.subject,
    reason,
  };
}

export function parse(subject: string, body: string): ParsedTransaction | ParseFailure {
  const mail = { subject, body };
  const dateMatch = body.match(/◇利用日：(\d{4})\/(\d{2})\/(\d{2})\s+\d{2}:\d{2}/);
  const merchantMatch = body.match(/◇利用先：(.+)/);
  const amountMatch = body.match(/◇利用金額：([\d,]+)円/);

  if (!dateMatch || !merchantMatch || !amountMatch) {
    const missing = [
      !dateMatch ? '利用日' : null,
      !merchantMatch ? '利用先' : null,
      !amountMatch ? '利用金額' : null,
    ].filter(Boolean).join(', ');
    return failure(mail, `Vpass format missing fields: ${missing}`);
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

export const vpassProvider: MailProvider = {
  id: PROVIDER_ID,
  matches(headers) {
    const from = headerValue(headers, 'From').toLowerCase();
    const subject = headerValue(headers, 'Subject');
    return from.includes('statement@vpass.ne.jp') && subject.includes('ご利用のお知らせ');
  },
  parse(mail): ParseResult {
    return parse(mail.subject, mail.body);
  },
};
