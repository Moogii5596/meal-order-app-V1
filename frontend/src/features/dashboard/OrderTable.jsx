import React from 'react';
import { isProblem } from './campOrdersConstants';
import OrderRow from './OrderRow';

/**
 * Desktop order table — sticky header, zebra rows, expandable inline panels.
 * Hidden on mobile (CSS: .dash-table-wrap → display:none at ≤600px).
 *
 * Props:
 *   orders         array    — current page's visible orders
 *   selectedIds    array    — IDs of all currently selected orders
 *   expandedId     number|null — ID of the currently expanded row (null = none)
 *   allSel         boolean  — true when every visible order is selected
 *   someSel        boolean  — true when at least one (but not all) is selected
 *   onToggleAll    fn       — () => void
 *   onToggleOne    fn       — (id: number) => void
 *   onOpenOrder    fn       — (id: number) => void  — open detail modal
 *   onToggleExpand fn       — (id: number) => void  — toggle expand panel
 */
function OrderTable({
  orders,
  selectedIds,
  expandedId,
  allSel,
  someSel,
  onToggleAll,
  onToggleOne,
  onOpenOrder,
  onToggleExpand,
}) {
  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>
              <input
                type="checkbox"
                checked={allSel}
                indeterminate={someSel && !allSel}
                onChange={onToggleAll}
              />
            </th>
            <th style={{ width: 240 }}>Захиалга</th>
            <th>Илгээсэн</th>
            <th>Огноо</th>
            <th>Хоол</th>
            <th>Тоо</th>
            <th>Карт уншуулсан</th>
            <th>Төлөв</th>
            <th style={{ width: 120 }}>Үйлдэл</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              isSelected={selectedIds.includes(order.id)}
              isExpanded={expandedId === order.id}
              problem={isProblem(order)}
              onToggle={() => onToggleOne(order.id)}
              onOpen={() => onOpenOrder(order.id)}
              onToggleExpand={() => onToggleExpand(order.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default OrderTable;
