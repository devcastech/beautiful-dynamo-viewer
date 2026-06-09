import { describe, expect, it } from 'vitest';
import {
  isLegacySchema,
  isTableSchema,
  migrateLegacySchema,
  parseSchemaImport,
  parseWorkspace,
  serializeWorkspace,
  type LegacyTable,
} from './migrate.ts';
import { seedSchemas } from '../../data/seed.ts';

const legacyFixture: LegacyTable = {
  name: 'Shop',
  table: 'ShopTable-dev',
  story: 'A shop table.',
  entities: [
    {
      name: 'Order',
      pk: 'ORDER#<orderId>',
      sk: 'ORDER',
      pkAttr: 'pk',
      skAttr: 'sk',
      priority: 1,
      gsis: [
        { name: 'GSI1', pk: 'ORDERS', sk: 'ORDER#<orderId>', pkAttr: 'GSI1PK', skAttr: 'GSI1SK' },
      ],
      attributes: ['id', 'total'],
      description: 'An order.',
      savedQueries: [
        {
          id: 'q1',
          name: 'List orders',
          target: 'GSI1',
          pkValues: {},
          skOp: 'none',
          skValues: {},
          sk2Values: {},
        },
      ],
    },
    {
      name: 'OrderLine',
      pk: 'ORDER#<orderId>',
      sk: 'LINE#<lineId>',
      gsis: [
        // Same GSI declared again by another entity, with a different pattern.
        { name: 'GSI1', pk: 'LINES', sk: 'LINE#<lineId>', pkAttr: 'GSI1PK', skAttr: 'GSI1SK' },
        { name: 'GSI2', pk: 'SKU#<sku>', sk: 'LINE#<lineId>', pkAttr: 'GSI2PK', skAttr: 'GSI2SK' },
      ],
      attributes: ['sku', 'qty'],
    },
  ],
};

describe('migrateLegacySchema', () => {
  const migrated = migrateLegacySchema(legacyFixture);

  it('maps top-level fields and stamps version + id', () => {
    expect(migrated.version).toBe(2);
    expect(migrated.id).toBeTruthy();
    expect(migrated.name).toBe('Shop');
    expect(migrated.tableName).toBe('ShopTable-dev');
    expect(migrated.description).toBe('A shop table.');
  });

  it('lifts base key attributes from the first entity that declares them', () => {
    expect(migrated.keys).toEqual({ pk: 'pk', sk: 'sk' });
  });

  it('defaults keys to PK/SK when no entity declares them', () => {
    const noKeys = migrateLegacySchema({
      ...legacyFixture,
      entities: legacyFixture.entities.map((e) => ({ ...e, pkAttr: undefined, skAttr: undefined })),
    });
    expect(noKeys.keys).toEqual({ pk: 'PK', sk: 'SK' });
  });

  it('collects table-level index definitions by name, first occurrence wins', () => {
    expect(migrated.indexes).toEqual([
      { name: 'GSI1', pkAttr: 'GSI1PK', skAttr: 'GSI1SK' },
      { name: 'GSI2', pkAttr: 'GSI2PK', skAttr: 'GSI2SK' },
    ]);
  });

  it('keeps per-entity index patterns', () => {
    expect(migrated.entities[0].indexPatterns).toEqual([
      { index: 'GSI1', pk: 'ORDERS', sk: 'ORDER#<orderId>' },
    ]);
    expect(migrated.entities[1].indexPatterns).toEqual([
      { index: 'GSI1', pk: 'LINES', sk: 'LINE#<lineId>' },
      { index: 'GSI2', pk: 'SKU#<sku>', sk: 'LINE#<lineId>' },
    ]);
  });

  it('flattens saved queries to schema level with entity reference', () => {
    expect(migrated.queries).toEqual([
      expect.objectContaining({ id: 'q1', name: 'List orders', entityName: 'Order' }),
    ]);
  });

  it('fills defaults for optional legacy fields', () => {
    const line = migrated.entities[1];
    expect(line.description).toBe('');
    expect(line.priority).toBe(1);
  });
});

describe('format detection', () => {
  it('detects legacy schemas (no version field)', () => {
    expect(isLegacySchema(legacyFixture)).toBe(true);
    expect(isLegacySchema(migrateLegacySchema(legacyFixture))).toBe(false);
  });

  it('detects v2 schemas', () => {
    expect(isTableSchema(migrateLegacySchema(legacyFixture))).toBe(true);
    expect(isTableSchema(legacyFixture)).toBe(false);
  });
});

describe('parseSchemaImport', () => {
  it('accepts a v1 file and migrates it', () => {
    const schema = parseSchemaImport(JSON.stringify(legacyFixture));
    expect(schema.version).toBe(2);
    expect(schema.tableName).toBe('ShopTable-dev');
  });

  it('accepts a v2 file as-is', () => {
    const v2 = migrateLegacySchema(legacyFixture);
    const schema = parseSchemaImport(JSON.stringify(v2));
    expect(schema).toEqual(v2);
  });

  it('assigns an id when a v2 file lacks one', () => {
    const v2 = { ...migrateLegacySchema(legacyFixture), id: '' };
    expect(parseSchemaImport(JSON.stringify(v2)).id).toBeTruthy();
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
    const schemas = [migrateLegacySchema(legacyFixture)];
    expect(parseWorkspace(serializeWorkspace(schemas))).toEqual(schemas);
  });

  it('migrates legacy entries found inside a workspace file', () => {
    const json = JSON.stringify({ version: 1, schemas: [legacyFixture] });
    const [schema] = parseWorkspace(json);
    expect(schema.version).toBe(2);
    expect(schema.tableName).toBe('ShopTable-dev');
  });

  it('rejects files without a schemas array', () => {
    expect(() => parseWorkspace('{"version":2}')).toThrow(/schemas array/);
    expect(() => parseWorkspace('garbage')).toThrow(/valid JSON/);
  });
});

describe('seed data', () => {
  it('migrates cleanly to v2', () => {
    const schemas = seedSchemas();
    expect(schemas).toHaveLength(3);

    const cedi = schemas[0];
    expect(cedi.name).toBe('CediStore');
    expect(cedi.tableName).toBe('CediStoreTable-dev');
    expect(cedi.entities).toHaveLength(6);
    expect(cedi.indexes.map((i) => i.name)).toEqual(['GSI1', 'GSI2', 'GSI3']);
    expect(cedi.queries.length).toBeGreaterThan(0);
    expect(cedi.queries.every((q) => cedi.entities.some((e) => e.name === q.entityName))).toBe(true);

    const dogFarm = schemas[2];
    expect(dogFarm.indexes).toEqual([
      { name: 'AdminReservationsIndex', pkAttr: 'type', skAttr: 'GSI1_SK' },
    ]);
  });
});
