// =============================================================================
// DBV Typst Editor — Canal local entre la aplicación y el servidor MCP (RF-117)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Con la aplicación abierta y el ajuste «Compartir el estado del editor» activado, un agente que usa el
// servidor MCP (`mcp.rs`) puede ver las pestañas con su texto SIN GUARDAR, el documento activo, el cursor y la
// selección, el esquema y los problemas. Es solo lectura.
//
// Cómo llega (RF-117.2): el servidor MCP —un proceso aparte lanzado por el agente— habla con la aplicación en
// marcha por un canal local, NUNCA un puerto de red:
//   · Windows: tubería con nombre (`\\.\pipe\…`, `reject_remote_clients`).
//   · macOS y Linux: socket de Unix en la carpeta de datos, con permisos 0600 en un directorio 0700.
// y con un TESTIGO aleatorio de 256 bits que la aplicación deja en `mcp/bridge.json` (0600) dentro de la carpeta de
// datos del usuario. Quien no puede leer ese fichero no puede preguntar; un testigo erróneo se rechaza sin responder
// nada del proyecto.
//
// Protocolo: una línea JSON de petición `{token, root, op:"state"}` y una línea JSON de respuesta. Un solo mensaje
// por conexión. No existe ninguna operación de escritura (RF-117.3).
//
// La aplicación PREGUNTA al editor (evento `mcp-state-request`) y espera 2 s su respuesta (`mcp_state_reply`): el estado
// vive en la interfaz, no en Rust. Si la interfaz no responde, el servidor lo dice.

use std::collections::HashMap;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::sync::oneshot;

/// Lo que espera la aplicación a que la interfaz conteste (RF-117, plan).
pub const ASK_TIMEOUT: Duration = Duration::from_secs(2);
/// Lo que espera el servidor MCP a la aplicación entera (conectar + preguntar + responder).
pub const CLIENT_TIMEOUT: Duration = Duration::from_secs(4);
/// Instalar un paquete espera a que el USUARIO decida en la ventana y a la descarga: mucho más que preguntar un estado.
pub const INSTALL_TIMEOUT: Duration = Duration::from_secs(120);
pub const INSTALL_CLIENT_TIMEOUT: Duration = Duration::from_secs(130);
/// La petición es una línea corta: más que esto no es nuestro cliente.
const MAX_REQUEST_BYTES: u64 = 2048;
const MAX_STATE_BYTES: usize = 4 * 1024 * 1024;
const MAX_TABS: usize = 40;
const MAX_TAB_CHARS: usize = 200_000;
const MAX_SELECTION_CHARS: usize = 20_000;
const MAX_LIST: usize = 200;

pub type AskFuture = Pin<Box<dyn Future<Output = Result<Value, String>> + Send>>;

/// Cómo se obtiene el estado de la interfaz. En la aplicación, un evento de Tauri; en los tests, un simulacro.
pub struct Hooks {
    pub ask: Box<dyn Fn() -> AskFuture + Send + Sync>,
    /// Un agente acaba de hacer una pregunta válida (la barra de estado lo indica).
    pub on_agent: Box<dyn Fn() + Send + Sync>,
    /// Pide al usuario, en la ventana, permiso para instalar el paquete (RNF-IA.9.4) y lo instala si acepta.
    pub install: Box<dyn Fn(String) -> AskFuture + Send + Sync>,
}

// ----------------------------------------------------------------------------------- estado compartido

/// Lo que la aplicación recuerda del canal: el testigo, qué proyecto se comparte y las preguntas en vuelo.
pub struct Bridge {
    token: String,
    /// Raíz normalizada del proyecto cuyo estado se comparte; `None` = el ajuste está desactivado.
    shared_root: Mutex<Option<String>>,
    /// Raíz del proyecto abierto, para el que un agente puede PEDIR instalar un paquete (siempre con confirmación).
    install_root: Mutex<Option<String>>,
    pending: Mutex<HashMap<u64, oneshot::Sender<Value>>>,
    next: AtomicU64,
    listening: AtomicBool,
}

impl Bridge {
    pub fn new(token: String) -> Self {
        Self { token, shared_root: Mutex::new(None), install_root: Mutex::new(None), pending: Mutex::new(HashMap::new()), next: AtomicU64::new(1), listening: AtomicBool::new(false) }
    }

    /// Testigo aleatorio de 256 bits en hexadecimal.
    pub fn random_token() -> String {
        let mut bytes = [0u8; 32];
        getrandom::fill(&mut bytes).expect("el sistema operativo no da aleatoriedad");
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    }

    pub fn token(&self) -> &str {
        &self.token
    }

    /// Activa (con la raíz del proyecto) o desactiva (`None`) la compartición del estado.
    pub fn set_share(&self, root: Option<&Path>) {
        *self.shared_root.lock().unwrap() = root.map(normalize_root);
    }

    /// Permite (con la raíz del proyecto abierto) o impide (`None`) que un agente pida instalar paquetes.
    pub fn set_install(&self, root: Option<&Path>) {
        *self.install_root.lock().unwrap() = root.map(normalize_root);
    }

