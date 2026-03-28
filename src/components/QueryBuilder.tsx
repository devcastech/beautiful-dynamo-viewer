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
  const skFilled =
    skOp === 'none' ||
    parsedSk.variables.every((v) => (skValues[v] ?? '').trim() !== '');

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
      // literal SK
      if (skOp === 'Eq') skCondition = { op: 'Eq', value: activeSkPattern };
      else if (skOp === 'BeginsWith') skCondition = { op: 'BeginsWith', value: activeSkPattern };
    }

    onSubmit({
      table: tableName,
      pk_name: pkName,
      pk_value: pkValue,
      sk_name: skOp !== 'none' ? skName : undefined,
      sk_condition: skCondition,
      index_name: activeGsi ? activeGsi.name : undefined,
    });
  }

  return (
    <div className="space-y-4">
      {/* GSI switcher */}
      {entity.gsis.length > 0 && (
        <div className="flex gap-0.5 overflow-x-auto border-b border-slate-200 pb-px">
          <button
            type="button"
            onClick={() => onChangeTarget('base')}
            className={`shrink-0 px-3 py-2 text-xs transition-colors -mb-px border-b-2 ${
              selectedTarget === 'base'
                ? 'border-slate-900 text-slate-900 font-medium'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Base Table
          </button>
          {entity.gsis.map((gsi) => (
            <button
              key={gsi.name}
              type="button"
              onClick={() => onChangeTarget(gsi.name)}
              className={`shrink-0 px-3 py-2 text-xs transition-colors -mb-px border-b-2 ${
                selectedTarget === gsi.name
                  ? 'border-slate-900 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {gsi.name}
            </button>
          ))}
        </div>
      )}

      {/* PK */}
      <div className="space-y-1.5">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
          Partition Key
        </label>
        <div className="flex flex-wrap items-center gap-1 p-2 border border-slate-200 rounded bg-slate-50 min-h-[36px]">
          {parsedPk.segments.map((seg, i) =>
            seg.type === 'literal' ? (
              <span key={i} className="font-mono text-xs text-slate-600">
                {seg.value}
              </span>
            ) : (
              <input
                key={i}
                type="text"
                placeholder={seg.name}
                value={pkValues[seg.name] ?? ''}
                onChange={(e) => onChangePkValues({ ...pkValues, [seg.name]: e.target.value })}
                className="font-mono text-xs text-slate-800 bg-white border border-slate-300 rounded px-1.5 py-0.5 min-w-[80px] focus:outline-none focus:border-slate-500"
              />
            ),
          )}
        </div>
      </div>

      {/* SK condition */}
      <div className="space-y-1.5">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
          Sort Key Condition
        </label>
        <div className="flex gap-1">
          {(['none', 'Eq', 'BeginsWith', 'Between'] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => onChangeSkOp(op)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                skOp === op
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'
              }`}
            >
              {op === 'none' ? 'none' : op === 'Eq' ? '=' : op === 'BeginsWith' ? 'begins_with' : 'between'}
            </button>
          ))}
        </div>

        {skOp !== 'none' && (
          <div className="flex flex-wrap items-center gap-1 p-2 border border-slate-200 rounded bg-slate-50 min-h-[36px]">
            {parsedSk.variables.length === 0 ? (
              <span className="font-mono text-xs text-slate-400">{activeSkPattern}</span>
            ) : (
              parsedSk.segments.map((seg, i) =>
                seg.type === 'literal' ? (
                  <span key={i} className="font-mono text-xs text-slate-600">
                    {seg.value}
                  </span>
                ) : (
                  <input
                    key={i}
                    type="text"
                    placeholder={seg.name}
                    value={skValues[seg.name] ?? ''}
                    onChange={(e) => onChangeSkValues({ ...skValues, [seg.name]: e.target.value })}
                    className="font-mono text-xs text-slate-800 bg-white border border-slate-300 rounded px-1.5 py-0.5 min-w-[80px] focus:outline-none focus:border-slate-500"
                  />
                ),
              )
            )}
          </div>
        )}

        {skOp === 'Between' && parsedSk.variables.length > 0 && (
          <>
            <span className="block text-[10px] text-slate-400 pl-1">to</span>
            <div className="flex flex-wrap items-center gap-1 p-2 border border-slate-200 rounded bg-slate-50 min-h-[36px]">
              {parsedSk.segments.map((seg, i) =>
                seg.type === 'literal' ? (
                  <span key={i} className="font-mono text-xs text-slate-600">
                    {seg.value}
                  </span>
                ) : (
                  <input
                    key={i}
                    type="text"
                    placeholder={`${seg.name} (end)`}
                    value={sk2Values[seg.name] ?? ''}
                    onChange={(e) => onChangeSk2Values({ ...sk2Values, [seg.name]: e.target.value })}
                    className="font-mono text-xs text-slate-800 bg-white border border-slate-300 rounded px-1.5 py-0.5 min-w-[80px] focus:outline-none focus:border-slate-500"
                  />
                ),
              )}
            </div>
          </>
        )}
      </div>

      {/* Submit */}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="w-full py-2 text-sm font-medium rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-slate-900 text-white border-slate-900 hover:bg-slate-700 disabled:hover:bg-slate-900"
      >
        Execute
      </button>
    </div>
  );
}
