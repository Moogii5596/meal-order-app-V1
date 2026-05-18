import React from 'react';

/**
 * Horizontal progress bar showing card-swipe progress for an order.
 * fill-full (green) | fill-partial (amber) | fill-none (red, zero width).
 * Purely presentational — no state, no side-effects.
 */
function SwipeBar({ swiped, total }) {
  if (!total) return <span style={{ color: '#ccc', fontSize: 12 }}>—</span>;

  const pct     = Math.round((swiped / total) * 100);
  const fillCls = swiped === total ? 'fill-full'
    : swiped > 0               ? 'fill-partial'
    :                            'fill-none';

  return (
    <div className="swipe-bar-wrap">
      <div className="swipe-bar-track">
        <div className={`swipe-bar-fill ${fillCls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="swipe-bar-label">{swiped}/{total} ({pct}%)</span>
    </div>
  );
}

export default SwipeBar;
