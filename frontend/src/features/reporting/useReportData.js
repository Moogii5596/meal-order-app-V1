import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchOrders } from '../../services/orders';
import { monthAgoStr, todayStr } from '../dashboard/campOrdersConstants';
import {
  aggregateByMeal,
  aggregateByState,
  aggregateBySubmitter,
  buildKpis,
} from './reportingUtils';

/**
 * Maximum orders fetched in a single report request.
 * Matches the backend's hard cap (page_size ≤ 200).
 */
export const REPORT_PAGE_SIZE = 200;

/**
 * Data hook for the catering reporting module.
 *
 * Owns all filter state and fires a single full-page fetch (pageSize=200)
 * whenever filters change. All aggregations are memoized and only
 * recomputed when `orders` changes — never on filter-only re-renders.
 *
 * @returns {{
 *   // ── Filters (controlled) ────────────────────────────────────────────────
 *   dateFrom:     string,
 *   setDateFrom:  fn,
 *   dateTo:       string,
 *   setDateTo:    fn,
 *   mealFilter:   string,
 *   setMealFilter: fn,
 *
 *   // ── Fetch status ─────────────────────────────────────────────────────────
 *   loading:      boolean,
 *   error:        string | null,
 *   isTruncated:  boolean,   — true when total > REPORT_PAGE_SIZE
 *   total:        number,    — actual total from backend (may exceed orders.length)
 *
 *   // ── Raw data ─────────────────────────────────────────────────────────────
 *   orders:       Array,
 *
 *   // ── Aggregations (memoized) ───────────────────────────────────────────────
 *   kpis:         object,
 *   byMeal:       Array,
 *   bySubmitter:  Array,
 *   byState:      Array,
 *
 *   // ── Actions ──────────────────────────────────────────────────────────────
 *   reload:       fn,
 * }}
 */
export function useReportData() {
  // ── Filters ───────────────────────────────────────────────────────────────
  const [dateFrom,    setDateFrom]    = useState(monthAgoStr);
  const [dateTo,      setDateTo]      = useState(todayStr);
  const [mealFilter,  setMealFilter]  = useState('');

  // ── Fetch state ───────────────────────────────────────────────────────────
  const [orders,  setOrders]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const abortRef = useRef(null);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const load = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    fetchOrders({
      dateFrom:  dateFrom  || undefined,
      dateTo:    dateTo    || undefined,
      mealType:  mealFilter || undefined,
      page:      1,
      pageSize:  REPORT_PAGE_SIZE,
      signal:    ctrl.signal,
    })
      .then((data) => {
        if (Array.isArray(data)) {
          setOrders(data);
          setTotal(data.length);
        } else {
          setOrders(data.items || []);
          setTotal(data.total  || 0);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError('Өгөгдөл ачаалж чадсангүй');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, [dateFrom, dateTo, mealFilter]);

  useEffect(() => { load(); }, [load]);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // ── Aggregations (memoized — only rerun when orders array changes) ─────────
  const kpis        = useMemo(() => buildKpis(orders),           [orders]);
  const byMeal      = useMemo(() => aggregateByMeal(orders),     [orders]);
  const bySubmitter = useMemo(() => aggregateBySubmitter(orders), [orders]);
  const byState     = useMemo(() => aggregateByState(orders),    [orders]);

  return {
    // filters
    dateFrom,   setDateFrom,
    dateTo,     setDateTo,
    mealFilter, setMealFilter,
    // fetch status
    loading, error,
    total,
    isTruncated: total > REPORT_PAGE_SIZE,
    // data
    orders,
    // aggregations
    kpis, byMeal, bySubmitter, byState,
    // actions
    reload: load,
  };
}
