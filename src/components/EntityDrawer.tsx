import { useState, type ReactNode } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Drawer } from './ui/Drawer.tsx';
import { Button, IconButton } from './ui/Button.tsx';
import { Field, Input, TextArea } from './ui/Input.tsx';
import type { Entity, IndexPattern, TableSchema } from '../domain/schema/types.ts';

interface EntityDrawerProps {
  schema: TableSchema;
  /** Entity being edited, or null when creating a new one. */
  entity: Entity | null;
  /** Pre-filled PK pattern when creating from a partition group. */
  initialPartitionKey?: string;
  onSave: (entity: Entity) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const EMPTY_ENTITY: Entity = {
  name: '',
  pk: '',
  sk: '',
  description: '',
  priority: 1,
  attributes: [],
  indexPatterns: [],
};

export function EntityDrawer({
  schema,
  entity,
  initialPartitionKey = '',
  onSave,
  onDelete,
  onClose,
}: EntityDrawerProps) {
  const isNew = entity === null;
  const [draft, setDraft] = useState<Entity>(
    entity ?? { ...EMPTY_ENTITY, pk: initialPartitionKey },
  );
  const [newAttr, setNewAttr] = useState('');

  function set<K extends keyof Entity>(key: K, value: Entity[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const nameTaken =
    draft.name.trim() !== (entity?.name ?? '') &&
    schema.entities.some((e) => e.name === draft.name.trim());
  const canSave = draft.name.trim() !== '' && draft.pk.trim() !== '' && !nameTaken;

  function handleSave() {
    if (!canSave) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      pk: draft.pk.trim(),
      sk: draft.sk.trim(),
      indexPatterns: draft.indexPatterns
        .filter((p) => p.index.trim() !== '')
        .map((p) => ({ index: p.index.trim(), pk: p.pk.trim(), sk: p.sk.trim() })),
    });
  }

  // --- attributes ---
  function addAttr() {
    const v = newAttr.trim();
    if (!v || draft.attributes.includes(v)) return;
    set('attributes', [...draft.attributes, v]);
    setNewAttr('');
  }
  function removeAttr(i: number) {
    set('attributes', draft.attributes.filter((_, idx) => idx !== i));
  }

  // --- index patterns ---
  function addPattern() {
    const usedNames = new Set(draft.indexPatterns.map((p) => p.index));
    const suggestion =
      schema.indexes.find((d) => !usedNames.has(d.name))?.name ??
      `GSI${draft.indexPatterns.length + 1}`;
    set('indexPatterns', [...draft.indexPatterns, { index: suggestion, pk: '', sk: '' }]);
  }
  function removePattern(i: number) {
    set('indexPatterns', draft.indexPatterns.filter((_, idx) => idx !== i));
  }
  function updatePattern(i: number, patch: Partial<IndexPattern>) {
    set('indexPatterns', draft.indexPatterns.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  return (
    <Drawer
      title={isNew ? 'New entity' : 'Edit entity'}
      subtitle={isNew ? undefined : entity.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            {isNew ? 'Create entity' : 'Save changes'}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          {!isNew && onDelete && (
            <Button variant="danger" onClick={onDelete} icon={<Trash2 size={11} />} className="ml-auto">
              Delete
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col">
        <DrawerSection label="Identity">
          <Field label="Entity name" required>
            <Input
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. OrderMeta"
              autoFocus={isNew}
            />
          </Field>
          {nameTaken && (
            <span className="text-[12px] text-err">
              An entity named “{draft.name.trim()}” already exists.
            </span>
          )}
          <Field label="Description">
            <TextArea
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What this record is and key design decisions…"
              rows={2}
              className="text-[12px]"
            />
          </Field>
        </DrawerSection>

        <DrawerSection
          label="Base table keys"
          hint={`Patterns written into ${schema.keys.pk} / ${schema.keys.sk}. Use <name> for variables.`}
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label={`${schema.keys.pk} pattern`} required>
              <Input
                value={draft.pk}
                onChange={(e) => set('pk', e.target.value)}
                placeholder="ORDER#<orderId>"
              />
            </Field>
            <Field label={`${schema.keys.sk} pattern`}>
              <Input
                value={draft.sk}
                onChange={(e) => set('sk', e.target.value)}
                placeholder="ORDER"
              />
            </Field>
          </div>
          <Field
            label="Priority"
            hint="1 = primary record of its partition; higher numbers sort after it."
          >
            <Input
              type="number"
              min={1}
              value={String(draft.priority)}
              onChange={(e) => set('priority', Math.max(1, Number(e.target.value) || 1))}
              className="w-24"
            />
          </Field>
        </DrawerSection>

        <DrawerSection
          label="Index patterns"
          hint="How this entity writes its keys into each GSI. New index names are added to the schema automatically."
        >
          <div className="flex flex-col gap-2">
            {draft.indexPatterns.map((pattern, i) => (
              <div key={i} className="border border-line-dim rounded-md overflow-hidden">
                <div className="flex items-center gap-2 py-2 px-2.5 bg-elevated/50 border-b border-line-dim">
                  <Input
                    value={pattern.index}
                    onChange={(e) => updatePattern(i, { index: e.target.value })}
                    list="schema-indexes"
                    placeholder="GSI1"
                    aria-label="Index name"
                    className="w-44 font-semibold text-accent"
                  />
                  {schema.indexes.find((d) => d.name === pattern.index) ? (
                    <span className="font-mono text-[11px] text-muted">
                      {schema.indexes.find((d) => d.name === pattern.index)!.pkAttr}
                      {' / '}
                      {schema.indexes.find((d) => d.name === pattern.index)!.skAttr ?? '-'}
                    </span>
                  ) : (
                    pattern.index.trim() !== '' && (
                      <span className="font-mono text-[11px] text-accent/70">new index</span>
                    )
                  )}
                  <IconButton label="Remove index pattern" onClick={() => removePattern(i)} className="ml-auto">
                    <X size={12} aria-hidden="true" />
                  </IconButton>
                </div>
                <div className="p-2.5 grid grid-cols-2 gap-2">
                  <Field label="PK pattern">
                    <Input
                      value={pattern.pk}
                      onChange={(e) => updatePattern(i, { pk: e.target.value })}
                      placeholder="ORDERS"
                    />
                  </Field>
                  <Field label="SK pattern">
                    <Input
                      value={pattern.sk}
                      onChange={(e) => updatePattern(i, { sk: e.target.value })}
                      placeholder="ORDER#<orderId>"
                    />
                  </Field>
                </div>
              </div>
            ))}
            <datalist id="schema-indexes">
              {schema.indexes.map((d) => (
                <option key={d.name} value={d.name} />
              ))}
            </datalist>
          </div>
          <Button onClick={addPattern} icon={<Plus size={11} />} className="mt-2">
            Add index pattern
          </Button>
        </DrawerSection>

        <DrawerSection label="Attributes" hint="Documented item attributes (informational).">
          <div className="flex flex-wrap gap-1.25 mb-2">
            {draft.attributes.map((attr, i) => (
              <span
                key={attr}
                className="flex items-center gap-1 px-2 py-0.5 font-mono text-xs text-secondary bg-elevated rounded"
              >
                {attr}
                <IconButton label={`Remove attribute ${attr}`} onClick={() => removeAttr(i)} className="p-0">
                  <X size={10} aria-hidden="true" />
                </IconButton>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <Input
              value={newAttr}
              onChange={(e) => setNewAttr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addAttr();
              }}
              placeholder="attributeName"
              className="flex-1"
            />
            <Button onClick={addAttr} icon={<Plus size={11} />} aria-label="Add attribute" />
          </div>
        </DrawerSection>
      </div>
    </Drawer>
  );
}

function DrawerSection({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-line-dim flex flex-col gap-2.5">
      <div>
        <div className="text-[13px] font-medium text-primary">{label}</div>
        {hint && <p className="m-0 mt-1 text-[12px] text-muted font-ui leading-relaxed">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
