use crate::error::AppError;
use aws_sdk_dynamodb::error::ProvideErrorMetadata;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::Mutex;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryParams {
    pub table: String,
    pub pk_name: String,         // e.g. "PK" o "GSI1PK"
    pub pk_value: String,        // e.g. "USER#abc123"
    pub sk_name: Option<String>, // None = no SK condition
    pub sk_condition: Option<SkCondition>,
    pub index_name: Option<String>, // e.g. "GSI1", None = base table
    pub limit: Option<i32>,         // items per page, default 10
    pub exclusive_start_key: Option<serde_json::Value>, // pagination cursor
    pub filters: Option<Vec<Filter>>,
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub items: Vec<serde_json::Value>,
    pub truncated: bool, // true si se alcanzó el límite de páginas/items
    pub count: usize,
    pub last_key: Option<serde_json::Value>,
}

// El #[serde(tag = "op")] indica que el campo "op" del JSON determina el variante.
// El #[serde(content = "value")] indica que el payload va en el campo "value".
//
// JSON que llega desde el frontend:
//   { "op": "Eq",         "value": "ORDER#2024-01-15" }
//   { "op": "BeginsWith", "value": "ORDER#" }
//   { "op": "Between",    "value": { "from": "ORDER#2024-01", "to": "ORDER#2024-02" } }

#[derive(Debug, Deserialize)]
pub struct BetweenValues {
    pub from: String, // e.g. "ORDER#2024-01-01"
    pub to: String,   // e.g. "ORDER#2024-01-31#ZZZZZZZ"
}

#[derive(Debug, Deserialize)]
#[serde(tag = "op", content = "value")]
pub enum SkCondition {
    Eq(String),
    BeginsWith(String),
    Between(BetweenValues),
}

