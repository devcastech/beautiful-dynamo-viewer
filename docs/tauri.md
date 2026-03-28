# Plan — Tauri + Rust Backend

> Esta parte está pensada para hacerse a mano como ejercicio de aprendizaje de Rust.
> Cada paso indica qué conceptos leer **antes** de codear ese paso.
> Los ejemplos están basados en las tablas reales del proyecto: `CediStoreTable` y `CediCartTable`.

---

## Visión general de los comandos a exponer

```
query_table(params: QueryParams) → Result<QueryResult, AppError>
list_aws_profiles()              → Result<Vec<String>, AppError>
set_aws_profile(profile, region) → Result<(), AppError>
```

---

## Paso 1 — Scaffold Tauri en el proyecto Vite existente

### Comandos

```bash
npm install --save-dev @tauri-apps/cli@^2
npx tauri init
```

Respuestas al wizard:
- App name → `dynamo-viewer`
- Window title → `Dynamo Viewer`
- Web assets location → `../dist`
- Dev server URL → `http://localhost:5173`
- Dev command → `npm run dev`
- Build command → `npm run build`

### Archivos generados

```
src-tauri/
  Cargo.toml       ← manifiesto de dependencias Rust
  Cargo.lock       ← lockfile (commitear a git)
  build.rs         ← script de build de Tauri, no modificar
  src/
    main.rs        ← entry point del binario
    lib.rs         ← Tauri Builder vive aquí (split para soporte mobile)
  tauri.conf.json  ← configuración de la app
  capabilities/    ← sistema de permisos de Tauri 2.x
  icons/
```

### `tauri.conf.json` mínimo para este proyecto

```json
{
  "identifier": "com.tudominio.dynamoviewer",
  "app": {
    "windows": [
      {
        "title": "Dynamo Viewer",
        "width": 1280,
        "height": 800
      }
    ]
  },
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  }
}
```

### Qué leer

- Arquitectura de Tauri: https://v2.tauri.app/concept/
- Referencia completa de `tauri.conf.json`: https://v2.tauri.app/reference/config/

### Verificar antes de continuar

```bash
rustc --version       # debe ser ≥ 1.77.2, si no: rustup update stable
npx tauri dev         # debe abrir la ventana mostrando el frontend actual
```

---

## Paso 2 — `Cargo.toml`: dependencias

### Conceptos a leer primero

- Cómo funciona `Cargo.toml` y los version specifiers: https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html
- Qué son los "features" (unidades de compilación opt-in): https://doc.rust-lang.org/cargo/reference/features.html

### El bloque `[dependencies]` completo

```toml
[dependencies]
tauri           = { version = "2", features = ["wry", "devtools"] }
tokio           = { version = "1", features = ["full"] }
aws-config      = { version = "1", features = ["behavior-version-latest"] }
aws-sdk-dynamodb = "1"
serde           = { version = "1", features = ["derive"] }
serde_json      = "1"
serde_dynamo    = { version = "4", features = ["aws-sdk-dynamodb+1"] }
thiserror       = "1"
dirs            = "5"
configparser    = "3"
```

### Por qué cada crate

| Crate | Propósito |
|-------|-----------|
| `tauri` | framework core, IPC bridge entre Rust y la webview |
| `tokio` | async runtime — el SDK de AWS corre sobre él |
| `aws-config` | carga credenciales: env vars, `~/.aws/credentials`, SSO, etc. |
| `aws-sdk-dynamodb` | cliente DynamoDB, generado desde el modelo de servicio de AWS |
| `serde` | framework de serialización — define los traits `Serialize`/`Deserialize` |
| `serde_json` | implementación de serde para JSON |
| `serde_dynamo` | convierte `AttributeValue` (tipo interno del SDK) a `serde_json::Value` |
| `thiserror` | derive macro para crear error enums con menos boilerplate |
| `dirs` | obtiene rutas del sistema (`~/`, config dir, etc.) de forma cross-platform |
| `configparser` | parsea archivos ini — el formato de `~/.aws/credentials` |

### Referencias

