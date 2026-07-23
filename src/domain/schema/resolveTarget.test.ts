import { describe, expect, it } from 'vitest';
import { resolveTarget } from './resolveTarget.ts';
import type { Entity, TableSchema } from './types.ts';

const entity: Entity = {
  name: 'Order',
  pk: 'ORDER#<orderId>',
  sk: 'ORDER',
  description: '',
  priority: 1,
  attributes: [],
  indexPatterns: [
    { index: 'GSI1', pk: 'USER#<userId>', sk: 'ORDER#<date>' },
    { index: 'GSI-no-sk-attr', pk: 'STATUS#<status>', sk: 'ORDER#<orderId>' },
    { index: 'GSI-undefined', pk: 'X#<x>', sk: 'Y#<y>' },
  ],
};

const schema: TableSchema = {
  version: 2,
  id: 's1',
  name: 'Shop',
  tableName: 'shop',
  description: '',
  keys: { pk: 'PK', sk: 'SK' },
  indexes: [
    { name: 'GSI1', pkAttr: 'GSI1PK', skAttr: 'GSI1SK' },
    { name: 'GSI-no-sk-attr', pkAttr: 'G2PK' },
  ],
  entities: [entity],
  queries: [],
};

describe('resolveTarget', () => {
  it('resolves the base table to the entity patterns and table keys', () => {
    expect(resolveTarget(schema, entity, 'base')).toEqual({
      indexDef: null,
      pkPattern: 'ORDER#<orderId>',
      skPattern: 'ORDER',
      pkAttr: 'PK',
      skAttr: 'SK',
      indexName: undefined,
    });
  });

  it('resolves a GSI to its pattern and physical attributes', () => {
    expect(resolveTarget(schema, entity, 'GSI1')).toEqual({
      indexDef: schema.indexes[0],
      pkPattern: 'USER#<userId>',
      skPattern: 'ORDER#<date>',
      pkAttr: 'GSI1PK',
      skAttr: 'GSI1SK',
      indexName: 'GSI1',
    });
  });

  it('falls back to "SK" when the index defines no skAttr', () => {
    const resolved = resolveTarget(schema, entity, 'GSI-no-sk-attr');
    expect(resolved.pkAttr).toBe('G2PK');
    expect(resolved.skAttr).toBe('SK');
  });

  it('keeps the pattern and index name when the schema does not define the index', () => {
    const resolved = resolveTarget(schema, entity, 'GSI-undefined');
    expect(resolved.indexDef).toBeNull();
    expect(resolved.pkPattern).toBe('X#<x>');
    // Without a definition the physical attrs fall back to the table keys.
    expect(resolved.pkAttr).toBe('PK');
    expect(resolved.indexName).toBe('GSI-undefined');
  });

  it('falls back to base patterns for a target the entity does not know', () => {
    expect(resolveTarget(schema, entity, 'nope')).toEqual(resolveTarget(schema, entity, 'base'));
  });
});
