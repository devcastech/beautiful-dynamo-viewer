import { useState } from 'react';
import type { QueryResult } from '../../hooks/useQueryExecutor.ts';
import { CapacityUsage, Pager, ViewBtn } from './utils.tsx';
import { TableView } from './tableView.tsx';

interface QueryResultsProps {
  result: QueryResult;
  /** Physical key attributes, highlighted and pinned first in the table. */
  keyAttrs: string[];
  onNext?: () => void;
  onPrev?: () => void;
}

export function QueryResults({ result, keyAttrs, onNext, onPrev }: QueryResultsProps) {
  const [view, setView] = useState<'table' | 'json'>('table');

  if (result.status === 'idle') {
    return (
      <div className="flex items-center justify-center h-25 font-mono text-xs text-muted">
        Run a query to see results
      </div>
    );
  }

  if (result.status === 'loading') {
    return (
      <div className="flex flex-col gap-1.5" role="status" aria-label="Loading results">
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
      <div className="py-2.5 px-3.5 font-mono text-xs text-err bg-err-dim border border-err/20 rounded-md">
        {result.error ?? 'Unknown error'}
      </div>
    );
  }

  const rows = result.data;

  if (rows.length === 0) {
    // A page can be empty yet have more data ahead when a filter is active
    // (filters run after the key read), so keep pagination available.
    return (
      <div className="flex flex-col gap-2.5">
        {(onPrev || onNext) && (
          <div className="flex justify-end">
            <Pager onPrev={onPrev} onNext={onNext} />
          </div>
        )}
        <div className="flex flex-col items-center justify-center gap-1 h-25 font-mono text-xs">
          <span className="text-secondary">
            {onNext ? 'No items on this page' : 'Query matched 0 items'}
          </span>
          <span className="text-muted">
            {onNext
              ? 'Filters run after the key read — keep paging with Next to scan further'
              : 'The keys are valid but nothing lives there'}
            {result.durationMs !== undefined && ` · ${result.durationMs}ms`}
            <CapacityUsage consumedCapacity={result.consumedCapacity} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-ok">
          {rows.length} item{rows.length !== 1 ? 's' : ''}
          {result.durationMs !== undefined && (
            <span className="text-muted ml-1.5">· {result.durationMs}ms</span>
          )}
          <CapacityUsage consumedCapacity={result.consumedCapacity} />
        </span>
        <div className="flex items-center gap-2">
          <div className="flex border border-line rounded overflow-hidden">
            <ViewBtn active={view === 'table'} onClick={() => setView('table')}>Table</ViewBtn>
            <ViewBtn active={view === 'json'} onClick={() => setView('json')}>JSON</ViewBtn>
          </div>
          <Pager onPrev={onPrev} onNext={onNext} />
        </div>
      </div>

      {view === 'table' ? (
        <TableView result={result} keyAttrs={keyAttrs} />
      )  : (
        <pre className="bg-elevated border border-line rounded-md p-3.5 overflow-auto max-h-100 font-mono text-[12px] text-secondary m-0 leading-relaxed">
          {JSON.stringify(rows, null, 2)}
        </pre>
      )}
    </div>
  );
}
