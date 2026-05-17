/**
 * AddEmployeeModal.jsx — Stable Mobile Bottom-Sheet
 *
 * Mobile stability fixes applied:
 *  • Fixed sheet height (88dvh) — keyboard cannot resize the modal
 *  • visualViewport API — sheet translates UP when keyboard appears (Android Chrome)
 *  • Scroll container ref — scrolls to top on new results only, not on cart changes
 *  • useMemo for visibleResults + cartIds — prevents card remounting
 *  • useCallback for all cart handlers — stable references
 *  • Body scroll locked while modal is open
 *  • key={emp.id} on every card — no index-based keys
 *  • Results area: overflow-y auto + min-height 0 (flex child shrink fix)
 *  • No auto-focus on tab switch (prevents keyboard flash / layout jump)
 *  • will-change: transform on sheet for GPU compositing
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fetchRentalEmployees, searchEmployees } from '../../services/employees';

const LIVE_SEARCH_DELAY = 350;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_STEP         = 10;

/* ─── visualViewport keyboard offset hook ───────────────────────────────────
 * Returns how many px the keyboard has pushed the visual viewport up.
 * On Android Chrome, typing in an input shrinks visualViewport.height;
 * we translate the sheet up by that amount so it stays fully visible.
 */
function useKeyboardOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // layoutViewport top – visualViewport top gives the keyboard height
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setOffset(kb);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update(); // run once on mount
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return offset;
}