- tauri: https://docs.rs/tauri
- tokio: https://docs.rs/tokio — tutorial: https://tokio.rs/tokio/tutorial
- aws-config: https://docs.rs/aws-config
- aws-sdk-dynamodb: https://docs.rs/aws-sdk-dynamodb
- serde: https://serde.rs
- serde_dynamo: https://docs.rs/serde_dynamo
- thiserror: https://docs.rs/thiserror

### Gotcha crítico: compatibilidad serde_dynamo ↔ aws-sdk-dynamodb

El feature `aws-sdk-dynamodb+1` de `serde_dynamo` debe coincidir con la major version del
SDK. Si el SDK es `1.x`, el feature es `aws-sdk-dynamodb+1`. Si actualizas el SDK a `2.x`
en el futuro, el feature cambia a `aws-sdk-dynamodb+2`. Una incompatibilidad produce errores
de tipo confusos como:

```
error[E0308]: mismatched types
  expected `aws_sdk_dynamodb::types::AttributeValue`
     found `aws_sdk_dynamodb::types::AttributeValue`
```

(mismo nombre, distinta versión — el compilador los trata como tipos distintos)

---

## Paso 3 — `main.rs` + `lib.rs`: entry point y estado compartido

### Conceptos a leer primero

- Ownership básico: https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html
- `#[tokio::main]` — macro que envuelve `main` con el runtime de Tokio: https://tokio.rs/tokio/tutorial/hello-tokio
- Por qué no usar `std::sync::Mutex` en código async: https://tokio.rs/tokio/tutorial/shared-state#on-using-stdsyncmutex

### `main.rs` — solo el entry point

```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dynamo_viewer_lib::run();
}
```

El atributo `#![cfg_attr(...)]` oculta la ventana de terminal en builds de release en Windows.
En debug (desarrollo) la deja visible para ver logs.

### `lib.rs` — inicialización del Client y registro de commands

```rust
// src-tauri/src/lib.rs
mod commands;
mod error;

use tokio::sync::Mutex;
use aws_sdk_dynamodb::Client;

pub fn run() {
    // El runtime de Tokio es creado por tauri::async_runtime internamente.
    // Para inicializar el Client de forma async antes de arrancar Tauri,
    // usamos tauri::async_runtime::block_on:
    let client = tauri::async_runtime::block_on(async {
        let config = aws_config::load_from_env().await;
        Client::new(&config)
    });

    tauri::Builder::default()
        .manage(Mutex::new(client))          // ← estado compartido
        .invoke_handler(tauri::generate_handler![
            commands::query_table,
            commands::list_aws_profiles,
            commands::set_aws_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Por qué `Mutex<Client>` y no solo `Client`:**
Tauri comparte el estado entre threads (cada command puede correr en su propio thread del pool
de Tokio). `Client` no es `Send + Sync` por sí solo en todas las configuraciones.
Además, el Paso 7 (cambio de perfil) necesita reemplazar el Client en runtime — para eso
se necesita mutabilidad, que solo se puede tener de forma segura a través de un Mutex.

**Credential chain de `aws_config::load_from_env()`:**
A pesar del nombre, carga desde múltiples fuentes en este orden:
1. `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` (env vars)
2. `~/.aws/credentials` + `~/.aws/config` (respetando `AWS_PROFILE`)
3. Container/EC2 metadata (si aplica)

Docs: https://docs.rs/aws-config/latest/aws_config/default_provider/credentials/index.html

### Verificación: command dummy antes de continuar

Antes de continuar, agregar un command mínimo para verificar que el IPC funciona:

```rust
// en commands.rs (temporal)
#[tauri::command]
pub fn health_check() -> &'static str {
    "ok"
}
```

```ts
// en el frontend (temporal)
import { invoke } from '@tauri-apps/api/core'
const result = await invoke('health_check')
console.log(result) // "ok"
```

Referencia: https://v2.tauri.app/develop/state-management/

---

## Paso 4 — `commands.rs`: structs y enums con serde

### Conceptos a leer primero

- Enums con datos (mucho más expresivos que en TypeScript): https://doc.rust-lang.org/book/ch06-00-enums.html
- `Option<T>` — Rust no tiene `null`, los valores opcionales son explícitos: https://doc.rust-lang.org/book/ch06-01-defining-an-enum.html#the-option-enum-and-its-advantages-over-null-values
- Derive macros: https://doc.rust-lang.org/book/appendix-03-derivable-traits.html
- Serde field attributes (`rename_all`, `tag`, `content`): https://serde.rs/field-attrs.html
- Representaciones de enums en serde: https://serde.rs/enum-representations.html

### `QueryParams` — espejo del tipo TypeScript

```rust
// src-tauri/src/commands.rs
use serde::{Deserialize, Serialize};

