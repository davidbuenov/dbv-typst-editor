# Spike S-4 — ¿Retirar el motor clásico? (RF-67, v0.10.0)

> **Qué es esto:** un informe de medida, no una decisión. El `/plan` de v0.10.0 pidió cifras reales
> antes de decidir si se retira el motor clásico de vista previa (réplica + anclas, `typst_engine/`)
> ahora que el motor en proceso (`engine/`) es el predeterminado y ya se validó en ventana real.
> **El usuario elige entre (a) retirar, (b) conservarlo sin mantenimiento activo o (c) dejarlo como
> está hoy, después de leer esto.** Fecha: 2026-09-22.

## 0. Lo que este informe NO pudo medir en esta sesión (léase primero)

Para que las cifras de abajo no parezcan más completas de lo que son:

- **Frecuencia real del respaldo en producción.** La aplicación es offline-first y no manda
  telemetría, por diseño (`SPECIFICATIONS.md` §8, "cero llamadas de red obligatorias"). No hay forma
  de saber, sin preguntárselo al usuario y a quien pruebe la app, cuántas veces el motor en proceso ha
  entrado en pánico, se ha colgado o ha diferido del CLI desde que es el predeterminado.
- **Memoria con `z6-IPbook` (224 páginas) en esta sesión.** Es un fichero personal del usuario, no
  está en el repositorio. Las únicas cifras de memoria de abajo son las que ya midió `/plan` de v0.9.0
  sobre ese mismo libro (citadas, con fecha, no repetidas aquí).
- **Tamaño del ejecutable SIN el motor clásico.** No se ha hecho un build de prueba retirando el
  código: como se ve en el §2, `compile.rs` mezcla exportación (que se queda) con vista previa clásica
  (candidata a irse) en el mismo fichero — separarlas seguras para medir el tamaño real habría sido ya
  media hora de cirugía de código sin garantía de que compile, y esta sesión no tenía autorización para
  tocar el motor de exportación a ciegas. Es el primer paso si se decide seguir adelante con (a).
- **Tiempo de CI sin el motor clásico.** No medido, por la misma razón: no hay un build aislado que
  cronometrar.

Lo que sí se ha podido medir hoy, real y verificable, está en los apartados siguientes.

## 1. Inventario de código (medido hoy, 2026-09-22)

```
$ wc -l src-tauri/src/typst_engine/*.rs
  1108 compile.rs
  1227 shadow.rs
   154 sync.rs
   306 mod.rs
   174 outline.rs
   110 equation.rs
   108 dot.rs
  3187 total

$ wc -l src-tauri/src/engine/*.rs   (motor en proceso, para comparar tamaño)
  3117 total

$ find src-tauri/src -name '*.rs' | xargs wc -l | tail -1
 13154 total   (todo el backend Rust)
```

**No todo `typst_engine/` es "motor clásico retirable".** Desglose real, fichero a fichero:

| Fichero | Líneas | ¿Qué es? | ¿Se queda o se retira si se elige (a)? |
| --- | --- | --- | --- |
| `shadow.rs` | 1227 | Réplica temporal del proyecto + siembra de anclas `#metadata` (RF-16 clásico). | **Se retira entero.** |
| `sync.rs` | 154 | Resolución de anclas para el salto editor↔vista previa clásico. | **Se retira entero.** |
| `compile.rs` | 1108 | **Mezclado.** `typst_compile_preview`/`typst_preview_page`/`typst_cancel_preview` (~125+21+11 líneas) y `remap_shadow_root` (~177 líneas) son vista previa clásica. Pero **`typst_export_pdf`/`typst_export_png`** (~393 líneas) viven en el MISMO fichero y usan la MISMA `PreparedInput` — exportar sigue con el CLI decida lo que decida el usuario sobre el motor de vista previa (decisión de 0.9.0, sin tocar). | **Solo ~334 de 1108 líneas son retirables**; el resto se queda y habría que extraerlo con cuidado a otro módulo. |
| `mod.rs` | 306 | Construcción de comandos del sidecar, compartida por preview clásico Y exportación. | **Se queda** (con ajustes menores). |
| `outline.rs` | 174 | Esquema del documento vía `typst eval` — **sigue con el CLI en esta versión** (`ADR-MOTOR-002`, decisión 4), no depende de qué motor de preview esté activo. | **Se queda.** |
| `equation.rs` | 110 | Vista previa en vivo del editor de ecuaciones (RF-46) — un asistente aparte, no el documento principal. | **Se queda.** |
| `dot.rs` | 108 | Vista previa en vivo del asistente DOT/Graphviz (RF-51) — igual que `equation.rs`. | **Se queda.** |

