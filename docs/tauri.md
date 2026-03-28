# Plan — Tauri + Rust Backend

> Esta parte está pensada para hacerse a mano como ejercicio de aprendizaje de Rust.
> Cada paso indica qué conceptos leer **antes** de codear ese paso.

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
- Web assets location → `../dist`
- Dev server URL → `http://localhost:5173`

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

### Configuración mínima en `tauri.conf.json`

- `identifier`: reverse-domain único, e.g. `"com.tunombre.dynamoviewer"` — requerido para sandboxing en macOS
- `build.beforeDevCommand`: el comando para arrancar Vite
- `build.devUrl`: `"http://localhost:5173"`
- `build.frontendDist`: `"../dist"`

### Qué leer

- Arquitectura de Tauri: https://v2.tauri.app/concept/
- Referencia completa de `tauri.conf.json`: https://v2.tauri.app/reference/config/
- Diferencias Tauri v1 vs v2 (el schema de config cambió): https://v2.tauri.app/start/migrate/from-tauri-1/

### Verificar antes de continuar

```bash
rustc --version   # debe ser ≥ 1.77.2
rustup update stable  # si no
npx tauri dev     # debe abrir la ventana con el frontend actual
```

---

## Paso 2 — `Cargo.toml`: dependencias

### Conceptos a leer primero

- Cómo funciona `Cargo.toml` y los version specifiers: https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html
- Qué son los "features" (unidades de compilación opt-in): https://doc.rust-lang.org/cargo/reference/features.html

### Dependencias

| Crate | Propósito | Features requeridas |
|-------|-----------|---------------------|
| `tauri` | framework core, IPC bridge | `wry`, `devtools` |
| `tokio` | async runtime sobre el que corre el AWS SDK | `full` |
| `aws-config` | carga la credential chain (env vars, `~/.aws`, etc.) | `behavior-version-latest` |
| `aws-sdk-dynamodb` | cliente DynamoDB generado desde el modelo AWS | — |
| `serde` | framework de serialización/deserialización | `derive` |
| `serde_json` | implementación de serde para JSON | — |
| `serde_dynamo` | convierte `AttributeValue` → tipos serde | `aws-sdk-dynamodb+1` |
| `thiserror` | derive macro para error enums ergonómicos | — |
| `dirs` | obtiene rutas del sistema (`home_dir()`, etc.) | — |
| `configparser` | parsea archivos ini como `~/.aws/credentials` | — |

### Referencias por crate

- tauri: https://docs.rs/tauri / https://crates.io/crates/tauri
- tokio: https://docs.rs/tokio / tutorial: https://tokio.rs/tokio/tutorial
- aws-config: https://docs.rs/aws-config (credential chain: https://docs.rs/aws-config/latest/aws_config/default_provider/credentials/index.html)
- aws-sdk-dynamodb: https://docs.rs/aws-sdk-dynamodb
- serde: https://serde.rs / https://docs.rs/serde
- serde_json: https://docs.rs/serde_json
- serde_dynamo: https://docs.rs/serde_dynamo / https://crates.io/crates/serde_dynamo
- thiserror: https://docs.rs/thiserror
- dirs: https://docs.rs/dirs
- configparser: https://docs.rs/configparser

### Gotchas

**Compatibilidad serde_dynamo ↔ aws-sdk-dynamodb:** ambas crates deben ser versiones
compatibles. El feature flag de `serde_dynamo` debe coincidir con la versión del SDK que
estás usando. Verificar el README de serde_dynamo antes de compilar — una incompatibilidad
produce errores de tipo confusos.

**Tiempo de compilación:** el primer `cargo build` toma varios minutos (el SDK es grande).
Los builds incrementales son rápidos. Es normal.

---

## Paso 3 — `main.rs` + `lib.rs`: entry point async y estado compartido

### Conceptos a leer primero

- Ownership básico (fundamento de Rust): https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html
- Structs: https://doc.rust-lang.org/book/ch05-00-structs.html
- `#[tokio::main]` — macro que crea el runtime Tokio y ejecuta el async main: https://tokio.rs/tokio/tutorial/hello-tokio
- Por qué `tokio::sync::Mutex` en vez de `std::sync::Mutex` en código async: https://tokio.rs/tokio/tutorial/shared-state#on-using-stdsyncmutex

### División `main.rs` / `lib.rs` en Tauri 2.x

