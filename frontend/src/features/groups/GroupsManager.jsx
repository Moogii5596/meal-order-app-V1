import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/ui/Toast';
import { searchEmployees } from '../../services/employees';
import { GROUP_COLORS } from './groupsStorage';
import { useGroups } from './useGroups';

// ── Small sub-components ──────────────────────────────────────────────────────

/** Colored circle chip showing the group's identity color. */
function ColorDot({ color, size = 12 }) {
  return (
    <span style={{
      display:      'inline-block',
      width:        size,
      height:       size,
      borderRadius: '50%',
      background:   color,
      flexShrink:   0,
    }} />
  );
}

/** Row for a single group in the sidebar list. */
function GroupListItem({ group, isSelected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          10,
        padding:      '10px 12px',
        borderRadius: 8,
        cursor:       'pointer',
        marginBottom: 6,
        background:   isSelected ? '#e6f0ff' : 'white',
        border:       `1.5px solid ${isSelected ? '#1677ff' : '#e8e8e8'}`,
        transition:   'all 0.15s',
      }}
    >
      <ColorDot color={group.color} size={10} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group.name}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
          {group.employees.length} ажилтан
          {group.description ? ` · ${group.description}` : ''}
        </div>
      </div>
    </div>
  );
}

// ── Create group form ─────────────────────────────────────────────────────────

