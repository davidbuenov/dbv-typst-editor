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

$ARGUMENTS
