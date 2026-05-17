/**
 * KitchenView.jsx — Ultra-compact mobile list edition
 *
 * Visual changes from previous version:
 *  • EmployeeCard → compact ~44px row (no card/shadow/border-radius)
 *  • StatusBadge → 8px colored dot (inline, no text)
 *  • SkeletonCard → slim skeleton row
 *  • List container: divide-y bordered box (Telegram/Slack style)
 *  • Action buttons → icon-only SVG (32–36px touch target)
 *  • Row tap toggles checkbox (full-width touch target)
 *  • 10-15 employees visible per screen
 *
 * All business logic, hooks, and handlers are unchanged.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth }      from '../../context/AuthContext';
import { useEmployees } from '../../hooks/useEmployees';
import { useToast }     from '../../hooks/useToast';
import {
  DEFAULT_MEAL,
  LOCATION_LABELS,
  MEAL_SHORT_LABELS,
} from '../../constants';
import {
  clearAllMyEmployees,
  fetchDepartments,
  fetchEmployees      as fetchEmployeesApi,
  hideEmployee        as hideEmployeeApi,
  removeExtraEmployee as removeExtraApi,
  removeFavorite      as removeFavoriteApi,
  saveExtraEmployee,
  saveFavorite        as saveFavoriteApi,
} from '../../services/employees';
import { createOrder } from '../../services/orders';
import Toast              from '../../components/ui/Toast';
import AddEmployeeModal  from './AddEmployeeModal';
import ShiftManagerModal from './ShiftManagerModal';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const BATCH_SIZE = 50;

const STATUS_DOT = {
  read:      { color: '#22c55e', label: 'Карт уншуулсан'   },
  unread:    { color: '#f97316', label: 'Карт уншуулаагүй' },
  duplicate: { color: '#ef4444', label: 'Давхардсан'       },
};

const LOCATIONS = [
  { key: 'uh',     label: 'Ухаа худаг'  },
  { key: 'bn',     label: 'Баруун наран' },
  { key: 'zas',   label: 'Засвар'       },
  { key: 'office', label: 'Оффис'        },
];

// ─────────────────────────────────────────────────────────────────────────────
// SAVED LISTS  (persisted to localStorage)
// Shape: Array<{
//   id: string,          // "${deptId}_${locationKey}" for extras, deptId for main
//   deptId: string,      // actual hr.department id used for API calls
//   name: string,        // dept name
//   isMain: boolean,
//   location: string,    // LOCATIONS key  ('' = no filter)
//   locationLabel: string
// }>
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// MOBILE HOOKS  (shared by bottom-sheet components in this file)
// ─────────────────────────────────────────────────────────────────────────────
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

const LISTS_KEY = 'meal_app_saved_lists';

function loadSavedLists() {
  try { return JSON.parse(localStorage.getItem(LISTS_KEY) || '[]'); }
  catch { return []; }
}

function persistLists(lists) {
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG ICONS  (inline — no icon library dependency)
// ─────────────────────────────────────────────────────────────────────────────
const XIcon = () => (
  <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none"
    stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <path d="M1 1l12 12M13 1L1 13" />
  </svg>
);

const StarIcon = () => (
  <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="currentColor">
    <path d="M7 1l1.55 3.14L12 4.77l-2.5 2.44.59 3.44L7 9l-3.09 1.65.59-3.44L2 4.77l3.45-.63z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 12 10" className="w-3 h-3" fill="none"
    stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 5l3.5 3.5L11 1" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. SKELETON ROW  (compact, matches real row height)
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonRow({ dark }) {
  const p = dark ? 'bg-slate-700' : 'bg-slate-200';
  return (
    <div className="flex items-center gap-2.5 px-3 min-h-[44px] animate-pulse"
      style={{ paddingTop: 7, paddingBottom: 7 }}>
      <div className={`w-5 h-5 rounded flex-shrink-0 ${p}`} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className={`h-3.5 rounded w-3/5 ${p}`} />
        <div className={`h-2.5 rounded w-2/5 ${p}`} />
      </div>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p}`} />
      <div className={`w-9 h-9 rounded-lg flex-shrink-0 ${p}`} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EMPLOYEE ROW  (~44px, ultra compact, React.memo for perf)
// ─────────────────────────────────────────────────────────────────────────────
const EmployeeCard = React.memo(function EmployeeCard({
  emp, isSelected, isFav, dark,
  onToggle, onRemoveFav, onRemoveExtra, onSaveFav, onHide, isFavoriteEligible,
}) {
  const isRead      = !!emp.is_swiped;
  const status      = isRead ? 'read' : emp.is_duplicate ? 'duplicate' : 'unread';
  const dot         = STATUS_DOT[status];
  const isRentalFav = isFav && emp.extra_type === 'rental';
  const extraTag    = emp.is_extra
    ? (emp.extra_type === 'rental' ? 'Түр' : 'Сун')
    : null;

  /* row background */
  const rowBg = isSelected && !isRead
    ? (dark ? 'bg-amber-950/25' : 'bg-amber-50')
    : '';

  /* checkbox visual */
  const chkCls = isRead
    ? (dark ? 'border-slate-600 bg-transparent' : 'border-slate-300 bg-transparent')
    : isSelected
      ? 'bg-amber-500 border-amber-500'
      : (dark ? 'border-slate-600 bg-transparent' : 'border-slate-300 bg-white');

  /* action button — icon only, 36px touch target */
  const actBase = 'w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 active:scale-90 transition-transform';
  let actionEl;
  if (isFav) {
    actionEl = (
      <button
        onClick={(e) => { e.stopPropagation(); onRemoveFav(emp.id); }}
        title="Хасах"
        className={`${actBase} ${dark ? 'text-red-400 active:bg-red-900/30' : 'text-red-400 active:bg-red-50'}`}
      ><XIcon /></button>
    );
  } else if (emp.is_extra) {
    actionEl = (
      <button
        onClick={(e) => { e.stopPropagation(); onRemoveExtra(emp.id); }}
        title="Хасах"
        className={`${actBase} ${dark ? 'text-orange-400 active:bg-orange-900/30' : 'text-orange-400 active:bg-orange-50'}`}
      ><XIcon /></button>
    );
  } else if (isFavoriteEligible(emp)) {
    actionEl = (
      <button
        onClick={(e) => { e.stopPropagation(); onSaveFav(emp.id); }}
        title="Хадгалах"
        className={`${actBase} ${dark ? 'text-blue-400 active:bg-blue-900/30' : 'text-blue-400 active:bg-blue-50'}`}
      ><StarIcon /></button>
    );
  } else {
    actionEl = (
      <button
        onClick={(e) => { e.stopPropagation(); onHide(emp.id); }}
        title="Нуух"
        className={`${actBase} ${dark ? 'text-slate-600 active:bg-slate-700' : 'text-slate-300 active:bg-slate-100'}`}
      ><XIcon /></button>
    );
  }

  return (
    <div
      onClick={() => !isRead && onToggle(emp.id)}
      className={`flex items-center gap-2.5 px-3 min-h-[44px] transition-colors
        ${isRead ? 'opacity-40 cursor-default' : 'cursor-pointer'}
        ${rowBg}`}
      style={{ paddingTop: 7, paddingBottom: 7 }}
    >
      {/* Checkbox — visual only; row tap is the touch target */}
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${chkCls}`}>
        {isSelected && !isRead && <CheckIcon />}
      </div>

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          {isRentalFav && (
            <span className="text-[10px] text-amber-400 flex-shrink-0 leading-none">★</span>
          )}
          <span className={`text-sm font-semibold truncate leading-snug
            ${dark ? 'text-slate-100' : 'text-slate-900'}`}>
            {emp.last_name} {emp.name}
          </span>
          {extraTag && (
            <span className={`text-[10px] font-bold px-1 rounded flex-shrink-0 leading-snug
              ${dark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
              {extraTag}
            </span>
          )}
        </div>
        {emp.job_title && (
          <div className={`text-[11px] truncate leading-snug mt-px
            ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            {emp.job_title}
          </div>
        )}
      </div>

      {/* Status dot */}
      <div
        className="flex-shrink-0 rounded-full"
        style={{ width: 8, height: 8, background: dot.color, flexShrink: 0 }}
        title={dot.label}
      />

      {/* Icon action */}
      {actionEl}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ORDER ACTION SHEET
// ─────────────────────────────────────────────────────────────────────────────
function OrderActionSheet({ count, dark, submitting, onSend, onSendAndNew, onLogout, onClose }) {
  const sheet  = dark ? 'bg-slate-800 border-slate-700'  : 'bg-white border-slate-200';
  const handle = dark ? 'bg-slate-600'  : 'bg-slate-300';
  const countCls = dark ? 'text-amber-400' : 'text-amber-600';
  const subCls   = dark ? 'text-slate-400' : 'text-slate-500';
  const disCls   = dark ? 'bg-slate-700 text-slate-500' : 'bg-slate-100 text-slate-400';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}>
      <div
        className={`${sheet} rounded-t-3xl border-t px-4 pt-3 w-full max-w-[480px]`}
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-4">
          <div className={`w-10 h-1 rounded-full ${handle}`} />
        </div>

        {/* Title */}
        <div className="text-center mb-5">
          <div className={`text-lg font-extrabold ${countCls}`}>
            {count} ажилтан сонгогдсон
          </div>
          <div className={`text-xs mt-0.5 ${subCls}`}>Үйлдлээ сонгоно уу</div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          {/* Primary — send order */}
          <button
            onClick={onSend}
            disabled={submitting}
            className={`w-full py-4 rounded-2xl font-extrabold text-sm active:scale-95 transition-all
              ${submitting ? disCls : 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/25 active:bg-amber-600'}`}
            style={{ minHeight: 52 }}
          >
            {submitting ? 'Илгээж байна…' : '✓ Захиалга илгээх'}
          </button>

          {/* Secondary — send + start fresh */}
          <button
            onClick={onSendAndNew}
            disabled={submitting}
            className={`w-full py-4 rounded-2xl font-extrabold text-sm active:scale-95 transition-all
              ${submitting ? disCls : 'bg-blue-600 text-white active:bg-blue-700'}`}
            style={{ minHeight: 52 }}
          >
            🔄 Шинэ захиалга
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            disabled={submitting}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-all border
              ${dark
                ? 'border-slate-600 text-slate-300 active:bg-slate-700'
                : 'border-slate-300 text-slate-600 active:bg-slate-50'}`}
            style={{ minHeight: 48 }}
          >
            Гарах
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3b. DEPT PICKER MODAL  — 2-step: ээлж (dept) → төсөл (location)
// ─────────────────────────────────────────────────────────────────────────────
function DeptPickerModal({ departments, savedLists, dark, onSelect, onClose }) {
  const [step, setStep]           = useState(1);          // 1 = dept, 2 = location
  const [pickedDept, setPickedDept] = useState(null);

  const sheet   = dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const handle  = dark ? 'bg-slate-600' : 'bg-slate-300';
  const nameClr = dark ? 'text-slate-100' : 'text-slate-900';
  const subClr  = dark ? 'text-slate-400' : 'text-slate-500';
  const divClr  = dark ? 'divide-slate-700/50' : 'divide-slate-100';
  const rowHov  = dark ? 'active:bg-slate-700' : 'active:bg-slate-50';
  const locBtn  = dark
    ? 'bg-slate-700 border-slate-600 text-slate-100 active:bg-slate-600'
    : 'bg-slate-50 border-slate-200 text-slate-800 active:bg-slate-100';
  const backBtn = dark ? 'text-slate-400' : 'text-slate-500';

  const handleDeptPick = (dept) => {
    setPickedDept(dept);
    setStep(2);
  };

  const handleLocationPick = (loc) => {
    onSelect(pickedDept, loc);   // → handleAddList(dept, location)
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}>
      <div
        className={`w-full max-w-[480px] ${sheet} rounded-t-3xl border-t flex flex-col`}
        style={{ maxHeight: '75dvh', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className={`w-10 h-1 rounded-full ${handle}`} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pb-3 flex-shrink-0">
          {step === 2 && (
            <button onClick={() => setStep(1)}
              className={`text-xs font-bold ${backBtn} flex items-center gap-1 flex-shrink-0`}>
              ‹ Буцах
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className={`text-base font-extrabold ${nameClr}`}>
              {step === 1 ? 'Ээлж сонгох' : `Төсөл сонгох — ${pickedDept?.name}`}
            </h2>
            <p className={`text-xs mt-0.5 ${subClr}`}>
              {step === 1
                ? 'Нэмэх хэлтсээ сонгоно уу'
                : 'Хаана байгаа ажилчдыг нэмэх вэ?'}
            </p>
          </div>
          {/* Step indicator */}
          <div className="flex gap-1 flex-shrink-0">
            {[1, 2].map((s) => (
              <div key={s} className={`w-1.5 h-1.5 rounded-full transition-all
                ${s === step ? 'bg-amber-500' : (dark ? 'bg-slate-600' : 'bg-slate-300')}`} />
            ))}
          </div>
        </div>

        {/* Step 1 — Department list */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
            {departments.length === 0 ? (
              <div className={`text-center py-12 text-sm ${subClr}`}>Хэлтсүүд ачаалж байна…</div>
            ) : (
              <div className={`divide-y ${divClr}`}>
                {departments.map((dept) => (
                  <button key={dept.id} onClick={() => handleDeptPick(dept)}
                    className={`w-full text-left px-5 py-3.5 transition-colors ${rowHov}`}>
                    <div className={`text-sm font-semibold ${nameClr}`}>{dept.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Location grid */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto px-4 pt-1" style={{ minHeight: 0 }}>
            <div className="grid grid-cols-2 gap-3 pb-4">
              {LOCATIONS.map((loc) => {
                const alreadyAdded = savedLists.some(
                  (l) => String(l.deptId) === String(pickedDept?.id) && l.location === loc.key,
                );
                return (
                  <button key={loc.key}
                    onClick={() => !alreadyAdded && handleLocationPick(loc)}
                    disabled={alreadyAdded}
                    className={`relative py-5 rounded-2xl border text-sm font-bold transition-all active:scale-95
                      ${alreadyAdded
                        ? (dark ? 'border-slate-700 text-slate-600 bg-slate-800/50' : 'border-slate-200 text-slate-300 bg-slate-50')
                        : `${locBtn} border shadow-sm`}`}
                  >
                    {loc.label}
                    {alreadyAdded && (
                      <span className={`absolute top-1.5 right-2 text-[10px] ${subClr}`}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3c. LIST SELECTOR SHEET  — AddEmployeeModal-style full bottom sheet
// ─────────────────────────────────────────────────────────────────────────────
function ListSelectorSheet({ savedLists, activeListId, dark, onSelect, onDelete, onClose }) {
  /* reuse the same keyboard + scroll-lock hooks as AddEmployeeModal */
  const keyboardOffset = useKeyboardOffset();
  useBodyScrollLock();

  const sheet   = dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const handle  = dark ? 'bg-slate-600' : 'bg-slate-300';
  const nameClr = dark ? 'text-slate-100' : 'text-slate-900';
  const subClr  = dark ? 'text-slate-400' : 'text-slate-500';
  const divClr  = dark ? 'divide-slate-700/50' : 'divide-slate-100';
  const listBg  = dark ? 'bg-slate-800' : 'bg-white';
  const listBox = dark ? 'border-slate-700' : 'border-slate-200';
  const actBg   = dark ? 'bg-amber-950/30' : 'bg-amber-50';
  const actTxt  = dark ? 'text-amber-400' : 'text-amber-700';
  const rowHov  = dark ? 'active:bg-slate-700/50' : 'active:bg-slate-50';
  const closeBtn= dark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100';
  const delBtn  = dark ? 'text-red-400 active:bg-red-900/30' : 'text-red-400 active:bg-red-50';

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[480px] ${sheet} rounded-t-3xl flex flex-col border-t`}
        style={{ height: '88dvh', marginBottom: keyboardOffset, willChange: 'transform', transform: 'translateZ(0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className={`w-10 h-1 rounded-full ${handle}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${sheet.split(' ')[1]} flex-shrink-0`}>
          <h2 className={`text-base font-extrabold ${nameClr}`}>Жагсаалт сонгох</h2>
          <button
            onClick={onClose}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors ${closeBtn}`}
          >
            ✕
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-3 pt-3" style={{ minHeight: 0, overscrollBehavior: 'contain' }}>
          {savedLists.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-20 text-sm ${subClr}`}>
              📋 Жагсаалт байхгүй байна
            </div>
          ) : (
            <div className={`rounded-xl border overflow-hidden ${listBox}`}>
              <div className={`divide-y ${divClr} ${listBg}`}>
                {savedLists.map((list) => {
                  const isActive = String(list.id) === String(activeListId);
                  return (
                    <div
                      key={list.id}
                      className={`flex items-center min-h-[52px] transition-colors ${isActive ? actBg : ''}`}
                    >
                      {/* Row tap → switch list */}
                      <button
                        onClick={() => { onSelect(list.id); onClose(); }}
                        className={`flex-1 text-left px-4 py-3.5 min-w-0 flex flex-col justify-center
                          ${isActive ? '' : rowHov}`}
                      >
                        <div className={`text-sm font-semibold truncate ${isActive ? actTxt : nameClr}`}>
                          {list.isMain ? '★ ' : ''}{list.name}
                        </div>
                        {list.locationLabel && (
                          <div className={`text-[11px] truncate mt-px ${isActive ? actTxt : subClr} opacity-80`}>
                            {list.locationLabel}
                          </div>
                        )}
                      </button>

                      {/* Active checkmark */}
                      {isActive && !list.isMain && (
                        <div className={`flex-shrink-0 text-base pr-1 ${actTxt}`}>✓</div>
                      )}
                      {isActive && list.isMain && (
                        <div className={`flex-shrink-0 text-base pr-4 ${actTxt}`}>✓</div>
                      )}

                      {/* Delete button — non-main lists only */}
                      {!list.isMain && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(list.id); }}
                          className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl mr-2
                            transition-colors ${delBtn}`}
                          title="Жагсаалт устгах"
                        >
                          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none"
                            stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                            <path d="M1 1l12 12M13 1L1 13" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ height: 16 }} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. EMPTY STATE  (previously 3)
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle, dark }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-5xl mb-4 opacity-70">{icon}</div>
      <div className={`text-base font-bold mb-1 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{title}</div>
      {subtitle && <div className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{subtitle}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DATE PICKER — premium custom calendar popup
// ─────────────────────────────────────────────────────────────────────────────
const CAL_MONTHS = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар',
                    '7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
const CAL_DOW    = ['Да','Мя','Лх','Пү','Ба','Бя','Ня'];   // Mon-first

function buildCalGrid(year, month) {
  const firstDow  = new Date(year, month, 1).getDay();      // 0=Sun
  const pad       = (firstDow + 6) % 7;                     // Mon-first offset
  const daysInMo  = new Date(year, month + 1, 0).getDate();
  const cells     = [];
  for (let i = pad - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month, -i), cur: false });
  for (let d = 1; d <= daysInMo; d++)
    cells.push({ date: new Date(year, month, d), cur: true });
  while (cells.length % 7 !== 0)
    cells.push({ date: new Date(year, month + 1, cells.length - pad - daysInMo + 1), cur: false });
  return cells;
}

function toIso(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function DatePicker({ value, onChange, dark, compact = false }) {
  const [open, setOpen]       = useState(false);
  const [animIn, setAnimIn]   = useState(false);
  const [view, setView]       = useState(() => {
    if (value) { const [y, m] = value.split('-'); return new Date(+y, +m - 1, 1); }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });
  const containerRef = useRef(null);

  /* sync view month when value changes externally */
  useEffect(() => {
    if (value) { const [y, m] = value.split('-'); setView(new Date(+y, +m - 1, 1)); }
  }, [value]);

  /* pop-in animation: render opacity-0 first, then flip after one frame */
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setAnimIn(true));
      return () => cancelAnimationFrame(id);
    }
    setAnimIn(false);
  }, [open]);

  /* close on outside click/touch */
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close, true);
    document.addEventListener('touchstart', close, true);
    return () => {
      document.removeEventListener('mousedown', close, true);
      document.removeEventListener('touchstart', close, true);
    };
  }, [open]);

  /* keyboard: Escape closes, Arrow keys navigate */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (!value) return;
      const cur = new Date(value + 'T00:00:00');
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (delta !== undefined) {
        e.preventDefault();
        const next = new Date(cur);
        next.setDate(next.getDate() + delta);
        setView(new Date(next.getFullYear(), next.getMonth(), 1));
        onChange({ target: { value: toIso(next) } });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, value, onChange]);

  const cells   = useMemo(() => buildCalGrid(view.getFullYear(), view.getMonth()), [view]);
  const todayMs = useMemo(() => { const t = new Date(); t.setHours(0,0,0,0); return t.getTime(); }, []);

  const selectDay = (date) => { onChange({ target: { value: toIso(date) } }); setOpen(false); };
  const prevMonth = () => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1));
  const nextMonth = () => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1));
  const goToday   = () => { const t = new Date(); setView(new Date(t.getFullYear(), t.getMonth(), 1)); selectDay(t); };

  const displayText = useMemo(() => {
    if (!value) return compact ? 'Огноо' : 'Огноо сонгох';
    const [y, m, d] = value.split('-');
    return compact ? `${m}/${d}` : `${y} / ${m} / ${d}`;
  }, [value, compact]);

  /* ── theme tokens ── */
  const tk = dark ? {
    trigger:  'bg-slate-700 border-slate-600 text-slate-100 hover:bg-slate-600/80',
    popup:    'bg-slate-800 border-slate-700/50',
    shadow:   '0 16px 48px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)',
    hdr:      'text-slate-100',
    navBtn:   'text-slate-500 hover:text-slate-200 hover:bg-slate-700',
    dayHdr:   'text-slate-600',
    day:      'text-slate-300 hover:bg-slate-700',
    dayOther: 'text-slate-700 hover:bg-slate-700/50',
    daySel:   'bg-amber-500 text-slate-900 font-bold shadow-lg shadow-amber-500/30 hover:bg-amber-400',
    dayToday: 'ring-1 ring-amber-400/80 text-amber-400 font-semibold',
    dayWknd:  'text-slate-400',
    divider:  'border-slate-700/60',
    todayBtn: 'text-amber-400 hover:text-amber-300',
    clearBtn: 'text-slate-600 hover:text-slate-400',
  } : {
    trigger:  'bg-white border-slate-300 text-slate-900 hover:bg-slate-50',
    popup:    'bg-white border-slate-200/70',
    shadow:   '0 16px 48px rgba(15,23,42,0.10), 0 4px 16px rgba(15,23,42,0.06)',
    hdr:      'text-slate-800',
    navBtn:   'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
    dayHdr:   'text-slate-400',
    day:      'text-slate-700 hover:bg-slate-100',
    dayOther: 'text-slate-300 hover:bg-slate-50',
    daySel:   'bg-amber-500 text-white font-bold shadow-md shadow-amber-500/25 hover:bg-amber-600',
    dayToday: 'ring-1 ring-amber-400 text-amber-600 font-semibold',
    dayWknd:  'text-slate-500',
    divider:  'border-slate-100',
    todayBtn: 'text-amber-600 hover:text-amber-700',
    clearBtn: 'text-slate-400 hover:text-slate-600',
  };

  const h = compact ? 34 : 44;

  return (
    <div
      ref={containerRef}
      className={`relative flex-shrink-0 ${compact ? 'w-[76px]' : 'flex-1'}`}
    >
      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen((p) => !p)}
        className={`w-full flex items-center gap-1.5 rounded-lg border px-2 cursor-pointer
          transition-colors text-xs font-semibold ${tk.trigger}`}
        style={{ height: h }}
        aria-label="Огноо сонгох"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-50" fill="none" viewBox="0 0 20 20"
          stroke="currentColor" strokeWidth={1.8}>
          <rect x="2" y="3" width="16" height="16" rx="3" />
          <line x1="14" y1="1" x2="14" y2="5" />
          <line x1="6"  y1="1" x2="6"  y2="5" />
          <line x1="2"  y1="8" x2="18" y2="8" />
        </svg>
        <span className="flex-1 truncate text-left">{displayText}</span>
      </button>

      {/* ── Calendar popup ── */}
      {open && (
        <div
          role="dialog"
          aria-label="Календар"
          className={`absolute top-full left-0 mt-2 z-[60] rounded-2xl border overflow-hidden
            transition-all duration-150 ease-out ${tk.popup}
            ${animIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          style={{ width: 268, transformOrigin: 'top left', boxShadow: tk.shadow }}
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
            <button
              onClick={prevMonth}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${tk.navBtn}`}
              aria-label="Өмнөх сар"
            >
              <svg viewBox="0 0 6 10" className="w-1.5 h-2.5" fill="none"
                stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 1L1 5l4 4" />
              </svg>
            </button>

            <span className={`text-sm font-semibold select-none ${tk.hdr}`}>
              {CAL_MONTHS[view.getMonth()]} {view.getFullYear()}
            </span>

            <button
              onClick={nextMonth}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${tk.navBtn}`}
              aria-label="Дараах сар"
            >
              <svg viewBox="0 0 6 10" className="w-1.5 h-2.5" fill="none"
                stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 1l4 4-4 4" />
              </svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 px-2.5 pb-1">
            {CAL_DOW.map((d) => (
              <div key={d} className={`text-center text-[10px] font-semibold py-0.5 ${tk.dayHdr}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Date grid */}
          <div className="grid grid-cols-7 px-2.5 pb-2.5 gap-px">
            {cells.map(({ date, cur }, i) => {
              const iso     = toIso(date);
              const isSel   = value === iso;
              const isToday = date.getTime() === todayMs;
              const isWknd  = date.getDay() === 0 || date.getDay() === 6;

              let cls = 'w-full aspect-square flex items-center justify-center text-[12.5px] rounded-lg transition-all duration-100 select-none ';
              if (isSel)        cls += tk.daySel;
              else if (isToday) cls += tk.dayToday + ' ' + (!cur ? tk.dayOther : '');
              else if (!cur)    cls += tk.dayOther;
              else if (isWknd)  cls += tk.dayWknd + ' ' + (dark ? 'hover:bg-slate-700' : 'hover:bg-slate-100');
              else              cls += tk.day;

              return (
                <button
                  key={i}
                  onClick={() => selectDay(date)}
                  tabIndex={cur ? 0 : -1}
                  className={cls}
                  aria-label={iso}
                  aria-pressed={isSel}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-between px-3.5 py-2.5 border-t ${tk.divider}`}>
            <button
              onClick={goToday}
              className={`text-[11px] font-semibold transition-colors ${tk.todayBtn}`}
            >
              Өнөөдөр
            </button>
            {value && (
              <button
                onClick={() => { onChange({ target: { value: '' } }); setOpen(false); }}
                className={`text-[11px] font-medium transition-colors ${tk.clearBtn}`}
              >
                Цэвэрлэх
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MAIN KITCHEN VIEW
// ─────────────────────────────────────────────────────────────────────────────
function KitchenView() {
  const { userDept, userLocation, userName, userLastName, userJobTitle, logout } = useAuth();

  /* ── filter state ── */
  const [departments, setDepartments]           = useState([]);
  const [selectedDept, setSelectedDept]         = useState('');
  const [selectedDeptName, setSelectedDeptName] = useState('');
  const [selectedDate, setSelectedDate]         = useState(new Date().toISOString().split('T')[0]);
  const [selectedMeal, setSelectedMeal]         = useState(DEFAULT_MEAL);

  /* ── saved lists ── */
  const [savedLists, setSavedLists]       = useState(loadSavedLists);
  const [activeListId, setActiveListId]   = useState('');
  const [showListPicker, setShowListPicker] = useState(false);
  const [showListSheet, setShowListSheet]   = useState(false);
  const [addingList, setAddingList]         = useState(false);

  /* ── UI state ── */
  const [selectedIds, setSelectedIds]   = useState([]);
  const [showAddModal, setShowAddModal]       = useState(false);
  const [showShiftModal, setShowShiftModal]   = useState(false);
  const [showOrderSheet, setShowOrderSheet]   = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [darkMode, setDarkMode]         = useState(false);
  const [didAutoInit, setDidAutoInit]   = useState(false);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef(null);

  const { toast, showToast, hideToast } = useToast();

  /* ── employee data ── */
  const {
    employees,
    setEmployees,
    favorites,
    setFavorites,
    hiddenIds,
    setHiddenIds,
    extraEmployees,
    setExtraEmployees,
    loading,
    loadEmployees,
  } = useEmployees({
    selectedDept,
    selectedDate,
    selectedMeal,
    locationFilter: savedLists.find((l) => String(l.id) === activeListId)?.location ?? userLocation ?? '',
  });

  /* ── full-page dark mode ── */
  useEffect(() => {
    document.documentElement.setAttribute('data-dark', darkMode ? 'true' : 'false');
    document.body.style.backgroundColor = darkMode ? '#0f172a' : '';
    return () => {
      document.documentElement.setAttribute('data-dark', 'false');
      document.body.style.backgroundColor = '';
    };
  }, [darkMode]);

  /* ── theme tokens ── */
  const d = useMemo(() => darkMode
    ? {
        page:    'bg-slate-900 text-slate-100',
        header:  'bg-slate-800 border-slate-700',
        input:   'bg-slate-700 border-slate-600 text-slate-100',
        chip:    'bg-slate-700 text-slate-300 border-slate-700',
        chipAct: 'bg-amber-500 text-slate-900 border-amber-500',
        sub:     'text-slate-400',
        bottom:  'bg-slate-800 border-slate-700',
        tab:     'bg-slate-700 text-slate-300',
        tabAct:  'bg-amber-500 text-slate-900',
        divBtn:  'bg-slate-700 border-slate-600 text-slate-300',
        selTxt:  'text-amber-400',
        listBox: 'border-slate-700',
        listDiv: 'divide-slate-700/50',
        selAll:  'text-amber-400',
        chkAll:  'border-slate-600',
      }
    : {
        page:    'bg-slate-100 text-slate-900',
        header:  'bg-white border-slate-200',
        input:   'bg-white border-slate-300 text-slate-900',
        chip:    'bg-slate-200 text-slate-600 border-slate-200',
        chipAct: 'bg-amber-500 text-white border-amber-500',
        sub:     'text-slate-500',
        bottom:  'bg-white border-slate-200',
        tab:     'bg-slate-200 text-slate-600',
        tabAct:  'bg-amber-500 text-white',
        divBtn:  'bg-slate-100 border-slate-300 text-slate-700',
        selTxt:  'text-amber-700',
        listBox: 'border-slate-200',
        listDiv: 'divide-slate-100',
        selAll:  'text-amber-700',
        chkAll:  'border-slate-300',
      },
  [darkMode]);

  /* ── always fetch full dept list (needed for DeptPickerModal) ── */
  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => {});
  }, []);

  /* ── seed main list from user's own dept (runs once when userDept is known) ── */
  useEffect(() => {
    if (!userDept) return;
    setSavedLists((prev) => {
      if (prev.some((l) => l.isMain)) return prev;   // already seeded
      const locLabel = LOCATIONS.find((l) => l.key === (userLocation || ''))?.label || '';
      const main = {
        id:            String(userDept.id),
        deptId:        String(userDept.id),
        name:          userDept.name,
        isMain:        true,
        location:      userLocation || '',
        locationLabel: locLabel,
      };
      const updated = [main, ...prev];
      persistLists(updated);
      return updated;
    });
  }, [userDept, userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── sync activeListId → selectedDept/Name ── */
  useEffect(() => {
    if (!activeListId) {
      if (savedLists.length > 0) {
        const main = savedLists.find((l) => l.isMain) || savedLists[0];
        setActiveListId(String(main.id));
      }
      return;
    }
    const list = savedLists.find((l) => String(l.id) === activeListId);
    if (!list) return;
    setSelectedDept(list.deptId || list.id);   // use actual dept id for API call
    setSelectedDeptName(list.name);
  }, [activeListId, savedLists]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── auto-select all on first load ── */
  useEffect(() => {
    if (didAutoInit || favorites.length > 0 || employees.length === 0) return;
    const ids = employees.map((e) => e.id);
    setFavorites(ids);
    ids.forEach((id) => saveFavoriteApi(id).catch(() => {}));
    setDidAutoInit(true);
  }, [employees, favorites, didAutoInit, setFavorites]);

  /* ── auto-select ALL employees whenever the main list loads ── */
  useEffect(() => {
    if (!employees.length) return;
    setSelectedIds((prev) => {
      const toAdd = employees.filter((e) => !e.is_swiped && !prev.includes(e.id)).map((e) => e.id);
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
  }, [employees]);

  /* ── auto-select new extras ── */
  useEffect(() => {
    if (!extraEmployees.length) return;
    setSelectedIds((prev) => {
      const toAdd = extraEmployees.filter((e) => !e.is_swiped && !prev.includes(e.id)).map((e) => e.id);
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
  }, [extraEmployees]);

  /* ── infinite-scroll sentinel ── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount((n) => n + BATCH_SIZE); },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── derived ── */
  const isFavoriteEligible = useCallback(
    (emp) => {
      if (!emp?.is_extra) return false;
      if (emp.extra_type === 'rental') return true;
      if (emp.extra_type === 'sunasan' && emp.dept_name && emp.dept_name !== selectedDeptName) return true;
      return false;
    },
    [selectedDeptName],
  );

  const allEmployees = useMemo(() => {
    const base   = employees.filter((e) => !hiddenIds.includes(e.id));
    const extras = extraEmployees.filter((e) => !base.find((b) => b.id === e.id) && !hiddenIds.includes(e.id));
    return [...base, ...extras].sort((a, b) => {
      const af = favorites.includes(a.id), bf = favorites.includes(b.id);
      if (af !== bf) return af ? -1 : 1;
      const jc = (a.job_title || '').localeCompare(b.job_title || '', 'mn');
      if (jc !== 0) return jc;
      return (a.last_name || '').localeCompare(b.last_name || '', 'mn');
    });
  }, [employees, extraEmployees, hiddenIds, favorites]);

  const filteredEmployees = allEmployees;

  const visibleEmployees     = useMemo(() => filteredEmployees.slice(0, visibleCount), [filteredEmployees, visibleCount]);
  const visibleSelectedCount = useMemo(() => selectedIds.filter((id) => filteredEmployees.some((e) => e.id === id)).length, [selectedIds, filteredEmployees]);
  const allVisibleSelected   = useMemo(() => {
    const ids = filteredEmployees.filter((e) => !e.is_swiped).map((e) => e.id);
    return ids.length > 0 && ids.every((id) => selectedIds.includes(id));
  }, [filteredEmployees, selectedIds]);

  /* ── handlers ── */

  const handleSwitchList = (listId) => {
    if (listId === activeListId) return;
    setEmployees([]);
    setSelectedIds([]);
    setVisibleCount(BATCH_SIZE);
    setActiveListId(listId);
  };

  const handleAddList = async (dept, location) => {
    setShowListPicker(false);
    setAddingList(true);
    const listId = `${dept.id}_${location.key}`;
    // Guard against duplicate
    if (savedLists.some((l) => l.id === listId)) {
      showToast('Энэ жагсаалт аль хэдийн нэмэгдсэн байна', 'error');
      setAddingList(false);
      return;
    }
    try {
      // Fetch employees, then filter by location on the frontend
      const data = await fetchEmployeesApi(String(dept.id), selectedDate, selectedMeal);
      const emps = (data.employees || []).filter((e) =>
        !location.key || e.location?.trim().toLowerCase() === location.key.trim().toLowerCase()
      );
      await Promise.allSettled(emps.map((e) => saveFavoriteApi(e.id)));
      if (emps.length) {
        setFavorites((p) => [...new Set([...p, ...emps.map((e) => e.id)])]);
      }
      const newList = {
        id:            listId,
        deptId:        String(dept.id),
        name:          dept.name,
        isMain:        false,
        location:      location.key,
        locationLabel: location.label,
      };
      setSavedLists((prev) => {
        const updated = [...prev, newList];
        persistLists(updated);
        return updated;
      });
      setActiveListId(listId);
      showToast(`"${dept.name} · ${location.label}" жагсаалт нэмэгдлээ ✓`);
    } catch {
      showToast('Жагсаалт нэмэхэд алдаа гарлаа', 'error');
    } finally {
      setAddingList(false);
    }
  };

  const handleRemoveList = (listId) => {
    const updated = savedLists.filter((l) => String(l.id) !== listId);
    persistLists(updated);
    setSavedLists(updated);
    if (activeListId === listId) {
      const next = updated.find((l) => l.isMain) || updated[0];
      if (next) {
        setActiveListId(String(next.id));
      } else {
        setActiveListId('');
        setSelectedDept('');
        setSelectedDeptName('');
      }
    }
  };

  const handleToggle = useCallback((id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const handleSelectAll = () => {
    const ids = filteredEmployees.filter((e) => !e.is_swiped).map((e) => e.id);
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const handleRemoveFav = useCallback((empId) => {
    // Remove from favorites AND hide from list — prevents employee from
    // reappearing at the bottom of the sorted list as a non-favorite.
    Promise.all([removeFavoriteApi(empId), hideEmployeeApi(empId)])
      .then(() => {
        setFavorites((p) => p.filter((id) => id !== empId));
        setSelectedIds((p) => p.filter((id) => id !== empId));
        setHiddenIds((p) => [...new Set([...p, empId])]);
      })
      .catch(() => showToast('Хасахад алдаа гарлаа', 'error'));
  }, [setFavorites, setHiddenIds, showToast]);

  const handleRemoveExtra = useCallback((empId) => {
    removeExtraApi(empId)
      .then(() => setExtraEmployees((p) => p.filter((e) => e.id !== empId)))
      .catch(() => showToast('Хасахад алдаа гарлаа', 'error'));
  }, [setExtraEmployees, showToast]);

  const handleSaveFav = useCallback((empId) => {
    const emp = [...employees, ...extraEmployees].find((e) => e.id === empId);
    if (!isFavoriteEligible(emp)) return;
    saveFavoriteApi(empId)
      .then(() => setFavorites((p) => p.includes(empId) ? p : [...p, empId]))
      .catch(() => showToast('Хадгалахад алдаа гарлаа', 'error'));
  }, [employees, extraEmployees, isFavoriteEligible, setFavorites, showToast]);

  const handleHide = useCallback((empId) => {
    hideEmployeeApi(empId)
      .then(() => { setHiddenIds((p) => [...new Set([...p, empId])]); setSelectedIds((p) => p.filter((id) => id !== empId)); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  }, [setHiddenIds, showToast]);

  const handleAddEmployee = (emp, tab) => {
    setExtraEmployees((prev) =>
      prev.find((e) => e.id === emp.id) ? prev : [...prev, { ...emp, is_extra: true, extra_type: tab, is_swiped: false }],
    );
    setSelectedIds((prev) => prev.includes(emp.id) ? prev : [...prev, emp.id]);
    saveExtraEmployee(emp, tab).catch(() => {});
  };

  const handleSaveShift = () => {
    const ids = selectedIds
      .map((id) => [...employees, ...extraEmployees].find((e) => e.id === id))
      .filter((emp) => emp && isFavoriteEligible(emp))
      .map((emp) => emp.id);
    if (!ids.length) { showToast('Хадгалах боломжтой ажилтан сонгоогүй', 'error'); return; }
    Promise.all(ids.map(saveFavoriteApi))
      .then(() => { setFavorites((p) => [...new Set([...p, ...ids])]); showToast('Ээлж хадгалагдлаа ✓'); })
      .catch(() => showToast('Ээлж хадгалахад алдаа гарлаа', 'error'));
  };

  const handleRefreshShift = () => {
    if (!window.confirm('Та ээлжээ шинэчлэх үү?')) return;
    clearAllMyEmployees()
      .then(() => { setFavorites([]); setExtraEmployees([]); setHiddenIds([]); setSelectedIds([]); loadEmployees(); showToast('Ээлж шинэчлэгдлээ'); })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  const _submitOrder = () => {
    const ids = selectedIds.filter((id) => filteredEmployees.some((e) => e.id === id));
    if (!ids.length) return Promise.reject(new Error('empty'));
    return createOrder(selectedDate, selectedMeal, ids);
  };

  const handleSubmitOrder = () => {
    setSubmittingOrder(true);
    _submitOrder()
      .then(() => {
        showToast('Захиалга амжилттай илгээгдлээ ✓');
        loadEmployees();
        setShowOrderSheet(false);
      })
      .catch(() => showToast('Захиалга илгээхэд алдаа гарлаа', 'error'))
      .finally(() => setSubmittingOrder(false));
  };

  const handleSubmitAndNew = () => {
    setSubmittingOrder(true);
    _submitOrder()
      .then(() => clearAllMyEmployees())
      .then(() => {
        setFavorites([]);
        setExtraEmployees([]);
        setHiddenIds([]);
        setSelectedIds([]);
        setShowOrderSheet(false);
        loadEmployees();
        showToast('Захиалга илгээгдлээ. Шинэ ээлж эхэллээ ✓');
      })
      .catch(() => showToast('Алдаа гарлаа', 'error'))
      .finally(() => setSubmittingOrder(false));
  };

  const fullName = [userLastName, userName].filter(Boolean).join(' ');

  /* ── render ── */
  return (
    <div
      className={`min-h-screen ${d.page} font-sans`}
      style={{ paddingBottom: 'max(76px, calc(76px + env(safe-area-inset-bottom)))' }}
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* ═══ STICKY TOP HEADER — ultra compact ════════════════════════════ */}
      <div className={`sticky top-0 z-30 ${d.header} border-b`}>

        {/* Row 1 — user · role · dark toggle · logout  (single line, ~34px) */}
        <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5 min-w-0">
          <div className="flex-1 flex items-baseline gap-1.5 min-w-0">
            <span className={`text-sm font-bold truncate leading-none ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              {fullName || 'Хоол захиалга'}
            </span>
            {(userJobTitle || fullName) && (
              <span className={`text-[11px] truncate leading-none flex-shrink-0 ${d.sub}`}>
                · {userJobTitle || 'Ээлжийн ахлах'}
              </span>
            )}
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode((p) => !p)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-base border flex-shrink-0 ${d.divBtn}`}
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Logout — door icon */}
          <button
            onClick={logout}
            className={`w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0 ${d.divBtn}`}
            aria-label="Гарах"
            title="Гарах"
          >
            <svg viewBox="0 0 18 18" className="w-4 h-4" fill="none"
              stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              {/* Door frame */}
              <path d="M7 2H3a1 1 0 00-1 1v12a1 1 0 001 1h4" />
              {/* Arrow pointing right (exit) */}
              <path d="M12 13l3-4-3-4" />
              <line x1="15" y1="9" x2="7" y2="9" />
            </svg>
          </button>
        </div>

        {/* Row 2 — date + list dropdown + add button */}
        <div className="flex items-center gap-1.5 px-3 pb-1.5">
          <DatePicker value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} dark={darkMode} compact />

          {/* List selector — tap to open sheet */}
          <button
            onClick={() => setShowListSheet(true)}
            className={`flex-1 min-w-0 rounded-lg border px-2.5 text-xs font-semibold text-left
              flex items-center gap-1.5 ${d.input} active:opacity-80`}
            style={{ height: 34 }}
          >
            <span className="flex-1 truncate">
              {savedLists.length === 0
                ? '— Жагсаалт байхгүй —'
                : (() => {
                    const a = savedLists.find((l) => String(l.id) === activeListId);
                    if (!a) return '— Сонгоно уу —';
                    return `${a.isMain ? '★ ' : ''}${a.name}${a.locationLabel ? ` · ${a.locationLabel}` : ''}`;
                  })()}
            </span>
            {/* Chevron */}
            <svg viewBox="0 0 10 6" className="w-2.5 h-2.5 flex-shrink-0 opacity-50" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M1 1l4 4 4-4" />
            </svg>
          </button>

          {/* Add new list */}
          <button
            onClick={() => setShowListPicker(true)}
            disabled={addingList}
            className={`flex-shrink-0 w-[34px] h-[34px] rounded-lg border text-sm font-bold flex items-center justify-center ${d.divBtn} active:scale-95`}
            title="Нэмэлт жагсаалт нэмэх"
          >
            {addingList ? '…' : '＋'}
          </button>
        </div>

        {/* Row 3 — meal tabs  (~32px, text-xs) */}
        <div className="flex gap-1 px-3 pb-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {Object.entries(MEAL_SHORT_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedMeal(key)}
              className={`flex-shrink-0 px-3 rounded-lg text-xs font-bold transition-all
                ${selectedMeal === key ? `${d.tabAct} shadow-sm` : d.tab}`}
              style={{ height: 30, minWidth: 56 }}
            >
              {label}
            </button>
          ))}
        </div>

      </div>

      {/* ═══ CONTENT ════════════════════════════════════════════════════════ */}
      <div className="px-3 pt-2">

        {!activeListId && (
          <EmptyState icon="📋" title="Жагсаалт нэмэнэ үү" subtitle="＋ товч дарж хэлтэс нэмнэ үү" dark={darkMode} />
        )}

        {/* Skeleton — compact rows inside bordered box */}
        {activeListId && loading && (
          <div className={`rounded-xl border overflow-hidden ${d.listBox}`}>
            <div className={`divide-y ${d.listDiv}`}>
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonRow key={i} dark={darkMode} />
              ))}
            </div>
          </div>
        )}

        {activeListId && !loading && filteredEmployees.length > 0 && (
          <>
            {/* ── Select-all bar (compact) ── */}
            <div className="flex items-center justify-between px-1 mb-1.5" style={{ minHeight: 32 }}>
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2"
                style={{ minHeight: 36 }}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                  ${allVisibleSelected
                    ? 'bg-amber-500 border-amber-500'
                    : `${d.chkAll} ${darkMode ? 'bg-transparent' : 'bg-white'}`}`}
                >
                  {allVisibleSelected && <CheckIcon />}
                </div>
                <span className={`text-xs font-bold ${d.selAll}`}>Бүгдийг сонгох</span>
              </button>
              <span className={`text-xs font-semibold ${d.sub}`}>
                {filteredEmployees.length} ажилтан
              </span>
            </div>

            {/* ── Compact list — bordered box with divide-y separators ── */}
            <div className={`rounded-xl border overflow-hidden ${d.listBox}`}>
              <div className={`divide-y ${d.listDiv} ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                {visibleEmployees.map((emp) => (
                  <EmployeeCard
                    key={emp.id}
                    emp={emp}
                    isSelected={selectedIds.includes(emp.id)}
                    isFav={favorites.includes(emp.id)}
                    dark={darkMode}
                    onToggle={handleToggle}
                    onRemoveFav={handleRemoveFav}
                    onRemoveExtra={handleRemoveExtra}
                    onSaveFav={handleSaveFav}
                    onHide={handleHide}
                    isFavoriteEligible={isFavoriteEligible}
                  />
                ))}
              </div>
            </div>

            {/* Infinite scroll sentinel */}
            {visibleCount < filteredEmployees.length && (
              <div ref={sentinelRef} className="py-2 text-center">
                <span className={`text-xs ${d.sub}`}>
                  {filteredEmployees.length - visibleCount} ажилтан үлдсэн…
                </span>
              </div>
            )}
          </>
        )}

        {activeListId && !loading && filteredEmployees.length === 0 && allEmployees.length > 0 && (
          <EmptyState icon="🔍" title="Тохирох ажилтан олдсонгүй" dark={darkMode} />
        )}

        {activeListId && !loading && allEmployees.length === 0 && (
          <EmptyState icon="📭" title="Захиалга олдсонгүй" subtitle="Энэ хэлтсийн мэдээлэл олдсонгүй" dark={darkMode} />
        )}
      </div>

      {/* ═══ FLOATING ACTION BAR ════════════════════════════════════════════ */}
      {/* Outer: full-width fixed, pointer-events-none so gaps are click-through */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none px-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {/* Inner: max-width floating card, centered */}
        <div
          className={`pointer-events-auto mx-auto rounded-2xl border ${d.bottom}
            flex items-center gap-2 px-3 py-2`}
          style={{
            maxWidth: 640,
            boxShadow: darkMode
              ? '0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.5)'
              : '0 0 0 1px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.10)',
          }}
        >
          {/* Secondary: refresh shift — icon-only on narrow, text on wider */}
          <button
            onClick={() => setShowShiftModal(true)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border
              text-xs font-bold ${d.divBtn} active:scale-95 transition-transform whitespace-nowrap`}
            style={{ minHeight: 38 }}
            title="Ээлж шинэчлэх"
          >
            <span>🔄</span>
            <span className="hidden sm:inline">Ээлж</span>
          </button>

          {/* Secondary: add employee */}
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!activeListId || loading}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl border
              text-xs font-bold active:scale-95 transition-transform whitespace-nowrap
              ${!activeListId || loading
                ? (darkMode ? 'bg-slate-700 border-slate-600 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400')
                : 'bg-blue-600 border-blue-600 text-white active:bg-blue-700'}`}
            style={{ minHeight: 38 }}
          >
            ＋<span className="hidden sm:inline"> Нэмэх</span>
          </button>

          {/* Spacer + selection count */}
          <div className={`flex-1 min-w-0 text-xs font-semibold truncate ${d.sub} px-1`}>
            {visibleSelectedCount > 0
              ? <span className={d.selTxt}>{visibleSelectedCount} сонгогдсон</span>
              : <span className="opacity-50">Сонгоогүй</span>}
          </div>

          {/* Primary CTA */}
          <button
            onClick={() => visibleSelectedCount > 0 && setShowOrderSheet(true)}
            disabled={visibleSelectedCount === 0}
            className={`flex-shrink-0 px-5 py-2.5 rounded-xl font-extrabold text-sm
              transition-all whitespace-nowrap
              ${visibleSelectedCount > 0
                ? 'bg-amber-500 active:bg-amber-600 text-slate-900 shadow-md shadow-amber-500/30 active:scale-95'
                : darkMode
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            style={{ minHeight: 38 }}
          >
            Захиалга илгээх
          </button>
        </div>
      </div>

      {showListSheet && (
        <ListSelectorSheet
          savedLists={savedLists}
          activeListId={activeListId}
          dark={darkMode}
          onSelect={handleSwitchList}
          onDelete={(id) => { handleRemoveList(id); }}
          onClose={() => setShowListSheet(false)}
        />
      )}

      {showListPicker && (
        <DeptPickerModal
          departments={departments}
          savedLists={savedLists}
          dark={darkMode}
          onSelect={handleAddList}
          onClose={() => setShowListPicker(false)}
        />
      )}

      {showOrderSheet && (
        <OrderActionSheet
          count={visibleSelectedCount}
          dark={darkMode}
          submitting={submittingOrder}
          onSend={handleSubmitOrder}
          onSendAndNew={handleSubmitAndNew}
          onLogout={logout}
          onClose={() => !submittingOrder && setShowOrderSheet(false)}
        />
      )}

      {showAddModal && (
        <AddEmployeeModal
          onAdd={handleAddEmployee}
          onClose={() => setShowAddModal(false)}
          favorites={favorites}
          dark={darkMode}
        />
      )}

      {showShiftModal && (
        <ShiftManagerModal
          dark={darkMode}
          employees={employees}
          extraEmployees={extraEmployees}
          favorites={favorites}
          hiddenIds={hiddenIds}
          onClose={() => setShowShiftModal(false)}
          onAddEmployee={handleAddEmployee}
          onFavoritesChanged={(newFavs, newHidden) => {
            setFavorites(newFavs);
            setHiddenIds(newHidden);
            // drop newly-hidden employees from selection
            setSelectedIds((prev) => prev.filter((id) => !newHidden.includes(id)));
            showToast('Ээлж шинэчлэгдлээ ✓');
          }}
          onExtrasRemoved={(ids) => {
            setExtraEmployees((prev) => prev.filter((e) => !ids.includes(e.id)));
            setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
            showToast(`${ids.length} ажилтан хасагдлаа`);
          }}
        />
      )}
    </div>
  );
}

export default KitchenView;
