import type { DynamoTable } from '../domain/schema/types.ts';

export interface SchemaRepository {
  load(): DynamoTable[];
  save(schemas: DynamoTable[]): void;
}
