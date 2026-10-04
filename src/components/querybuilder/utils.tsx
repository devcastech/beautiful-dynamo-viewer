import { useRef } from 'react';
import { parsePattern } from '../../domain/schema/patternParser.ts';
import type { SkOp } from '../../domain/schema/types.ts';

// ---- Pieces ----
//
// Variable slots are borderless and sized to their content; the surrounding
// box carries the only focus indicator (see .slot-input in index.css).
const VALUE_INPUT_CLS =
  'slot-input font-mono text-xs text-primary bg-accent-dim rounded-sm px-1 py-0.5 border-0 placeholder:text-accent/70';

/** Exact width for a monospace slot: characters plus the slot's horizontal padding. */
const slotWidth = (text: string) => `calc(${Math.max(text.length, 1) + 1}ch + 0.5rem)`;

const SK_OP_LABEL: Record<Exclude<SkOp, 'none'>, string> = {
  Eq: '=',
  BeginsWith: 'begins_with',
  Between: 'between',
};

type Segments = ReturnType<typeof parsePattern>['segments'];

export const SK_OPS: { op: SkOp; label: string }[] = [
  { op: 'none', label: 'any' },
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
    <span className="font-mono text-[11px] whitespace-nowrap">
      <span className="text-muted">{'→  '}</span>
      <ResolvedPattern segments={pkSegments} values={pkValues} />
      {skOp === 'none' ? (
        <span className="text-muted">{'  ·  any sort key'}</span>
      ) : (
        <>
          <span className="text-muted">{'  ·  '}</span>
          <span className="text-muted">{SK_OP_LABEL[skOp]}&nbsp;</span>
          <ResolvedPattern segments={skSegments} values={skValues} />
          {skOp === 'Between' && (
            <>
              <span className="text-muted">{' and '}</span>
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
          <span key={i} className="text-muted">
            {seg.value}
          </span>
        ) : (values[seg.name] ?? '').trim() ? (
          <span key={i} className="text-secondary">
            {values[seg.name]}
          </span>
        ) : (
          <span key={i} className="text-muted">{`<${seg.name}>`}</span>
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
        <span className="field-label">{label}</span>
        <span className="font-mono text-[11px] text-muted">{attr}</span>
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
  const boxRef = useRef<HTMLDivElement>(null);
  const hasVariables = segments.some((s) => s.type === 'variable');

  // Clicking the empty part of the box focuses the last slot, caret at the end,
  // so the whole box behaves like one text field.
  function focusLastSlot(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return;
    const inputs = boxRef.current?.querySelectorAll('input');
    const last = inputs?.[inputs.length - 1];
    if (!last) return;
    e.preventDefault();
    last.focus();
    last.setSelectionRange(last.value.length, last.value.length);
  }

  return (
    <div
      ref={boxRef}
      onMouseDown={focusLastSlot}
      className={`flex items-center gap-0.5 h-9 px-3 bg-inset border border-line rounded-md overflow-x-auto transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent ${
        hasVariables ? 'cursor-text' : ''
      }`}
    >
      {!hasVariables && literalFallback !== undefined ? (
        <span className="font-mono text-xs text-secondary whitespace-pre">{literalFallback}</span>
      ) : (
        segments.map((seg, i) => {
          if (seg.type === 'literal') {
            return (
              <span key={i} className="font-mono text-xs text-muted whitespace-pre shrink-0">
                {seg.value}
              </span>
            );
          }
          const value = values[seg.name] ?? '';
          const placeholder = `${seg.name}${placeholderSuffix}`;
          return (
            <input
              key={i}
              type="text"
              aria-label={placeholder}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange({ ...values, [seg.name]: e.target.value })}
              spellCheck={false}
              autoComplete="off"
              className={`${VALUE_INPUT_CLS} shrink-0`}
              style={{ width: slotWidth(value || placeholder) }}
            />
          );
        })
      )}
    </div>
  );
};