    /// ¿Ya escucha el canal del sistema? (lo usan los tests para esperar a que esté listo).
    pub fn is_listening(&self) -> bool {
        self.listening.load(Ordering::Relaxed)
    }

    pub fn shared_root(&self) -> Option<String> {
        self.shared_root.lock().unwrap().clone()
    }

    /// Reserva una pregunta; el guardián la retira si nadie la contesta a tiempo.
    pub fn register(self: &Arc<Self>) -> (u64, oneshot::Receiver<Value>, PendingGuard) {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().unwrap().insert(id, tx);
        (id, rx, PendingGuard { bridge: self.clone(), id })
    }

    /// La interfaz contestó a la pregunta `id`. `false` si ya no se esperaba (llegó tarde o no existe).
    pub fn resolve(&self, id: u64, state: Value) -> bool {
        match self.pending.lock().unwrap().remove(&id) {
            Some(tx) => tx.send(state).is_ok(),
            None => false,
        }
    }
}

pub struct PendingGuard {
    bridge: Arc<Bridge>,
    id: u64,
}

impl Drop for PendingGuard {
    fn drop(&mut self) {
        self.bridge.pending.lock().unwrap().remove(&self.id);
    }
}

/// Dos rutas del mismo proyecto dan la misma cadena, aunque cambie la barra, las mayúsculas en Windows o el prefijo `\\?\`.
pub fn normalize_root(path: &Path) -> String {
    let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let mut text = canonical.to_string_lossy().replace('\\', "/");
    if let Some(rest) = text.strip_prefix("//?/") {
        text = rest.to_string();
    }
    while text.len() > 1 && text.ends_with('/') {
        text.pop();
    }
    if cfg!(windows) {
        text = text.to_lowercase();
    }
    text
}

fn constant_time_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

// ----------------------------------------------------------------------------------- el estado que sale

/// `true` si es una ruta relativa dentro del proyecto: sin `..`, sin raíz ni unidad (RF-117.5).
fn is_inside(path: &str) -> bool {
    let normalized = path.replace('\\', "/");
    !normalized.is_empty() && !normalized.starts_with('/') && !normalized.contains(':') && !normalized.split('/').any(|part| part == "..")
}

fn truncate(text: &str, max: usize) -> (String, bool) {
    if text.chars().count() <= max {
        (text.to_string(), false)
    } else {
        (text.chars().take(max).collect(), true)
    }
}

/// Lo que la interfaz envía se acota y se confina antes de salir de la aplicación: la interfaz es de fiar, pero el
/// límite de RF-117.5 se cumple aquí, no allí.
pub fn sanitize_state(raw: &Value) -> Result<Value, String> {
    let tabs: Vec<Value> = raw
        .get("tabs")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(|tab| {
                    let path = tab.get("path")?.as_str()?;
                    if !is_inside(path) {
                        return None;
                    }
                    let (content, truncated) = truncate(tab.get("content").and_then(Value::as_str).unwrap_or(""), MAX_TAB_CHARS);
                    Some(json!({ "path": path.replace('\\', "/"), "content": content, "unsaved": tab.get("unsaved").and_then(Value::as_bool).unwrap_or(false), "truncated": truncated }))
                })
                .take(MAX_TABS)
                .collect()
        })
        .unwrap_or_default();
    let active = raw.get("active").and_then(Value::as_str).filter(|path| is_inside(path)).map(|path| path.replace('\\', "/"));
    let bounded = |key: &str| -> Vec<Value> { raw.get(key).and_then(Value::as_array).map(|list| list.iter().take(MAX_LIST).cloned().collect()).unwrap_or_default() };
    let selection = raw.get("selection").and_then(Value::as_str).map(|text| truncate(text, MAX_SELECTION_CHARS).0).unwrap_or_default();
    let state = json!({
        "tabs": tabs,
        "active": active,
        "cursor": raw.get("cursor").cloned().unwrap_or(Value::Null),
        "selection": selection,
        "outline": bounded("outline"),
        "problems": bounded("problems"),
    });
    if state.to_string().len() > MAX_STATE_BYTES {
        return Err("state-too-large".into());
    }
    Ok(state)
}

// ----------------------------------------------------------------------------------- el servidor (la aplicación)

#[derive(Deserialize)]
struct Request {
    token: String,
    root: String,
    op: String,
    /// Solo en `install`: el identificador `@preview/nombre:versión`.
    #[serde(default)]
    id: Option<String>,
}

fn reply(ok: bool, key: &str, value: Value) -> String {
    let mut object = serde_json::Map::new();
    object.insert("ok".into(), Value::Bool(ok));
    object.insert(key.into(), value);
    format!("{}\n", Value::Object(object))
}

fn refuse(reason: &str) -> String {
    reply(false, "reason", Value::String(reason.into()))
}

