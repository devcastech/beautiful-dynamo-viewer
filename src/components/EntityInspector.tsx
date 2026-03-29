import { Play } from 'lucide-react';
import type { Entity } from '../types/schema.ts';

interface EntityInspectorProps {
  entity: Entity;
  onUsePattern?: (pattern: string) => void;
}

export function EntityInspector({ entity, onUsePattern }: EntityInspectorProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      {/* Entity header */}
      <div className="px-5 py-4 border-b border-line bg-surface shrink-0">
        <div className="flex items-baseline gap-2 mb-[2px]">
          <h3 className="m-0 font-mono font-semibold text-[15px] text-primary tracking-[-0.01em]">
            {entity.name}
          </h3>
          <span className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase text-accent">
            {entity.role}
          </span>
        </div>
        {entity.description && (
          <p className="mt-1.5 mb-0 text-[13px] text-muted leading-relaxed font-ui">
            {entity.description}
          </p>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Keys */}
        <Section label="Keys">
          <KeyRow label="PK" pattern={entity.pk} />
          <KeyRow label="SK" pattern={entity.sk} />
        </Section>

        {/* GSIs */}
        {entity.gsis.length > 0 && (
          <Section label="Global Secondary Indexes">
            <div className="flex flex-col gap-2">
              {entity.gsis.map((gsi) => (
                <div key={gsi.name} className="border border-line rounded-md overflow-hidden">
                  <div className="py-[5px] px-2.5 bg-elevated border-b border-line font-mono text-[11px] font-semibold text-accent tracking-[0.05em]">
                    {gsi.name}
                  </div>
                  <div className="p-2.5">
                    <div className="flex flex-col gap-1">
                      <GsiKeyRow prefix="PK →" pattern={gsi.pk} attr={gsi.pkAttr} />
                      {gsi.sk && <GsiKeyRow prefix="SK →" pattern={gsi.sk} attr={gsi.skAttr ?? 'SK'} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Access Patterns */}
        {entity.accessPatterns.length > 0 && (
          <Section label="Access Patterns">
            <ul className="m-0 p-0 list-none flex flex-col gap-[2px]">
              {entity.accessPatterns.map((pattern, index) => (
                <li
                  key={index}
                  className={`group flex items-start gap-2 px-2 py-[5px] rounded transition-colors hover:bg-elevated ${onUsePattern ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="font-mono text-[11px] text-muted min-w-[18px] text-right pt-px shrink-0">
                    {index + 1}.
                  </span>
                  <span className="flex-1 text-[13px] text-secondary leading-normal font-ui">
                    {pattern}
                  </span>
                  {onUsePattern && (
                    <button
                      type="button"
                      title="Use in query"
                      onClick={() => onUsePattern(pattern)}
                      className="opacity-0 group-hover:opacity-100 bg-accent-dim border border-accent-line rounded-[3px] px-[5px] py-[2px] cursor-pointer text-accent flex items-center gap-[3px] shrink-0 transition-opacity duration-150 text-[10px] font-mono"
                    >
                      <Play size={9} />
                      <span>use</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Attributes */}
        <Section label={`Attributes (${entity.attributes.length})`}>
          <div className="flex flex-wrap gap-[5px]">
            {entity.attributes.map((attr) => (
              <span
                key={attr}
                className="px-2 py-[3px] font-mono text-xs text-secondary bg-elevated border border-line rounded"
              >
                {attr}
              </span>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-[14px] border-b border-line-dim">
      <div className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-muted mb-2.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function KeyRow({ label, pattern }: { label: string; pattern: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-[5px]">
      <span className="font-mono text-[11px] font-semibold text-muted w-[22px] shrink-0">
        {label}
      </span>
      <code className="font-mono text-xs bg-elevated border border-line rounded px-[9px] py-1 flex-1">
        <PatternDisplay pattern={pattern} />
      </code>
    </div>
  );
}

function GsiKeyRow({ prefix, pattern, attr }: { prefix: string; pattern: string; attr: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] text-muted w-[30px] shrink-0">
        {prefix}
      </span>
      <code className="font-mono text-xs flex-1">
        <PatternDisplay pattern={pattern} />
      </code>
      <span className="font-mono text-[11px] text-muted px-1.5 py-[2px] bg-canvas border border-line-dim rounded-[3px] shrink-0">
        {attr}
      </span>
    </div>
  );
}

/** Renders a DynamoDB key pattern with literal parts muted and <variable> parts in amber */
export function PatternDisplay({ pattern }: { pattern: string }) {
  const parts = pattern.split(/(<[^>]+>)/g);
  return (
    <>
      {parts.map((part, i) => {
        const isVar = part.startsWith('<') && part.endsWith('>');
        return (
          <span key={i} className={isVar ? 'pattern-variable' : 'pattern-literal'}>
            {part}
          </span>
        );
      })}
    </>
  );
}