**Total realmente retirable en Rust: ≈ 1.715 líneas** (`shadow.rs` + `sync.rs` + la porción de
`compile.rs`), no las 3.187 de todo `typst_engine/` — **el 13 % del backend**, no el 24 % que sugeriría
sumar el directorio entero.

**Lado JavaScript** (medido con `grep`/`wc -l`):
- `src/preview/syncAnchors.js` (116 líneas) + su test (134 líneas): sincronización por anclas del
  motor clásico — **retirable entero**.
- `src/preview/preview.js` y `src/main.js` tienen **4 y 9 referencias a `classic`/`engineMode`**
  respectivamente, repartidas (no aisladas en una función): retirar el motor clásico exige revisar cada
  una a mano, no borrar un fichero.

## 2. Tamaño del binario (lo único medible sin recompilar)

El único dato real disponible es el **build combinado actual** (ambos motores, release de la 0.9.0,
`src-tauri/target/release/dbv-typst-editor.exe`, generado el 2026-09-20):

```
63.556.096 bytes ≈ 60,6 MiB
```

**Lectura importante:** el salto de tamaño de la Store entre v0.8.0 y v0.9.0 (≈ 61 MB → ≈ 80 MB del
`.msix`, +19 MB) casi con toda seguridad viene de las **dependencias nuevas** del motor en proceso
(`typst`, `typst-ide`, `typst-layout`, `typst-svg`, `typst-kit` como librería) — que se quedan decida lo
que decida el usuario sobre el motor clásico, porque el motor NUEVO es el que ya es predeterminado. El
código exclusivo del motor clásico (§1) es lógica propia delgada (~1.700 líneas Rust + ~250 JS), **no
arrastra ninguna dependencia adicional** más allá de lo que ya hace falta para el sidecar del CLI (que
sigue haciendo falta de todos modos, para exportar). Por eso es improbable que retirarlo reduzca el
tamaño del ejecutable de forma perceptible — la mayor parte del peso no está ahí.

## 3. Memoria del motor en proceso

### 3.1. Corpus sintético (medido hoy, 2026-09-22, `npm run verify:engine`)

```
frío: 297,231 ms · 360 páginas
edición: mediana 63,607 ms · primeras 10: 139,311 ms · últimas 10: 61,806 ms
memoria: 842 MB tras 10 ediciones → 1.046 MB tras 40 (+24 %, sin fuga sin techo)
```

Sin regresión frente a lo esperado (el corpus sintético, no `z6-IPbook`): la compilación en frío y la
mediana de edición siguen en el orden de lo medido en `/plan` de 0.9.0, y el crecimiento de memoria
(+24 % entre la edición 10 y la 40) es del mismo orden que el +17 % que ya se había registrado entonces
— variación normal entre corridas, no una fuga nueva.

### 3.2. Libro real `z6-IPbook`, 224 páginas (citado, medido en `/plan` de 0.9.0 — 2026-09-20, NO repetido hoy)

Sobre `z6-IPbook` (224 páginas), de `ADR-MOTOR-002` (`memory.md`):

| Estrategia de caché | Pico de memoria | Coste por edición |
| --- | --- | --- |
| `comemo::evict(10)` | 3,49 GB | — |
| `comemo::evict(2)` (elegido) | **2,75 GB** | **0,50 s** |
| `comemo::evict(0)` | 3,08 GB | 3,4 s (sin caché incremental) |
| CLI (referencia) | 2,3 GB | ≈ 4,6 s por compilación completa |

