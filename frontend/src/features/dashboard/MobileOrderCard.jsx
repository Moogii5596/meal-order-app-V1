import React from 'react';
import { fmtDatetime, isProblem } from './campOrdersConstants';
import MealPill   from './MealPill';
import SwipeBar   from './SwipeBar';
import StateBadge from './StateBadge';

/**
 * Mobile card for a single order.
 * Visible only on narrow viewports (CSS: .mobile-order-cards shown at ≤600px).
 *
 * Props:
 *   order       object   — the order data object
 *   isSelected  boolean  — whether the order's checkbox is checked
 *   onOpen      fn       — () => void — open detail modal
 *   onToggle    fn       — () => void — toggle selection checkbox
 */
function MobileOrderCard({ order, isSelected, onOpen, onToggle }) {
  const empCount = order.employee_count ?? 0;
  const swiped   = order.swiped_count   ?? 0;
  const problem  = isProblem(order);

  const cardCls = [
    `card-${order.state || 'unknown'}`,
    problem    ? 'card-problem'  : '',
    isSelected ? 'card-selected' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`mobile-order-card ${cardCls}`}
      onClick={onOpen}
    >
      {/* Top row: name + state badge */}
      <div className="card-top">
        <div>
          <div className="card-name">{order.name || `#${order.id}`}</div>
          {order.name && <div className="card-id">#{order.id}</div>}
        </div>
        <StateBadge state={order.state} />
      </div>

      {/* Meta: meal pill, date, submitted by */}
      <div className="card-meta">
        <MealPill type={order.type} />
        <span>📅 {fmtDatetime(order.order_date || order.create_date)}</span>
        {(order.submitted_by || order.created_by) && (
          <span>👤 {order.submitted_by || order.created_by}</span>
        )}
      </div>

      {/* Bottom row: swipe bar + checkbox */}
      <div className="card-bottom">
        <SwipeBar swiped={swiped} total={empCount} />
        <span
          className="card-check"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
          />
        </span>
      </div>
    </div>
  );
}

export default MobileOrderCard;
