import React, { useState, useEffect, useCallback} from 'react';
import OrderModal from './OrderModal';
import Toast from '../../components/ui/Toast';
import PageLoader from '../../components/ui/PageLoader'; 
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../hooks/useToast';
import { MEAL_LABELS, STATE_TABS } from '../../constants';
import { fetchOrders, approveOrder, confirmOrder, fetchOrderDetail } from '../../services/orders';
import { useAuth } from '../../context/AuthContext';

function OrdersView() {
  const { role } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] =
    useState('draft');
  const [filterDate, setFilterDate] =
    useState('');
  const [filterMeal, setFilterMeal] =
    useState('');
  const [selectedOrder, setSelectedOrder] =
    useState(null);
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
      date: filterDate,
      mealType: filterMeal
    })
      .then(data => {
        if (Array.isArray(data)) {
          setOrders(data);
        } else {
          setOrders([]);
        }
      })
      .catch(err => {
        console.error(err);
        showToast(
          'Захиалга ачаалж чадсангүй',
          'error'
        );

      })
      .finally(() => {
        setLoading(false);
      });

  }, [
    filterDate,
    filterMeal,
    showToast
  ]);

  // ─────────────────────────────
  // INITIAL LOAD
  // ─────────────────────────────
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // ─────────────────────────────
  // OPEN DETAIL
  // ─────────────────────────────
  const openOrder = async (orderId) => {

    try {

      const detail =
        await fetchOrderDetail(orderId);

      setSelectedOrder(detail);

    } catch (err) {

      console.error(err);

      showToast(
        'Дэлгэрэнгүй мэдээлэл ачаалж чадсангүй',
        'error'
      );

    }

  };

  // ─────────────────────────────
  // APPROVE
  // ─────────────────────────────
  const handleApprove = async (orderId) => {

    try {

      await approveOrder(orderId);

      showToast(
        'Захиалга зөвшөөрөгдлөө',
        'success'
      );

      loadOrders();

    } catch (err) {

      console.error(err);

      showToast(
        err.message || 'Approve алдаа',
        'error'
      );

    }

  };

  // ─────────────────────────────
  // CONFIRM
  // ─────────────────────────────
  const handleConfirm = async (orderId) => {

    try {

      await confirmOrder(orderId);

      showToast(
        'Захиалга баталгаажлаа',
        'success'
      );

      loadOrders();

    } catch (err) {

      console.error(err);

      showToast(
        err.message || 'Confirm алдаа',
        'error'
      );

    }

  };


  // ─────────────────────────────
  // FILTERED ORDERS
  // ─────────────────────────────
  const filteredOrders = orders.filter(
    order => order.state === activeTab
  );

  // ─────────────────────────────
  // LOADING
  // ─────────────────────────────
  if (loading) {

    return (
      <PageLoader />
    );

  }

  return (
    <div className="orders-view">

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* FILTERS */}
      <div className="filters">

        <input
          type="date"
          value={filterDate}
          onChange={e =>
            setFilterDate(e.target.value)
          }
        />

        <select
          value={filterMeal}
          onChange={e =>
            setFilterMeal(e.target.value)
          }
        >

          <option value="">
            Бүх хоол
          </option>

          {Object.entries(MEAL_LABELS)
            .map(([key, label]) => (
              <option
                key={key}
                value={key}
              >
                {label}
              </option>
            ))}

        </select>

      </div>

      {/* TABS */}
      <div className="state-tabs">

        {STATE_TABS.map(tab => (

          <button
            key={tab.key}
            className={
              activeTab === tab.key
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(tab.key)
            }
          >
            {tab.label}
          </button>

        ))}

      </div>

      {/* EMPTY */}
      {filteredOrders.length === 0 && (
        <EmptyState 
         message="Захиалга олдсонгүй" 
        />
      )}

      {/* TABLE */}
      {filteredOrders.length > 0 && (

        <div className="table-scroll">
        <table className="orders-table">

          <thead>
            <tr>
              <th>ID</th>
              <th>Хэлтэс</th>
              <th>Хоол</th>
              <th>Огноо</th>
              <th>Төлөв</th>
              <th>Үйлдэл</th>
            </tr>
          </thead>

          <tbody>

            {filteredOrders.map(order => (

              <tr key={order.id}>

                <td>{order.id}</td>

                <td>
                  {order.department_name}
                </td>

                <td>
                  {
                    MEAL_LABELS[
                      order.meal_type
                    ]
                  }
                </td>

                <td>{order.date}</td>

                <td>{order.state}</td>

                <td>
                  <button onClick={() => openOrder(order.id)}>Харах</button>

                  {role === 'category_manager' && order.state === 'draft' && (
                    <button onClick={() => handleApprove(order.id)}>Батлах</button>
                  )}

                  {role === 'camp_manager' && order.state === 'done' && (
                    <button onClick={() => handleConfirm(order.id)}>Баталгаажуулах</button>
                  )}
                </td>

              </tr>

            ))}

          </tbody>

        </table>
        </div>
      )}
    </div>
  );
}

export default OrdersView;
