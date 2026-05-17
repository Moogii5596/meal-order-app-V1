import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/ui/Toast';
import {
  approveOrder,
  bulkApproveOrders,
  bulkCancelOrders,
  bulkDeleteOrders,
  fetchOrders,
} from '../../services/orders';

import {
  DEFAULT_PAGE_SIZE,
  monthAgoStr,
  todayStr,
} from './campOrdersConstants';

import CampOrderModal  from './CampOrderModal';
import KpiCards        from './KpiCards';
import FilterBar       from './FilterBar';
import BulkToolbar     from './BulkToolbar';
import OrderTable      from './OrderTable';
import MobileOrderCard from './MobileOrderCard';
import Pagination      from './Pagination';

/**
 * Camp Manager — order management dashboard.
 *
 * Owns ALL state: filters, pagination, fetched data, selection, modal, bulk ops.
 * Delegates every rendering concern to purpose-built child components.
 * Business logic (isProblem, fmtDatetime, constants) lives in campOrdersConstants.js.
 */
function CampOrdersView() {
  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterDateFrom, setFilterDateFrom] = useState(monthAgoStr());
  const [filterDateTo,   setFilterDateTo]   = useState(todayStr());
  const [filterState,    setFilterState]    = useState('all');
  const [filterMeal,     setFilterMeal]     = useState('');

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [items,       setItems]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [stateCounts, setStateCounts] = useState({});
  const [loading,     setLoading]     = useState(true);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [selectedIds,     setSelectedIds]     = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [bulkLoading,     setBulkLoading]     = useState(false);
  const [expandedId,      setExpandedId]      = useState(null);

  const { toast, showToast, hideToast } = useToast();
  const abortRef  = useRef(null);
  const prevFilters = useRef({ filterDateFrom, filterDateTo, filterMeal, filterState, pageSize });

  // ── Data fetching ──────────────────────────────────────────────────────────

  const loadOrders = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setSelectedIds([]);
    setExpandedId(null);

    fetchOrders({
      dateFrom: filterDateFrom,
      dateTo:   filterDateTo,
      mealType: filterMeal || undefined,
      page,
      pageSize,
      signal:   ctrl.signal,
    })
      .then((data) => {
        if (Array.isArray(data)) {
          // Backward-compat: old API returned a flat array
          setItems(data);
          setTotal(data.length);
          setStateCounts({});
        } else {
          setItems(data.items || []);
          setTotal(data.total || 0);
          setStateCounts(data.state_counts || {});
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') showToast('Захиалга ачаалж чадсангүй', 'error');
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
  }, [filterDateFrom, filterDateTo, filterMeal, page, pageSize, showToast]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Reset to page 1 when any filter/tab/pageSize changes (not when page itself changes)
  useEffect(() => {
    const prev = prevFilters.current;
    if (
      prev.filterDateFrom !== filterDateFrom ||
      prev.filterDateTo   !== filterDateTo   ||
      prev.filterMeal     !== filterMeal     ||
      prev.filterState    !== filterState    ||
      prev.pageSize       !== pageSize
    ) {
      prevFilters.current = { filterDateFrom, filterDateTo, filterMeal, filterState, pageSize };
      if (page !== 1) setPage(1);
    }
  }, [filterDateFrom, filterDateTo, filterMeal, filterState, pageSize, page]);

  // ── Derived values ─────────────────────────────────────────────────────────

  // KPI numbers from current page (meal-filtered if active)
  const kpi = useMemo(() => {
    const visible = filterMeal ? items.filter((o) => o.type === filterMeal) : items;
    const totalEmp    = visible.reduce((s, o) => s + (o.employee_count ?? 0), 0);
    const totalSwiped = visible.reduce((s, o) => s + (o.swiped_count   ?? 0), 0);
    const lowSwipe    = visible.filter(
      (o) => (o.employee_count ?? 0) > 0 &&
              (o.swiped_count   ?? 0) < (o.employee_count ?? 0) &&
              o.state !== 'canceled',
    ).length;
    return { totalEmp, totalSwiped, lowSwipe };
  }, [items, filterMeal]);

  // Current page items after optional client-side meal filter
  const visibleItems = filterMeal ? items.filter((o) => o.type === filterMeal) : items;

  // Selection derived values (scoped to current page)
  const itemIds   = items.map((o) => o.id);
  const allSel    = itemIds.length > 0 && itemIds.every((id) => selectedIds.includes(id));
  const someSel   = selectedIds.some((id) => itemIds.includes(id));
  const activeSel = selectedIds.filter((id) => itemIds.includes(id));

  // ── Selection handlers ─────────────────────────────────────────────────────

  const toggleOne = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleAll = () => {
    if (allSel) {
      setSelectedIds((prev) => prev.filter((id) => !itemIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...itemIds])]);
    }
  };

  // ── Bulk action handlers ───────────────────────────────────────────────────

  const runBulk = async (label, fn, ids) => {
    if (!ids.length) return;
    if (!window.confirm(`${ids.length} захиалгыг ${label} уу?`)) return;
    setBulkLoading(true);
    try {
      await fn(ids);
      showToast(`${ids.length} захиалга ${label} ✓`);
      loadOrders();
    } catch {
      showToast('Алдаа гарлаа', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const approveAllDrafts = () => {
    const draftIds = items.filter((o) => o.state === 'draft').map((o) => o.id);
    if (!draftIds.length) return;
    if (!window.confirm(`${draftIds.length} ноорог захиалгыг батлах уу?`)) return;
    Promise.all(draftIds.map((id) => approveOrder(id)))
      .then(() => { showToast(`${draftIds.length} захиалга батлагдлаа ✓`); loadOrders(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="camp-dash">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {selectedOrderId && (
        <CampOrderModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onSaved={loadOrders}
        />
      )}

      {/* KPI summary cards */}
      {!loading && <KpiCards stateCounts={stateCounts} kpi={kpi} />}

      {/* Date / meal / state filters */}
      <FilterBar
        dateFrom={filterDateFrom}
        dateTo={filterDateTo}
        meal={filterMeal}
        activeTab={filterState}
        stateCounts={stateCounts}
        onDateFromChange={setFilterDateFrom}
        onDateToChange={setFilterDateTo}
        onMealChange={setFilterMeal}
        onTabChange={(key) => { setFilterState(key); setSelectedIds([]); }}
      />

      {/* Bulk action toolbar (visible only when ≥1 selected) */}
      <BulkToolbar
        count={activeSel.length}
        loading={bulkLoading}
        onApprove={() => runBulk('батлах', bulkApproveOrders, activeSel)}
        onCancel={()  => runBulk('цуцлах', bulkCancelOrders,  activeSel)}
        onDelete={()  => runBulk('устгах', bulkDeleteOrders,   activeSel)}
        onClear={() => setSelectedIds([])}
      />

      {/* "Approve all drafts on this page" shortcut */}
      {activeSel.length === 0 &&
        items.some((o) => o.state === 'draft') && items.length > 1 && (
        <div className="dash-approve-all">
          <button className="confirm-btn" onClick={approveAllDrafts}>
            Ноорог бүгдийг батлах ({items.filter((o) => o.state === 'draft').length})
          </button>
        </div>
      )}

      {/* Summary line */}
      <div className="dash-summary">
        {loading
          ? 'Уншиж байна...'
          : `${visibleItems.length} захиалга харуулж байна${total > pageSize ? ` (нийт ${total})` : ''}`}
      </div>

      {/* Main content area */}
      {loading ? (
        <div className="empty-state">Уншиж байна...</div>
      ) : visibleItems.length === 0 ? (
        <div className="empty-state">Захиалга байхгүй</div>
      ) : (
        <>
          {/* Desktop table (hidden on mobile via CSS) */}
          <OrderTable
            orders={visibleItems}
            selectedIds={selectedIds}
            expandedId={expandedId}
            allSel={allSel}
            someSel={someSel}
            onToggleAll={toggleAll}
            onToggleOne={toggleOne}
            onOpenOrder={setSelectedOrderId}
            onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
          />

          {/* Mobile cards (hidden on desktop via CSS) */}
          <div className="mobile-order-cards">
            {visibleItems.map((order) => (
              <MobileOrderCard
                key={order.id}
                order={order}
                isSelected={selectedIds.includes(order.id)}
                onOpen={() => setSelectedOrderId(order.id)}
                onToggle={() => toggleOne(order.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filterMeal ? visibleItems.length : total}
            onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onPageSize={setPageSize}
          />
        </>
      )}
    </div>
  );
}

export default CampOrdersView;
