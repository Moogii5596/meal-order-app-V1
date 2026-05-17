import React from 'react';
import { STATE_LABELS } from '../../constants';
import { STATE_DOT_CLS } from './campOrdersConstants';

/**
 * Coloured dot + label for an order's state (draft / done / confirmed / canceled).
 * Purely presentational — no state, no side-effects.
 */
function StateBadge({ state }) {
  const cls = STATE_DOT_CLS[state] || 'state-dot-unknown';
  return (
    <span className={`state-dot ${cls}`}>
      {STATE_LABELS[state] || state || '—'}
    </span>
  );
}

export default StateBadge;
