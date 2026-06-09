import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from './ui/Modal.tsx';
import { Button, IconButton } from './ui/Button.tsx';
import { Field, Input, TextArea } from './ui/Input.tsx';
import { DEFAULT_KEYS, SCHEMA_VERSION, type IndexDef, type TableSchema } from '../domain/schema/types.ts';

interface SchemaModalProps {
  mode: 'add' | 'edit';
  initial?: TableSchema;
  onConfirm: (schema: TableSchema) => void;
  onClose: () => void;
}

export function SchemaModal({ mode, initial, onConfirm, onClose }: SchemaModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [tableName, setTableName] = useState(initial?.tableName ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [keys, setKeys] = useState(initial?.keys ?? DEFAULT_KEYS);
  const [indexes, setIndexes] = useState<IndexDef[]>(initial?.indexes ?? []);

  const canConfirm =
    name.trim() !== '' &&
    tableName.trim() !== '' &&
    keys.pk.trim() !== '' &&
    indexes.every((d) => d.name.trim() !== '' && d.pkAttr.trim() !== '');

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm({
      version: SCHEMA_VERSION,
      id: initial?.id ?? crypto.randomUUID(),
      entities: initial?.entities ?? [],
      queries: initial?.queries ?? [],
      name: name.trim(),
      tableName: tableName.trim(),
      description: description.trim(),
      keys: { pk: keys.pk.trim(), sk: keys.sk.trim() || 'SK' },
      indexes: indexes.map((d) => ({
        name: d.name.trim(),
        pkAttr: d.pkAttr.trim(),
        skAttr: d.skAttr?.trim() || undefined,
      })),
    });
  }

  function updateIndex(i: number, patch: Partial<IndexDef>) {
    setIndexes((list) => list.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  return (
    <Modal
      title={mode === 'add' ? 'New schema' : 'Edit schema'}
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!canConfirm}>
            {mode === 'add' ? 'Create' : 'Save'}
          </Button>
        </>
      }
    >
      <Field label="Schema name" required hint="Display label — how this model appears in the selector.">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
          }}
          placeholder="e.g. MyService Prod"
          autoFocus
        />
      </Field>

      <Field label="DynamoDB table" required hint="The actual table name queries run against.">
        <Input
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
          }}
          placeholder="e.g. MyServiceTable-prod"
        />
      </Field>

      <Field label="Description">
        <TextArea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What data lives here and how to read it…"
          rows={2}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="PK attribute" required hint="Physical partition key attribute.">
          <Input
            value={keys.pk}
            onChange={(e) => setKeys((k) => ({ ...k, pk: e.target.value }))}
            placeholder="PK"
          />
        </Field>
        <Field label="SK attribute" hint="Physical sort key attribute.">
          <Input
            value={keys.sk}
            onChange={(e) => setKeys((k) => ({ ...k, sk: e.target.value }))}
            placeholder="SK"
          />
        </Field>
      </div>

      {mode === 'edit' && (
        <div className="flex flex-col gap-1.5">
          <span className="micro-label">Secondary indexes (GSIs)</span>
          {indexes.length === 0 && (
            <span className="text-[12px] text-muted/70 font-ui">
              None yet — they're added automatically when an entity declares an index pattern.
            </span>
          )}
          {indexes.map((def, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={def.name}
                onChange={(e) => updateIndex(i, { name: e.target.value })}
                placeholder="GSI1"
                aria-label="Index name"
                className="w-36 text-accent"
              />
              <Input
                value={def.pkAttr}
                onChange={(e) => updateIndex(i, { pkAttr: e.target.value })}
                placeholder="GSI1PK"
                aria-label="Index PK attribute"
              />
              <Input
                value={def.skAttr ?? ''}
                onChange={(e) => updateIndex(i, { skAttr: e.target.value })}
                placeholder="GSI1SK (optional)"
                aria-label="Index SK attribute"
              />
              <IconButton
                label={`Remove index ${def.name}`}
                danger
                onClick={() => setIndexes((list) => list.filter((_, idx) => idx !== i))}
              >
                <X size={12} aria-hidden="true" />
              </IconButton>
            </div>
          ))}
          <Button
            onClick={() => setIndexes((list) => [...list, { name: '', pkAttr: '', skAttr: '' }])}
            icon={<Plus size={11} />}
            className="self-start mt-1"
          >
            Add index
          </Button>
        </div>
      )}
    </Modal>
  );
}
