import React from 'react';

/**
 * Compact inline badge that surfaces swipe mismatch counts at a glance.
 * Renders nothing when there are no mismatches — safe to always mount.
 *
 * Typical usage:
 *   <MismatchBadge
 *     missing={missingSwipes.length}
 *     unexpected={unexpectedSwipes.length}
 *     duplicates={duplicates.length}
 *   />
 *
 * Props:
 *   missing    number    — count of employees who didn't swipe
 *   unexpected number    — count of employees who swiped but are being removed
 *   duplicates number    — count of duplicate employee entries
 *   size       'sm'|'md' — 'sm' for table cells / headers, 'md' for panels
 */
function MismatchBadge({ missing = 0, unexpected = 0, duplicates = 0, size = 'sm' }) {
  const total = missing + unexpected + duplicates;
  if (total === 0) return null;

  const items = [
    missing    > 0 && `${missing} карт уншаагүй`,
    unexpected > 0 && `${unexpected} хүлээгдээгүй`,
    duplicates > 0 && `${duplicates} давхардал`,
  ].filter(Boolean);

  const baseStyle = {
    display:     'inline-flex',
    alignItems:  'center',
    gap:         4,
    background:  '#fff1f0',
    color:       '#ff4d4f',
    border:      '1px solid #ffccc7',
    borderRadius: 10,
    fontWeight:  700,
    whiteSpace:  'nowrap',
  };

  const sizeStyle = size === 'md'
    ? { padding: '4px 12px', fontSize: 13, gap: 6 }
    : { padding: '2px 8px',  fontSize: 11 };

  return (
    <span style={{ ...baseStyle, ...sizeStyle }} title={items.join(', ')}>
      ⚠️ {items.join(' · ')}
    </span>
  );
}

export default MismatchBadge;
