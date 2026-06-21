import type { Entity, TableSchema } from './types.ts';

/** Entities that share a PK pattern, i.e. items that live in the same partition. */
export interface PartitionGroup {
  id: string;
  partitionKey: string;
  entities: Entity[];
}

/** One accent color per partition group, assigned by group order.
   Medium-saturation hues that identify partitions without competing with the
   brighter, theme-driven --accent (which signals selection/action). */
export const GROUP_ACCENTS = [
  '#5EA2D9', '#5BBF9B', '#C08AD9', '#D9926B', '#8AA0C0', '#C9A24B',
];

export const accentForIndex = (i: number): string => GROUP_ACCENTS[i % GROUP_ACCENTS.length];

export function buildPartitionGroups(schema: TableSchema): PartitionGroup[] {
  const grouped = schema.entities.reduce((acc, entity) => {
    const key = entity.pk;
    if (!acc[key]) {
      acc[key] = { id: `${schema.id}:${key}`, partitionKey: key, entities: [] };
    }
    acc[key].entities.push(entity);
    return acc;
  }, {} as Record<string, PartitionGroup>);

  return Object.values(grouped)
    .map((group) => ({
      ...group,
      entities: [...group.entities].sort((left, right) => {
        const delta = left.priority - right.priority;
        return delta !== 0 ? delta : left.name.localeCompare(right.name);
      }),
    }))
    .sort((left, right) => {
      const sizeDelta = right.entities.length - left.entities.length;
      return sizeDelta !== 0 ? sizeDelta : left.partitionKey.localeCompare(right.partitionKey);
    });
}

/** Map of pk pattern → accent color, consistent with sidebar group order. */
export function accentByPartitionKey(groups: PartitionGroup[]): Record<string, string> {
  const map: Record<string, string> = {};
  groups.forEach((g, i) => {
    map[g.partitionKey] = accentForIndex(i);
  });
  return map;
}

/** "ORDER#<orderId>" → "ORDER#{orderId}" for compact chip labels. */
export const getPartitionChipLabel = (partitionKey: string) =>
  partitionKey.replace(/<([^>]+)>/g, '{$1}');
