# Plan — React: Query Builder & Playground

## Archivos nuevos

```
src/
  types/query.ts              ← tipos compartidos (QueryParams, SkCondition, QueryResult)
  utils/patternParser.ts      ← parser de "USER#<USER_ID>" → variables + resolve()
  lib/dynamo.ts               ← capa de I/O: invoke real o error si no hay runtime Tauri
  components/
    QueryBuilder.tsx           ← formulario generado desde el schema
    QueryPlayground.tsx        ← shell del panel: lifecycle + estado de la query
    QueryResults.tsx           ← tabla + toggle JSON
```

---

## Prerrequisito: extender la interfaz GSI

Antes de codear cualquier componente, agregar dos campos a `GSI` en `src/types/schema.ts`:

```ts
pkAttr: string    // nombre real del atributo DynamoDB, e.g. "GSI1PK"
skAttr?: string
```

Y actualizar cada entrada de GSI en `src/data/schema.ts` con esos valores. Sin esto no se puede
construir `QueryParams.pk_name` para queries sobre GSIs — es un data-entry task, no arquitectura.

---

## Paso 1 — `src/utils/patternParser.ts`

### Qué construir

Un módulo puro (sin dependencias React) que exporta `parsePattern(pattern: string): ParsedPattern`.

```ts
interface ParsedPattern {
  raw: string
  variables: string[]                  // ["USER_ID"]
  segments: PatternSegment[]           // [{type:'literal', value:'USER#'}, {type:'variable', name:'USER_ID'}]
  resolve(values: Record<string, string>): string
}

type PatternSegment =
  | { type: 'literal';  value: string }
  | { type: 'variable'; name: string  }
```

### Cómo funciona

Un único scan con `/<([^>]+)>/g` extrae los nombres de variables y determina los límites de
los segmentos. No hay brackets anidados ni opcionales en el schema — el lenguaje de patrones
es deliberadamente simple.

### Casos edge importantes

- `USER#<USER_ID>` → 1 variable con prefijo literal
- `STATUS#<status>#<createdAt>#<orderId>` → 3 variables interleaved
- `"PRODUCT"` (SK literal, sin variables) → `variables: []`, el QueryBuilder no renderiza
  inputs para ese key — este caso debe manejarse limpiamente

El modelo `segments[]` cubre los tres uniformemente.

---

## Paso 2 — `src/types/query.ts`

Archivo solo de tipos, sin imports de React ni schema. Establece el vocabulario compartido:

```ts
type SkCondition =
  | { op: 'Eq';         value: string }
  | { op: 'BeginsWith'; value: string }
  | { op: 'Between';    value: string; value2: string }

interface QueryParams {
  table:         string
  pk_name:       string
  pk_value:      string
  sk_name?:      string
  sk_condition?: SkCondition
  index_name?:   string
}

interface QueryResult {
  status:      'idle' | 'loading' | 'success' | 'error'
  data:        Record<string, unknown>[]
  error?:      string
  durationMs?: number
}
```

`QueryParams` es el tipo exacto que va al comando Rust — no agregar campos extra aquí.

---

## Paso 3 — `src/lib/dynamo.ts`

### Estrategia: Tauri o nada

```ts
export async function queryTable(params: QueryParams): Promise<Record<string, unknown>[]> {
  if (!window.__TAURI_INTERNALS__) {
    throw new Error('Query execution is only available in the desktop app.')
  }
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('query_table', { params })
}

export const isTauriRuntime = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
```

No hay mock. Si no estamos en Tauri, la función lanza. El caller (`QueryPlayground`) captura
ese error y lo muestra como `QueryResult` con `status: 'error'`. La UI puede detectar
`isTauriRuntime()` al montar para deshabilitar el tab "Query" o mostrar un aviso estático.

### Por qué dynamic import para `@tauri-apps/api/core`

Si el import es estático, Vite intenta resolver el módulo en build time. Cuando el paquete
no está instalado (o cuando se hace build para web), falla. El dynamic import solo se ejecuta
si llegamos al branch de Tauri, por lo que nunca se intenta resolver en entornos web.

### Dónde vive

`src/lib/` — la convención `lib/` señala "boundary de I/O", distinto de `utils/` que es para
funciones puras. Un lector del proyecto sabe que `lib/` toca el exterior.

---

## Paso 4 — `src/components/QueryBuilder.tsx`

### Props (componente controlado)

```ts
interface QueryBuilderProps {
  entity:          Entity
  tableName:       string
  // estado controlado desde QueryPlayground
  selectedTarget:  'base' | string        // 'base' o nombre del GSI
  pkValues:        Record<string, string>
  skOp:            'Eq' | 'BeginsWith' | 'Between' | 'none'
  skValues:        Record<string, string>
  sk2Values:       Record<string, string> // solo para Between
  onChangeTarget:  (target: 'base' | string) => void
  onChangePkValues:(values: Record<string, string>) => void
  onChangeSkOp:    (op: 'Eq' | 'BeginsWith' | 'Between' | 'none') => void
  onChangeSkValues:(values: Record<string, string>) => void
  onChangeSk2Values:(values: Record<string, string>) => void
  onSubmit:        (params: QueryParams) => void
}
```

**Por qué controlado:** el estado vive en `QueryPlayground`. Esto es necesario para el
pre-llenado desde access patterns (Paso 7) sin mecanismos de reset complejos.

### Renderizado del PK

