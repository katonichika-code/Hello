/**
 * Rule Evaluation Script
 * Evaluates categorization rules against a real CSV file
 * Usage: npm run ruleeval -- --file <path-to-csv>
 */

import fs from 'fs';
import path from 'path';
import { decodeFileContent, parseCsvText, type ParsedTransaction } from '../api/csvParser.js';
import { categorize, CATEGORIES } from '../api/categorizer.js';

function parseArgs(): { filePath: string | null } {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    return { filePath: args[fileIdx + 1] };
  }
  return { filePath: null };
}

function printUsage(): void {
  console.log(`
ルール評価スクリプト (Rule Evaluation Script)
=============================================
Usage: npm run ruleeval -- --file <path-to-csv>

例:
  npm run ruleeval -- --file ./my-transactions.csv

このスクリプトは:
1. CSVファイルを読み込み (UTF-8 / Shift_JIS 自動判定)
2. Format A/B を自動検出してパース
3. 各取引を自動仕訳ルールで分類
4. カバレッジ統計と未分類の加盟店リストを表示
`);
}

interface MerchantStat {
  merchant: string;
  count: number;
  category: string;
}

function runEvaluation(transactions: ParsedTransaction[]): void {
  console.log('\n=== ルール評価結果 ===\n');

  // Basic stats
  console.log(`総取引数: ${transactions.length}`);

  // Count by merchant
  const merchantCounts = new Map<string, number>();
  for (const t of transactions) {
    const key = t.description;
    merchantCounts.set(key, (merchantCounts.get(key) || 0) + 1);
  }
  console.log(`ユニーク加盟店数: ${merchantCounts.size}`);

  // Categorize all transactions
  const categorized: MerchantStat[] = [];
  for (const [merchant, count] of merchantCounts.entries()) {
    const category = categorize(merchant);
    categorized.push({ merchant, count, category });
  }

  // Sort by count descending
  categorized.sort((a, b) => b.count - a.count);

  // Top merchants by frequency
  console.log('\n--- 頻出加盟店 TOP 10 ---');
  categorized.slice(0, 10).forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.merchant} (${item.count}件) → ${item.category}`);
  });

  // Category coverage
  const categoryStats = new Map<string, number>();
  let totalCategorized = 0;
  let totalUncategorized = 0;

  for (const item of categorized) {
    categoryStats.set(item.category, (categoryStats.get(item.category) || 0) + item.count);
    if (item.category === CATEGORIES.UNCATEGORIZED) {
      totalUncategorized += item.count;
    } else {
      totalCategorized += item.count;
    }
  }

  const total = transactions.length;
  const coveragePercent = total > 0 ? ((totalCategorized / total) * 100).toFixed(1) : '0.0';

  console.log('\n--- カテゴリ別件数 ---');
  const sortedCategories = Array.from(categoryStats.entries()).sort((a, b) => b[1] - a[1]);
  for (const [category, count] of sortedCategories) {
    const percent = ((count / total) * 100).toFixed(1);
    console.log(`${category}: ${count}件 (${percent}%)`);
  }

  console.log(`\n--- カバレッジ ---`);
  console.log(`自動分類: ${totalCategorized}件 (${coveragePercent}%)`);
  console.log(`未分類: ${totalUncategorized}件 (${(100 - parseFloat(coveragePercent)).toFixed(1)}%)`);

  // Top uncategorized merchants
  const uncategorized = categorized.filter(c => c.category === CATEGORIES.UNCATEGORIZED);
  if (uncategorized.length > 0) {
    console.log('\n--- 未分類の加盟店 TOP 15 ---');
    uncategorized.slice(0, 15).forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.merchant} (${item.count}件)`);
    });

    if (uncategorized.length > 15) {
      console.log(`... 他 ${uncategorized.length - 15} 件の未分類加盟店`);
    }
  }

  // Summary
  console.log('\n=== 評価完了 ===');
  const targetCoverage = 85;
  if (parseFloat(coveragePercent) >= targetCoverage) {
    console.log(`✓ カバレッジ目標達成 (${coveragePercent}% >= ${targetCoverage}%)`);
  } else {
    console.log(`△ カバレッジ目標未達 (${coveragePercent}% < ${targetCoverage}%)`);
    console.log('  → 上記の未分類加盟店を確認し、必要に応じてルールを追加してください');
  }
}

async function main(): Promise<void> {
  const { filePath } = parseArgs();

  if (!filePath) {
    printUsage();
    process.exit(1);
  }

  // Resolve path
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`エラー: ファイルが見つかりません: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`ファイル読み込み中: ${resolvedPath}`);

  // Read file
  const fileBuffer = fs.readFileSync(resolvedPath);
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  );

  // Decode (auto-detect encoding)
  const text = decodeFileContent(arrayBuffer);

  // Parse CSV
  const result = parseCsvText(text);

  if (result.error) {
    console.error(`パースエラー: ${result.error}`);
    process.exit(1);
  }

  console.log(`検出フォーマット: ${result.format === 'A' ? 'Format A (標準)' : 'Format B (日本銀行/カード)'}`);
  console.log(`パース成功: ${result.rows.length}件`);

  // Run evaluation
  runEvaluation(result.rows);
}

main().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
