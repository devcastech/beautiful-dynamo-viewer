export type PatternSegment =
  | { type: 'literal'; value: string }
  | { type: 'variable'; name: string };

export interface ParsedPattern {
  raw: string;
  variables: string[];
  segments: PatternSegment[];
  resolve(values: Record<string, string>): string;
}

export function parsePattern(pattern: string): ParsedPattern {
  const segments: PatternSegment[] = [];
  const variables: string[] = [];
  const regex = /<([^>]+)>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(pattern)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'literal', value: pattern.slice(lastIndex, match.index) });
    }
    const name = match[1];
    variables.push(name);
    segments.push({ type: 'variable', name });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < pattern.length) {
    segments.push({ type: 'literal', value: pattern.slice(lastIndex) });
  }

  return {
    raw: pattern,
    variables,
    segments,
    resolve(values: Record<string, string>): string {
      return segments
        .map((seg) => (seg.type === 'literal' ? seg.value : (values[seg.name] ?? '')))
        .join('');
    },
  };
}
