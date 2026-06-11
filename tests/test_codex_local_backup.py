import json
import os
import subprocess
import sys
import tarfile
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "codex-local-backup" / "scripts" / "codex_local_backup.py"


def run_cli(*args, check=True):
    result = subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and result.returncode != 0:
        raise AssertionError(
            f"command failed with {result.returncode}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
    return result


class CodexLocalBackupTest(unittest.TestCase):
    def test_backup_includes_codex_home_and_documents_codex_by_default(self):
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            backup_dir = Path(tmp) / "backups"
            (home / ".codex" / "sessions").mkdir(parents=True)
            (home / ".codex" / "sessions" / "thread.jsonl").write_text("session\n")
            (home / "Documents" / "Codex" / "project").mkdir(parents=True)
            (home / "Documents" / "Codex" / "project" / "notes.md").write_text("notes\n")

            result = run_cli(
                "backup",
                "--home",
                str(home),
                "--output-dir",
                str(backup_dir),
                "--timestamp",
                "20260611-180000",
            )

            payload = json.loads(result.stdout)
            archive = Path(payload["archive"])
            manifest = Path(payload["manifest"])
            checksum = Path(payload["checksum"])
            self.assertTrue(archive.exists())
            self.assertTrue(manifest.exists())
            self.assertTrue(checksum.exists())

            manifest_data = json.loads(manifest.read_text())
            path_entries = {entry["archive_path"]: entry for entry in manifest_data["paths"]}
            self.assertTrue(path_entries[".codex"]["exists"])
            self.assertTrue(path_entries["Documents/Codex"]["exists"])
            self.assertEqual(manifest_data["mode"], "local-manual")
            self.assertEqual(manifest_data["archive_sha256"], payload["sha256"])

            with tarfile.open(archive, "r:gz") as tar:
                names = tar.getnames()
            self.assertIn(".codex/sessions/thread.jsonl", names)
            self.assertIn("Documents/Codex/project/notes.md", names)

    def test_inspect_verifies_checksum_and_reports_archive_contents(self):
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            backup_dir = Path(tmp) / "backups"
            (home / ".codex").mkdir(parents=True)
            (home / ".codex" / "config.toml").write_text("model='x'\n")
            (home / "Documents" / "Codex").mkdir(parents=True)
            (home / "Documents" / "Codex" / "log.md").write_text("hello\n")
            backup = json.loads(
                run_cli(
                    "backup",
                    "--home",
                    str(home),
                    "--output-dir",
                    str(backup_dir),
                    "--timestamp",
                    "20260611-181000",
                ).stdout
            )

            result = run_cli("inspect", "--archive", backup["archive"])

            payload = json.loads(result.stdout)
            self.assertEqual(payload["checksum_status"], "ok")
            self.assertIn(".codex", payload["top_level_paths"])
            self.assertIn("Documents/Codex", payload["top_level_paths"])

    def test_restore_plan_is_non_destructive_and_lists_existing_targets(self):
        with TemporaryDirectory() as tmp:
            source_home = Path(tmp) / "source-home"
            target_home = Path(tmp) / "target-home"
            backup_dir = Path(tmp) / "backups"
            (source_home / ".codex").mkdir(parents=True)
            (source_home / ".codex" / "config.toml").write_text("new\n")
            (source_home / "Documents" / "Codex").mkdir(parents=True)
            (source_home / "Documents" / "Codex" / "notes.md").write_text("new notes\n")
            (target_home / ".codex").mkdir(parents=True)
            (target_home / ".codex" / "config.toml").write_text("old\n")
            backup = json.loads(
                run_cli(
                    "backup",
                    "--home",
                    str(source_home),
                    "--output-dir",
                    str(backup_dir),
                    "--timestamp",
                    "20260611-182000",
                ).stdout
            )

            result = run_cli("restore-plan", "--home", str(target_home), "--archive", backup["archive"])

            payload = json.loads(result.stdout)
            self.assertEqual(payload["action"], "restore-plan")
            self.assertTrue(payload["requires_explicit_restore"])
            self.assertTrue(payload["would_restore"])
            target_entries = {entry["target_path"]: entry for entry in payload["targets"]}
            self.assertTrue(target_entries[str(target_home / ".codex")]["currently_exists"])
            self.assertFalse((target_home / "Documents" / "Codex").exists())
            self.assertEqual((target_home / ".codex" / "config.toml").read_text(), "old\n")

    def test_restore_requires_confirmation_and_preserves_safety_backup(self):
        with TemporaryDirectory() as tmp:
            source_home = Path(tmp) / "source-home"
            target_home = Path(tmp) / "target-home"
            backup_dir = Path(tmp) / "backups"
            safety_dir = Path(tmp) / "safety"
            (source_home / ".codex").mkdir(parents=True)
            (source_home / ".codex" / "config.toml").write_text("new\n")
            (source_home / "Documents" / "Codex").mkdir(parents=True)
            (source_home / "Documents" / "Codex" / "notes.md").write_text("new notes\n")
            (target_home / ".codex").mkdir(parents=True)
            (target_home / ".codex" / "config.toml").write_text("old\n")
            backup = json.loads(
                run_cli(
                    "backup",
                    "--home",
                    str(source_home),
                    "--output-dir",
                    str(backup_dir),
                    "--timestamp",
                    "20260611-183000",
                ).stdout
            )

            denied = run_cli("restore", "--home", str(target_home), "--archive", backup["archive"], check=False)
            self.assertNotEqual(denied.returncode, 0)
            self.assertIn("--confirm", denied.stderr)

            result = run_cli(
                "restore",
                "--home",
                str(target_home),
                "--archive",
                backup["archive"],
                "--safety-dir",
                str(safety_dir),
                "--timestamp",
                "20260611-184000",
                "--confirm",
            )

            payload = json.loads(result.stdout)
            self.assertEqual(payload["action"], "restore")
            self.assertEqual((target_home / ".codex" / "config.toml").read_text(), "new\n")
            self.assertEqual((target_home / "Documents" / "Codex" / "notes.md").read_text(), "new notes\n")
            preserved = Path(payload["safety_backup"]) / ".codex" / "config.toml"
            self.assertEqual(preserved.read_text(), "old\n")


if __name__ == "__main__":
    unittest.main()
