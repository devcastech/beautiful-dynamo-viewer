import { ConsumedCapacity } from "../../services/dynamo";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const CapacityUsage = ({
  consumedCapacity,
}: {
  consumedCapacity: ConsumedCapacity | undefined;
}) => {
  const units = consumedCapacity?.capacity_units;
  if (!consumedCapacity || units === undefined || units === null) return null;

  const breakdown = [
    `Total: ${units} RCU`,
    consumedCapacity.table?.capacity_units !== null &&
    consumedCapacity.table?.capacity_units !== undefined
      ? `Table: ${consumedCapacity.table.capacity_units} RCU`
      : null,
    ...Object.entries(consumedCapacity.global_secondary_indexes ?? {})
      .filter(([, capacity]) => capacity.capacity_units !== null)
      .map(([name, capacity]) => `GSI ${name}: ${capacity.capacity_units} RCU`),
    ...Object.entries(consumedCapacity.local_secondary_indexes ?? {})
      .filter(([, capacity]) => capacity.capacity_units !== null)
      .map(([name, capacity]) => `LSI ${name}: ${capacity.capacity_units} RCU`),
  ]
    .filter((value): value is string => value !== null)
    .join("\n");

  return (
    <span
      className="text-muted ml-1.5"
      title={breakdown}
      aria-label={breakdown}
    >
      · {units} RCU
    </span>
  );
};

/** Compact Prev/Next pager, styled like the Table/JSON toggle group. */
export const Pager = ({
  onPrev,
  onNext,
}: {
  onPrev?: () => void;
  onNext?: () => void;
}) => {
  if (!onPrev && !onNext) return null;
  return (
    <div className="flex border border-line rounded overflow-hidden">
      <PagerBtn onClick={onPrev} disabled={!onPrev} label="Previous page">
        <ChevronLeft size={13} aria-hidden="true" />
        Prev
      </PagerBtn>
      <PagerBtn
        onClick={onNext}
        disabled={!onNext}
        label="Next page"
        borderLeft
      >
        Next
        <ChevronRight size={13} aria-hidden="true" />
      </PagerBtn>
    </div>
  );
};

function PagerBtn({
  onClick,
  disabled,
  label,
  borderLeft = false,
  children,
}: {
  onClick?: () => void;
  disabled: boolean;
  label: string;
  borderLeft?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex items-center gap-1 py-0.75 px-2 font-mono text-xs bg-transparent text-muted cursor-pointer transition-colors hover:text-secondary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
        borderLeft ? "border-0 border-l border-line" : "border-0"
      }`}
    >
      {children}
    </button>
  );
}

export const ViewBtn = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`py-0.75 px-2.25 font-mono text-xs border-0 cursor-pointer transition-all ${
        active
          ? "bg-accent text-canvas"
          : "bg-transparent text-muted hover:text-secondary"
      }`}
    >
      {children}
    </button>
  );
};
