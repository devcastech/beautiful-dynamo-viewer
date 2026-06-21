import { describe, expect, it } from 'vitest';
import {
  isTableSchema,
  parseSchemaImport,
  parseWorkspace,
  serializeWorkspace,
} from './migrate.ts';
import type { TableSchema } from './types.ts';
import { seedSchemas } from '../../data/seed.ts';

const v2Fixture: TableSchema = {
  version: 2,
  id: 'fixture-id',
  name: 'Shop',
  tableName: 'ShopTable-dev',
  description: 'A shop table.',
  keys: { pk: 'PK', sk: 'SK' },
  indexes: [{ name: 'GSI1', pkAttr: 'GSI1PK', skAttr: 'GSI1SK' }],
  entities: [
    {
      name: 'Order',
      pk: 'ORDER#<orderId>',
      sk: 'ORDER',
      description: 'An order.',
      priority: 1,
      attributes: ['id', 'total'],
      indexPatterns: [{ index: 'GSI1', pk: 'ORDERS', sk: 'ORDER#<orderId>' }],
    },
  ],
  queries: [
    {
      id: 'q1',
      name: 'List orders',
      entityName: 'Order',
      target: 'GSI1',
      pkValues: {},
      skOp: 'none',
      skValues: {},
      sk2Values: {},
    },
  ],
};

describe('isTableSchema', () => {
  it('detects v2 schemas', () => {
    expect(isTableSchema(v2Fixture)).toBe(true);
  });

  it('rejects non-v2 shapes', () => {
    expect(isTableSchema(null)).toBe(false);
    expect(isTableSchema({ name: 'x', table: 'y', entities: [] })).toBe(false);
    expect(isTableSchema({ version: 1, name: 'x', tableName: 'y', entities: [] })).toBe(false);
  });
});

describe('parseSchemaImport', () => {
  it('accepts a v2 file as-is', () => {
    expect(parseSchemaImport(JSON.stringify(v2Fixture))).toEqual(v2Fixture);
  });

  it('assigns an id when a v2 file lacks one', () => {
    const noId = { ...v2Fixture, id: '' };
    expect(parseSchemaImport(JSON.stringify(noId)).id).toBeTruthy();
  });

  it('rejects invalid JSON', () => {
    expect(() => parseSchemaImport('not json')).toThrow(/valid JSON/);
  });

  it('rejects JSON that is not a schema', () => {
    expect(() => parseSchemaImport('{"foo": 1}')).toThrow(/Unrecognized/);
  });
});

describe('workspace round-trip', () => {
  it('serializes and parses back the same schemas', () => {
    const schemas = [v2Fixture];
    expect(parseWorkspace(serializeWorkspace(schemas))).toEqual(schemas);
  });

  it('rejects files without a schemas array', () => {
    expect(() => parseWorkspace('{"version":2}')).toThrow(/schemas array/);
    expect(() => parseWorkspace('garbage')).toThrow(/valid JSON/);
  });

  it('rejects unrecognized schema entries', () => {
    const json = JSON.stringify({ version: 2, schemas: [{ foo: 1 }] });
    expect(() => parseWorkspace(json)).toThrow(/unrecognized schema entry/);
  });
});

describe('seed data', () => {
  it('ships a single v2 ecommerce-demo schema', () => {
    const schemas = seedSchemas();
    expect(schemas).toHaveLength(1);

    const demo = schemas[0];
    expect(demo.version).toBe(2);
    expect(demo.name).toBe('ecommerce-demo');
    expect(demo.tableName).toBe('ecommerce-demo');
    expect(demo.entities).toHaveLength(6);
    expect(demo.indexes.map((i) => i.name)).toEqual(['GSI1', 'GSI2', 'GSI3']);
    expect(demo.queries).toEqual([]);
  });
});
