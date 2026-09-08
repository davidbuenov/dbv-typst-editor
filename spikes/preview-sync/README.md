# Spike S-2 — Sincronización editor ↔ vista previa

**Fecha:** 2026-09-08 · **Binario:** `typst 0.15.1 (9dfd3a08)`, el vendorizado en
`src-tauri/binaries/` · **Máquina:** Windows 11, el equipo del mantenedor.

Origen: un usuario pide lo que hacen otros editores —doble clic en el texto salta al render y
viceversa—. Hoy no es posible entre ficheros porque la vista previa compila **el fichero abierto**,
no el documento raíz.

Todo lo que sigue está medido contra el binario real. Cada número es reproducible con los scripts
de esta carpeta; los comandos exactos están al final.

---

## Veredicto

**La decisión de compilar el documento completo se sostiene, y el mecanismo de anclas funciona.**
Pero el coste no es uniforme, y eso cambia una cosa del plan:

> **El control de refresco automático/manual deja de ser una comodidad y pasa a ser un requisito.**
> En un documento a escala de tesis, compilar el documento completo cuesta **9× más** que compilar
> el capítulo (828 ms frente a 91 ms) y **supera con creces la pausa de tecleo** de 350 ms. En modo
> automático el compilador estaría corriendo prácticamente sin parar.

En proyectos pequeños —el caso mayoritario— no hay problema: el documento completo del proyecto de
demo compila en 136 ms y cabe de sobra en la pausa.

Y un hallazgo que refuerza la decisión más que cualquier medición de tiempo: **el capítulo real de
`testfiles/demo-proyecto` ni siquiera compila suelto.** Falla con
`error: label <knuth1984> does not exist in the document`. El alcance actual no es solo más lento
de lo necesario en documentos con bibliografía: es **incorrecto**, y la pista del Slice 27 es un
parche sobre ese síntoma.

---

## P1 · Buffers sucios con documento raíz — **resuelto, hipótesis A**

El riesgo identificado al planificar: `prepare_input()` escribe el espejo junto al documento
abierto, pero `main.typ` hace `#include "chapters/03.typ"` y **no incluye al espejo**. Con la vista
previa compilando el raíz, los cambios sin guardar del capítulo desaparecerían.

**La hipótesis A (raíz sombra en un temporal) funciona y es prácticamente gratis:**

| Proyecto | Construir el árbol sombra | Compilar el documento | Sobrecoste de la sombra |
| --- | --- | --- | --- |
| 43 ficheros, 0,9 MB (solo texto) | **18 ms** (copia) | 826 ms | **2 %** |
| 163 ficheros, 60,9 MB (con recursos) | **88 ms** (copia) / **58 ms** (enlace duro) | 820 ms | 7 % / 11 % |

El cuello de botella es la compilación, no la sombra. Dos notas:

- **El enlace duro solo compensa con recursos pesados.** En un proyecto de solo texto es *más
  lento* (28 ms frente a 18 ms) porque paga una llamada al sistema por fichero sin ahorrar bytes.
  La regla razonable: copiar los `.typ`/`.bib` (hay que poder sobrescribir el sucio) y enlazar el
  resto, que es exactamente lo que hace `shadowLink` en el script.
- Nunca se escribe en la carpeta del usuario, que era el requisito.

Las hipótesis B (redirigir el `#include`) y C (aceptar el desfase) quedan **descartadas por
innecesarias**. La D (esquivarlo compilando desde disco en modo manual) sigue siendo válida como
simplificación en ese modo, pero ya no hace falta apoyarse en ella.

## P2 · ¿Hay un puente nativo render→fuente? — **no**

- El API de scripting **no expone el span de origen**: `heading.fields()` devuelve
  `["level","depth","offset","numbering","supplement","outlined","bookmarked","hanging-indent","body"]`
  y `.span` da `error: heading does not have field "span"`.
- El SVG que emite `typst compile --format svg` **no lleva ninguna anotación de fuente**: los
  únicos atributos presentes son `fill`, `fill-rule`, `x`, `y`, `xlink:href`, `d`, `overflow`, `id`,
  `transform` y los del `<svg>` raíz. Ni un `data-*`, ni clases.

