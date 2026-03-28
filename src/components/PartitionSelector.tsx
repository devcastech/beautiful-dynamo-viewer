import type { PartitionGroup } from '../types/schema.ts';
import { getPartitionChipLabel } from '../utils/warehouse.ts';

interface PartitionSelectorProps {
  groups: PartitionGroup[];
  activeGroupIdx: number;
  onSelectGroup: (index: number) => void;
}

export function PartitionSelector({
  groups,
  activeGroupIdx,
  onSelectGroup,
}: PartitionSelectorProps) {
  return (
    <div className="flex gap-0.5 overflow-x-auto border-b border-slate-200 pb-px mt-6">
      {groups.map((group, index) => {
        const isActive = activeGroupIdx === index;

        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelectGroup(index)}
            className={`shrink-0 px-3 py-2 text-sm transition-colors -mb-px border-b-2 ${
              isActive
                ? 'border-slate-900 text-slate-900 font-medium'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {getPartitionChipLabel(group.partitionKey)}
          </button>
        );
      })}
    </div>
  );
}
