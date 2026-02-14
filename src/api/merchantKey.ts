/**
 * Merchant key normalization.
 * Derives a stable, deterministic key from a transaction description
 * so the same merchant across months produces the same key.
 *
 * Steps:
 * 1. Reuse the existing normalize() (full-width → half-width, lowercase, dash normalization)
 * 2. Remove digits (store branches, receipt numbers)
 * 3. Remove common punctuation/symbols
 * 4. Collapse whitespace and trim
 *
 * The result is a stable string usable as merchant_map PRIMARY KEY.
 */

import { normalize } from './categorizer';

/**
 * Derive a merchant key from a transaction description.
 * Returns null if the result is empty (e.g. description was only digits).
 */
export function deriveMerchantKey(description: string): string | null {
  let key = normalize(description);

  // Remove digits (branch numbers, receipt IDs, amounts embedded in description)
  key = key.replace(/[0-9]/g, '');

  // Remove common punctuation and symbols
  key = key.replace(/[.,;:!?@#$%^&*()_+=[\]{}<>|\\/"'`~-]/g, '');

  // Collapse whitespace and trim
  key = key.replace(/\s+/g, ' ').trim();

  return key.length > 0 ? key : null;
}
