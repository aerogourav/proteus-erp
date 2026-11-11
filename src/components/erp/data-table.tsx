"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Comparator for sorting by this column; columns without one are not sortable. */
  sort?: (a: T, b: T) => number;
  /** Numbers and money align right. */
  align?: "right";
  width?: string;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

/**
 * The shared data table: search, sortable columns, pagination, optional row selection with bulk actions.
 * Rows stay in the order given until a column is sorted. Presentation only; actions call the same model functions as before.
 */
export function DataTable<T>({ rows, rowKey, columns, label, search, searchPlaceholder = "Search…", toolbar, bulkActions, pageSize = 25, empty, initialSort = null }: {
  rows: T[];
  rowKey: (row: T) => string;
  columns: Column<T>[];
  /** Accessible name of the table. */
  label: string;
  /** Row matcher for the search box; without it there is no search box. */
  search?: (row: T, query: string) => boolean;
  searchPlaceholder?: string;
  /** Filters or actions shown next to the search box. */
  toolbar?: ReactNode;
  /** With bulk actions, rows get checkboxes and a bar appears when some are selected. */
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  pageSize?: number;
  empty: ReactNode;
  initialSort?: SortState;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(initialSort);
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q && search ? rows.filter((row) => search(row, q)) : rows;
  }, [rows, query, search]);
  const sorted = useMemo(() => {
    const column = sort && columns.find((item) => item.key === sort.key);
    if (!column?.sort) return filtered;
    const out = filtered.slice().sort(column.sort);
    return sort!.dir === "desc" ? out.reverse() : out;
  }, [filtered, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);
  const keys = new Set(rows.map(rowKey));
  const selected = rows.filter((row) => picked.has(rowKey(row)));
  const selectable = Boolean(bulkActions);
  const allOnPage = visible.length > 0 && visible.every((row) => picked.has(rowKey(row)));
  const clear = () => setPicked(new Set());
  const toggle = (key: string) => setPicked((value) => { const next = new Set([...value].filter((item) => keys.has(item))); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const togglePage = () => setPicked((value) => {
    const next = new Set([...value].filter((item) => keys.has(item)));
    visible.forEach((row) => { if (allOnPage) next.delete(rowKey(row)); else next.add(rowKey(row)); });
    return next;
  });
  const sortBy = (key: string) => { setSort((value) => value?.key !== key ? { key, dir: "asc" } : value.dir === "asc" ? { key, dir: "desc" } : null); setPage(0); };

  return <div className="erp-datatable">
    {(search || toolbar) && <div className="erp-toolbar">
      {search && <label className="erp-search"><Search size={15} aria-hidden="true" /><input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder={searchPlaceholder} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label>}
      {toolbar}
    </div>}
    <section className="erp-card">
      {selectable && selected.length > 0 && <div className="erp-bulkbar" role="region" aria-label="Bulk actions">
        <span>{selected.length} selected</span>
        {bulkActions!(selected, clear)}
        <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={clear}>Clear selection</button>
      </div>}
      {sorted.length === 0 ? (query ? <div className="erp-empty"><h3>No matches</h3><p>Nothing matches “{query}”. Try a different search or filter.</p></div> : empty) : <div className="erp-table-wrap">
        <table className="erp-table" aria-label={label}>
          <thead><tr>
            {selectable && <th className="check" scope="col"><input type="checkbox" aria-label="Select all rows on this page" checked={allOnPage} onChange={togglePage} /></th>}
            {columns.map((column) => {
              const active = sort?.key === column.key ? sort.dir : null;
              return <th key={column.key} scope="col" className={column.align === "right" ? "r" : undefined} style={column.width ? { width: column.width } : undefined} aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : undefined}>
                {column.sort ? <button type="button" className={`erp-sort${active ? " is-active" : ""}`} onClick={() => sortBy(column.key)}>
                  {column.header}{active === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : active === "desc" ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUpDown size={12} aria-hidden="true" opacity={0.45} />}
                </button> : column.header}
              </th>;
            })}
          </tr></thead>
          <tbody>{visible.map((row) => {
            const key = rowKey(row);
            return <tr key={key} className={picked.has(key) ? "is-selected" : undefined}>
              {selectable && <td className="check"><input type="checkbox" aria-label="Select row" checked={picked.has(key)} onChange={() => toggle(key)} /></td>}
              {columns.map((column) => <td key={column.key} className={column.align === "right" ? "r" : undefined}>{column.render(row)}</td>)}
            </tr>;
          })}</tbody>
        </table>
      </div>}
      {sorted.length > 0 && <div className="erp-table-foot">
        <span>{sorted.length <= pageSize ? `${sorted.length} ${sorted.length === 1 ? "row" : "rows"}` : `${current * pageSize + 1}–${Math.min(sorted.length, (current + 1) * pageSize)} of ${sorted.length}`}</span>
        {pages > 1 && <div className="erp-pager">
          <button type="button" className="erp-btn erp-btn-sm" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={14} /></button>
          <span>Page {current + 1} of {pages}</span>
          <button type="button" className="erp-btn erp-btn-sm" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight size={14} /></button>
        </div>}
      </div>}
    </section>
  </div>;
}
