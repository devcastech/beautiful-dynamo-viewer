import { describe, expect, it } from 'vitest';
import * as ops from './operations.ts';
import type { Entity, SavedQuery, TableSchema } from './types.ts';

function makeSchema(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    version: 2,
    id: 's1',
    name: 'Shop',
    tableName: 'ShopTable',
    description: '',
    keys: { pk: 'PK', sk: 'SK' },
    indexes: [{ name: 'GSI1', pkAttr: 'GSI1PK', skAttr: 'GSI1SK' }],
    entities: [
      {
        name: 'Order',
        pk: 'ORDER#<orderId>',
        sk: 'ORDER',
        description: '',
        priority: 1,
        attributes: [],
        indexPatterns: [],
      },
    ],
    queries: [
      {
        id: 'q1',
        name: 'Get order',
        entityName: 'Order',
        target: 'base',
        pkValues: {},
        skOp: 'none',
        skValues: {},
        sk2Values: {},
      },
    ],
    ...overrides,
  };
}

const newEntity: Entity = {
  name: 'Shipment',
  pk: 'ORDER#<orderId>',
  sk: 'SHIPMENT#<n>',
  description: '',
  priority: 2,
  attributes: [],
  indexPatterns: [{ index: 'GSI9', pk: 'SHIPMENTS', sk: 'SHIPMENT#<n>' }],
};

describe('schema operations', () => {
  it('adds, updates and deletes schemas by id', () => {
    let schemas = [makeSchema()];
    schemas = ops.addSchema(schemas, makeSchema({ id: 's2', name: 'Other' }));
    expect(schemas).toHaveLength(2);

    schemas = ops.updateSchema(schemas, 's2', { name: 'Renamed' });
    expect(schemas[1].name).toBe('Renamed');
    expect(schemas[0].name).toBe('Shop');

    schemas = ops.deleteSchema(schemas, 's1');
    expect(schemas.map((s) => s.id)).toEqual(['s2']);
  });
});

describe('entity operations', () => {
  it('addEntity appends the entity and registers unknown indexes', () => {
    const [schema] = ops.addEntity([makeSchema()], 's1', newEntity);
    expect(schema.entities.map((e) => e.name)).toEqual(['Order', 'Shipment']);
    expect(schema.indexes).toContainEqual({ name: 'GSI9', pkAttr: 'GSI9PK', skAttr: 'GSI9SK' });
    // Existing index untouched
    expect(schema.indexes[0]).toEqual({ name: 'GSI1', pkAttr: 'GSI1PK', skAttr: 'GSI1SK' });
  });

  it('updateEntity cascades renames to saved queries', () => {
    const renamed = { ...makeSchema().entities[0], name: 'PurchaseOrder' };
    const [schema] = ops.updateEntity([makeSchema()], 's1', 'Order', renamed);
    expect(schema.entities[0].name).toBe('PurchaseOrder');
    expect(schema.queries[0].entityName).toBe('PurchaseOrder');
  });

  it('deleteEntity removes the entity and its queries', () => {
    const [schema] = ops.deleteEntity([makeSchema()], 's1', 'Order');
    expect(schema.entities).toHaveLength(0);
    expect(schema.queries).toHaveLength(0);
  });

  it('does not touch other schemas', () => {
    const schemas = [makeSchema(), makeSchema({ id: 's2' })];
    const result = ops.deleteEntity(schemas, 's2', 'Order');
    expect(result[0].entities).toHaveLength(1);
    expect(result[1].entities).toHaveLength(0);
  });
});

describe('query operations', () => {
  const query: SavedQuery = {
    id: 'q2',
    name: 'List shipments',
    entityName: 'Order',
    target: 'GSI1',
    pkValues: { orderId: '1' },
    skOp: 'BeginsWith',
    skValues: {},
    sk2Values: {},
  };

  it('adds a query', () => {
    const [schema] = ops.addQuery([makeSchema()], 's1', query);
    expect(schema.queries.map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('updates a query by id', () => {
    const [schema] = ops.updateQuery(
      ops.addQuery([makeSchema()], 's1', query),
      's1',
      { ...query, skOp: 'Eq' },
    );
    expect(schema.queries[1].skOp).toBe('Eq');
  });

  it('renames a query', () => {
    const [schema] = ops.renameQuery([makeSchema()], 's1', 'q1', 'Fetch order');
    expect(schema.queries[0].name).toBe('Fetch order');
  });

  it('deletes a query', () => {
    const [schema] = ops.deleteQuery([makeSchema()], 's1', 'q1');
    expect(schema.queries).toHaveLength(0);
  });
});
