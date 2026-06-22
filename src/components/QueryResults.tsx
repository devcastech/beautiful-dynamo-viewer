import { Fragment, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import type { QueryResult } from '../hooks/useQueryExecutor.ts';

interface QueryResultsProps {
  result: QueryResult;
  /** Physical key attributes, highlighted and pinned first in the table. */
  keyAttrs: string[];
  onNext?: () => void;
  onPrev?: () => void;
}

export function QueryResults({ result, keyAttrs, onNext, onPrev }: QueryResultsProps) {
  const [view, setView] = useState<'table' | 'json'>('table');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Collapse expansion when a new result lands
  useEffect(() => {
    setExpandedRow(null);
  }, [result]);

  useEffect(() => {
    if (copied === null) return;
    const t = setTimeout(() => setCopied(null), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      // Clipboard unavailable — ignore.
    }
  }

  if (result.status === 'idle') {
    return (
      <div className="flex items-center justify-center h-[100px] font-mono text-xs text-muted">
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
        <div className="flex flex-col items-center justify-center gap-1 h-[100px] font-mono text-xs">
          <span className="text-secondary">
            {onNext ? 'No items on this page' : 'Query matched 0 items'}
          </span>
          <span className="text-muted">
            {onNext
              ? 'Filters run after the key read — keep paging with Next to scan further'
              : 'The keys are valid but nothing lives there'}
            {result.durationMs !== undefined && ` · ${result.durationMs}ms`}
          </span>
        </div>
      </div>
    );
  }

  const allKeys = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>()),
  );

  const columns = [
    ...keyAttrs.filter((k) => allKeys.includes(k)),
    ...allKeys.filter((k) => !keyAttrs.includes(k)).sort(),
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
        <div className="flex items-center gap-2">
          {copied && (
            <span className="font-mono text-[11px] text-ok animate-fade-in" aria-live="polite">
              copied ✓
            </span>
          )}
          <div className="flex border border-line rounded overflow-hidden">
            <ViewBtn active={view === 'table'} onClick={() => setView('table')}>Table</ViewBtn>
            <ViewBtn active={view === 'json'} onClick={() => setView('json')}>JSON</ViewBtn>
          </div>
          <Pager onPrev={onPrev} onNext={onNext} />
        </div>
      </div>

      {view === 'table' ? (
        <div className="overflow-x-auto border border-line rounded-md">
          <table className="min-w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr className="bg-elevated">
                <th className="w-6 border-b border-line" aria-label="Expand" />
                {columns.map((col) => (
                  <th
                    key={col}
                    className={`py-1.5 px-3 text-left font-semibold whitespace-nowrap border-b border-line tracking-[0.05em] ${
                      keyAttrs.includes(col) ? 'text-accent' : 'text-muted'
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isExpanded = expandedRow === i;
                return (
                  <Fragment key={i}>
                    <tr
                      onClick={() => setExpandedRow(isExpanded ? null : i)}
                      aria-expanded={isExpanded}
                      className={`border-b border-line-dim cursor-pointer transition-colors ${
                        isExpanded ? 'bg-elevated' : 'hover:bg-elevated'
                      }`}
                    >
                      <td className="pl-2 text-muted/60 select-none" aria-hidden="true">
                        {isExpanded ? '▾' : '▸'}
                      </td>
                      {columns.map((col) => {
                        const val = row[col];
                        const display =
                          val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
                        const isKey = keyAttrs.includes(col);
                        return (
                          <td
                            key={col}
                            title={display ? `${display}\n(click row to expand · ⌥click to copy)` : undefined}
                            onClick={(e) => {
                              if (e.altKey) {
                                e.stopPropagation();
                                void copyText(`${i}:${col}`, display);
                              }
                            }}
                            className={`py-1.5 px-3 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap ${
                              copied === `${i}:${col}`
                                ? 'text-ok'
                                : isKey
                                  ? 'text-primary font-medium'
                                  : 'text-secondary'
                            }`}
                          >
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-line-dim bg-canvas/60">
                        <td colSpan={columns.length + 1} className="p-0">
                          <div className="relative px-4 py-3 animate-fade-in">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void copyText(`row:${i}`, JSON.stringify(row, null, 2));
                              }}
                              className="absolute right-3 top-2.5 inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-accent bg-elevated border border-line rounded px-2 py-1 cursor-pointer transition-colors"
                            >
                              <Copy size={10} aria-hidden="true" />
                              {copied === `row:${i}` ? 'copied ✓' : 'copy item'}
                            </button>
                            <pre className="m-0 font-mono text-[12px] text-secondary leading-relaxed overflow-x-auto max-h-[300px]">
                              {JSON.stringify(row, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="bg-elevated border border-line rounded-md p-[14px] overflow-auto max-h-[400px] font-mono text-[12px] text-secondary m-0 leading-relaxed">
          {JSON.stringify(rows, null, 2)}
        </pre>
      )}
    </div>
  );
}

/** Compact Prev/Next pager, styled like the Table/JSON toggle group. */
function Pager({ onPrev, onNext }: { onPrev?: () => void; onNext?: () => void }) {
  if (!onPrev && !onNext) return null;
  return (
    <div className="flex border border-line rounded overflow-hidden">
      <PagerBtn onClick={onPrev} disabled={!onPrev} label="Previous page">
        <ChevronLeft size={13} aria-hidden="true" />
        Prev
      </PagerBtn>
      <PagerBtn onClick={onNext} disabled={!onNext} label="Next page" borderLeft>
        Next
        <ChevronRight size={13} aria-hidden="true" />
      </PagerBtn>
    </div>
  );
}

function PagerBtn({
  onClick,
  disabled,
  label,
  borderLeft = false,
  children,
}: {
  onClick?: () => void;
  disabled: boolean;
  label: string;
  borderLeft?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex items-center gap-1 py-[3px] px-2 font-mono text-xs bg-transparent text-muted cursor-pointer transition-colors hover:text-secondary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
        borderLeft ? 'border-0 border-l border-line' : 'border-0'
      }`}
    >
      {children}
    </button>
  );
}

function ViewBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`py-[3px] px-[9px] font-mono text-xs border-0 cursor-pointer transition-all ${
        active ? 'bg-accent text-canvas' : 'bg-transparent text-muted hover:text-secondary'
      }`}
    >
      {children}
    </button>
  );
}