Los `PatternSegment[]` de `parsePattern(activePk)` se renderizan como una fila inline:
- Segmento `literal` → `<span>` monoespacio estático (mismo estilo que los code chips del inspector)
- Segmento `variable` → `<input>` controlado con `placeholder={segment.name}`

La fila completa forma visualmente el key: `USER# [input:USER_ID]`.

### GSI switcher

Pill-tabs horizontales: "Base Table" + un tab por cada `entity.gsis`. Al cambiar:
- Recalcular los patrones del PK/SK activo
- Actualizar `pk_name`/`sk_name` en el payload final usando `gsi.pkAttr` / `gsi.skAttr`

### SK condition picker

3 botones: `=` / `begins_with` / `between` + opción `none` (query solo por PK, válido en
DynamoDB). `Between` muestra dos filas de SK inputs: "from" y "to", usando `skValues` y
`sk2Values` respectivamente.

### Guard de submit

Botón "Execute" deshabilitado si alguna variable del PK activo tiene string vacío.
Las variables de SK solo se validan cuando `skOp !== 'none'`.

---

## Paso 5 — Modificar `src/components/PartitionShelf.tsx` + `QueryPlayground.tsx`

### Integración en el layout

Convertir la columna derecha en un panel con dos tabs — **Schema** (el `EntityInspector`
actual) y **Query** (el nuevo `QueryPlayground`). El tab strip usa el mismo estilo
`border-b-2` que `PartitionSelector` para consistencia visual.

El estado del tab activo vive en `PartitionShelf`:

```ts
const [activeTab, setActiveTab] = useState<'schema' | 'query'>('schema')
```

### `QueryPlayground.tsx`

Props: `entity: Entity`, `tableName: string`, `initialPattern?: string`.

Estado interno:
- Todo el estado del formulario (`selectedTarget`, `pkValues`, `skOp`, `skValues`, `sk2Values`)
- `queryResult: QueryResult` (inicializado como `{status:'idle', data:[]}`)

Lifecycle:
1. `QueryBuilder` llama `onSubmit(params)`
2. Playground setea `status:'loading'`
3. Llama `queryTable(params)` de `dynamo.ts`
4. `status:'success'` con los items, o `status:'error'` con el mensaje

Detectar `isTauriRuntime()` al montar: si es `false`, mostrar un mensaje estático indicando
que la ejecución solo está disponible en la app de escritorio. No renderizar el formulario.

---

## Paso 6 — `src/components/QueryResults.tsx`

| Estado | Qué renderizar |
|--------|----------------|
| `idle` | Texto sutil: "Run a query to see results" — centrado, muted |
| `loading` | Skeleton `animate-pulse` — 3 filas de rectangulos grises. Sin spinner |
| `success` | Tabla scroll horizontal + badge "{n} items". Toggle "Table / JSON" |
| `error` | Mensaje rojo compacto con el texto del error |

**Columnas de la tabla:** unión de keys de todos los rows, PK y SK siempre primero, resto
ordenado alfabéticamente.

**Vista JSON:** `<pre>` con `bg-slate-950 text-slate-100` (mismo dark que `AppSidebar`) para
distinguirlo visualmente como raw data.

---

## Paso 7 — Access Pattern shortcuts (modificar `EntityInspector.tsx`)

Cada item de la lista de access patterns recibe un botón "Use" (ícono `Play`). Al clicar,
dispara `onUsePattern(pattern: string)` hacia arriba.

**Cadena de propagación:**

```
EntityInspector.onUsePattern(pattern)
  → PartitionShelf: setActiveTab('query'), pasa pattern a QueryPlayground
    → QueryPlayground: useEffect keyed en initialPattern, pre-llena el estado
      → QueryBuilder recibe los nuevos valores por props
```

**Parser de access patterns:**

Los patrones son texto libre, pero consistentemente incluyen la notación de keys entre
paréntesis, e.g. `"Listar órdenes (GSI1 PK=USER#<userId>)"`. Un parser liviano extrae
la cláusula entre el último par de paréntesis e identifica:
- Prefijo de índice (`GSI1`) → `selectedTarget`
- `PK=<valor>` → `pkValues` pre-llenados
- `begins_with SK=<valor>` / `SK=<valor>` → `skOp` + `skValues`

El parser falla silenciosamente (devuelve lo que pudo parsear, deja vacío el resto).

---

## Secuencia de implementación

```
1. query.ts                         (sin dependencias, desbloquea todo)
2. patternParser.ts                 (puro, testeable en aislamiento)
3. Extender GSI en schema.ts/data   (data entry)
4. dynamo.ts                        (I/O boundary)
5. QueryBuilder.tsx  ←┐             (paralelo)
   QueryResults.tsx  ←┘
6. QueryPlayground.tsx              (integra los anteriores)
7. Modificar PartitionShelf.tsx     (tab strip + render condicional)
8. Modificar EntityInspector.tsx    (botones "Use" en access patterns)
```

---

## Decisiones clave

| Decisión | Razonamiento |
|----------|-------------|
| `QueryBuilder` controlado | Necesario para pre-llenado desde access patterns sin mecanismos de reset |
| Tab en columna derecha, no layout nuevo | Evita cirugía en el grid responsivo de `App.tsx` |
| Dynamic import de `@tauri-apps/api/core` | Vite no falla en entornos sin Tauri instalado |
| No mock, error explícito si no hay Tauri | Las queries requieren credenciales AWS reales; un mock no aporta valor funcional y puede dar falsa sensación de funcionamiento |
| `segments[]` como modelo central | Sirve para renderizar el formulario Y para `resolve()` — un solo parse, dos consumidores |