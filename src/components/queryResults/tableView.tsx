import { Fragment, useState, useEffect } from "react";
import { Copy } from "lucide-react";
import { QueryResult } from "../../hooks/useQueryExecutor";

interface Props {
  keyAttrs: string[];
  result: QueryResult;
}

export const TableView = ({ result, keyAttrs }: Props) => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const { data: rows } = result;
  const [copied, setCopied] = useState<string | null>(null);

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      // Clipboard unavailable — ignore.
    }
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

  useEffect(() => {
    setExpandedRow(null);
  }, [result]);

  useEffect(() => {
    if (copied === null) return;
    const t = setTimeout(() => setCopied(null), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="overflow-x-auto border border-line rounded-md pb-4">
      <table className="min-w-full border-collapse font-mono text-[12px]">
        <thead>
          <tr className="bg-elevated">
            <th className="w-6 border-b border-line" aria-label="Expand" />
            {columns.map((col) => (
              <th
                key={col}
                className={`py-1.5 px-3 text-left font-semibold whitespace-nowrap border-b border-line tracking-[0.05em] ${
                  keyAttrs.includes(col) ? "text-accent" : "text-muted"
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
                    isExpanded ? "bg-elevated" : "hover:bg-elevated"
                  }`}
                >
                  <td
                    className="pl-2 text-muted/60 select-none"
                    aria-hidden="true"
                  >
                    {isExpanded ? "▾" : "▸"}
                  </td>
                  {columns.map((col) => {
                    const val = row[col];
                    const display =
                      val === undefined
                        ? ""
                        : typeof val === "object"
                          ? JSON.stringify(val)
                          : String(val);
                    const isKey = keyAttrs.includes(col);
                    return (
                      <td
                        key={col}
                        title={
                          display
                            ? `${display}\n(click row to expand · ⌥click to copy)`
                            : undefined
                        }
                        onClick={(e) => {
                          if (e.altKey) {
                            e.stopPropagation();
                            void copyText(`${i}:${col}`, display);
                          }
                        }}
                        className={`py-1.5 px-3 max-w-50 overflow-hidden text-ellipsis whitespace-nowrap ${
                          copied === `${i}:${col}`
                            ? "text-ok"
                            : isKey
                              ? "text-primary font-medium"
                              : "text-secondary"
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
                            void copyText(
                              `row:${i}`,
                              JSON.stringify(row, null, 2),
                            );
                          }}
                          className="absolute left-30 top-2.5 inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-accent bg-elevated border border-line rounded px-2 py-1 cursor-pointer transition-colors"
                        >
                          <Copy size={10} aria-hidden="true" />
                          {copied === `row:${i}` ? "copied ✓" : "copy item"}
                        </button>
                        <pre className="m-0 font-mono text-[12px] text-secondary leading-relaxed overflow-x-auto max-h-75">
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
  );
};
