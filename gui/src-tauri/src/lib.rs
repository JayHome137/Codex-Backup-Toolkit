use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

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
struct ToolkitStatus {
    available: bool,
    helper_path: Option<String>,
    last_error: Option<String>,
    root_path: Option<String>,
    scripts_path: Option<String>,
    source: ToolkitSource,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
enum HelperSource {
    Managed,
    External,
    Unavailable,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
enum ToolkitSource {
    Bundle,
    Environment,
    Development,
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
fn toolkit_status(app: AppHandle) -> ToolkitStatus {
    build_toolkit_status(Some(&app))
}

#[tauri::command]
fn helper_start(app: AppHandle, state: State<'_, HelperState>) -> Result<HelperStatus, String> {
    if helper_is_online() {
        return build_status(&state);
    }

    let repo_root = resolve_toolkit_root(Some(&app))?;
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
            toolkit_status,
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

fn resolve_toolkit_root(app: Option<&AppHandle>) -> Result<PathBuf, String> {
    let status = build_toolkit_status(app);
    if let Some(root) = status.root_path {
        return Ok(PathBuf::from(root));
    }

    Err(status.last_error.unwrap_or_else(|| "无法定位工具根目录。".to_string()))
}

fn build_toolkit_status(app: Option<&AppHandle>) -> ToolkitStatus {
    let candidates = toolkit_candidates(app);
    for candidate in candidates {
        if is_toolkit_root(&candidate.path) {
            let root = candidate.path.to_string_lossy().to_string();
            return ToolkitStatus {
                available: true,
                helper_path: Some(candidate.path.join("helper/server.mjs").to_string_lossy().to_string()),
                last_error: None,
                root_path: Some(root),
                scripts_path: Some(candidate.path.join("scripts/codexbackup.sh").to_string_lossy().to_string()),
                source: candidate.source,
            };
        }
    }

    ToolkitStatus {
        available: false,
        helper_path: None,
        last_error: Some("无法定位工具根目录。请设置 CODEX_BACKUP_TOOLKIT_ROOT，或确认桌面 App 已打包 helper/scripts 资源。".to_string()),
        root_path: None,
        scripts_path: None,
        source: ToolkitSource::Unavailable,
    }
}

struct ToolkitCandidate {
    path: PathBuf,
    source: ToolkitSource,
}

fn toolkit_candidates(app: Option<&AppHandle>) -> Vec<ToolkitCandidate> {
    let mut candidates = Vec::new();

    if let Ok(root) = std::env::var("CODEX_BACKUP_TOOLKIT_ROOT") {
        candidates.push(ToolkitCandidate { path: PathBuf::from(root), source: ToolkitSource::Environment });
    }

    if let Some(app) = app {
        if let Ok(resource_dir) = app.path().resource_dir() {
            candidates.push(ToolkitCandidate { path: resource_dir.join("toolkit"), source: ToolkitSource::Bundle });
        }
    }
    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(ToolkitCandidate { path: current_dir, source: ToolkitSource::Development });
    }
    if let Some(manifest_dir) = option_env!("CARGO_MANIFEST_DIR") {
        let manifest = PathBuf::from(manifest_dir);
        candidates.push(ToolkitCandidate { path: manifest.clone(), source: ToolkitSource::Development });
        if let Some(gui_dir) = manifest.parent() {
            candidates.push(ToolkitCandidate { path: gui_dir.to_path_buf(), source: ToolkitSource::Development });
            if let Some(repo_dir) = gui_dir.parent() {
                candidates.push(ToolkitCandidate { path: repo_dir.to_path_buf(), source: ToolkitSource::Development });
            }
        }
    }

    candidates
}

fn is_toolkit_root(candidate: &PathBuf) -> bool {
    candidate.join("helper/server.mjs").exists() && candidate.join("scripts/codexbackup.sh").exists()
}

fn set_last_error(state: &State<'_, HelperState>, value: Option<String>) {
    if let Ok(mut last_error) = state.last_error.lock() {
        *last_error = value;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn finds_candidate_with_helper_and_scripts() {
        let root = make_temp_root("valid");
        fs::create_dir_all(root.join("helper")).unwrap();
        fs::create_dir_all(root.join("scripts")).unwrap();
        fs::write(root.join("helper/server.mjs"), "").unwrap();
        fs::write(root.join("scripts/codexbackup.sh"), "").unwrap();

        assert_eq!(toolkit_status_from_candidates(vec![ToolkitCandidate { path: root.clone(), source: ToolkitSource::Development }]).root_path, Some(root.clone().to_string_lossy().to_string()));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_candidate_without_scripts() {
        let root = make_temp_root("missing-scripts");
        fs::create_dir_all(root.join("helper")).unwrap();
        fs::write(root.join("helper/server.mjs"), "").unwrap();

        assert!(!toolkit_status_from_candidates(vec![ToolkitCandidate { path: root.clone(), source: ToolkitSource::Development }]).available);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn prefers_first_valid_candidate() {
        let invalid = make_temp_root("invalid-first");
        let valid = make_temp_root("valid-second");
        fs::create_dir_all(invalid.join("helper")).unwrap();
        fs::write(invalid.join("helper/server.mjs"), "").unwrap();
        fs::create_dir_all(valid.join("helper")).unwrap();
        fs::create_dir_all(valid.join("scripts")).unwrap();
        fs::write(valid.join("helper/server.mjs"), "").unwrap();
        fs::write(valid.join("scripts/codexbackup.sh"), "").unwrap();

        assert_eq!(
            toolkit_status_from_candidates(vec![
                ToolkitCandidate { path: invalid.clone(), source: ToolkitSource::Development },
                ToolkitCandidate { path: valid.clone(), source: ToolkitSource::Environment },
            ]).root_path,
            Some(valid.clone().to_string_lossy().to_string())
        );
        let _ = fs::remove_dir_all(invalid);
        let _ = fs::remove_dir_all(valid);
    }

    #[test]
    fn reports_available_toolkit_status() {
        let root = make_temp_root("status-valid");
        fs::create_dir_all(root.join("helper")).unwrap();
        fs::create_dir_all(root.join("scripts")).unwrap();
        fs::write(root.join("helper/server.mjs"), "").unwrap();
        fs::write(root.join("scripts/codexbackup.sh"), "").unwrap();

        let status = toolkit_status_from_candidates(vec![ToolkitCandidate { path: root.clone(), source: ToolkitSource::Bundle }]);
        assert!(status.available);
        assert_eq!(status.source, ToolkitSource::Bundle);
        assert_eq!(status.root_path, Some(root.to_string_lossy().to_string()));
        assert!(status.helper_path.unwrap().ends_with("helper/server.mjs"));
        assert!(status.scripts_path.unwrap().ends_with("scripts/codexbackup.sh"));
        let _ = fs::remove_dir_all(root);
    }

    fn toolkit_status_from_candidates(candidates: Vec<ToolkitCandidate>) -> ToolkitStatus {
        for candidate in candidates {
            if is_toolkit_root(&candidate.path) {
                return ToolkitStatus {
                    available: true,
                    helper_path: Some(candidate.path.join("helper/server.mjs").to_string_lossy().to_string()),
                    last_error: None,
                    root_path: Some(candidate.path.to_string_lossy().to_string()),
                    scripts_path: Some(candidate.path.join("scripts/codexbackup.sh").to_string_lossy().to_string()),
                    source: candidate.source,
                };
            }
        }
        ToolkitStatus { available: false, helper_path: None, last_error: Some("missing".to_string()), root_path: None, scripts_path: None, source: ToolkitSource::Unavailable }
    }

    fn make_temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("codexbackup-tauri-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }
}
