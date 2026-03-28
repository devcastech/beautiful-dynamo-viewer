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

  // Pre-fill from initialPattern (e.g. from "Use" button in EntityInspector)
  useEffect(() => {
    if (!initialPattern) return;

    // Extract clause in last parens: "Some label (GSI1 PK=USER#<userId>)"
    const parenMatch = initialPattern.match(/\(([^)]+)\)$/);
    const clause = parenMatch ? parenMatch[1] : initialPattern;

    // Detect index prefix
    const indexMatch = clause.match(/^(GSI\d+)\s+/i);
    const detectedGsi = indexMatch ? indexMatch[1].toUpperCase() : null;
    const clauseBody = indexMatch ? clause.slice(indexMatch[0].length) : clause;

    // Parse PK=<value>
    const pkMatch = clauseBody.match(/PK=([^\s]+)/);
    // Parse SK=<value> with optional begins_with prefix
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

  async function handleSubmit(params: QueryParams) {
    setQueryResult({ status: 'loading', data: [] });
    const start = Date.now();
    try {
      const data = await queryTable(params);
      setQueryResult({ status: 'success', data, durationMs: Date.now() - start });
    } catch (err) {
      setQueryResult({
        status: 'error',
        data: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!isTauriRuntime()) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-6">
        <p className="text-sm font-medium text-slate-600">Desktop app only</p>
        <p className="text-xs text-slate-400">
          Query execution requires AWS credentials available only in the Tauri desktop app.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto">
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
      <div className="border-t border-slate-100 pt-4">
        <QueryResults result={queryResult} />
      </div>
    </div>
  );
}
