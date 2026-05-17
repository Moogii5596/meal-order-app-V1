import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/ui/Toast';
import { MEAL_LABELS, STATE_LABELS } from '../../constants';
import { approveOrder, confirmOrder, fetchOrderDetail, updateOrderLines } from '../../services/orders';
import { searchEmployees } from '../../services/employees';
import { useReconciliation } from '../reconciliation/useReconciliation';
import ReconciliationSummary from '../reconciliation/ReconciliationSummary';
import GroupPickerModal from '../groups/GroupPickerModal';

const MEAL_ICONS = { breakfast: '🍳', lunch: '☀️', dinner: '🍽️', night: '🌙' };

function CampOrderModal({ orderId, onClose, onSaved }) {
  const [detail, setDetail]           = useState(null);
  const [checkedIds, setCheckedIds]   = useState([]);
  const [addedEmps, setAddedEmps]     = useState([]);
  const [showSearch, setShowSearch]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  // ── Reconciliation ────────────────────────────────────────────────────────
  // Merges saved + locally-added employees, runs all mismatch checks.
  const {
    allEmps,
    ratio,
    summary,
  } = useReconciliation(
    detail?.employees ?? [],
    addedEmps,
    checkedIds,
  );

  // ── Load order detail ─────────────────────────────────────────────────────

  const loadDetail = useCallback(() => {
    fetchOrderDetail(orderId)
      .then((data) => {
        setDetail(data);
        setCheckedIds(data.employees.map((e) => e.id));
        setAddedEmps([]);
      })
      .catch(() => showToast('Дэлгэрэнгүй ачаалж чадсангүй', 'error'));
  }, [orderId, showToast]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // ── Live search: trigger 400 ms after user stops typing ──────────────────

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      searchEmployees(searchQuery)
        .then(setSearchResults)
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Apply an entire group of employees at once ───────────────────────────

  const applyGroup = (employeesToAdd) => {
    const newEntries = employeesToAdd
      .filter((e) => !allEmps.some((x) => x.id === e.id))
      .map((e) => ({ id: e.id, name: e.name, dept_name: e.dept_name || '', isNew: true, is_swiped: false }));
    if (newEntries.length === 0) return;
    setAddedEmps((prev) => [...prev, ...newEntries]);
    setCheckedIds((prev) => [...prev, ...newEntries.map((e) => e.id)]);
    showToast(`${newEntries.length} ажилтан бүлгээс нэмэгдлээ ✓`);
  };

  // ── Add employee from search ──────────────────────────────────────────────

  const addEmployee = (emp) => {
    if (allEmps.some((e) => e.id === emp.id)) return;
    setAddedEmps((prev) => [
      ...prev,
      {
        id:        emp.id,
        name:      `${emp.last_name || ''} ${emp.name}`.trim(),
        dept_name: emp.dept_name || '',
        isNew:     true,
        is_swiped: false,
      },
    ]);
    setCheckedIds((prev) => [...prev, emp.id]);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };

  // ── Save / approve / confirm ──────────────────────────────────────────────

  const handleSaveLines = () => {
    setSaving(true);
    updateOrderLines(orderId, checkedIds)
      .then(() => { showToast('Захиалга хадгалагдлаа ✓'); loadDetail(); onSaved(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'))
      .finally(() => setSaving(false));
  };

  const handleApprove = () => {
    approveOrder(orderId)
      .then(() => { showToast('Захиалга батлагдлаа ✓'); onSaved(); onClose(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  const handleConfirm = () => {
    confirmOrder(orderId)
      .then(() => { showToast('Захиалга баталгаажлаа ✓'); onSaved(); onClose(); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!detail) {
    return (
      <div className="modal-overlay">
        <div className="modal-box">
          <div className="empty-state">Уншиж байна...</div>
        </div>
      </div>
    );
  }

  const stateBadgeClass = detail.state === 'draft' ? 'warn'
    : detail.state === 'done' ? 'success' : 'info';

  // Map ratio.status → CSS fill class used by the swipe bar
  const swipeFillCls = ratio.status === 'empty' ? 'fill-none' : `fill-${ratio.status}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="modal-box camp-order-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal-header">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15 }}>
                {detail.name || `Захиалга #${detail.id}`}
              </strong>
              {detail.name && (
                <span style={{ fontSize: 12, color: '#aaa' }}>#{detail.id}</span>
              )}
              <span className={`badge ${stateBadgeClass}`}>
                {STATE_LABELS[detail.state] || detail.state}
              </span>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#666', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>📅 {detail.date}</span>
              <span>{MEAL_ICONS[detail.type] || '🍽'} {MEAL_LABELS[detail.type] || detail.type}</span>
              {detail.department_name && <span>🏢 {detail.department_name}</span>}
              {(detail.submitted_by || detail.created_by) && (
                <span>👤 {detail.submitted_by || detail.created_by}</span>
              )}
              {(detail.order_date || detail.create_date) && (
                <span style={{ color: '#aaa' }}>
                  🕐 {String(detail.order_date || detail.create_date).slice(0, 16)}
                </span>
              )}
            </div>

            {/* Swipe progress bar — driven by useReconciliation */}
            {summary.total > 0 && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="swipe-bar-wrap modal-swipe-bar" style={{ flex: 1, maxWidth: 220 }}>
                  <div className="swipe-bar-track">
                    <div
                      className={`swipe-bar-fill ${swipeFillCls}`}
                      style={{ width: `${ratio.pct}%` }}
                    />
                  </div>
                  <span className="swipe-bar-label">
                    Карт уншуулсан: {summary.swiped}/{summary.total} ({ratio.pct}%)
                  </span>
                </div>
              </div>
            )}

            {detail.note && (
              <div style={{
                marginTop: 6, fontSize: 12, color: '#555',
                background: '#fffbe6', border: '1px solid #ffe58f',
                borderRadius: 6, padding: '4px 10px',
              }}>
                📝 {detail.note}
              </div>
            )}
          </div>
          <button className="action-btn" onClick={onClose}>✕</button>
        </div>

        {/* ── Reconciliation summary panel ── */}
        <ReconciliationSummary summary={summary} />

        {/* ── Group picker modal (rendered at top of modal so z-index stacks correctly) ── */}
        {showGroupPicker && (
          <GroupPickerModal
            existingEmployees={allEmps}
            onApply={applyGroup}
            onClose={() => setShowGroupPicker(false)}
          />
        )}

        {/* ── Toolbar ── */}
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#555' }}>
            Нийт: <strong>{allEmps.length}</strong>
            {' · '}Сонгосон: <strong>{checkedIds.length}</strong>
          </span>
          <div style={{ flex: 1 }} />
          <button
            className="action-btn"
            style={{ borderColor: '#722ed1', color: '#722ed1' }}
            onClick={() => setShowGroupPicker(true)}
          >
            👥 Бүлгээс
          </button>
          <button
            className="action-btn"
            style={{ borderColor: '#1677ff', color: '#1677ff' }}
            onClick={() => { setShowSearch((s) => !s); setSearchQuery(''); setSearchResults([]); }}
          >
            {showSearch ? '✕ Хаах' : '+ Ажилтан нэмэх'}
          </button>
          <button className="action-btn" onClick={() => setCheckedIds(allEmps.map((e) => e.id))}>
            Бүгд
          </button>
          <button className="action-btn" onClick={() => setCheckedIds([])}>
            Цуцлах
          </button>
        </div>

        {/* ── Live search panel ── */}
        {showSearch && (
          <div style={{
            background: '#f9f9fb', border: '1px solid #e8e8e8',
            borderRadius: 8, padding: 12, marginBottom: 10,
          }}>
            <input
              style={{
                width: '100%', padding: '8px 12px', boxSizing: 'border-box',
                border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14,
              }}
              placeholder="Нэрээр хайх... (автоматаар хайна)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />

            {searching && (
              <div style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Хайж байна...</div>
            )}

            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <div style={{ fontSize: 13, color: '#aaa', marginTop: 8 }}>Олдсонгүй</div>
            )}

            {searchResults.length > 0 && (
              <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 8 }} className="table-scroll">
                <table className="employee-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Нэр</th>
                      <th>Хэлтэс</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((emp) => {
                      const alreadyAdded = allEmps.some((e) => e.id === emp.id);
                      return (
                        <tr key={emp.id} style={{ opacity: alreadyAdded ? 0.4 : 1 }}>
                          <td>{emp.last_name} {emp.name}</td>
                          <td style={{ color: '#888' }}>{emp.dept_name}</td>
                          <td>
                            <button
                              className="confirm-btn"
                              style={{ padding: '3px 10px', fontSize: 12 }}
                              disabled={alreadyAdded}
                              onClick={() => addEmployee(emp)}
                            >
                              {alreadyAdded ? '✓' : 'Нэмэх'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Employee list ── */}
        <div style={{ maxHeight: 340, overflowY: 'auto' }} className="table-scroll">
          <table className="employee-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allEmps.length > 0 && allEmps.every((e) => checkedIds.includes(e.id))}
                    onChange={(e) => setCheckedIds(e.target.checked ? allEmps.map((e) => e.id) : [])}
                  />
                </th>
                <th>#</th>
                <th>Нэр</th>
                <th>Хэлтэс</th>
                <th>Карт уншуулсан</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {allEmps.map((emp, i) => {
                const isChecked = checkedIds.includes(emp.id);
                const isDupe    = summary.duplicates.some((d) => d.id === emp.id);
                const rowBg = !isChecked
                  ? '#fafafa'
                  : isDupe
                    ? '#faf0ff'
                    : emp.is_swiped && !emp.isNew
                      ? '#f6ffed'
                      : undefined;
                return (
                  <tr key={`${emp.id}-${i}`} style={{ background: rowBg }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setCheckedIds((prev) =>
                            prev.includes(emp.id)
                              ? prev.filter((x) => x !== emp.id)
                              : [...prev, emp.id],
                          )
                        }
                      />
                    </td>
                    <td style={{ color: '#aaa', fontSize: 12 }}>{i + 1}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {emp.isNew && (
                          <span style={{ fontSize: 10, color: '#1677ff', fontWeight: 700 }}>NEW</span>
                        )}
                        {isDupe && (
                          <span style={{ fontSize: 10, color: '#722ed1', fontWeight: 700 }}>DUP</span>
                        )}
                        <span style={{ color: isChecked ? '#1a1a2e' : '#bbb', fontWeight: isChecked ? 500 : 400 }}>
                          {emp.name}
                        </span>
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#888' }}>
                      {emp.dept_name || <span style={{ color: '#ddd' }}>—</span>}
                    </td>
                    {/* Карт уншуулсан column */}
                    <td>
                      {emp.isNew ? (
                        <span style={{ fontSize: 11, color: '#ccc' }}>—</span>
                      ) : emp.is_swiped ? (
                        <span className="badge success">✓ Уншуулсан</span>
                      ) : (
                        <span className="badge error" style={{ background: '#fff1f0', color: '#ff4d4f', border: '1px solid #ffccc7' }}>
                          ✗ Уншаагүй
                        </span>
                      )}
                    </td>
                    <td>
                      {!isChecked && (
                        <span style={{ fontSize: 11, color: '#ff4d4f', fontWeight: 600 }}>Хасагдана</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Action buttons ── */}
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="action-btn" onClick={onClose}>Болих</button>
          {(detail.state === 'draft' || detail.state === 'done') && (
            <button className="approve-btn" onClick={handleSaveLines} disabled={saving}>
              {saving ? 'Хадгалж байна...' : `Хадгалах (${checkedIds.length} хүн)`}
            </button>
          )}
          {detail.state === 'draft' && (
            <button className="confirm-btn" onClick={handleApprove}>Батлах</button>
          )}
          {detail.state === 'done' && (
            <button className="confirm-btn" style={{ background: '#52c41a' }} onClick={handleConfirm}>
              Баталгаажуулах
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CampOrderModal;
