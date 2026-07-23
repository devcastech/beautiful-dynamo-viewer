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

/** Compact variant for sidebar chips: {var} segments tinted with the group accent. */
export function PatternChipLabel({ label, accent }: { label: string; accent: string }) {
  const parts = label.split(/(\{[^}]+\})/g);
  return (
    <span>
      {parts.map((part, i) => {
        const isVar = part.startsWith('{') && part.endsWith('}');
        return (
          <span key={i} style={{ color: isVar ? accent : 'var(--text-muted)' }}>
            {part}
          </span>
        );
      })}
    </span>
  );
}
