/**
 * Pure utility functions for meal-swipe operational reconciliation.
 * No React imports — safe to use anywhere (tests, workers, other hooks).
 *
 * Two levels of data are supported:
 *
 *   ORDER LEVEL  (list endpoint — count-only)
 *     { id, employee_count, swiped_count, state, type, ... }
 *
 *   EMPLOYEE LEVEL  (detail endpoint — per-person)
 *     Array of { id, name, dept_name, is_swiped, isNew? }
 */

// ── Employee-level checks ─────────────────────────────────────────────────────

/**
 * Employees who are on the order but did NOT swipe their card.
 * Skips `isNew` entries — they are unsaved and cannot have a swipe record yet.
 *
 * @param  {Array} employees — detail-level employee array
 * @returns {Array}
 */
export function detectMissingSwipes(employees = []) {
  return employees.filter((e) => !e.isNew && !e.is_swiped);
}

/**
 * Employees who swiped their card but whose ID is NOT in the confirmed set.
 * Catches "about to be removed, but already swiped" situations before save.
 *
 * @param  {Array} employees    — detail-level employee array
 * @param  {Array} confirmedIds — IDs currently checked/selected in the UI
 * @returns {Array}
 */
export function detectUnexpectedSwipes(employees = [], confirmedIds = []) {
  const idSet = new Set(confirmedIds);
  return employees.filter((e) => e.is_swiped && !idSet.has(e.id));
}

/**
 * Employees whose ID appears more than once in the list.
 * Returns one representative entry per duplicated ID (first occurrence).
 *
 * @param  {Array} employees — detail-level employee array
 * @returns {Array}
 */
export function detectDuplicates(employees = []) {
  const counts = new Map();
  for (const e of employees) {
    counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
  }
  const dupeIds = new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id),
  );
  const returned = new Set();
  const result   = [];
  for (const e of employees) {
    if (dupeIds.has(e.id) && !returned.has(e.id)) {
      result.push(e);
      returned.add(e.id);
    }
  }
  return result;
}

// ── Swipe ratio ───────────────────────────────────────────────────────────────

/**
 * Computes the swipe completion ratio and a semantic status string.
 *
 * @param  {number} swiped
 * @param  {number} total
 * @returns {{ pct: number, status: 'full' | 'partial' | 'none' | 'empty' }}
 */
export function swipeRatio(swiped, total) {
  if (!total) return { pct: 0, status: 'empty' };
  const pct    = Math.round((swiped / total) * 100);
  const status = swiped === total ? 'full' : swiped > 0 ? 'partial' : 'none';
  return { pct, status };
}

// ── Aggregate mismatch summary (employee level) ───────────────────────────────

/**
 * Builds a complete mismatch summary for one order's employee list.
 *
 * Only committed (non-`isNew`) employees are counted in `total` / `swiped`
 * because newly-added employees have not yet been saved to the backend.
 *
 * @param  {Array} employees    — detail-level employee array (saved + locally added)
 * @param  {Array} confirmedIds — IDs currently checked/selected in the UI
 * @returns {{
 *   total:            number,
 *   swiped:           number,
 *   missingSwipes:    Array,
 *   unexpectedSwipes: Array,
 *   duplicates:       Array,
 *   hasMismatches:    boolean,
 *   ratio:            { pct: number, status: string },
 * }}
 */
export function buildMismatchSummary(employees = [], confirmedIds = []) {
  const committed = employees.filter((e) => !e.isNew);
  const swiped    = committed.filter((e) => e.is_swiped).length;

  const missingSwipes    = detectMissingSwipes(employees);
  const unexpectedSwipes = detectUnexpectedSwipes(employees, confirmedIds);
  const duplicates       = detectDuplicates(employees);

  const hasMismatches =
    missingSwipes.length    > 0 ||
    unexpectedSwipes.length > 0 ||
    duplicates.length       > 0;

  return {
    total: committed.length,
    swiped,
    missingSwipes,
    unexpectedSwipes,
    duplicates,
    hasMismatches,
    ratio: swipeRatio(swiped, committed.length),
  };
}

// ── Order-level checks (list endpoint, count-only) ────────────────────────────

/**
 * Returns true when an order has employees but fewer swipes than expected,
 * and is in an active (non-terminal) state.
 *
 * Equivalent to the legacy `isProblem()` in campOrdersConstants — use this
 * for all new code. The old alias remains in campOrdersConstants for backward
 * compatibility with existing components.
 *
 * @param  {object} order — list-level order object
 * @returns {boolean}
 */
export function isOrderProblematic(order) {
  return (
    (order.employee_count ?? 0) > 0 &&
    (order.swiped_count   ?? 0) < (order.employee_count ?? 0) &&
    order.state !== 'canceled' &&
    order.state !== 'draft'
  );
}

/**
 * Filters an array of list-level orders to those with swipe mismatches.
 *
 * @param  {Array} orders
 * @returns {Array}
 */
export function filterProblematicOrders(orders = []) {
  return orders.filter(isOrderProblematic);
}

/**
 * Aggregates swipe stats across a page of orders (count-only data).
 *
 * @param  {Array} orders — list-level order array
 * @returns {{
 *   totalEmployees:    number,
 *   totalSwiped:       number,
 *   missingCount:      number,
 *   problematicOrders: number,
 * }}
 */
export function aggregateSwipeStats(orders = []) {
  const totalEmployees    = orders.reduce((s, o) => s + (o.employee_count ?? 0), 0);
  const totalSwiped       = orders.reduce((s, o) => s + (o.swiped_count   ?? 0), 0);
  const missingCount      = totalEmployees - totalSwiped;
  const problematicOrders = filterProblematicOrders(orders).length;
  return { totalEmployees, totalSwiped, missingCount, problematicOrders };
}
