/**
 * CampManagedOrdersView.jsx — Phase 1.5 Hardened
 *
 * Hardening features added in Phase 1.5:
 *   1. Duplicate draft prevention — warns before creating a second draft
 *      for the same (source_user, date, meal_type).
 *   2. Employee snapshot — sends full [{id, name, last_name, dept_name, job_title}]
 *      to the backend for historical accuracy.
 *   3. ERP failure handling — shows 🔴 failed state with error message.
 *   4. Managed orders history panel — shows recent submissions below the editor.
 *   5. Safer status display — draft_local / submitted / failed badges.
 *   6. Better loading/error states throughout.
 *
 * Architecture: existing Phase 1 structure preserved; only additive changes.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import Toast        from '../../../components/ui/Toast';
import { useToast } from '../../../hooks/useToast';
import {
  DEFAULT_MEAL,
  MEAL_LABELS,
  MEAL_SHORT_LABELS,
  ROLE_SHORT_LABELS,
} from '../../../constants';
import {
  createManagedOrder,
  fetchCampUsers,
  fetchManagedOrders,
  fetchUserData,
} from '../../../services/camp';
import {
  fetchEmployeesByIds,
  searchEmployees,
} from '../../../services/employees';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('mn-MN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_META = {
  draft_local: { icon: '🟡', label: 'Хадгалагдсан',    bg: '#fffbe6', color: '#d48806', border: '#ffe58f' },
  submitted:   { icon: '🟢', label: 'Илгээгдсэн',      bg: '#f6ffed', color: '#389e0d', border: '#b7eb8f' },
  failed:      { icon: '🔴', label: 'Алдаа гарсан',    bg: '#fff1f0', color: '#cf1322', border: '#ffa39e' },
};

function StatusBadge({ status, style = {} }) {
  const m = STATUS_META[status] || { icon: '⚪', label: status, bg: '#fafafa', color: '#888', border: '#d9d9d9' };
  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          4,
      padding:      '2px 9px',
      borderRadius: 20,
      fontSize:     11,
      fontWeight:   700,
      background:   m.bg,
      color:        m.color,
      border:       `1px solid ${m.border}`,
      whiteSpace:   'nowrap',
      ...style,
    }}>
      {m.icon} {m.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DIFF BADGE
// ─────────────────────────────────────────────────────────────────────────────
function DiffBadge({ label, value, color }) {
  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          4,
      padding:      '3px 10px',
      borderRadius: 20,
      background:   color + '18',
      border:       `1px solid ${color}33`,
      fontSize:     12,
      fontWeight:   600,
      color,
      whiteSpace:   'nowrap',
    }}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DUPLICATE WARNING BANNER
// ─────────────────────────────────────────────────────────────────────────────
function DuplicateWarning({ conflict, onDismiss }) {
  return (
    <div style={{
      background:   '#fffbe6',
      border:       '1.5px solid #faad14',
      borderRadius: 8,
      padding:      '10px 14px',
      marginBottom: 12,
      display:      'flex',
      alignItems:   'flex-start',
      gap:          10,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#854d0e', marginBottom: 3 }}>
          Давхардсан захиалга
        </div>
        <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
          Энэ ахлахын тухайн хоолны draft аль хэдийн үүссэн байна.
          {conflict.odoo_order_id && (
            <> ERP захиалгын дугаар: <strong>#{conflict.odoo_order_id}</strong>.</>
          )}
          {' '}Статус: <StatusBadge status={conflict.existing_status} style={{ fontSize: 10, padding: '1px 7px' }} />
        </div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 16, color: '#aaa', flexShrink: 0, padding: 2,
        }}
        title="Хаах"
      >✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERP FAILURE BANNER
// ─────────────────────────────────────────────────────────────────────────────
function ErpFailureBanner({ message, managedOrderId, onDismiss }) {
  return (
    <div style={{
      background:   '#fff1f0',
      border:       '1.5px solid #ff4d4f',
      borderRadius: 8,
      padding:      '10px 14px',
      marginBottom: 12,
      display:      'flex',
      alignItems:   'flex-start',
      gap:          10,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🔴</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#7f1d1d', marginBottom: 3 }}>
          ERP-д илгээхэд алдаа гарлаа
          {managedOrderId && <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 6 }}>(log #{managedOrderId})</span>}
        </div>
        <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.5, wordBreak: 'break-word' }}>
          {message || 'Тодорхойгүй алдаа. Системийн админд хандана уу.'}
        </div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 16, color: '#aaa', flexShrink: 0, padding: 2,
        }}
        title="Хаах"
      >✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE ROW (right panel selector)
// ─────────────────────────────────────────────────────────────────────────────
const EmployeeRow = React.memo(function EmployeeRow({
  emp, isSelected, isOriginalFav, onToggle,
}) {
  const tagStyle = isOriginalFav
    ? { background: '#fffbe6', color: '#d48806', border: '1px solid #ffe58f' }
    : { background: '#e6f7ff', color: '#0958d9', border: '1px solid #91caff' };
  const tagLabel = isOriginalFav ? '⭐ FAV' : '+ Нэмэгдсэн';

  return (
    <div
      onClick={() => onToggle(emp.id)}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          10,
        padding:      '9px 12px',
        cursor:       'pointer',
        borderBottom: '1px solid #f0f0f0',
        background:   isSelected ? '#f6ffed' : 'white',
        transition:   'background 0.1s',
      }}
    >
      {/* Checkbox */}
      <div style={{
        width:          18,
        height:         18,
        borderRadius:   4,
        border:         isSelected ? '2px solid #52c41a' : '2px solid #d9d9d9',
        background:     isSelected ? '#52c41a' : 'white',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        transition:     'all 0.15s',
      }}>
        {isSelected && (
          <svg viewBox="0 0 10 8" style={{ width: 10, height: 8 }} fill="none"
            stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4l2.5 2.5L9 1" />
          </svg>
        )}
      </div>

      {/* Name + dept */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', lineHeight: '1.3' }}>
          {emp.last_name} {emp.name}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
          {emp.dept_name || '—'}{emp.job_title ? ` · ${emp.job_title}` : ''}
        </div>
      </div>

      {/* Tag */}
      <span style={{
        fontSize:     10,
        fontWeight:   700,
        padding:      '2px 7px',
        borderRadius: 10,
        flexShrink:   0,
        ...tagStyle,
      }}>
        {tagLabel}
      </span>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH RESULT ROW
// ─────────────────────────────────────────────────────────────────────────────
function SearchResultRow({ emp, alreadyAdded, onAdd }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          8,
      padding:      '7px 12px',
      borderBottom: '1px solid #f0f0f0',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
          {emp.last_name} {emp.name}
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>
          {emp.dept_name || '—'}
        </div>
      </div>
      <button
        onClick={() => !alreadyAdded && onAdd(emp)}
        disabled={alreadyAdded}
        style={{
          padding:      '4px 12px',
          borderRadius: 6,
          border:       'none',
          cursor:       alreadyAdded ? 'default' : 'pointer',
          fontSize:     12,
          fontWeight:   600,
          background:   alreadyAdded ? '#f0f0f0' : '#1677ff',
          color:        alreadyAdded ? '#aaa' : 'white',
          flexShrink:   0,
        }}
      >
        {alreadyAdded ? '✓ Нэмэгдсэн' : '+ Нэмэх'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGED ORDERS HISTORY TABLE
// ─────────────────────────────────────────────────────────────────────────────
function ManagedOrdersHistory({ sourceUsername, refreshTrigger }) {
  const [orders, setOrders]     = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const PAGE_SIZE               = 10;

  const load = useCallback(() => {
    setLoading(true);
    fetchManagedOrders({ sourceUsername, page, pageSize: PAGE_SIZE })
      .then((res) => { setOrders(res.items || []); setTotal(res.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sourceUsername, page]);

  useEffect(() => { setPage(1); }, [sourceUsername, refreshTrigger]);
  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading && orders.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 16, color: '#aaa', fontSize: 12 }}>
        Түүх ачаалж байна…
      </div>
    );
  }

  if (!loading && orders.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 16, color: '#ccc', fontSize: 12 }}>
        Захиалгын түүх байхгүй байна
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width:           '100%',
          borderCollapse:  'collapse',
          fontSize:        12,
        }}>
          <thead>
            <tr style={{ background: '#fafafa', textAlign: 'left' }}>
              {['#', 'Ахлах', 'Хоол', 'Огноо', 'Ажилтан', 'ERP #', 'Статус', 'Үүссэн'].map((h) => (
                <th key={h} style={{ padding: '7px 10px', fontWeight: 700, color: '#555', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                <td style={{ padding: '7px 10px', color: '#aaa' }}>{o.id}</td>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{o.source_username}</td>
                <td style={{ padding: '7px 10px' }}>{MEAL_SHORT_LABELS[o.meal_type] || o.meal_type}</td>
                <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{o.order_date}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                  <span style={{
                    display:      'inline-block',
                    minWidth:     28,
                    textAlign:    'center',
                    background:   '#f0f5ff',
                    color:        '#1677ff',
                    borderRadius: 10,
                    fontWeight:   700,
                    padding:      '1px 7px',
                  }}>
                    {o.employee_count ?? '—'}
                  </span>
                </td>
                <td style={{ padding: '7px 10px' }}>
                  {o.odoo_order_id
                    ? <span style={{ fontWeight: 600, color: '#389e0d' }}>#{o.odoo_order_id}</span>
                    : <span style={{ color: '#ccc' }}>—</span>}
                </td>
                <td style={{ padding: '7px 10px' }}>
                  <StatusBadge status={o.status} />
                  {o.status === 'failed' && o.error_message && (
                    <div style={{ fontSize: 10, color: '#cf1322', marginTop: 3, maxWidth: 200, wordBreak: 'break-word' }}>
                      {o.error_message.slice(0, 80)}{o.error_message.length > 80 ? '…' : ''}
                    </div>
                  )}
                </td>
                <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: '#888' }}>
                  {fmtDate(o.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#888' }}>
            {total} захиалга · {page}/{totalPages} хуудас
          </span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid #d9d9d9', background: 'white', cursor: page === 1 ? 'default' : 'pointer', fontSize: 12 }}
          >‹</button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid #d9d9d9', background: 'white', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 12 }}
          >›</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function CampManagedOrdersView() {
  // ── Users (left panel) ─────────────────────────────────────────────────────
  const [users, setUsers]               = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);

  // ── FAV/Extra loading ──────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(false);

  // ── Employee selection state ───────────────────────────────────────────────
  const [originalFavIds, setOriginalFavIds] = useState([]);   // immutable after load
  const [allEmployees, setAllEmployees]     = useState([]);   // full employee objects
  const [selectedIds, setSelectedIds]       = useState([]);   // will go into order

  // ── Controls (top bar) ─────────────────────────────────────────────────────
  const [selectedMeal, setSelectedMeal] = useState(DEFAULT_MEAL);
  const [selectedDate, setSelectedDate] = useState(todayIso);

  // ── Search ─────────────────────────────────────────────────────────────────
  const [showSearch, setShowSearch]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const searchInputRef                    = useRef(null);

  // ── Submission state ───────────────────────────────────────────────────────
  const [submitting, setSubmitting]     = useState(false);
  const [conflict, setConflict]         = useState(null);   // duplicate_draft response
  const [erpFailure, setErpFailure]     = useState(null);   // erp_failed response
  const [historyRefresh, setHistoryRefresh] = useState(0);  // bump to reload history

  const { toast, showToast, hideToast } = useToast();

  // ── Load users ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingUsers(true);
    fetchCampUsers()
      .then(setUsers)
      .catch(() => showToast('Хэрэглэгчдийн жагсаалт ачаалахад алдаа гарлаа', 'error'))
      .finally(() => setLoadingUsers(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Select a kitchen staff user ─────────────────────────────────────────────
  const selectUser = useCallback(async (user) => {
    setSelectedUser(user);
    setLoadingData(true);
    setOriginalFavIds([]);
    setAllEmployees([]);
    setSelectedIds([]);
    setShowSearch(false);
    setSearchResults([]);
    setSearchQuery('');
    setConflict(null);
    setErpFailure(null);

    try {
      const data     = await fetchUserData(user.username);
      const favIds   = data.favorites       || [];
      const extras   = data.extra_employees || [];

      // Resolve fav IDs → full employee objects
      const resolved = favIds.length > 0 ? await fetchEmployeesByIds(favIds) : [];

      // Merge: resolved favs first, then extras (dedup by id)
      const seen     = new Set();
      const combined = [];
      for (const emp of resolved) {
        if (!seen.has(emp.id)) { seen.add(emp.id); combined.push(emp); }
      }
      for (const emp of extras) {
        if (!seen.has(emp.id)) {
          seen.add(emp.id);
          combined.push({
            id:        emp.id,
            name:      emp.name      || '',
            last_name: emp.last_name || '',
            dept_name: emp.dept_name || '',
            job_title: emp.job_title || '',
            location:  emp.location  || '',
            is_swiped: false,
          });
        }
      }

      setOriginalFavIds(favIds);
      setAllEmployees(combined);
      setSelectedIds(combined.map((e) => e.id));   // default: select all
    } catch {
      showToast('Хэрэглэгчийн мэдээлэл ачаалахад алдаа гарлаа', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [showToast]);

  // ── Employee toggle ─────────────────────────────────────────────────────────
  const handleToggle = useCallback((empId) => {
    setSelectedIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
    );
  }, []);

  // ── Select / Deselect all ───────────────────────────────────────────────────
  const allSelected = useMemo(
    () => allEmployees.length > 0 && allEmployees.every((e) => selectedIds.includes(e.id)),
    [allEmployees, selectedIds],
  );
  const handleSelectAll = useCallback(() => {
    setSelectedIds(allSelected ? [] : allEmployees.map((e) => e.id));
  }, [allSelected, allEmployees]);

  // ── Search ──────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    searchEmployees(searchQuery)
      .then(setSearchResults)
      .catch(() => showToast('Хайлт амжилтгүй боллоо', 'error'))
      .finally(() => setSearching(false));
  }, [searchQuery, showToast]);

  const handleAddEmployee = useCallback((emp) => {
    setAllEmployees((prev) => {
      if (prev.find((e) => e.id === emp.id)) return prev;
      return [...prev, {
        id:        emp.id,
        name:      emp.name      || '',
        last_name: emp.last_name || '',
        dept_name: emp.dept_name || '',
        job_title: emp.job_title || '',
        location:  emp.location  || '',
        is_swiped: false,
      }];
    });
    setSelectedIds((prev) => prev.includes(emp.id) ? prev : [...prev, emp.id]);
  }, []);

  // Auto-focus search input
  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [showSearch]);

  // ── Diff ────────────────────────────────────────────────────────────────────
  const diff = useMemo(() => {
    const origSet    = new Set(originalFavIds);
    const currentSet = new Set(selectedIds);
    return {
      originalCount: originalFavIds.length,
      currentCount:  selectedIds.length,
      added:   selectedIds.filter((id) => !origSet.has(id)).length,
      removed: originalFavIds.filter((id) => !currentSet.has(id)).length,
    };
  }, [originalFavIds, selectedIds]);

  // ── Build snapshot from current selection ───────────────────────────────────
  const buildSnapshot = useCallback(() => {
    const selectedSet = new Set(selectedIds);
    return allEmployees
      .filter((e) => selectedSet.has(e.id))
      .map((e) => ({
        id:        e.id,
        name:      e.name      || '',
        last_name: e.last_name || '',
        dept_name: e.dept_name || '',
        job_title: e.job_title || '',
      }));
  }, [allEmployees, selectedIds]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!selectedUser || selectedIds.length === 0 || submitting) return;
    setConflict(null);
    setErpFailure(null);
    setSubmitting(true);

    try {
      const snapshot = buildSnapshot();
      const result   = await createManagedOrder(
        selectedUser.username,
        selectedMeal,
        selectedDate,
        selectedIds,
        snapshot,
      );

      if (result.success === true) {
        showToast(`✓ Захиалга амжилттай илгээгдлээ! ERP #${result.odoo_order_id}`);
        setHistoryRefresh((n) => n + 1);
        fetchCampUsers().then(setUsers).catch(() => {});
      } else if (result.reason === 'duplicate_draft') {
        setConflict(result);
      } else if (result.reason === 'erp_failed') {
        setErpFailure(result);
        setHistoryRefresh((n) => n + 1);   // show the failed row in history
      } else {
        showToast('Тодорхойгүй хариу хүлээн авлаа', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Захиалга илгээхэд алдаа гарлаа', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [selectedUser, selectedIds, selectedMeal, selectedDate, submitting, buildSnapshot, showToast]);

  // ── Sorted employee list ────────────────────────────────────────────────────
  const sortedEmployees = useMemo(() => {
    const origSet = new Set(originalFavIds);
    return [...allEmployees].sort((a, b) => {
      const aFav = origSet.has(a.id), bFav = origSet.has(b.id);
      if (aFav !== bFav) return aFav ? -1 : 1;
      return (a.last_name || '').localeCompare(b.last_name || '', 'mn');
    });
  }, [allEmployees, originalFavIds]);

  const addedIds = useMemo(() => new Set(allEmployees.map((e) => e.id)), [allEmployees]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* ── TOP BAR ── */}
      <div style={{
        display:      'flex',
        gap:          10,
        alignItems:   'center',
        flexWrap:     'wrap',
        marginBottom: 12,
        padding:      '10px 14px',
        background:   'white',
        borderRadius: 10,
        boxShadow:    '0 1px 4px rgba(0,0,0,0.07)',
      }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#555', flexShrink: 0 }}>
          📅 Огноо:
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); setConflict(null); setErpFailure(null); }}
          style={{ padding: '6px 10px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13 }}
        />

        <label style={{ fontSize: 12, fontWeight: 600, color: '#555', flexShrink: 0, marginLeft: 8 }}>
          🍽 Хоолны төрөл:
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(MEAL_SHORT_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setSelectedMeal(key); setConflict(null); setErpFailure(null); }}
              style={{
                padding:      '5px 14px',
                border:       selectedMeal === key ? '1px solid #1677ff' : '1px solid #d9d9d9',
                borderRadius: 20,
                background:   selectedMeal === key ? '#1677ff' : 'white',
                color:        selectedMeal === key ? 'white' : '#555',
                fontSize:     12,
                fontWeight:   600,
                cursor:       'pointer',
                transition:   'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888', flexShrink: 0 }}>
          {MEAL_LABELS[selectedMeal]}
        </span>
      </div>

      {/* ── TWO-COLUMN LAYOUT ── */}
      <div className="camp-fav-layout">

        {/* ── LEFT: kitchen staff list ── */}
        <div className="camp-fav-sidebar">
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13, color: '#333' }}>
            👤 Ахлахуудын жагсаалт
          </div>

          {loadingUsers ? (
            <div className="empty-state" style={{ padding: 20, fontSize: 12 }}>Уншиж байна…</div>
          ) : users.length === 0 ? (
            <div className="empty-state" style={{ padding: 20, fontSize: 12 }}>
              Хэрэглэгч бүртгэгдээгүй байна
            </div>
          ) : (
            users.map((u) => {
              const isActive = selectedUser?.username === u.username;
              return (
                <div
                  key={u.username}
                  onClick={() => !loadingData && selectUser(u)}
                  style={{
                    padding:      '10px 12px',
                    borderRadius: 8,
                    cursor:       loadingData ? 'wait' : 'pointer',
                    marginBottom: 6,
                    background:   isActive ? '#e6f0ff' : 'white',
                    border:       `1.5px solid ${isActive ? '#1677ff' : '#e8e8e8'}`,
                    transition:   'all 0.15s',
                    opacity:      loadingData && !isActive ? 0.6 : 1,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{u.username}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {ROLE_SHORT_LABELS[u.role] || u.role}
                    {u.dept_name ? ` · ${u.dept_name}` : ''}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 3 }}>
                    <span style={{ color: '#faad14' }}>⭐ {u.fav_count}</span>
                    <span style={{ marginLeft: 8, color: '#1677ff' }}>+ {u.extra_count}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── RIGHT: editor + history ── */}
        <div className="camp-fav-content">
          {!selectedUser ? (
            <div className="empty-state">← Зүүн талаас ахлах сонгоно уу</div>
          ) : loadingData ? (
            <div className="empty-state">Ачаалж байна…</div>
          ) : (
            <>
              {/* ── Banners ── */}
              {conflict && (
                <DuplicateWarning
                  conflict={conflict}
                  onDismiss={() => setConflict(null)}
                />
              )}
              {erpFailure && (
                <ErpFailureBanner
                  message={erpFailure.message}
                  managedOrderId={erpFailure.managed_order_id}
                  onDismiss={() => setErpFailure(null)}
                />
              )}

              {/* ── Header: user info + diff ── */}
              <div style={{
                display:      'flex',
                flexWrap:     'wrap',
                gap:          8,
                alignItems:   'center',
                marginBottom: 12,
              }}>
                <strong style={{ fontSize: 15 }}>{selectedUser.username}</strong>
                <span style={{
                  fontSize:     11, fontWeight: 600, padding: '2px 8px',
                  borderRadius: 10, background: '#f0f5ff', color: '#1677ff', border: '1px solid #91caff',
                }}>
                  {ROLE_SHORT_LABELS[selectedUser.role] || selectedUser.role}
                </span>

                {/* Diff badges */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                  <DiffBadge label="Original FAV"     value={diff.originalCount} color="#d48806" />
                  <DiffBadge label="Одоогийн сонголт" value={diff.currentCount}  color="#1677ff" />
                  {diff.added   > 0 && <DiffBadge label="Нэмэгдсэн" value={`+${diff.added}`}   color="#52c41a" />}
                  {diff.removed > 0 && <DiffBadge label="Хасагдсан" value={`-${diff.removed}`} color="#ff4d4f" />}
                </div>

                {/* Add employee toggle */}
                <button
                  onClick={() => setShowSearch((s) => !s)}
                  style={{
                    padding:      '6px 14px',
                    borderRadius: 7,
                    border:       '1.5px solid #1677ff',
                    background:   showSearch ? '#1677ff' : 'white',
                    color:        showSearch ? 'white' : '#1677ff',
                    fontSize:     12,
                    fontWeight:   600,
                    cursor:       'pointer',
                    flexShrink:   0,
                  }}
                >
                  {showSearch ? '✕ Хаах' : '+ Ажилтан нэмэх'}
                </button>
              </div>

              {/* ── Search panel ── */}
              {showSearch && (
                <div style={{
                  background:   '#f9f9fb',
                  border:       '1px solid #e8e8e8',
                  borderRadius: 8,
                  padding:      12,
                  marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      ref={searchInputRef}
                      style={{ flex: 1, padding: '7px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13 }}
                      placeholder="Нэрээр хайх…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching || !searchQuery.trim()}
                      style={{
                        padding:      '7px 16px',
                        borderRadius: 6,
                        border:       'none',
                        background:   (searching || !searchQuery.trim()) ? '#f0f0f0' : '#1677ff',
                        color:        (searching || !searchQuery.trim()) ? '#aaa' : 'white',
                        fontSize:     13,
                        fontWeight:   600,
                        cursor:       (searching || !searchQuery.trim()) ? 'default' : 'pointer',
                      }}
                    >
                      {searching ? '…' : 'Хайх'}
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div style={{
                      maxHeight: 220, overflowY: 'auto',
                      border: '1px solid #e8e8e8', borderRadius: 6, background: 'white',
                    }}>
                      {searchResults.map((emp) => (
                        <SearchResultRow
                          key={emp.id}
                          emp={emp}
                          alreadyAdded={addedIds.has(emp.id)}
                          onAdd={handleAddEmployee}
                        />
                      ))}
                    </div>
                  )}

                  {searchResults.length === 0 && !searching && searchQuery.trim() && (
                    <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: 8 }}>
                      Хайлтын үр дүн олдсонгүй
                    </div>
                  )}
                </div>
              )}

              {/* ── Employee selector ── */}
              {allEmployees.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  Энэ хэрэглэгчийн FAV жагсаалт хоосон байна
                </div>
              ) : (
                <>
                  {/* Select-all bar */}
                  <div style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    padding:        '6px 12px',
                    background:     '#fafafa',
                    border:         '1px solid #f0f0f0',
                    borderRadius:   '8px 8px 0 0',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#555' }}>
                      <input type="checkbox" checked={allSelected} onChange={handleSelectAll} style={{ cursor: 'pointer' }} />
                      Бүгдийг сонгох
                    </label>
                    <span style={{ fontSize: 12, color: '#888' }}>{allEmployees.length} ажилтан</span>
                  </div>

                  {/* Employee rows */}
                  <div style={{
                    border:       '1px solid #f0f0f0',
                    borderTop:    'none',
                    borderRadius: '0 0 8px 8px',
                    overflow:     'hidden',
                    maxHeight:    380,
                    overflowY:    'auto',
                  }}>
                    {sortedEmployees.map((emp) => (
                      <EmployeeRow
                        key={emp.id}
                        emp={emp}
                        isSelected={selectedIds.includes(emp.id)}
                        isOriginalFav={originalFavIds.includes(emp.id)}
                        onToggle={handleToggle}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* ── BOTTOM ACTIONS ── */}
              <div style={{
                display:    'flex',
                gap:        10,
                marginTop:  14,
                paddingTop: 12,
                borderTop:  '1px solid #f0f0f0',
                flexWrap:   'wrap',
                alignItems: 'center',
              }}>
                <span style={{ flex: 1, fontSize: 13, color: '#555', minWidth: 120 }}>
                  <strong style={{ color: selectedIds.length > 0 ? '#52c41a' : '#aaa' }}>
                    {selectedIds.length}
                  </strong>
                  {' '}/{allEmployees.length} ажилтан сонгогдсон
                </span>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || selectedIds.length === 0}
                  style={{
                    padding:      '9px 24px',
                    borderRadius: 8,
                    border:       'none',
                    background:   (submitting || selectedIds.length === 0) ? '#f0f0f0' : '#1677ff',
                    color:        (submitting || selectedIds.length === 0) ? '#aaa' : 'white',
                    fontSize:     13,
                    fontWeight:   700,
                    cursor:       (submitting || selectedIds.length === 0) ? 'not-allowed' : 'pointer',
                    transition:   'all 0.15s',
                    minWidth:     170,
                  }}
                >
                  {submitting ? '⏳ Илгээж байна…' : '🚀 ERP рүү илгээх'}
                </button>
              </div>

              {/* ── HISTORY SECTION ── */}
              <div style={{
                marginTop:    24,
                paddingTop:   16,
                borderTop:    '2px solid #f0f0f0',
              }}>
                <div style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           8,
                  marginBottom:  12,
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#333' }}>
                    📋 Захиалгын түүх
                  </span>
                  <span style={{ fontSize: 11, color: '#aaa' }}>
                    — {selectedUser.username}
                  </span>
                  {/* Status legend */}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.values(STATUS_META).map((m) => (
                      <span key={m.label} style={{ fontSize: 10, color: m.color }}>
                        {m.icon} {m.label}
                      </span>
                    ))}
                  </div>
                </div>

                <ManagedOrdersHistory
                  sourceUsername={selectedUser.username}
                  refreshTrigger={historyRefresh}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CampManagedOrdersView;
