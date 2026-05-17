import React, { useMemo, useState } from 'react';
import { useGroups } from './useGroups';

/**
 * Modal for quickly applying a saved employee group to an open order.
 *
 * Shows all available groups with:
 *   - How many employees from the group are already in the order
 *   - How many are new (will be added)
 *   - A confirm preview before applying
 *
 * Props:
 *   existingEmployees  Array  — current allEmps from useReconciliation (already in order)
 *   onApply            fn     — (employeesToAdd: Array<{id,name,dept_name}>) => void
 *   onClose            fn     — () => void
 */
function GroupPickerModal({ existingEmployees = [], onApply, onClose }) {
  const { groups }             = useGroups();
  const [selected, setSelected] = useState(null);  // selected group id
  const [preview, setPreview]   = useState(false); // show confirm step

  const existingIds = useMemo(
    () => new Set(existingEmployees.map((e) => e.id)),
    [existingEmployees],
  );

  const selectedGroup = groups.find((g) => g.id === selected) ?? null;

  const { toAdd, alreadyHere } = useMemo(() => {
    if (!selectedGroup) return { toAdd: [], alreadyHere: [] };
    return {
      toAdd:      selectedGroup.employees.filter((e) => !existingIds.has(e.id)),
      alreadyHere: selectedGroup.employees.filter((e) =>  existingIds.has(e.id)),
    };
  }, [selectedGroup, existingIds]);

  const handleApply = () => {
    if (toAdd.length === 0) return;
    onApply(toAdd);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 1100 }}
    >
      <div
        className="modal-box"
        style={{ maxWidth: 480, width: '95vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <strong style={{ fontSize: 15 }}>👥 Бүлгээс нэмэх</strong>
          <button className="action-btn" onClick={onClose}>✕</button>
        </div>

        {groups.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>Бүлэг байхгүй байна</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              "Бүлэг" табаас шинэ бүлэг үүсгэнэ үү
            </div>
          </div>
        ) : !preview ? (

          /* ── Step 1: Pick a group ── */
          <>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
              Ажилтнуудыг нэмэх бүлгээ сонгоно уу:
            </div>

            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {groups.map((g) => {
                const newCount  = g.employees.filter((e) => !existingIds.has(e.id)).length;
                const hereCount = g.employees.filter((e) =>  existingIds.has(e.id)).length;
                const isEmpty   = g.employees.length === 0;
                const isActive  = g.id === selected;

                return (
                  <div
                    key={g.id}
                    onClick={() => !isEmpty && setSelected(g.id)}
                    style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          10,
                      padding:      '11px 14px',
                      borderRadius: 8,
                      marginBottom: 6,
                      cursor:       isEmpty ? 'not-allowed' : 'pointer',
                      opacity:      isEmpty ? 0.45 : 1,
                      background:   isActive ? '#e6f4ff' : 'white',
                      border:       `1.5px solid ${isActive ? '#1677ff' : '#e8e8e8'}`,
                      transition:   'all 0.12s',
                    }}
                  >
                    {/* Color swatch */}
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: g.color, flexShrink: 0, display: 'inline-block',
                    }} />

                    {/* Name + description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</div>
                      {g.description && (
                        <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{g.description}</div>
                      )}
                    </div>

                    {/* Member counts */}
                    {isEmpty ? (
                      <span style={{ fontSize: 11, color: '#ccc' }}>Хоосон</span>
                    ) : (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {newCount > 0 && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#52c41a' }}>
                            +{newCount} шинэ
                          </div>
                        )}
                        {hereCount > 0 && (
                          <div style={{ fontSize: 11, color: '#bbb' }}>
                            {hereCount} аль хэдийн
                          </div>
                        )}
                      </div>
                    )}

                    {isActive && (
                      <span style={{ fontSize: 16, color: '#1677ff', flexShrink: 0 }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="action-btn" onClick={onClose}>Болих</button>
              <button
                className="approve-btn"
                disabled={!selectedGroup || toAdd.length === 0}
                onClick={() => setPreview(true)}
              >
                {!selectedGroup
                  ? 'Бүлэг сонгоно уу'
                  : toAdd.length === 0
                    ? 'Бүгд аль хэдийн байна'
                    : `Дараах → (+${toAdd.length} хүн)`}
              </button>
            </div>
          </>

        ) : (

          /* ── Step 2: Confirm preview ── */
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: selectedGroup.color, flexShrink: 0, display: 'inline-block',
                }} />
                <strong style={{ fontSize: 14 }}>{selectedGroup.name}</strong>
              </div>
              <div style={{ fontSize: 13, color: '#555' }}>
                Дараах <strong style={{ color: '#1677ff' }}>{toAdd.length}</strong> ажилтныг
                захиалгад нэмэх үү?
              </div>
            </div>

            {/* Employees to add */}
            <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 10 }} className="table-scroll">
              <table className="employee-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr><th>#</th><th>Нэр</th><th>Хэлтэс</th></tr>
                </thead>
                <tbody>
                  {toAdd.map((emp, i) => (
                    <tr key={emp.id}>
                      <td style={{ color: '#aaa', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{emp.name}</td>
                      <td style={{ fontSize: 12, color: '#888' }}>{emp.dept_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {alreadyHere.length > 0 && (
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
                ℹ️ {alreadyHere.length} ажилтан захиалгад аль хэдийн байгаа тул орхигдоно.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="action-btn" onClick={() => setPreview(false)}>← Буцах</button>
              <button className="confirm-btn" onClick={handleApply}>
                ✓ Нэмэх ({toAdd.length} хүн)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default GroupPickerModal;
