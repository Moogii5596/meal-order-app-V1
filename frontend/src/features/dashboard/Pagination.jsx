import React, { useEffect, useMemo, useState } from 'react';

/**
 * Pagination bar: page number buttons with ellipsis, prev/next, editable page-size input.
 *
 * Props:
 *   page        number  — current 1-based page
 *   pageSize    number  — records per page
 *   total       number  — total record count (used to compute last page)
 *   onPage      fn      — (page: number) => void
 *   onPageSize  fn      — (size: number) => void
 */
function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const totalPages  = Math.max(1, Math.ceil(total / pageSize));
  const [sizeInput, setSizeInput] = useState(String(pageSize));

  // Keep input in sync if parent changes pageSize
  useEffect(() => { setSizeInput(String(pageSize)); }, [pageSize]);

  const commitSize = () => {
    const n = parseInt(sizeInput, 10);
    if (!isNaN(n) && n >= 1 && n <= 200 && n !== pageSize) {
      onPageSize(n);
    } else {
      setSizeInput(String(pageSize)); // reset invalid input
    }
  };

  // Visible page numbers: first, last, current ±1, with ellipsis gaps
  const pageNums = useMemo(() => {
    const set = new Set(
      [1, totalPages, page, page - 1, page + 1].filter((p) => p >= 1 && p <= totalPages),
    );
    const arr = [...set].sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      if (i > 0 && arr[i] - arr[i - 1] > 1) result.push('...');
      result.push(arr[i]);
    }
    return result;
  }, [page, totalPages]);

  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  return (
    <div className="dash-pagination">
      <span className="dash-pagination-info">
        {start}–{end} / нийт {total} захиалга
      </span>

      <div className="dash-pagination-spacer" />

      {/* Prev */}
      <button className="page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹
      </button>

      {/* Page numbers */}
      {pageNums.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: '#aaa' }}>…</span>
        ) : (
          <button
            key={p}
            className={`page-btn${p === page ? ' active' : ''}`}
            onClick={() => onPage(p)}
          >
            {p}
          </button>
        ),
      )}

      {/* Next */}
      <button className="page-btn" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        ›
      </button>

      {/* Page size */}
      <span className="page-size-label" style={{ marginLeft: 8 }}>Хуудсанд:</span>
      <input
        className="page-size-input"
        type="number"
        min="1"
        max="200"
        value={sizeInput}
        onChange={(e) => setSizeInput(e.target.value)}
        onBlur={commitSize}
        onKeyDown={(e) => e.key === 'Enter' && commitSize()}
        title="Нэг хуудсанд харуулах захиалгын тоо (1–200)"
      />
    </div>
  );
}

export default Pagination;
