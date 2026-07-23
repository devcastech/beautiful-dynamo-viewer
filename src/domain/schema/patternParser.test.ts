import { describe, expect, it } from 'vitest';
import { parsePattern } from './patternParser.ts';

describe('parsePattern', () => {
  it('parses a literal-only pattern', () => {
    const p = parsePattern('ORDER');
    expect(p.variables).toEqual([]);
    expect(p.segments).toEqual([{ type: 'literal', value: 'ORDER' }]);
    expect(p.resolve({})).toBe('ORDER');
  });

  it('parses variables between literals', () => {
    const p = parsePattern('STATUS#<status>#<createdAt>#<orderId>');
    expect(p.variables).toEqual(['status', 'createdAt', 'orderId']);
    expect(p.resolve({ status: 'open', createdAt: '2024', orderId: '7' })).toBe(
      'STATUS#open#2024#7',
    );
  });

  it('parses a pattern that starts with a variable', () => {
    const p = parsePattern('<userId>');
    expect(p.segments).toEqual([{ type: 'variable', name: 'userId' }]);
    expect(p.resolve({ userId: 'u1' })).toBe('u1');
  });

  it('resolves missing values as empty strings', () => {
    expect(parsePattern('ORDER#<orderId>').resolve({})).toBe('ORDER#');
  });

  it('keeps the raw pattern', () => {
    expect(parsePattern('A#<b>').raw).toBe('A#<b>');
  });
});
