import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { IconButton } from './ui/Button.tsx';
import { PatternDisplay } from './ui/PatternDisplay.tsx';
import type { Entity, TableSchema } from '../domain/schema/types.ts';

interface EntityInspectorProps {
  schema: TableSchema;
  entity: Entity;
  onEdit: () => void;
}

/** Read-only view of how one entity is keyed and indexed. Editing happens in the drawer. */
export function EntityInspector({ schema, entity, onEdit }: EntityInspectorProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      {/* Entity header */}
      <div className="px-5 py-4 border-b border-line bg-surface shrink-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <h3 className="m-0 font-mono font-semibold text-[15px] text-primary tracking-[-0.01em]">
            {entity.name}
          </h3>
          <IconButton label="Edit entity" onClick={onEdit} className="ml-auto">
            <Pencil size={12} aria-hidden="true" />
          </IconButton>
        </div>
        {entity.description && (
          <p className="mt-1.5 mb-0 text-[13px] text-muted leading-relaxed font-ui">
            {entity.description}
          </p>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <Section label="Keys">
          <KeyRow label={schema.keys.pk} pattern={entity.pk} />
          <KeyRow label={schema.keys.sk} pattern={entity.sk} />
        </Section>

        {entity.indexPatterns.length > 0 && (
          <Section label="Index patterns">
            <div className="flex flex-col gap-2">
              {entity.indexPatterns.map((pattern) => {
                const def = schema.indexes.find((d) => d.name === pattern.index);
                return (
                  <div key={pattern.index} className="border border-line rounded-md overflow-hidden">
                    <div className="py-1.25 px-2.5 bg-elevated border-b border-line font-mono text-[12px] font-semibold text-accent tracking-[0.05em]">
                      {pattern.index}
                    </div>
                    <div className="p-2.5 flex flex-col gap-1">
                      <GsiKeyRow prefix="PK →" pattern={pattern.pk} attr={def?.pkAttr ?? `${pattern.index}PK`} />
                      {pattern.sk && (
                        <GsiKeyRow prefix="SK →" pattern={pattern.sk} attr={def?.skAttr ?? 'SK'} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <Section label={`Attributes (${entity.attributes.length})`}>
          {entity.attributes.length === 0 ? (
            <span className="text-xs text-muted font-ui">No attributes documented.</span>
          ) : (
            <div className="flex flex-wrap gap-1.25">
              {entity.attributes.map((attr) => (
                <span
                  key={attr}
                  className="px-2 py-0.75 font-mono text-xs text-secondary bg-elevated border border-line rounded"
                >
                  {attr}
                </span>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ---- Pieces ----

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-5 py-3.5 border-b border-line-dim">
      <div className="micro-label text-[12px] mb-2.5">{label}</div>
      {children}
    </div>
  );
}

function KeyRow({ label, pattern }: { label: string; pattern: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-1.25">
      <span className="font-mono text-[12px] font-semibold text-muted w-12 shrink-0">{label}</span>
      <code className="font-mono text-xs bg-elevated border border-line rounded px-2.5 py-1 flex-1">
        <PatternDisplay pattern={pattern} />
      </code>
    </div>
  );
}

function GsiKeyRow({ prefix, pattern, attr }: { prefix: string; pattern: string; attr: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[12px] text-muted w-7.5 shrink-0">{prefix}</span>
      <code className="font-mono text-xs flex-1">
        <PatternDisplay pattern={pattern} />
      </code>
      <span className="font-mono text-[12px] text-muted px-1.5 py-0.5 bg-canvas border border-line-dim rounded-0.75 shrink-0">
        {attr}
      </span>
    </div>
  );
}
