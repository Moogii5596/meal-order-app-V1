import React, { useState, useEffect, useCallback } from 'react';
import Toast from '../ui/Toast';
import { useToast } from '../../hooks/useToast';
import {
  API,
  MEAL_LABELS,
  STATE_TABS,
} from '../../shared/constants';

function CampOrderModal({ orderId, onClose, onSaved, token }) {
  const [detail, setDetail] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);
  const [addedEmps, setAddedEmps] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const loadDetail = useCallback(() => {
    fetch(`${API}/orders/${orderId}`)
      .then(r => r.json())
      .then(data => {
        setDetail(data);
        setCheckedIds(data.employees.map(e => e.id));
        setAddedEmps([]);
      });
  }, [orderId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const searchEmps = () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    fetch(`${API}/employees/search?q=${encodeURIComponent(searchQuery)}`)
      .then(r => r.json())
      .then(data => { setSearchResults(data); setSearching(false); })
      .catch(() => setSearching(false));
  };

  const addEmp = (emp) => {
    const allIds = [...(detail?.employees || []), ...addedEmps].map(e => e.id);
    if (allIds.includes(emp.id)) return;
    const newEmp = { id: emp.id, name: `${emp.last_name || ''} ${emp.name}`.trim(), dept_name: emp.dept_name || '', isNew: true };
    setAddedEmps(prev => [...prev, newEmp]);
    setCheckedIds(prev => [...prev, emp.id]);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const saveLines = () => {
    setSaving(true);
    fetch(`${API}/orders/${orderId}/lines`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ employee_ids: checkedIds })
    })
      .then(r => r.json())
      .then(() => { showToast('Захиалга хадгалагдлаа ✓'); setSaving(false); loadDetail(); onSaved(); })
      .catch(() => { showToast('Алдаа гарлаа', 'error'); setSaving(false); });
  };

  const doApprove = () => {
    fetch(`${API}/orders/${orderId}/approve`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(() => { showToast('Захиалга батлагдлаа ✓'); onSaved(); onClose(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  const doConfirm = () => {
    fetch(`${API}/orders/${orderId}/confirm`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(() => { showToast('Захиалга баталгаажлаа ✓'); onSaved(); onClose(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  if (!detail) return (
    <div className="modal-overlay"><div className="modal-box"><div className="empty-state">Уншиж байна...</div></div></div>
  );

  const allEmps = [...(detail.employees || []), ...addedEmps];
  const checkedCount = checkedIds.length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <div className="modal-box camp-order-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <strong>Захиалга #{detail.id}</strong>
            <span style={{ marginLeft: 10, color: '#888', fontSize: 13 }}>
              {detail.date} — {MEAL_LABELS[detail.type] || detail.type}
            </span>
            <span className={`badge ${detail.state === 'draft' ? 'warn' : detail.state === 'done' ? 'success' : 'info'}`}
              style={{ marginLeft: 8 }}>
              {detail.state === 'draft' ? 'Ноорог' : detail.state === 'done' ? 'Батлагдсан' : detail.state === 'confirmed' ? 'Баталгаажсан' : detail.state}
            </span>
          </div>
          <button className="action-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#555' }}>
            Нийт: <strong>{allEmps.length}</strong> | Сонгосон: <strong>{checkedCount}</strong>
          </span>
          <div style={{ flex: 1 }} />
          <button className="action-btn" style={{ borderColor: '#1677ff', color: '#1677ff' }}
            onClick={() => setShowSearch(s => !s)}>
            {showSearch ? '✕ Хаах' : '+ Ажилтан нэмэх'}
          </button>
          <button className="action-btn" onClick={() => setCheckedIds(allEmps.map(e => e.id))}>Бүгд</button>
          <button className="action-btn" onClick={() => setCheckedIds([])}>Цуцлах</button>
        </div>

        {showSearch && (
          <div style={{ background: '#f9f9fb', border: '1px solid #e8e8e8', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                style={{ flex: 1, padding: '7px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13 }}
                placeholder="Нэрээр хайх..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchEmps()}
                autoFocus
              />
              <button className="approve-btn" onClick={searchEmps}>Хайх</button>
            </div>
            {searching && <div style={{ fontSize: 13, color: '#888' }}>Хайж байна...</div>}
            {searchResults.length > 0 && (
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                <table className="employee-table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Нэр</th><th>Хэлтэс</th><th></th></tr></thead>
                  <tbody>
                    {searchResults.map(emp => (
                      <tr key={emp.id}>
                        <td>{emp.last_name} {emp.name}</td>
                        <td style={{ color: '#888' }}>{emp.dept_name}</td>
                        <td><button className="confirm-btn" style={{ padding: '3px 10px', fontSize: 12 }}
                          onClick={() => addEmp(emp)}>Нэмэх</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          <table className="employee-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox"
                    checked={allEmps.length > 0 && allEmps.every(e => checkedIds.includes(e.id))}
                    onChange={e => setCheckedIds(e.target.checked ? allEmps.map(e => e.id) : [])}
                  />
                </th>
                <th>#</th><th>Нэр</th><th>Хэлтэс</th><th></th>
              </tr>
            </thead>
            <tbody>
              {allEmps.map((emp, i) => (
                <tr key={emp.id} className={!checkedIds.includes(emp.id) ? 'swiped-row' : ''}>
                  <td>
                    <input type="checkbox"
                      checked={checkedIds.includes(emp.id)}
                      onChange={() => setCheckedIds(prev =>
                        prev.includes(emp.id) ? prev.filter(x => x !== emp.id) : [...prev, emp.id]
                      )}
                    />
                  </td>
                  <td style={{ color: '#aaa', fontSize: 12 }}>{i + 1}</td>
                  <td>
                    {emp.isNew && <span style={{ fontSize: 11, color: '#1677ff', marginRight: 4 }}>●</span>}
                    {emp.name}
                  </td>
                  <td style={{ fontSize: 12, color: '#888' }}>{emp.dept_name || '—'}</td>
                  <td>
                    {!checkedIds.includes(emp.id) && (
                      <span style={{ fontSize: 11, color: '#ff4d4f' }}>Хасагдана</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="action-btn" onClick={onClose}>Болих</button>
          {(detail.state === 'draft' || detail.state === 'done') && (
            <button className="approve-btn" onClick={saveLines} disabled={saving}>
              {saving ? 'Хадгалж байна...' : `Хадгалах (${checkedCount} хүн)`}
            </button>
          )}
          {detail.state === 'draft' && (
            <button className="confirm-btn" onClick={doApprove}>Батлах</button>
          )}
          {detail.state === 'done' && (
            <button className="confirm-btn" style={{ background: '#52c41a' }} onClick={doConfirm}>Баталгаажуулах</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  CAMP MANAGER — Захиалга хянах tab
// ══════════════════════════════════════════════
function CampOrdersView({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('draft');
  const [filterDate, setFilterDate] = useState('');
  const [filterMeal, setFilterMeal] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const { toast, showToast, hideToast } = useToast();

  const fetchOrders = useCallback(() => {
    setLoading(true);
    fetch(`${API}/orders`)
      .then(r => r.json())
      .then(data => { setOrders(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const counts = {};
  orders.forEach(o => { counts[o.state] = (counts[o.state] || 0) + 1; });

  const filtered = orders.filter(o =>
    o.state === activeTab &&
    (!filterDate || o.date === filterDate) &&
    (!filterMeal || o.type === filterMeal)
  );

  const approveAll = () => {
    const drafts = filtered.filter(o => o.state === 'draft');
    if (!drafts.length) return;
    if (!window.confirm(`${drafts.length} захиалгыг бүгдийг батлах уу?`)) return;
    Promise.all(drafts.map(o =>
      fetch(`${API}/orders/${o.id}/approve`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })
    )).then(() => { showToast(`${drafts.length} захиалга батлагдлаа ✓`); fetchOrders(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  return (
    <div style={{ marginTop: 16 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      {selectedOrderId && (
        <CampOrderModal
          orderId={selectedOrderId}
          token={token}
          onClose={() => setSelectedOrderId(null)}
          onSaved={() => fetchOrders()}
        />
      )}
      <div className="meal-types" style={{ marginBottom: 12 }}>
        {STATE_TABS.map(t => (
          <button key={t.key} className={activeTab === t.key ? 'active' : ''} onClick={() => setActiveTab(t.key)}>
            {t.label}{counts[t.key] ? ` (${counts[t.key]})` : ''}
          </button>
        ))}
      </div>
      <div className="controls" style={{ marginBottom: 12 }}>
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
      {activeTab === 'draft' && filtered.length > 1 && (
        <div style={{ marginBottom: 10 }}>
          <button className="confirm-btn" onClick={approveAll}>
            Бүгдийг батлах ({filtered.length})
          </button>
        </div>
      )}
      {loading ? <div className="empty-state">Уншиж байна...</div>
        : filtered.length === 0 ? <div className="empty-state">Захиалга байхгүй</div>
        : (
          <table className="employee-table">
            <thead>
              <tr>
                <th>ID</th><th>Огноо</th><th>Хоолны төрөл</th><th>Ажилтны тоо</th><th>Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedOrderId(o.id)}>
                  <td>#{o.id}</td>
                  <td>{o.date}</td>
                  <td>{MEAL_LABELS[o.type] || o.type}</td>
                  <td><span className="badge info">{o.order_line?.length || 0} хүн</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    {o.state === 'draft' && (
                      <button className="approve-btn" style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => setSelectedOrderId(o.id)}>Нээх / Батлах</button>
                    )}
                    {o.state === 'done' && (
                      <button className="confirm-btn" style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => setSelectedOrderId(o.id)}>Нээх / Баталгаажуулах</button>
                    )}
                    {(o.state === 'confirmed' || o.state === 'canceled') && (
                      <button className="action-btn" style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => setSelectedOrderId(o.id)}>Харах</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
export default CampOrdersView;