El motor en proceso usa **más memoria de pico** que el CLI clásico (2,75 GB frente a 2,3 GB) a cambio de
ser **~9× más rápido por edición**. Esto es un argumento A FAVOR de conservar el clásico como red de
seguridad en máquinas con poca RAM, no un argumento para retirarlo.

## 4. Disparadores del respaldo automático (RF-56.6) — análisis de diseño, sin datos de uso real

Sin telemetría (§0), esto es lo que se puede decir por diseño, no por medición:

- **Pánico dentro de `typst::compile`:** contenido con `catch_unwind` (`engine/worker.rs`); sin motor
  clásico, el usuario se quedaría **sin ninguna vista previa** hasta que se resuelva la causa (recargar
  no ayuda si el pánico es determinista sobre ese documento).
- **Tiempo máximo de 45 s:** en un documento grande con una operación cara (imagen enorme, tabla
  gigante), hoy degrada a "más lento pero funciona" (motor clásico). Sin él, sería "vista previa
  congelada indefinidamente" hasta que el hilo se abandone y se reintente, sin ninguna imagen mientras
  tanto.
- **Incompatibilidad de versión** (crates `typst*` ≠ versión del sidecar): hoy no debería dispararse en
  producción (hay un test que lo exige), pero protege contra un error humano al actualizar el
  vendorizado.
- **Paridad con el CLI:** el motor en proceso es una reimplementación (aunque comparte el crate
  `typst`); no hay un conjunto de fixtures que compare byte a byte su SVG contra el del CLI para el
  catálogo de Universe con paquetes de terceros — el respaldo es también la red de seguridad para esos
  casos no cubiertos por el corpus sintético de `testfiles/`.

## 5. Comparación de las tres opciones

| | (a) Retirar | (b) Conservar sin mantenimiento activo | (c) Dejarlo como está hoy |
| --- | --- | --- | --- |
| Ahorro de código | ~13 % del backend Rust + ~250 líneas JS, con cirugía de riesgo en `compile.rs` (export y preview clásico entrelazados) | Ninguno inmediato | Ninguno |
| Ahorro de binario/CI | Probablemente pequeño (§2: el peso está en las dependencias del motor nuevo, no en esta lógica) | Ninguno | Ninguno |
| Red de seguridad ante pánico/cuelgue/incompatibilidad | **Desaparece** | Se conserva, con el riesgo de que se pudra sin nadie arreglándolo si cambia algo alrededor | Se conserva, mantenida |
| Coste de mantenimiento futuro | Cero (ya no existe) | Bajo pero no cero (revisar que sigue compilando en cada versión) | El de siempre |
| Riesgo de esta decisión ahora mismo | Alto: sin datos de uso real ni build de prueba, es una apuesta | Bajo | Ninguno |

## 6. Recomendación

**(c) Dejarlo como está hoy** — el motor en proceso predeterminado, el clásico como respaldo mantenido
— es lo que este informe recomienda, con el nivel de certeza que dan los datos disponibles (§0 dice
claramente lo que falta por medir). Razones, de mayor a menor peso:

1. El ahorro real es incierto y probablemente pequeño (§2): no hay una dependencia grande que retirar,
   solo lógica propia delgada que además comparte fichero con la exportación (§1), lo que convierte
   "retirar" en "operar con cuidado dentro de `compile.rs`", no en borrar una carpeta.
2. El motor en proceso, aunque validado por el usuario, sigue siendo relativamente joven (una versión
   en uso) y sin telemetría que confirme con qué frecuencia hace falta el respaldo — quitarlo ahora es
   apostar a que no hará falta, sin poder comprobarlo.
3. Usa **más memoria de pico** que el CLI (§3): en una máquina modesta, el respaldo automático no es
   solo una red de seguridad ante errores, también es la opción cuando el motor rápido se queda sin RAM.

Si el usuario prefiere (a) de todos modos, el primer paso real —no hecho en esta sesión— es separar
`typst_export_pdf`/`typst_export_png` de `typst_compile_preview` en ficheros distintos DENTRO de
`compile.rs`, con los tests de exportación en verde antes y después, y solo entonces medir el binario
sin el resto. Eso sería un `/spec` y un `/plan` propios, como ya preveía `SPECIFICATIONS.md` RF-67.4.
