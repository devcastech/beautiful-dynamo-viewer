import { startTransition, useState } from 'react';
import { AppSidebar } from './components/AppSidebar.tsx';
import { PartitionSelector } from './components/PartitionSelector.tsx';
import { PartitionShelf } from './components/PartitionShelf.tsx';
import { TableHeader } from './components/TableHeader.tsx';
import { schemaData } from './data/schema.ts';
import { buildPartitionGroups } from './utils/warehouse.ts';

export default function App() {
  const [activeTableIdx, setActiveTableIdx] = useState(0);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [selectedEntityByGroup, setSelectedEntityByGroup] = useState<Record<string, string>>({});
  const activeTable = schemaData.tables[activeTableIdx];
  const partitionGroups = buildPartitionGroups(activeTable);
  const activeGroup = partitionGroups[activeGroupIdx] ?? partitionGroups[0];
  const totalGsis = activeTable.entities.reduce((total, entity) => total + entity.gsis.length, 0);
  const totalAccessPatterns = activeTable.entities.reduce(
    (total, entity) => total + entity.accessPatterns.length,
    0,
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
        <AppSidebar
          tables={schemaData.tables}
          activeTableIdx={activeTableIdx}
          onSelectTable={(index) =>
            startTransition(() => {
              setActiveTableIdx(index);
              setActiveGroupIdx(0);
            })
          }
        />

        <main className="border-l border-slate-200 px-6 py-8 sm:px-10 xl:px-12">
          <TableHeader
            activeTable={activeTable}
            partitionCount={partitionGroups.length}
            totalGsis={totalGsis}
            totalAccessPatterns={totalAccessPatterns}
          />

          <PartitionSelector
            groups={partitionGroups}
            activeGroupIdx={activeGroupIdx}
            onSelectGroup={(index) => startTransition(() => setActiveGroupIdx(index))}
          />

          <div className="mt-6">
            {activeGroup && (
              <PartitionShelf
                key={activeGroup.id}
                group={activeGroup}
                selectedEntityName={selectedEntityByGroup[activeGroup.id]}
                onSelect={(groupId, entityName) => {
                  startTransition(() => {
                    setSelectedEntityByGroup((current) => ({
                      ...current,
                      [groupId]: entityName,
                    }));
                  });
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
