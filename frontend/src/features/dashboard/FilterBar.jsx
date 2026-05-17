import React from 'react';
import { MEAL_SHORT_LABELS } from '../../constants';
import { ALL_TABS, MEAL_ICONS } from './campOrdersConstants';

/**
 * All filter controls for the Camp Orders dashboard:
 *   - Date range picker (from / to / clear)
 *   - Meal type pills
 *   - State tabs (Бүгд / Ноорог / Баталгаажсан / …)
 *
 * Purely controlled — all values come from props, all changes fire callbacks.
 * No internal state.
 *
 * Props:
 *   dateFrom        string  — controlled date-from value
 *   dateTo          string  — controlled date-to value
 *   meal            string  — active meal filter key ('' = all)
 *   activeTab       string  — active state-tab key ('all' | 'draft' | …)
 *   stateCounts     object  — { draft: N, done: N, … } for tab badges
 *   onDateFromChange fn     — (value: string) => void
 *   onDateToChange  fn      — (value: string) => void
 *   onMealChange    fn      — (key: string) => void
 *   onTabChange     fn      — (key: string) => void
 */
function FilterBar({
  dateFrom,
  dateTo,
  meal,
  activeTab,
  stateCounts,
  onDateFromChange,
  onDateToChange,
  onMealChange,
  onTabChange,
}) {
  const tabTotal = (key) => {
    if (key === 'all') return Object.values(stateCounts).reduce((s, v) => s + v, 0);
    return stateCounts[key] || 0;
  };

  return (
    <>
      {/* ── Date range + meal type ── */}
      <div className="dash-filter-bar">
        <div className="dash-filter-row">
          <span className="dash-filter-label">Хугацаа</span>
          <input
            className="dash-date-input"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
          <span style={{ fontSize: 12, color: '#aaa' }}>—</span>
          <input
            className="dash-date-input"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
          <button
            className="dash-filter-btn"
            onClick={() => { onDateFromChange(''); onDateToChange(''); }}
            title="Огноо шүүлт арилгах"
          >
            Бүгд
          </button>
        </div>

        <div className="dash-filter-row">
          <span className="dash-filter-label">Хоол</span>
          <button
            className={`dash-tab${meal === '' ? ' active' : ''}`}
            style={{ borderRadius: 6, padding: '5px 12px' }}
            onClick={() => onMealChange('')}
          >
            Бүх хоол
          </button>
          {Object.entries(MEAL_ICONS).map(([key, icon]) => (
            <button
              key={key}
              className={`dash-tab${meal === key ? ' active' : ''}`}
              style={{ borderRadius: 6, padding: '5px 12px' }}
              onClick={() => onMealChange(key)}
            >
              {icon} {MEAL_SHORT_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* ── State tabs ── */}
      <div className="dash-tabs">
        {ALL_TABS.map((tab) => {
          const cnt = tabTotal(tab.key);
          return (
            <button
              key={tab.key}
              className={`dash-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.label}
              {cnt > 0 && <span className="dash-tab-badge">{cnt}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

export default FilterBar;
