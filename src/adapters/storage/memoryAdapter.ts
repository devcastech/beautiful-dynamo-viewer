import type { DynamoTable } from '../../domain/schema/types.ts';
import type { SchemaRepository } from '../../ports/SchemaRepository.ts';

export function memoryAdapter(initial: DynamoTable[]): SchemaRepository {
  let store = initial;
  return {
    load: () => store,
    save: (schemas) => {
      store = schemas;
    },
  };
}
