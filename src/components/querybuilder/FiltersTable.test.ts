import { describe, expect, it } from 'vitest';
import {
  emptyFilter,
  fromQueryFilters,
  isFilterRowValid,
  toQueryFilters,
  type FilterRow,
} from './FiltersTable.tsx';
import type { QueryFilter } from '../../domain/schema/types.ts';

const row = (over: Partial<FilterRow>): FilterRow => ({ ...emptyFilter(), ...over });

describe('toQueryFilters', () => {
  it('excludes disabled and unnamed rows', () => {
    const rows = [
      row({ name: 'status', value: 'ACTIVE' }),
      row({ name: 'ignored', value: 'x', enabled: false }),
      row({ name: '   ', value: 'y' }),
    ];
    expect(toQueryFilters(rows)).toEqual([
      { name: 'status', valueType: 'string', condition: { op: 'Eq', value: 'ACTIVE' } },
    ]);
  });

  it('shapes Between rows with from/to and trims names', () => {
    const rows = [row({ name: ' total ', op: 'Between', valueType: 'number', from: '10', to: '99' })];
    expect(toQueryFilters(rows)).toEqual([
      {
        name: 'total',
        valueType: 'number',
        condition: { op: 'Between', value: { from: '10', to: '99' } },
      },
    ]);
  });
});

describe('fromQueryFilters', () => {
  it('round-trips through toQueryFilters', () => {
    const filters: QueryFilter[] = [
      { name: 'status', valueType: 'string', condition: { op: 'BeginsWith', value: 'SHIP' } },
      { name: 'total', valueType: 'number', condition: { op: 'Between', value: { from: '1', to: '5' } } },
      { name: 'notes', valueType: 'string', condition: { op: 'Contains', value: 'urgent' } },
    ];
    expect(toQueryFilters(fromQueryFilters(filters))).toEqual(filters);
  });

  it('hydrates rows as enabled with the untouched value slots empty', () => {
    const [r] = fromQueryFilters([
      { name: 'total', valueType: 'number', condition: { op: 'Between', value: { from: '1', to: '5' } } },
    ]);
    expect(r.enabled).toBe(true);
    expect(r.from).toBe('1');
    expect(r.to).toBe('5');
    expect(r.value).toBe('');
  });
});

describe('isFilterRowValid', () => {
  it('accepts string filters regardless of value', () => {
    expect(isFilterRowValid(row({ name: 'a', value: 'not a number' }))).toBe(true);
  });

  it('rejects a number Eq with a non-numeric value', () => {
    expect(isFilterRowValid(row({ name: 'a', valueType: 'number', value: 'abc' }))).toBe(false);
    expect(isFilterRowValid(row({ name: 'a', valueType: 'number', value: '' }))).toBe(false);
    expect(isFilterRowValid(row({ name: 'a', valueType: 'number', value: '12.5' }))).toBe(true);
  });

  it('rejects a number Between when either bound is non-numeric', () => {
    const base = { name: 'a', valueType: 'number', op: 'Between' } as const;
    expect(isFilterRowValid(row({ ...base, from: '1', to: 'x' }))).toBe(false);
    expect(isFilterRowValid(row({ ...base, from: '1', to: '2' }))).toBe(true);
  });

  it('ignores rows that will not be sent (disabled or unnamed)', () => {
    expect(isFilterRowValid(row({ name: 'a', valueType: 'number', value: 'x', enabled: false }))).toBe(true);
    expect(isFilterRowValid(row({ name: '', valueType: 'number', value: 'x' }))).toBe(true);
  });

  it('does not constrain begins_with/contains, which always query as strings', () => {
    expect(isFilterRowValid(row({ name: 'a', valueType: 'number', op: 'BeginsWith', value: 'x' }))).toBe(true);
  });
});
