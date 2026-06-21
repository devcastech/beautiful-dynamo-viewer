import { useEffect, useState } from 'react';
import { Bookmark, Check, Play, RefreshCw, X } from 'lucide-react';
import { parsePattern } from '../domain/schema/patternParser.ts';
import { Input } from './ui/Input.tsx';
import { Select } from './ui/Select.tsx';
import { IconButton } from './ui/Button.tsx';
import type { Entity, SkOp, TableSchema } from '../domain/schema/types.ts';
import type { QueryParams, SkCondition } from '../services/dynamo.ts';
import { isMacOS } from '../services/runtime.ts';

interface QueryBuilderProps {
  schema: TableSchema;
  entity: Entity;
  tableName: string;
  selectedTarget: 'base' | string;
  pkValues: Record<string, string>;
  skOp: SkOp;
  skValues: Record<string, string>;
  sk2Values: Record<string, string>;
  onChangeTarget: (target: 'base' | string) => void;
  onChangePkValues: (values: Record<string, string>) => void;
  onChangeSkOp: (op: SkOp) => void;
  onChangeSkValues: (values: Record<string, string>) => void;
  onChangeSk2Values: (values: Record<string, string>) => void;
  onSubmit: (params: QueryParams) => void;
  /** When set, executing is blocked and this explains why. */
  executeDisabledReason?: string;
  onSaveQuery?: (name: string) => void;
  onUpdateQuery?: () => void;
  activeQueryName?: string;
  isLoading?: boolean;
}

const VALUE_INPUT_CLS =
  'font-mono text-xs text-accent bg-canvas border border-line rounded py-[3px] px-[7px] min-w-[80px] w-auto outline-none transition-colors focus:border-accent';

const SK_OPS: { op: SkOp; label: string }[] = [
  { op: 'none', label: 'none' },
  { op: 'Eq', label: '=' },
  { op: 'BeginsWith', label: 'begins_with' },
  { op: 'Between', label: 'between' },
];

/** Short labels for the composed-key preview in the query bar. */
const SK_OP_LABEL: Record<Exclude<SkOp, 'none'>, string> = {
  Eq: '=',
  BeginsWith: 'begins_with',
  Between: 'between',
};

