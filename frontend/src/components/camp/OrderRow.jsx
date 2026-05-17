import React from 'react';
import { MEAL_LABELS } from '../../constants';
import { MEAL_ICONS, fmtDatetime } from './campOrdersConstants';
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

        {/* Submitted by */}
        <td style={{ fontSize: 12, color: '#555' }}>
          {order.submitted_by || order.created_by || <span style={{ color: '#ccc' }}>—</span>}
        </td>

        {/* Created datetime */}
        <td style={{ fontSize: 12, color: '#444', whiteSpace: 'nowrap' }}>
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
              className="expand-btn"
              onClick={onToggleExpand}
              title={isExpanded ? 'Хаах' : 'Дэлгэрэнгүй'}
            >
              {isExpanded ? '▲' : '▼'}
            </button>
          </div>
        </td>
      </tr>

      {/* ── Inline expand panel ── */}
      {isExpanded && (
        <tr className="row-expanded-panel">
          <td colSpan={9}>
            <div className="expand-panel">
              <div className="expand-stat">
                <span className="expand-stat-label">Хоол</span>
                <span className="expand-stat-value">
                  {MEAL_ICONS[order.type]} {MEAL_LABELS[order.type] || order.type || '—'}
                </span>
              </div>
              <div className="expand-stat">
                <span className="expand-stat-label">Захиалагч</span>
                <span className="expand-stat-value">
                  {order.submitted_by || order.created_by || '—'}
                </span>
              </div>
              <div className="expand-stat">
                <span className="expand-stat-label">Үүсгэсэн</span>
                <span className="expand-stat-value">
                  {fmtDatetime(order.order_date || order.create_date)}
                </span>
              </div>
              <div className="expand-stat">
                <span className="expand-stat-label">Ажилтан</span>
                <span className="expand-stat-value">{empCount} хүн</span>
              </div>
              <div className="expand-stat">
                <span className="expand-stat-label">Карт уншуулсан</span>
                <span className="expand-stat-value">
                  {swiped}/{empCount}
                  {empCount > 0 && (
                    <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>
                      ({Math.round((swiped / empCount) * 100)}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="expand-stat">
                <span className="expand-stat-label">Төлөв</span>
                <StateBadge state={order.state} />
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <button
                  className="dash-action-btn"
                  style={{ padding: '6px 16px' }}
                  onClick={onOpen}
                >
                  📋 Нээх
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

export default OrderRow;
