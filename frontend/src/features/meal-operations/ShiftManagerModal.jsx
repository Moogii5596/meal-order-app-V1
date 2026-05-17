/**
 * ShiftManagerModal.jsx — Ээлж шинэчлэх bottom-sheet
 *
 * 3 tab:
 *  1. Үндсэн ээлж  — dept employees; check/uncheck → save adds/removes from shift
 *  2. Түрээсийн    — extra employees (rental); multi-select → bulk remove
 *  3. Сунасан      — extra employees (sunasan); same as rental tab
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  hideEmployee    as hideEmployeeApi,
  removeFavorite  as removeFavoriteApi,
  saveFavorite    as saveFavoriteApi,
  unhideEmployee  as unhideEmployeeApi,
  removeExtraEmployee as removeExtraApi,
} from '../../services/employees';
import AddEmployeeModal from './AddEmployeeModal';

/* ── visualViewport keyboard offset (same as AddEmployeeModal) ── */
function useKeyboardOffset() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);
  return offset;
}

function useBodyScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
}

/* ── tiny SVG icons ── */
const CheckIcon = () => (
  <svg viewBox="0 0 12 10" className="w-3 h-3" fill="none"
    stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 5l3.5 3.5L11 1" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function sortByJobThenName(a, b) {
  const jc = (a.job_title || '').localeCompare(b.job_title || '', 'mn');
  return jc !== 0 ? jc : (a.last_name || '').localeCompare(b.last_name || '', 'mn');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function ShiftManagerModal({
  dark,
  employees,        // all dept employees (raw, unfiltered)
  extraEmployees,   // extra employees array
  favorites,        // array of favored emp ids
  hiddenIds,        // array of hidden emp ids
  onClose,
  // callbacks to sync parent state after changes
  onFavoritesChanged,  // (newFavorites, newHiddenIds) => void
  onExtrasRemoved,     // (removedIds) => void
  onAddEmployee,       // (emp, tab) => void — same handler as main screen
}) {
  const [tab, setTab]               = useState('base');
  const [saving, setSaving]         = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const scrollRef = useRef(null);
  const keyboardOffset = useKeyboardOffset();
  useBodyScrollLock();

  /* ── BASE TAB: check state (Set of active emp ids) ── */
  const initialActive = useMemo(() => {
    const s = new Set();
    employees.forEach((e) => {
      if (favorites.includes(e.id) && !hiddenIds.includes(e.id)) s.add(e.id);
    });
    return s;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [baseChecks, setBaseChecks] = useState(initialActive);

  const toggleBase = useCallback((id) => {
    setBaseChecks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelectAllBase = () => {
    setBaseChecks((prev) => {
      const allIds = employees.map((e) => e.id); // full set, not sorted slice
      const allChecked = allIds.every((id) => prev.has(id));
      if (allChecked) return new Set();
      return new Set(allIds);
    });
  };

  const handleSaveBase = async () => {
    setSaving(true);
    try {
      const toActivate   = employees.filter((e) =>  baseChecks.has(e.id) && !initialActive.has(e.id));
      const toDeactivate = employees.filter((e) => !baseChecks.has(e.id) &&  initialActive.has(e.id));

      await Promise.all([
        ...toActivate.map((e) =>
          Promise.all([
            saveFavoriteApi(e.id),
            hiddenIds.includes(e.id) ? unhideEmployeeApi(e.id) : Promise.resolve(),
          ])
        ),
        ...toDeactivate.map((e) =>
          Promise.all([
            removeFavoriteApi(e.id),
            hideEmployeeApi(e.id),
          ])
        ),
      ]);

      // Rebuild favorites and hiddenIds based on changes
      const newFavorites = [
        ...favorites.filter((id) => !toDeactivate.find((e) => e.id === id)),
        ...toActivate.map((e) => e.id).filter((id) => !favorites.includes(id)),
      ];
      const newHiddenIds = [
        ...hiddenIds.filter((id) => !toActivate.find((e) => e.id === id)),
        ...toDeactivate.map((e) => e.id).filter((id) => !hiddenIds.includes(id)),
      ];

      onFavoritesChanged(newFavorites, newHiddenIds);
      onClose();
    } catch {
      // silent — parent toast handles errors
    } finally {
      setSaving(false);
    }
  };

  /* ── EXTRAS TABS: removal selection ── */
  const [removalSet, setRemovalSet] = useState(new Set());

  // Reset selection when tab changes
  useEffect(() => {
    setRemovalSet(new Set());
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [tab]);

  const sortedEmployees = useMemo(
    () => [...employees].sort(sortByJobThenName),
    [employees],
  );

  const currentExtras = useMemo(
    () => extraEmployees
      .filter((e) => e.extra_type === (tab === 'rental' ? 'rental' : 'sunasan'))
      .sort(sortByJobThenName),
    [extraEmployees, tab],
  );

  const toggleRemoval = useCallback((id) => {
    setRemovalSet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelectAllRemoval = () => {
    setRemovalSet((prev) => {
      const allIds = currentExtras.map((e) => e.id);
      return allIds.every((id) => prev.has(id)) ? new Set() : new Set(allIds);
    });
  };

  const handleBulkRemove = async () => {
    if (!removalSet.size) return;
    setSaving(true);
    try {
      await Promise.all([...removalSet].map((id) => removeExtraApi(id)));
      onExtrasRemoved([...removalSet]);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  /* ── theme ── */
  const d = dark
    ? {
        sheet:   'bg-slate-800',
        divider: 'border-slate-700',
        tabBtn:  'bg-slate-700 text-slate-300 border-slate-600',
        tabAct:  'bg-amber-500 text-slate-900 border-amber-500',
        nameClr: 'text-slate-100',
        subClr:  'text-slate-400',
        rowHov:  'active:bg-slate-700/50',
        rowSel:  'bg-amber-950/25',
        chkOff:  'border-slate-600 bg-transparent',
        chkOn:   'bg-amber-500 border-amber-500',
        handle:  'bg-slate-600',
        close:   'text-slate-400 hover:text-slate-200 hover:bg-slate-700',
        empty:   'text-slate-500',
        saveBtn: 'bg-amber-500 text-slate-900',
        delBtn:  'bg-red-600 text-white',
        disBtn:  'bg-slate-700 text-slate-500',
        listBox: 'border-slate-700',
        listDiv: 'divide-slate-700/50',
        listBg:  'bg-slate-800',
        selRow:  'text-amber-400',
      }
    : {
        sheet:   'bg-white',
        divider: 'border-slate-200',
        tabBtn:  'bg-slate-100 text-slate-600 border-slate-200',
        tabAct:  'bg-amber-500 text-white border-amber-500',
        nameClr: 'text-slate-900',
        subClr:  'text-slate-500',
        rowHov:  'active:bg-slate-50',
        rowSel:  'bg-amber-50',
        chkOff:  'border-slate-300 bg-white',
        chkOn:   'bg-amber-500 border-amber-500',
        handle:  'bg-slate-300',
        close:   'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
        empty:   'text-slate-400',
        saveBtn: 'bg-amber-500 text-white',
        delBtn:  'bg-red-500 text-white',
        disBtn:  'bg-slate-200 text-slate-400',
        listBox: 'border-slate-200',
        listDiv: 'divide-slate-100',
        listBg:  'bg-white',
        selRow:  'text-amber-700',
      };

  const TABS = [
    { key: 'base',   label: 'Үндсэн ээлж' },
    { key: 'rental', label: 'Түрээсийн' },
    { key: 'sunasan',label: 'Сунасан' },
  ];

  const allBaseChecked = sortedEmployees.length > 0 && sortedEmployees.every((e) => baseChecks.has(e.id));
  const allRemovalChecked = currentExtras.length > 0 && currentExtras.every((e) => removalSet.has(e.id));

  /* ─── render ─── */
  return (
    <>
    <div
      className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[480px] ${d.sheet} rounded-t-3xl flex flex-col border-t ${d.divider}`}
        style={{ height: '88dvh', marginBottom: keyboardOffset, willChange: 'transform', transform: 'translateZ(0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className={`w-10 h-1 rounded-full ${d.handle}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${d.divider} flex-shrink-0`}>
          <h2 className={`text-base font-extrabold ${d.nameClr}`}>Ээлж шинэчлэх</h2>
          <button onClick={onClose}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors ${d.close}`}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1.5 px-4 py-2.5 border-b ${d.divider} flex-shrink-0`}>
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${tab === key ? d.tabAct : d.tabBtn}`}
              style={{ minHeight: 36 }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── BASE TAB ── */}
        {tab === 'base' && (
          <>
            {/* Select-all + count */}
            <div className={`flex items-center justify-between px-4 py-2 border-b ${d.divider} flex-shrink-0`}>
              <button onClick={handleSelectAllBase} className="flex items-center gap-2" style={{ minHeight: 32 }}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                  ${allBaseChecked ? d.chkOn : d.chkOff}`}>
                  {allBaseChecked && <CheckIcon />}
                </div>
                <span className={`text-xs font-bold ${d.selRow}`}>Бүгдийг сонгох</span>
              </button>
              <span className={`text-xs ${d.subClr}`}>{baseChecks.size} / {sortedEmployees.length}</span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
              {sortedEmployees.length === 0 ? (
                <div className={`flex flex-col items-center justify-center py-16 ${d.empty} text-sm`}>
                  📭 Ажилтан олдсонгүй
                </div>
              ) : (
                <div className={`border-b ${d.listBox} overflow-hidden mx-3 mt-2 rounded-xl`}>
                  <div className={`divide-y ${d.listDiv} ${d.listBg}`}>
                    {sortedEmployees.map((emp) => {
                      const checked = baseChecks.has(emp.id);
                      return (
                        <div key={emp.id}
                          onClick={() => toggleBase(emp.id)}
                          className={`flex items-center gap-2.5 px-3 min-h-[44px] cursor-pointer transition-colors
                            ${checked ? d.rowSel : d.rowHov}`}
                          style={{ paddingTop: 7, paddingBottom: 7 }}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                            ${checked ? d.chkOn : d.chkOff}`}>
                            {checked && <CheckIcon />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-semibold truncate ${d.nameClr}`}>
                              {emp.last_name} {emp.name}
                            </div>
                            {emp.job_title && (
                              <div className={`text-[11px] truncate ${d.subClr}`}>{emp.job_title}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ height: 12 }} />
            </div>

            {/* Save button */}
            <div className={`flex-shrink-0 px-4 py-3 border-t ${d.divider}`}
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              <button onClick={handleSaveBase} disabled={saving}
                className={`w-full py-3.5 rounded-2xl font-extrabold text-sm active:scale-95 transition-all
                  ${saving ? d.disBtn : d.saveBtn}`}
                style={{ minHeight: 50 }}>
                {saving ? 'Хадгалж байна…' : 'Хадгалах'}
              </button>
            </div>
          </>
        )}

        {/* ── RENTAL / SUNASAN TAB ── */}
        {(tab === 'rental' || tab === 'sunasan') && (
          <>
            {/* Select-all + count */}
            <div className={`flex items-center justify-between px-4 py-2 border-b ${d.divider} flex-shrink-0`}>
              <button onClick={handleSelectAllRemoval} className="flex items-center gap-2" style={{ minHeight: 32 }}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                  ${allRemovalChecked && currentExtras.length > 0 ? d.chkOn : d.chkOff}`}>
                  {allRemovalChecked && currentExtras.length > 0 && <CheckIcon />}
                </div>
                <span className={`text-xs font-bold ${d.selRow}`}>Бүгдийг сонгох</span>
              </button>
              <span className={`text-xs ${d.subClr}`}>
                {removalSet.size > 0 ? `${removalSet.size} сонгогдсон` : `${currentExtras.length} ажилтан`}
              </span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
              {currentExtras.length === 0 ? (
                <div className={`flex flex-col items-center justify-center py-16 gap-2 ${d.empty}`}>
                  <span className="text-3xl">📭</span>
                  <span className="text-sm">
                    {tab === 'rental' ? 'Түрээсийн ажилтан байхгүй' : 'Сунасан ажилтан байхгүй'}
                  </span>
                </div>
              ) : (
                <div className={`border ${d.listBox} overflow-hidden mx-3 mt-2 rounded-xl`}>
                  <div className={`divide-y ${d.listDiv} ${d.listBg}`}>
                    {currentExtras.map((emp) => {
                      const selected = removalSet.has(emp.id);
                      return (
                        <div key={emp.id}
                          onClick={() => toggleRemoval(emp.id)}
                          className={`flex items-center gap-2.5 px-3 min-h-[44px] cursor-pointer transition-colors
                            ${selected ? d.rowSel : d.rowHov}`}
                          style={{ paddingTop: 7, paddingBottom: 7 }}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                            ${selected ? d.chkOn : d.chkOff}`}>
                            {selected && <CheckIcon />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-semibold truncate ${d.nameClr}`}>
                              {emp.last_name} {emp.name}
                            </div>
                            {(emp.job_title || emp.dept_name) && (
                              <div className={`text-[11px] truncate ${d.subClr}`}>
                                {emp.dept_name}{emp.job_title && emp.dept_name ? ' · ' : ''}{emp.job_title}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ height: 12 }} />
            </div>

            {/* Add + Bulk-remove buttons */}
            <div className={`flex-shrink-0 px-4 py-3 border-t ${d.divider} flex gap-2`}
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              {/* Add employee — identical to main screen */}
              <button
                onClick={() => setShowAddModal(true)}
                disabled={saving}
                className={`flex-1 py-3.5 rounded-2xl font-extrabold text-sm active:scale-95 transition-all
                  ${saving ? d.disBtn : 'bg-blue-600 text-white active:bg-blue-700'}`}
                style={{ minHeight: 50 }}
              >
                ＋ Нэмэх
              </button>
              {/* Bulk remove */}
              <button
                onClick={handleBulkRemove}
                disabled={removalSet.size === 0 || saving}
                className={`flex-1 py-3.5 rounded-2xl font-extrabold text-sm active:scale-95 transition-all
                  ${removalSet.size === 0 || saving ? d.disBtn : d.delBtn}`}
                style={{ minHeight: 50 }}
              >
                {saving
                  ? 'Хасаж байна…'
                  : removalSet.size > 0
                    ? `${removalSet.size} ажилтан хасах`
                    : 'Хасах'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>

    {/* AddEmployeeModal rendered OUTSIDE the sheet so willChange:transform
        stacking context does not trap its z-index */}
    {showAddModal && (
      <AddEmployeeModal
        dark={dark}
        favorites={favorites}
        onAdd={(emp, addedTab) => {
          onAddEmployee(emp, addedTab);
          setShowAddModal(false);
        }}
        onClose={() => setShowAddModal(false)}
      />
    )}
  </>
  );
}

export default ShiftManagerModal;
