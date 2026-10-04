import { useState, type ReactNode } from 'react';
import type { QueryResult } from '../../hooks/useQueryExecutor.ts';
import { Select } from '../ui/Select.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import { CapacityUsage, Pager } from './utils.tsx';
import { TableView } from './tableView.tsx';

const PAGE_SIZES = [10, 25, 50, 100].map((n) => ({ value: String(n), label: `${n} / page` }));

interface QueryResultsProps {
  result: QueryResult;
  /** Physical key attributes, highlighted and pinned first in the table. */
  keyAttrs: string[];
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export function QueryResults({
  result,
  keyAttrs,
  pageSize,
  onPageSizeChange,
  onNext,
  onPrev,
}: QueryResultsProps) {
  const [view, setView] = useState<'table' | 'json'>('table');
  const rows = result.status === 'success' ? result.data : [];
  const hasRows = rows.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Single toolbar: summary on the left, view · page size · pager on the right */}
      <div className="shrink-0 flex items-center gap-3 h-10 px-4 bg-surface border-b border-line-dim">
        <Summary result={result} />
        <div className="ml-auto flex items-center gap-2">
          {hasRows && (
            <Segmented
              ariaLabel="Results view"
              value={view}
              onChange={setView}
              options={[
                { value: 'table', label: 'Table' },
                { value: 'json', label: 'JSON' },
              ]}
            />
          )}
          <Select
            ariaLabel="Results per page"
            variant="ghost"
            value={String(pageSize)}
            onChange={(v) => onPageSizeChange(Number(v))}
            options={PAGE_SIZES}
            align="right"
            className="text-muted"
          />
          <Pager onPrev={onPrev} onNext={onNext} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <Body result={result} rows={rows} view={view} keyAttrs={keyAttrs} hasNext={!!onNext} />
      </div>
    </div>
  );
}

function Summary({ result }: { result: QueryResult }) {
  if (result.status === 'idle') return <span className="text-[12px] text-muted">Results</span>;
  if (result.status === 'loading') {
    return <span className="text-[12px] text-muted animate-led-pulse">Running…</span>;
  }
  if (result.status === 'error') return <span className="text-[12px] text-err">Query failed</span>;

  const count = result.data.length;
  const meta: ReactNode[] = [];
  if (result.durationMs !== undefined) meta.push(`${result.durationMs}ms`);
  if (result.consumedCapacity?.capacity_units != null) {
    meta.push(<CapacityUsage key="rcu" consumedCapacity={result.consumedCapacity} />);
  }

  return (
    <span className="text-[12px] text-secondary tabular-nums">
      {count} item{count !== 1 ? 's' : ''}
      {meta.map((m, i) => (
        <span key={i} className="text-muted">
          <span aria-hidden="true" className="mx-1.5 text-muted">·</span>
          {m}
        </span>
      ))}
    </span>
  );
}

function Body({
  result,
  rows,
  view,
  keyAttrs,
  hasNext,
}: {
  result: QueryResult;
  rows: Record<string, unknown>[];
  view: 'table' | 'json';
  keyAttrs: string[];
  hasNext: boolean;
}) {
  if (result.status === 'idle') {
    return <Centered>Run a query to see results</Centered>;
  }

  if (result.status === 'loading') {
    return (
      <div className="flex flex-col gap-1.5 p-4" role="status" aria-label="Loading results">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-7 bg-elevated rounded animate-pulse"
            style={{ opacity: 1 - i * 0.2 }}
          />
        ))}
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="m-4 py-2.5 px-3.5 font-mono text-xs text-err bg-err-dim rounded-md">
        {result.error ?? 'Unknown error'}
      </div>
    );
  }

  if (rows.length === 0) {
    // A page can be empty yet have more data ahead when a filter is active
    // (filters run after the key read), so pagination stays in the toolbar.
    return (
      <Centered>
        <span className="text-secondary">
          {hasNext ? 'No items on this page' : 'Query matched 0 items'}
        </span>
        <span>
          {hasNext
            ? 'Filters run after the key read; keep paging with › to scan further'
            : 'The keys are valid but nothing lives there'}
        </span>
      </Centered>
    );
  }

  return view === 'table' ? (
    <TableView result={result} keyAttrs={keyAttrs} />
  ) : (
    <pre className="p-4 m-0 font-mono text-[12px] text-secondary leading-relaxed animate-fade-in">
      {JSON.stringify(rows, null, 2)}
    </pre>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="h-full min-h-25 flex flex-col items-center justify-center gap-1 text-[12px] text-muted text-center px-4">
      {children}
    </div>
  );
}