/// Atiende UNA conexión: valida el testigo y el proyecto, pregunta a la interfaz y contesta una línea.
pub async fn serve_connection<S>(stream: S, bridge: &Arc<Bridge>, hooks: &Hooks)
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let (read, mut write) = tokio::io::split(stream);
    let mut reader = BufReader::new(read.take(MAX_REQUEST_BYTES));
    let mut line = String::new();
    let answer = match tokio::time::timeout(Duration::from_secs(2), reader.read_line(&mut line)).await {
        Ok(Ok(n)) if n > 0 => decide(&line, bridge, hooks).await,
        _ => refuse("bad-request"),
    };
    let _ = write.write_all(answer.as_bytes()).await;
    let _ = write.shutdown().await;
}

async fn decide(line: &str, bridge: &Arc<Bridge>, hooks: &Hooks) -> String {
    let Ok(request) = serde_json::from_str::<Request>(line.trim()) else {
        return refuse("bad-request");
    };
    // Primero el testigo: sin él no se revela ni que el ajuste esté activado.
    if !constant_time_eq(&request.token, bridge.token()) {
        return refuse("bad-token");
    }
    match request.op.as_str() {
        "state" => {}
        "install" => return decide_install(&request, bridge, hooks).await,
        _ => return refuse("unknown-op"),
    }
    let Some(shared) = bridge.shared_root() else {
        return refuse("disabled");
    };
    if shared != normalize_root(Path::new(&request.root)) {
        return refuse("other-project");
    }
    (hooks.on_agent)();
    match tokio::time::timeout(ASK_TIMEOUT, (hooks.ask)()).await {
        Ok(Ok(raw)) => match sanitize_state(&raw) {
            Ok(state) => reply(true, "state", state),
            Err(reason) => refuse(&reason),
        },
        _ => refuse("ui-timeout"),
    }
}

/// Un agente pide instalar un paquete de Typst Universe (RNF-IA.9.4): la aplicación SIEMPRE pregunta al usuario.
async fn decide_install(request: &Request, bridge: &Arc<Bridge>, hooks: &Hooks) -> String {
    let Some(allowed) = bridge.install_root.lock().unwrap().clone() else {
        return refuse("disabled");
    };
    if allowed != normalize_root(Path::new(&request.root)) {
        return refuse("other-project");
    }
    let Some(id) = request.id.as_deref().filter(|id| crate::universe::parse_universe_spec(id).is_ok()) else {
        return refuse("bad-package");
    };
    (hooks.on_agent)();
    match tokio::time::timeout(INSTALL_TIMEOUT, (hooks.install)(id.to_string())).await {
        Ok(Ok(result)) => reply(true, "result", result),
        _ => refuse("ui-timeout"),
    }
}

// ----------------------------------------------------------------------------------- el canal del sistema

/// Un nombre de canal que nadie puede adivinar ni reutilizar entre ejecuciones.
pub fn new_endpoint(data_dir: &Path) -> String {
    let suffix = &Bridge::random_token()[..16];
    if cfg!(windows) {
        format!(r"\\.\pipe\dbv-typst-editor-mcp-{suffix}")
    } else {
        data_dir.join("mcp").join(format!("{suffix}.sock")).to_string_lossy().into_owned()
    }
}

/// `true` si el canal es el del sistema local (tubería con nombre o socket de Unix), nunca una dirección de red.
pub fn is_local_endpoint(endpoint: &str) -> bool {
    endpoint.starts_with(r"\\.\pipe\") || (endpoint.ends_with(".sock") && !endpoint.contains("://"))
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct Discovery {
    pub endpoint: String,
    pub token: String,
}

fn discovery_path(data_dir: &Path) -> PathBuf {
    data_dir.join("mcp").join("bridge.json")
}

/// Crea el directorio del canal con permisos solo del usuario donde el sistema los admite.
fn private_dir(dir: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

pub fn write_discovery(data_dir: &Path, discovery: &Discovery) -> std::io::Result<()> {
    private_dir(&data_dir.join("mcp"))?;
    let path = discovery_path(data_dir);
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    use std::io::Write;
    options.open(path)?.write_all(serde_json::to_string(discovery)?.as_bytes())
}

pub fn read_discovery(data_dir: &Path) -> Option<Discovery> {
    serde_json::from_slice(&std::fs::read(discovery_path(data_dir)).ok()?).ok()
}

pub fn remove_discovery(data_dir: &Path) {
    let _ = std::fs::remove_file(discovery_path(data_dir));
}

/// Escucha en el canal del sistema hasta que la aplicación se cierra. Devuelve error si no puede crearlo.
#[cfg(windows)]
pub async fn listen(endpoint: String, bridge: Arc<Bridge>, hooks: Arc<Hooks>) -> std::io::Result<()> {
    use tokio::net::windows::named_pipe::ServerOptions;
    let mut server = ServerOptions::new().first_pipe_instance(true).reject_remote_clients(true).create(&endpoint)?;
    bridge.listening.store(true, Ordering::Relaxed);
    loop {
        server.connect().await?;
        let connected = server;
        server = ServerOptions::new().reject_remote_clients(true).create(&endpoint)?;
        let (bridge, hooks) = (bridge.clone(), hooks.clone());
        tokio::spawn(async move { serve_connection(connected, &bridge, &hooks).await });
    }
}

#[cfg(unix)]
pub async fn listen(endpoint: String, bridge: Arc<Bridge>, hooks: Arc<Hooks>) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    if let Some(parent) = Path::new(&endpoint).parent() {
        private_dir(parent)?;
    }
    let _ = std::fs::remove_file(&endpoint);
    let listener = tokio::net::UnixListener::bind(&endpoint)?;
    std::fs::set_permissions(&endpoint, std::fs::Permissions::from_mode(0o600))?;
    bridge.listening.store(true, Ordering::Relaxed);
    loop {
        let (stream, _) = listener.accept().await?;
        let (bridge, hooks) = (bridge.clone(), hooks.clone());
        tokio::spawn(async move { serve_connection(stream, &bridge, &hooks).await });
    }
}

// ----------------------------------------------------------------------------------- el cliente (servidor MCP)

/// Una línea de petición y una de respuesta sobre cualquier flujo.
pub async fn exchange<S>(stream: S, token: &str, root: &Path) -> Result<Value, String>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    exchange_op(stream, token, root, "state", None).await
}

/// Como `exchange`, con la operación (`state` o `install`) y, en `install`, el paquete.
pub async fn exchange_op<S>(mut stream: S, token: &str, root: &Path, op: &str, id: Option<&str>) -> Result<Value, String>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let request = json!({ "token": token, "root": root.to_string_lossy(), "op": op, "id": id });
    stream.write_all(format!("{request}\n").as_bytes()).await.map_err(|e| e.to_string())?;
    let mut answer = String::new();
    BufReader::new(stream.take(MAX_STATE_BYTES as u64 + 4096)).read_line(&mut answer).await.map_err(|e| e.to_string())?;
    serde_json::from_str(answer.trim()).map_err(|e| e.to_string())
}

