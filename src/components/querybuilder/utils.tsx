import { parsePattern } from '../../domain/schema/patternParser.ts';
import type { SkOp } from '../../domain/schema/types.ts';

// ---- Pieces ----
//
const VALUE_INPUT_CLS =
  'font-mono text-xs text-accent bg-canvas border border-line rounded py-0.75 px-[7px] min-w-[80px] w-auto outline-none transition-colors focus:border-accent';

const SK_OP_LABEL: Record<Exclude<SkOp, 'none'>, string> = {
  Eq: '=',
  BeginsWith: 'begins_with',
  Between: 'between',
};

type Segments = ReturnType<typeof parsePattern>['segments'];

export const SK_OPS: { op: SkOp; label: string }[] = [
  { op: 'none', label: 'none' },
  { op: 'Eq', label: '=' },
  { op: 'BeginsWith', label: 'begins_with' },
  { op: 'Between', label: 'between' },
];
/** Read-only render of the key the query will send: filled values burn amber, empty <vars> recede. */
export const KeyPreview = ({
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
}) => {
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
};

function ResolvedPattern({
  segments,
  values,
}: {
  segments: Segments;
  values: Record<string, string>;
}) {
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

export const PatternRow = ({
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
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="micro-label text-[12px]">{label}</span>
        <span className="font-mono text-[11px] text-muted/60">{attr}</span>
      </div>
      <ValueBox segments={segments} values={values} onChange={onChange} />
    </div>
  );
};

export const ValueBox = ({
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
}) => {
  const hasVariables = segments.some((s) => s.type === 'variable');
  return (
    <div className="flex flex-wrap items-center gap-1 py-1.5 px-2.5 bg-elevated border border-line rounded-md min-h-9">
      {!hasVariables && literalFallback !== undefined ? (
        <span className="pattern-literal text-xs">{literalFallback}</span>
      ) : (
        segments.map((seg, i) =>
          seg.type === 'literal' ? (
            <span key={i} className="pattern-literal text-xs">
              {seg.value}
            </span>
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
};
