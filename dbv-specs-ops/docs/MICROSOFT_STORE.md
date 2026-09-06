# 🏬 Publicación en Microsoft Store: DBV Typst Editor

> **Estado:** 🔶 Identidad reservada en Partner Center, MSIX preparado localmente. **Pendiente de envío.**
> **Última revisión:** 2026-09-06

Documento operativo (no una especificación de producto): checklist accionable para publicar `dbv-typst-editor` en la Microsoft Store, y registro de las decisiones técnicas que llevaron hasta aquí. Sigue el mismo modelo que [`dbv-md-reader`](https://github.com/davidbuenov/dbv-md-reader) (ya publicado, `9N7BMDZGCP0S`) y la guía general [`MARKETPLACE_PUBLISHING.md`](./MARKETPLACE_PUBLISHING.md) — este documento solo registra lo específico de este proyecto.

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

---

## 5. Pendiente, fuera del alcance de esta sesión

1. **Capturas de pantalla de la aplicación real.** Ninguna sesión hasta ahora ha tenido acceso a una ventana real de Windows para capturarlas — necesarias para la ficha de Store y recomendable reutilizarlas también en la landing page (`docs/index.html`).
2. **Build de Windows firmado** (`npm run build`, requiere `TAURI_SIGNING_PRIVATE_KEY`/`_PASSWORD` en el terminal del usuario — nunca en manos de la IA, regla ya registrada en `memory.md` para el instalador NSIS y válida también aquí) — el `.msix` no puede generarse sin el `.exe` compilado.
3. **Generar el `.msix` final** (`npm run tauri:windows:build`) sobre ese build ya compilado.
4. **Enviar a certificación en Partner Center**, siguiendo el checklist de `MARKETPLACE_PUBLISHING.md` §8, citando el Store ID (`9PCPSVTNJMP0`) si hace falta contactar soporte.
