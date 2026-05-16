import React, { useState, useEffect, useCallback } from 'react';
import OrderModal from './OrderModal';
import Toast from '../ui/Toast';
import { useToast } from '../../hooks/useToast';
import { MEAL_LABELS, STATE_TABS, } from '../../shared/constants';
import { fetchOrders, approveOrder, confirmOrder } from '../../services/orders';
function OrdersView({ role, token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingOrderId, setActionLoadingOrderId] = useState(null);
  const [activeTab, setActiveTab] = useState('draft');
  const [filterDate, setFilterDate] = useState('');
  const [filterMeal, setFilterMeal] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const {
    toast,
    showToast,
    hideToast
  } = useToast();
  // ─────────────────────────────
  // LOAD ORDERS
  // ─────────────────────────────
  const loadOrders = useCallback(() => {
    setLoading(true);
    fetchOrders({
      token
    })
      .then(data => {
        setOrders(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [token]);
  // ─────────────────────────────
  // INITIAL LOAD
  // ─────────────────────────────
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);
  // ─────────────────────────────
  // APPROVE
  // ─────────────────────────────
  const approve = (id) => {
    setActionLoadingOrderId(id);

    approveOrder(id, token)
      .then(() => {
        showToast(
          'Захиалга батлагдлаа ✓'
        );
        loadOrders();
      })
      .catch(() => {
        showToast(
          'Алдаа гарлаа',
          'error'
        );
      })
      .finally(() => {
        setActionLoadingOrderId(null);
      });
  };
  // ─────────────────────────────
  // CONFIRM
  // ─────────────────────────────
  const confirm = (id) => {
    setActionLoadingOrderId(id);

    confirmOrder(id, token)
      .then(() => {
        showToast(
          'Захиалга баталгаажлаа ✓'
        );
        loadOrders();
      })
      .catch(() => {
        showToast(
          'Алдаа гарлаа',
          'error'
        );
      })
      .finally(() => {
        setActionLoadingOrderId(null);
      });
  };
  // ─────────────────────────────
  // COUNTS
  // ─────────────────────────────
  const counts = {};
  orders.forEach(o => {
    counts[o.state] =
      (counts[o.state] || 0) + 1;
  });
  // ─────────────────────────────
  // FILTER
  // ─────────────────────────────
  const filtered = orders.filter(o =>
    o.state === activeTab &&
    (!filterDate || o.date === filterDate) &&
    (!filterMeal || o.type === filterMeal)
  );
  const canApprove =
    role === 'category_manager' ||
    role === 'camp_manager';
  const canConfirm =
    role === 'camp_manager';
  const showAction =
    (activeTab === 'draft' && canApprove) ||
    (activeTab === 'done' && canConfirm);
  // ─────────────────────────────
  // RENDER
  // ─────────────────────────────
  return (
    <div style={{ marginTop: 20 }}>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}
      {selectedOrder && (
        <OrderModal
          orderId={selectedOrder}
          token={token}
          role={role}
          onClose={() =>
            setSelectedOrder(null)
          }
          onApprove={(id) => {
            approve(id);
            setSelectedOrder(null);
          }}
          onConfirm={(id) => {
            confirm(id);
            setSelectedOrder(null);
          }}
        />
      )}
      <div
        className="meal-types"
        style={{ marginBottom: 12 }}
      >
        {STATE_TABS.map(t => (
          <button
            key={t.key}
            className={
              activeTab === t.key
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(t.key)
            }
          >
            {t.label}
            {counts[t.key]
              ? ` (${counts[t.key]})`
              : ''}
          </button>
        ))}
      </div>
      <div
        className="controls"
        style={{ marginBottom: 12 }}
      >
        <div className="control-row">
          <label>Огноо:</label>
          <input
            type="date"
            value={filterDate}
            onChange={e =>
              setFilterDate(e.target.value)
            }
          />
          {filterDate && (
            <button
              className="action-btn"
              onClick={() =>
                setFilterDate('')
              }
            >
              Цэвэрлэх
            </button>
          )}
        </div>
        <div className="meal-types">
          <button
            className={
              filterMeal === ''
                ? 'active'
                : ''
            }
            onClick={() =>
              setFilterMeal('')
            }
          >
            Бүгд
          </button>
          {Object.entries(MEAL_LABELS).map(
            ([key, label]) => (
              <button
                key={key}
                className={
                  filterMeal === key
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setFilterMeal(key)
                }
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>
      {loading ? (
        <div className="empty-state">
          Уншиж байна...
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          Захиалга байхгүй байна
        </div>
      ) : (
        <table className="employee-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Огноо</th>
              <th>Хоолны төрөл</th>
              <th>Ажилтны тоо</th>
              {showAction && (
                <th>Үйлдэл</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr
                key={o.id}
                style={{
                  cursor: 'pointer'
                }}
                onClick={() =>
                  setSelectedOrder(o.id)
                }
              >
                <td>{o.id}</td>
                <td>{o.date}</td>
                <td>
                  {MEAL_LABELS[o.type] ||
                    o.type}
                </td>
                <td>
                  {o.order_line?.length || 0}
                </td>
                {activeTab === 'draft' &&
                  canApprove && (
                  <td>
                    <button
                      className="approve-btn"
                      disabled={actionLoadingOrderId === o.id}
                      onClick={e => {
                        e.stopPropagation();
                        approve(o.id);
                      }}
                    >
                      {actionLoadingOrderId === o.id
                        ? 'Батлах...'
                        : 'Батлах'}
                    </button>
                  </td>
                )}
                {activeTab === 'done' &&
                  canConfirm && (
                  <td>
                    <button
                      className="confirm-btn"
                      disabled={actionLoadingOrderId === o.id}
                      onClick={e => {
                        e.stopPropagation();
                        confirm(o.id);
                      }}
                    >
                      {actionLoadingOrderId === o.id
                        ? 'Баталгаажуулж...'
                        : 'Баталгаажуулах'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
export default OrdersView;