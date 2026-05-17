import React from 'react';
import { MEAL_LABELS } from '../../constants';

/**
 * OrderModal
 *
 * Receives the pre-fetched order detail object from the parent — no extra fetch needed.
 *
 * Props:
 *   order   — order detail object (with .employees array)
 *   onClose — close handler
 */
function OrderModal({ order, onClose }) {
  if (!order) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <strong>Захиалга #{order.id}</strong>
          <span style={{ fontSize: 13, color: '#888' }}>
            {order.date} — {MEAL_LABELS[order.type] || order.type}
          </span>
          <button className="action-btn" onClick={onClose}>✕</button>
        </div>

        <table className="employee-table">
          <thead>
            <tr><th>#</th><th>Ажилтан</th><th>Хэлтэс</th></tr>
          </thead>
          <tbody>
            {(order.employees || []).map((emp, i) => (
              <tr key={emp.id}>
                <td style={{ color: '#aaa', fontSize: 12 }}>{i + 1}</td>
                <td>{emp.name}</td>
                <td style={{ fontSize: 12, color: '#888' }}>{emp.dept_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OrderModal;
