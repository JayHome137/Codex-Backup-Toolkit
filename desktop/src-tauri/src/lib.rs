use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

const EMBEDDED_BACKUP_SCRIPT: &str = include_str!("../../../codex-local-backup/scripts/codex_local_backup.py");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppState {
    backup_dir: String,
    schedule_mode: String,
    interval_days: u32,
    last_success_at: Option<String>,
    last_archive: Option<String>,
    last_error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsInput {
    backup_dir: String,
    schedule_mode: String,
    interval_days: u32,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            backup_dir: String::new(),
            schedule_mode: "preset".to_string(),
            interval_days: 3,
            last_success_at: None,
            last_archive: None,
            last_error: None,
        }
    }
}

fn state_path() -> Result<PathBuf, String> {
    let base = dirs::config_dir()
        .ok_or_else(|| "无法定位用户配置目录".to_string())?
        .join("CLB");
    fs::create_dir_all(&base).map_err(|error| format!("无法创建配置目录：{error}"))?;
    Ok(base.join("state.json"))
}

fn read_state() -> AppState {
    let Ok(path) = state_path() else {
        return AppState::default();
    };
    let Ok(content) = fs::read_to_string(path) else {
        return AppState::default();
    };
    serde_json::from_str(&content).unwrap_or_default()
}

fn write_state(state: &AppState) -> Result<(), String> {
    let path = state_path()?;
    let content = serde_json::to_string_pretty(state).map_err(|error| format!("无法序列化状态：{error}"))?;
    fs::write(path, format!("{content}\n")).map_err(|error| format!("无法写入状态：{error}"))
}

fn backup_script() -> Result<PathBuf, String> {
    let base = dirs::config_dir()
        .ok_or_else(|| "无法定位用户配置目录".to_string())?
        .join("CLB")
        .join("runtime");
    fs::create_dir_all(&base).map_err(|error| format!("无法创建运行目录：{error}"))?;
    let script = base.join("codex_local_backup.py");
    fs::write(&script, EMBEDDED_BACKUP_SCRIPT).map_err(|error| format!("无法写入备份脚本：{error}"))?;
    Ok(script)
}

fn run_script(args: &[&str]) -> Result<Value, String> {
    let output = Command::new("python3")
        .arg(backup_script()?)
        .args(args)
        .output()
        .map_err(|error| format!("无法启动备份脚本：{error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.trim().to_string());
    }

    serde_json::from_slice(&output.stdout).map_err(|error| format!("无法解析脚本输出：{error}"))
}

#[tauri::command]
fn get_app_state() -> AppState {
    read_state()
}

#[tauri::command]
fn save_settings(settings: SettingsInput) -> Result<AppState, String> {
    let mut state = read_state();
    state.backup_dir = settings.backup_dir;
    state.schedule_mode = settings.schedule_mode;
    state.interval_days = settings.interval_days.max(1);
    write_state(&state)?;
    Ok(state)
}

#[tauri::command]
async fn choose_backup_directory<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    let result = app.dialog().file().blocking_pick_folder();
    Ok(result.map(|path| path.to_string()))
}

#[tauri::command]
async fn choose_archive<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    let result = app
        .dialog()
        .file()
        .add_filter("Codex backup archive", &["tar.gz", "gz"])
        .blocking_pick_file();
    Ok(result.map(|path| path.to_string()))
}

#[tauri::command]
fn run_backup(output_dir: String) -> Result<Value, String> {
    if output_dir.trim().is_empty() {
        return Err("请先选择备份位置".to_string());
    }
    let result = run_script(&["backup", "--output-dir", &output_dir])?;
    let mut state = read_state();
    state.backup_dir = output_dir;
    state.last_success_at = result
        .get("created_at")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    state.last_archive = result
        .get("archive")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    state.last_error = None;
    write_state(&state)?;
    Ok(result)
}

#[tauri::command]
fn run_restore_plan(archive: String) -> Result<Value, String> {
    if archive.trim().is_empty() {
        return Err("请先选择备份包".to_string());
    }
    run_script(&["restore-plan", "--archive", &archive])
}

fn show_window<R: Runtime>(window: &WebviewWindow<R>) {
    let _ = window.show();
    let _ = window.set_focus();
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "打开窗口", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出 CLB", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let _tray = TrayIconBuilder::with_id("main")
                .tooltip("CLB")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            show_window(&window);
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            show_window(&window);
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_state,
            save_settings,
            choose_backup_directory,
            choose_archive,
            run_backup,
            run_restore_plan
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