#[cfg(windows)]
async fn connect_and_exchange(endpoint: &str, token: &str, root: &Path, op: &str, id: Option<&str>) -> Result<Value, String> {
    use tokio::net::windows::named_pipe::ClientOptions;
    let client = ClientOptions::new().open(endpoint).map_err(|e| e.to_string())?;
    exchange_op(client, token, root, op, id).await
}

#[cfg(unix)]
async fn connect_and_exchange(endpoint: &str, token: &str, root: &Path, op: &str, id: Option<&str>) -> Result<Value, String> {
    let stream = tokio::net::UnixStream::connect(endpoint).await.map_err(|e| e.to_string())?;
    exchange_op(stream, token, root, op, id).await
}

/// Lo que el servidor MCP cuenta al agente sobre el estado de la interfaz. SIEMPRE un JSON explicativo: nunca falla.
pub async fn fetch_state(data_dir: Option<&Path>, root: &Path) -> Value {
    let unavailable = |reason: &str, note: &str| json!({ "available": false, "reason": reason, "note": note });
    let Some(discovery) = data_dir.and_then(read_discovery) else {
        return unavailable("app-not-running", "DBV Typst Editor is not open (or never shared its state). Working from the files on disk only.");
    };
    if !is_local_endpoint(&discovery.endpoint) {
        return unavailable("app-not-running", "The application channel is not valid.");
    }
    let outcome = tokio::time::timeout(CLIENT_TIMEOUT, connect_and_exchange(&discovery.endpoint, &discovery.token, root, "state", None)).await;
    let Ok(Ok(answer)) = outcome else {
        return unavailable("app-not-running", "DBV Typst Editor is not open. Working from the files on disk only.");
    };
    if answer.get("ok").and_then(Value::as_bool) == Some(true) {
        return json!({ "available": true, "state": answer.get("state").cloned().unwrap_or(Value::Null), "note": "Read-only snapshot of the editor, including text not yet saved to disk." });
    }
    match answer.get("reason").and_then(Value::as_str).unwrap_or("unknown") {
        "disabled" => unavailable("sharing-disabled", "The user has not enabled sharing the editor state with agents (DBV: Settings > Share editor state with MCP agents). Working from the files on disk only."),
        "other-project" => unavailable("other-project", "DBV is open with a different project than the one this server was launched with."),
        "ui-timeout" => unavailable("ui-busy", "DBV did not answer in time. Try again."),
        "state-too-large" => unavailable("state-too-large", "The editor state is too large to share."),
        "bad-token" => unavailable("app-not-running", "The application channel was refused (stale token). Reopen DBV."),
        other => unavailable(other, "DBV could not provide the editor state."),
    }
}

/// El resultado de pedir instalar un paquete a la aplicación.
#[derive(Debug, PartialEq)]
pub enum InstallAnswer {
    /// El usuario aceptó y el paquete está instalado.
    Installed,
    /// El usuario no lo permitió.
    Denied,
    /// No se pudo preguntar o instalar: el motivo, para el agente.
    Unavailable(String),
}