#[derive(Debug, Deserialize)]
#[serde(tag = "op", content = "value")]
pub enum FilterOp {
    Eq(String),
    BeginsWith(String),
    Contains(String),
    Between(BetweenValues),
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum ValueType {
    #[default]
    String,
    Number,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Filter {
    pub name: String,
    #[serde(default)]
    pub value_type: ValueType,
    pub condition: FilterOp,
}

// see:
// - https://docs.aws.amazon.com/sdk-for-rust/latest/dg/rust_dynamodb_code_examples.html
// - https://github.com/awsdocs/aws-doc-sdk-examples/tree/main/rustv1/examples/dynamodb
fn to_attr(value: &str, t: &ValueType) -> AttributeValue {
    match t {
        ValueType::String => AttributeValue::S(value.to_string()),
        ValueType::Number => AttributeValue::N(value.to_string()),
    }
}
#[tauri::command]
pub async fn query_table(
    client: tauri::State<'_, Mutex<Client>>,
    params: QueryParams,
) -> Result<QueryResult, AppError> {
    println!("query_table: params={:?}", params);
    // .lock().await obtiene acceso exclusivo al Client.
    // Devuelve un MutexGuard<Client> — cuando sale del scope se libera el lock.
    // El `client` de aquí en adelante es el Client real, no el Mutex.
    let client = client.lock().await;

    // ── 1. Construir los mapas de expression ─────────────────────────────────
    //
    // DynamoDB tiene ~600 reserved words (STATUS, NAME, DATE, etc.).
    // Si pk_name fuera "STATUS", la query fallaría con un error críptico.
    // La solución: nunca usar los nombres reales directamente en la expression.
    // Usar placeholders (#pk, #sk) y mapearlos por separado.
    //
    //   KeyConditionExpression:      "#pk = :pk"
    //   ExpressionAttributeNames:    {"#pk": "GSI1PK"}    ← nombre real aquí
    //   ExpressionAttributeValues:   {":pk": "USER#abc"}  ← valor aquí

    let mut attr_names: HashMap<String, String> = HashMap::new();
    let mut attr_values: HashMap<String, AttributeValue> = HashMap::new();

    attr_names.insert("#pk".to_string(), params.pk_name.clone());
    attr_values.insert(
        ":pk".to_string(),
        AttributeValue::S(params.pk_value.clone()),
    );

    // ── 2. Construir el KeyConditionExpression según la condición de SK ──────
    //
    // match en Rust es exhaustivo: si agregas un variante a SkCondition,
    // el compilador te obliga a manejarlo aquí. No hay "forgot to handle".

    let key_condition: String = match &params.sk_condition {
        // Sin condición de SK — retorna todos los items bajo esa PK.
        // Ejemplo: Query PK=ORDER#abc → retorna OrderMeta + OrderItems + Shipments + History
        None => "#pk = :pk".to_string(),

        // SK exacto.
        // Ejemplo: PK=ORDER#abc, SK=ORDER → retorna solo el OrderMeta
        Some(SkCondition::Eq(sk_val)) => {
            let sk_name = params.sk_name.as_deref().unwrap_or("SK");
            //             ↑ as_deref() convierte Option<String> → Option<&str>
            //               unwrap_or("SK") usa "SK" si es None
            attr_names.insert("#sk".to_string(), sk_name.to_string());
            attr_values.insert(":sk".to_string(), AttributeValue::S(sk_val.clone()));
            "#pk = :pk AND #sk = :sk".to_string()
        }

        // SK con prefijo.
        // Ejemplo: PK=ORDER#abc, SK begins_with SHIPMENT# → todos los shipments
        Some(SkCondition::BeginsWith(sk_val)) => {
            let sk_name = params.sk_name.as_deref().unwrap_or("SK");
            attr_names.insert("#sk".to_string(), sk_name.to_string());
            attr_values.insert(":sk".to_string(), AttributeValue::S(sk_val.clone()));
            "#pk = :pk AND begins_with(#sk, :sk)".to_string()
        }

        // SK entre dos valores.
        // Ejemplo: PK=USER#abc (GSI1PK), GSI1SK BETWEEN ORDER#2024-01 AND ORDER#2024-02#ZZZZZZZ
        // El sufijo #ZZZZZZZ asegura que el límite superior incluya todos los IDs de ese día.
        Some(SkCondition::Between(range)) => {
            let sk_name = params.sk_name.as_deref().unwrap_or("SK");
            attr_names.insert("#sk".to_string(), sk_name.to_string());
            attr_values.insert(":from".to_string(), AttributeValue::S(range.from.clone()));
            attr_values.insert(":to".to_string(), AttributeValue::S(range.to.clone()));
            "#pk = :pk AND #sk BETWEEN :from AND :to".to_string()
        }
    };

    // ── 3. Esamblar filtros ───────────────────────────────────
    //
    let mut filter_parts: Vec<String> = Vec::new();
    for (i, f) in params.filters.iter().flatten().enumerate() {
        let n = format!("#f{}", i);
        attr_names.insert(n.clone(), f.name.clone());

        let part = match &f.condition {
            FilterOp::Eq(v) => {
                let p = format!(":f{}", i);
                attr_values.insert(p.clone(), to_attr(v, &f.value_type));
                format!("{} = {}", n, p)
            }
            FilterOp::BeginsWith(v) => {
                let p = format!(":f{}", i);
                attr_values.insert(p.clone(), AttributeValue::S(v.clone()));
                format!("begins_with({}, {})", n, p)
            }
            FilterOp::Contains(v) => {
                let p = format!(":f{}", i);
                attr_values.insert(p.clone(), AttributeValue::S(v.clone()));
                format!("contains({}, {})", n, p)
            }
            FilterOp::Between(range) => {
                let from = format!(":f{}from", i);
                let to = format!(":f{}to", i);
                attr_values.insert(from.clone(), to_attr(&range.from, &f.value_type));
                attr_values.insert(to.clone(), to_attr(&range.to, &f.value_type));
                format!("{} BETWEEN {} AND {}", n, from, to)
            }
        };
        filter_parts.push(part);
    }


    println!("query_table: key_condition={:?}", key_condition);
    println!("query_table: attr_names={:?}", attr_names);
    println!("query_table: attr_values={:?}", attr_values);
    println!("query_table: filter={:?}", filter_parts);
    // ── 4. Ejecutar una página (paginación nativa) ───────────────────────────
    //
    // Leemos `limit` items que cumplen la KeyCondition y aplicamos el
    // FilterExpression sobre esa página. El filtro actúa DESPUÉS de leer, así
    // que una página puede traer menos matches que `limit` (incluso 0) y aún
    // tener más data adelante: el front continúa con Next usando el cursor.

    let mut builder = client
        .query()
        .table_name(&params.table)
        .key_condition_expression(key_condition)
        .set_expression_attribute_names(Some(attr_names))
        .set_expression_attribute_values(Some(attr_values))
        .set_index_name(params.index_name)
        .limit(params.limit.unwrap_or(10));

    if !filter_parts.is_empty() {
        builder = builder.filter_expression(filter_parts.join(" AND ")); // TODO: pending to use dynamic param for operators AND|OR
    }

    if let Some(esk) = params.exclusive_start_key {
        let key: HashMap<String, AttributeValue> =
            serde_dynamo::to_item(esk).map_err(|e: serde_dynamo::Error| AppError {
                message: e.to_string(),
            })?;
        builder = builder.set_exclusive_start_key(Some(key));
    }

    let response = builder.send().await.map_err(|e| {
        let message = e
            .as_service_error()
            .and_then(|svc| svc.message())
            .map(|s: &str| s.to_string())
            .unwrap_or_else(|| e.to_string());
        AppError { message }
    })?;

    // El cursor de DynamoDB: dónde paró de leer (no de filtrar). Some => hay más.
    let last_key: Option<serde_json::Value> = response
        .last_evaluated_key()
        .map(|m| serde_dynamo::from_item(m.to_owned()))
        .transpose()
        .map_err(|e: serde_dynamo::Error| AppError {
            message: e.to_string(),
        })?;

    let items: Vec<serde_json::Value> = serde_dynamo::from_items(response.items().to_vec())
        .map_err(|e: serde_dynamo::Error| AppError {
            message: e.to_string(),
        })?;

    Ok(QueryResult {
        count: items.len(),
        items,
        truncated: last_key.is_some(),
        last_key,
    })
}
