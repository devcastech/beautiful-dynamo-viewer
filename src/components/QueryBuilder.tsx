import { useState, type ReactNode } from 'react';
import { Bookmark, Check, X } from 'lucide-react';
import { parsePattern } from '../utils/patternParser.ts';
import type { Entity, SkOp } from '../types/schema.ts';
import type { QueryParams, SkCondition } from '../types/query.ts';

interface QueryBuilderProps {
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
  onSaveQuery?: (name: string) => void;
  onUpdateQuery?: () => void;
  activeQueryName?: string;
}

const inputCls =
  'font-mono text-xs text-accent bg-canvas border border-line rounded py-[3px] px-[7px] min-w-[80px] outline-none transition-colors focus:border-accent';

export function QueryBuilder({
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
  onSaveQuery,
  onUpdateQuery,
  activeQueryName,
}: QueryBuilderProps) {
  const [saveName, setSaveName] = useState<string | null>(null);

  const activeGsi =
    selectedTarget === 'base' ? null : entity.gsis.find((g) => g.name === selectedTarget) ?? null;

  const activePkPattern = activeGsi ? activeGsi.pk : entity.pk;
  const activeSkPattern = activeGsi ? activeGsi.sk : entity.sk;

  const parsedPk = parsePattern(activePkPattern);
  const parsedSk = parsePattern(activeSkPattern);

  const pkFilled = parsedPk.variables.every((v) => (pkValues[v] ?? '').trim() !== '');
  const skFilled = skOp === 'none' || parsedSk.variables.every((v) => (skValues[v] ?? '').trim() !== '');
  const canSubmit = pkFilled && skFilled;

  function handleSubmit() {
    const pkValue = parsedPk.resolve(pkValues);
    const pkName = activeGsi ? activeGsi.pkAttr : 'PK';
    const skName = activeGsi ? (activeGsi.skAttr ?? 'SK') : 'SK';

    let skCondition: SkCondition | undefined;
    if (skOp !== 'none' && parsedSk.variables.length > 0) {
      const skValue = parsedSk.resolve(skValues);
      if (skOp === 'Eq') skCondition = { op: 'Eq', value: skValue };
      else if (skOp === 'BeginsWith') skCondition = { op: 'BeginsWith', value: skValue };
      else if (skOp === 'Between') {
        skCondition = { op: 'Between', value: skValue, value2: parsedSk.resolve(sk2Values) };
      }
    } else if (skOp !== 'none' && parsedSk.variables.length === 0) {
      if (skOp === 'Eq') skCondition = { op: 'Eq', value: activeSkPattern };
      else if (skOp === 'BeginsWith') skCondition = { op: 'BeginsWith', value: activeSkPattern };
    }

    onSubmit({
      table: tableName,
      pkName,
      pkValue,
      skName: skOp !== 'none' ? skName : undefined,
      skCondition,
      indexName: activeGsi ? activeGsi.name : undefined,
    });
  }

  function handleConfirmSave() {
    const name = saveName?.trim();
    if (!name) return;
    onSaveQuery?.(name);
    setSaveName(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Index selector tabs */}
      {entity.gsis.length > 0 && (
        <div className="flex gap-[2px] overflow-x-auto border-b border-line">
          <IndexTab label="Base" active={selectedTarget === 'base'} onClick={() => onChangeTarget('base')} />
          {entity.gsis.map((gsi) => (
            <IndexTab
              key={gsi.name}
              label={gsi.name}
              active={selectedTarget === gsi.name}
              onClick={() => onChangeTarget(gsi.name)}
            />
          ))}
        </div>
      )}

      {/* Partition Key */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Partition Key</FieldLabel>
        <div className="flex flex-wrap items-center gap-1 py-1.5 px-2.5 bg-elevated border border-line rounded-md min-h-9">
          {parsedPk.segments.map((seg, i) =>
            seg.type === 'literal' ? (
              <span key={i} className="pattern-literal text-xs">{seg.value}</span>
            ) : (
              <input
                key={i}
                type="text"
                placeholder={seg.name}
                value={pkValues[seg.name] ?? ''}
                onChange={(e) => onChangePkValues({ ...pkValues, [seg.name]: e.target.value })}
                className={inputCls}
              />
            ),
          )}
        </div>
      </div>

      {/* Sort Key Condition */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Sort Key</FieldLabel>
        <div className="flex gap-1 flex-wrap">
          {(['none', 'Eq', 'BeginsWith', 'Between'] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => onChangeSkOp(op)}
              className={`py-[3px] px-[9px] font-mono text-[11px] rounded border cursor-pointer transition-all ${
                skOp === op
                  ? 'border-accent bg-accent-dim text-accent'
                  : 'border-line bg-transparent text-muted'
              }`}
            >
              {op === 'none' ? 'none' : op === 'Eq' ? '=' : op === 'BeginsWith' ? 'begins_with' : 'between'}
            </button>
          ))}
        </div>

        {skOp !== 'none' && (
          <div className="flex flex-wrap items-center gap-1 py-1.5 px-2.5 bg-elevated border border-line rounded-md min-h-9">
            {parsedSk.variables.length === 0 ? (
              <span className="pattern-literal text-xs">{activeSkPattern}</span>
            ) : (
              parsedSk.segments.map((seg, i) =>
                seg.type === 'literal' ? (
                  <span key={i} className="pattern-literal text-xs">{seg.value}</span>
                ) : (
                  <input
                    key={i}
                    type="text"
                    placeholder={seg.name}
                    value={skValues[seg.name] ?? ''}
                    onChange={(e) => onChangeSkValues({ ...skValues, [seg.name]: e.target.value })}
                    className={inputCls}
                  />
                ),
              )
            )}
          </div>
        )}

        {skOp === 'Between' && parsedSk.variables.length > 0 && (
          <>
            <span className="font-mono text-[10px] text-muted pl-[2px]">to</span>
            <div className="flex flex-wrap items-center gap-1 py-1.5 px-2.5 bg-elevated border border-line rounded-md min-h-9">
              {parsedSk.segments.map((seg, i) =>
                seg.type === 'literal' ? (
                  <span key={i} className="pattern-literal text-xs">{seg.value}</span>
                ) : (
                  <input
                    key={i}
                    type="text"
                    placeholder={`${seg.name} (end)`}
                    value={sk2Values[seg.name] ?? ''}
                    onChange={(e) => onChangeSk2Values({ ...sk2Values, [seg.name]: e.target.value })}
                    className={inputCls}
                  />
                ),
              )}
            </div>
          </>
        )}
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={`py-2 px-4 font-mono text-xs font-semibold tracking-[0.05em] rounded-md border transition-all ${
            canSubmit
              ? 'bg-accent border-accent text-canvas cursor-pointer'
              : 'bg-transparent border-line text-muted opacity-50 cursor-not-allowed'
          }`}
        >
          ▶ Execute
        </button>

        {onUpdateQuery && activeQueryName && saveName === null && (
          <button
            type="button"
            onClick={onUpdateQuery}
            className="flex items-center gap-1 font-mono text-xs text-accent px-2 py-1.5 rounded-[5px] bg-accent-dim border border-accent-line cursor-pointer transition-colors"
          >
            <Check size={11} /> Update
          </button>
        )}

        {onSaveQuery && saveName === null && (
          <button
            type="button"
            onClick={() => setSaveName('')}
            className="flex items-center gap-1 font-mono text-xs text-muted hover:text-primary px-2 py-1.5 rounded-[5px] bg-transparent border border-line cursor-pointer transition-colors"
          >
            <Bookmark size={11} /> {activeQueryName ? 'Save as new…' : 'Save as…'}
          </button>
        )}

        {onSaveQuery && saveName !== null && (
          <div className="flex items-center gap-1">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmSave();
                if (e.key === 'Escape') setSaveName(null);
              }}
              placeholder="Query name…"
              autoFocus
              className={`${inputCls} w-44`}
              spellCheck={false}
            />
            <button
              type="button"
              onClick={handleConfirmSave}
              disabled={!saveName.trim()}
              className="text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-0.5 disabled:opacity-40"
            >
              <Check size={13} />
            </button>
            <button
              type="button"
              onClick={() => setSaveName(null)}
              className="text-muted hover:text-primary bg-transparent border-0 cursor-pointer p-0.5"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-muted">
      {children}
    </span>
  );
}

function IndexTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-1.5 px-3 font-mono text-xs border-0 border-b-2 bg-transparent cursor-pointer transition-all -mb-px ${
        active
          ? 'font-semibold border-b-accent text-accent'
          : 'font-normal border-b-transparent text-muted'
      }`}
    >
      {label}
    </button>
  );
}
