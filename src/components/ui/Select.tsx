import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useDismiss } from '../../hooks/useDismiss.ts';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown on the trigger when no option matches `value`. */
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Extra classes for the trigger button (e.g. the amber target chip). */
  className?: string;
  align?: 'left' | 'right';
  /** Open the panel upward (e.g. when the trigger sits at the bottom of the screen). */
  openUp?: boolean;
  /** Force the search field; otherwise it appears automatically when options.length > 8. */
  searchable?: boolean;
  /** `ghost` drops the box until hover, for selectors that sit inline in a bar. */
  variant?: 'default' | 'ghost';
}

const TRIGGER_VARIANTS = {
  default: 'bg-elevated border-line',
  ghost: 'bg-transparent border-transparent hover:bg-hovered',
};

const SEARCH_THRESHOLD = 8;

/** Theme-consistent single-select dropdown; replaces the native <select> whose popup can't be styled. */
export function Select({
  value,
  onChange,
  options,
  placeholder = '-',
  disabled = false,
  ariaLabel,
  className = '',
  align = 'left',
  openUp = false,
  searchable,
  variant = 'default',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;
  // True when the active option changed via keyboard, so we only auto-scroll then
  // (auto-scrolling on hover would make the list jump under the cursor).
  const kbdNav = useRef(false);

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, query]);

  useDismiss(open, containerRef, () => setOpen(false));

  function openMenu() {
    if (disabled) return;
    setQuery('');
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
    kbdNav.current = true; // scroll the selected option into view on open
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function commit(option: SelectOption) {
    onChange(option.value);
    closeMenu();
  }

  // Move focus into the search field, or keep keyboard control on the trigger.
  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
  }, [open, showSearch]);

  // Keep the highlighted option in range as the filter narrows.
  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  // Keep the active option scrolled into view (keyboard nav + the selected one on open).
  useEffect(() => {
    if (!open || !kbdNav.current) return;
    document.getElementById(optionId(highlight))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, highlight]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      kbdNav.current = true;
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      kbdNav.current = true;
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = filtered[highlight];
      if (option) commit(option);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !showSearch ? optionId(highlight) : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-between gap-1.5 border rounded-md text-primary text-[12px] px-2 py-1 cursor-pointer outline-none focus:border-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${TRIGGER_VARIANTS[variant]} ${className}`}
      >
        <span className={`truncate ${selected ? '' : 'text-muted'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`shrink-0 opacity-70 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-30 min-w-full bg-elevated border border-line rounded-md shadow-xl py-1 animate-fade-in ${
            openUp ? 'bottom-full mb-1' : 'top-full mt-1'
          } ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {showSearch && (
            <div className="px-1.5 pb-1 mb-1 border-b border-line-dim">
              <div className="relative">
                <Search
                  size={12}
                  aria-hidden="true"
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Filter…"
                  role="combobox"
                  aria-expanded={open}
                  aria-controls={listId}
                  aria-activedescendant={optionId(highlight)}
                  aria-label="Filter options"
                  spellCheck={false}
                  className="w-full bg-inset border border-line-dim rounded text-primary text-[12px] pl-6 pr-2 py-1 outline-none focus:border-accent/50 transition-colors placeholder:text-muted"
                />
              </div>
            </div>
          )}

          <ul id={listId} role="listbox" aria-label={ariaLabel} className="max-h-70 overflow-y-auto m-0 px-1 list-none">
            {filtered.length === 0 ? (
              <li className="px-2 py-1.5 text-[12px] text-muted">No matches</li>
            ) : (
              filtered.map((option, i) => {
                const isSelected = option.value === value;
                const isHighlighted = i === highlight;
                return (
                  <li key={option.value} id={optionId(i)} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseEnter={() => {
                        kbdNav.current = false;
                        setHighlight(i);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        commit(option);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-[12px] cursor-pointer border-0 transition-colors ${
                        isSelected
                          ? 'bg-hovered text-primary font-medium'
                          : isHighlighted
                            ? 'bg-hovered/60 text-primary'
                            : 'bg-transparent text-secondary'
                      }`}
                    >
                      <Check
                        size={12}
                        aria-hidden="true"
                        className={`shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                      />
                      <span className="truncate">{option.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