// El #[serde(rename_all = "camelCase")] hace que el JSON use camelCase
// mientras el código Rust usa snake_case. Ejemplo:
//   Rust:  pk_name       → JSON: "pkName"
//   Rust:  sk_condition  → JSON: "skCondition"
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
```

**Por qué `Option<String>` y no solo `String`:**
En Rust no existe `null`. Cuando un campo puede no estar presente, se envuelve en `Option`.
`Option<String>` puede ser `Some("GSI1".to_string())` o `None`. Serde omite el campo del
JSON si es `None` (con `#[serde(skip_serializing_if = "Option::is_none")]`) o lo
deserializa como `None` si viene `null` o ausente en el JSON.

### `SkCondition` — enum con datos

```rust
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
```

**Por qué un struct separado para `Between`:**
`#[serde(tag = "op", content = "value")]` espera que el payload de cada variante quepa en
un campo `"value"`. Para `Eq` y `BeginsWith` un `String` cabe directamente. Para `Between`
se necesitan dos valores — un struct anidado es lo más limpio.

### `QueryResult` — lo que devuelve el command al frontend

```rust
#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub items:     Vec<serde_json::Value>,
    pub truncated: bool,   // true si se alcanzó el límite de páginas/items
    pub count:     usize,
}
```

---

## Paso 5 — El comando `query_table`

### Conceptos a leer primero

- `match` expressions — el compilador fuerza exhaustividad: https://doc.rust-lang.org/book/ch06-02-match.html
- El operador `?` para propagar errores sin `unwrap`: https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html#a-shortcut-for-propagating-errors-the--operator
- `HashMap`: https://doc.rust-lang.org/std/collections/struct.HashMap.html

### La firma del command

```rust
use tokio::sync::Mutex;
use aws_sdk_dynamodb::Client;
use crate::error::AppError;

#[tauri::command]
pub async fn query_table(
    client: tauri::State<'_, Mutex<Client>>,
    params: QueryParams,
) -> Result<QueryResult, AppError> {
    // ...
}
```

Tauri docs sobre commands: https://v2.tauri.app/develop/calling-rust/

### Construir la query paso a paso

El SDK usa el patrón "fluent builder": `client.query()` devuelve un `QueryFluentBuilder`,
y cada método devuelve el mismo builder. Se ejecuta con `.send().await`.

