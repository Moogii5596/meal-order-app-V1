import React from 'react';

/**
 * A single KPI card tile.
 */
function KpiCard({ label, value, sub, cls }) {
  return (
    <div className={`dash-kpi-card ${cls || ''}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

/**
 * The full KPI grid row shown at the top of the dashboard.
 *
 * Props:
 *   stateCounts  — { draft, done, confirmed, canceled, ... } from the API response.
 *                  Used for all-time counts (not limited to current page).
 *   kpi          — { totalEmp, totalSwiped, lowSwipe } computed from current page.
 */
function KpiCards({ stateCounts, kpi }) {
  const total = Object.values(stateCounts).reduce((s, v) => s + v, 0);

  return (
    <div className="dash-kpi-grid">
      <KpiCard label="Нийт захиалга"  value={total}                          cls="kpi-total" />
      <KpiCard label="Ноорог"          value={stateCounts.draft     || 0}     cls="kpi-draft" />
      <KpiCard label="Баталгаажсан"    value={stateCounts.done      || 0}     cls="kpi-done" />
      <KpiCard label="ТН баталсан"     value={stateCounts.confirmed || 0}     cls="kpi-confirmed" />
      <KpiCard
        label="Нийт хүн"
        value={kpi.totalEmp}
        cls="kpi-people"
        sub="энэ хуудсан"
      />
      <KpiCard
        label="Карт уншуулсан"
        value={kpi.totalSwiped}
        cls="kpi-swiped"
        sub={kpi.totalEmp
          ? `${Math.round((kpi.totalSwiped / kpi.totalEmp) * 100)}%`
          : ''}
      />
      {kpi.lowSwipe > 0 && (
        <KpiCard
          label="Дутуу уншуулсан"
          value={kpi.lowSwipe}
          cls="kpi-problem"
          sub="захиалга"
        />
      )}
    </div>
  );
}

export default KpiCards;
