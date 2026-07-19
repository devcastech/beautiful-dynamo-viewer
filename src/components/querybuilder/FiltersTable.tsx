import { Check, Trash2 } from 'lucide-react';
import { IconButton } from '../ui/Button.tsx';
import type { FilterOp, FilterValueType, QueryFilter } from '../../domain/schema/types.ts';

export const FILTER_OP_OPTIONS: { value: FilterOp; label: string }[] = [
  { value: 'Eq', label: 'equals' },
  { value: 'BeginsWith', label: 'begins_with' },
  { value: 'Contains', label: 'contains' },
  { value: 'Between', label: 'between' },
];

export const VALUE_TYPE_OPTIONS: { value: FilterValueType; label: string }[] = [
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
];

/** Editable filter row state (flat, so a Between keeps from/to ready when toggled). */
export interface FilterRow {
  /** Unchecked rows stay in the table but are excluded from the query. */
  enabled: boolean;
  name: string;
  op: FilterOp;
  valueType: FilterValueType;
  value: string;
  from: string;
  to: string;
}

export const emptyFilter = (): FilterRow => ({
  enabled: true,
  name: '',
  op: 'Eq',
  valueType: 'string',
  value: '',
  from: '',
  to: '',
});

/** Drop disabled/incomplete rows and shape the rest into the wire format the backend expects. */
export function toQueryFilters(rows: FilterRow[]): QueryFilter[] {
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

/** Inverse of toQueryFilters, to hydrate the table from a saved query. */
export function fromQueryFilters(filters: QueryFilter[]): FilterRow[] {
  return filters.map((f) => ({
    ...emptyFilter(),
    name: f.name,
    op: f.condition.op,
    valueType: f.valueType,
    ...(f.condition.op === 'Between'
      ? { from: f.condition.value.from, to: f.condition.value.to }
      : { value: f.condition.value }),
  }));
}

function isNumeric(s: string): boolean {
  return s.trim() !== '' && Number.isFinite(Number(s));
}

/**
 * Rows the query would actually send (enabled, named) must have numeric values
 * when typed as number — the backend sends them as AttributeValue::N, which
 * DynamoDB rejects for non-numeric strings. begins_with/contains always go as
 * strings, so the value type doesn't constrain them.
 */
export function isFilterRowValid(row: FilterRow): boolean {
  if (!row.enabled || row.name.trim() === '') return true;
  if (row.valueType !== 'number') return true;
  if (row.op === 'Between') return isNumeric(row.from) && isNumeric(row.to);
  if (row.op === 'Eq') return isNumeric(row.value);
  return true;
}

// Shared column template so the header and every row stay aligned:
// enable · Name · Value · delete.
const FILTER_GRID = 'grid grid-cols-[2.25rem_minmax(120px,1fr)_minmax(220px,1.7fr)_2.25rem]';
const FILTER_CELL = 'border-b border-r border-line min-h-10';

const ROW_INPUT_CLS =
  'w-full bg-transparent border-0 outline-none font-mono text-xs text-primary placeholder:text-muted/40 min-h-8';
const INVALID_INPUT_CLS = 'text-err placeholder:text-err/40';

/**
 * Postman-style key/value table. Renders the real filters plus one trailing
 * ghost row; typing into the ghost row materialises a new filter.
 */
export function FiltersTable({
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
  const invalid = !isGhost && !isFilterRowValid(filter);
  const valueCls = invalid ? `${ROW_INPUT_CLS} ${INVALID_INPUT_CLS}` : ROW_INPUT_CLS;
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
              aria-invalid={invalid || undefined}
              value={filter.from}
              onChange={(e) => onChange({ from: e.target.value })}
              placeholder="from"
              spellCheck={false}
              className={valueCls}
            />
            <span className="font-mono text-[11px] text-muted shrink-0">to</span>
            <input
              aria-label="Filter value to"
              aria-invalid={invalid || undefined}
              value={filter.to}
              onChange={(e) => onChange({ to: e.target.value })}
              placeholder="to"
              spellCheck={false}
              className={valueCls}
            />
          </>
        ) : (
          <input
            aria-label="Filter value"
            aria-invalid={invalid || undefined}
            value={filter.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Value"
            spellCheck={false}
            className={valueCls}
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
