# Release Smoke Checklist — Kakeibo PWA

Run through before each release. All checks are manual.

## iOS PWA (installed to Home Screen)

- [ ] Install: "Add to Home Screen" from Safari
- [ ] Persistence: Add a transaction → close app → reopen → data present
- [ ] Restart: Force-quit and relaunch → no data loss
- [ ] Offline: Enable airplane mode → app loads → can add transaction
- [ ] Storage hint: If not installed, amber hint shows

## Onboarding

- [ ] Fresh install: Onboarding stepper appears
- [ ] Settings step: Income required, cannot advance with 0
- [ ] Personal budgets: Minimum 3 categories required
- [ ] Shared budgets: Can skip with 0 selected
- [ ] Completion: "Add expense" lands on Home; "Import CSV" scrolls to Analytics
- [ ] No re-trigger: After completion, refresh → onboarding does NOT reappear

## CSV Import + Dedup

- [ ] Import Format A (date,amount,description) → transactions appear
- [ ] Import Format B (Japanese bank) → Shift_JIS decoded, rows parsed
- [ ] Re-import same file → all skipped (hash dedup)
- [ ] Categories auto-assigned from rules

## Categorization Inbox + Learning

- [ ] Uncategorized items appear in inbox (Analytics screen)
- [ ] Assign category → merchant learned
- [ ] Re-import → previously uncategorized now auto-categorized via learned map

## Shared Exchange

- [ ] Export: Downloads JSON with `type: shared_exchange`
- [ ] Privacy: Modal shows "個人データは含まれません（共有のみ）"
- [ ] Import: Shows txns added/skipped, budgets replaced
- [ ] Impact: Shows remaining delta (if budgets exist) or expense delta
- [ ] Personal data: Verify export file contains ONLY shared wallet data

## Backup Export/Import

- [ ] Export: Downloads full backup JSON (all tables)
- [ ] Import: Restores data, deduplicates transactions by hash
- [ ] Settings + budgets + merchant_map restored

## Budget Management

- [ ] Month switch: Select different month
- [ ] Copy budgets: "先月の予算をコピー" copies from previous month
- [ ] Budget cards: Show spent / budgeted / remaining per category
- [ ] Overspent: Red left border on overspent budget cards

## Future Projection

- [ ] Empty state: Shows "まだペースが算出できません" with no transactions
- [ ] With data: Shows income/expense breakdown + 3/6/12 month bars
- [ ] Collapsible: Collapsed by default, expands on tap

## Analytics

- [ ] Income/Expense/Net cards at top
- [ ] Sankey diagram loads (collapsible)
- [ ] Transaction list with inline category editing
- [ ] Collapsible sections expand/collapse

## Month Filtering

- [ ] Header month selector shows 12 months
- [ ] Switching month filters transactions across all screens
- [ ] Budget cards update per selected month

## Gate Commands (dev)

```bash
npx tsc --noEmit       # Zero errors
npm run lint            # Zero warnings
npm run test:domain     # 23/23 pass
npm run csvcheck        # CSV parser OK
```
