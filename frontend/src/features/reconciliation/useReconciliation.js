import { useMemo } from 'react';
import { buildMismatchSummary } from './reconciliationUtils';

/**
 * React hook for employee-level reconciliation within a single order.
 *
 * Merges saved employees with locally-added (unsaved) employees, then runs
 * all mismatch checks via `buildMismatchSummary`. All output is memoized —
 * safe to call on every render without extra cost.
 *
 * Intended consumer: CampOrderModal (and any future per-order detail view).
 *
 * @param {Array} employees  — detail.employees from fetchOrderDetail (saved records)
 * @param {Array} addedEmps  — locally added employees (isNew: true, not yet saved)
 * @param {Array} checkedIds — IDs currently checked/selected in the UI
 *
 * @returns {{
 *   allEmps:          Array,    — merged [employees, ...addedEmps]
 *   summary: {
 *     total:            number,
 *     swiped:           number,
 *     missingSwipes:    Array,
 *     unexpectedSwipes: Array,
 *     duplicates:       Array,
 *     hasMismatches:    boolean,
 *     ratio:            { pct: number, status: 'full'|'partial'|'none'|'empty' },
 *   },
 *   missingSwipes:    Array,    — employees present but not swiped
 *   unexpectedSwipes: Array,    — swiped but about to be removed (unchecked)
 *   duplicates:       Array,    — employees appearing more than once
 *   hasMismatches:    boolean,
 *   ratio:            { pct: number, status: string },
 * }}
 */
export function useReconciliation(employees = [], addedEmps = [], checkedIds = []) {
  // Merge saved + locally-added employees into a single list
  const allEmps = useMemo(
    () => [...employees, ...addedEmps],
    [employees, addedEmps],
  );

  // Run all mismatch checks (pure, deterministic, cheap to re-run)
  const summary = useMemo(
    () => buildMismatchSummary(allEmps, checkedIds),
    [allEmps, checkedIds],
  );

  return {
    allEmps,
    summary,
    missingSwipes:    summary.missingSwipes,
    unexpectedSwipes: summary.unexpectedSwipes,
    duplicates:       summary.duplicates,
    hasMismatches:    summary.hasMismatches,
    ratio:            summary.ratio,
  };
}
