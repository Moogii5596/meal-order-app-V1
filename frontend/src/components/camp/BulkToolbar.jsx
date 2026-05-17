import React from 'react';

/**
 * Floating toolbar shown when ≥1 orders are selected.
 * Purely controlled — all actions fire callbacks.
 *
 * Props:
 *   count      number   — how many orders are currently selected
 *   loading    boolean  — true while a bulk operation is in flight
 *   onApprove  fn       — () => void  — trigger bulk approve
 *   onCancel   fn       — () => void  — trigger bulk cancel
 *   onDelete   fn       — () => void  — trigger bulk delete
 *   onClear    fn       — () => void  — deselect all
 */
function BulkToolbar({ count, loading, onApprove, onCancel, onDelete, onClear }) {
  if (count === 0) return null;

  return (
    <div className="dash-bulk-toolbar">
      <span className="dash-bulk-count">{count}</span>
      <span style={{ fontSize: 13, color: '#555' }}>захиалга сонгогдсон</span>
      <div className="dash-bulk-spacer" />
      <button
        className="bulk-btn bulk-btn-approve"
        disabled={loading}
        onClick={onApprove}
      >
        ✓ Батлах
      </button>
      <button
        className="bulk-btn bulk-btn-cancel"
        disabled={loading}
        onClick={onCancel}
      >
        ✕ Цуцлах
      </button>
      <button
        className="bulk-btn bulk-btn-delete"
        disabled={loading}
        onClick={onDelete}
      >
        🗑 Устгах
      </button>
      <button className="bulk-btn bulk-btn-clear" onClick={onClear}>
        Болих
      </button>
    </div>
  );
}

export default BulkToolbar;