- `main.rs`: solo el entry point binario, llama a `lib::run()`
- `lib.rs`: contiene `pub fn run()` con el `tauri::Builder` chain

Este split existe para soportar targets mobile (que tienen un entry point distinto al binario).
Mantener la convención.

### Credential chain de `aws_config::load_from_env()`

A pesar del nombre, carga la cadena completa en este orden:
1. Variables de entorno `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
2. Web Identity Token (para EKS)
3. `~/.aws/credentials` y `~/.aws/config` (respeta `AWS_PROFILE` o usa `[default]`)
4. Container credentials (ECS)
5. EC2 instance metadata

Documentación completa: https://docs.rs/aws-config/latest/aws_config/default_provider/credentials/index.html

### Estado compartido con `.manage()`

El `Client` de DynamoDB se inicializa una vez y se comparte entre todos los commands.
Tauri provee un contenedor de estado type-safe: `.manage(valor)` en el Builder, y luego
`tauri::State<T>` como parámetro en los commands.

Para soportar cambio de perfil en runtime (Paso 7), el tipo a gestionar es
`tokio::sync::Mutex<aws_sdk_dynamodb::Client>` — **no** `std::sync::Mutex`, porque se va a
usar `.await` mientras el lock está tomado, lo cual no es seguro con la versión de std.

Referencia: https://v2.tauri.app/develop/state-management/

### Verificación del paso

Crear un command dummy que devuelva `"ok"` y verificar que el frontend puede hacer
`invoke('health_check')` antes de continuar.

---

## Paso 4 — `commands.rs`: structs y enums con serde

### Conceptos a leer primero

- Enums con datos en Rust (son mucho más potentes que en C): https://doc.rust-lang.org/book/ch06-00-enums.html
- `Option<T>` — Rust no tiene `null`, los valores opcionales son explícitos: https://doc.rust-lang.org/book/ch06-01-defining-an-enum.html#the-option-enum-and-its-advantages-over-null-values
- Derive macros: https://doc.rust-lang.org/book/appendix-03-derivable-traits.html
- Serde derive: https://serde.rs/derive.html
- Serde field attributes (`rename_all`, `tag`, `content`): https://serde.rs/field-attrs.html
- Módulos y visibilidad (`pub`): https://doc.rust-lang.org/book/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html

### `QueryParams` struct

Los campos opcionales de TypeScript se vuelven `Option<T>` en Rust. Usar
`#[serde(rename_all = "camelCase")]` en el struct para que los nombres JSON coincidan con
las convenciones del frontend (camelCase) mientras el código Rust usa snake_case.

### `SkCondition` enum

El campo `op` actúa como discriminador para tres variantes. En Rust esto es un enum con datos.
Usar `#[serde(tag = "op", content = "value")]` para el tagged enum representation.

Para el variant `Between` que necesita dos valores (`value` y `value2`), la opción más limpia
es definir un struct interno `BetweenValues { value: String, value2: String }` como payload.

Representaciones de enums en serde: https://serde.rs/enum-representations.html

### `QueryResult` struct (return type)

```rust
#[derive(Serialize)]
pub struct QueryResult {
    pub items: Vec<serde_json::Value>,
    pub truncated: bool,
}
```

### Ubicación del código

Crear `src-tauri/src/commands.rs` y declararlo como módulo en `lib.rs` con `mod commands;`.
Usar `pub` en los tipos y funciones que necesita ver `lib.rs`.

---

## Paso 5 — El comando `query_table`

### Conceptos a leer primero

- `match` expressions (el compilador fuerza exhaustividad): https://doc.rust-lang.org/book/ch06-02-match.html
- El operador `?` para propagación de errores: https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html#a-shortcut-for-propagating-errors-the--operator
- `Result<T, E>`: https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html

### Firma del command

```rust
#[tauri::command]
pub async fn query_table(
    client: tauri::State<'_, tokio::sync::Mutex<Client>>,
    params: QueryParams,
) -> Result<QueryResult, AppError>
```

Tauri docs sobre commands: https://v2.tauri.app/develop/calling-rust/

### El SDK usa el patrón "fluent builder"

`client.query()` devuelve un `QueryFluentBuilder`. Cada método en el builder devuelve el
builder, permitiendo encadenamiento. Se finaliza con `.send().await`.