function CreateGroupForm({ onCreate, onCancel }) {
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor]             = useState(GROUP_COLORS[0]);
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), description, color });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background:   'white',
        border:       '1.5px solid #1677ff',
        borderRadius: 10,
        padding:      14,
        marginBottom: 10,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#1677ff' }}>
        ✚ Шинэ бүлэг үүсгэх
      </div>

      <input
        ref={nameRef}
        style={{
          width: '100%', padding: '8px 10px', marginBottom: 8,
          border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13,
          boxSizing: 'border-box',
        }}
        placeholder="Бүлгийн нэр (жш: Night Shift, PP Camp...)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
      />

      <input
        style={{
          width: '100%', padding: '7px 10px', marginBottom: 10,
          border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13,
          boxSizing: 'border-box',
        }}
        placeholder="Тайлбар (заавал биш)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={120}
      />

      {/* Color picker */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {GROUP_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            style={{
              width:        24, height:    24,
              borderRadius: '50%',
              background:   c,
              border:       color === c ? '3px solid #1a1a2e' : '2px solid transparent',
              cursor:       'pointer',
              padding:      0,
              flexShrink:   0,
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          className="approve-btn"
          style={{ flex: 1 }}
          disabled={!name.trim()}
        >
          Үүсгэх
        </button>
        <button type="button" className="action-btn" onClick={onCancel}>
          Болих
        </button>
      </div>
    </form>
  );
}

// ── Group detail panel ────────────────────────────────────────────────────────

function GroupDetail({ group, onAddEmployee, onRemoveEmployee, onRename, onDelete }) {
  const [editing, setEditing]         = useState(false);
  const [editName, setEditName]       = useState(group.name);
  const [editDesc, setEditDesc]       = useState(group.description || '');
  const [editColor, setEditColor]     = useState(group.color);
  const [showSearch, setShowSearch]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]     = useState(false);

  // Reset edit state whenever the selected group changes
  useEffect(() => {
    setEditing(false);
    setEditName(group.name);
    setEditDesc(group.description || '');
    setEditColor(group.color);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  }, [group.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live employee search (400 ms debounce)
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      searchEmployees(searchQuery)
        .then(setSearchResults)
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSaveEdit = () => {
    if (!editName.trim()) return;
    onRename(group.id, { name: editName.trim(), description: editDesc.trim(), color: editColor });
    setEditing(false);
  };

  const handleAddFromSearch = (emp) => {
    onAddEmployee(group.id, {
      id:        emp.id,
      name:      `${emp.last_name || ''} ${emp.name}`.trim(),
      dept_name: emp.dept_name || '',
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleDelete = () => {
    if (!window.confirm(`"${group.name}" бүлгийг устгах уу?`)) return;
    onDelete(group.id);
  };

  return (
    <div>
      {/* ── Header ── */}
      {editing ? (
        <div style={{
          background: '#f9fbff', border: '1px solid #91caff',
          borderRadius: 10, padding: 12, marginBottom: 12,
        }}>
          <input
            style={{
              width: '100%', padding: '8px 10px', marginBottom: 8,
              border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14,
              fontWeight: 600, boxSizing: 'border-box',
            }}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={60}
            autoFocus
          />
          <input
            style={{
              width: '100%', padding: '7px 10px', marginBottom: 10,
              border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13,
              boxSizing: 'border-box',
            }}
            placeholder="Тайлбар"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            maxLength={120}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEditColor(c)}
                style={{
                  width: 22, height: 22, borderRadius: '50%', background: c,
                  border: editColor === c ? '3px solid #1a1a2e' : '2px solid transparent',
                  cursor: 'pointer', padding: 0, flexShrink: 0,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="approve-btn" onClick={handleSaveEdit} disabled={!editName.trim()}>
              Хадгалах
            </button>
            <button className="action-btn" onClick={() => setEditing(false)}>Болих</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <ColorDot color={group.color} size={14} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e' }}>{group.name}</div>
            {group.description && (
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{group.description}</div>
            )}
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
              {group.employees.length} ажилтан
              {' · '}Шинэчлэгдсэн: {group.updatedAt?.slice(0, 10) || '—'}
            </div>
          </div>
          <button className="action-btn" onClick={() => setEditing(true)} style={{ fontSize: 12 }}>
            ✏️ Засах
          </button>
          <button
            className="action-btn"
            onClick={handleDelete}
            style={{ borderColor: '#ff4d4f', color: '#ff4d4f', fontSize: 12 }}
          >
            🗑 Устгах
          </button>
        </div>
      )}

      {/* ── Add employee toolbar ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>
          Ажилтнууд ({group.employees.length})
        </span>
        <div style={{ flex: 1 }} />
        <button
          className="action-btn"
          style={{ borderColor: '#1677ff', color: '#1677ff', fontSize: 12 }}
          onClick={() => { setShowSearch((s) => !s); setSearchQuery(''); setSearchResults([]); }}
        >
          {showSearch ? '✕ Хаах' : '+ Ажилтан нэмэх'}
        </button>
      </div>

      {/* ── Employee search panel ── */}
      {showSearch && (
        <div style={{
          background: '#f9f9fb', border: '1px solid #e8e8e8',
          borderRadius: 8, padding: 12, marginBottom: 10,
        }}>
          <input
            style={{
              width: '100%', padding: '8px 12px', boxSizing: 'border-box',
              border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13,
            }}
            placeholder="Нэрээр хайх... (автоматаар)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searching && (
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>Хайж байна...</div>
          )}
          {!searching && searchQuery.trim() && searchResults.length === 0 && (
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>Олдсонгүй</div>
          )}
          {searchResults.length > 0 && (
            <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 8 }}>
              <table className="employee-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr><th>Нэр</th><th>Хэлтэс</th><th></th></tr>
                </thead>
                <tbody>
                  {searchResults.map((emp) => {
                    const already = group.employees.some((e) => e.id === emp.id);
                    return (
                      <tr key={emp.id} style={{ opacity: already ? 0.4 : 1 }}>
                        <td>{emp.last_name} {emp.name}</td>
                        <td style={{ color: '#888' }}>{emp.dept_name}</td>
                        <td>
                          <button
                            className="confirm-btn"
                            style={{ padding: '3px 10px', fontSize: 11 }}
                            disabled={already}
                            onClick={() => handleAddFromSearch(emp)}
                          >
                            {already ? '✓' : 'Нэмэх'}
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
      {group.employees.length === 0 ? (
        <div className="empty-state" style={{ padding: '30px 20px', fontSize: 13 }}>
          Бүлэгт ажилтан байхгүй байна
        </div>
      ) : (
        <div style={{ maxHeight: 380, overflowY: 'auto' }} className="table-scroll">
          <table className="employee-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Нэр</th>
                <th>Хэлтэс</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {group.employees.map((emp, i) => (
                <tr key={emp.id}>
                  <td style={{ color: '#aaa', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{emp.name}</td>
                  <td style={{ fontSize: 12, color: '#888' }}>
                    {emp.dept_name || <span style={{ color: '#ddd' }}>—</span>}
                  </td>
                  <td>
                    <button
                      className="action-btn"
                      style={{ borderColor: '#ff4d4f', color: '#ff4d4f', fontSize: 11, padding: '3px 8px' }}
                      onClick={() => onRemoveEmployee(group.id, emp.id)}
                    >
                      Хасах
                    </button>
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

// ── Main GroupsManager component ──────────────────────────────────────────────

/**
 * Full CRUD interface for managing operational employee groups.
 *
 * Layout mirrors CampFavView:
 *   - Left sidebar: group list + create button
 *   - Right panel: selected group detail (employees, edit, delete)
 *
 * Intended to be rendered as a tab inside CampManagerView.
 */
function GroupsManager() {
  const { toast, showToast, hideToast } = useToast();
  const {
    groups, createGroup, updateGroup, deleteGroup,
    addEmployee, removeEmployee,
  } = useGroups();

  const [selectedId, setSelectedId]   = useState(null);
  const [showCreate, setShowCreate]   = useState(false);

  const selectedGroup = groups.find((g) => g.id === selectedId) ?? null;

  // Auto-select first group after create / after delete
  const handleCreate = (data) => {
    const group = createGroup(data);
    setSelectedId(group.id);
    setShowCreate(false);
    showToast(`"${group.name}" бүлэг үүслээ ✓`);
  };

  const handleDelete = (id) => {
    const name = groups.find((g) => g.id === id)?.name || '';
    deleteGroup(id);
    setSelectedId(null);
    showToast(`"${name}" бүлэг устгагдлаа`);
  };

  return (
    <div className="camp-fav-layout">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* ── Left: group list ── */}
      <div className="camp-fav-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#444', flex: 1 }}>
            Бүлгийн жагсаалт
          </span>
          <button
            className="approve-btn"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={() => setShowCreate((s) => !s)}
          >
            {showCreate ? '✕' : '+ Шинэ'}
          </button>
        </div>

        {showCreate && (
          <CreateGroupForm
            onCreate={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {groups.length === 0 && !showCreate ? (
          <div className="empty-state" style={{ fontSize: 12, padding: '24px 16px' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
            Бүлэг байхгүй байна.
            <br />
            <span style={{ color: '#1677ff', cursor: 'pointer' }} onClick={() => setShowCreate(true)}>
              Шинэ бүлэг үүсгэх
            </span>
          </div>
        ) : (
          groups.map((g) => (
            <GroupListItem
              key={g.id}
              group={g}
              isSelected={g.id === selectedId}
              onClick={() => setSelectedId(g.id)}
            />
          ))
        )}
      </div>

      {/* ── Right: group detail ── */}
      <div className="camp-fav-content">
        {!selectedGroup ? (
          <div className="empty-state">← Зүүн талаас бүлэг сонгоно уу</div>
        ) : (
          <GroupDetail
            group={selectedGroup}
            onAddEmployee={addEmployee}
            onRemoveEmployee={removeEmployee}
            onRename={updateGroup}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}

export default GroupsManager;
