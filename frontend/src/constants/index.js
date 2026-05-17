/**
 * Application-wide constants.
 * All constants live here — never define MEAL_LABELS, ROLE_LABELS, etc. inline
 * or in other files. Import from here everywhere.
 */

export const API_URL = process.env.REACT_APP_API_URL;

export const MEAL_LABELS = {
  breakfast: 'Өглөөний хоол',
  lunch: 'Өдрийн хоол',
  dinner: 'Оройн хоол',
  night: 'Шөнийн хоол',
};

export const MEAL_SHORT_LABELS = {
  breakfast: 'Өглөө',
  lunch: 'Өдөр',
  dinner: 'Орой',
  night: 'Шөнө',
};

export const LOCATION_LABELS = {
  uh: 'Ухаа худаг',
  bh: 'Баруун наран',
  bn: 'Баруун наран',
  zas: 'Засвар',
  office: 'Оффис',
};

export const ROLE_LABELS = {
  kitchen_staff: 'Ээлжийн ахлах',
  category_manager: 'Хоолны захиалга хянагч ТН',
  camp_manager: 'Кемп менежер',
};

export const ROLE_SHORT_LABELS = {
  kitchen_staff: 'Захиалагч',
  category_manager: 'Хянагч ТН',
  camp_manager: 'Кемп менежер',
};

export const STATE_TABS = [
  { key: 'draft',     label: 'Ноорог' },
  { key: 'done',      label: 'Баталгаажсан' },
  { key: 'confirmed', label: 'ТН баталсан' },
  { key: 'canceled',  label: 'Цуцалсан' },
];

// Exact labels from Odoo meal.order.state selection field:
//   draft='Ноорог' | done='Баталгаажсан' | confirmed='ТН баталсан' | canceled='Цуцалсан'
export const STATE_LABELS = {
  draft:     'Ноорог',
  done:      'Баталгаажсан',
  confirmed: 'ТН баталсан',
  canceled:  'Цуцалсан',
};

export const EXTRA_TYPE_LABELS = {
  rental:  'Түрээсийн',
  sunasan: 'Сунасан',
};

export const DEFAULT_MEAL = 'lunch';
