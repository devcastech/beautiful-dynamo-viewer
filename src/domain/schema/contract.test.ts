import { describe, expect, it } from 'vitest';
import { buildQueryParams } from './buildQueryParams.ts';
import type { Entity, TableSchema } from './types.ts';
import baseNoSk from '../../../fixtures/query-params/base-no-sk.json';
import gsiBeginsWith from '../../../fixtures/query-params/gsi-begins-with.json';
import betweenFilters from '../../../fixtures/query-params/between-filters.json';
import containsFilter from '../../../fixtures/query-params/contains-filter.json';

// Contract tests against the Rust backend: each fixture in fixtures/query-params/
// is the exact JSON `query_table` receives as `params`. The Rust side asserts it
// deserializes into its QueryParams (see src-tauri .../dynamodb/mod.rs); here we
// assert buildQueryParams produces it. A shape change on one side breaks a test.

/** What actually crosses the Tauri bridge: JSON serialization drops undefineds. */
function wire(params: unknown): unknown {
  return JSON.parse(JSON.stringify(params));
}

const order: Entity = {
  name: 'Order',
  pk: 'ORDER#<orderId>',
  sk: 'ITEM#<itemId>',
  description: '',
  priority: 1,
  attributes: [],
  indexPatterns: [{ index: 'GSI1', pk: 'USER#<userId>', sk: 'ORDER#<date>' }],
};

const user: Entity = {
  name: 'User',
  pk: 'USER#<userId>',
  sk: 'PROFILE',
  description: '',
  priority: 1,
  attributes: [],
  indexPatterns: [],
};

const schema: TableSchema = {
  version: 2,
  id: 's1',
  name: 'ecommerce-demo',
  tableName: 'ecommerce-demo',
  description: '',
  keys: { pk: 'PK', sk: 'SK' },
  indexes: [{ name: 'GSI1', pkAttr: 'GSI1PK', skAttr: 'GSI1SK' }],
  entities: [order, user],
  queries: [],
};

describe('query-params contract fixtures', () => {
  it('base-no-sk', () => {
    const params = buildQueryParams({
      schema,
      entity: order,
      tableName: 'ecommerce-demo',
      target: 'base',
      pkValues: { orderId: 'o-123' },
      skOp: 'none',
      skValues: {},
      sk2Values: {},
    });
    expect(wire(params)).toEqual(baseNoSk);
  });

  it('gsi-begins-with', () => {
    const params = buildQueryParams({
      schema,
      entity: order,
      tableName: 'ecommerce-demo',
      target: 'GSI1',
      pkValues: { userId: 'u-1' },
      skOp: 'BeginsWith',
      skValues: { date: '2024-' },
      sk2Values: {},
    });
    expect(wire({ ...params, limit: 25 })).toEqual(gsiBeginsWith);
  });

  it('between-filters', () => {
    const params = buildQueryParams({
      schema,
      entity: order,
      tableName: 'ecommerce-demo',
      target: 'base',
      pkValues: { orderId: 'o-123' },
      skOp: 'Between',
      skValues: { itemId: '001' },
      sk2Values: { itemId: '999' },
      filters: [
        { name: 'status', valueType: 'string', condition: { op: 'Eq', value: 'SHIPPED' } },
        {
          name: 'total',
          valueType: 'number',
          condition: { op: 'Between', value: { from: '10', to: '100' } },
        },
      ],
    });
    expect(wire(params)).toEqual(betweenFilters);
  });

  it('contains-filter', () => {
    const params = buildQueryParams({
      schema,
      entity: user,
      tableName: 'ecommerce-demo',
      target: 'base',
      pkValues: { userId: 'u-9' },
      skOp: 'none',
      skValues: {},
      sk2Values: {},
      filters: [
        { name: 'notes', valueType: 'string', condition: { op: 'Contains', value: 'urgent' } },
      ],
    });
    const startKey = { PK: 'USER#u-9', SK: 'ORDER#2024-01-01' };
    expect(wire({ ...params, exclusiveStartKey: startKey })).toEqual(containsFilter);
  });
});
