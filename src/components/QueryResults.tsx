import { useState } from 'react';
import type { QueryResult } from '../types/query.ts';

interface QueryResultsProps {
  result: QueryResult;
}

export function QueryResults({ result }: QueryResultsProps) {
  const [view, setView] = useState<'table' | 'json'>('table');

  if (result.status === 'idle') {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-slate-400">
        Run a query to see results
      </div>
    );
  }

  if (result.status === 'loading') {
    return (
      <div className="space-y-2 p-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 bg-slate-100 rounded" />
        ))}
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
        {result.error ?? 'Unknown error'}
      </div>
    );
  }

  // success
  const rows = result.data;
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
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {rows.length} item{rows.length !== 1 ? 's' : ''}
          {result.durationMs !== undefined && (
            <span className="ml-1 text-slate-400">· {result.durationMs}ms</span>
          )}
        </span>
        <div className="flex gap-0.5 border border-slate-200 rounded overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setView('table')}
            className={`px-2.5 py-1 transition-colors ${view === 'table' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setView('json')}
            className={`px-2.5 py-1 transition-colors ${view === 'json' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            JSON
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <div className="overflow-x-auto border border-slate-200 rounded text-xs">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {columns.map((col) => {
                    const val = row[col];
                    const display =
                      val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
                    return (
                      <td key={col} className="px-3 py-2 text-slate-700 max-w-[200px] truncate">
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
        <pre className="bg-slate-950 text-slate-100 text-xs rounded p-4 overflow-auto max-h-96">
          {JSON.stringify(rows, null, 2)}
        </pre>
      )}
    </div>
  );
}
