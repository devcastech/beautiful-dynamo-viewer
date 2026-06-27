import { useEffect, useState } from 'react';
import { Bookmark, Check, Play, RefreshCw, Trash2, X } from 'lucide-react';
import { parsePattern } from '../domain/schema/patternParser.ts';
import {
  buildQueryParams,
  type FilterOp,
  type FilterValueType,
  type QueryFilter,
  type QueryParams,
} from '../domain/schema/buildQueryParams.ts';
import { Input } from './ui/Input.tsx';
import { Select } from './ui/Select.tsx';
import { IconButton } from './ui/Button.tsx';
import type { Entity, SkOp, TableSchema } from '../domain/schema/types.ts';
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

const FILTER_OP_OPTIONS: { value: FilterOp; label: string }[] = [
  { value: 'Eq', label: 'equals' },
  { value: 'BeginsWith', label: 'begins_with' },
  { value: 'Contains', label: 'contains' },
  { value: 'Between', label: 'between' },
];

const VALUE_TYPE_OPTIONS: { value: FilterValueType; label: string }[] = [
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
];

/** Editable filter row state (flat, so a Between keeps from/to ready when toggled). */
interface FilterRow {
  /** Unchecked rows stay in the table but are excluded from the query. */
  enabled: boolean;
  name: string;
  op: FilterOp;
  valueType: FilterValueType;
  value: string;
  from: string;
  to: string;
}

const emptyFilter = (): FilterRow => ({
  enabled: true,
  name: '',
  op: 'Eq',
  valueType: 'string',
  value: '',
  from: '',
  to: '',
});

/** Drop disabled/incomplete rows and shape the rest into the wire format the backend expects. */
function toQueryFilters(rows: FilterRow[]): QueryFilter[] {
  return rows
    .filter((r) => r.enabled && r.name.trim() !== '')
    .map((r) => ({
      name: r.name.trim(),
      valueType: r.valueType,
      condition:
        r.op === 'Between'
          ? { op: 'Between', value: { from: r.from, to: r.to } }
          : { op: r.op, value: r.value },
    }));
}

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
  const [filters, setFilters] = useState<FilterRow[]>([]);

  // i === filters.length addresses the trailing ghost row: editing it appends a real filter.
  function changeRow(i: number, patch: Partial<FilterRow>) {
    setFilters((fs) =>
      i < fs.length
        ? fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f))
        : [...fs, { ...emptyFilter(), ...patch }],
    );
  }
  function toggleRow(i: number) {
    setFilters((fs) => fs.map((f, idx) => (idx === i ? { ...f, enabled: !f.enabled } : f)));
  }
  function removeFilter(i: number) {
    setFilters((fs) => fs.filter((_, idx) => idx !== i));
  }

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

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(
      buildQueryParams({
        schema,
        entity,
        tableName,
        target: selectedTarget,
        pkValues,
        skOp,
        skValues,
        sk2Values,
        filters: toQueryFilters(filters),
      }),
    );
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
  }, [canSubmit, pkValues, skValues, sk2Values, skOp, selectedTarget, tableName, filters]);

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

          {/* Filters (FilterExpression on non-key attributes) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="micro-label text-[12px]">Filters</span>
              <span className="font-mono text-[11px] text-muted/50">applied after the key query</span>
            </div>

            <FiltersTable
              filters={filters}
              onChangeRow={changeRow}
              onToggleRow={toggleRow}
              onRemoveRow={removeFilter}
            />
          </div>

          {executeDisabledReason && (
            <span className="font-mono text-[12px] text-muted">{executeDisabledReason}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared column template so the header and every row stay aligned:
// enable · Name · Value · delete.
const FILTER_GRID = 'grid grid-cols-[2.25rem_minmax(120px,1fr)_minmax(220px,1.7fr)_2.25rem]';
const FILTER_CELL = 'border-b border-r border-line min-h-10';

/**
 * Postman-style key/value table. Renders the real filters plus one trailing
 * ghost row; typing into the ghost row materialises a new filter.
 */
function FiltersTable({
  filters,
  onChangeRow,
  onToggleRow,
  onRemoveRow,
}: {
  filters: FilterRow[];
  onChangeRow: (i: number, patch: Partial<FilterRow>) => void;
  onToggleRow: (i: number) => void;
  onRemoveRow: (i: number) => void;
}) {
  const rows = [...filters, emptyFilter()];
  const headerCls = `${FILTER_CELL} flex items-center px-3 py-1.5 text-[11px] font-semibold tracking-wide text-accent bg-elevated/40`;
  return (
    <div className={`${FILTER_GRID} border border-line rounded-md bg-canvas`}>
      <div className={`${FILTER_CELL} bg-elevated/40`} aria-hidden="true" />
      <div className={headerCls}>Name</div>
      <div className={headerCls}>Value</div>
      <div className={`${FILTER_CELL} bg-elevated/40`} aria-hidden="true" />

      {rows.map((row, i) => (
        <FilterTableRow
          key={i}
          filter={row}
          isGhost={i === filters.length}
          onChange={(patch) => onChangeRow(i, patch)}
          onToggle={() => onToggleRow(i)}
          onRemove={() => onRemoveRow(i)}
        />
      ))}
    </div>
  );
}

const ROW_INPUT_CLS =
  'w-full bg-transparent border-0 outline-none font-mono text-xs text-primary placeholder:text-muted/40 min-h-8';

/**
 * Compact inline chip that cycles through its options on click — a no-popup
 * stand-in for a <select> in the dense filter table (so nothing can be clipped
 * by the surrounding scroll area). `subtle` dims it for secondary controls.
 */
function CycleChip<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  subtle = false,
}: {
  ariaLabel: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  subtle?: boolean;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[idx];
  return (
    <button
      type="button"
      onClick={() => onChange(options[(idx + 1) % options.length].value)}
      aria-label={`${ariaLabel}: ${current.label}. Click to change.`}
      title={`${ariaLabel}: ${current.label} — click to cycle`}
      className={`shrink-0 font-mono text-[11px] rounded px-1.5 py-[3px] border cursor-pointer transition-colors ${
        subtle
          ? 'text-muted border-line hover:text-secondary hover:border-line'
          : 'text-accent bg-accent-dim border-accent-line hover:border-accent'
      }`}
    >
      {current.label}
    </button>
  );
}

