# Spike S-3 — ¿Puede el propio render llevar el mapa al fuente?

**Fecha:** 2026-09-20 · **Estado:** medido; **decisión tomada** (`ADR-MOTOR-001`, especificada en `SPECIFICATIONS.md` §5i, v0.9.0).

## La pregunta

La sincronización editor ↔ vista previa de hoy (RF-16, `ADR-SYNC-001`) usa **anclas**
`#metadata` sembradas en una réplica del proyecto (`shadow.rs`) y solo llega al **bloque**:
el SVG que exporta el CLI de Typst lleva únicamente `<use>` de glifos, sin texto ni origen
en el fuente. Hilbert Editor (MIT) resuelve el clic → fuente cargando el crate `typst` y
leyendo el `Span` de cada glifo, pero el sentido fuente → PDF lo sigue emparejando por texto.

Este spike mide si **compilar una vez con Typst como librería** y sacar del *mismo documento*
la imagen y un mapa "trozo de página ↔ rango del fuente" da sincronización exacta en los dos
sentidos, y a qué coste. Crate independiente: no forma parte de la aplicación.

## Cómo se ejecuta

```bash
cd spikes/typst-jump
cargo build --release
./target/release/dbv-typst-jump-spike.exe "<carpeta del proyecto>" IP.typ
```

Versiones fijadas a las del sidecar vendorizado (`typst 0.15.1`): `typst`, `typst-ide`,
`typst-layout`, `typst-svg` y `typst-kit`. Las dependencias compilan en unos 2 minutos.

## Resultados — `z6-IPbook` (libro real: 224 páginas, 370.000 glifos, 45.000 palabras de prosa)

| Medida | Resultado |
| --- | --- |
| Compilación **en frío**, en proceso | 4,4 s (el CLI: ≈4,6 s) — **sin ventaja** |
| Compilación **incremental** tras escribir una palabra (principio / mitad / final del libro) | **0,54 s / 0,72 s / 0,57 s** — unas **7-8 veces** más rápida |
| SVG de una página visible, en proceso | **2-5 ms** (317-494 KB); hoy el CLI exporta las 224 (86 MB) en cada compilación |
| Mapa render↔fuente de TODO el libro (370.000 glifos) | **0,33 s** (≈1,5 ms por página; se puede hacer bajo demanda) |
| Render → fuente, `jump_from_click` oficial (3.005 clics) | misma **palabra** en el 83,8 %; sin resultado 1,7 %; **29 µs** por clic |
| Fuente → render con mapa propio, palabra a palabra (2.044 palabras de texto dibujado) | **93,5 %** con todos sus caracteres localizados; el 99,4 % de ellas en una sola línea |
| Fuente → render, **frases** de 6 palabras (908) | **87,9 %** con las 6 palabras localizadas |
| Tamaño del mapa a nivel de palabra (estimado, 12 bytes por palabra) | ≈ **0,5 MB** para las 45.000 palabras del fichero principal; algo más con los capítulos incluidos |

Una diferencia clave: **el SVG del CLI no se puede mapear al fuente y el documento en
memoria sí**. Cada glifo del documento compuesto lleva su `Span`; con `source.find(span)` y el
desplazamiento `within` se obtiene el byte exacto.

## Lo que NO dicen estas cifras (límites honestos)

- El 83,8 % y el 87,9 % son **suelos**, no techos. La métrica es tosca (compara palabras
  alfanuméricas): cuentan como fallo las ligaduras, las comillas tipográficas, la
  hifenación y el texto generado (numeración, "Figura 1:"), que no tiene fuente propio.
- Un `jump_from_cursor` oficial devuelve la posición del **fragmento de texto**, no de la
  palabra (la ida y vuelta salió al 12 %). Para marcar una palabra o una frase hay que usar
  el mapa propio, como aquí.
- **Ecuaciones, referencias (`@sec-x`), listas y tablas** no se han medido por separado.
  Hilbert dedica código propio a las referencias y a las ecuaciones numeradas
  (`walk` en su `jump.rs`); habría que replicarlo y medirlo.
- La compilación **no se puede cancelar** a medias en proceso (el CLI sí, matando el
  proceso): habría que ejecutarla en un hilo aparte y descartar los resultados obsoletos.
- Los paquetes `@preview` que no estén ya en la caché exigen un descargador propio
  (aquí es `Offline`).
- Se compiló contra el proyecto ORIGINAL en disco, sin réplica; los cambios sin guardar del
  editor entrarían como `overrides` en memoria, que es lo que hace `SpikeWorld::edit`.

## Conclusión provisional

Compilar en proceso no acelera el arranque en frío, pero **convierte cada edición en una
operación de ≈0,6 s en vez de ≈5 s**, permite exportar solo las páginas visibles, elimina la
réplica del proyecto, las anclas y el reintento sin anclas, y da un mapa exacto por palabra en
las dos direcciones a partir del mismo documento que se ve. `ADR-SYNC-001` era correcta
para la arquitectura de sidecar ("Typst no ofrece ningún puente" en el CLI); con la librería
el puente sí existe (`typst-ide`, y los `Span` de cada glifo).

Decisión (2026-09-20): sidecar → crate para la vista previa, con el motor clásico como respaldo automático (`ARCHITECTURE.md` §7.17).
