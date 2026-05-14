import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// ── Toast мэдэгдэл ──
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`toast toast-${type}`}>{message}</div>
  );
}

function useToast() {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);
  return { toast, showToast, hideToast };
}

const API = process.env.REACT_APP_API_URL;

const MEAL_LABELS = {
  breakfast: 'Өглөөний хоол',
  lunch: 'Өдрийн хоол',
  dinner: 'Оройн хоол',
  night: 'Шөнийн хоол',
};

const LOCATION_LABELS = {
  uh: 'Ухаа худар',
  bh: 'Баруун наран',
  zas: 'Засвар',
  office: 'Оффис',
};

const ROLE_LABELS = {
  kitchen_staff: 'Хоолны захиалагч',
  category_manager: 'Хоолны захиалга хянагч ТН',
  camp_manager: 'Кемп менежер',
};

// ── Захиалга үүсгэх ──
function KitchenView({ token, userDept }) {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDeptName, setSelectedDeptName] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState('lunch');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [extraEmployees, setExtraEmployees] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (userDept) {
      // Хэрэглэгчийн өөрийн хэлтэс автоматаар сонгогдоно
      setDepartments([{ id: userDept.id, name: userDept.name }]);
      setSelectedDept(userDept.id);
      setSelectedDeptName(userDept.name);
    } else {
      fetch(`${API}/departments`)
        .then(r => r.json())
        .then(data => setDepartments(data))
        .catch(console.error);
    }
  }, [userDept]);

  const handleDeptChange = (e) => {
    setSelectedDept(e.target.value);
    const dept = departments.find(d => String(d.id) === e.target.value);
    setSelectedDeptName(dept ? dept.name : '');
    setEmployees([]);
  };

  const loadEmployees = useCallback((autoSelect = true) => {
    if (!selectedDept) return;
    setLoading(true);
    fetch(`${API}/employees?dept_id=${selectedDept}&date=${selectedDate}&meal_type=${selectedMeal}`)
      .then(r => r.json())
      .then(data => {
        setEmployees(data.employees || []);
        if (autoSelect) {
          setSelectedEmployees((data.employees || []).filter(e => !e.is_swiped).map(e => e.id));
        } else {
          setSelectedEmployees([]);
        }
        setLoading(false);
      });
  }, [selectedDept, selectedDate, selectedMeal]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const submitOrder = () => {
    // Зөвхөн харагдаж байгаа ажилтнуудаас сонгогдсоныг илгээнэ
    const idsToSubmit = selectedEmployees.filter(id => filteredEmployees.find(e => e.id === id));
    fetch(`${API}/create-order?date=${selectedDate}&meal_type=${selectedMeal}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(idsToSubmit)
    })
      .then(r => r.json())
      .then(() => {
        showToast(`${MEAL_LABELS[selectedMeal]} захиалга амжилттай илгээгдлээ ✓`);
        loadEmployees(false);
      })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  // Байгаа location-уудыг динамикаар гаргах
  const locations = [...new Set(employees.map(e => e.location).filter(Boolean))];

  // Location шүүлтүүр + сунасан ажилтнуудыг нэмнэ
  const baseFiltered = selectedLocation
    ? employees.filter(e => e.location === selectedLocation)
    : employees;
  const filteredEmployees = [...baseFiltered, ...extraEmployees.filter(e => !baseFiltered.find(b => b.id === e.id))];

  const swipedCount = filteredEmployees.filter(e => e.is_swiped).length;
  const notSwipedCount = filteredEmployees.filter(e => !e.is_swiped).length;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <div className="controls">
        <div className="control-row">
          <label>Огноо:</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        </div>
        <div className="control-row">
          <label>Хэлтэс:</label>
          <select onChange={handleDeptChange} value={selectedDept}>
            <option value="">-- Хэлтэс сонгоно уу --</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="meal-types">
          {Object.entries(MEAL_LABELS).map(([key, label]) => (
            <button key={key} className={selectedMeal === key ? 'active' : ''} onClick={() => setSelectedMeal(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {!selectedDept ? (
        <div className="empty-state">Эхлээд хэлтэс сонгоно уу</div>
      ) : loading ? (
        <div className="empty-state">Уншиж байна...</div>
      ) : (
        <div>
          {locations.length > 1 && (
            <div className="meal-types" style={{marginBottom: 10}}>
              <button className={selectedLocation === '' ? 'active' : ''} onClick={() => setSelectedLocation('')}>Бүгд</button>
              {locations.map(loc => (
                <button key={loc} className={selectedLocation === loc ? 'active' : ''} onClick={() => setSelectedLocation(loc)}>
                  {LOCATION_LABELS[loc] || loc}
                </button>
              ))}
            </div>
          )}
          <div className="table-header">
            <div className="table-info">
              <strong>{selectedDeptName}</strong>
              {selectedLocation && <span> — {LOCATION_LABELS[selectedLocation] || selectedLocation}</span>}
              <span className="stat"> | Нийт: {filteredEmployees.length} </span>
              <span className="stat-success">Карттай: {swipedCount}</span>
              <span className="stat-warn"> | Захиалах: {notSwipedCount}</span>
            </div>
            <div>
              <button className="action-btn" onClick={() => setSelectedEmployees(filteredEmployees.filter(e => !e.is_swiped).map(e => e.id))}>Бүгд</button>
              <button className="action-btn" onClick={() => setSelectedEmployees([])}>Цуцлах</button>
              <button className="action-btn" style={{borderColor:'#1677ff', color:'#1677ff'}} onClick={() => setShowAddModal(true)}>+ Нэмэх</button>
            </div>
          </div>

          {showAddModal && (
            <AddEmployeeModal
              onAdd={(emp) => {
                setExtraEmployees(prev => prev.find(e => e.id === emp.id) ? prev : [...prev, {...emp, is_extra: true}]);
                setSelectedEmployees(prev => prev.includes(emp.id) ? prev : [...prev, emp.id]);
              }}
              onClose={() => setShowAddModal(false)}
            />
          )}
          <table className="employee-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox"
                    checked={filteredEmployees.filter(e => !e.is_swiped).length > 0 &&
                      filteredEmployees.filter(e => !e.is_swiped).every(e => selectedEmployees.includes(e.id))}
                    onChange={e => {
                      const ids = filteredEmployees.filter(emp => !emp.is_swiped).map(emp => emp.id);
                      if (e.target.checked) {
                        setSelectedEmployees(prev => [...new Set([...prev, ...ids])]);
                      } else {
                        setSelectedEmployees(prev => prev.filter(id => !ids.includes(id)));
                      }
                    }}
                  />
                </th>
                <th>Овог</th><th>Нэр</th><th>Албан тушаал</th><th>Байршил</th><th>Карт</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className={emp.is_swiped ? 'swiped-row' : ''}>
                  <td>
                    <input type="checkbox" checked={selectedEmployees.includes(emp.id)}
                      onChange={() => setSelectedEmployees(prev =>
                        prev.includes(emp.id) ? prev.filter(x => x !== emp.id) : [...prev, emp.id]
                      )}
                      disabled={emp.is_swiped} />
                  </td>
                  <td>{emp.last_name}</td>
                  <td>{emp.name}</td>
                  <td>{emp.job_title}</td>
                  <td>{LOCATION_LABELS[emp.location] || emp.location || '—'}{emp.is_extra && <span style={{marginLeft:4, fontSize:11, color:'#1677ff'}}>(сунасан)</span>}</td>
                  <td><span className={`badge ${emp.is_swiped ? 'success' : 'error'}`}>{emp.is_swiped ? 'Шивэгдсэн' : 'Шивэгдээгүй'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedEmployees.filter(id => filteredEmployees.find(e => e.id === id)).length > 0 && (
            <button className="submit-btn" onClick={submitOrder}>
              Захиалга илгээх ({selectedEmployees.filter(id => filteredEmployees.find(e => e.id === id)).length} ажилтан)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddEmployeeModal({ onAdd, onClose }) {
  const [tab, setTab] = useState('sunasan'); // 'sunasan' | 'rental'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Түрээсийн tab нээхэд автоматаар ачаална
  useEffect(() => {
    if (tab === 'rental') {
      setSearching(true);
      fetch(`${API}/employees/rental`)
        .then(r => r.json())
        .then(data => { setResults(data); setSearching(false); })
        .catch(() => setSearching(false));
    } else {
      setResults([]);
      setQuery('');
    }
  }, [tab]);

  const search = () => {
    if (tab === 'sunasan') {
      if (!query.trim()) return;
      setSearching(true);
      fetch(`${API}/employees/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => { setResults(data); setSearching(false); })
        .catch(() => setSearching(false));
    } else {
      setSearching(true);
      fetch(`${API}/employees/rental?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => { setResults(data); setSearching(false); })
        .catch(() => setSearching(false));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <strong>Ажилтан нэмэх</strong>
          <button className="action-btn" onClick={onClose}>✕</button>
        </div>
        <div className="meal-types" style={{marginBottom:12}}>
          <button className={tab === 'sunasan' ? 'active' : ''} onClick={() => setTab('sunasan')}>Сунасан</button>
          <button className={tab === 'rental' ? 'active' : ''} onClick={() => setTab('rental')}>Түрээсийн</button>
        </div>
        <div style={{display:'flex', gap:8, marginBottom:12}}>
          <input
            style={{flex:1, padding:'8px 12px', border:'1px solid #d9d9d9', borderRadius:6, fontSize:14}}
            placeholder="Нэрээр хайх..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <button className="approve-btn" onClick={search}>Хайх</button>
        </div>
        {searching && <div className="empty-state">Уншиж байна...</div>}
        {!searching && results.length === 0 && tab === 'sunasan' && (
          <div className="empty-state" style={{padding:20}}>Нэр бичиж хайна уу</div>
        )}
        {results.length > 0 && (
          <table className="employee-table">
            <thead><tr><th>Нэр</th><th>Хэлтэс</th><th></th></tr></thead>
            <tbody>
              {results.map(emp => (
                <tr key={emp.id}>
                  <td>{emp.last_name} {emp.name}</td>
                  <td style={{fontSize:12, color:'#888'}}>{emp.dept_name}</td>
                  <td><button className="confirm-btn" onClick={() => { onAdd(emp); onClose(); }}>Нэмэх</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

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

// ── Захиалгын жагсаалт (tab + шүүлтүүр) ──
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
  const [loginName, setLoginName] = useState('');
  const [loginPass, setLoginPass] = useState('');

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
        } else alert('Нэвтрэх нэр эсвэл нууц үг буруу байна');
      })
      .catch(() => alert('Сервертэй холбогдож чадсангүй'));
  };

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
          <button className="logout-btn" onClick={() => setRole(null)}>Гарах</button>
        </div>
      </div>

      <KitchenView token={token} userDept={userDept} />
      {role !== 'kitchen_staff' && <OrdersView role={role} />}
    </div>
  );
}

export default App;
