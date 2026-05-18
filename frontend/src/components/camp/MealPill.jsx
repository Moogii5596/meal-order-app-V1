import React from 'react';
import { MEAL_SHORT_LABELS } from '../../constants';
import { MEAL_ICONS, MEAL_PILL_CLS } from './campOrdersConstants';

/**
 * Coloured pill showing meal type (breakfast / lunch / dinner / night).
 * Purely presentational — no state, no side-effects.
 */
function MealPill({ type }) {
  const cls  = MEAL_PILL_CLS[type] || 'meal-pill-default';
  const icon = MEAL_ICONS[type]    || '🍴';
  const lbl  = MEAL_SHORT_LABELS[type] || type || '—';
  return <span className={`meal-pill ${cls}`}>{icon} {lbl}</span>;
}

export default MealPill;
