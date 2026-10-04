import { ConsumedCapacity } from "../../services/dynamo";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "../ui/Button";

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
      title={breakdown}
      aria-label={breakdown}
    >
      {units} RCU
    </span>
  );
};

/** Icon-only Prev/Next pager. */
export const Pager = ({
  onPrev,
  onNext,
}: {
  onPrev?: () => void;
  onNext?: () => void;
}) => {
  if (!onPrev && !onNext) return null;
  return (
    <div className="flex items-center">
      <IconButton label="Previous page" onClick={onPrev} disabled={!onPrev}>
        <ChevronLeft size={14} aria-hidden="true" />
      </IconButton>
      <IconButton label="Next page" onClick={onNext} disabled={!onNext}>
        <ChevronRight size={14} aria-hidden="true" />
      </IconButton>
    </div>
  );
};