- `QueryFluentBuilder` docs: https://docs.rs/aws-sdk-dynamodb/latest/aws_sdk_dynamodb/operation/query/builders/struct.QueryFluentBuilder.html
- `AttributeValue` enum: https://docs.rs/aws-sdk-dynamodb/latest/aws_sdk_dynamodb/types/enum.AttributeValue.html

### Expression attribute names

**Siempre** usar `#pk` / `#sk` como placeholders en `KeyConditionExpression` y mapearlos
al nombre real del atributo con `expression_attribute_names`. DynamoDB tiene una lista larga
de reserved words — como `pk_name` y `sk_name` vienen del usuario, siempre usar placeholders
para evitar conflictos silenciosos.

### Match sobre `SkCondition`

Un `match` sobre el enum cubre los tres variantes. El compilador fuerza que todos los
variantes estén cubiertos — si después se agrega un variante nuevo, el código no compila
hasta que se maneje. Cada brazo agrega al `KeyConditionExpression` y registra los valores
en el mapa de `expression_attribute_values`.

Para `Between`: la sintaxis DynamoDB es `#sk BETWEEN :sk AND :sk2`.

### Parámetros opcionales en el builder

Muchos métodos del SDK tienen una variante `set_*` que acepta `Option<T>` directamente,
e.g. `.set_index_name(params.index_name)`. Verificar el builder docs para cada campo.

---

## Paso 6 — `AttributeValue` → JSON con `serde_dynamo`

### El problema

DynamoDB devuelve `Vec<HashMap<String, AttributeValue>>`. El enum `AttributeValue` tiene
variantes como `S(String)`, `N(String)`, `Bool(bool)`, `L(Vec<AttributeValue>)`,
`M(HashMap<String, AttributeValue>)`, etc. No se puede serializar directamente a JSON
plano — el wrapper aparecería en el output.

### Solución con `serde_dynamo`

```rust
use serde_dynamo::from_items;

let items: Vec<serde_json::Value> = from_items(response.items().to_vec())?;
```

Maneja recursivamente todos los tipos incluyendo `NULL`, `SS`, `NS`, `BS` y tipos anidados
(`M`, `L`). Es la solución recomendada.

`from_items` docs: https://docs.rs/serde_dynamo/latest/serde_dynamo/fn.from_items.html

### Por qué no implementarlo a mano

Una implementación manual con `match` es un buen ejercicio, pero el SDK puede agregar
variantes nuevas al enum `AttributeValue` en versiones futuras. Si el match no es
exhaustivo, los datos se perderían silenciosamente.

### Gotcha: números DynamoDB

DynamoDB almacena números internamente como strings (el variante `N` contiene `String`,
no `f64`). `serde_dynamo` los convierte a `serde_json::Number` preservando precisión
completa. Una conversión manual a `f64` pierde precisión para enteros grandes (DynamoDB
soporta hasta 38 dígitos).

---

## Paso 7 — Cambio de perfil/región en runtime

### Conceptos a leer primero

- `Arc<T>` (reference counting para ownership compartido entre threads): https://doc.rust-lang.org/book/ch16-03-shared-state.html
- `Mutex<T>` y por qué es necesario para mutación compartida: https://doc.rust-lang.org/book/ch16-03-shared-state.html#using-mutexes-to-allow-access-to-data-from-one-thread-at-a-time
- Diferencia `std::sync::Mutex` vs `tokio::sync::Mutex`: https://tokio.rs/tokio/tutorial/shared-state
- I/O de archivos async en Tokio: https://docs.rs/tokio/latest/tokio/fs/index.html

### `set_aws_profile`

Usar `aws_config::from_env().profile_name("...").load().await` para cargar un nuevo config,
construir nuevo `Client`, tomar el lock del Mutex con `.lock().await` y reemplazar el valor
interior.

`ConfigLoader` docs: https://docs.rs/aws-config/latest/aws_config/struct.ConfigLoader.html

### `list_aws_profiles`

Parsear `~/.aws/credentials` y `~/.aws/config` que son archivos en formato ini.
Usar `dirs::home_dir()` para la ruta del home, `tokio::fs::read_to_string` para leer
(versión async), y `configparser` para extraer los nombres de sección.

**Nota sobre el formato:**
- En `~/.aws/credentials`: los perfiles aparecen como `[nombre-perfil]`
- En `~/.aws/config`: los perfiles no-default aparecen como `[profile nombre-perfil]` (con el prefijo `profile `)
- Deduplicar y ordenar el resultado

### Gotcha: blocking I/O en contexto async

