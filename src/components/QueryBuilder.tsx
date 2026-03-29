import { parsePattern } from '../utils/patternParser.ts';
import type { Entity } from '../types/schema.ts';
import type { QueryParams, SkCondition } from '../types/query.ts';

type SkOp = 'Eq' | 'BeginsWith' | 'Between' | 'none';

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
}: QueryBuilderProps) {
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
      pkName: pkName,
      pkValue: pkValue,
      skName: skOp !== 'none' ? skName : undefined,
      skCondition: skCondition,
      indexName: activeGsi ? activeGsi.name : undefined,
    });
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
              <span key={i} className="pattern-literal text-xs">
                {seg.value}
              </span>
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
                  <span key={i} className="pattern-literal text-xs">
                    {seg.value}
                  </span>
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
                  <span key={i} className="pattern-literal text-xs">
                    {seg.value}
                  </span>
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

      {/* Execute button */}
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
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
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
