import React, { useState } from 'react';
import { MEAL_LABELS, MEAL_SHORT_LABELS, STATE_LABELS } from '../../constants';
import MealPill  from '../dashboard/MealPill';
import SwipeBar  from '../dashboard/SwipeBar';
import { useReportData, REPORT_PAGE_SIZE } from './useReportData';
import { downloadFile, ordersToCSV, summaryToCSV } from './reportingUtils';
import { MEAL_ICONS } from '../dashboard/campOrdersConstants';

// ── Constants ─────────────────────────────────────────────────────────────────

const SUB_TABS = [
  { key: 'overview',    label: '📊 Ерөнхий' },
  { key: 'meal',        label: '🍽 Хоолоор' },
  { key: 'submitter',   label: '👤 Захиалагчаар' },
  { key: 'export',      label: '⬇️ Экспорт' },
];

const STATE_COLORS = {
  draft:     '#faad14',
  done:      '#52c41a',
  confirmed: '#13c2c2',
  canceled:  '#ff4d4f',
  unknown:   '#d9d9d9',
};

// ── Small presentational helpers ──────────────────────────────────────────────

/** Inline mini bar for tight table cells (thinner than SwipeBar). */
function MiniBar({ swiped, total }) {
  if (!total) return <span style={{ color: '#ddd', fontSize: 11 }}>—</span>;
  const pct = Math.round((swiped / total) * 100);
  const cls = swiped === total ? 'fill-full' : swiped > 0 ? 'fill-partial' : 'fill-none';
  return (
    <div className="mini-bar-wrap">
      <div className="mini-bar-track">
        <div className={`mini-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="mini-bar-label">{swiped}/{total} ({pct}%)</span>
    </div>
  );
}

/** Problem count pill — renders nothing when count is zero. */
function ProblemPill({ count }) {
  if (!count) return <span style={{ color: '#bbb', fontSize: 11 }}>—</span>;
  return <span className="problem-pill">⚠ {count}</span>;
}

/** Single KPI card reusing the dashboard .dash-kpi-card CSS. */
function KpiCard({ label, value, sub, cls, valueColor }) {
  return (
    <div className={`dash-kpi-card ${cls || ''}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

// ── State distribution stacked bar ────────────────────────────────────────────

function StateStackBar({ stateBreakdown, total }) {
  if (!total) return null;

  const segments = Object.entries(stateBreakdown)
    .filter(([, count]) => count > 0)
    .map(([state, count]) => ({ state, count, pct: Math.round((count / total) * 100) }));

  return (
    <div className="state-stack-wrap">
      <div className="state-stack">
        {segments.map(({ state, count }) => (
          <div
            key={state}
            className="state-stack-seg"
            style={{ flex: count, background: STATE_COLORS[state] || STATE_COLORS.unknown }}
            title={`${STATE_LABELS[state] || state}: ${count}`}
          />
        ))}
      </div>
      <div className="state-stack-legend">
        {segments.map(({ state, count, pct }) => (
          <span key={state} className="state-stack-legend-item">
            <span className="state-stack-dot" style={{ background: STATE_COLORS[state] || STATE_COLORS.unknown }} />
            {STATE_LABELS[state] || state} — {count} ({pct}%)
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function ReportFilterBar({ dateFrom, dateTo, mealFilter, onDateFrom, onDateTo, onMeal }) {
  return (
    <div className="report-filter-bar">
      <span className="report-filter-label">Хугацаа:</span>
      <input
        className="dash-date-input"
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFrom(e.target.value)}
      />
      <span style={{ fontSize: 12, color: '#aaa' }}>—</span>
      <input
        className="dash-date-input"
        type="date"
        value={dateTo}
        onChange={(e) => onDateTo(e.target.value)}
      />

      <span className="report-filter-label" style={{ marginLeft: 4 }}>Хоол:</span>
      <select
        className="dash-date-input"
        value={mealFilter}
        onChange={(e) => onMeal(e.target.value)}
        style={{ minWidth: 120 }}
      >
        <option value="">Бүх хоол</option>
        {Object.entries(MEAL_ICONS).map(([key, icon]) => (
          <option key={key} value={key}>{icon} {MEAL_SHORT_LABELS[key]}</option>
        ))}
      </select>
    </div>
  );
}

// ── Sub-tab: Overview ─────────────────────────────────────────────────────────

function OverviewTab({ kpis, byState }) {
  const swipeOk = kpis.swipePct >= 90;

  return (
    <>
      {/* KPI grid */}
      <div className="report-section">
        <div className="report-section-title">📈 Ерөнхий үзүүлэлт</div>
        <div className="report-kpi-grid">
          <KpiCard label="Нийт захиалга"  value={kpis.total}      cls="kpi-total" />
          <KpiCard label="Нийт ажилтан"   value={kpis.employees}  cls="kpi-people" />
          <KpiCard
            label="Карт уншуулсан"
            value={kpis.swiped}
            cls="kpi-swiped"
            sub={kpis.employees ? `${kpis.swipePct}%` : ''}
          />
          <KpiCard
            label="Уншаагүй"
            value={kpis.missing}
            cls={kpis.missing > 0 ? 'kpi-problem' : 'kpi-done'}
            valueColor={kpis.missing > 0 ? '#ff4d4f' : undefined}
          />
          <KpiCard
            label="Уншуулсан %"
            value={`${kpis.swipePct}%`}
            cls={swipeOk ? 'kpi-done' : 'kpi-problem'}
            valueColor={swipeOk ? '#237804' : '#a8071a'}
          />
          <KpiCard
            label="Асуудалтай"
            value={kpis.problematic}
            cls={kpis.problematic > 0 ? 'kpi-problem' : 'kpi-done'}
            sub="захиалга"
          />
          <KpiCard
            label="Дундаж ажилтан"
            value={kpis.avgEmp}
            cls="kpi-confirmed"
            sub="захиалга тутамд"
          />
        </div>
      </div>

      {/* Swipe progress visual */}
      {kpis.employees > 0 && (
        <div className="report-section">
          <div className="report-section-title">📶 Карт уншуулалтын байдал</div>
          <SwipeBar swiped={kpis.swiped} total={kpis.employees} />
          <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
            {kpis.employees} ажилтнаас {kpis.swiped} нь карт уншуулсан
            {kpis.missing > 0 && (
              <span style={{ color: '#ff4d4f', fontWeight: 600 }}>
                {' '}· {kpis.missing} хүн уншуулаагүй байна
              </span>
            )}
          </div>
        </div>
      )}

      {/* State distribution */}
      {kpis.total > 0 && (
        <div className="report-section">
          <div className="report-section-title">📋 Захиалгын төлөвийн тархалт</div>
          <StateStackBar stateBreakdown={kpis.stateBreakdown} total={kpis.total} />

          {/* State table */}
          <div style={{ marginTop: 14 }}>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Төлөв</th>
                  <th className="num">Захиалга</th>
                  <th className="num">Ажилтан</th>
                  <th className="num">Карт уншуулсан</th>
                  <th className="num">%</th>
                </tr>
              </thead>
              <tbody>
                {byState.map((row) => {
                  const pct = row.employees > 0
                    ? Math.round((row.swiped / row.employees) * 100)
                    : null;
                  return (
                    <tr key={row.state}>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: STATE_COLORS[row.state] || STATE_COLORS.unknown,
                            display: 'inline-block',
                          }} />
                          {STATE_LABELS[row.state] || row.state}
                        </span>
                      </td>
                      <td className="num">{row.orders}</td>
                      <td className="num">{row.employees}</td>
                      <td className="num">{row.swiped}</td>
                      <td className="num">{pct !== null ? `${pct}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-tab: By Meal ──────────────────────────────────────────────────────────

function MealTab({ byMeal }) {
  if (byMeal.length === 0) {
    return <div className="empty-state">Захиалга байхгүй байна</div>;
  }

  // Totals row
  const totals = byMeal.reduce(
    (acc, r) => ({
      orders: acc.orders + r.orders,
      employees: acc.employees + r.employees,
      swiped: acc.swiped + r.swiped,
      problematic: acc.problematic + r.problematic,
    }),
    { orders: 0, employees: 0, swiped: 0, problematic: 0 },
  );

  return (
    <div className="report-section">
      <div className="report-section-title">🍽 Хоолны төрлөөр</div>
      <div className="table-scroll">
        <table className="report-table">
          <thead>
            <tr>
              <th>Хоол</th>
              <th className="num">Захиалга</th>
              <th className="num">Ажилтан</th>
              <th>Карт уншуулалт</th>
              <th className="num">Асуудалтай</th>
            </tr>
          </thead>
          <tbody>
            {byMeal.map((row) => (
              <tr key={row.type}>
                <td><MealPill type={row.type} /></td>
                <td className="num">{row.orders}</td>
                <td className="num">{row.employees}</td>
                <td><MiniBar swiped={row.swiped} total={row.employees} /></td>
                <td className="num"><ProblemPill count={row.problematic} /></td>
              </tr>
            ))}
          </tbody>
          {/* Totals footer */}
          <tfoot>
            <tr style={{ borderTop: '2px solid #e8e8e8', fontWeight: 700 }}>
              <td style={{ fontSize: 12, color: '#888', paddingTop: 10 }}>Нийт</td>
              <td className="num" style={{ paddingTop: 10 }}>{totals.orders}</td>
              <td className="num" style={{ paddingTop: 10 }}>{totals.employees}</td>
              <td style={{ paddingTop: 10 }}>
                <MiniBar swiped={totals.swiped} total={totals.employees} />
              </td>
              <td className="num" style={{ paddingTop: 10 }}>
                <ProblemPill count={totals.problematic} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Per-meal swipe breakdown cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginTop: 16 }}>
        {byMeal.map((row) => {
          const pct = row.employees > 0 ? Math.round((row.swiped / row.employees) * 100) : 0;
          const fill = pct === 100 ? '#52c41a' : pct >= 70 ? '#faad14' : '#ff4d4f';
          return (
            <div key={row.type} style={{
              background: 'white',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <MealPill type={row.type} />
                <span style={{ fontSize: 20, fontWeight: 700, color: fill }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: '#f5f5f5', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: fill, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 11, color: '#aaa' }}>
                {row.swiped}/{row.employees} · {row.orders} захиалга
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-tab: By Submitter ─────────────────────────────────────────────────────

function SubmitterTab({ bySubmitter }) {
  if (bySubmitter.length === 0) {
    return <div className="empty-state">Захиалга байхгүй байна</div>;
  }

  const maxOrders = Math.max(...bySubmitter.map((r) => r.orders));

  return (
    <div className="report-section">
      <div className="report-section-title">👤 Захиалагчаар</div>
      <div className="table-scroll">
        <table className="report-table">
          <thead>
            <tr>
              <th>Захиалагч</th>
              <th>Идэвхжил</th>
              <th className="num">Захиалга</th>
              <th className="num">Ажилтан</th>
              <th>Карт уншуулалт</th>
              <th className="num">Асуудалтай</th>
            </tr>
          </thead>
          <tbody>
            {bySubmitter.map((row) => {
              const barPct = maxOrders > 0 ? Math.round((row.orders / maxOrders) * 100) : 0;
              return (
                <tr key={row.submitter}>
                  <td style={{ fontWeight: 500 }}>{row.submitter}</td>
                  <td style={{ minWidth: 80 }}>
                    {/* Relative activity bar */}
                    <div style={{
                      height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', width: `${barPct}%`,
                        background: '#1677ff', borderRadius: 3,
                      }} />
                    </div>
                  </td>
                  <td className="num">{row.orders}</td>
                  <td className="num">{row.employees}</td>
                  <td><MiniBar swiped={row.swiped} total={row.employees} /></td>
                  <td className="num"><ProblemPill count={row.problematic} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-tab: Export ───────────────────────────────────────────────────────────

function ExportTab({ orders, byMeal, bySubmitter, dateFrom, dateTo, mealFilter, total }) {
  const dateLabel = [dateFrom, dateTo].filter(Boolean).join(' — ') || 'Бүх огноо';
  const mealLabel = mealFilter ? (MEAL_LABELS[mealFilter] || mealFilter) : 'Бүх хоол';
  const titleLine = `Хоолны тайлан · ${dateLabel} · ${mealLabel}`;
  const stamp = new Date().toISOString().slice(0, 10);

  const handleRawCSV = () => {
    const csv = ordersToCSV(orders, titleLine);
    downloadFile(csv, `meal-orders-${stamp}.csv`);
  };

  const handleSummaryCSV = () => {
    const csv = summaryToCSV(byMeal, bySubmitter, titleLine);
    downloadFile(csv, `meal-summary-${stamp}.csv`);
  };

  return (
    <div className="report-section">
      <div className="report-section-title">⬇️ Тайлан татах</div>

      {/* Current scope summary */}
      <div style={{
        background: '#f9fbff', border: '1px solid #d6e8ff',
        borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13,
      }}>
        <div style={{ fontWeight: 600, color: '#1677ff', marginBottom: 4 }}>Идэвхтэй шүүлт</div>
        <div style={{ color: '#555', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>📅 {dateLabel}</span>
          <span>🍽 {mealLabel}</span>
          <span>📋 {orders.length} захиалга
            {total > orders.length && (
              <span style={{ color: '#faad14', marginLeft: 4 }}>
                (нийт {total}-аас {REPORT_PAGE_SIZE})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Export option 1: raw orders */}
      <div
        className="export-card"
        role="button"
        tabIndex={0}
        onClick={handleRawCSV}
        onKeyDown={(e) => e.key === 'Enter' && handleRawCSV()}
        style={{ cursor: 'pointer' }}
      >
        <span className="export-card-icon">📄</span>
        <div className="export-card-body">
          <div className="export-card-title">Захиалгын жагсаалт (.csv)</div>
          <div className="export-card-desc">
            Нэг мөр тутамд нэг захиалга — ID, огноо, хоол, ажилтан, карт уншуулалт,
            захиалагч. Excel-д нэн нийцтэй.
          </div>
        </div>
        <button className="approve-btn" style={{ flexShrink: 0 }} onClick={handleRawCSV}>
          Татах
        </button>
      </div>

      {/* Export option 2: aggregated summary */}
      <div
        className="export-card"
        role="button"
        tabIndex={0}
        onClick={handleSummaryCSV}
        onKeyDown={(e) => e.key === 'Enter' && handleSummaryCSV()}
        style={{ cursor: 'pointer' }}
      >
        <span className="export-card-icon">📊</span>
        <div className="export-card-body">
          <div className="export-card-title">Нэгтгэсэн тайлан (.csv)</div>
          <div className="export-card-desc">
            Хоолны төрлөөр болон захиалагчаар нэгтгэсэн — нийт захиалга, ажилтан,
            карт уншуулалтын хувь, асуудалтай захиалгуудын тоо.
          </div>
        </div>
        <button className="confirm-btn" style={{ flexShrink: 0 }} onClick={handleSummaryCSV}>
          Татах
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#bbb', marginTop: 10 }}>
        * CSV файлыг Excel, Google Sheets болон бусад хүснэгтийн программаар нээж болно.
        Монгол үсэг зөв харагдахын тулд UTF-8 BOM форматаар хадгалагдана.
      </div>
    </div>
  );
}

// ── Main ReportingView ────────────────────────────────────────────────────────

/**
 * Catering reporting and analytics dashboard.
 *
 * Fetches up to REPORT_PAGE_SIZE orders from the existing /orders endpoint,
 * computes all aggregations client-side (memoized), and renders four sub-tabs:
 *   - Ерөнхий:      KPIs, swipe progress, state distribution
 *   - Хоолоор:      per-meal breakdown table + swipe cards
 *   - Захиалагчаар: per-submitter breakdown table with activity bars
 *   - Экспорт:      CSV download (raw orders + aggregated summary)
 *
 * Reuses: .dash-kpi-card, SwipeBar, MealPill from the dashboard feature.
 * Does NOT change any backend contract.
 */
function ReportingView() {
  const [subTab, setSubTab] = useState('overview');

  const {
    dateFrom, setDateFrom,
    dateTo,   setDateTo,
    mealFilter, setMealFilter,
    loading, error,
    orders, total, isTruncated,
    kpis, byMeal, bySubmitter, byState,
  } = useReportData();

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="report-sub-tabs">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            className={`report-sub-tab${subTab === t.key ? ' active' : ''}`}
            onClick={() => setSubTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <ReportFilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        mealFilter={mealFilter}
        onDateFrom={setDateFrom}
        onDateTo={setDateTo}
        onMeal={setMealFilter}
      />

      {/* Truncation warning */}
      {isTruncated && (
        <div className="report-truncation-banner">
          ⚠️ Нийт <strong>{total}</strong> захиалгаас <strong>{REPORT_PAGE_SIZE}</strong> харуулж байна.
          Жинхэнэ тайлан авахын тулд огноон хугацааг богиносгоно уу.
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="empty-state">Уншиж байна...</div>
      ) : error ? (
        <div className="empty-state" style={{ color: '#ff4d4f' }}>
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">Сонгосон хугацаанд захиалга байхгүй байна</div>
      ) : (
        <>
          {subTab === 'overview'  && <OverviewTab   kpis={kpis} byState={byState} />}
          {subTab === 'meal'      && <MealTab        byMeal={byMeal} />}
          {subTab === 'submitter' && <SubmitterTab   bySubmitter={bySubmitter} />}
          {subTab === 'export'    && (
            <ExportTab
              orders={orders}
              byMeal={byMeal}
              bySubmitter={bySubmitter}
              dateFrom={dateFrom}
              dateTo={dateTo}
              mealFilter={mealFilter}
              total={total}
            />
          )}
        </>
      )}
    </div>
  );
}

export default ReportingView;
