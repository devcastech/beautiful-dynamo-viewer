Read the files provided in $ARGUMENTS and generate a schema JSON for this project. The output is the app's current schema format (`version: 2`), which *Import from JSON* validates strictly — save it to a `.json` file and import it from the top bar.

## What to do

1. Read every file listed in $ARGUMENTS
2. Identify DynamoDB tables used (table names in PutCommand / QueryCommand / GetCommand / UpdateCommand calls)
3. For each entity, extract:
   - The PK and SK patterns (e.g. `ORDER#<orderId>`, `SHIPMENT#<date>#<num>`)
   - What the entity writes into each GSI (pk/sk patterns), and the GSI's real attribute names (GSI1PK, GSI1SK, etc.)
   - Attribute names written or read
   - Access patterns (every Query / GetItem / Scan call) — summarize them in the entity `description`
4. One schema object describes one table. If more than one table is found, produce one JSON file per table.

## Output rules — STRICT

- Output ONLY a valid JSON object. Nothing else — no explanation, no markdown prose, no headers, no analysis.
- Start your response with `{` and end with `}`. No text before or after.
- Do NOT wrap in markdown fences (no ```json or ```typescript).
- All strings must use double quotes (valid JSON).
- If a value cannot be inferred from the code, use the string `"TODO"`.

## Exact JSON shape

```json
{
  "version": 2,
  "name": "display-name",
  "tableName": "ExactTableName",
  "description": "One sentence: what lives here and how it is read.",
  "keys": { "pk": "PK", "sk": "SK" },
  "indexes": [
    { "name": "GSI1", "pkAttr": "GSI1PK", "skAttr": "GSI1SK" }
  ],
  "entities": [
    {
      "name": "EntityName",
      "pk": "PREFIX#<camelCaseVar>",
      "sk": "PREFIX#<camelCaseVar>",
      "priority": 1,
      "attributes": ["id", "field1", "field2"],
      "indexPatterns": [
        { "index": "GSI1", "pk": "PREFIX#<var>", "sk": "PREFIX#<var>" }
      ],
      "description": "What this record is, key design decisions, and its access patterns in plain English."
    }
  ],
  "queries": []
}
```

## Field rules

- `version`: always the literal number `2`
- `name`: short display label for the schema (kebab-case is fine); `tableName` is the real table
- `keys`: the physical base-table key attribute names (usually `PK`/`SK`)
- `indexes`: every GSI referenced by any entity, defined once here with its physical attribute names; `skAttr` may be omitted if the GSI has no sort key
- `indexPatterns`: per entity, what it writes into each GSI; `index` must match an entry in `indexes`; use `[]` if the entity writes to none
- `priority`: 1 = primary record for this PK, 2+ = secondary/audit records sharing the same PK
- `pk` / `sk`: use `PREFIX#<camelCaseVar>` for variables, bare string for constants (e.g. `"ORDER"`, `"__META__"`)
- `attributes`: all top-level attribute names found written or read in the code, no duplicates
- `queries`: always `[]` — saved queries are created in the app

## Variable notation

- Single variable: `ORDER#<orderId>`
- Multiple segments: `STATUS#<status>#<createdAt>#<orderId>`
- Constant only: `ORDER`, `__META__`