```rust
use std::collections::HashMap;
use aws_sdk_dynamodb::types::AttributeValue;

pub async fn query_table(
    client: tauri::State<'_, Mutex<Client>>,
    params: QueryParams,
) -> Result<QueryResult, AppError> {
    let client = client.lock().await;

    // --- 1. Construir el KeyConditionExpression y los mapas de atributos ---
    //
    // Siempre usar placeholders (#pk, #sk) en la expression y mapearlos
    // a los nombres reales. DynamoDB tiene ~600 reserved words; si pk_name
    // fuera "STATUS" (reserved word), la query fallaría sin el placeholder.

    let mut attr_names: HashMap<String, String> = HashMap::new();
    let mut attr_values: HashMap<String, AttributeValue> = HashMap::new();

    attr_names.insert("#pk".to_string(), params.pk_name.clone());
    attr_values.insert(":pk".to_string(), AttributeValue::S(params.pk_value.clone()));

    // Ejemplo real: query de órdenes de un usuario por GSI1
    //   pk_name  = "GSI1PK"
    //   pk_value = "USER#abc123"
    // → KeyConditionExpression = "#pk = :pk"
    // → ExpressionAttributeNames = {"#pk": "GSI1PK"}
    // → ExpressionAttributeValues = {":pk": {"S": "USER#abc123"}}

    let key_condition = match &params.sk_condition {
        None => {
            // Solo PK — válido en DynamoDB, retorna todos los items de esa partición
            // Ejemplo: todos los registros de ORDER#<orderId> (OrderMeta + OrderItems + Shipments)
            "#pk = :pk".to_string()
        }

        Some(SkCondition::Eq(sk_val)) => {
            let sk_name = params.sk_name.as_deref().unwrap_or("SK");
            attr_names.insert("#sk".to_string(), sk_name.to_string());
            attr_values.insert(":sk".to_string(), AttributeValue::S(sk_val.clone()));

            // Ejemplo: obtener solo el OrderMeta de una orden
            //   sk_name  = "SK"
            //   sk_value = "ORDER"
            // → "#pk = :pk AND #sk = :sk"
            "#pk = :pk AND #sk = :sk".to_string()
        }

        Some(SkCondition::BeginsWith(sk_val)) => {
            let sk_name = params.sk_name.as_deref().unwrap_or("SK");
            attr_names.insert("#sk".to_string(), sk_name.to_string());
            attr_values.insert(":sk".to_string(), AttributeValue::S(sk_val.clone()));

            // Ejemplo: listar todos los shipments de una orden
            //   sk_name  = "SK"
            //   sk_value = "SHIPMENT#"
            // → "#pk = :pk AND begins_with(#sk, :sk)"
            "#pk = :pk AND begins_with(#sk, :sk)".to_string()
        }

        Some(SkCondition::Between(range)) => {
            let sk_name = params.sk_name.as_deref().unwrap_or("SK");
            attr_names.insert("#sk".to_string(), sk_name.to_string());
            attr_values.insert(":sk_from".to_string(), AttributeValue::S(range.from.clone()));
            attr_values.insert(":sk_to".to_string(), AttributeValue::S(range.to.clone()));

            // Ejemplo: órdenes de un usuario en rango de fechas por GSI1
            //   sk_name  = "GSI1SK"
            //   from     = "ORDER#2024-01-01"
            //   to       = "ORDER#2024-01-31#ZZZZZZZ"  ← el ZZZZZZZ asegura el límite superior
            // → "#pk = :pk AND #sk BETWEEN :sk_from AND :sk_to"
            "#pk = :pk AND #sk BETWEEN :sk_from AND :sk_to".to_string()
        }
    };

    // --- 2. Ensamblar el builder ---

    let mut builder = client
        .query()
        .table_name(&params.table)
        .key_condition_expression(key_condition)
        .set_expression_attribute_names(Some(attr_names))
        .set_expression_attribute_values(Some(attr_values));

    // .set_index_name acepta Option<String> directamente — no necesita if let
    builder = builder.set_index_name(params.index_name);

    // --- 3. Ejecutar con paginación (ver Paso 8) ---
    // (por ahora, una sola página para iterar)
    let response = builder.send().await.map_err(AppError::from)?;

    let raw_items: Vec<_> = response.items().to_vec();
    let items: Vec<serde_json::Value> = serde_dynamo::from_items(raw_items)?;

    Ok(QueryResult {
        count: items.len(),
        items,
        truncated: false,
    })
}
```

Docs del builder: https://docs.rs/aws-sdk-dynamodb/latest/aws_sdk_dynamodb/operation/query/builders/struct.QueryFluentBuilder.html
`AttributeValue`: https://docs.rs/aws-sdk-dynamodb/latest/aws_sdk_dynamodb/types/enum.AttributeValue.html

---

## Paso 6 — `AttributeValue` → JSON con `serde_dynamo`

### El problema concreto

DynamoDB devuelve items como `Vec<HashMap<String, AttributeValue>>`.
`AttributeValue` es un enum del SDK con variantes tipadas:

