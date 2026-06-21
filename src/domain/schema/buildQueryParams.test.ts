import { describe, expect, it } from 'vitest';
import { buildQueryParams, type BuildQueryParamsInput } from './buildQueryParams.ts';
import type { Entity, TableSchema } from './types.ts';

const entity: Entity = {
  name: 'Order',
  pk: 'ORDER#<orderId>',
  sk: 'ORDER',
  description: '',
  priority: 1,
  attributes: [],
  indexPatterns: [
    { index: 'GSI1', pk: 'USER#<userId>', sk: 'ORDER#<date>#<orderId>' },
    // An index pattern whose target has no matching IndexDef in the schema.
    { index: 'GSIX', pk: 'X#<x>', sk: 'Y#<y>' },
  ],
};

const schema: TableSchema = {
  version: 2,
  id: 's1',
  name: 'Shop',
  tableName: 'ShopTable',
  description: '',
  keys: { pk: 'PK', sk: 'SK' },
  indexes: [{ name: 'GSI1', pkAttr: 'GSI1PK', skAttr: 'GSI1SK' }],
  entities: [entity],
  queries: [],
};

function input(over: Partial<BuildQueryParamsInput> = {}): BuildQueryParamsInput {
  return {
    schema,
    entity,
    tableName: 'ShopTable',
    target: 'base',
    pkValues: {},
    skOp: 'none',
    skValues: {},
    sk2Values: {},
    ...over,
  };
}

describe('buildQueryParams — base table', () => {
  it('resolves the pk pattern and uses base key names', () => {
    const p = buildQueryParams(input({ pkValues: { orderId: '42' } }));
    expect(p).toEqual({
      table: 'ShopTable',
      pkName: 'PK',
      pkValue: 'ORDER#42',
      skName: undefined,
      skCondition: undefined,
      indexName: undefined,
    });
  });

  it('omits skName and skCondition when skOp is none', () => {
    const p = buildQueryParams(input({ pkValues: { orderId: '1' }, skOp: 'none' }));
    expect(p.skName).toBeUndefined();
    expect(p.skCondition).toBeUndefined();
  });

  it('leaves unfilled pk variables as empty strings', () => {
    const p = buildQueryParams(input({ pkValues: {} }));
    expect(p.pkValue).toBe('ORDER#');
  });
});

describe('buildQueryParams — GSI target', () => {
  it('uses the index key attributes and sets indexName', () => {
    const p = buildQueryParams(input({ target: 'GSI1', pkValues: { userId: 'u1' } }));
    expect(p.pkName).toBe('GSI1PK');
    expect(p.pkValue).toBe('USER#u1');
    expect(p.indexName).toBe('GSI1');
  });

  it('falls back skName to "SK" when the index has no matching IndexDef', () => {
    const p = buildQueryParams(input({ target: 'GSIX', skOp: 'Eq', skValues: { x: 'a', y: 'b' } }));
    // No IndexDef named GSIX → pkName/skName fall back, but indexName is still passed through.
    expect(p.pkName).toBe('PK');
    expect(p.skName).toBe('SK');
    expect(p.indexName).toBe('GSIX');
  });
});

describe('buildQueryParams — sort key conditions', () => {
  it('builds an Eq condition from resolved sk values', () => {
    const p = buildQueryParams(
      input({ target: 'GSI1', skOp: 'Eq', skValues: { date: '2026-01', orderId: '9' } }),
    );
    expect(p.skName).toBe('GSI1SK');
    expect(p.skCondition).toEqual({ op: 'Eq', value: 'ORDER#2026-01#9' });
  });

  it('builds a BeginsWith condition', () => {
    const p = buildQueryParams(input({ target: 'GSI1', skOp: 'BeginsWith', skValues: { date: '2026' } }));
    expect(p.skCondition).toEqual({ op: 'BeginsWith', value: 'ORDER#2026#' });
  });

  it('builds a Between condition from two value maps', () => {
    const p = buildQueryParams(
      input({
        target: 'GSI1',
        skOp: 'Between',
        skValues: { date: '2026-01', orderId: '0' },
        sk2Values: { date: '2026-12', orderId: 'z' },
      }),
    );
    expect(p.skCondition).toEqual({
      op: 'Between',
      value: { from: 'ORDER#2026-01#0', to: 'ORDER#2026-12#z' },
    });
  });

  it('uses the literal sk pattern when the sort key has no variables', () => {
    // Base entity sk is the literal "ORDER" (no <vars>).
    const p = buildQueryParams(input({ pkValues: { orderId: '1' }, skOp: 'Eq' }));
    expect(p.skCondition).toEqual({ op: 'Eq', value: 'ORDER' });
  });
});
