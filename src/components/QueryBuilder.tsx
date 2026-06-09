import { useEffect, useState } from 'react';
import { Bookmark, Check, Play, X } from 'lucide-react';
import { parsePattern } from '../domain/schema/patternParser.ts';
import { Input } from './ui/Input.tsx';
import { IconButton } from './ui/Button.tsx';
import type { Entity, SkOp, TableSchema } from '../domain/schema/types.ts';
import type { QueryParams, SkCondition } from '../services/dynamo.ts';

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
}

const VALUE_INPUT_CLS =
  'font-mono text-xs text-accent bg-canvas border border-line rounded py-[3px] px-[7px] min-w-[80px] w-auto outline-none transition-colors focus:border-accent';

const SK_OPS: { op: SkOp; label: string }[] = [
  { op: 'none', label: 'none' },
  { op: 'Eq', label: '=' },
  { op: 'BeginsWith', label: 'begins_with' },
  { op: 'Between', label: 'between' },
];

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
  const canSubmit = pkFilled && skFilled && !executeDisabledReason;

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
    <div className="flex flex-col gap-4">
      {/* Index selector tabs */}
      {entity.indexPatterns.length > 0 && (
        <div className="flex gap-[2px] overflow-x-auto border-b border-line" role="tablist" aria-label="Query target">
          <IndexTab label="Base table" active={selectedTarget === 'base'} onClick={() => onChangeTarget('base')} />
          {entity.indexPatterns.map((pattern) => (
            <IndexTab
              key={pattern.index}
              label={pattern.index}
              active={selectedTarget === pattern.index}
              onClick={() => onChangeTarget(pattern.index)}
            />
          ))}
        </div>
      )}

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

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          title={executeDisabledReason}
          className={`inline-flex items-center gap-1.5 py-2 px-4 font-mono text-xs font-semibold tracking-[0.05em] rounded-md border transition-all ${
            canSubmit
              ? 'bg-accent border-accent text-canvas cursor-pointer hover:shadow-[0_0_18px_var(--accent-glow)]'
              : 'bg-transparent border-line text-muted opacity-50 cursor-not-allowed'
          }`}
        >
          <Play size={11} aria-hidden="true" />
          Execute
          <kbd className="font-mono text-[10px] font-normal opacity-70 border border-current/30 rounded px-1 ml-1">⌘↵</kbd>
        </button>

        {executeDisabledReason && (
          <span className="font-mono text-[12px] text-muted">{executeDisabledReason}</span>
        )}

        {onUpdateQuery && activeQueryName && saveName === null && (
          <button
            type="button"
            onClick={onUpdateQuery}
            className="flex items-center gap-1 font-mono text-xs text-accent px-2 py-1.5 rounded-[5px] bg-accent-dim border border-accent-line cursor-pointer transition-colors"
          >
            <Check size={11} aria-hidden="true" /> Update “{activeQueryName}”
          </button>
        )}

        {onSaveQuery && saveName === null && (
          <button
            type="button"
            onClick={() => setSaveName('')}
            className="flex items-center gap-1 font-mono text-xs text-muted hover:text-primary px-2 py-1.5 rounded-[5px] bg-transparent border border-line cursor-pointer transition-colors"
          >
            <Bookmark size={11} aria-hidden="true" /> {activeQueryName ? 'Save as new…' : 'Save as…'}
          </button>
        )}

        {onSaveQuery && saveName !== null && (
          <div className="flex items-center gap-1">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmSave();
                if (e.key === 'Escape') setSaveName(null);
              }}
              placeholder="Query name…"
              autoFocus
              className="w-44"
            />
            <IconButton label="Confirm save" onClick={handleConfirmSave} disabled={!saveName.trim()}>
              <Check size={13} aria-hidden="true" />
            </IconButton>
            <IconButton label="Cancel save" onClick={() => setSaveName(null)}>
              <X size={13} aria-hidden="true" />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Pieces ----

type Segments = ReturnType<typeof parsePattern>['segments'];

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

function IndexTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`py-1.5 px-3 font-mono text-xs border-0 border-b-2 bg-transparent cursor-pointer transition-all -mb-px whitespace-nowrap ${
        active
          ? 'font-semibold border-b-accent text-accent'
          : 'font-normal border-b-transparent text-muted hover:text-secondary'
      }`}
    >
      {label}
    </button>
  );
}