```
S("USER#abc123")          → string
N("42.50")                → número (como string internamente)
Bool(true)                → booleano
L([...])                  → lista
M({"key": AttributeValue}) → mapa anidado
Null(true)                → null
SS(["a", "b"])            → string set
NS(["1", "2"])            → number set
```

Si intentaras serializar esto directamente a JSON obtendrías:
```json
{"userId": {"S": "abc123"}, "total": {"N": "42.50"}}
```

Pero el frontend espera:
```json
{"userId": "abc123", "total": 42.50}
```

### Solución con `serde_dynamo`

```rust
// Convierte Vec<HashMap<String, AttributeValue>> → Vec<serde_json::Value>
// Maneja recursivamente L (listas) y M (mapas anidados).
let raw_items: Vec<_> = response.items().to_vec();
let items: Vec<serde_json::Value> = serde_dynamo::from_items(raw_items)
    .map_err(|e| AppError::Serialization(e.to_string()))?;
```

`from_items` docs: https://docs.rs/serde_dynamo/latest/serde_dynamo/fn.from_items.html

### Gotcha: números DynamoDB

DynamoDB almacena números como strings en el wire format (`N("42.50")`). `serde_dynamo`
los convierte a `serde_json::Number`, que preserva la representación original. Una conversión
manual a `f64` perdería precisión en enteros grandes — DynamoDB soporta hasta 38 dígitos,
`f64` solo garantiza ~15 dígitos significativos.

---

## Paso 7 — Cambio de perfil/región en runtime

### Conceptos a leer primero

- `Mutex<T>` para mutación compartida entre threads: https://doc.rust-lang.org/book/ch16-03-shared-state.html
- Por qué `tokio::sync::Mutex` y no `std::sync::Mutex`: https://tokio.rs/tokio/tutorial/shared-state
- I/O async con Tokio: https://docs.rs/tokio/latest/tokio/fs/index.html

### `set_aws_profile` — reemplazar el Client en runtime

```rust
#[tauri::command]
pub async fn set_aws_profile(
    client: tauri::State<'_, Mutex<Client>>,
    profile: String,
    region: Option<String>,
) -> Result<(), AppError> {
    // Construir nuevo config con el perfil especificado
    let mut loader = aws_config::from_env().profile_name(&profile);

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
```

`ConfigLoader` docs: https://docs.rs/aws-config/latest/aws_config/struct.ConfigLoader.html

### `list_aws_profiles` — leer `~/.aws/credentials`

```rust
#[tauri::command]
pub async fn list_aws_profiles() -> Result<Vec<String>, AppError> {
    let home = dirs::home_dir()
        .ok_or_else(|| AppError::Io("No se encontró el directorio home".to_string()))?;

    let credentials_path = home.join(".aws").join("credentials");
    let config_path      = home.join(".aws").join("config");

    let mut profiles: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Leer ~/.aws/credentials
    // Los perfiles aparecen como: [default], [produccion], [staging]
    if credentials_path.exists() {
        let content = tokio::fs::read_to_string(&credentials_path).await
            .map_err(|e| AppError::Io(e.to_string()))?;

        let mut parser = configparser::ini::Ini::new();
        parser.read(content).map_err(|e| AppError::Io(e))?;
        for section in parser.sections() {
            profiles.insert(section);
        }
    }

    // Leer ~/.aws/config
    // Los perfiles no-default aparecen como: [profile produccion], [profile staging]
    // El perfil default aparece como: [default]
    if config_path.exists() {
        let content = tokio::fs::read_to_string(&config_path).await
            .map_err(|e| AppError::Io(e.to_string()))?;

        let mut parser = configparser::ini::Ini::new();
        parser.read(content).map_err(|e| AppError::Io(e))?;
        for section in parser.sections() {
            // Quitar el prefijo "profile " si existe
            let name = section
                .strip_prefix("profile ")
                .unwrap_or(&section)
                .to_string();
            profiles.insert(name);
        }
    }

    let mut result: Vec<String> = profiles.into_iter().collect();
    result.sort();  // orden alfabético para la UI
    Ok(result)
}
```

