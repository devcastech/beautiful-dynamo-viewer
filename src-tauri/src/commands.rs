use crate::error::AppError;
use aws_sdk_dynamodb::Client;
use aws_sdk_dynamodb::error::ProvideErrorMetadata;
use aws_sdk_dynamodb::types::AttributeValue;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, process::Command};
use tokio::sync::Mutex;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryParams {
    pub table: String,
    pub pk_name: String,         // e.g. "PK" o "GSI1PK"
    pub pk_value: String,        // e.g. "USER#abc123"
    pub sk_name: Option<String>, // None = no SK condition
    pub sk_condition: Option<SkCondition>,
    pub index_name: Option<String>,              // e.g. "GSI1", None = base table
    pub limit: Option<i32>,                      // items per page, default 10
    pub exclusive_start_key: Option<serde_json::Value>, // pagination cursor
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

#[tauri::command]
pub async fn query_table(
    client: tauri::State<'_, Mutex<Client>>,
    params: QueryParams,
) -> Result<QueryResult, AppError> {

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
    attr_values.insert(":pk".to_string(), AttributeValue::S(params.pk_value.clone()));

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
            attr_values.insert(":to".to_string(),   AttributeValue::S(range.to.clone()));
            "#pk = :pk AND #sk BETWEEN :from AND :to".to_string()
        }
    };

    // ── 3. Ensamblar y ejecutar el builder ───────────────────────────────────

    let mut builder = client
        .query()
        .table_name(&params.table)
        .key_condition_expression(key_condition)
        .set_expression_attribute_names(Some(attr_names))
        .set_expression_attribute_values(Some(attr_values));

    // set_index_name acepta Option<String> directamente.
    // Si params.index_name es None, DynamoDB usa la base table.
    // Si es Some("GSI1"), DynamoDB usa ese índice.
    builder = builder.set_index_name(params.index_name);
    builder = builder.limit(params.limit.unwrap_or(10));

    if let Some(esk) = params.exclusive_start_key {
        let key: HashMap<String, AttributeValue> = serde_dynamo::to_item(esk)
            .map_err(|e: serde_dynamo::Error| AppError { message: e.to_string() })?;
        builder = builder.set_exclusive_start_key(Some(key));
    }

    let response = builder.send().await.map_err(|e| {
        let message = e.as_service_error()
            .and_then(|svc| svc.message())
            .map(|s: &str| s.to_string())
            .unwrap_or_else(|| e.to_string());
        AppError { message }
    })?;

    let last_key: Option<serde_json::Value> = response
        .last_evaluated_key()
        .map(|m| serde_dynamo::from_item(m.to_owned()))
        .transpose()
        .map_err(|e: serde_dynamo::Error| AppError { message: e.to_string() })?;
    //println!("response {:?}", response);

    // response.items() devuelve &[HashMap<String, AttributeValue>]
    // .to_vec() clona eso a Vec para que serde_dynamo pueda consumirlo
    let raw_items = response.items().to_vec();
    //println!("raw_items {:?}", raw_items);

    // serde_dynamo::from_items convierte Vec<HashMap<String, AttributeValue>>
    // a Vec<serde_json::Value> aplanando los wrappers S/N/Bool/etc.
    // El ? propaga el error si hay un tipo que no puede convertirse.
    let items: Vec<serde_json::Value> = serde_dynamo::from_items(raw_items)
        .map_err(|e: serde_dynamo::Error| AppError { message: e.to_string() })?;

    Ok(QueryResult {
        count: items.len(),
        items,
        truncated: last_key.is_some(),
        last_key
    })
}

/// Escribe `contents` en `path` (la ruta la elige el usuario en el "Guardar como…" nativo).
/// Va por Rust en vez del plugin-fs para no lidiar con su scope de rutas permitidas.
#[tauri::command]
pub async fn save_text_file(path: String, contents: String) -> Result<(), AppError> {
    std::fs::write(&path, contents)?;
    Ok(())
}

#[tauri::command]
pub async fn list_aws_profiles() -> Result<Vec<String>, AppError> {
    let profiles = Command::new("aws")
        .arg("configure")
        .arg("list-profiles")
        .output()
        .map_err(|e| AppError::from(e))?;

    let output = String::from_utf8_lossy(&profiles.stdout);
    let profiles: Vec<String> = output.lines().map(|l| l.to_string()).collect();
    Ok(profiles)
}

#[tauri::command]
pub async fn aws_sso_login(profile: String) -> Result<bool, AppError> {
    let result = tokio::process::Command::new("aws")
        .arg("sso")
        .arg("login")
        .arg("--profile")
        .arg(&profile)
        .output()
        .await
        .map_err(|e| AppError::from(e))?;

    Ok(result.status.success())
}

#[tauri::command]
pub async fn check_aws_profile(profile: String) -> Result<bool, AppError> {
    let result = tokio::process::Command::new("aws")
        .arg("sts")
        .arg("get-caller-identity")
        .arg("--profile")
        .arg(&profile)
        .output()
        .await
        .map_err(|e| AppError::from(e))?;

    Ok(result.status.success())
}

#[tauri::command]
pub async fn set_aws_profile(
    client: tauri::State<'_, Mutex<Client>>,
    profile: String,
    region: Option<String>,
) -> Result<(), AppError> {
    use aws_config::BehaviorVersion;
    let mut loader = aws_config::defaults(BehaviorVersion::latest()).profile_name(&profile);

    if let Some(region_str) = region {
        // aws_sdk_dynamodb::config::Region es un newtype sobre String
        use aws_config::meta::region::RegionProviderChain;
        use aws_sdk_dynamodb::config::Region;
        let region = Region::new(region_str);
        loader = loader.region(RegionProviderChain::first_try(region));
    }

    let new_config = loader.load().await;
    let new_client = Client::new(&new_config);

    // Tomar el lock y reemplazar el Client interior
    // MutexGuard hace deref a &mut Client, por eso funciona la asignación con *
    let mut guard = client.lock().await;
    *guard = new_client;

    Ok(())
}
