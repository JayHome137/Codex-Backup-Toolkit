import { invoke } from "@tauri-apps/api/core";
import type { ScheduleMode } from "./schedule";

export type DesktopAppState = {
  backupDir: string;
  scheduleMode: ScheduleMode;
  intervalDays: number;
  lastSuccessAt: string | null;
  lastArchive: string | null;
  lastError: string | null;
};

export async function getAppState() {
  return invoke<DesktopAppState>("get_app_state");
}

export async function saveSettings(settings: { backupDir: string; scheduleMode: string; intervalDays: number }) {
  return invoke<DesktopAppState>("save_settings", { settings });
}

export async function chooseBackupDirectory() {
  return invoke<string | null>("choose_backup_directory");
}

export async function chooseArchive() {
  return invoke<string | null>("choose_archive");
}

export async function runBackup(outputDir: string) {
  return invoke("run_backup", { outputDir });
}

export async function runRestorePlan(archive: string) {
  return invoke("run_restore_plan", { archive });
}