export function QueryBuilder({
  schema,
  entity,
  tableName,
  selectedTarget,
  pkValues,
  skOp,
  skValues,
  sk2Values,
  onChangeTarget,
  onChangePkValues,
  onChangeSkOp,
  onChangeSkValues,
  onChangeSk2Values,
  onSubmit,
  executeDisabledReason,
  onSaveQuery,
  onUpdateQuery,
  activeQueryName,
  isLoading
}: QueryBuilderProps) {
  const [saveName, setSaveName] = useState<string | null>(null);

  const activePattern =
    selectedTarget === 'base'
      ? null
      : entity.indexPatterns.find((p) => p.index === selectedTarget) ?? null;
  const activeIndexDef = activePattern
    ? schema.indexes.find((d) => d.name === activePattern.index) ?? null
    : null;

  const activePkPattern = activePattern ? activePattern.pk : entity.pk;
  const activeSkPattern = activePattern ? activePattern.sk : entity.sk;

  const parsedPk = parsePattern(activePkPattern);
  const parsedSk = parsePattern(activeSkPattern);

  const pkFilled = parsedPk.variables.every((v) => (pkValues[v] ?? '').trim() !== '');
  const skFilled = skOp === 'none' || parsedSk.variables.every((v) => (skValues[v] ?? '').trim() !== '');
  const canSubmit = pkFilled && skFilled && !executeDisabledReason && !isLoading;

  function buildParams(): QueryParams {
    const pkValue = parsedPk.resolve(pkValues);
    const pkName = activeIndexDef ? activeIndexDef.pkAttr : schema.keys.pk;
    const skName = activeIndexDef ? activeIndexDef.skAttr ?? 'SK' : schema.keys.sk;

    let skCondition: SkCondition | undefined;
    if (skOp !== 'none') {
      const skValue = parsedSk.variables.length > 0 ? parsedSk.resolve(skValues) : activeSkPattern;
      if (skOp === 'Eq') skCondition = { op: 'Eq', value: skValue };
      else if (skOp === 'BeginsWith') skCondition = { op: 'BeginsWith', value: skValue };
      else if (skOp === 'Between') {
        const to = parsedSk.variables.length > 0 ? parsedSk.resolve(sk2Values) : activeSkPattern;
        skCondition = { op: 'Between', value: { from: skValue, to } };
      }
    }

    return {
      table: tableName,
      pkName,
      pkValue,
      skName: skOp !== 'none' ? skName : undefined,
      skCondition,
      indexName: activePattern ? activePattern.index : undefined,
    };
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(buildParams());
  }

  // ⌘↵ / Ctrl+Enter executes from anywhere in the builder
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSubmit, pkValues, skValues, sk2Values, skOp, selectedTarget, tableName]);

  function handleConfirmSave() {
    const name = saveName?.trim();
    if (!name) return;
    onSaveQuery?.(name);
    setSaveName(null);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ===== Query bar (pinned) — target · composed key · run ===== */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-line bg-canvas/60">
        <Select
          ariaLabel="Query target"
          value={selectedTarget}
          onChange={onChangeTarget}
          options={[
            { value: 'base', label: 'Base table' },
            ...entity.indexPatterns.map((pattern) => ({ value: pattern.index, label: pattern.index })),
          ]}
          className="shrink-0 font-semibold text-accent bg-accent-dim border-accent-line"
        />

        <div className="flex-1 min-w-0 overflow-x-auto bg-canvas border border-line rounded-md px-2.5 py-[6px]">
          <KeyPreview
            pkSegments={parsedPk.segments}
            pkValues={pkValues}
            skOp={skOp}
            skSegments={parsedSk.segments}
            skValues={skValues}
            sk2Values={sk2Values}
          />
        </div>

        {saveName === null ? (
          <div className="shrink-0 flex items-center gap-0.5">
            {onUpdateQuery && activeQueryName && (
              <IconButton
                label={`Update query “${activeQueryName}”`}
                onClick={onUpdateQuery}
                className="text-accent"
              >
                <RefreshCw size={13} aria-hidden="true" />
              </IconButton>
            )}
            {onSaveQuery && (
              <IconButton
                label={activeQueryName ? 'Save as new query' : 'Save query'}
                onClick={() => setSaveName('')}
              >
                <Bookmark size={13} aria-hidden="true" />
              </IconButton>
            )}
          </div>
        ) : (
          <div className="shrink-0 flex items-center gap-1">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmSave();
                if (e.key === 'Escape') setSaveName(null);
              }}
              placeholder="Query name…"
              autoFocus
              className="w-40"
            />
            <IconButton label="Confirm save" onClick={handleConfirmSave} disabled={!saveName.trim()}>
              <Check size={13} aria-hidden="true" />
            </IconButton>
            <IconButton label="Cancel save" onClick={() => setSaveName(null)}>
              <X size={13} aria-hidden="true" />
            </IconButton>
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          title={executeDisabledReason}
          className={`shrink-0 inline-flex items-center gap-1.5 py-[7px] px-4 font-mono text-xs font-semibold tracking-[0.05em] rounded-md border transition-all ${
            canSubmit
              ? 'bg-accent border-accent text-canvas cursor-pointer hover:shadow-[0_0_18px_var(--accent-glow)]'
              : 'bg-transparent border-line text-muted opacity-50 cursor-not-allowed'
          }`}
        >
          <Play size={11} aria-hidden="true" />
          Execute
          <kbd className="font-mono text-[10px] font-normal opacity-70 border border-current/30 rounded px-1 ml-1">

            {
              isMacOS() ? '⌘' : 'Ctrl'
            }
            ↵
          </kbd>
        </button>
      </div>

      {/* ===== Builder fields (scroll) — the params that compose the bar ===== */}
      <div className="flex-1 overflow-y-auto dot-grid px-5 py-4">
        <div className="flex flex-col gap-4">
          {/* Partition key */}
          <PatternRow
            label="Partition key"
            attr={activeIndexDef ? activeIndexDef.pkAttr : schema.keys.pk}
            segments={parsedPk.segments}
            values={pkValues}
            onChange={onChangePkValues}
          />

          {/* Sort key */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <span className="micro-label text-[12px]">Sort key</span>
              <span className="font-mono text-[11px] text-muted/60">
                {activeIndexDef ? activeIndexDef.skAttr ?? 'SK' : schema.keys.sk}
              </span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {SK_OPS.map(({ op, label }) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => onChangeSkOp(op)}
                  aria-pressed={skOp === op}
                  className={`py-[3px] px-[9px] font-mono text-[12px] rounded border cursor-pointer transition-all ${
                    skOp === op
                      ? 'border-accent bg-accent-dim text-accent'
                      : 'border-line bg-transparent text-muted hover:text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {skOp !== 'none' && (
              <ValueBox
                segments={parsedSk.segments}
                literalFallback={activeSkPattern}
                values={skValues}
                onChange={onChangeSkValues}
              />
            )}

            {skOp === 'Between' && parsedSk.variables.length > 0 && (
              <>
                <span className="font-mono text-[11px] text-muted pl-[2px]">to</span>
                <ValueBox
                  segments={parsedSk.segments}
                  literalFallback={activeSkPattern}
                  values={sk2Values}
                  onChange={onChangeSk2Values}
                  placeholderSuffix=" (end)"
                />
              </>
            )}
          </div>

          {executeDisabledReason && (
            <span className="font-mono text-[12px] text-muted">{executeDisabledReason}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Pieces ----

type Segments = ReturnType<typeof parsePattern>['segments'];

/** Read-only render of the key the query will send: filled values burn amber, empty <vars> recede. */
function KeyPreview({
  pkSegments,
  pkValues,
  skOp,
  skSegments,
  skValues,
  sk2Values,
}: {
  pkSegments: Segments;
  pkValues: Record<string, string>;
  skOp: SkOp;
  skSegments: Segments;
  skValues: Record<string, string>;
  sk2Values: Record<string, string>;
}) {
  return (
    <span className="font-mono text-xs whitespace-nowrap">
      <ResolvedPattern segments={pkSegments} values={pkValues} />
      {skOp === 'none' ? (
        <span className="text-muted/40">{'  ·  no sort condition'}</span>
      ) : (
        <>
          <span className="text-muted/40">{'  ·  '}</span>
          <span className="text-muted">{SK_OP_LABEL[skOp]}&nbsp;</span>
          <ResolvedPattern segments={skSegments} values={skValues} />
          {skOp === 'Between' && (
            <>
              <span className="text-muted">{' to '}</span>
              <ResolvedPattern segments={skSegments} values={sk2Values} />
            </>
          )}
        </>
      )}
    </span>
  );
}

function ResolvedPattern({ segments, values }: { segments: Segments; values: Record<string, string> }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'literal' ? (
          <span key={i} className="text-secondary">
            {seg.value}
          </span>
        ) : (values[seg.name] ?? '').trim() ? (
          <span key={i} className="text-accent">
            {values[seg.name]}
          </span>
        ) : (
          <span key={i} className="text-muted/50">{`<${seg.name}>`}</span>
        ),
      )}
    </>
  );
}

function PatternRow({
  label,
  attr,
  segments,
  values,
  onChange,
}: {
  label: string;
  attr: string;
  segments: Segments;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="micro-label text-[12px]">{label}</span>
        <span className="font-mono text-[11px] text-muted/60">{attr}</span>
      </div>
      <ValueBox segments={segments} values={values} onChange={onChange} />
    </div>
  );
}

function ValueBox({
  segments,
  values,
  onChange,
  literalFallback,
  placeholderSuffix = '',
}: {
  segments: Segments;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  literalFallback?: string;
  placeholderSuffix?: string;
}) {
  const hasVariables = segments.some((s) => s.type === 'variable');
  return (
    <div className="flex flex-wrap items-center gap-1 py-1.5 px-2.5 bg-elevated border border-line rounded-md min-h-9">
      {!hasVariables && literalFallback !== undefined ? (
        <span className="pattern-literal text-xs">{literalFallback}</span>
      ) : (
        segments.map((seg, i) =>
          seg.type === 'literal' ? (
            <span key={i} className="pattern-literal text-xs">{seg.value}</span>
          ) : (
            <input
              key={i}
              type="text"
              placeholder={`${seg.name}${placeholderSuffix}`}
              value={values[seg.name] ?? ''}
              onChange={(e) => onChange({ ...values, [seg.name]: e.target.value })}
              spellCheck={false}
              className={VALUE_INPUT_CLS}
              style={{ width: `${Math.max((values[seg.name] ?? seg.name).length + 2, 8)}ch` }}
            />
          ),
        )
      )}
    </div>
  );
}