/** One row's four cells (returned as a fragment so they sit in the shared grid). */
function FilterTableRow({
  filter,
  isGhost,
  onChange,
  onToggle,
  onRemove,
}: {
  filter: FilterRow;
  isGhost: boolean;
  onChange: (patch: Partial<FilterRow>) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const dim = !filter.enabled && !isGhost ? 'opacity-45' : '';
  return (
    <>
      {/* Enable checkbox — hidden on the ghost row until it has content */}
      <div className={`${FILTER_CELL} flex items-center justify-center`}>
        {!isGhost && (
          <button
            type="button"
            role="checkbox"
            aria-checked={filter.enabled}
            aria-label={filter.enabled ? 'Disable filter' : 'Enable filter'}
            onClick={onToggle}
            className={`flex items-center justify-center w-3.75 h-3.75 rounded-[4px] border transition-colors ${
              filter.enabled
                ? 'bg-accent border-accent text-canvas'
                : 'bg-transparent border-line hover:border-accent/50'
            }`}
          >
            {filter.enabled && <Check size={11} strokeWidth={3} aria-hidden="true" />}
          </button>
        )}
      </div>

      {/* Name (attribute) */}
      <div className={`${FILTER_CELL} flex items-center p-0 ${dim}`}>
        <input
          aria-label="Filter attribute"
          value={filter.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Name"
          spellCheck={false}
          className={ROW_INPUT_CLS}
        />
      </div>

      {/* Value (operator · value(s) · type) */}
      <div className={`${FILTER_CELL} flex items-center gap-1.5 px-2 py-1 ${dim}`}>
        {!isGhost && (
          <CycleChip
            ariaLabel="Filter operator"
            value={filter.op}
            onChange={(op) => onChange({ op })}
            options={FILTER_OP_OPTIONS}
          />
        )}
        {filter.op === 'Between' && !isGhost ? (
          <>
            <input
              aria-label="Filter value from"
              value={filter.from}
              onChange={(e) => onChange({ from: e.target.value })}
              placeholder="from"
              spellCheck={false}
              className={ROW_INPUT_CLS}
            />
            <span className="font-mono text-[11px] text-muted shrink-0">to</span>
            <input
              aria-label="Filter value to"
              value={filter.to}
              onChange={(e) => onChange({ to: e.target.value })}
              placeholder="to"
              spellCheck={false}
              className={ROW_INPUT_CLS}
            />
          </>
        ) : (
          <input
            aria-label="Filter value"
            value={filter.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Value"
            spellCheck={false}
            className={ROW_INPUT_CLS}
          />
        )}
        {!isGhost && (
          <CycleChip
            ariaLabel="Filter value type"
            value={filter.valueType}
            onChange={(valueType) => onChange({ valueType })}
            options={VALUE_TYPE_OPTIONS}
            subtle
          />
        )}
      </div>

      {/* Delete */}
      <div className={`${FILTER_CELL} flex items-center justify-center`}>
        {!isGhost && (
          <IconButton label="Remove filter" onClick={onRemove} danger className="p-1">
            <Trash2 size={13} aria-hidden="true" />
          </IconButton>
        )}
      </div>
    </>
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
