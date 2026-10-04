/** Render a key pattern string, highlighting <variables> in amber. */
export function PatternDisplay({ pattern }: { pattern: string }) {
  const parts = pattern.split(/(<[^>]+>)/g);
  return (
    <>
      {parts.map((part, i) => {
        const isVar = part.startsWith('<') && part.endsWith('>');
        return (
          <span key={i} className={isVar ? 'pattern-variable' : 'pattern-literal'}>
            {part}
          </span>
        );
      })}
    </>
  );
}

/** Compact variant for sidebar rows: {var} segments tinted with the accent, literals muted. */
export function PatternChipLabel({ label }: { label: string }) {
  const parts = label.split(/(\{[^}]+\})/g);
  return (
    <span>
      {parts.map((part, i) => {
        const isVar = part.startsWith('{') && part.endsWith('}');
        return (
          <span key={i} className={isVar ? 'text-accent/80' : 'text-muted'}>
            {part}
          </span>
        );
      })}
    </span>
  );
}
