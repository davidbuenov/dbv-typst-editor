# Lista de pruebas — DBV Typst Editor (sesión Beta, 2026-09-05)

> 22 slices construidos en una sesión autónoma (v0.2 completo + Beta funcionalmente
> completa salvo lo bloqueado), ninguno probado todavía en la ventana real. Ordenada
> de más a menos arriesgado: lo que toca el DOM/WebView primero, que es donde ya han
> aparecido los fallos reales de este proyecto (ver el Slice 11).
>
> No hace falta hacerla toda de una sentada. Si algo falla, basta con anotar qué
> hiciste y qué viste — el diagnóstico lo hago yo después.

## 1. Arranque y regresión general (antes que nada)

- [X] La app arranca limpia, sin banda roja de error.
- [X] Abrir un proyecto existente, editar, ver que la vista previa sigue actualizándose sola.
- [X] Guardar, Guardar como, y el flujo de conflicto (editar el mismo fichero desde fuera de la app).

## 2. Barra de herramientas del editor (RF-13) — lo más nuevo y lo más probable de fallar

- [ ] Cada botón de **Formato** (B, I, S, `</>`, x², x₂): probar con texto seleccionado y sin seleccionar.
    Maravilloso, por ejemplo si pruebo a poner ** me dice lo siguiente, pero en cuando escribo un texto se arregla, funcionamiento impecabla
warning: no text within stars
   ┌─ \\?\D:\bueno\Descargas\typst-editor\.dbv-preview.typ:17:22
   │
17 │ Plantea el *problema*,** sitúa el trabajo en la literatura y anticipa la
   │                       ^^
   │
   = hint: using multiple consecutive stars (e.g. **) has no additional effect
  Mejoraría que la consola de error solo tiene dos filas y no se ve muy bien todo eltexto. ese panel vertical de la consula debajo del la vista previa debería poder modificarse con el raton como los paneles verticales

- [X] **Alternancia**: seleccionar texto, pulsar Negrita dos veces seguidas → debe quitar el marcado, no anidarlo (`**doble**`).
- [ ] **Sensibilidad al contexto**: escribir `$ x $`, poner el cursor dentro → los botones de Formato deben verse atenuados/deshabilitados y el grupo Typst debe pasar al frente.
  Los botones de formato se ven atenuados pero el botón del sumatorio (Galeria de Simbolos) al pulsarlo no muestra nada
- [X] Encabezados H1/H2/H3 y las 3 listas (viñetas, numerada, términos): cambiar de una a otra en la misma línea debe sustituir el marcador, no apilarlo.
- [X] Los 7 atajos de teclado (Ctrl/Cmd+B, +I, +E, +K, +Shift+1/2/3) funcionan con el foco en el editor.
- [X] Tooltips: pasar el ratón por cada botón, que se lea bien en ES y en EN (botón de idioma en la cabecera).

## 3. Los cuatro asistentes con formulario (§7.7.4)

- [ ] **Cite**: abre un desplegable con las claves del `.bib` del proyecto, se puede filtrar escribiendo, clic inserta `#cite(<clave>)`.
 No muestra el desplegable, sigue sin hacer nada.
- [ ] **"+ Nueva entrada bibliográfica"** al final del desplegable de citas: probar los 6 tipos (artículo, libro, actas, tesis doctoral, TFM, otro), que la clave se autosugiera de autor+año, que avise si la clave ya existe, y que al guardar aparezca en `refs.bib` **y** se inserte la cita en el cursor.
Como no se ve el desplegable de citas esto no aparece
- [ ] **Σ (símbolos)**: se abre la galería, el filtro de texto funciona (probar "alfa" o "flecha"), clic inserta el símbolo — dentro de `$...$` sin `$` extra, fuera con `$...$` añadido.
  Al pulsar en el sumatorio no se abre la galería de simbolos