/* ─── body scroll lock ──────────────────────────────────────────────────── */
function useBodyScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function AddEmployeeModal({ onAdd, onClose, favorites = [], dark = false }) {
  const [tab,          setTab]          = useState('sunasan');
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState([]);
  const [searching,    setSearching]    = useState(false);
  const [displayCount, setDisplayCount] = useState(DEFAULT_PAGE_SIZE);

  /* cart: Map<empId, { emp, tab }> */
  const [cart, setCart] = useState(new Map());

  const abortRef    = useRef(null);
  const inputRef    = useRef(null);
  const debounceRef = useRef(null);
  const scrollRef   = useRef(null); // results scroll container

  const keyboardOffset = useKeyboardOffset();
  useBodyScrollLock();

  /* ── theme ─────────────────────────────────────────────────────────────── */
  const d = dark
    ? {
        overlay:    'bg-slate-950/80',
        sheet:      'bg-slate-800',
        divider:    'border-slate-700',
        nameClr:    'text-slate-100',
        subClr:     'text-slate-400',
        tab:        'bg-slate-700 text-slate-300 border-slate-600',
        tabAct:     'bg-amber-500 text-slate-900 border-amber-500',
        input:      'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400',
        card:       'bg-slate-700 border-slate-600',
        cardHov:    'active:bg-slate-600',
        addBtn:     'bg-amber-500 text-slate-900',
        addedBtn:   'bg-green-700 text-green-200',
        empty:      'text-slate-500',
        closeBtn:   'text-slate-400 hover:text-slate-200 hover:bg-slate-700',
        bottom:     'bg-slate-800 border-slate-700',
        bulkBtn:    'bg-amber-500 text-slate-900',
        countBadge: 'bg-amber-500 text-slate-900',
        loadMore:   'border-slate-600 text-amber-400',
        stepperDis: 'border-slate-700 text-slate-600',
        stepperAct: 'border-slate-600 text-slate-300',
        stepperAdd: 'border-amber-500 text-amber-500',
        handle:     'bg-slate-600',
      }
    : {
        overlay:    'bg-slate-900/60',
        sheet:      'bg-white',
        divider:    'border-slate-200',
        nameClr:    'text-slate-900',
        subClr:     'text-slate-500',
        tab:        'bg-slate-100 text-slate-600 border-slate-200',
        tabAct:     'bg-amber-500 text-white border-amber-500',
        input:      'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
        card:       'bg-white border-slate-200',
        cardHov:    'active:bg-slate-50',
        addBtn:     'bg-amber-500 text-white',
        addedBtn:   'bg-green-100 text-green-700 border border-green-300',
        empty:      'text-slate-400',
        closeBtn:   'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
        bottom:     'bg-white border-slate-200',
        bulkBtn:    'bg-amber-500 text-white',
        countBadge: 'bg-amber-500 text-white',
        loadMore:   'border-slate-300 text-amber-600',
        stepperDis: 'border-slate-200 text-slate-300',
        stepperAct: 'border-slate-300 text-slate-600',
        stepperAdd: 'border-amber-500 text-amber-500',
        handle:     'bg-slate-300',
      };

  /* ── reset on tab switch ────────────────────────────────────────────────── */
  useEffect(() => {
    abortRef.current?.abort();
    clearTimeout(debounceRef.current);
    setResults([]);
    setQuery('');
    setSearching(false);
    setDisplayCount(DEFAULT_PAGE_SIZE);
    // scroll to top without jarring animation
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    return () => abortRef.current?.abort();
  }, [tab]);

  /* ── scroll to top when a NEW result set arrives ────────────────────────── */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [results]);

  /* ── core search ────────────────────────────────────────────────────────── */
  const execSearch = useCallback((q, currentTab) => {
    if (currentTab === 'sunasan' && !q.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);

    const promise = currentTab === 'sunasan'
      ? searchEmployees(q, ctrl.signal)
      : fetchRentalEmployees(q, ctrl.signal);

    promise
      .then((data) => {
        setResults(data);
        setSearching(false);
        setDisplayCount(DEFAULT_PAGE_SIZE);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setResults([]);
          setSearching(false);
        }
      });
  }, []);

  /* ── debounced live search ──────────────────────────────────────────────── */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => execSearch(query, tab), LIVE_SEARCH_DELAY);
    return () => clearTimeout(debounceRef.current);
  }, [query, tab, execSearch]);

  /* ── cart handlers (stable references via useCallback) ─────────────────── */
  const addToCart = useCallback((emp, currentTab) => {
    setCart((prev) => {
      if (prev.has(emp.id)) return prev;
      const next = new Map(prev);
      next.set(emp.id, { emp, tab: currentTab });
      return next;
    });
  }, []);

  const removeFromCart = useCallback((empId) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(empId);
      return next;
    });
  }, []);

  const handleBulkAdd = useCallback(() => {
    cart.forEach(({ emp, tab: empTab }) => onAdd(emp, empTab));
    onClose();
  }, [cart, onAdd, onClose]);

  /* ── derived / memoised ─────────────────────────────────────────────────── */

  // Set of cart ids — stable reference prevents card remounting
  const cartIds = useMemo(() => new Set(cart.keys()), [cart]);

  // Visible slice — recomputed only when results or displayCount changes
  const visibleResults = useMemo(
    () => results.slice(0, displayCount),
    [results, displayCount],
  );

  const cartCount  = cart.size;
  const hasMore    = tab === 'rental' && displayCount < results.length;
  const moreCount  = Math.min(PAGE_STEP, results.length - displayCount);

  /* ── sheet position — pushed up by keyboard height ─────────────────────── */
  const sheetStyle = {
    height:           '88dvh',        // fixed — keyboard cannot resize this
    bottom:           keyboardOffset, // slide up when keyboard appears
    willChange:       'transform',    // GPU layer — no repaint on translate
    transform:        'translateZ(0)',
  };

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────────── */
  return (
    /* Backdrop — intercepts taps outside the sheet */
    <div
      className={`fixed inset-0 z-40 ${d.overlay} backdrop-blur-sm flex items-end justify-center`}
      onClick={onClose}
    >
      {/* ── Bottom sheet ── */}
      <div
        className={`w-full max-w-[480px] ${d.sheet} rounded-t-3xl flex flex-col border-t ${d.divider}`}
        style={{ height: sheetStyle.height, marginBottom: sheetStyle.bottom, willChange: sheetStyle.willChange, transform: sheetStyle.transform }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className={`w-10 h-1 rounded-full ${d.handle}`} />
        </div>

        {/* ── Header ── */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${d.divider} flex-shrink-0`}>
          <h2 className={`text-base font-extrabold ${d.nameClr}`}>
            Ажилтан нэмэх
          </h2>
          <button
            onClick={onClose}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-colors ${d.closeBtn}`}
          >
            ✕
          </button>
        </div>

        {/* ── Tab switcher ── */}
        <div className={`flex gap-2 px-5 py-3 border-b ${d.divider} flex-shrink-0`}>
          {[
            { key: 'sunasan', label: '🔄 Сунасан' },
            { key: 'rental',  label: '🤝 Түрээсийн' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                tab === key ? d.tabAct : d.tab
              }`}
              style={{ minHeight: 44 }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Search input ── */}
        <div className={`px-5 py-3 border-b ${d.divider} flex-shrink-0`}>
          <div className="relative">
            {searching
              ? <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none select-none opacity-60">↻</span>
              : <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base pointer-events-none select-none">🔍</span>
            }
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Нэр бичих…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm font-medium ${d.input} focus:outline-none focus:ring-2 focus:ring-amber-500`}
              style={{ minHeight: 44 }}
            />
          </div>
        </div>

        {/* ── Results scroll area ──
            flex:1 + min-height:0 is the standard flexbox fix to allow
            overflow-y:auto to actually kick in on a flex child.
            Without min-height:0 the child grows past the container.     */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-2"
          style={{ minHeight: 0, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          {/* Skeleton */}
          {searching && (
            <div className="space-y-2 pt-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-16 rounded-xl animate-pulse ${dark ? 'bg-slate-700' : 'bg-slate-100'}`}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!searching && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <span className="text-4xl opacity-50">{query.trim() ? '🔍' : tab === 'rental' ? '🚛' : '🔎'}</span>
              <p className={`text-sm font-medium ${d.empty}`}>
                {query.trim() ? 'Ажилтан олдсонгүй' : 'Нэр бичиж эхэлнэ үү'}
              </p>
            </div>
          )}

          {/* Result list */}
          {!searching && results.length > 0 && (
            <div className="pb-4">

              {/* Rental page-size stepper */}
              {tab === 'rental' && (
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className={`text-xs font-semibold ${d.subClr}`}>
                    {Math.min(displayCount, results.length)} / {results.length} жолооч
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs ${d.subClr}`}>Хуудсанд:</span>
                    <button
                      onClick={() => setDisplayCount((n) => Math.max(PAGE_STEP, n - PAGE_STEP))}
                      disabled={displayCount <= PAGE_STEP}
                      className={`w-7 h-7 rounded-lg border text-sm font-bold flex items-center justify-center
                        ${displayCount <= PAGE_STEP ? d.stepperDis : d.stepperAct}`}
                    >−</button>
                    <span className={`text-sm font-extrabold min-w-[2rem] text-center ${d.nameClr}`}>
                      {Math.min(displayCount, results.length)}
                    </span>
                    <button
                      onClick={() => setDisplayCount((n) => Math.min(results.length, n + PAGE_STEP))}
                      disabled={displayCount >= results.length}
                      className={`w-7 h-7 rounded-lg border text-sm font-bold flex items-center justify-center
                        ${displayCount >= results.length ? d.stepperDis : d.stepperAdd}`}
                    >＋</button>
                  </div>
                </div>
              )}

              {/* Cards — stable keys, no remounting */}
              <div className="space-y-2">
                {visibleResults.map((emp) => (
                  <EmployeeCard
                    key={emp.id}
                    emp={emp}
                    isSavedFav={favorites.includes(emp.id) && tab === 'rental'}
                    inCart={cartIds.has(emp.id)}
                    dark={dark}
                    d={d}
                    currentTab={tab}
                    onAdd={addToCart}
                    onRemove={removeFromCart}
                  />
                ))}
              </div>

              {/* Load more button */}
              {hasMore && (
                <button
                  onClick={() => setDisplayCount((n) => Math.min(results.length, n + PAGE_STEP))}
                  className={`w-full mt-3 py-3 rounded-2xl border text-sm font-bold active:scale-95 transition-all ${d.loadMore}`}
                >
                  ＋{moreCount} жолооч нэмж харах
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Bulk-add bar ── */}
        {cartCount > 0 && (
          <div
            className={`flex-shrink-0 flex items-center gap-3 px-5 py-3 border-t ${d.divider} ${d.bottom}`}
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${d.countBadge}`}>
              {cartCount}
            </div>
            <div className={`flex-1 text-sm font-semibold ${d.subClr}`}>
              ажилтан сонгогдсон
            </div>
            <button
              onClick={handleBulkAdd}
              className={`flex-shrink-0 px-5 py-3 rounded-2xl text-sm font-extrabold shadow-lg active:scale-95 transition-transform ${d.bulkBtn}`}
              style={{ minHeight: 50 }}
            >
              Бүгдийг нэмэх ({cartCount})
            </button>
          </div>
        )}

        {/* Safe-area spacer when no bulk bar */}
        {cartCount === 0 && (
          <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   EMPLOYEE CARD — extracted to its own component so React can bail out of
   re-rendering cards whose props haven't changed (stable key + memo).
───────────────────────────────────────────────────────────────────────────── */
const EmployeeCard = React.memo(function EmployeeCard({
  emp, isSavedFav, inCart, dark, d, currentTab, onAdd, onRemove,
}) {
  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${d.cardHov}
        ${inCart
          ? (dark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-300')
          : d.card
        }`}
    >
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0
        ${dark ? 'bg-slate-600' : 'bg-slate-100'}`}>
        {inCart ? '✅' : isSavedFav ? '⭐' : '👤'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold truncate ${d.nameClr}`}>
          {emp.last_name} {emp.name}
          {isSavedFav && (
            <span className={`ml-1.5 text-xs font-semibold ${dark ? 'text-amber-400' : 'text-amber-600'}`}>
              (хадгалсан)
            </span>
          )}
        </div>
        <div className={`text-xs mt-0.5 truncate ${d.subClr}`}>
          {emp.dept_name}
          {emp.job_title && emp.dept_name ? ' · ' : ''}
          {emp.job_title}
        </div>
        {emp.card_number && (
          <div className={`text-xs font-mono mt-0.5 ${d.subClr}`}>
            🪪 {emp.card_number}
          </div>
        )}
      </div>

      {/* Action */}
      {inCart ? (
        <button
          onClick={() => onRemove(emp.id)}
          className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-extrabold active:scale-95 transition-transform ${d.addedBtn}`}
          style={{ minHeight: 44, minWidth: 96 }}
        >
          Нэмэгдсэн ✓
        </button>
      ) : (
        <button
          onClick={() => onAdd(emp, currentTab)}
          className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-extrabold ${d.addBtn} active:scale-95 transition-transform shadow-sm`}
          style={{ minHeight: 44, minWidth: 72 }}
        >
          Нэмэх
        </button>
      )}
    </div>
  );
});

export default AddEmployeeModal;
