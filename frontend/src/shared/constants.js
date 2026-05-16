export const API = process.env.REACT_APP_API_URL;

export const MEAL_LABELS = {
  breakfast: 'Өглөөний хоол',
  lunch: 'Өдрийн хоол',
  dinner: 'Оройн хоол',
  night: 'Шөнийн хоол',
};

export const LOCATION_LABELS = {
  uh: 'Ухаа худаг',
  bh: 'Баруун наран',
  bn: 'Баруун наран',
  zas: 'Засвар',
  office: 'Оффис',
};

export const STATE_TABS = [
  { key: 'draft', label: 'Ноорог' },
  { key: 'done', label: 'Батлагдсан' },
  { key: 'confirmed', label: 'Баталгаажсан' },
  { key: 'canceled', label: 'Цуцалсан' },
];