- [ ] **Tabla**: diálogo de filas/columnas/cabecera; la cabecera debe usar `table.header(...)` y el cursor debe caer en la primera celda del cuerpo, no en la cabecera.
No funciona el botón de tabla, no hace nada.
- [X] **Fig** (figura): abre un selector nativo de fichero de imagen — elegir una y comprobar que se copia a `images/` e inserta la figura.
Funciona genial.
- [X] **Arrastrar una imagen** desde el explorador del sistema directamente sobre el editor — el que más preocupa, porque usa una API de Tauri que no se pudo probar de ninguna forma en esta sesión.
Funciona perfectamente

## 4. Outline (esquema del documento)

- [X] Botón de la cabecera del árbol de proyecto (☰) abre el panel.
Funciona perfectamente, pero me gusta más como está hecho en DBV Markdown Reader en el panel Indice/Archivos que podría hacersi igual aquí en Proyect/Outline. Si no tienes acceso dimelo, estás autorizado a acceder al proyecto dbv-mdreader
- [X] Los encabezados aparecen indentados por nivel.
- [X] Clic en uno navega la vista previa a la página y posición correctas (probar con un documento de varias páginas, como el TFG de ejemplo).

## 5. Modos de escritura

- [ ] Los 4 botones (E/W/D/L) en la cabecera cambian el layout: Edición (todo), Escritura (solo editor), Dividido (editor+preview), Lectura (solo preview a pantalla completa).
Preferiría el modelo tambien de DBV Markdown Reader donde se desactiva el editor, y el apartado indice/archivos con un botón cada uno
aquí podría ser parecido. Un boton para ocultar el marco proyecto/esquema, otro para ocultar/mostrar el editor y un tercer para ocultar mostrar la vista previa, pertiendo así más libertad al usuario para tener las combinaciones que quiera, que se expanden siempre para ocupar todo el espacio.
- [ ] **Importante**: en modo Lectura, comprobar que se puede volver a otro modo sin recargar la app (el conmutador debe seguir visible).
Si funciona el cambio, pero aunque el modo lectura como tal va a desaparecer por el ajuste del apartado anterior. debería estar ocupando todo el ancho de la pantalla, no solo el centro.
- [X] Cerrar y reabrir la app: el modo debe recordarse.

## 6. Terminal avanzado

- [X] Botón `>_` de la cabecera abre el panel.

- [X] Escribir `--version` o `fonts` y pulsar Enter — debe mostrar la salida real del compilador.
Funciona perfecto, pero añadiría una frase al inicio indicando qué es esto y poniendo por ejemplo lo que se ha puesto en lesta misma linea de fonts o ---version
Además la ventana del terminal, debería tener una X para cerrarse (aunque se puede cerrar en el menú) y que pudiera arrastrarse para moverlo.
Estaría también bien un botón de clear que borre el terminal
- [X] Probar un comando que falle (sintaxis mal escrita) y comprobar que se ve el error.

## 7. Exportación

- [X] **PNG**: botón junto a "Exportar PDF" — exporta la página que se está leyendo ahora mismo en la vista previa (no necesariamente la primera).
- [X] **Project Archive**: "Exportar proyecto" desde la cabecera (crea un `.dbvt`), luego "Importar proyecto" desde el lanzador con ese mismo archivo — comprobar que el proyecto restaurado es idéntico.

## 8. Las 4 plantillas nuevas

- [X] Crear un proyecto con cada una: **TFM**, **Tesis doctoral**, **Informe técnico**, **Presentación**.
- [X] Tesis doctoral: revisar que la dedicatoria/agradecimientos/resumen+abstract/apéndice se vean razonables.
- [X] Presentación: comprobar que el formato 16:9 se vea bien y que el salto entre diapositivas funcione.

## 9. Instancia única

- [ ] Con la app abierta, hacer doble clic en otro `.typ` desde el explorador del sistema — debe enfocar la ventana existente y abrir ese documento, **no** lanzar una segunda ventana.
NO he podido probarlo no tenía el ejecutable, lo había lanzado con start.md

## 10. Lo que no se puede probar sin un Mac

El menú nativo de macOS (Slice 24) no se ha compilado nunca — si en algún momento hay acceso a un Mac, sería la prueba más valiosa de todas, pero no es urgente si no se tiene a mano.