/// Pide a la aplicación que, con permiso del usuario, instale `id` (RNF-IA.9.4). Nunca instala por sí mismo.
pub async fn request_install(data_dir: Option<&Path>, root: &Path, id: &str) -> InstallAnswer {
    let unavailable = |note: &str| InstallAnswer::Unavailable(note.to_string());
    let Some(discovery) = data_dir.and_then(read_discovery).filter(|d| is_local_endpoint(&d.endpoint)) else {
        return unavailable("DBV Typst Editor is not open, so the user cannot be asked. Put the `#import` in the document instead; DBV downloads it when the user approves.");
    };
    let outcome = tokio::time::timeout(INSTALL_CLIENT_TIMEOUT, connect_and_exchange(&discovery.endpoint, &discovery.token, root, "install", Some(id))).await;
    let Ok(Ok(answer)) = outcome else {
        return unavailable("DBV Typst Editor is not open or did not answer. Put the `#import` in the document instead.");
    };
    if answer.get("ok").and_then(Value::as_bool) == Some(true) {
        let result = answer.get("result");
        return match result.and_then(|r| r.get("installed")).and_then(Value::as_bool) {
            Some(true) => InstallAnswer::Installed,
            _ if result.and_then(|r| r.get("reason")).and_then(Value::as_str) == Some("denied") => InstallAnswer::Denied,
            _ => InstallAnswer::Unavailable(result.and_then(|r| r.get("message")).and_then(Value::as_str).unwrap_or("the installation failed").to_string()),
        };
    }
    match answer.get("reason").and_then(Value::as_str).unwrap_or("unknown") {
        "other-project" => unavailable("DBV is open with a different project than the one this server was launched with."),
        "ui-timeout" => unavailable("The user did not answer in time."),
        "bad-package" => unavailable("That is not a valid `@preview/name:version` identifier."),
        "disabled" => unavailable("DBV has no project open."),
        other => InstallAnswer::Unavailable(format!("DBV refused the request ({other}).")),
    }
}

// ----------------------------------------------------------------------------------- integración con Tauri

/// El canal de esta ejecución: un testigo nuevo cada vez que se abre la aplicación.
pub struct McpBridgeState {
    bridge: Arc<Bridge>,
    started: Mutex<bool>,
}

impl Default for McpBridgeState {
    fn default() -> Self {
        Self { bridge: Arc::new(Bridge::new(Bridge::random_token())), started: Mutex::new(false) }
    }
}

fn start_listener(app: &tauri::AppHandle, bridge: &Arc<Bridge>) -> Result<(), String> {
    use tauri::Emitter;
    let data_dir = crate::mcp::app_data_dir().ok_or("no data directory")?;
    let endpoint = new_endpoint(&data_dir);
    let ask_app = app.clone();
    let ask_bridge = bridge.clone();
    let agent_app = app.clone();
    let install_app = app.clone();
    let install_bridge = bridge.clone();
    let hooks = Arc::new(Hooks {
        ask: Box::new(move || {
            let (id, rx, guard) = ask_bridge.register();
            let emitted = ask_app.emit("mcp-state-request", json!({ "id": id }));
            Box::pin(async move {
                let _guard = guard;
                emitted.map_err(|e| e.to_string())?;
                rx.await.map_err(|e| e.to_string())
            })
        }),
        on_agent: Box::new(move || {
            let _ = agent_app.emit("mcp-agent-connected", json!({}));
        }),
        install: Box::new(move |package| {
            let (id, rx, guard) = install_bridge.register();
            let emitted = install_app.emit("mcp-install-request", json!({ "id": id, "package": package }));
            Box::pin(async move {
                let _guard = guard;
                emitted.map_err(|e| e.to_string())?;
                rx.await.map_err(|e| e.to_string())
            })
        }),
    });
    write_discovery(&data_dir, &Discovery { endpoint: endpoint.clone(), token: bridge.token().to_string() }).map_err(|e| e.to_string())?;
    let bridge = bridge.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = listen(endpoint, bridge, hooks).await {
            eprintln!("mcp_bridge: {error}");
        }
    });
    Ok(())
}

/// Dice al canal qué proyecto está abierto (`root`; `None` si no hay ninguno) y si el usuario permite compartir el estado
/// del editor con los agentes MCP (`share_state`, RF-117.4, desactivado por defecto). Con proyecto abierto, un agente
/// puede además PEDIR instalar un paquete, y la aplicación siempre pregunta al usuario. El canal se crea la primera vez
/// que hay proyecto abierto.
#[tauri::command]
pub fn mcp_bridge_configure(app: tauri::AppHandle, state: tauri::State<'_, McpBridgeState>, root: Option<String>, share_state: bool) -> Result<(), String> {
    let root_path = root.as_deref().map(Path::new);
    state.bridge.set_install(root_path);
    state.bridge.set_share(if share_state { root_path } else { None });
    if root.is_some() {
        let mut started = state.started.lock().unwrap();
        if !*started {
            start_listener(&app, &state.bridge)?;
            *started = true;
        }
    }
    Ok(())
}

