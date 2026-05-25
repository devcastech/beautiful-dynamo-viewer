import { useState, type ReactNode } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Entity, GSI } from '../types/schema.ts';

interface EntityInspectorProps {
  entity: Entity;
  editMode?: boolean;
  isNew?: boolean;
  onEnterEdit?: () => void;
  onSave?: (entity: Entity) => void;
  onCancelEdit?: () => void;
  onDelete?: () => void;
}

export function EntityInspector({
  entity,
  editMode = false,
  isNew = false,
  onEnterEdit,
  onSave,
  onCancelEdit,
  onDelete,
}: EntityInspectorProps) {
  const [draft, setDraft] = useState<Entity>(entity);
  const [newAttr, setNewAttr] = useState('');

  function set<K extends keyof Entity>(key: K, value: Entity[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSave() {
    if (!draft.name.trim() || !draft.pk.trim()) return;
    onSave?.({ ...draft, name: draft.name.trim(), pk: draft.pk.trim(), sk: draft.sk.trim() });
  }

  // --- attribute list helpers ---
  function addAttr() {
    const v = newAttr.trim();
    if (!v || draft.attributes.includes(v)) return;
    set('attributes', [...draft.attributes, v]);
    setNewAttr('');
  }
  function removeAttr(i: number) {
    set('attributes', draft.attributes.filter((_, idx) => idx !== i));
  }

  // --- GSI helpers ---
  function addGsi() {
    const n = draft.gsis.length + 1;
    set('gsis', [
      ...draft.gsis,
      { name: `GSI${n}`, pk: '', sk: '', pkAttr: `GSI${n}PK`, skAttr: `GSI${n}SK` },
    ]);
  }
  function removeGsi(i: number) {
    set('gsis', draft.gsis.filter((_, idx) => idx !== i));
  }
  function updateGsi(i: number, patch: Partial<GSI>) {
    set('gsis', draft.gsis.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }

  if (editMode) {
    return (
      <div className="flex flex-col h-full overflow-hidden animate-fade-in">
        {/* Edit header */}
        <div className="px-5 py-4 border-b border-line bg-surface shrink-0 flex flex-col gap-3">
          <input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Entity name *"
            className={INPUT}
            spellCheck={false}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={draft.pk}
              onChange={(e) => set('pk', e.target.value)}
              placeholder="PK pattern *  e.g. ENTITY#<id>"
              className={INPUT}
              spellCheck={false}
            />
            <input
              value={draft.sk}
              onChange={(e) => set('sk', e.target.value)}
              placeholder="SK pattern  e.g. ENTITY"
              className={INPUT}
              spellCheck={false}
            />
          </div>
          <textarea
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Description…"
            rows={2}
            className={`${INPUT} resize-none text-[12px]`}
            spellCheck={false}
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSave} disabled={!draft.name.trim() || !draft.pk.trim()} className={BTN_PRIMARY}>
              <Check size={11} /> Save
            </button>
            <button type="button" onClick={onCancelEdit} className={BTN_GHOST}>
              Cancel
            </button>
            {!isNew && onDelete && (
              <button type="button" onClick={onDelete} className={`${BTN_GHOST} ml-auto text-red-400 hover:text-red-300`}>
                <Trash2 size={11} /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Edit body */}
        <div className="flex-1 overflow-y-auto">
          {/* Keys: real base-table attribute names + priority (PK/SK patterns are in the header) */}
          <EditSection label="Keys">
            <div className="grid grid-cols-3 gap-2">
              <LabeledInput label="pkAttr" value={draft.pkAttr ?? ''} onChange={(v) => set('pkAttr', v.trim() || undefined)} placeholder="PK" />
              <LabeledInput label="skAttr" value={draft.skAttr ?? ''} onChange={(v) => set('skAttr', v.trim() || undefined)} placeholder="SK" />
              <LabeledInput label="Priority" type="number" value={String(draft.priority)} onChange={(v) => set('priority', Number(v))} />
            </div>
          </EditSection>

          {/* GSIs */}
          <EditSection label="Global Secondary Indexes">
            <div className="flex flex-col gap-2">
              {draft.gsis.map((gsi, i) => (
                <div key={i} className="border border-line rounded-md overflow-hidden">
                  <div className="flex items-center gap-2 py-[5px] px-2.5 bg-elevated border-b border-line">
                    <input
                      value={gsi.name}
                      onChange={(e) => updateGsi(i, { name: e.target.value })}
                      className={`${INPUT} w-20 font-semibold text-accent`}
                      spellCheck={false}
                    />
                    <button type="button" onClick={() => removeGsi(i)} className="ml-auto text-muted hover:text-red-400 bg-transparent border-0 cursor-pointer p-0.5 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="p-2.5 grid grid-cols-2 gap-2">
                    <LabeledInput label="PK pattern" value={gsi.pk} onChange={(v) => updateGsi(i, { pk: v })} placeholder="ENTITY" />
                    <LabeledInput label="pkAttr" value={gsi.pkAttr} onChange={(v) => updateGsi(i, { pkAttr: v })} placeholder="GSI1PK" />
                    <LabeledInput label="SK pattern" value={gsi.sk} onChange={(v) => updateGsi(i, { sk: v })} placeholder="ENTITY#<id>" />
                    <LabeledInput label="skAttr" value={gsi.skAttr ?? ''} onChange={(v) => updateGsi(i, { skAttr: v })} placeholder="GSI1SK" />
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addGsi} className={`${BTN_GHOST} mt-2`}>
              <Plus size={11} /> Add GSI
            </button>
          </EditSection>

          {/* Attributes */}
          <EditSection label="Attributes">
            <div className="flex flex-wrap gap-[5px] mb-2">
              {draft.attributes.map((attr, i) => (
                <span key={attr} className="flex items-center gap-1 px-2 py-[3px] font-mono text-xs text-secondary bg-elevated border border-line rounded">
                  {attr}
                  <button type="button" onClick={() => removeAttr(i)} className="text-muted hover:text-red-400 bg-transparent border-0 cursor-pointer p-0 leading-none transition-colors">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                value={newAttr}
                onChange={(e) => setNewAttr(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addAttr(); }}
                placeholder="attributeName"
                className={`${INPUT} flex-1`}
                spellCheck={false}
              />
              <button type="button" onClick={addAttr} className={BTN_GHOST}>
                <Plus size={11} />
              </button>
            </div>
          </EditSection>
        </div>
      </div>
    );
  }

  // ---- View mode (original) ----
  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      {/* Entity header */}
      <div className="px-5 py-4 border-b border-line bg-surface shrink-0">
        <div className="flex items-baseline gap-2 mb-[2px]">
          <h3 className="m-0 font-mono font-semibold text-[15px] text-primary tracking-[-0.01em]">
            {entity.name}
          </h3>
          {onEnterEdit && (
            <button
              type="button"
              title="Edit entity"
              onClick={onEnterEdit}
              className="ml-auto text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-0.5 rounded transition-colors"
            >
              <Pencil size={12} />
            </button>
          )}
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

// ---- Sub-components (view mode) ----

function Section({ label, children }: { label: string; children: ReactNode }) {
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
      <span className="font-mono text-[11px] font-semibold text-muted w-[22px] shrink-0">{label}</span>
      <code className="font-mono text-xs bg-elevated border border-line rounded px-[9px] py-1 flex-1">
        <PatternDisplay pattern={pattern} />
      </code>
    </div>
  );
}

function GsiKeyRow({ prefix, pattern, attr }: { prefix: string; pattern: string; attr: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] text-muted w-[30px] shrink-0">{prefix}</span>
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

// ---- Sub-components (edit mode) ----

function EditSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-5 py-[14px] border-b border-line-dim">
      <div className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-muted mb-2.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] text-muted uppercase tracking-[0.08em]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT}
        spellCheck={false}
      />
    </div>
  );
}

const INPUT =
  'bg-canvas border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[4px] outline-none w-full focus:border-accent/50 transition-colors';

const BTN_PRIMARY =
  'flex items-center gap-1 font-mono text-xs text-primary px-3 py-1.5 rounded-[5px] bg-accent-dim border border-accent-line cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

const BTN_GHOST =
  'flex items-center gap-1 font-mono text-xs text-muted hover:text-primary px-2 py-1.5 rounded-[5px] bg-transparent border border-line cursor-pointer transition-colors';