**Gotcha:** `tokio::fs::read_to_string` es la versión async de `std::fs::read_to_string`.
Usar la versión de std dentro de un command async bloquea el thread del pool de Tokio.
Para archivos pequeños el impacto es mínimo, pero es buena práctica usar la versión async.

---

## Paso 8 — Paginación

### Cómo pagina DynamoDB

Cada respuesta de `query` retorna hasta 1MB de datos. Si hay más items, la respuesta incluye
`last_evaluated_key` (un `HashMap<String, AttributeValue>` que actúa como cursor).
Para la siguiente página se envía la misma query con `.exclusive_start_key(cursor)`.
La query termina cuando `last_evaluated_key()` devuelve `None`.

Referencia: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html

### Loop de paginación

```rust
const MAX_ITEMS: usize = 1_000;
const MAX_PAGES: usize = 10;

pub async fn query_table( /* ... */ ) -> Result<QueryResult, AppError> {
    let client = client.lock().await;

    // ... construir attr_names, attr_values, key_condition como en Paso 5 ...

    let mut all_raw_items: Vec<HashMap<String, AttributeValue>> = Vec::new();
    let mut last_key: Option<HashMap<String, AttributeValue>> = None;
    let mut truncated = false;
    let mut pages = 0;

    loop {
        let mut builder = client
            .query()
            .table_name(&params.table)
            .key_condition_expression(&key_condition)
            .set_expression_attribute_names(Some(attr_names.clone()))
            .set_expression_attribute_values(Some(attr_values.clone()))
            .set_index_name(params.index_name.clone());

        // Si tenemos un cursor de la página anterior, lo adjuntamos
        if let Some(ref key) = last_key {
            builder = builder.set_exclusive_start_key(Some(key.clone()));
        }

        let response = builder.send().await.map_err(AppError::from)?;

        all_raw_items.extend(response.items().to_vec());
        pages += 1;

        // Guardar el cursor para la próxima iteración
        // last_evaluated_key() devuelve Option<&HashMap<...>>, clonamos para owned
        last_key = response.last_evaluated_key().map(|m| m.to_owned());

        // Condiciones de parada
        if last_key.is_none() {
            break; // no hay más páginas
        }
        if all_raw_items.len() >= MAX_ITEMS || pages >= MAX_PAGES {
            truncated = true;
            break;
        }
    }

    let items: Vec<serde_json::Value> = serde_dynamo::from_items(all_raw_items)
        .map_err(|e| AppError::Serialization(e.to_string()))?;

    Ok(QueryResult {
        count: items.len(),
        items,
        truncated,
    })
}
```

**Nota sobre `clone()`:** en Rust, la asignación mueve el valor (ownership transfer) en lugar
de copiarlo. Para reusar `attr_names` y `attr_values` en cada iteración del loop sin
consumirlos, se clona. Para una sola pasada, el clone solo ocurre una vez — aceptable.
Alternativa: reconstruir el builder desde parámetros en cada iteración.

---

## Paso 9 — Error handling

### Conceptos a leer primero

- `Result<T, E>` y la filosofía de errores en Rust: https://doc.rust-lang.org/book/ch09-00-error-handling.html
- El trait `Error`: https://doc.rust-lang.org/std/error/trait.Error.html
- `thiserror` y su propósito: https://docs.rs/thiserror/latest/thiserror/

### `error.rs` — el enum centralizado

```rust
// src-tauri/src/error.rs
use aws_sdk_dynamodb::error::SdkError;
use aws_sdk_dynamodb::operation::query::QueryError;

#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum AppError {
    // {0} se reemplaza con el Display del valor interno al hacer format!
    #[error("DynamoDB error: {0}")]
    Dynamo(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Profile not found: {0}")]
    ProfileNotFound(String),
}

// Conversión automática desde SdkError<QueryError> → AppError::Dynamo
// Esto hace que el operador ? funcione en llamadas al SDK sin map_err manual
impl From<SdkError<QueryError>> for AppError {
    fn from(err: SdkError<QueryError>) -> Self {
        AppError::Dynamo(err.to_string())
    }
}

// Conversión desde errores de serde_dynamo
impl From<serde_dynamo::Error> for AppError {
    fn from(err: serde_dynamo::Error) -> Self {
        AppError::Serialization(err.to_string())
    }
}
```

