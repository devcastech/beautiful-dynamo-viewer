import type { ComponentType } from 'react';

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
  gsis: GSI[];
  attributes: string[];
  role: string;
  priority: number;
  description: string;
  accessPatterns: string[];
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
