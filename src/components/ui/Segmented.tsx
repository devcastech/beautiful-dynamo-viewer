interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
  /** Render labels in mono (for operators and other code-like values). */
  mono?: boolean;
}

/** Compact segmented control: one recessed track, the active option raised. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  mono = false,
}: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex p-0.5 gap-0.5 bg-inset rounded-md">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`py-0.5 px-2 rounded text-[12px] border-0 cursor-pointer transition-colors ${
              mono ? 'font-mono' : ''
            } ${
              active
                ? 'bg-elevated text-primary shadow-sm'
                : 'bg-transparent text-muted hover:text-secondary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