**Qué hace `thiserror::Error`:** genera automáticamente la implementación del trait
`std::error::Error` y del trait `std::fmt::Display` basándose en los strings de `#[error(...)]`.
Sin `thiserror` tendrías que implementar ambos traits a mano para cada variante.

**Qué hace `serde::Serialize` en el enum de error:** Tauri necesita serializar el error a JSON
para enviarlo al frontend como rejection de la Promise. Con `Serialize`, el frontend recibe:
```json
{"Dynamo": "ResourceNotFoundException: Requested resource not found"}
```
En lugar de solo un string plano, lo que permite manejar tipos de error específicos en la UI.

### Cómo Tauri propaga el error al frontend

```rust
// En el command — el ? propaga el error y Tauri lo serializa automáticamente
let response = builder.send().await?;  // SdkError → AppError::Dynamo via From
```

```ts
// En el frontend
try {
  const result = await invoke<QueryResult>('query_table', { params })
} catch (error) {
  // error tiene la forma: {"Dynamo": "mensaje..."} | {"Io": "..."} | etc.
  if (typeof error === 'object' && 'Dynamo' in error) {
    console.error('DynamoDB error:', error.Dynamo)
  }
}
```

Tauri docs sobre error handling: https://v2.tauri.app/develop/calling-rust/#error-handling

---

## Estructura final de archivos

```
src-tauri/src/
  main.rs          ← entry point, solo llama lib::run()
  lib.rs           ← Builder, .manage(Mutex<Client>), .invoke_handler([...])
  error.rs         ← AppError enum con thiserror + serde
  commands.rs      ← query_table, list_aws_profiles, set_aws_profile
```

---

## Secuencia de implementación

```
1. Scaffold + cargo build
   → verifica que las versiones de crates son compatibles (sin código tuyo todavía)

2. main.rs + lib.rs con health_check dummy
   → verifica que invoke funciona end-to-end desde el frontend

3. error.rs con AppError básico (Dynamo + Io)
   → tener el tipo de error antes de las operaciones que lo usan

4. commands.rs: QueryParams + SkCondition + query_table que imprime params y devuelve []
   → verifica que la deserialización desde JS funciona (los tipos Option, enums, etc.)

5. query_table con query real sin paginación
   → primer resultado end-to-end contra CediStoreTable o CediCartTable

6. Integrar serde_dynamo
   → verificar que el JSON tiene la forma esperada (sin wrappers S/N/etc.)

7. Loop de paginación + QueryResult.truncated
   → para tablas con más de 1MB de datos en una partición

8. list_aws_profiles + set_aws_profile
   → cambio de perfil en runtime sin reiniciar la app

9. Completar AppError con todos los From<> necesarios
   → solo después de que el happy path funcione
```

---

## Recursos de Rust

| Recurso | Cuándo usarlo |
|---------|---------------|
| [The Rust Book](https://doc.rust-lang.org/book/) | Cap. 4 (ownership), 6 (enums/match), 9 (errors), 16 (concurrencia) — base conceptual |
| [Rust by Example](https://doc.rust-lang.org/rust-by-example/) | Para ver código concreto de cada concepto mientras lees el Book |
| [Tokio Tutorial](https://tokio.rs/tokio/tutorial) | Async/await, tasks, Mutex compartido — leer antes del Paso 3 |
| [docs.rs](https://docs.rs) | Documentación de cualquier crate — buscar la firma exacta de cada método |
| [Rust Playground](https://play.rust-lang.org/) | Probar snippets de Rust sin setup (tipos, match, serde) antes de integrarlo en Tauri |
| [AWS SDK Rust examples](https://github.com/awsdocs/aws-doc-sdk-examples/tree/main/rustv1/examples/dynamodb) | Ejemplos oficiales de DynamoDB con el SDK de Rust |