**Conclusión: el mecanismo de anclas inyectadas es obligatorio**, no una preferencia. Con la
arquitectura de sidecar no hay alternativa. (Herramientas como tinymist consiguen los spans porque
enlazan el compilador como crate; volver a eso contradice la decisión TYPST CLI INTEGRATION.)

## P3 · ¿Es `#metadata` neutral en el layout? — **sí, y entre bloques es byte-idéntico**

Comparando el SVG de un documento de referencia contra el mismo documento anclado:

| Variante | Resultado |
| --- | --- |
| Anclas **entre bloques** | **SVG byte a byte idéntico** (103.895 B los dos) |
| Ancla **dentro de un párrafo** | SVG distinto (+25 B), pero **layout idéntico**: los 500 glifos caen en la misma posición absoluta salvo uno que difiere 0,001 pt por redondeo |

El SVG cambia intra-párrafo porque la tirada de texto se parte en dos grupos `<g>` en el punto del
ancla; visualmente no se distingue. Aun así, **entre bloques es la opción a usar**: idéntica al
byte, no engorda el SVG y no fragmenta el texto.

## P4 · ¿`query` sobre etiqueta propia devuelve `position()`? — **sí**

```
query(<dbv-sync>).map(a => (datos: a.value, pagina: a.location().page(),
                            y: a.location().position().y, x: a.location().position().x))
```

devuelve **las dos mitades a la vez**: el payload que escribimos nosotros (fichero + línea) y dónde
aterrizó (página, x, y). Esa es la tabla de anclas bidireccional completa, con una sola pasada.

Igual que en `outline.rs`, **la `y` llega como cadena con unidad** (`"70.87pt"`), así que aplica el
mismo `parse_pt()` que ya existe.

## P5 · Coste real

**Alcance de la compilación** (mediana de 5-7 ejecuciones):

| | Un capítulo (hoy) | Documento completo | Factor |
| --- | --- | --- | --- |
| `testfiles/demo-proyecto` (3 pág) | **no compila** | 136 ms | — |
| Tesis sintética (202 pág, 42 capítulos) | 91 ms | **828 ms** | **×9,05** |

El coste por página *baja* con el tamaño (15,2 → 4,1 ms/pág): hay un coste fijo de arranque de
proceso que domina en documentos pequeños. Por eso el salto duele solo en documentos grandes.

**Coste de las anclas** (1.554 anclas, una por bloque, en los 42 capítulos):

| | Sin anclas | Con 1.554 anclas |
| --- | --- | --- |
| Compilar el documento | 871 ms | 882 ms (**+11 ms**, 0,007 ms/ancla) |
| `eval` + `query` de la tabla | 757 ms | 775 ms |

Dos lecturas importantes:

- **Las anclas son gratis.** 0,007 ms cada una; se pueden inyectar por bloque en todo el documento
  sin pensárselo.
- **La pasada de `eval` NO es gratis: cuesta otra composición completa** (757 ms es el coste base,
  con cero anclas presentes). Esto confirma la decisión ya prevista en el plan: **la tabla de
  anclas se calcula bajo demanda y se cachea**, nunca en cada pausa de tecleo. Cobrar 0,8 s en el
  clic es aceptable; cobrarlo tecleando, no.

## P6 · Precisión del camino inverso — **funciona, con dos salvedades concretas**

Sobre la tabla de 1.554 anclas del documento de 202 páginas, la heurística "ancla anterior más
cercana" acierta y **las anclas vuelven en orden de documento** (0 de 1.554 fuera de orden), así
que basta una búsqueda binaria:

```
clic en pág   1, y=100pt → chapters/01.typ:3    (ancla en pág 1, y=96.64pt)
clic en pág  50, y=400pt → chapters/11.typ:25   (ancla en pág 50, y=391.16pt)
clic en pág 120, y= 50pt → chapters/25.typ:59   (ancla en pág 119, y=658.93pt)
```

