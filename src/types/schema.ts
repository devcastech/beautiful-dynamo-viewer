// Re-export all types from the domain layer.
// Import from here in UI components to avoid coupling to domain paths.
export type {
  GSI,
  Entity,
  DynamoTable,
  SchemaData,
  PartitionGroup,
  ShelfTheme,
} from '../domain/schema/types.ts';
