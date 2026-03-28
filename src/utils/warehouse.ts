import { Box, LayoutGrid, Package, ShoppingCart, Tag, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import type { DynamoTable, Entity, PartitionGroup, ShelfTheme } from '../types/schema.ts';

type ColorTokens = Omit<ShelfTheme, 'title' | 'icon'>;

const PALETTE: ColorTokens[] = [
  {
    iconWrap: 'border-amber-200 bg-amber-50',
    iconColor: 'text-amber-700',
    panelGradient: 'from-amber-50 via-orange-50/60 to-white',
    pkPanel: 'border-amber-200 bg-amber-100/70 text-amber-950',
    badge: 'border-amber-200 bg-amber-100 text-amber-900',
    activeCard:
      'border-amber-300 bg-amber-50 text-slate-950 shadow-[0_30px_70px_-45px_rgba(180,83,9,0.55)]',
  },
  {
    iconWrap: 'border-emerald-200 bg-emerald-50',
    iconColor: 'text-emerald-700',
    panelGradient: 'from-emerald-50 via-teal-50/50 to-white',
    pkPanel: 'border-emerald-200 bg-emerald-100/70 text-emerald-950',
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-900',
    activeCard:
      'border-emerald-300 bg-emerald-50 text-slate-950 shadow-[0_30px_70px_-45px_rgba(5,150,105,0.5)]',
  },
  {
    iconWrap: 'border-sky-200 bg-sky-50',
    iconColor: 'text-sky-700',
    panelGradient: 'from-sky-50 via-cyan-50/50 to-white',
    pkPanel: 'border-sky-200 bg-sky-100/70 text-sky-950',
    badge: 'border-sky-200 bg-sky-100 text-sky-900',
    activeCard:
      'border-sky-300 bg-sky-50 text-slate-950 shadow-[0_30px_70px_-45px_rgba(2,132,199,0.45)]',
  },
  {
    iconWrap: 'border-orange-200 bg-orange-50',
    iconColor: 'text-orange-700',
    panelGradient: 'from-orange-50 via-amber-50/50 to-white',
    pkPanel: 'border-orange-200 bg-orange-100/70 text-orange-950',
    badge: 'border-orange-200 bg-orange-100 text-orange-900',
    activeCard:
      'border-orange-300 bg-orange-50 text-slate-950 shadow-[0_30px_70px_-45px_rgba(234,88,12,0.5)]',
  },
  {
    iconWrap: 'border-violet-200 bg-violet-50',
    iconColor: 'text-violet-700',
    panelGradient: 'from-violet-50 via-purple-50/50 to-white',
    pkPanel: 'border-violet-200 bg-violet-100/70 text-violet-950',
    badge: 'border-violet-200 bg-violet-100 text-violet-900',
    activeCard:
      'border-violet-300 bg-violet-50 text-slate-950 shadow-[0_30px_70px_-45px_rgba(124,58,237,0.4)]',
  },
  {
    iconWrap: 'border-slate-200 bg-slate-50',
    iconColor: 'text-slate-700',
    panelGradient: 'from-slate-50 via-white to-slate-100/50',
    pkPanel: 'border-slate-200 bg-slate-100/80 text-slate-900',
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
    activeCard:
      'border-slate-300 bg-slate-50 text-slate-950 shadow-[0_30px_70px_-45px_rgba(15,23,42,0.35)]',
  },
];

const ICONS: ComponentType<{ className?: string }>[] = [
  Box,
  Tag,
  Users,
  ShoppingCart,
  Package,
  LayoutGrid,
];

const hashDomain = (domain: string): number => {
  let h = 0;
  for (let i = 0; i < domain.length; i++) {
    h = (h * 31 + domain.charCodeAt(i)) >>> 0;
  }
  return h;
};

const formatDomainTitle = (domain: string): string =>
  domain.charAt(0).toUpperCase() + domain.slice(1).toLowerCase();

export const getShelfTheme = (domain: string): ShelfTheme => {
  const h = hashDomain(domain);
  return {
    title: formatDomainTitle(domain),
    icon: ICONS[h % ICONS.length],
    ...PALETTE[h % PALETTE.length],
  };
};

const getPartitionDomain = (table: DynamoTable, entity: Entity): string => {
  if (table.domain) return table.domain.toUpperCase();

  const [segment] = entity.pk.split('#');
  const normalized = segment.replace(/[<>]/g, '').trim().toUpperCase();
  return normalized || entity.name.toUpperCase();
};

export const buildPartitionGroups = (table: DynamoTable): PartitionGroup[] => {
  const grouped = table.entities.reduce((acc, entity) => {
    const key = entity.pk;

    if (!acc[key]) {
      acc[key] = {
        id: `${table.table}:${key}`,
        domain: getPartitionDomain(table, entity),
        partitionKey: key,
        entities: [],
      };
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
};

export const getPartitionChipLabel = (partitionKey: string) =>
  partitionKey.replace(/<([^>]+)>/g, '{$1}');
