use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, State};

const HELPER_PORT: u16 = 37371;
const HELPER_BASE: &str = "http://127.0.0.1:37371";

#[derive(Default)]
struct HelperState {
    child: Mutex<Option<Child>>,
    last_error: Mutex<Option<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HelperStatus {
    last_error: Option<String>,
    managed: bool,
    online: bool,
    port: u16,
    source: HelperSource,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
enum HelperSource {
    Managed,
    External,
    Unavailable,
}

#[derive(Debug, Deserialize)]
struct HelperRequest {
    method: String,
    path: String,
    #[serde(default)]
    body: Option<Value>,
}

#[tauri::command]
fn helper_status(state: State<'_, HelperState>) -> Result<HelperStatus, String> {
    build_status(&state)
}

#[tauri::command]
fn helper_start(state: State<'_, HelperState>) -> Result<HelperStatus, String> {
    if helper_is_online() {
        return build_status(&state);
    }

    let repo_root = resolve_repo_root()?;
    let helper_path = repo_root.join("helper/server.mjs");
    if !helper_path.exists() {
        let message = format!(
            "找不到 helper/server.mjs。请设置 CODEX_BACKUP_TOOLKIT_ROOT 指向仓库根目录。当前查找目录：{}",
            repo_root.display()
        );
        set_last_error(&state, Some(message.clone()));
        return Err(message);
    }

    let child = Command::new("node")
        .arg(&helper_path)
        .current_dir(&repo_root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            let message = format!("启动 helper 失败：{error}");
            set_last_error(&state, Some(message.clone()));
            message
        })?;

    {
        let mut managed = state.child.lock().map_err(|_| "helper 状态锁不可用。".to_string())?;
        *managed = Some(child);
    }

    for _ in 0..30 {
        if helper_is_online() {
            set_last_error(&state, None);
            return build_status(&state);
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    let message = "helper 已启动但健康检查超时。".to_string();
    set_last_error(&state, Some(message.clone()));
    build_status(&state).map_err(|_| message)
}

#[tauri::command]
fn helper_stop(state: State<'_, HelperState>) -> Result<HelperStatus, String> {
    let child = {
        let mut managed = state.child.lock().map_err(|_| "helper 状态锁不可用。".to_string())?;
        managed.take()
    };

    if let Some(mut child) = child {
        let _ = child.kill();
        let _ = child.wait();
    }

    set_last_error(&state, None);
    build_status(&state)
}

#[tauri::command]
fn helper_request(request: HelperRequest) -> Result<Value, String> {
    validate_helper_request(&request)?;

    let url = format!("{HELPER_BASE}{}", request.path);
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(120))
        .build();
    let response = match request.method.as_str() {
        "GET" => agent.get(&url).call(),
        "PUT" | "POST" | "DELETE" => agent
            .request(&request.method, &url)
            .set("content-type", "application/json")
            .send_json(request.body.unwrap_or(Value::Null)),
        _ => return Err("不支持的 helper 请求方法。".to_string()),
    }
    .map_err(helper_transport_error)?;

    response
        .into_json::<Value>()
        .map_err(|error| format!("helper 返回了无效 JSON：{error}"))
}

#[tauri::command]
fn open_path(path: String) -> Result<Value, String> {
    Command::new("open")
        .arg(&path)
        .status()
        .map_err(|error| format!("打开路径失败：{error}"))
        .and_then(|status| {
            if status.success() {
                Ok(serde_json::json!({ "status": "ok" }))
            } else {
                Err(format!("open 命令退出码：{}", status.code().unwrap_or(1)))
            }
        })
}

pub fn run() {
    tauri::Builder::default()
        .manage(HelperState::default())
        .invoke_handler(tauri::generate_handler![
            helper_status,
            helper_start,
            helper_stop,
            helper_request,
            open_path
        ])
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                if let Some(state) = window.try_state::<HelperState>() {
                    let child = state.child.lock().ok().and_then(|mut managed| managed.take());
                    if let Some(mut child) = child {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running CodexBackup desktop app");
}

fn build_status(state: &State<'_, HelperState>) -> Result<HelperStatus, String> {
    let managed = prune_managed_child(state)?;
    let online = helper_is_online();
    let source = if online && managed {
        HelperSource::Managed
    } else if online {
        HelperSource::External
    } else {
        HelperSource::Unavailable
    };

    let last_error = state
        .last_error
        .lock()
        .map_err(|_| "helper 错误状态锁不可用。".to_string())?
        .clone();

    Ok(HelperStatus {
        last_error,
        managed,
        online,
        port: HELPER_PORT,
        source,
    })
}

fn prune_managed_child(state: &State<'_, HelperState>) -> Result<bool, String> {
    let mut managed = state.child.lock().map_err(|_| "helper 状态锁不可用。".to_string())?;
    if let Some(child) = managed.as_mut() {
        if child.try_wait().map_err(|error| format!("检查 helper 进程失败：{error}"))?.is_some() {
            *managed = None;
            return Ok(false);
        }
        return Ok(true);
    }
    Ok(false)
}

fn helper_is_online() -> bool {
    ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(2))
        .build()
        .get(&format!("{HELPER_BASE}/health"))
        .call()
        .map(|response| response.status() == 200)
        .unwrap_or(false)
}

fn validate_helper_request(request: &HelperRequest) -> Result<(), String> {
    let allowed = matches!(
        (request.method.as_str(), request.path.as_str()),
        ("GET", "/health")
            | ("GET", "/config")
            | ("PUT", "/config")
            | ("POST", "/secret")
            | ("DELETE", "/secret")
            | ("GET", "/history")
            | ("POST", "/run")
    );
    if allowed {
        Ok(())
    } else {
        Err("桌面桥接拒绝了不在允许列表中的 helper 请求。".to_string())
    }
}

fn helper_transport_error(error: ureq::Error) -> String {
    match error {
        ureq::Error::Status(code, response) => {
            let body = response.into_string().unwrap_or_default();
            format!("helper 请求失败：HTTP {code} {body}")
        }
        ureq::Error::Transport(error) => format!("helper 不可用：{error}"),
    }
}

fn resolve_repo_root() -> Result<PathBuf, String> {
    if let Ok(root) = std::env::var("CODEX_BACKUP_TOOLKIT_ROOT") {
        return Ok(PathBuf::from(root));
    }

    let mut candidates = Vec::new();
    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir);
    }
    if let Some(manifest_dir) = option_env!("CARGO_MANIFEST_DIR") {
        let manifest = PathBuf::from(manifest_dir);
        candidates.push(manifest.clone());
        if let Some(gui_dir) = manifest.parent() {
            candidates.push(gui_dir.to_path_buf());
            if let Some(repo_dir) = gui_dir.parent() {
                candidates.push(repo_dir.to_path_buf());
            }
        }
    }

    for candidate in candidates {
        if candidate.join("helper/server.mjs").exists() {
            return Ok(candidate);
        }
    }

    Err("无法定位仓库根目录。请设置 CODEX_BACKUP_TOOLKIT_ROOT。".to_string())
}

fn set_last_error(state: &State<'_, HelperState>, value: Option<String>) {
    if let Ok(mut last_error) = state.last_error.lock() {
        *last_error = value;
    }
}
