/**
 * Minimal API smoke test script
 * Run with: npm run smoke (requires API server running on port 8787)
 */

const API_BASE = 'http://localhost:8787';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: message });
    console.log(`✗ ${name}: ${message}`);
  }
}

async function fetchJson(url: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return response.json();
}

// Generate hash matching frontend implementation
async function generateHash(date: string, amount: number, description: string): Promise<string> {
  const text = `${date}${amount}${description}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function runTests(): Promise<void> {
  console.log('\n=== API Smoke Tests ===\n');

  // Test 1: Health check
  await test('GET /health returns ok:true', async () => {
    const result = await fetchJson(`${API_BASE}/health`) as { ok: boolean };
    if (!result.ok) throw new Error('Expected ok:true');
  });

  // Test 2: GET /transactions returns array
  await test('GET /transactions returns array', async () => {
    const result = await fetchJson(`${API_BASE}/transactions`);
    if (!Array.isArray(result)) throw new Error('Expected array');
  });

  // Test 3: POST single transaction
  const testDate = '2024-01-15';
  const testAmount = -1500;
  const testDescription = `smoke-test-${Date.now()}`;
  const testHash = await generateHash(testDate, Math.abs(testAmount), testDescription);

  let createdId: string | null = null;

  await test('POST /transactions creates transaction', async () => {
    const result = await fetchJson(`${API_BASE}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        date: testDate,
        amount: testAmount,
        category: 'Test',
        account: 'card',
        description: testDescription,
        hash: testHash,
      }),
    }) as { id?: string; error?: string };

    if (!result.id) throw new Error(`Expected id, got: ${JSON.stringify(result)}`);
    createdId = result.id;
  });

  // Test 4: PATCH category
  await test('PATCH /transactions/:id updates category', async () => {
    if (!createdId) throw new Error('No transaction to patch');

    const result = await fetchJson(`${API_BASE}/transactions/${createdId}`, {
      method: 'PATCH',
      body: JSON.stringify({ category: 'Updated' }),
    }) as { category?: string };

    if (result.category !== 'Updated') {
      throw new Error(`Expected category 'Updated', got '${result.category}'`);
    }
  });

  // Test 5: Bulk insert with duplicate detection
  const bulkDate = '2024-01-16';
  const bulkDesc1 = `bulk-test-1-${Date.now()}`;
  const bulkDesc2 = `bulk-test-2-${Date.now()}`;
  const bulkHash1 = await generateHash(bulkDate, 100, bulkDesc1);
  const bulkHash2 = await generateHash(bulkDate, 200, bulkDesc2);

  await test('POST /transactions/bulk inserts multiple', async () => {
    const result = await fetchJson(`${API_BASE}/transactions/bulk`, {
      method: 'POST',
      body: JSON.stringify([
        { date: bulkDate, amount: -100, category: 'Bulk', account: 'card', description: bulkDesc1, hash: bulkHash1 },
        { date: bulkDate, amount: -200, category: 'Bulk', account: 'card', description: bulkDesc2, hash: bulkHash2 },
      ]),
    }) as { inserted: number; skipped: number };

    if (result.inserted !== 2) {
      throw new Error(`Expected 2 inserted, got ${result.inserted}`);
    }
  });

  await test('POST /transactions/bulk skips duplicates', async () => {
    const result = await fetchJson(`${API_BASE}/transactions/bulk`, {
      method: 'POST',
      body: JSON.stringify([
        { date: bulkDate, amount: -100, category: 'Bulk', account: 'card', description: bulkDesc1, hash: bulkHash1 },
        { date: bulkDate, amount: -200, category: 'Bulk', account: 'card', description: bulkDesc2, hash: bulkHash2 },
      ]),
    }) as { inserted: number; skipped: number };

    if (result.skipped !== 2) {
      throw new Error(`Expected 2 skipped, got ${result.skipped}`);
    }
  });

  // Test 6: Month filter
  await test('GET /transactions?month filters correctly', async () => {
    const result = await fetchJson(`${API_BASE}/transactions?month=2024-01`) as unknown[];
    if (!Array.isArray(result)) throw new Error('Expected array');
    // Should contain our test transactions
    if (result.length < 1) throw new Error('Expected at least 1 transaction for 2024-01');
  });

  // Summary
  console.log('\n=== Summary ===');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Check if API is reachable before running tests
async function checkApiReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log('Checking if API server is running...');

  const reachable = await checkApiReachable();
  if (!reachable) {
    console.error(`\nError: API server not reachable at ${API_BASE}`);
    console.error('Please start the server with: npm run dev:api\n');
    process.exit(1);
  }

  await runTests();
}

main();
