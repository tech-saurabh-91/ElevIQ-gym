import { useMemo, useState } from 'react';
import { Empty, Loading } from './ui';

export default function DataTable({
  columns,
  data,
  loading,
  keyField = '_id',
  pagination,
  onPageChange,
  onRowClick,
  toolbar,
  emptyTitle,
  emptySubtitle,
}) {
  const [hover, setHover] = useState(null);

  const rows = useMemo(() => data || [], [data]);

  if (loading) return <div className="table-shell"><Loading /></div>;

  if (!rows.length) {
    return (
      <div className="table-shell">
        <Empty title={emptyTitle} subtitle={emptySubtitle} />
        {toolbar && <div className="border-t border-white/10 p-4">{toolbar}</div>}
      </div>
    );
  }

  return (
    <div className="table-shell">
      {toolbar && <div className="border-b border-white/10 p-4">{toolbar}</div>}
      <div className="overflow-x-auto scrollbar-thin">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.className || ''} style={{ width: c.width }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row[keyField] || i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer' : ''}
                style={onRowClick && hover === i ? { background: 'rgba(255,255,255,0.045)' } : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.className || ''}>
                    {c.render ? c.render(row, i) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
          <p className="text-xs text-muted">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={(pagination.page || 1) <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="rounded-lg border border-white/12 px-3 py-1.5 text-xs text-muted transition hover:border-mint/50 hover:text-bone disabled:opacity-30"
            >
              Prev
            </button>
            <span className="font-mono text-xs text-bone">
              {pagination.page} / {pagination.pages || 1}
            </span>
            <button
              disabled={(pagination.page || 1) >= (pagination.pages || 1)}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="rounded-lg border border-white/12 px-3 py-1.5 text-xs text-muted transition hover:border-mint/50 hover:text-bone disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