/// La interfaz contesta a una pregunta de un agente (`mcp-state-request`).
#[tauri::command]
pub fn mcp_state_reply(state: tauri::State<'_, McpBridgeState>, id: u64, snapshot: Value) -> bool {
    state.bridge.resolve(id, snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bridge_for(root: Option<&Path>) -> Arc<Bridge> {
        let bridge = Arc::new(Bridge::new("secreto".into()));
        bridge.set_share(root);
        bridge
    }

    fn hooks_with(state: Value, agents: Arc<AtomicU64>) -> Hooks {
        Hooks {
            ask: Box::new(move || {
                let state = state.clone();
                Box::pin(async move { Ok(state) })
            }),
            on_agent: Box::new(move || {
                agents.fetch_add(1, Ordering::Relaxed);
            }),
            install: Box::new(|_| Box::pin(async { Ok(json!({ "installed": true })) })),
        }
    }

    fn sample_state() -> Value {
        json!({
            "tabs": [
                { "path": "main.typ", "content": "= Borrador sin guardar", "unsaved": true },
                { "path": "../secreto.typ", "content": "FUERA", "unsaved": false },
                { "path": "C:/otro/x.typ", "content": "FUERA", "unsaved": false },
                { "path": "/etc/passwd", "content": "FUERA", "unsaved": false },
            ],
            "active": "main.typ",
            "cursor": { "line": 1, "column": 5 },
            "selection": "Borrador",
            "outline": [{ "level": 1, "title": "Borrador" }],
            "problems": [{ "level": "error", "file": "main.typ", "line": 3, "message": "x" }],
        })
    }

    async fn ask_through_duplex(bridge: &Arc<Bridge>, hooks: &Hooks, token: &str, root: &Path) -> Value {
        let (client, server) = tokio::io::duplex(1 << 16);
        let bridge = bridge.clone();
        let token = token.to_string();
        let root = root.to_path_buf();
        let task = async { exchange(client, &token, &root).await.unwrap() };
        let serve = serve_connection(server, &bridge, hooks);
        let (answer, ()) = tokio::join!(task, serve);
        answer
    }

    #[tokio::test]
    async fn con_la_aplicacion_simulada_devuelve_pestanas_sin_guardar_activo_cursor_y_seleccion() {
        let dir = tempfile::tempdir().unwrap();
        let agents = Arc::new(AtomicU64::new(0));
        let hooks = hooks_with(sample_state(), agents.clone());
        let answer = ask_through_duplex(&bridge_for(Some(dir.path())), &hooks, "secreto", dir.path()).await;
        assert_eq!(answer["ok"], true);
        let state = &answer["state"];
        assert_eq!(state["tabs"][0]["content"], "= Borrador sin guardar");
        assert_eq!(state["tabs"][0]["unsaved"], true);
        assert_eq!(state["active"], "main.typ");
        assert_eq!(state["cursor"]["line"], 1);
        assert_eq!(state["selection"], "Borrador");
        assert_eq!(state["outline"][0]["title"], "Borrador");
        assert_eq!(state["problems"][0]["line"], 3);
        assert_eq!(agents.load(Ordering::Relaxed), 1, "la barra de estado se entera del agente");
    }

    #[tokio::test]
    async fn los_ficheros_fuera_del_proyecto_no_se_exponen() {
        let dir = tempfile::tempdir().unwrap();
        let hooks = hooks_with(sample_state(), Arc::new(AtomicU64::new(0)));
        let answer = ask_through_duplex(&bridge_for(Some(dir.path())), &hooks, "secreto", dir.path()).await;
        let tabs = answer["state"]["tabs"].as_array().unwrap();
        assert_eq!(tabs.len(), 1, "solo la pestaña de dentro del proyecto");
        assert!(!answer.to_string().contains("FUERA"));
    }

    #[tokio::test]
    async fn un_testigo_erroneo_se_rechaza_sin_preguntar_ni_revelar_nada() {
        let dir = tempfile::tempdir().unwrap();
        let agents = Arc::new(AtomicU64::new(0));
        let hooks = hooks_with(sample_state(), agents.clone());
        let answer = ask_through_duplex(&bridge_for(Some(dir.path())), &hooks, "adivinado", dir.path()).await;
        assert_eq!(answer, json!({ "ok": false, "reason": "bad-token" }));
        assert_eq!(agents.load(Ordering::Relaxed), 0, "ni siquiera cuenta como agente conectado");
    }

    #[tokio::test]
    async fn con_el_ajuste_desactivado_no_se_expone_nada() {
        let dir = tempfile::tempdir().unwrap();
        let hooks = hooks_with(sample_state(), Arc::new(AtomicU64::new(0)));
        let answer = ask_through_duplex(&bridge_for(None), &hooks, "secreto", dir.path()).await;
        assert_eq!(answer, json!({ "ok": false, "reason": "disabled" }));
    }

    #[tokio::test]
    async fn otro_proyecto_no_ve_el_estado_de_este() {
        let (a, b) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
        let hooks = hooks_with(sample_state(), Arc::new(AtomicU64::new(0)));
        let answer = ask_through_duplex(&bridge_for(Some(a.path())), &hooks, "secreto", b.path()).await;
        assert_eq!(answer["reason"], "other-project");
    }

    #[tokio::test]
    async fn si_la_interfaz_no_contesta_se_dice_y_no_se_cuelga() {
        let dir = tempfile::tempdir().unwrap();
        let hooks = Hooks { ask: Box::new(|| Box::pin(std::future::pending())), on_agent: Box::new(|| {}), install: Box::new(|_| Box::pin(std::future::pending())) };
        let answer = ask_through_duplex(&bridge_for(Some(dir.path())), &hooks, "secreto", dir.path()).await;
        assert_eq!(answer["reason"], "ui-timeout");
    }

    #[tokio::test]
    async fn solo_hay_una_operacion_y_es_de_lectura() {
        let dir = tempfile::tempdir().unwrap();
        let bridge = bridge_for(Some(dir.path()));
        let hooks = hooks_with(sample_state(), Arc::new(AtomicU64::new(0)));
        for op in ["write", "save", "set_cursor", "open", "state "] {
            let line = format!("{}\n", json!({ "token": "secreto", "root": dir.path().to_string_lossy(), "op": op }));
            assert_eq!(decide(&line, &bridge, &hooks).await, refuse("unknown-op"), "op {op}");
        }
        assert_eq!(decide("no es json\n", &bridge, &hooks).await, refuse("bad-request"));
    }

    #[test]
    fn el_estado_se_acota() {
        let big = "x".repeat(MAX_TAB_CHARS + 10);
        let raw = json!({ "tabs": [{ "path": "a.typ", "content": big }], "selection": "y".repeat(MAX_SELECTION_CHARS + 5), "outline": (0..500).collect::<Vec<_>>() });
        let state = sanitize_state(&raw).unwrap();
        assert_eq!(state["tabs"][0]["truncated"], true);
        assert_eq!(state["tabs"][0]["content"].as_str().unwrap().chars().count(), MAX_TAB_CHARS);
        assert_eq!(state["selection"].as_str().unwrap().chars().count(), MAX_SELECTION_CHARS);
        assert_eq!(state["outline"].as_array().unwrap().len(), MAX_LIST);
    }

    #[test]
    fn el_testigo_es_aleatorio_y_largo_y_la_comparacion_es_exacta() {
        let (a, b) = (Bridge::random_token(), Bridge::random_token());
        assert_eq!(a.len(), 64);
        assert_ne!(a, b);
        assert!(constant_time_eq(&a, &a.clone()));
        assert!(!constant_time_eq(&a, &b));
        assert!(!constant_time_eq("abc", "abcd"));
    }

    #[test]
    fn el_canal_es_local_nunca_de_red() {
        let data = tempfile::tempdir().unwrap();
        let endpoint = new_endpoint(data.path());
        assert!(is_local_endpoint(&endpoint), "{endpoint}");
        assert!(!is_local_endpoint("127.0.0.1:9000"));
        assert!(!is_local_endpoint("http://localhost:9000/x.sock"));
        assert!(!is_local_endpoint("tcp://127.0.0.1:1"));
        assert_ne!(new_endpoint(data.path()), endpoint, "distinto en cada ejecución");
    }

    #[test]
    fn las_rutas_del_mismo_proyecto_se_normalizan_igual() {
        let dir = tempfile::tempdir().unwrap();
        let with_slash = PathBuf::from(format!("{}/", dir.path().to_string_lossy()));
        assert_eq!(normalize_root(dir.path()), normalize_root(&with_slash));
    }

    #[test]
    fn el_descubrimiento_se_escribe_se_lee_y_se_borra() {
        let data = tempfile::tempdir().unwrap();
        assert_eq!(read_discovery(data.path()), None);
        let discovery = Discovery { endpoint: new_endpoint(data.path()), token: Bridge::random_token() };
        write_discovery(data.path(), &discovery).unwrap();
        assert_eq!(read_discovery(data.path()), Some(discovery));
        remove_discovery(data.path());
        assert_eq!(read_discovery(data.path()), None);
    }

    #[tokio::test]
    async fn sin_la_aplicacion_el_servidor_responde_sin_estado_y_lo_dice() {
        let data = tempfile::tempdir().unwrap();
        let project = tempfile::tempdir().unwrap();
        let none = fetch_state(Some(data.path()), project.path()).await;
        assert_eq!(none["available"], false);
        assert_eq!(none["reason"], "app-not-running");
        // Un descubrimiento viejo, de una aplicación que ya no está: tampoco falla.
        write_discovery(data.path(), &Discovery { endpoint: new_endpoint(data.path()), token: "viejo".into() }).unwrap();
        assert_eq!(fetch_state(Some(data.path()), project.path()).await["reason"], "app-not-running");
    }

    /// El canal REAL del sistema (tubería con nombre o socket de Unix), de punta a punta.
    #[tokio::test]
    async fn por_el_canal_real_del_sistema_de_punta_a_punta() {
        let data = tempfile::tempdir().unwrap();
        let project = tempfile::tempdir().unwrap();
        let bridge = bridge_for(Some(project.path()));
        let bridge = Arc::new(Bridge { token: Bridge::random_token(), ..Arc::try_unwrap(bridge).ok().unwrap() });
        let endpoint = new_endpoint(data.path());
        let hooks = Arc::new(hooks_with(sample_state(), Arc::new(AtomicU64::new(0))));
        write_discovery(data.path(), &Discovery { endpoint: endpoint.clone(), token: bridge.token().to_string() }).unwrap();
        let server = tokio::spawn(listen(endpoint, bridge.clone(), hooks));
        for _ in 0..50 {
            if bridge.is_listening() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let ok = fetch_state(Some(data.path()), project.path()).await;
        assert_eq!(ok["available"], true, "{ok}");
        assert_eq!(ok["state"]["tabs"][0]["content"], "= Borrador sin guardar");
        // Se apaga el ajuste: el mismo canal ya no expone nada.
        bridge.set_share(None);
        assert_eq!(fetch_state(Some(data.path()), project.path()).await["reason"], "sharing-disabled");
        // Instalar un paquete es otra cosa: no depende de compartir el estado, y la aplicación siempre pregunta.
        bridge.set_install(Some(project.path()));
        assert_eq!(request_install(Some(data.path()), project.path(), "@preview/charged-ieee:0.1.4").await, InstallAnswer::Installed);
        server.abort();
    }

    fn install_hooks(result: Value, asked: Arc<Mutex<Vec<String>>>) -> Hooks {
        Hooks {
            ask: Box::new(|| Box::pin(async { Ok(json!({})) })),
            on_agent: Box::new(|| {}),
            install: Box::new(move |package| {
                asked.lock().unwrap().push(package);
                let result = result.clone();
                Box::pin(async move { Ok(result) })
            }),
        }
    }

    async fn install_through_duplex(bridge: &Arc<Bridge>, hooks: &Hooks, token: &str, root: &Path, id: &str) -> Value {
        let (client, server) = tokio::io::duplex(1 << 16);
        let (token, root, id) = (token.to_string(), root.to_path_buf(), id.to_string());
        let task = async { exchange_op(client, &token, &root, "install", Some(&id)).await.unwrap() };
        let (answer, ()) = tokio::join!(task, serve_connection(server, bridge, hooks));
        answer
    }

    #[tokio::test]
    async fn pedir_instalar_pregunta_a_la_aplicacion_y_devuelve_lo_que_el_usuario_decidio() {
        let dir = tempfile::tempdir().unwrap();
        let bridge = bridge_for(None);
        bridge.set_install(Some(dir.path()));
        let asked = Arc::new(Mutex::new(Vec::new()));
        let hooks = install_hooks(json!({ "installed": true }), asked.clone());
        let answer = install_through_duplex(&bridge, &hooks, "secreto", dir.path(), "@preview/charged-ieee:0.1.4").await;
        assert_eq!(answer, json!({ "ok": true, "result": { "installed": true } }));
        assert_eq!(*asked.lock().unwrap(), vec!["@preview/charged-ieee:0.1.4".to_string()]);
    }

    #[tokio::test]
    async fn pedir_instalar_rechaza_testigo_erroneo_otro_proyecto_paquete_invalido_y_sin_proyecto() {
        let (a, b) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
        let asked = Arc::new(Mutex::new(Vec::new()));
        let hooks = install_hooks(json!({ "installed": true }), asked.clone());
        let bridge = bridge_for(None);
        bridge.set_install(Some(a.path()));
        let ok_id = "@preview/charged-ieee:0.1.4";
        assert_eq!(install_through_duplex(&bridge, &hooks, "adivinado", a.path(), ok_id).await["reason"], "bad-token");
        assert_eq!(install_through_duplex(&bridge, &hooks, "secreto", b.path(), ok_id).await["reason"], "other-project");
        assert_eq!(install_through_duplex(&bridge, &hooks, "secreto", a.path(), "../../etc/passwd").await["reason"], "bad-package");
        assert_eq!(install_through_duplex(&bridge, &hooks, "secreto", a.path(), "https://evil.example/x.tar.gz").await["reason"], "bad-package");
        bridge.set_install(None);
        assert_eq!(install_through_duplex(&bridge, &hooks, "secreto", a.path(), ok_id).await["reason"], "disabled");
        assert!(asked.lock().unwrap().is_empty(), "ninguna de esas peticiones llegó a preguntar al usuario");
    }

    #[tokio::test]
    async fn si_el_usuario_no_contesta_a_tiempo_se_dice() {
        let dir = tempfile::tempdir().unwrap();
        let bridge = bridge_for(None);
        bridge.set_install(Some(dir.path()));
        let hooks = Hooks { ask: Box::new(|| Box::pin(std::future::pending())), on_agent: Box::new(|| {}), install: Box::new(|_| Box::pin(async { Err("la interfaz se cerró".to_string()) })) };
        let answer = install_through_duplex(&bridge, &hooks, "secreto", dir.path(), "@preview/charged-ieee:0.1.4").await;
        assert_eq!(answer["reason"], "ui-timeout");
    }

    #[tokio::test]
    async fn sin_la_aplicacion_pedir_instalar_lo_dice_y_no_instala() {
        let data = tempfile::tempdir().unwrap();
        let project = tempfile::tempdir().unwrap();
        match request_install(Some(data.path()), project.path(), "@preview/charged-ieee:0.1.4").await {
            InstallAnswer::Unavailable(note) => assert!(note.contains("not open")),
            other => panic!("{other:?}"),
        }
    }
}
