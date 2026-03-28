import { ArrowRight, Play } from 'lucide-react';
import type { Entity, ShelfTheme } from '../types/schema.ts';

interface EntityInspectorProps {
  entity: Entity;
  theme: ShelfTheme;
  onUsePattern?: (pattern: string) => void;
}

export function EntityInspector({ entity, theme, onUsePattern }: EntityInspectorProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${theme.iconColor}`}>
            {entity.role}
          </span>
          <span className="text-[10px] text-slate-400">{entity.attributes.length} attrs</span>
        </div>
        <h3 className="text-xl font-bold tracking-tight text-slate-950">{entity.name}</h3>
        <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{entity.description}</p>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {/* Keys */}
        <section className="px-6 py-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-3">
            Keys
          </h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">PK</span>
              <code className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
                {entity.pk}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">SK</span>
              <code className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
                {entity.sk}
              </code>
            </div>
          </div>
        </section>

        {/* GSIs */}
        {entity.gsis.length > 0 && (
          <section className="px-6 py-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-3">
              Global Secondary Indexes
            </h4>
            <div className="space-y-2">
              {entity.gsis.map((gsi) => (
                <div
                  key={`${entity.name}:${gsi.name}`}
                  className="rounded border border-slate-200 overflow-hidden text-xs"
                >
                  <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 font-medium text-slate-700">
                    {gsi.name}
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2">
                    <div>
                      <code className="block text-slate-600 truncate">{gsi.pk}</code>
                      <code className="block text-slate-400 truncate">{gsi.sk}</code>
                    </div>
                    <ArrowRight className="h-3 w-3 text-slate-300" />
                    <div className="text-right">
                      <code className="block text-slate-600 truncate">{entity.pk}</code>
                      <code className="block text-slate-400 truncate">{entity.sk}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Access Patterns */}
        {entity.accessPatterns.length > 0 && (
          <section className="px-6 py-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-3">
              Access Patterns
            </h4>
            <ul className="space-y-1.5">
              {entity.accessPatterns.map((pattern, index) => (
                <li
                  key={`${entity.name}:${index}`}
                  className="flex items-start gap-2.5 text-sm text-slate-600 group"
                >
                  <span className="mt-0.5 text-[10px] font-mono text-slate-400 shrink-0 w-4 text-right">
                    {index + 1}.
                  </span>
                  <span className="leading-5 flex-1">{pattern}</span>
                  {onUsePattern && (
                    <button
                      type="button"
                      title="Use pattern"
                      onClick={() => onUsePattern(pattern)}
                      className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-700"
                    >
                      <Play className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Attributes */}
        <section className="px-6 py-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-3">
            Attributes
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {entity.attributes.map((attr) => (
              <span
                key={`${entity.name}:${attr}`}
                className="px-2 py-0.5 text-[11px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded"
              >
                {attr}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
