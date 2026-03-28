use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryParams {
    pub table:        String,
    pub pk_name:      String,         // e.g. "PK" o "GSI1PK"
    pub pk_value:     String,         // e.g. "USER#abc123"
    pub sk_name:      Option<String>, // None = no SK condition
    pub sk_condition: Option<SkCondition>,
    pub index_name:   Option<String>, // e.g. "GSI1", None = base table
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub items:     Vec<serde_json::Value>,
    pub truncated: bool,   // true si se alcanzó el límite de páginas/items
    pub count:     usize,
}

// El #[serde(tag = "op")] indica que el campo "op" del JSON determina el variante.
// El #[serde(content = "value")] indica que el payload va en el campo "value".
//
// JSON que llega desde el frontend:
//   { "op": "Eq",         "value": "ORDER#2024-01-15" }
//   { "op": "BeginsWith", "value": "ORDER#" }
//   { "op": "Between",    "value": { "from": "ORDER#2024-01", "to": "ORDER#2024-02" } }

#[derive(Debug, Deserialize)]
#[serde(tag = "op", content = "value")]
pub enum SkCondition {
    Eq(String),
    BeginsWith(String),
    Between(BetweenValues),
}

#[derive(Debug, Deserialize)]
pub struct BetweenValues {
    pub from: String,  // e.g. "ORDER#2024-01-01"
    pub to:   String,  // e.g. "ORDER#2024-01-31#ZZZZZZZ"
}