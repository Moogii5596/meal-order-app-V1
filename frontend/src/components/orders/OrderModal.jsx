import React, { useState, useEffect } from 'react';

import {
  API,
  MEAL_LABELS,
} from '../../shared/constants';

function OrderModal({ orderId, onClose, onApprove, onConfirm, role }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    fetch(`${API}/orders/${orderId}`)
      .then(r => r.json())
      .then(setDetail);
  }, [orderId]);

  if (!detail) return (
    <div className="modal-overlay">
      <div className="modal-box"><div className="empty-state">Уншиж байна...</div></div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <strong>Захиалга #{detail.id}</strong>
          <span>{detail.date} — {MEAL_LABELS[detail.type] || detail.type}</span>
          <button className="action-btn" onClick={onClose}>✕</button>
        </div>
        <table className="employee-table">
          <thead><tr><th>#</th><th>Ажилтан</th></tr></thead>
          <tbody>
            {detail.employees.map((e, i) => (
              <tr key={e.id}><td>{i + 1}</td><td>{e.name}</td></tr>
            ))}
          </tbody>
        </table>
        <div style={{marginTop: 12, textAlign: 'right'}}>
          {detail.state === 'draft' && (role === 'category_manager' || role === 'camp_manager') && (
            <button className="approve-btn" onClick={() => { onApprove(detail.id); onClose(); }}>Батлах</button>
          )}
          {detail.state === 'done' && role === 'camp_manager' && (
            <button className="confirm-btn" onClick={() => { onConfirm(detail.id); onClose(); }}>Баталгаажуулах</button>
          )}
        </div>
      </div>
    </div>
  );
}
export default OrderModal;