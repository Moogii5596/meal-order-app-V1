import React from 'react';

/**
 * Detailed reconciliation breakdown panel for a single order.
 *
 * Shows all three mismatch categories:
 *   1. Missing swipes   — on the order but didn't swipe
 *   2. Unexpected swipes — swiped but about to be removed (unchecked in UI)
 *   3. Duplicates        — same employee ID appears more than once
 *
 * Renders nothing when `summary.hasMismatches` is false — safe to always mount.
 *
 * Typical usage (inside CampOrderModal after useReconciliation):
 *   <ReconciliationSummary summary={summary} />
 *
 * Props:
 *   summary  object  — result of buildMismatchSummary() / useReconciliation().summary
 *   style    object  — optional additional container styles
 */
function ReconciliationSummary({ summary, style }) {
  if (!summary?.hasMismatches) return null;

  const { missingSwipes, unexpectedSwipes, duplicates } = summary;

  return (
    <div
      style={{
        background:   '#fffbe6',
        border:       '1px solid #ffe58f',
        borderRadius: 8,
        padding:      '10px 14px',
        marginBottom: 10,
        fontSize:     13,
        ...style,
      }}
    >
      {/* Header */}
      <div style={{ fontWeight: 700, color: '#875500', marginBottom: 6 }}>
        ⚠️ Хяналтын тэмдэглэл
      </div>

      {/* Missing swipes */}
      {missingSwipes.length > 0 && (
        <div style={{ marginBottom: missingSwipes.length > 0 ? 4 : 0 }}>
          <span style={{ fontWeight: 600, color: '#ff4d4f' }}>
            Карт уншаагүй ({missingSwipes.length}):
          </span>{' '}
          <span style={{ color: '#555' }}>
            {missingSwipes.map((e) => e.name).join(', ')}
          </span>
        </div>
      )}

      {/* Unexpected swipes (swiped but being removed) */}
      {unexpectedSwipes.length > 0 && (
        <div style={{ marginBottom: duplicates.length > 0 ? 4 : 0 }}>
          <span style={{ fontWeight: 600, color: '#fa8c16' }}>
            Хасагдах боловч уншуулсан ({unexpectedSwipes.length}):
          </span>{' '}
          <span style={{ color: '#555' }}>
            {unexpectedSwipes.map((e) => e.name).join(', ')}
          </span>
        </div>
      )}

      {/* Duplicates */}
      {duplicates.length > 0 && (
        <div>
          <span style={{ fontWeight: 600, color: '#722ed1' }}>
            Давхардсан ажилтан ({duplicates.length}):
          </span>{' '}
          <span style={{ color: '#555' }}>
            {duplicates.map((e) => e.name).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

export default ReconciliationSummary;
