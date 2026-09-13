# 🏬 Publicación en Microsoft Store: DBV Typst Editor

> **Estado:** 🟡 **v0.6.0 enviada a certificación en Partner Center (2026-09-13), sin incidencias en el envío** — pendiente de que Microsoft complete la revisión y la publique. Textos usados: `notasActualizacionStore_v0.6.0.md`. Última versión **verificada en producción: v0.5.0 (2026-09-10)**. El incidente del primer paquete (sin el compilador Typst ni el catálogo de plantillas dentro, ver §6) quedó corregido en `v0.3.1` y reenviado; desde entonces cada envío pasa el checklist de verificación de §6 antes de subirlo.
> **Última revisión:** 2026-09-13

Documento operativo (no una especificación de producto): checklist accionable para publicar `dbv-typst-editor` en la Microsoft Store, y registro de las decisiones técnicas que llevaron hasta aquí. Sigue el mismo modelo que [`dbv-md-reader`](https://github.com/davidbuenov/dbv-md-reader) (ya publicado, `9N7BMDZGCP0S`) y la guía general [`MARKETPLACE_PUBLISHING.md`](./MARKETPLACE_PUBLISHING.md) — este documento solo registra lo específico de este proyecto.

> **Regla fijada el 2026-09-13, en `.claude/commands/ship.md`:** cada `/ship` de este proyecto genera
> `notasActualizacionStore_vX.Y.Z.md` en la raíz del repositorio (novedades ES/EN, Submission Notes y
> checklist de §6), exista o no intención inmediata de enviar esa versión a Partner Center — así no hay
> que pedirlo aparte ni reconstruirlo de memoria cuando llegue el momento de publicar.

---

## 1. Vía elegida: MSIX subido directamente a Partner Center

Misma decisión que en `dbv-md-reader`, con el mismo razonamiento (ver `MARKETPLACE_PUBLISHING.md` §1): Tauri v2 no genera MSIX de fábrica, pero subirlo a Partner Center hace que **la propia Store firme el paquete con su certificado tras la certificación** — sin comprar un certificado Authenticode. Herramienta: [`@choochmeque/tauri-windows-bundle`](https://www.npmjs.com/package/@choochmeque/tauri-windows-bundle) (ya auditada para este mismo uso en `dbv-md-reader`; misma versión `^0.1.29` instalada aquí).

**Los dos canales de distribución coexisten sin conflicto:** el instalador NSIS sigue publicándose en GitHub Releases (`tauri-plugin-updater` gestiona sus actualizaciones); el MSIX es una identidad de paquete distinta, exclusiva de la Store, cuyas actualizaciones gestiona Windows Update — un usuario que instale desde la Store no verá el botón "Buscar actualizaciones" de "Acerca de" encontrar nada, sus actualizaciones llegan solas.

---

## 2. Identidad real — ya reservada por el usuario en Partner Center (2026-09-06)

```
Package/Identity/Name:              davidbuenov.dbv-typst-editor
Package/Identity/Publisher:         CN=13EE2A5D-F49E-48C9-8873-941069B15D63
Package/Properties/PublisherDisplayName: davidbuenov
Package Family Name (PFN):          davidbuenov.dbv-typst-editor_ze9zfmg3hs4tt
Package SID:                        S-1-15-2-2435721684-3147599199-2649761239-1473972606-1287079878-2635648826-3260058821
Store ID:                           9PCPSVTNJMP0
```

Mismo Publisher CN que `dbv-md-reader` — misma cuenta de Partner Center del desarrollador, coherente con reservar varios productos bajo la misma identidad de publicador. Ya volcada a `src-tauri/gen/windows/bundle.config.json`:

```json
{
  "identifier": "davidbuenov.dbv-typst-editor",
  "displayName": "dbv-typst-editor",
  "publisher": "CN=13EE2A5D-F49E-48C9-8873-941069B15D63",
  "publisherDisplayName": "davidbuenov"
}
```

`displayName` fijado explícitamente a `dbv-typst-editor` (el nombre real del binario compilado por Cargo, `src-tauri/Cargo.toml` → `[package] name`), no a `productName` (`"DBV Typst Editor"`, con espacio) — la lección ya documentada en `dbv-md-reader` (§2 de su propio `MICROSOFT_STORE.md`): la herramienta deriva el nombre de archivo esperado dentro del paquete a partir de `displayName`, y si no coincide con el binario real el build falla con `Executable not found`. Aquí no hubo que corregirlo después: se fijó bien desde el primer `init`.

**Store deep link / Web Store URL:** disponibles solo cuando el producto esté publicado — anotar aquí en cuanto la Store las genere.

---

## 3. Empaquetado MSIX — scaffold ya generado (2026-09-06)

```
npm install                                    # instala @choochmeque/tauri-windows-bundle (devDependency)
npx tauri-windows-bundle init                  # genera src-tauri/gen/windows/ (ya hecho)
# editar src-tauri/gen/windows/bundle.config.json con la identidad real (ya hecho, ver §2)
npm run tauri:windows:build                    # genera el .msix — necesita el .exe firmado ya compilado
```

**Pasos completos y en orden desde cero** (vendorizar sidecars, variables de entorno de firma, compilar
el `.exe`, generar el manifiesto de actualización y solo entonces el `.msix`): ver
[`WINDOWS_RELEASE.md`](./WINDOWS_RELEASE.md) — documento único para no repetir esta secuencia de memoria.

Archivos generados (trackeados en git completos, no gitignorados — ver `MARKETPLACE_PUBLISHING.md` §3, "la carpeta de empaquetado se trackea entera"):
- `src-tauri/gen/windows/bundle.config.json` — identidad real ya rellenada (§2).
- `src-tauri/gen/windows/AppxManifest.xml.template` — plantilla del manifiesto, sin tocar.
- `src-tauri/gen/windows/Assets/` — iconos derivados de `bundle.icon` de `tauri.conf.json`.

### Asociación de archivos `.typ`: reutiliza la configuración existente

Igual que en `dbv-md-reader` (§2 de su documento): la herramienta lee `bundle.fileAssociations` directamente de `src-tauri/tauri.conf.json` (la misma entrada `.typ` que ya usa el instalador NSIS) — no se duplica nada en `bundle.config.json`.

### ⚠️ El mismo bug de asset placeholder que ya rechazó `dbv-md-reader` una vez — encontrado y corregido ANTES del envío

`MARKETPLACE_PUBLISHING.md` §3 documenta el gotcha genérico (un asset generado automáticamente puede caer a un color sólido de repuesto sin ningún error visible) y el propio `MICROSOFT_STORE.md` de `dbv-md-reader` §4bis registra el rechazo real que causó (política 10.1.1.11, "tile con imagen por defecto"). **Se comprobó proactivamente antes de enviar nada, en vez de esperar a que la Store lo rechazara:**

```python
from PIL import Image
im = Image.open('src-tauri/gen/windows/Assets/Wide310x150Logo.png').convert('RGBA')
print(len(im.getcolors(100000)))   # → 1 antes de corregir
```

`Wide310x150Logo.png` (310×150) salió del `init` con un único color sólido (`RGBA(0,0,0,255)`, negro) — la misma composición que falló en `dbv-md-reader`. **Corregido regenerándolo con Pillow**, centrando `Square150x150Logo.png` sobre un lienzo `310×150` transparente (`x = (310-150)/2 = 80`, `y = 0`), coherente con `BackgroundColor="transparent"` del manifiesto — verificado después: 85 colores únicos, el icono real "T" centrado. El resto de assets (`Square150x150Logo.png`, `Square44x44Logo.png`, `StoreLogo.png`) ya traían el icono real desde el `init`, sin necesidad de tocarlos.

**Pendiente antes de cada envío/reenvío** (checklist de `MARKETPLACE_PUBLISHING.md` §3, no repetir la investigación): reabrir visualmente cada asset de `src-tauri/gen/windows/Assets/*.png` si se regenera el scaffold con `--regenerate-assets`.

### Certificado — solo para pruebas locales, no para la Store

Igual que en `dbv-md-reader` (§2 de su documento): para instalar el `.msix` en un PC de pruebas antes de enviarlo hace falta un certificado que lo firme (autofirmado, gratuito, `New-SelfSignedCertificate` de PowerShell) — la Store lo re-firma con el suyo al recibirlo, así que esto no es el mismo bloqueo que un certificado Authenticode comercial. Nota ya registrada allí: `Add-AppxPackage` valida la cadena de confianza contra `Cert:\LocalMachine\Root` (requiere consola elevada), no contra `Cert:\CurrentUser\Root`.

---

## 4. Requisitos de la Store que ya están cubiertos por el proyecto

- **Sin telemetría ni recolección de datos personales:** verificado y documentado en `docs/privacidad.html`/`privacy.html` (GitHub Pages, `master`/`/docs`) — único tráfico de red saliente: descargas de Typst Universe bajo petición explícita, y la comprobación manual de actualizaciones (nunca automática).
- **Política de privacidad publicada:** `https://davidbuenov.github.io/dbv-typst-editor/privacidad.html` (ES) / `.../privacy.html` (EN) — lista para pegar en el campo correspondiente de Partner Center.
- **Ficha de Store redactada:** `descripcionStore_es.md` / `descripcionStore_en.md` en la raíz del repositorio, listos para copiar campo a campo a Partner Center.
- **Notas para la certificación (Certification Notes):** redactadas en inglés (preferido por evaluadores globales de Microsoft) y español, listas para copiar al campo "Notas para la certificación / Additional Testing Info" (ver §4.1).

---

### 4.1. Notas para la certificación (Additional Testing Info / Certification Notes)

> **Consejo clave:** Los evaluadores de Microsoft Store son un equipo global y realizan las revisiones principalmente en **inglés**. Proporcionar las notas en inglés (o bilingüe) y un flujo de prueba paso a paso de 1 a 2 minutos reduce drásticamente los tiempos de certificación y evita rechazos por "falta de credenciales" o "no entender cómo probar la app".
> 
> **Credenciales:** No rellenar nada en "Credenciales" (la app es 100% offline y no requiere login).

#### Texto recomendado para copiar en "Descripción" (Inglés - Recomendado para agilizar):

```text
APPLICATION OVERVIEW:
DBV Typst Editor is a native, offline-first desktop editor for the Typst typesetting system (used for academic writing, theses, research papers, and technical reports). It includes a bundled Typst compiler CLI sidecar and a real-time live preview.

NO CREDENTIALS REQUIRED:
This application is 100% local and offline-first. No login, account creation, or credentials are required.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application. The Task Launcher screen will appear.
2. Under "Templates" / "Plantillas", click on "Blank Project" (or any template like "TFG / Bachelor Thesis").
3. Click "Create project" / "Crear proyecto" and select any temporary folder on your disk.
4. The main editor window will open with two panels:
   - Left side: Typst code editor with syntax highlighting.
   - Right side: Real-time SVG/PDF live document preview.
5. Type any text in the editor (e.g., "= Test Heading") and notice the preview pane on the right immediately recompiles and renders the new content in real time.
6. Test the top insertion toolbar buttons (e.g., Bold, Equations, Tables, Headings) to verify syntax insertion and live re-rendering.
7. Click "Export PDF" (or File > Export PDF) to verify standalone PDF generation.
8. (Optional) You can toggle the UI language between English and Spanish, and switch themes (Light, Dark, Sepia) using the controls in the top bar.

ADDITIONAL TECHNICAL CONTEXT:
- The Typst CLI engine is bundled inside the application package, requiring no external dependencies, LaTeX installations, or internet connectivity.
- Internet connectivity is only used if the user explicitly browses or downloads optional community packages from Typst Universe.
- No background telemetry, no advertising, no tracking.
```

---

## 5. Pendiente, fuera del alcance de esta sesión

1. **Capturas de pantalla de la aplicación real.** Ninguna sesión hasta ahora ha tenido acceso a una ventana real de Windows para capturarlas — necesarias para la ficha de Store y recomendable reutilizarlas también en la landing page (`docs/index.html`).
2. **Resultado de la certificación de v0.6.0.** Enviada el 2026-09-13 sin incidencias en el envío (build firmado + `.msixbundle` generados con `WINDOWS_RELEASE.md` §3/§6, textos de `notasActualizacionStore_v0.6.0.md`). Falta que Microsoft complete la revisión y la publique — anotar aquí el resultado cuando llegue (aprobada / rechazada y por qué).

---

## 6. ⛔ El paquete publicado salió SIN el compilador dentro (incidencia real, 2026-09-07)

**Esta es la sección más importante del documento.** La primera versión publicada en la Store llegó a los usuarios sin el sidecar `typst.exe` ni la carpeta `templates/`. La app abría y dejaba escribir, pero **toda** función que dependiera del compilador (vista previa, exportar PDF/PNG, terminal avanzada, crear proyecto desde plantilla) fallaba con `El sistema no puede encontrar el archivo especificado. (os error 2)`.

### Causa raíz

`@choochmeque/tauri-windows-bundle` (v0.1.29, la última publicada) **no implementa `bundle.externalBin`**. Su `prepareAppxContent()` copia el `.exe` principal, los `Assets` y `bundle.resources` — y nada más. El bundler **oficial** de Tauri (NSIS/MSI/dmg/deb/AppImage) sí lo soporta y además falla el build si el sidecar no está, razón por la cual **solo el canal MSIX pudo publicar un artefacto inservible en silencio.**

Un segundo fallo, independiente: `bundle.resources` en forma de array y con prefijo `../` (aquí `"../templates"`) se copiaba con `path.join(appxDir, "../templates")`, dejando la carpeta como *hermana* de la raíz del paquete y por tanto **fuera** del `.msix`.

### Solución aplicada

`patches/@choochmeque+tauri-windows-bundle+0.1.29.patch`, gestionado con `patch-package` y reaplicado solo en cada `npm install` (script `postinstall`). Añade el copiado de `externalBin` y normaliza el destino de los recursos con `../`.

⚠️ **Detalle que costó un ciclo entero de build:** el sidecar debe copiarse **sin el sufijo del target triple**. `tauri-plugin-shell` resuelve `sidecar("typst")` a `<carpeta del ejecutable>/typst.exe` (`relative_command_path()`), no a `typst-x86_64-pc-windows-msvc.exe`. Copiarlo con el nombre vendorizado produce exactamente el mismo `os error 2`.

### Verificación OBLIGATORIA antes de cada envío a Partner Center

No basta con que el build termine sin error. Comprobar las tres cosas:

> ⚠️ **Desde v0.5.0 hay DOS sidecars, no uno.** `bundle.externalBin` declara `binaries/typst` y
> `binaries/tinymist`, así que antes de empaquetar hay que haber ejecutado **`npm run vendor:typst`
> y `npm run vendor:tinymist`**, y las cifras de abajo cambian. Un paquete al que le falte
> `tinymist.exe` arranca y escribe igual que siempre: lo que se cae en silencio es el
> autocompletado semántico, los diagnósticos en vivo y el formateo — el mismo modo de fallo que
> la incidencia de esta sección, solo que menos visible.

```powershell
# 1. La raíz del paquete debe contener typst.exe, tinymist.exe Y templates\
Get-ChildItem src-tauri\target\appx\x64

# 2. El .msix debe pesar ~95 MB, no ~30 MB (y desde luego no ~6 MB).
#    typst son ~51 MB y tinymist otros ~64 MB: si el número cae al tamaño de la
#    versión anterior, es que uno de los dos se ha quedado fuera.
Get-ChildItem src-tauri\target\msix\*.msix | Select-Object Name, @{n='MB';e={[int]($_.Length/1MB)}}
```

Y por último, **instalar el `.msix` y ejecutar la guía de prueba de 2 minutos de §4.1** (crear proyecto desde plantilla → vista previa en vivo → exportar PDF). Este paso es el único que habría detectado el fallo original, porque el paquete roto se construía, firmaba, certificaba e instalaba **sin un solo error**.

Para instalar en local hace falta firmar el `.msix` con el certificado de pruebas (§3): `signtool sign /fd SHA256 /a /f <pfx> /p <pwd> <ruta.msix>`. Si ya hay una versión instalada con la misma identidad y versión (p. ej. la de la Store), hay que desinstalarla antes o `Add-AppxPackage` falla con `0x80073CF9 / 0x80070057`.
