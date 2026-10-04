import { useEffect, useState } from 'react';
import { Bookmark, Check, Play, RefreshCw, X } from 'lucide-react';
import { parsePattern } from '../../domain/schema/patternParser.ts';
import { resolveTarget } from '../../domain/schema/resolveTarget.ts';
import { buildQueryParams, type QueryParams } from '../../domain/schema/buildQueryParams.ts';
import { Input } from '../ui/Input.tsx';
import { Select } from '../ui/Select.tsx';
import { IconButton } from '../ui/Button.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import {
  FiltersTable,
  emptyFilter,
  isFilterRowValid,
  toQueryFilters,
  type FilterRow,
} from './FiltersTable.tsx';
import type { Entity, SkOp, TableSchema } from '../../domain/schema/types.ts';
import { isMacOS } from '../../services/runtime.ts';
import { KeyPreview, PatternRow, SK_OPS, ValueBox } from './utils.tsx';

interface QueryBuilderProps {
  schema: TableSchema;
  entity: Entity;
  tableName: string;
  selectedTarget: 'base' | string;
  pkValues: Record<string, string>;
  skOp: SkOp;
  skValues: Record<string, string>;
  sk2Values: Record<string, string>;
  filters: FilterRow[];
  onChangeTarget: (target: 'base' | string) => void;
  onChangePkValues: (values: Record<string, string>) => void;
  onChangeSkOp: (op: SkOp) => void;
  onChangeSkValues: (values: Record<string, string>) => void;
  onChangeSk2Values: (values: Record<string, string>) => void;
  onChangeFilters: (filters: FilterRow[]) => void;
  onSubmit: (params: QueryParams) => void;
  /** When set, executing is blocked and this explains why. */
  executeDisabledReason?: string;
  onSaveQuery?: (name: string) => void;
  onUpdateQuery?: () => void;
  activeQueryName?: string;
  isLoading?: boolean;
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
  filters,
  onChangeTarget,
  onChangePkValues,
  onChangeSkOp,
  onChangeSkValues,
  onChangeSk2Values,
  onChangeFilters,
  onSubmit,
  executeDisabledReason,
  onSaveQuery,
  onUpdateQuery,
  activeQueryName,
  isLoading,
}: QueryBuilderProps) {
  const [saveName, setSaveName] = useState<string | null>(null);

  // i === filters.length addresses the trailing ghost row: editing it appends a real filter.
  function changeRow(i: number, patch: Partial<FilterRow>) {
    onChangeFilters(
      i < filters.length
        ? filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f))
        : [...filters, { ...emptyFilter(), ...patch }],
    );
  }
  function toggleRow(i: number) {
    onChangeFilters(filters.map((f, idx) => (idx === i ? { ...f, enabled: !f.enabled } : f)));
  }
  function removeFilter(i: number) {
    onChangeFilters(filters.filter((_, idx) => idx !== i));
  }

  const resolved = resolveTarget(schema, entity, selectedTarget);

  const parsedPk = parsePattern(resolved.pkPattern);
  const parsedSk = parsePattern(resolved.skPattern);

  const pkFilled = parsedPk.variables.every((v) => (pkValues[v] ?? '').trim() !== '');
  const skFilled =
    skOp === 'none' || parsedSk.variables.every((v) => (skValues[v] ?? '').trim() !== '');
  const filtersValid = filters.every(isFilterRowValid);
  const canSubmit = pkFilled && skFilled && filtersValid && !executeDisabledReason && !isLoading;

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
      {/* ===== Query bar (pinned): target, save, run ===== */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-surface border-b border-line-dim">
        <Select
          ariaLabel="Query target"
          value={selectedTarget}
          onChange={onChangeTarget}
          options={[
            { value: 'base', label: 'Base table' },
            ...entity.indexPatterns.map((pattern) => ({
              value: pattern.index,
              label: pattern.index,
            })),
          ]}
          className="shrink-0 font-medium"
        />

        <div className="flex-1" />

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
            <IconButton
              label="Confirm save"
              onClick={handleConfirmSave}
              disabled={!saveName.trim()}
            >
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
          className={`shrink-0 inline-flex items-center gap-1.5 py-1.25 pl-3 pr-2 text-[12px] font-semibold rounded-md border-0 transition-colors ${
            canSubmit
              ? 'bg-accent text-canvas cursor-pointer hover:brightness-110'
              : 'bg-elevated text-muted cursor-not-allowed'
          }`}
        >
          <Play size={11} aria-hidden="true" fill="currentColor" />
          Run
          <kbd className="font-mono text-[10px] font-normal opacity-75 ml-1">
            {isMacOS() ? '⌘' : 'Ctrl'}↵
          </kbd>
        </button>
      </div>

      {/* ===== Builder fields (scroll): the params that compose the key ===== */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <div className="flex flex-col gap-4 max-w-4xl">
          {/* Partition key */}
          <PatternRow
            label="Partition key"
            attr={resolved.pkAttr}
            segments={parsedPk.segments}
            values={pkValues}
            onChange={onChangePkValues}
          />

          {/* Sort key */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="field-label">Sort key</span>
              <span className="font-mono text-[11px] text-muted">{resolved.skAttr}</span>
              <span className="ml-auto">
                <Segmented
                  ariaLabel="Sort key condition"
                  value={skOp}
                  onChange={onChangeSkOp}
                  options={SK_OPS.map(({ op, label }) => ({ value: op, label }))}
                  mono
                />
              </span>
            </div>

            {skOp !== 'none' && (
              <ValueBox
                segments={parsedSk.segments}
                literalFallback={resolved.skPattern}
                values={skValues}
                onChange={onChangeSkValues}
              />
            )}

            {skOp === 'Between' && parsedSk.variables.length > 0 && (
              <>
                <span className="text-[11px] text-muted pl-0.5">and</span>
                <ValueBox
                  segments={parsedSk.segments}
                  literalFallback={resolved.skPattern}
                  values={sk2Values}
                  onChange={onChangeSk2Values}
                  placeholderSuffix=" (end)"
                />
              </>
            )}
          </div>

          {/* Filters (FilterExpression on non-key attributes) */}
          <div className="flex flex-col gap-2">
            <span className="field-label" title="Applied after the key query (FilterExpression)">
              Filters
            </span>

            <FiltersTable
              filters={filters}
              onChangeRow={changeRow}
              onToggleRow={toggleRow}
              onRemoveRow={removeFilter}
            />

            {!filtersValid && (
              <span className="text-[12px] text-err">
                Filters typed as number need numeric values.
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1 pt-1 border-t border-line-dim">
            <div className="pt-2 overflow-x-auto">
              <KeyPreview
                pkSegments={parsedPk.segments}
                pkValues={pkValues}
                skOp={skOp}
                skSegments={parsedSk.segments}
                skValues={skValues}
                sk2Values={sk2Values}
              />
            </div>
            {executeDisabledReason && (
              <span className="text-[12px] text-muted">{executeDisabledReason}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
