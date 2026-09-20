# 🪟 Build de Windows firmado: pasos exactos

> ⚠️ **Desde v0.8.0 Windows se distribuye SOLO por Microsoft Store (`ADR-WINDOWS-001` en `memory.md`).** El instalador NSIS firmado de GitHub Releases queda **descontinuado**: los pasos 3, 4 y 5 de abajo (clave de firma, `npm run build` firmado, `latest.json`) ya **no se ejecutan** y solo sirven de referencia si algún día se reabre ese canal. El flujo vigente es: paso 2 (vendorizar sidecars) y paso 6 (`npm run tauri:windows:build`), que **no necesita ninguna clave**: la Store re-firma el `.msix` con la suya.
>
> Documento operativo — la ÚNICA plataforma que se compila y firma en local, nunca en CI (ver
> `NATIVE_APPS_RELEASE_CI.md` §7): la clave de firma del actualizador vive solo en esta máquina.
> Existe porque estos pasos se han repetido de memoria varias veces — a partir de ahora, se consultan
> aquí en vez de volver a pedirlos.
>
> **Regla de siempre, sin excepción:** la clave privada (`TAURI_SIGNING_PRIVATE_KEY` y su contraseña)
> las genera y guarda el usuario, en su propio terminal y su propio gestor de contraseñas — nunca en
> un fichero del repositorio, nunca pegadas en una conversación con la IA. Este documento no dice cuál
> es la clave ni dónde vive: solo el nombre de las dos variables de entorno que hay que rellenar.

---

## 1. Qué produce cada destino

| Destino | Comando final | Necesita firma de actualizador |
| --- | --- | --- |
| **GitHub Releases** (instalador NSIS `.exe` + auto-actualización) | `npm run build` + `npm run updater:manifest` | Sí — es el único artefacto firmado del proyecto |
| **Microsoft Store** (`.msix`, Partner Center) | `npm run tauri:windows:build`, sobre el `.exe` ya compilado | No lo firma esta clave — la Store re-firma el paquete con la suya al recibirlo (`docs/MICROSOFT_STORE.md` §1) |

Si vas a publicar en los dos sitios a la vez (caso normal), haz **los pasos 2 a 5** una sola vez y
luego el **paso 6** aparte.

---

## 2. Vendorizar los dos sidecars (obligatorio tras cualquier `git clone`/limpieza)

```powershell
npm run vendor:typst
npm run vendor:tinymist
```

Sin esto el `.exe` compila pero sale sin compilador Typst ni LSP dentro — mismo modo de fallo que la
incidencia registrada en `docs/MICROSOFT_STORE.md` §6.

## 3. Poner la clave de firma en el terminal (PowerShell)

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "<ruta al fichero .key o su contenido — tu clave, no la pegues aquí>"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<tu contraseña>"
```

Las dos variables solo viven en esta sesión de terminal — no se guardan en ningún fichero del
proyecto. Si generaste la clave con `tauri signer generate` (una sola vez, ver `ADR-ACTUALIZADOR-001`
en `memory.md`), `TAURI_SIGNING_PRIVATE_KEY` puede ser la ruta al `.key` que generó ese comando o su
contenido en base64 directamente — Tauri acepta las dos formas.

## 4. Compilar el instalador firmado

```powershell
npm run build
```

Genera `src-tauri/target/release/bundle/nsis/DBV Typst Editor_<versión>_x64-setup.exe` y su
`*-setup.exe.sig` (gracias a `createUpdaterArtifacts: true` para Windows en `tauri.conf.json`). Sin
las dos variables del paso 3 puestas, este mismo comando genera el `.exe` igual pero SIN el `.sig` —
revisa la carpeta si `updater:manifest` (paso 5) se queja de que no lo encuentra.

## 5. Generar `latest.json` (manifiesto de actualización)

```powershell
node scripts/updater-manifest.mjs
# o, con notas de la versión:
node scripts/updater-manifest.mjs --notes "Texto de las novedades"
```

Compone `latest.json` en la raíz del proyecto a partir del `-setup.exe` y su `.sig` que acaba de dejar
el paso 4 — nunca se escribe a mano (`scripts/updater-manifest.mjs`, cabecera del fichero, explica por
qué: es donde se cuela una firma pegada a medias o una URL con la versión anterior).

**Subir a mano al borrador de Release de GitHub** (`release-linux.yml`/`release-macos.yml` ya lo
dejan creado como borrador al empujar el tag — ver `task.md`): el `-setup.exe`, su `.sig` y este
`latest.json`.

## 6. (Opcional) Generar el `.msix` para Microsoft Store

```powershell
npm run tauri:windows:build
```

Necesita el `.exe` del paso 4 ya compilado (usa el mismo build, no vuelve a compilar). Antes de
enviarlo a Partner Center, sigue el checklist completo de verificación de
[`MICROSOFT_STORE.md` §6](./MICROSOFT_STORE.md#6--el-paquete-publicado-salió-sin-el-compilador-dentro-incidencia-real-2026-09-07)
(los dos sidecars dentro, tamaño del `.msix`, instalación y prueba de 2 minutos) — es el único paso
que de verdad detecta un sidecar ausente; el build y la certificación pasan igual sin él.

---

## 7. Qué NO hace falta repetir

- Los pasos 2 y 3 no cambian entre versiones (mismos sidecars a vendorizar, misma clave). Solo hace
  falta el paso 2 si has limpiado `src-tauri/binaries/` o clonado el repo de nuevo.
- El paso 6 es independiente del auto-actualizador: si algún día se deja de publicar en la Store, los
  pasos 1-5 siguen funcionando solos.
