import { describe, expect, it } from 'vitest';
import { parseSchemaImport, parseWorkspace, serializeWorkspace } from './migrate.ts';
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

  it('rejects JSON without a version field', () => {
    expect(() => parseSchemaImport('{"foo": 1}')).toThrow(/no numeric "version"/);
  });

  it('rejects versions with no migration path', () => {
    const v1 = { ...v2Fixture, version: 1 };
    expect(() => parseSchemaImport(JSON.stringify(v1))).toThrow(/no migration path/);
  });

  it('rejects versions newer than the app supports', () => {
    const v99 = { ...v2Fixture, version: 99 };
    expect(() => parseSchemaImport(JSON.stringify(v99))).toThrow(/newer than this app supports/);
  });

  it('rejects a malformed entity with a precise path', () => {
    const bad = {
      ...v2Fixture,
      entities: [v2Fixture.entities[0], { name: 'Broken', pk: 42, sk: 'X' }],
    };
    expect(() => parseSchemaImport(JSON.stringify(bad))).toThrow(/entities\[1\]\.pk must be a string/);
  });

  it('rejects a query with an unknown filter operator', () => {
    const bad = {
      ...v2Fixture,
      queries: [
        {
          ...v2Fixture.queries[0],
          filters: [{ name: 'total', valueType: 'number', condition: { op: 'Gt', value: '5' } }],
        },
      ],
    };
    expect(() => parseSchemaImport(JSON.stringify(bad))).toThrow(/filters\[0\]\.condition\.op/);
  });

  it('accepts a query with valid filters', () => {
    const withFilters = {
      ...v2Fixture,
      queries: [
        {
          ...v2Fixture.queries[0],
          filters: [
            { name: 'status', valueType: 'string', condition: { op: 'Eq', value: 'ACTIVE' } },
            {
              name: 'total',
              valueType: 'number',
              condition: { op: 'Between', value: { from: '1', to: '9' } },
            },
          ],
        },
      ],
    };
    const parsed = parseSchemaImport(JSON.stringify(withFilters));
    expect(parsed.queries[0].filters).toHaveLength(2);
  });

  it('fills defaults for a minimal but well-formed query', () => {
    const minimal = {
      ...v2Fixture,
      queries: [{ id: 'q2', name: 'bare', entityName: 'Order', target: 'base' }],
    };
    expect(parseSchemaImport(JSON.stringify(minimal)).queries[0]).toEqual({
      id: 'q2',
      name: 'bare',
      entityName: 'Order',
      target: 'base',
      pkValues: {},
      skOp: 'none',
      skValues: {},
      sk2Values: {},
    });
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

  it('rejects unrecognized schema entries, naming the offending index', () => {
    const json = JSON.stringify({ version: 2, schemas: [v2Fixture, { foo: 1 }] });
    expect(() => parseWorkspace(json)).toThrow(/schemas\[1\]/);
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
