Read the files provided in $ARGUMENTS and generate a schema JSON for this project. The output is the legacy (v1) schema format, which the app's *Import from JSON* accepts and migrates automatically — save it to a `.json` file and import it from the top bar.

## What to do

1. Read every file listed in $ARGUMENTS
2. Identify DynamoDB tables used (table names in PutCommand / QueryCommand / GetCommand / UpdateCommand calls)
3. For each entity, extract:
   - The PK and SK patterns (e.g. `ORDER#<orderId>`, `SHIPMENT#<date>#<num>`)
   - GSIs with their pk/sk patterns and the real attribute names (GSI1PK, GSI1SK, etc.)
   - Attribute names written or read
   - Access patterns (every Query / GetItem / Scan call, described in plain English)
4. Group entities that share the same PK pattern into a `DynamoTable` entry

## Output rules — STRICT

- Output ONLY a valid JSON object. Nothing else — no explanation, no markdown prose, no headers, no analysis.
- Start your response with `{` and end with `}`. No text before or after.
- Do NOT wrap in markdown fences (no ```json or ```typescript).
- All strings must use double quotes (valid JSON).
- If a value cannot be inferred from the code, use the string `"TODO"`.

## Exact JSON shape

```json
{
  "tables": [
    {
      "table": "ExactTableName",
      "domain": "UPPER_CASE_DOMAIN",
      "story": "One sentence: what lives here and how it is read.",
      "entities": [
        {
          "name": "EntityName",
          "pk": "PREFIX#<camelCaseVar>",
          "sk": "PREFIX#<camelCaseVar>",
          "role": "Short label",
          "priority": 1,
          "gsis": [
            {
              "name": "GSI1",
              "pk": "PREFIX#<var>",
              "sk": "PREFIX#<var>",
              "pkAttr": "GSI1PK",
              "skAttr": "GSI1SK"
            }
          ],
          "attributes": ["id", "field1", "field2"],
          "description": "What this record is and key design decisions.",
          "accessPatterns": [
            "Verb + entity + condition matching the actual query in code"
          ]
        }
      ]
    }
  ]
}
```

## Field rules

- `domain`: omit the field entirely if there is no logical sub-domain
- `gsis`: always include the field; use `[]` if the entity has no GSIs
- `gsis[].skAttr`: omit if the GSI has no sort key
- `priority`: 1 = primary record for this PK, 2+ = secondary/audit records sharing the same PK
- `pk` / `sk`: use `PREFIX#<camelCaseVar>` for variables, bare string for constants (e.g. `"ORDER"`, `"__META__"`)
- `attributes`: all top-level attribute names found written or read in the code, no duplicates

## Variable notation

- Single variable: `ORDER#<orderId>`
- Multiple segments: `STATUS#<status>#<createdAt>#<orderId>`
- Constant only: `ORDER`, `__META__`
