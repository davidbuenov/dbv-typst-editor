# Spike: sandboxing de `jogs` (RF-38, v0.6.0)

**Pregunta (R-38 del `implementation_plan.md`):** ¿tiene el motor QuickJS embebido en el
paquete `@preview/jogs:0.2.4` algún límite propio de tiempo de ejecución, o un script
`eval-js` en bucle infinito cuelga el proceso `typst` sin autolimitarse?

**Método:** compilar los dos ficheros de este directorio contra el binario vendorizado
real (`src-tauri/binaries/typst-x86_64-pc-windows-msvc.exe` v0.15.1), midiendo el
resultado con un `timeout` de shell externo.

## `basic.typ`

```typst
#import "@preview/jogs:0.2.4": eval-js
#eval-js("1 + 1")
```

Compila sin incidentes. El paquete se descarga (362,6 KiB) y se cachea la primera vez.

## `infinite.typ`

```typst
#import "@preview/jogs:0.2.4": eval-js
#eval-js("while(true){}")
```

**Cuelga el proceso `typst` de forma indefinida.** Con `timeout 20`, el proceso seguía
vivo a los 20 s (código de salida 124, el de `timeout` al matar por exceder el plazo, no
uno emitido por `typst`). QuickJS embebido en `jogs` **no tiene su propio límite de
tiempo de ejecución** — el límite lo tiene que poner quien lo invoca.

## Consecuencia

`typst_engine::compile::run_cancelable` (`src-tauri/src/typst_engine/compile.rs`) ya
mata el proceso anterior antes de cada compilación nueva, así que la vista previa en
vivo se autocura sola con la siguiente pulsación. Pero una operación de un solo disparo
(exportar a PDF/PNG) no tiene ningún "siguiente intento" que la rescate. Por eso se
añadió `COMPILE_TIMEOUT` (45 s) directamente en `run_cancelable`, que mata el proceso y
devuelve `TypstError::TimedOut` si se agota — protege cualquier compilación, no solo las
que usan `jogs`. Detalle completo en `memory.md`, `ADR-JOGS-001`, actualización del
2026-09-11.
