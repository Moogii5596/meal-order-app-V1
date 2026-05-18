import { useMemo } from 'react';
import { aggregateSwipeStats, filterProblematicOrders } from './reconciliationUtils';

/**
 * React hook for order-list-level reconciliation.
 *
 * Works with count-only data from the list endpoint — no employee detail needed.
 * Use inside CampOrdersView (or any component that owns the order list) to
 * surface aggregate mismatch stats and identify which orders need attention.
 *
 * Intended consumer: CampOrdersView, future reporting / analytics views.
 *
 * @param {Array}  orders     — current-page order list from fetchOrders()
 * @param {string} mealFilter — optional meal type key for client-side filtering
 *                              (pass '' or undefined to include all)
 *
 * @returns {{
 *   stats: {
 *     totalEmployees:    number,  — sum of employee_count across filtered orders
 *     totalSwiped:       number,  — sum of swiped_count across filtered orders
 *     missingCount:      number,  — totalEmployees - totalSwiped
 *     problematicOrders: number,  — count of orders with swipe mismatches
 *   },
 *   problematicOrders: Array,   — filtered order objects that have mismatches
 *   hasProblems:       boolean, — true when at least one order has a mismatch
 * }}
 */
export function useMismatchSummary(orders = [], mealFilter = '') {
  // Client-side meal filter (mirrors logic in CampOrdersView.visibleItems)
  const filtered = useMemo(
    () => (mealFilter ? orders.filter((o) => o.type === mealFilter) : orders),
    [orders, mealFilter],
  );

  // Aggregate count-only stats across all filtered orders
  const stats = useMemo(
    () => aggregateSwipeStats(filtered),
    [filtered],
  );

  // Subset of orders that actually have swipe mismatches
  const problematicOrders = useMemo(
    () => filterProblematicOrders(filtered),
    [filtered],
  );

  return {
    stats,
    problematicOrders,
    hasProblems: problematicOrders.length > 0,
  };
}
