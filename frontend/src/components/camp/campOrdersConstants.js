/**
 * Shared constants and pure utilities for the Camp Orders dashboard.
 * Imported by CampOrdersView and all its child components.
 * Nothing stateful lives here — only data and pure functions.
 */
import { STATE_TABS } from '../../constants';

// ── Lookup maps ───────────────────────────────────────────────────────────────

export const MEAL_ICONS = {
  breakfast: '🍳',
  lunch:     '☀️',
  dinner:    '🍽️',
  night:     '🌙',
};

export const MEAL_PILL_CLS = {
  breakfast: 'meal-pill-breakfast',
  lunch:     'meal-pill-lunch',
  dinner:    'meal-pill-dinner',
  night:     'meal-pill-night',
};

export const STATE_DOT_CLS = {
  draft:     'state-dot-draft',
  done:      'state-dot-done',
  confirmed: 'state-dot-confirmed',
  canceled:  'state-dot-canceled',
};

export const ALL_TABS = [
  { key: 'all', label: 'Бүгд' },
  ...STATE_TABS,
];

export const DEFAULT_PAGE_SIZE = 10;

// ── Pure date helpers ─────────────────────────────────────────────────────────

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function monthAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

/** "2024-01-15 08:30:00" → "2024-01-15 08:30" */
export function fmtDatetime(raw) {
  if (!raw) return '—';
  return String(raw).slice(0, 16);
}

// ── Business rule ─────────────────────────────────────────────────────────────

/**
 * Returns true when an order has employees but fewer card-swipes than expected,
 * and the order is in a state where that matters (not draft, not canceled).
 */
export function isProblem(order) {
  return (
    (order.employee_count ?? 0) > 0 &&
    (order.swiped_count   ?? 0) < (order.employee_count ?? 0) &&
    order.state !== 'canceled' &&
    order.state !== 'draft'
  );
}
