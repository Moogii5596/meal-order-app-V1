import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../hooks/useToast';
import Toast from '../ui/Toast';
import { API } from '../../shared/constants';

export default function CampFavView({ token }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const fetchUsers = useCallback(() => {
    setLoadingUsers(true);
    fetch(`${API}/camp/users`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setUsers(data); setLoadingUsers(false); })
      .catch(() => setLoadingUsers(false));
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const loadUserData = useCallback((username) => {
    setLoadingData(true);
    fetch(`${API}/camp/user-data/${encodeURIComponent(username)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => { setUserData(data); setLoadingData(false); })
      .catch(() => setLoadingData(false));
  }, [token]);

  const selectUser = (user) => {
    setSelectedUser(user);
    loadUserData(user.username);
    setShowSearch(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  const searchEmps = () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    fetch(`${API}/employees/search?q=${encodeURIComponent(searchQuery)}`)
      .then(r => r.json())
      .then(data => { setSearchResults(data); setSearching(false); })
      .catch(() => setSearching(false));
  };

  const addToFav = (emp) => {
    if (!selectedUser) return;
    const allFavIds = userData?.favorites || [];
    if (allFavIds.includes(emp.id)) { showToast('Аль хэдийн нэмэгдсэн байна', 'error'); return; }
    fetch(`${API}/camp/user-data/${encodeURIComponent(selectedUser.username)}/fav/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ employee_id: emp.id })
    }).then(() => {
      showToast(`${emp.last_name} ${emp.name} нэмэгдлээ`);
      loadUserData(selectedUser.username);
      fetchUsers();
      setSearchResults([]);
      setSearchQuery('');
      setShowSearch(false);
    }).catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  const addToExtra = (emp) => {
    if (!selectedUser) return;
    fetch(`${API}/camp/user-data/${encodeURIComponent(selectedUser.username)}/extra/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        employee_id: emp.id, extra_type: 'rental',
        name: emp.name, last_name: emp.last_name,
        dept_name: emp.dept_name, job_title: emp.job_title, location: emp.location
      })
    }).then(() => {
      showToast(`${emp.last_name} ${emp.name} нэмэлтэд нэмэгдлээ`);
      loadUserData(selectedUser.username);
      fetchUsers();
      setSearchResults([]);
      setSearchQuery('');
      setShowSearch(false);
    }).catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  const removeFromFav = (empId) => {
    fetch(`${API}/camp/user-data/${encodeURIComponent(selectedUser.username)}/fav/remove`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ employee_id: empId })
    }).then(() => { loadUserData(selectedUser.username); fetchUsers(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  const removeFromExtra = (empId) => {
    fetch(`${API}/camp/user-data/${encodeURIComponent(selectedUser.username)}/extra/remove`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ employee_id: empId })
    }).then(() => { loadUserData(selectedUser.username); fetchUsers(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  const clearAll = () => {
    if (!selectedUser) return;
    if (!window.confirm(`${selectedUser.username}-н бүх fav/extra жагсаалтыг цэвэрлэх үү?`)) return;
    fetch(`${API}/camp/user-data/${encodeURIComponent(selectedUser.username)}/clear`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(() => { showToast('Цэвэрлэгдлээ'); loadUserData(selectedUser.username); fetchUsers(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  const ROLE_SHORT = { kitchen_staff: 'Захиалагч', category_manager: 'Хянагч ТН' };

  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Зүүн: хэрэглэгчдийн жагсаалт */}
      <div style={{ width: 230, flexShrink: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: '#444' }}>Ахлахуудын жагсаалт</div>
        {loadingUsers ? <div className="empty-state">Уншиж байна...</div>
          : users.length === 0
            ? <div className="empty-state" style={{ fontSize: 12 }}>Хэрэглэгч бүртгэгдээгүй байна</div>
            : users.map(u => (
              <div key={u.username} onClick={() => selectUser(u)}
                style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                  background: selectedUser?.username === u.username ? '#e6f0ff' : 'white',
                  border: `1.5px solid ${selectedUser?.username === u.username ? '#1677ff' : '#e8e8e8'}`,
                  transition: 'all 0.15s'
                }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{u.username}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {ROLE_SHORT[u.role] || u.role}{u.dept_name ? ` · ${u.dept_name}` : ''}
                </div>
                <div style={{ fontSize: 11, marginTop: 3 }}>
                  <span style={{ color: '#faad14' }}>⭐ {u.fav_count}</span>
                  <span style={{ marginLeft: 8, color: '#1677ff' }}>+ {u.extra_count}</span>
                </div>
              </div>
            ))}
      </div>

      {/* Баруун: сонгосон хэрэглэгчийн fav жагсаалт */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedUser ? (
          <div className="empty-state">← Зүүн талаас ахлах сонгоно уу</div>
        ) : loadingData ? (
          <div className="empty-state">Уншиж байна...</div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15 }}>{selectedUser.username}</strong>
              <span className="role-badge" style={{ fontSize: 11 }}>{ROLE_SHORT[selectedUser.role] || selectedUser.role}</span>
              <div style={{ flex: 1 }} />
              <button className="action-btn" style={{ borderColor: '#1677ff', color: '#1677ff' }}
                onClick={() => setShowSearch(s => !s)}>
                {showSearch ? '✕ Хаах' : '+ Ажилтан нэмэх'}
              </button>
              <button className="action-btn" style={{ borderColor: '#ff4d4f', color: '#ff4d4f' }}
                onClick={clearAll}>↻ Бүгдийг цэвэрлэх</button>
            </div>

            {showSearch && (
              <div style={{ background: '#f9f9fb', border: '1px solid #e8e8e8', borderRadius: 8, padding: 12, marginBottom: 12 }}>
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
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <table className="employee-table" style={{ fontSize: 12 }}>
                      <thead><tr><th>Нэр</th><th>Хэлтэс</th><th>Fav</th><th>Нэмэлт</th></tr></thead>
                      <tbody>
                        {searchResults.map(emp => (
                          <tr key={emp.id}>
                            <td>{emp.last_name} {emp.name}</td>
                            <td style={{ color: '#888' }}>{emp.dept_name}</td>
                            <td><button className="approve-btn" style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => addToFav(emp)}>⭐ Нэмэх</button></td>
                            <td><button className="confirm-btn" style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => addToExtra(emp)}>+ Нэмэлт</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {(userData?.favorites?.length > 0 || userData?.extra_employees?.length > 0) ? (
              <div>
                {userData.favorites?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#faad14', marginBottom: 6 }}>
                      ⭐ Fav жагсаалт ({userData.favorites.length})
                    </div>
                    <table className="employee-table">
                      <thead><tr><th>ID</th><th>Үйлдэл</th></tr></thead>
                      <tbody>
                        {userData.favorites.map(id => (
                          <tr key={id}>
                            <td style={{ color: '#555' }}>#{id}</td>
                            <td>
                              <button className="action-btn" style={{ borderColor: '#ff4d4f', color: '#ff4d4f', fontSize: 12 }}
                                onClick={() => removeFromFav(id)}>Хасах</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {userData.extra_employees?.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1677ff', marginBottom: 6 }}>
                      + Нэмэлт ажилтнууд ({userData.extra_employees.length})
                    </div>
                    <table className="employee-table">
                      <thead><tr><th>Нэр</th><th>Хэлтэс</th><th>Төрөл</th><th>Үйлдэл</th></tr></thead>
                      <tbody>
                        {userData.extra_employees.map(emp => (
                          <tr key={emp.id}>
                            <td>{emp.last_name} {emp.name}</td>
                            <td style={{ fontSize: 12, color: '#888' }}>{emp.dept_name}</td>
                            <td>
                              <span style={{ fontSize: 11, color: emp.extra_type === 'rental' ? '#52c41a' : '#faad14' }}>
                                {emp.extra_type === 'rental' ? 'Түрээсийн' : 'Сунасан'}
                              </span>
                            </td>
                            <td>
                              <button className="action-btn" style={{ borderColor: '#ff4d4f', color: '#ff4d4f', fontSize: 12 }}
                                onClick={() => removeFromExtra(emp.id)}>Хасах</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">Энэ хэрэглэгчийн fav жагсаалт хоосон байна</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}