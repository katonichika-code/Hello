/**
 * Smoke test for the Vite dev proxy (/api -> localhost:8787)
 * Run with: npm run smoke:proxy (requires `npm run dev` or `npm run dev:lan`)
 */

const PROXY_BASE = 'http://localhost:5173/api';

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

async function runTests(): Promise<void> {
  console.log('\n=== Vite Proxy Smoke Tests ===\n');

  // Test 1: Health check through proxy
  await test('GET /api/health returns ok:true', async () => {
    const response = await fetch(`${PROXY_BASE}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = (await response.json()) as { ok: boolean };
    if (!result.ok) throw new Error('Expected ok:true');
  });

  // Test 2: Transactions list through proxy
  await test('GET /api/transactions returns array', async () => {
    const response = await fetch(`${PROXY_BASE}/transactions`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!Array.isArray(result)) throw new Error('Expected array');
  });

  // Test 3: Month-filtered query through proxy
  await test('GET /api/transactions?month=2024-01 returns array', async () => {
    const response = await fetch(`${PROXY_BASE}/transactions?month=2024-01`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!Array.isArray(result)) throw new Error('Expected array');
  });

  // Summary
  console.log('\n=== Summary ===');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function checkProxyReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${PROXY_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log('Checking if Vite dev proxy is running...');

  const reachable = await checkProxyReachable();
  if (!reachable) {
    console.error(`\nError: Vite proxy not reachable at ${PROXY_BASE}`);
    console.error('Please start the dev server with: npm run dev\n');
    process.exit(1);
  }

  await runTests();
}

main();
