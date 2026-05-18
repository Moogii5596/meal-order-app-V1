import React from 'react';
import { fmtDatetime } from './campOrdersConstants';
import MealPill    from './MealPill';
import SwipeBar    from './SwipeBar';
import StateBadge  from './StateBadge';

/**
 * One order's row inside the desktop table, plus the optional inline expand panel.
 * Must be rendered inside a <tbody> — returns a React.Fragment with 1 or 2 <tr>s.
 *
 * Props:
 *   order          object   — the order data object
 *   isSelected     boolean  — checkbox checked state
 *   isExpanded     boolean  — whether the expand panel is open
 *   problem        boolean  — true when swipe count is below expectation
 *   onToggle       fn       — () => void — toggle checkbox
 *   onOpen         fn       — () => void — open detail modal
 *   onToggleExpand fn       — () => void — toggle inline expand panel
 */
function OrderRow({ order, isSelected, isExpanded, problem, onToggle, onOpen, onToggleExpand }) {
  const empCount = order.employee_count ?? 0;
  const swiped   = order.swiped_count   ?? 0;

  const rowCls = [
    isSelected                                          ? 'row-selected' : '',
    problem                                             ? 'row-problem'  : '',
    order.state === 'draft' && !isSelected && !problem  ? 'row-draft'    : '',
  ].filter(Boolean).join(' ');

  return (
    <React.Fragment>
      {/* ── Main row ── */}
      <tr
        className={rowCls}
        style={{ cursor: 'pointer' }}
        onClick={onOpen}
      >
        {/* Checkbox */}
        <td onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
          />
        </td>

        {/* Order name + ID */}
        <td>
          <div className="order-name-cell">
            <span className="order-name-main">{order.name || `#${order.id}`}</span>
            {order.name && <span className="order-name-sub">#{order.id}</span>}
          </div>
        </td>

        {/* Submitted by — truncated to one line, full name visible on hover */}
        <td
          className="cell-submitter"
          title={order.submitted_by || order.created_by || ''}
        >
          {order.submitted_by || order.created_by || <span style={{ color: '#ccc' }}>—</span>}
        </td>

        {/* Created datetime */}
        <td className="cell-date">
          {fmtDatetime(order.order_date || order.create_date)}
        </td>

        {/* Meal type */}
        <td><MealPill type={order.type} /></td>

        {/* Employee count */}
        <td><span className="badge info">{empCount} хүн</span></td>

        {/* Swipe progress */}
        <td><SwipeBar swiped={swiped} total={empCount} /></td>

        {/* State */}
        <td><StateBadge state={order.state} /></td>

        {/* Action buttons + expand toggle */}
        <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {order.state === 'draft' && (
              <button className="dash-action-btn btn-approve" onClick={onOpen}>Батлах</button>
            )}
            {order.state === 'done' && (
              <button className="dash-action-btn btn-confirm" onClick={onOpen}>Баталгаажуулах</button>
            )}
            {(order.state === 'confirmed' || order.state === 'canceled') && (
              <button className="dash-action-btn" onClick={onOpen}>Харах</button>
            )}
            {!['draft', 'done', 'confirmed', 'canceled'].includes(order.state) && (
              <button className="dash-action-btn" onClick={onOpen}>Нээх</button>
            )}
            <button
              className={`expand-btn${isExpanded ? ' expanded' : ''}`}
              onClick={onToggleExpand}
              title={isExpanded ? 'Хаах' : 'Дэлгэрэнгүй'}
              aria-label={isExpanded ? 'Хаах' : 'Дэлгэрэнгүй'}
            >
              ‹
            </button>
          </div>
        </td>
      </tr>

      {/* ── Expand panel — employee chip grid ── */}
      {isExpanded && (
        <tr className="row-expanded-panel">
          <td colSpan={999}>
            <div className="expand-panel">
              <div className="expand-panel-header">
                <span className="expand-panel-title">Ажилчид</span>
                <span className="expand-panel-count">
                  {order.employee_names?.length ?? 0} хүн
                </span>
              </div>
              <div className="emp-chips">
                {order.employee_names && order.employee_names.length > 0 ? (
                  order.employee_names.map((name, i) => (
                    <span key={i} className="emp-chip">{name}</span>
                  ))
                ) : (
                  <span className="emp-chips-empty">Ажилчид байхгүй</span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

export default OrderRow;
