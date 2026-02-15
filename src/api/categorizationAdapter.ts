/**
 * 3-layer categorization adapter for CSV import pipeline.
 *
 * Priority (strict):
 *   1. Learned merchant mapping (merchant_key → category)   [highest]
 *   2. Existing rule-based categorizer (keywords/regex)
 *   3. Fallback: 'Uncategorized'
 *
 * Does NOT modify csvParser.ts or categorizer.ts internals.
 */

import { categorize } from './categorizer';
import { deriveMerchantKey } from './merchantKey';
import type { ApiMerchantMapping } from '../db/repo';

export interface CategorizationResult {
  category: string;
  categorySource: 'learned' | 'rule' | 'unknown';
  confidence: number;
  merchantKey: string | null;
}

/**
 * Categorize a transaction description using the 3-layer system.
 *
 * @param description - Raw transaction description
 * @param merchantMap - Pre-loaded Map of merchant_key → category (from API)
 */
export function categorizeWithLearning(
  description: string,
  merchantMap: Map<string, string>,
): CategorizationResult {
  const merchantKey = deriveMerchantKey(description);

  // Layer 1: Learned merchant mapping
  if (merchantKey && merchantMap.has(merchantKey)) {
    return {
      category: merchantMap.get(merchantKey)!,
      categorySource: 'learned',
      confidence: 1.0,
      merchantKey,
    };
  }

  // Layer 2: Rule-based categorizer
  const ruleCategory = categorize(description);
  if (ruleCategory !== '未分類') {
    return {
      category: ruleCategory,
      categorySource: 'rule',
      confidence: 0.8,
      merchantKey,
    };
  }

  // Layer 3: Uncategorized fallback
  return {
    category: 'Uncategorized',
    categorySource: 'unknown',
    confidence: 0,
    merchantKey,
  };
}

/**
 * Convert an API merchant mapping array to a lookup Map.
 */
export function buildMerchantMap(mappings: ApiMerchantMapping[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of mappings) {
    map.set(m.merchant_key, m.category);
  }
  return map;
}
