use crate::error::AppError;
use aws_sdk_dynamodb::error::ProvideErrorMetadata;
use aws_sdk_dynamodb::operation::query::QueryOutput;
use aws_sdk_dynamodb::types::{AttributeValue, Capacity, ReturnConsumedCapacity};
use aws_sdk_dynamodb::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::Mutex;

// see:
// - https://docs.aws.amazon.com/sdk-for-rust/latest/dg/rust_dynamodb_code_examples.html
// - https://github.com/awsdocs/aws-doc-sdk-examples/tree/main/rustv1/examples/dynamodb

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
pub struct CapacityResult {
    pub capacity_units: Option<f64>,
    pub read_capacity_units: Option<f64>,
    pub write_capacity_units: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct ConsumedCapacityResult {
    pub table_name: Option<String>,
    pub capacity_units: Option<f64>,
    pub read_capacity_units: Option<f64>,
    pub write_capacity_units: Option<f64>,
    pub table: Option<CapacityResult>,
    pub global_secondary_indexes: Option<HashMap<String, CapacityResult>>,
    pub local_secondary_indexes: Option<HashMap<String, CapacityResult>>,
}
#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub items: Vec<serde_json::Value>,
    pub truncated: bool, // true si se alcanzó el límite de páginas/items
    pub count: usize,
    pub last_key: Option<serde_json::Value>,
    pub consumed_capacity: Option<ConsumedCapacityResult>,
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

fn to_attr(value: &str, t: &ValueType) -> AttributeValue {
    match t {
        ValueType::String => AttributeValue::S(value.to_string()),
        ValueType::Number => AttributeValue::N(value.to_string()),
    }
}

fn to_capacity_result(capacity: &Capacity) -> CapacityResult {
    CapacityResult {
        capacity_units: capacity.capacity_units(),
        read_capacity_units: capacity.read_capacity_units(),
        write_capacity_units: capacity.write_capacity_units(),
    }
}

fn extract_consumed_capacity(response: &QueryOutput) -> Option<ConsumedCapacityResult> {
    response
        .consumed_capacity()
        .map(|capacity| ConsumedCapacityResult {
            table_name: capacity.table_name().map(str::to_owned),
            capacity_units: capacity.capacity_units(),
            read_capacity_units: capacity.read_capacity_units(),
            write_capacity_units: capacity.write_capacity_units(),
            table: capacity.table().map(to_capacity_result),
            global_secondary_indexes: capacity.global_secondary_indexes().map(|indexes| {
                indexes
                    .iter()
                    .map(|(name, capacity)| (name.clone(), to_capacity_result(capacity)))
                    .collect()
            }),
            local_secondary_indexes: capacity.local_secondary_indexes().map(|indexes| {
                indexes
                    .iter()
                    .map(|(name, capacity)| (name.clone(), to_capacity_result(capacity)))
                    .collect()
            }),
        })
}

#[derive(Debug)]
pub struct BuiltExpressions {
    pub key_condition: String,
    pub attr_names: HashMap<String, String>,
    pub attr_values: HashMap<String, AttributeValue>,
    /// None cuando no hay filtros activos.
    pub filter_expression: Option<String>,
}

pub fn build_expressions(params: &QueryParams) -> BuiltExpressions {
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

    BuiltExpressions {
        key_condition,
        attr_names,
        attr_values,
        filter_expression: if filter_parts.is_empty() {
            None
        } else {
            // TODO: pending to use dynamic param for operators AND|OR
            Some(filter_parts.join(" AND "))
        },
    }
}

#[tauri::command]
pub async fn query_table(
    client: tauri::State<'_, Mutex<Client>>,
    params: QueryParams,
) -> Result<QueryResult, AppError> {
    // .lock().await obtiene acceso exclusivo al Client.
    // Devuelve un MutexGuard<Client> — cuando sale del scope se libera el lock.
    // El `client` de aquí en adelante es el Client real, no el Mutex.
    let client = client.lock().await;

    let built = build_expressions(&params);

    // ── 4. Ejecutar una página (paginación nativa) ───────────────────────────
    //
    // Leemos `limit` items que cumplen la KeyCondition y aplicamos el
    // FilterExpression sobre esa página. El filtro actúa DESPUÉS de leer, así
    // que una página puede traer menos matches que `limit` (incluso 0) y aún
    // tener más data adelante: el front continúa con Next usando el cursor.

    let mut builder = client
        .query()
        .table_name(&params.table)
        .key_condition_expression(built.key_condition)
        .set_expression_attribute_names(Some(built.attr_names))
        .set_expression_attribute_values(Some(built.attr_values))
        .set_index_name(params.index_name)
        .limit(params.limit.unwrap_or(10))
        .return_consumed_capacity(ReturnConsumedCapacity::Indexes);

    if let Some(filter) = built.filter_expression {
        builder = builder.filter_expression(filter);
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

    let consumed_capacity = extract_consumed_capacity(&response);

    Ok(QueryResult {
        count: items.len(),
        items,
        truncated: last_key.is_some(),
        last_key,
        consumed_capacity,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_params() -> QueryParams {
        QueryParams {
            table: "t".into(),
            pk_name: "PK".into(),
            pk_value: "ORDER#1".into(),
            sk_name: None,
            sk_condition: None,
            index_name: None,
            limit: None,
            exclusive_start_key: None,
            filters: None,
        }
    }

    fn s(v: &str) -> AttributeValue {
        AttributeValue::S(v.into())
    }
    fn n(v: &str) -> AttributeValue {
        AttributeValue::N(v.into())
    }

    // ── build_expressions ────────────────────────────────────────────────────

    #[test]
    fn no_sk_condition_queries_pk_only() {
        let built = build_expressions(&base_params());
        assert_eq!(built.key_condition, "#pk = :pk");
        assert_eq!(built.attr_names["#pk"], "PK");
        assert_eq!(built.attr_values[":pk"], s("ORDER#1"));
        assert!(built.filter_expression.is_none());
    }

    #[test]
    fn sk_eq_maps_the_given_sk_name() {
        let built = build_expressions(&QueryParams {
            sk_name: Some("GSI1SK".into()),
            sk_condition: Some(SkCondition::Eq("ORDER".into())),
            ..base_params()
        });
        assert_eq!(built.key_condition, "#pk = :pk AND #sk = :sk");
        assert_eq!(built.attr_names["#sk"], "GSI1SK");
        assert_eq!(built.attr_values[":sk"], s("ORDER"));
    }

    #[test]
    fn sk_name_defaults_to_sk_when_missing() {
        let built = build_expressions(&QueryParams {
            sk_condition: Some(SkCondition::Eq("ORDER".into())),
            ..base_params()
        });
        assert_eq!(built.attr_names["#sk"], "SK");
    }

    #[test]
    fn sk_begins_with() {
        let built = build_expressions(&QueryParams {
            sk_condition: Some(SkCondition::BeginsWith("SHIPMENT#".into())),
            ..base_params()
        });
        assert_eq!(built.key_condition, "#pk = :pk AND begins_with(#sk, :sk)");
        assert_eq!(built.attr_values[":sk"], s("SHIPMENT#"));
    }

    #[test]
    fn sk_between_binds_both_ends() {
        let built = build_expressions(&QueryParams {
            sk_condition: Some(SkCondition::Between(BetweenValues {
                from: "A".into(),
                to: "B".into(),
            })),
            ..base_params()
        });
        assert_eq!(
            built.key_condition,
            "#pk = :pk AND #sk BETWEEN :from AND :to"
        );
        assert_eq!(built.attr_values[":from"], s("A"));
        assert_eq!(built.attr_values[":to"], s("B"));
    }

    #[test]
    fn filter_eq_string_and_number_pick_the_attr_type() {
        let built = build_expressions(&QueryParams {
            filters: Some(vec![
                Filter {
                    name: "status".into(),
                    value_type: ValueType::String,
                    condition: FilterOp::Eq("SHIPPED".into()),
                },
                Filter {
                    name: "total".into(),
                    value_type: ValueType::Number,
                    condition: FilterOp::Eq("42".into()),
                },
            ]),
            ..base_params()
        });
        assert_eq!(
            built.filter_expression.as_deref(),
            Some("#f0 = :f0 AND #f1 = :f1")
        );
        assert_eq!(built.attr_names["#f0"], "status");
        assert_eq!(built.attr_values[":f0"], s("SHIPPED"));
        assert_eq!(built.attr_values[":f1"], n("42"));
    }

    #[test]
    fn filter_between_number_binds_typed_bounds() {
        let built = build_expressions(&QueryParams {
            filters: Some(vec![Filter {
                name: "total".into(),
                value_type: ValueType::Number,
                condition: FilterOp::Between(BetweenValues {
                    from: "10".into(),
                    to: "100".into(),
                }),
            }]),
            ..base_params()
        });
        assert_eq!(
            built.filter_expression.as_deref(),
            Some("#f0 BETWEEN :f0from AND :f0to")
        );
        assert_eq!(built.attr_values[":f0from"], n("10"));
        assert_eq!(built.attr_values[":f0to"], n("100"));
    }

    #[test]
    fn filter_begins_with_and_contains_always_query_as_strings() {
        let built = build_expressions(&QueryParams {
            filters: Some(vec![
                Filter {
                    name: "sku".into(),
                    value_type: ValueType::Number,
                    condition: FilterOp::BeginsWith("9".into()),
                },
                Filter {
                    name: "notes".into(),
                    value_type: ValueType::String,
                    condition: FilterOp::Contains("urgent".into()),
                },
            ]),
            ..base_params()
        });
        assert_eq!(
            built.filter_expression.as_deref(),
            Some("begins_with(#f0, :f0) AND contains(#f1, :f1)")
        );
        assert_eq!(built.attr_values[":f0"], s("9"));
        assert_eq!(built.attr_values[":f1"], s("urgent"));
    }

    #[test]
    fn empty_filters_produce_no_filter_expression() {
        let built = build_expressions(&QueryParams {
            filters: Some(vec![]),
            ..base_params()
        });
        assert!(built.filter_expression.is_none());
    }

    // ── Contrato con el frontend ─────────────────────────────────────────────
    //
    // Los fixtures en fixtures/query-params/ son el JSON exacto que produce
    // buildQueryParams en el frontend (contract.test.ts). Si
    // cambia el shape de un lado sin el otro, uno de los dos tests revienta.

    fn from_fixture(json: &str) -> QueryParams {
        serde_json::from_str(json).expect("fixture must deserialize into QueryParams")
    }

    #[test]
    fn contract_base_no_sk() {
        let p = from_fixture(include_str!(
            "../../../../fixtures/query-params/base-no-sk.json"
        ));
        assert_eq!(p.table, "ecommerce-demo");
        assert_eq!(p.pk_name, "PK");
        assert_eq!(p.pk_value, "ORDER#o-123");
        assert!(p.sk_condition.is_none() && p.index_name.is_none() && p.filters.is_none());
    }

    #[test]
    fn contract_gsi_begins_with() {
        let p = from_fixture(include_str!(
            "../../../../fixtures/query-params/gsi-begins-with.json"
        ));
        assert_eq!(p.index_name.as_deref(), Some("GSI1"));
        assert_eq!(p.sk_name.as_deref(), Some("GSI1SK"));
        assert_eq!(p.limit, Some(25));
        assert!(
            matches!(p.sk_condition, Some(SkCondition::BeginsWith(ref v)) if v == "ORDER#2024-")
        );
    }

    #[test]
    fn contract_between_with_filters() {
        let p = from_fixture(include_str!(
            "../../../../fixtures/query-params/between-filters.json"
        ));
        assert!(matches!(
            p.sk_condition,
            Some(SkCondition::Between(ref b)) if b.from == "ITEM#001" && b.to == "ITEM#999"
        ));
        let filters = p.filters.as_ref().expect("filters present");
        assert_eq!(filters.len(), 2);
        assert!(matches!(filters[0].value_type, ValueType::String));
        assert!(matches!(filters[1].value_type, ValueType::Number));
        // Y las expresiones que salen de ese payload usan el tipo correcto.
        let built = build_expressions(&p);
        assert_eq!(built.attr_values[":f1from"], n("10"));
    }

    #[test]
    fn contract_contains_with_start_key() {
        let p = from_fixture(include_str!(
            "../../../../fixtures/query-params/contains-filter.json"
        ));
        assert!(p.exclusive_start_key.is_some());
        let filters = p.filters.as_ref().expect("filters present");
        assert!(matches!(filters[0].condition, FilterOp::Contains(ref v) if v == "urgent"));
    }
}
