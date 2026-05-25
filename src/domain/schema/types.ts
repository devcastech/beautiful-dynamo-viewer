import type { ComponentType } from 'react';

export type SkOp = 'Eq' | 'BeginsWith' | 'Between' | 'none';

export interface SavedQuery {
  id: string;
  name: string;
  target: 'base' | string;  // 'base' or GSI name
  pkValues: Record<string, string>;
  skOp: SkOp;
  skValues: Record<string, string>;
  sk2Values: Record<string, string>;
}

export interface GSI {
  name: string;
  pk: string;
  sk: string;
  pkAttr: string;
  skAttr?: string;
}

export interface Entity {
  name: string;
  pk: string;
  sk: string;
  pkAttr?: string; // real base-table PK attribute name (default "PK")
  skAttr?: string; // real base-table SK attribute name (default "SK")
  gsis: GSI[];
  attributes: string[];
  role: string;
  priority: number;
  description: string;
  savedQueries: SavedQuery[];
}

export interface DynamoTable {
  name: string;   // user-defined display label (shown in selector)
  table: string;  // actual DynamoDB table name (connection param)
  domain?: string;
  story: string;
  entities: Entity[];
}

export interface SchemaData {
  tables: DynamoTable[];
}

export interface PartitionGroup {
  id: string;
  domain: string;
  partitionKey: string;
  entities: Entity[];
}

export interface ShelfTheme {
  title: string;
  icon: ComponentType<{ className?: string }>;
  iconWrap: string;
  iconColor: string;
  panelGradient: string;
  pkPanel: string;
  badge: string;
  activeCard: string;
}
