import React, { useState, useEffect } from 'react';
import './App.css';
import CampManagerView from './components/camp/CampManagerView';
import { useToast } from './hooks/useToast';
import Toast from './components/ui/Toast';
import KitchenView from './components/kitchen/KitchenView';

const API = process.env.REACT_APP_API_URL;

const MEAL_LABELS = {
  breakfast: 'Өглөөний хоол',
  lunch: 'Өдрийн хоол',
  dinner: 'Оройн хоол',
  night: 'Шөнийн хоол',
};


const ROLE_LABELS = {
  kitchen_staff: 'Хоолны захиалагч',
  category_manager: 'Хоолны захиалга хянагч ТН',
  camp_manager: 'Кемп менежер',
};



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

const STATE_TABS = [
  { key: 'draft', label: 'Ноорог' },
  { key: 'done', label: 'Батлагдсан' },
  { key: 'confirmed', label: 'Баталгаажсан' },
  { key: 'canceled', label: 'Цуцалсан' },
];

// ── Захиалгын жагсаалт (category_manager-д) ──
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

// ── Үндсэн App ──
function App() {
  const [role, setRole] = useState(null);
  const [token, setToken] = useState(null);
  const [userDept, setUserDept] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loginName, setLoginName] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      fetch(`${API}/me`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data.role) {
            setToken(storedToken);
            setRole(data.role);
            if (data.dept_id) {
              setUserDept({ id: String(data.dept_id), name: data.dept_name });
            }
            if (data.location) {
              setUserLocation(data.location);
            }
          } else {
            localStorage.removeItem('authToken');
          }
        })
        .catch(() => {
          localStorage.removeItem('authToken');
        })
        .finally(() => setIsLoadingAuth(false));
    } else {
      setIsLoadingAuth(false);
    }
  }, []);

  const handleLogin = () => {
    fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginName, password: loginPass })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setRole(data.role);
          setToken(data.token);
          if (data.dept_id) setUserDept({ id: String(data.dept_id), name: data.dept_name });
          if (data.location) setUserLocation(data.location);
          localStorage.setItem('authToken', data.token);
          if (data.dept_id) {
            localStorage.setItem('authDeptId', String(data.dept_id));
            localStorage.setItem('authDeptName', data.dept_name);
          }
          if (data.location) {
            localStorage.setItem('authLocation', data.location);
          }
        } else {
          alert('Нэвтрэх нэр эсвэл нууц үг буруу байна');
        }
      })
      .catch(() => alert('Сервертэй холбогдож чадсангүй'));
  };

  const handleLogout = () => {
    setRole(null);
    setToken(null);
    setUserDept(null);
    setUserLocation(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authRole');
    localStorage.removeItem('authDeptId');
    localStorage.removeItem('authDeptName');
    localStorage.removeItem('authLocation');
  };

  if (isLoadingAuth) {
    return (
      <div className="login-box">
        <h1>Camp Meal Login</h1>
        <div className="empty-state">Шалгаж байна...</div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="login-box">
        <h1>Camp Meal Login</h1>
        <input type="text" placeholder="Нэвтрэх нэр" value={loginName}
          onChange={e => setLoginName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        <input type="password" placeholder="Нууц үг" value={loginPass}
          onChange={e => setLoginPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        <button className="login-btn" onClick={handleLogin}>Нэвтрэх</button>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="App-header">
        <div className="header-row">
          <div>
            <h1>Хоолны захиалга</h1>
            <span className="role-badge">{ROLE_LABELS[role]}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Гарах</button>
        </div>
      </div>

      {role === 'camp_manager' ? (
        <CampManagerView token={token} />
      ) : (
        <>
          <KitchenView token={token} userDept={userDept} userLocation={userLocation} />
          {role !== 'kitchen_staff' && <OrdersView role={role} />}
        </>
      )}
    </div>
  );
}

export default App;
