import { useState } from 'react';
import type { QueryResult } from '../types/query.ts';

interface QueryResultsProps {
  result: QueryResult;
  onNext?: () => void;
  onPrev?: () => void;
}

export function QueryResults({ result, onNext, onPrev }: QueryResultsProps) {
  const [view, setView] = useState<'table' | 'json'>('table');

  if (result.status === 'idle') {
    return (
      <div className="flex items-center justify-center h-[100px] font-mono text-xs text-muted">
        Run a query to see results
      </div>
    );
  }

  if (result.status === 'loading') {
    return (
      <div className="flex flex-col gap-1.5">
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
      <div className="py-2.5 px-3.5 font-mono text-xs text-err bg-err-dim border border-[rgba(239,68,68,0.2)] rounded-md">
        {result.error ?? 'Unknown error'}
      </div>
    );
  }

  // success
  const rows = result.status === 'success' ? result.data : [];
  console.log('results')
  const allKeys = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>()),
  );

  const priorityKeys = ['PK', 'SK', 'pk', 'sk'];
  const columns = [
    ...priorityKeys.filter((k) => allKeys.includes(k)),
    ...allKeys.filter((k) => !priorityKeys.includes(k)).sort(),
  ];

  return (
    <div className="flex flex-col gap-2.5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-ok">
          {rows.length} item{rows.length !== 1 ? 's' : ''}
          {result.durationMs !== undefined && (
            <span className="text-muted ml-1.5">· {result.durationMs}ms</span>
          )}
        </span>
        <div className="flex border border-line rounded overflow-hidden">
          <ViewBtn active={view === 'table'} onClick={() => setView('table')}>Table</ViewBtn>
          <ViewBtn active={view === 'json'} onClick={() => setView('json')}>JSON</ViewBtn>
        </div>
      </div>

      {view === 'table' ? (
        <div className="overflow-x-auto border border-line rounded-md">
          <table className="min-w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="bg-elevated">
                {columns.map((col) => (
                  <th key={col} className="py-1.5 px-3 text-left font-semibold text-muted whitespace-nowrap border-b border-line tracking-[0.05em]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-line-dim hover:bg-elevated transition-colors">
                  {columns.map((col) => {
                    const val = row[col];
                    const display =
                      val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
                    const isPkSk = col === 'PK' || col === 'SK' || col === 'pk' || col === 'sk';
                    return (
                      <td key={col} className={`py-1.5 px-3 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap ${isPkSk ? 'text-accent' : 'text-secondary'}`}>
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="bg-elevated border border-line rounded-md p-[14px] overflow-auto max-h-[400px] font-mono text-[11px] text-secondary m-0 leading-relaxed">
          {JSON.stringify(rows, null, 2)}
        </pre>
      )}
      {(onPrev || onNext) && (
        <div className="flex items-center justify-between mt-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={!onPrev}
            className="font-mono text-xs px-4 py-1.5 border border-line rounded hover:border-accent hover:text-accent text-muted transition-colors cursor-pointer bg-transparent disabled:opacity-20 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!onNext}
            className="font-mono text-xs px-4 py-1.5 border border-line rounded hover:border-accent hover:text-accent text-muted transition-colors cursor-pointer bg-transparent disabled:opacity-20 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function ViewBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-[3px] px-[9px] font-mono text-xs border-0 cursor-pointer transition-all ${
        active ? 'bg-accent text-canvas' : 'bg-transparent text-muted'
      }`}
    >
      {children}
    </button>
  );
}