`std::fs::read_to_string` es blocking — bloquea el thread del pool de Tokio, lo cual puede
detener otras tasks. Para archivos pequeños como los de AWS el impacto práctico es mínimo,
pero el patrón correcto es `tokio::fs::read_to_string` o envolver en
`tokio::task::spawn_blocking`.

---

## Paso 8 — Paginación

### El modelo de paginación de DynamoDB

DynamoDB retorna máximo 1MB por llamada `query`. Si hay más items, la respuesta incluye
`last_evaluated_key`. Para obtener la siguiente página se re-envía la misma query con
`.exclusive_start_key(last_evaluated_key)`. La query termina cuando `response.last_evaluated_key()` devuelve `None`.

Referencia AWS: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html

### Estrategia para un viewer

Recolectar todas las páginas en un loop hasta un límite configurable (e.g. 1,000 items o
10 páginas). Devolver `QueryResult { items, truncated: bool }` — el campo `truncated`
indica si se cortó por el límite.

```
loop {
    response = query.send().await?
    items.extend(response.items())
    if items.len() >= MAX_ITEMS || response.last_evaluated_key().is_none() { break }
    query = query.exclusive_start_key(response.last_evaluated_key()...)
}
```

Poner `MAX_ITEMS` como constante en el módulo.

---

## Paso 9 — Error handling

### Conceptos a leer primero

- Filosofía de error handling en Rust: https://doc.rust-lang.org/book/ch09-00-error-handling.html
- El trait `Error`: https://doc.rust-lang.org/std/error/trait.Error.html
- `thiserror` crate y su motivación: https://docs.rs/thiserror/latest/thiserror/

### Enfoque mínimo (para empezar)

`.map_err(|e| e.to_string())?` en cada operación fallible. Suficiente para que funcione.
El frontend recibe un string como rejection de la Promise.

### Enfoque recomendado

Definir un enum `AppError` con variantes por categoría:

```rust
#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum AppError {
    #[error("DynamoDB error: {0}")]
    Dynamo(String),

    #[error("Profile not found: {0}")]
    ProfileNotFound(String),

    #[error("IO error: {0}")]
    Io(String),
}
```

Implementar `From<SdkError<...>>` para `AppError` para que el operador `?` convierta
automáticamente los errores del SDK.

Con `Serialize` en el enum, el frontend recibe un objeto JSON estructurado en lugar de un
string, lo que permite manejo de errores específico en la UI.

Tauri docs sobre error handling: https://v2.tauri.app/develop/calling-rust/#error-handling

### Cómo Tauri propaga errores al frontend

Cuando un command retorna `Err(e)`, la Promise de `invoke(...)` en JS es rechazada con el
valor serializado de `e`. Catchearlo en TypeScript:

```ts
try {
  const result = await invoke('query_table', { params })
} catch (error) {
  // error es el AppError serializado a JSON
}
```

---

## Secuencia de implementación (progresión para aprender Rust)

Construir en este orden para tener feedback temprano en cada etapa:

```
1. Scaffold + cargo build
   → verifica resolución de versiones antes de escribir código

2. main.rs con command placeholder que devuelve string hardcodeado
   → verifica que el frontend puede invoke y recibir respuesta

3. QueryParams struct + query_table que solo imprime los params y devuelve vec vacío
   → verifica que la deserialización desde JS funciona correctamente

4. Query real contra DynamoDB sin paginación
   → primer resultado end-to-end

5. Integrar serde_dynamo
   → verificar que el JSON devuelto tiene la forma correcta

6. Paginación + QueryResult con truncated
   → manejo de datasets grandes

7. list_aws_profiles + set_aws_profile
   → cambio de perfil en runtime

8. Hardening de error handling con AppError
   → solo después de que el happy path funcione
```

---

## Recursos de Rust adicionales

| Recurso | Para qué sirve |
|---------|----------------|
| The Rust Book: https://doc.rust-lang.org/book/ | Base conceptual completa, leer cap. 4 (ownership), 6 (enums), 9 (errors), 16 (concurrencia) |
| Rust by Example: https://doc.rust-lang.org/rust-by-example/ | Ejemplos concretos para cada concepto |
| Tokio Tutorial: https://tokio.rs/tokio/tutorial | Async/await, tasks, shared state con Mutex |
| docs.rs | Documentación de cualquier crate publicado en crates.io |
| Rust Playground: https://play.rust-lang.org/ | Probar snippets sin setup local |