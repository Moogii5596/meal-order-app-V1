/**
 * Pure aggregation and export utilities for catering reporting.
 * No React imports — safe to use in tests, workers, or hooks.
 *
 * All functions accept the list-level order shape returned by fetchOrders():
 *   { id, name, state, type, employee_count, swiped_count,
 *     order_date, create_date, submitted_by, created_by }
 */

import { MEAL_LABELS, STATE_LABELS } from '../../constants';
import { isOrderProblematic } from '../reconciliation/reconciliationUtils';

// ── Aggregation helpers ───────────────────────────────────────────────────────

/**
 * Aggregate orders by meal type.
 * Returns an array sorted descending by order count.
 *
 * @param  {Array} orders
 * @returns {Array<{
 *   type:        string,
 *   orders:      number,
 *   employees:   number,
 *   swiped:      number,
 *   problematic: number,
 * }>}
 */
export function aggregateByMeal(orders) {
  const map = {};
  for (const o of orders) {
    const key = o.type || 'unknown';
    if (!map[key]) map[key] = { type: key, orders: 0, employees: 0, swiped: 0, problematic: 0 };
    map[key].orders++;
    map[key].employees   += o.employee_count ?? 0;
    map[key].swiped      += o.swiped_count   ?? 0;
    if (isOrderProblematic(o)) map[key].problematic++;
  }
  return Object.values(map).sort((a, b) => b.orders - a.orders);
}

/**
 * Aggregate orders by the submitting user (kitchen staff).
 * Returns an array sorted descending by order count.
 *
 * @param  {Array} orders
 * @returns {Array<{
 *   submitter:   string,
 *   orders:      number,
 *   employees:   number,
 *   swiped:      number,
 *   problematic: number,
 * }>}
 */
export function aggregateBySubmitter(orders) {
  const map = {};
  for (const o of orders) {
    const key = o.submitted_by || o.created_by || '—';
    if (!map[key]) map[key] = { submitter: key, orders: 0, employees: 0, swiped: 0, problematic: 0 };
    map[key].orders++;
    map[key].employees   += o.employee_count ?? 0;
    map[key].swiped      += o.swiped_count   ?? 0;
    if (isOrderProblematic(o)) map[key].problematic++;
  }
  return Object.values(map).sort((a, b) => b.orders - a.orders);
}

/**
 * Aggregate orders by state.
 * Returns an array of all states present in the data.
 *
 * @param  {Array} orders
 * @returns {Array<{ state: string, orders: number, employees: number, swiped: number }>}
 */
export function aggregateByState(orders) {
  const STATE_ORDER = ['draft', 'done', 'confirmed', 'canceled'];
  const map = {};
  for (const o of orders) {
    const key = o.state || 'unknown';
    if (!map[key]) map[key] = { state: key, orders: 0, employees: 0, swiped: 0 };
    map[key].orders++;
    map[key].employees += o.employee_count ?? 0;
    map[key].swiped    += o.swiped_count   ?? 0;
  }
  return Object.values(map).sort(
    (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state),
  );
}

/**
 * Build top-level operational KPIs from all orders in the current view.
 *
 * @param  {Array} orders
 * @returns {{
 *   total:          number,  — total order count
 *   employees:      number,  — sum of employee_count
 *   swiped:         number,  — sum of swiped_count
 *   missing:        number,  — employees - swiped
 *   swipePct:       number,  — rounded percentage
 *   problematic:    number,  — orders with incomplete swipes (active states)
 *   avgEmp:         number,  — average employees per order
 *   stateBreakdown: object,  — { draft: N, done: N, ... }
 * }}
 */
