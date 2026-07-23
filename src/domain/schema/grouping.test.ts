import { describe, expect, it } from 'vitest';
import { accentByPartitionKey, buildPartitionGroups, getPartitionChipLabel } from './grouping.ts';
import type { Entity, TableSchema } from './types.ts';

function entity(name: string, pk: string, priority = 1): Entity {
  return { name, pk, sk: name.toUpperCase(), description: '', priority, attributes: [], indexPatterns: [] };
}

const schema: TableSchema = {
  version: 2,
  id: 's1',
  name: 'Shop',
  tableName: 'ShopTable',
  description: '',
  keys: { pk: 'PK', sk: 'SK' },
  indexes: [],
  entities: [
    entity('OrderHistory', 'ORDER#<orderId>', 3),
    entity('Order', 'ORDER#<orderId>', 1),
    entity('Shipment', 'ORDER#<orderId>', 2),
    entity('User', 'USER#<userId>'),
  ],
  queries: [],
};

describe('buildPartitionGroups', () => {
  const groups = buildPartitionGroups(schema);

  it('groups entities by pk pattern, biggest group first', () => {
    expect(groups.map((g) => g.partitionKey)).toEqual(['ORDER#<orderId>', 'USER#<userId>']);
    expect(groups[0].entities).toHaveLength(3);
  });

  it('orders entities by priority then name', () => {
    expect(groups[0].entities.map((e) => e.name)).toEqual(['Order', 'Shipment', 'OrderHistory']);
  });

  it('builds stable group ids from schema id + pk', () => {
    expect(groups[0].id).toBe('s1:ORDER#<orderId>');
  });
});

describe('accentByPartitionKey', () => {
  it('assigns one accent per group in order', () => {
    const map = accentByPartitionKey(buildPartitionGroups(schema));
    expect(Object.keys(map)).toHaveLength(2);
    expect(map['ORDER#<orderId>']).not.toBe(map['USER#<userId>']);
  });
});

describe('getPartitionChipLabel', () => {
  it('converts <var> to {var}', () => {
    expect(getPartitionChipLabel('ORDER#<orderId>')).toBe('ORDER#{orderId}');
  });
});
