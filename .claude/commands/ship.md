---
description: Fase Ship del ciclo SDD (dbv-specs-ops) — versionado, changelog y release
---
Ejecuta ahora la fase **Ship** (`/ship`) del ciclo Spec→Plan→Build→Test→Simplify→Ship definido en
`dbv-specs-ops/docs/MASTER_PROMPT.md` (`<workflow>`, paso 6). No cierres esta fase si quedan hallazgos
Crítico sin resolver de la revisión de `/code-simplify` (`dbv-specs-ops/docs/REVIEW.md`). Actualiza el
`README.md` de la raíz, completa `dbv-specs-ops/walkthrough.md`, pregunta el tipo de versión (Patch/Minor/
Major), publica `dbv-specs-ops/CHANGELOG.md` y propone el commit + tag de git (sin hacer push).

**Regla propia de este proyecto (se publica en Microsoft Store, ID `9PCPSVTNJMP0`):** genera SIEMPRE
`notasActualizacionStore_vX.Y.Z.md` en la raíz del repositorio, con el mismo formato que las versiones
anteriores (`notasActualizacionStore_v0.5.0.md` es la plantilla) — novedades ES/EN para el campo de la
Store (máx. 1.500 caracteres), Submission Notes en inglés con guía de prueba de 2 minutos adaptada a lo
nuevo de esta versión, y el checklist de verificación del `.msix` de `dbv-specs-ops/docs/MICROSOFT_STORE.md`
§6. No es opcional ni depende de que el usuario lo pida esta vez: es una entrega pendiente de esta fase
para CUALQUIER versión, exista o no intención inmediata de subirla a Partner Center.

**Y genera SIEMPRE también el `.msix`** (después del bump de versión, para que salga con la versión
nueva): `npm run tauri:windows:build` — compila con `--no-bundle` y NO necesita la clave del
actualizador (`dbv-specs-ops/docs/WINDOWS_RELEASE.md` §6). Si `src-tauri/binaries/` está vacío, ejecuta
antes `npm run vendor:typst` y `npm run vendor:tinymist`. Al terminar, pasa y reporta la verificación de
`MICROSOFT_STORE.md` §6: en `src-tauri/target/appx/x64` deben estar `typst.exe`, `tinymist.exe` y
`templates\`; `AppxManifest.xml` debe llevar `Version="X.Y.Z.0"`; y el
`src-tauri/target/msix/dbv-typst-editor_X.Y.Z.0.msixbundle` debe pesar del orden de la versión anterior
(~75-80 MB), no ~30 MB. Deja la ruta del `.msixbundle` en `task.md`. Instalarlo con el certificado de
pruebas y subirlo a Partner Center siguen siendo acciones del usuario.

**Publicación en GitHub (cuando el usuario pide push, y siempre en este orden).** Los workflows de release crean
un **borrador** (`releaseDraft: true`): publicarlo y documentarlo es parte de `/ship`, no un paso que se quede
para después.
1. **Primero empuja solo `master`** y espera a que la **CI** (`gh run list --workflow CI`) termine en verde. Un test
   que mata o cuelga el job en Linux no se ve en Windows (la 0.14.0 salió con un `kill` que cancelaba la CI).
2. **Solo entonces crea y empuja el tag** `vX.Y.Z`. **Un tag ya empujado no se mueve ni se borra** (hacerlo exige
   permiso explícito del usuario): si algo falla tras el tag, se corrige en `master` y, si hace falta, sale una
   versión Patch nueva.
3. Espera a que terminen **Release Linux y Release macOS** (la de macOS tarda ~35 min) y comprueba que el
   borrador lleva sus artefactos.
4. **Publica la Release con sus notas**: `gh release edit vX.Y.Z --draft=false --latest --notes-file <fichero>`, con el
   cuerpo en **inglés y español** (misma plantilla que `gh release view v0.13.1`: resumen, viñetas con lo que
   importa al usuario, enlace al `CHANGELOG` y a la guía de IA, y el aviso de Windows solo por la Store y de
   `.dmg` sin firmar). Redáctalo a partir de la sección de la versión del `CHANGELOG`, no de la memoria.
5. Comprueba que `gh release view vX.Y.Z` ya no es borrador y que el workflow del Cask de Homebrew terminó bien.

**Y revisa SIEMPRE la documentación, en el repositorio y en la web** (antes del bump de versión; no es
opcional ni se reduce a «añadir una línea al README»). Lo que se añadió en la versión tiene que estar
explicado donde el usuario lo busca, y lo que ya estaba tiene que seguir siendo verdad:

1. **Sitios a revisar** (todos, en ES y EN): `README.md` y `README.en.md` (estado actual: versión y
   número de pruebas; funcionalidades; requisitos); `docs/IA.md` y `docs/IA.en.md`; la web del proyecto
   `docs/index.html` y `docs/en/index.html`; `descripcionStore_es.md` y `descripcionStore_en.md`; y la
   **ayuda integrada** `src/help/helpContent.js` (sección por tema, en ES y EN).
2. **La web `davidbuenov.com`** vive en otro repositorio (Jekyll): su ficha de este proyecto es
   `D:\Programacion\github-davidbuenov\web\_projects\dbv-typst-editor.md` (versión, métricas del hero,
   características, historial de versiones, comparativa). Actualízala con lo de esta versión. **No edites
   `public/` del repo `davidbuenov` (es una copia generada), no hagas commit allí ni despliegues**: el
   despliegue es del usuario, con DBV Control Center.
3. **Comprobar que lo antiguo sigue siendo cierto.** Busca las afirmaciones que cambian con los números y
   los nombres: «tres paneles» (hoy son cuatro: P / E / V / IA), recuentos de pruebas, de plantillas, de
   paquetes, de modelos, versiones («v0.9.0»), rutas de menú y atajos. Contrástalas con el código y con
   `package.json`/`CHANGELOG.md`, no con la memoria.
4. **Claridad.** Cada tema de la ayuda y de la guía responde a *qué es*, *dónde está* (ruta de menú o
   botón), *cómo se usa* (pasos o un ejemplo) y *qué límites tiene*. Un tema que solo se menciona de
   pasada se amplía; un párrafo largo que mezcla varias cosas se divide en secciones con título propio.
   Las novedades de la versión van a la sección del tema que corresponde, no a una lista aparte por
   versión.
5. Deja constancia en `dbv-specs-ops/walkthrough.md` de qué ficheros se revisaron y qué se cambió o se
   descartó, y en `task.md` de lo que quedó pendiente (por ejemplo, capturas de pantalla nuevas).

$ARGUMENTS
