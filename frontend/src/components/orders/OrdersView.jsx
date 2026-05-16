import React, { useState, useEffect } from 'react';
import OrderModal from './OrderModal';
import Toast from '../ui/Toast';
import { useToast } from '../../hooks/useToast';
import {
  API,
  MEAL_LABELS,
  STATE_TABS,
} from '../../shared/constants';

function OrdersView({ role }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('draft');
  const [filterDate, setFilterDate] = useState('');
  const [filterMeal, setFilterMeal] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { toast, showToast, hideToast } = useToast();

  const fetchOrders = () => {
    setLoading(true);
    fetch(`${API}/orders`)
      .then(r => r.json())
      .then(data => { setOrders(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  const approve = (id) => {
    fetch(`${API}/orders/${id}/approve`, { method: 'POST' })
      .then(r => r.json())
      .then(() => { showToast('Захиалга батлагдлаа ✓'); fetchOrders(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  const confirm = (id) => {
    fetch(`${API}/orders/${id}/confirm`, { method: 'POST' })
      .then(r => r.json())
      .then(() => { showToast('Захиалга баталгаажлаа ✓'); fetchOrders(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  const counts = {};
  orders.forEach(o => { counts[o.state] = (counts[o.state] || 0) + 1; });

  const filtered = orders.filter(o =>
    o.state === activeTab &&
    (!filterDate || o.date === filterDate) &&
    (!filterMeal || o.type === filterMeal)
  );

  const canApprove = role === 'category_manager' || role === 'camp_manager';
  const canConfirm = role === 'camp_manager';
  const showAction = (activeTab === 'draft' && canApprove) || (activeTab === 'done' && canConfirm);

  return (
    <div style={{marginTop: 20}}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      {selectedOrder && (
        <OrderModal
          orderId={selectedOrder}
          role={role}
          onClose={() => setSelectedOrder(null)}
          onApprove={(id) => { approve(id); setSelectedOrder(null); }}
          onConfirm={(id) => { confirm(id); setSelectedOrder(null); }}
        />
      )}
      <div className="meal-types" style={{marginBottom: 12}}>
        {STATE_TABS.map(t => (
          <button key={t.key} className={activeTab === t.key ? 'active' : ''} onClick={() => setActiveTab(t.key)}>
            {t.label}{counts[t.key] ? ` (${counts[t.key]})` : ''}
          </button>
        ))}
      </div>
      <div className="controls" style={{marginBottom: 12}}>
        <div className="control-row">
          <label>Огноо:</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          {filterDate && <button className="action-btn" onClick={() => setFilterDate('')}>Цэвэрлэх</button>}
        </div>
        <div className="meal-types">
          <button className={filterMeal === '' ? 'active' : ''} onClick={() => setFilterMeal('')}>Бүгд</button>
          {Object.entries(MEAL_LABELS).map(([key, label]) => (
            <button key={key} className={filterMeal === key ? 'active' : ''} onClick={() => setFilterMeal(key)}>{label}</button>
          ))}
        </div>
      </div>
      {loading ? <div className="empty-state">Уншиж байна...</div>
      : filtered.length === 0 ? <div className="empty-state">Захиалга байхгүй байна</div>
      : <table className="employee-table">
          <thead>
            <tr>
              <th>ID</th><th>Огноо</th><th>Хоолны төрөл</th><th>Ажилтны тоо</th>
              {showAction && <th>Үйлдэл</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id} style={{cursor:'pointer'}} onClick={() => setSelectedOrder(o.id)}>
                <td>{o.id}</td>
                <td>{o.date}</td>
                <td>{MEAL_LABELS[o.type] || o.type}</td>
                <td>{o.order_line?.length || 0}</td>
                {activeTab === 'draft' && canApprove && (
                  <td><button className="approve-btn" onClick={e => { e.stopPropagation(); approve(o.id); }}>Батлах</button></td>
                )}
                {activeTab === 'done' && canConfirm && (
                  <td><button className="confirm-btn" onClick={e => { e.stopPropagation(); confirm(o.id); }}>Баталгаажуулах</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>}
    </div>
  );
}
export default OrdersView;