export function buildKpis(orders) {
  const total      = orders.length;
  const employees  = orders.reduce((s, o) => s + (o.employee_count ?? 0), 0);
  const swiped     = orders.reduce((s, o) => s + (o.swiped_count   ?? 0), 0);
  const missing    = employees - swiped;
  const swipePct   = employees > 0 ? Math.round((swiped / employees) * 100) : 0;
  const problematic = orders.filter(isOrderProblematic).length;
  const avgEmp     = total > 0 ? Math.round(employees / total) : 0;

  const stateBreakdown = {};
  for (const o of orders) {
    const s = o.state || 'unknown';
    stateBreakdown[s] = (stateBreakdown[s] || 0) + 1;
  }

  return { total, employees, swiped, missing, swipePct, problematic, avgEmp, stateBreakdown };
}

// ── CSV export helpers ────────────────────────────────────────────────────────

/**
 * Wrap a cell value for CSV: escape double-quotes and wrap in quotes when needed.
 */
function csvCell(v) {
  const s = String(v ?? '');
  const escaped = s.replace(/"/g, '""');
  return /[,"\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

/**
 * Convert an orders array to a UTF-8 CSV string (BOM included for Excel).
 *
 * @param  {Array}  orders
 * @param  {string} [title] — optional title row (e.g. the date range)
 * @returns {string}
 */
export function ordersToCSV(orders, title = '') {
  const BOM = '﻿';
  const lines = [];

  if (title) {
    lines.push(csvCell(title));
    lines.push('');
  }

  lines.push(csvRow([
    'ID', 'Нэр', 'Огноо', 'Хоол', 'Төлөв',
    'Ажилтан', 'Карт уншуулсан', 'Уншуулсан %', 'Захиалагч',
  ]));

  for (const o of orders) {
    const emp  = o.employee_count ?? 0;
    const sw   = o.swiped_count   ?? 0;
    const pct  = emp > 0 ? Math.round((sw / emp) * 100) : '';
    const date = (o.order_date || o.create_date || '').slice(0, 10);
    lines.push(csvRow([
      o.id,
      o.name || '',
      date,
      MEAL_LABELS[o.type]   || o.type   || '',
      STATE_LABELS[o.state] || o.state  || '',
      emp,
      sw,
      pct === '' ? '' : `${pct}%`,
      o.submitted_by || o.created_by || '',
    ]));
  }

  return BOM + lines.join('\r\n');
}

/**
 * Convert meal and submitter aggregations to a summary CSV.
 *
 * @param  {Array}  byMeal
 * @param  {Array}  bySubmitter
 * @param  {string} [title]
 * @returns {string}
 */
export function summaryToCSV(byMeal, bySubmitter, title = '') {
  const BOM = '﻿';
  const lines = [];

  if (title) {
    lines.push(csvCell(title));
    lines.push('');
  }

  // Meal section
  lines.push('=== ХООЛНЫ ТАЙЛАН ===');
  lines.push(csvRow(['Хоол', 'Захиалга', 'Ажилтан', 'Карт уншуулсан', 'Уншуулсан %', 'Асуудалтай']));
  for (const r of byMeal) {
    const pct = r.employees > 0 ? Math.round((r.swiped / r.employees) * 100) : '';
    lines.push(csvRow([
      MEAL_LABELS[r.type] || r.type,
      r.orders,
      r.employees,
      r.swiped,
      pct === '' ? '' : `${pct}%`,
      r.problematic,
    ]));
  }

  lines.push('');

  // Submitter section
  lines.push('=== ЗАХИАЛАГЧААР ===');
  lines.push(csvRow(['Захиалагч', 'Захиалга', 'Ажилтан', 'Карт уншуулсан', 'Уншуулсан %', 'Асуудалтай']));
  for (const r of bySubmitter) {
    const pct = r.employees > 0 ? Math.round((r.swiped / r.employees) * 100) : '';
    lines.push(csvRow([
      r.submitter,
      r.orders,
      r.employees,
      r.swiped,
      pct === '' ? '' : `${pct}%`,
      r.problematic,
    ]));
  }

  return BOM + lines.join('\r\n');
}

/**
 * Trigger a browser file download.
 *
 * @param {string} content  — the file content (already encoded as a string)
 * @param {string} filename — suggested filename
 * @param {string} [mime]   — MIME type (default: CSV)
 */
export function downloadFile(content, filename, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