El tercer caso es interesante: un clic arriba de la página 120 resuelve correctamente al final de
la 119. La imprecisión típica es la altura de un bloque (en el caso de pág 5 el ancla queda 105 pt
por encima: un párrafo largo).

**Salvedad 1 — dos columnas rompen el orden por `y`.** Con `columns: 2`, las anclas de la segunda
columna tienen una `y` *menor* que las de la primera (4 de 14 "fuera de orden" en el fixture). Se
distinguen sin ambigüedad por la `x` (56,7 pt frente a 215,9 pt). **La clave de ordenación debe ser
(página, banda de x, y), no (página, y).**

**Salvedad 2 — los flotantes no se pueden resolver por posición.** Con
`figure(..., placement: top)`, `location().position()` de la figura devuelve **su posición en el
flujo, no dónde se dibuja**: en el fixture la figura se reporta en y=217,2 pt mientras visualmente
ocupa la parte superior de la página, y en esa zona no hay ninguna ancla por encima. Un clic sobre
una figura flotante no tiene ancla anterior válida. Mitigación para la implementación: detectar que
el clic cae en una región sin ancla previa en esa página y caer al ancla más cercana en distancia
absoluta, en vez de insistir en "la anterior".

---

## Recomendaciones para la implementación

1. **Granularidad: por bloque, en todos los ficheros.** Las anclas cuestan 0,007 ms; no hay razón
   para el escalonado en tres fases que preveía el plan. La Fase 1 (solo encabezados) se puede
   saltar salvo que se quiera entregar valor antes.
2. **Raíz sombra por copia para `.typ`/`.bib` y enlace duro para el resto.**
3. **Tabla de anclas bajo demanda y cacheada**, invalidada al editar. En modo manual nunca se queda
   obsoleta entre refrescos.
4. **Ordenar y buscar por (página, banda de x, y).** Reutilizar `parse_pt()` de `outline.rs`.
5. **Control de refresco automático/manual: obligatorio**, con el modo manual recomendado o incluso
   automático por defecto a partir de cierto tamaño de documento (el umbral natural es que la
   compilación supere la pausa de tecleo; medible en el propio arranque).
6. **Marcar la vista previa como desactualizada** en modo manual, y decidir ahí qué hacer con el
   camino inverso sobre un render viejo.

## Lo que este spike NO ha comprobado

- Nada de esto se ha probado en macOS ni en Linux. Los tiempos son de una máquina Windows concreta;
  lo que importa son las proporciones, no los valores absolutos.
- No se ha medido el impacto de la carga perezosa de páginas ya existente: al pasar a 202 páginas,
  la ventana de páginas servidas cobra más importancia de la que tiene hoy.
- No se ha evaluado `typst watch` como sustituto del `compile` en frío, que sigue siendo la salida
  natural si el coste del documento completo resulta insoportable en la práctica.
- La tesis usada es **sintética** (42 capítulos generados). Un documento real con tablas, ecuaciones
  y figuras pesadas compilará más despacio.

## Reproducir

```bash
# Proyecto sintético a escala de tesis (202 páginas)
node spikes/preview-sync/generar-proyecto.mjs /tmp/tesis 42 0

# P1 y P5 — raíz sombra: copia vs enlace duro, y coste del eval
node spikes/preview-sync/medir-raiz-sombra.mjs /tmp/tesis chapters/01.typ 5

# P5 — coste por alcance (capítulo vs documento completo)
node spikes/preview-sync/medir-alcance.mjs /tmp/tesis chapters/01.typ 7
node spikes/preview-sync/medir-alcance.mjs testfiles/demo-proyecto chapters/01-estructura.typ 5

# P3, P4, P5 y P6 — anclas: coste, tabla y camino inverso
node spikes/preview-sync/medir-anclas.mjs /tmp/tesis 5
```

Los `fixtures/` son los documentos mínimos de P3 (`q3-*.typ`), P4 (`q4-anclas.typ`) y P6
(`q6-*.typ`); se inspeccionan directamente con `typst eval`, los comandos están citados en cada
sección.
