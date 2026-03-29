import { useEffect, useState } from 'react';
import { parsePattern } from '../utils/patternParser.ts';
import { isTauriRuntime, queryTable } from '../lib/dynamo.ts';
import { QueryBuilder } from './QueryBuilder.tsx';
import { QueryResults } from './QueryResults.tsx';
import type { Entity } from '../types/schema.ts';
import type { QueryParams, QueryResult } from '../types/query.ts';

type SkOp = 'Eq' | 'BeginsWith' | 'Between' | 'none';

interface QueryPlaygroundProps {
  entity: Entity;
  tableName: string;
  initialPattern?: string;
}

export function QueryPlayground({ entity, tableName, initialPattern }: QueryPlaygroundProps) {
  const [selectedTarget, setSelectedTarget] = useState<'base' | string>('base');
  const [pkValues, setPkValues] = useState<Record<string, string>>({});
  const [skOp, setSkOp] = useState<SkOp>('none');
  const [skValues, setSkValues] = useState<Record<string, string>>({});
  const [sk2Values, setSk2Values] = useState<Record<string, string>>({});
  const [queryResult, setQueryResult] = useState<QueryResult>({ status: 'idle', data: [] });
  const [lastParams, setLastParams] = useState<QueryParams | null>(null);
  const [prevKeys, setPrevKeys] = useState<(Record<string, unknown> | undefined)[]>([]);
  const [currentStartKey, setCurrentStartKey] = useState<Record<string, unknown> | undefined>(undefined);

  useEffect(() => {
    if (!initialPattern) return;

    const parenMatch = initialPattern.match(/\(([^)]+)\)$/);
    const clause = parenMatch ? parenMatch[1] : initialPattern;

    const indexMatch = clause.match(/^(GSI\d+)\s+/i);
    const detectedGsi = indexMatch ? indexMatch[1].toUpperCase() : null;
    const clauseBody = indexMatch ? clause.slice(indexMatch[0].length) : clause;

    const pkMatch = clauseBody.match(/PK=([^\s]+)/);
    const beginsWith = /begins_with\s+SK=/.test(clauseBody);
    const skMatch = clauseBody.match(/SK=([^\s]+)/);

    if (detectedGsi && entity.gsis.some((g) => g.name === detectedGsi)) {
      setSelectedTarget(detectedGsi);
      const gsi = entity.gsis.find((g) => g.name === detectedGsi)!;

      if (pkMatch) {
        const parsed = parsePattern(gsi.pk);
        const vals: Record<string, string> = {};
        const parts = pkMatch[1].split('#');
        let varIdx = 0;
        parsed.segments.forEach((seg) => {
          if (seg.type === 'variable' && parts[varIdx] !== undefined) {
            vals[seg.name] = parts[varIdx];
            varIdx++;
          }
        });
        setPkValues(vals);
      }

      if (skMatch) {
        setSkOp(beginsWith ? 'BeginsWith' : 'Eq');
        const parsed = parsePattern(gsi.sk);
        const vals: Record<string, string> = {};
        const parts = skMatch[1].split('#');
        let varIdx = 0;
        parsed.segments.forEach((seg) => {
          if (seg.type === 'variable' && parts[varIdx] !== undefined) {
            vals[seg.name] = parts[varIdx];
            varIdx++;
          }
        });
        setSkValues(vals);
      } else {
        setSkOp('none');
        setSkValues({});
      }
    } else {
      setSelectedTarget('base');
      if (pkMatch) {
        const parsed = parsePattern(entity.pk);
        const vals: Record<string, string> = {};
        parsed.segments.forEach((seg) => {
          if (seg.type === 'variable') vals[seg.name] = '';
        });
        setPkValues(vals);
      }
    }

    setSk2Values({});
    setQueryResult({ status: 'idle', data: [] });
  }, [initialPattern, entity]);

  async function fetchPage(params: QueryParams, startKey?: Record<string, unknown>) {
    setQueryResult({ status: 'loading', data: [] });
    const start = Date.now();
    try {
      const { items, lastKey } = await queryTable({ ...params, exclusiveStartKey: startKey });
      setQueryResult({ status: 'success', data: items, lastKey, durationMs: Date.now() - start });
    } catch (err) {
      setQueryResult({
        status: 'error',
        data: [],
        error: err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : String(err)),
      });
    }
  }

  async function handleSubmit(params: QueryParams) {
    setLastParams(params);
    setPrevKeys([]);
    setCurrentStartKey(undefined);
    await fetchPage(params, undefined);
  }

  async function handleNextPage() {
    if (!lastParams || !queryResult.lastKey) return;
    setPrevKeys((prev) => [...prev, currentStartKey]);
    setCurrentStartKey(queryResult.lastKey);
    await fetchPage(lastParams, queryResult.lastKey);
  }

  async function handlePrevPage() {
    if (!lastParams || prevKeys.length === 0) return;
    const newPrevKeys = [...prevKeys];
    const prevKey = newPrevKeys.pop();
    setPrevKeys(newPrevKeys);
    setCurrentStartKey(prevKey);
    await fetchPage(lastParams, prevKey);
  }

  if (!isTauriRuntime()) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Builder area (dimmed, non-interactive) */}
        <div className="flex-1 p-5 overflow-y-auto opacity-40 pointer-events-none">
          <QueryBuilder
            entity={entity}
            tableName={tableName}
            selectedTarget={selectedTarget}
            pkValues={pkValues}
            skOp={skOp}
            skValues={skValues}
            sk2Values={sk2Values}
            onChangeTarget={setSelectedTarget}
            onChangePkValues={setPkValues}
            onChangeSkOp={setSkOp}
            onChangeSkValues={setSkValues}
            onChangeSk2Values={setSk2Values}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Notice */}
        <div className="py-3 px-5 border-t border-line bg-surface flex items-center gap-2 shrink-0">
          <span className="font-mono text-[11px] text-muted">
            Query execution requires the Tauri desktop app with AWS credentials.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Builder */}
      <div className="p-5 border-b border-line shrink-0 overflow-y-auto max-h-[55%] bg-[rgba(12,14,20,0.55)]">
        <QueryBuilder
          entity={entity}
          tableName={tableName}
          selectedTarget={selectedTarget}
          pkValues={pkValues}
          skOp={skOp}
          skValues={skValues}
          sk2Values={sk2Values}
          onChangeTarget={setSelectedTarget}
          onChangePkValues={setPkValues}
          onChangeSkOp={setSkOp}
          onChangeSkValues={setSkValues}
          onChangeSk2Values={setSk2Values}
          onSubmit={handleSubmit}
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="py-1.5 px-5 border-b border-line-dim bg-[rgba(19,22,32,0.8)] shrink-0">
          <span className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-muted">
            Results
          </span>
        </div>
        <div className="flex-1 overflow-hidden py-4 px-5 overflow-y-auto bg-[rgba(12,14,20,0.45)]">
          <QueryResults
            result={queryResult}
            onNext={queryResult.lastKey ? handleNextPage : undefined}
            onPrev={prevKeys.length > 0 ? handlePrevPage : undefined}
          />
        </div>
      </div>
    </div>
  );
}
