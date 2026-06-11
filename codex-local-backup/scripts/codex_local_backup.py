#!/usr/bin/env python3
"""Create, inspect, and restore local Codex backup archives."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import socket
import stat
import sys
import tarfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable


DEFAULT_PATHS = (
    (".codex", ".codex"),
    ("Documents/Codex", "Documents/Codex"),
    ("Library/Application Support/Codex", "Library/Application Support/Codex"),
    ("Library/Application Support/com.openai.chat", "Library/Application Support/com.openai.chat"),
    ("Library/Application Support/OpenAI", "Library/Application Support/OpenAI"),
)


@dataclass(frozen=True)
class BackupPath:
    source: Path
    archive_path: str
    exists: bool


def utc_now_timestamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def host_slug() -> str:
    raw = socket.gethostname().split(".")[0] or "host"
    cleaned = "".join(char if char.isalnum() or char in ("-", "_") else "-" for char in raw)
    return cleaned.strip("-") or "host"


def json_dump(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))


def display_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser()
    if path.is_absolute():
        return path
    return Path.cwd() / path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sidecar_paths(archive: Path) -> tuple[Path, Path]:
    return archive.with_name(f"{archive.name}.manifest.json"), archive.with_name(f"{archive.name}.sha256")


def default_backup_paths(home: Path) -> list[BackupPath]:
    return [
        BackupPath(source=home / source, archive_path=archive_path, exists=(home / source).exists())
        for source, archive_path in DEFAULT_PATHS
    ]


def add_path_to_tar(tar: tarfile.TarFile, source: Path, archive_path: str) -> list[str]:
    skipped: list[str] = []

    def add_one(path: Path, arcname: str) -> None:
        try:
            st = path.lstat()
        except FileNotFoundError:
            skipped.append(arcname)
            return

        mode = st.st_mode
        if stat.S_ISDIR(mode):
            info = tar.gettarinfo(str(path), arcname=arcname)
            tar.addfile(info)
            for child in sorted(path.iterdir(), key=lambda item: item.name):
                add_one(child, f"{arcname}/{child.name}")
            return

        if stat.S_ISREG(mode):
            info = tar.gettarinfo(str(path), arcname=arcname)
            with path.open("rb") as handle:
                tar.addfile(info, handle)
            return

        if stat.S_ISLNK(mode):
            info = tar.gettarinfo(str(path), arcname=arcname)
            tar.addfile(info)
            return

        skipped.append(arcname)

    add_one(source, archive_path)
    return skipped


def create_backup(args: argparse.Namespace) -> int:
    home = display_path(args.home)
    output_dir = display_path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = args.timestamp or utc_now_timestamp()
    archive = output_dir / f"codex-local-backup-{host_slug()}-{timestamp}.tar.gz"
    manifest_path, checksum_path = sidecar_paths(archive)
    paths = default_backup_paths(home)
    skipped: list[str] = []

    with tarfile.open(archive, "w:gz") as tar:
        for entry in paths:
            if entry.exists:
                skipped.extend(add_path_to_tar(tar, entry.source, entry.archive_path))

    digest = sha256_file(archive)
    created_at = datetime.now().astimezone().isoformat(timespec="seconds")
    manifest = {
        "schema_version": 1,
        "mode": "local-manual",
        "created_at": created_at,
        "timestamp": timestamp,
        "host": socket.gethostname(),
        "home": str(home),
        "archive_name": archive.name,
        "archive_sha256": digest,
        "archive_size_bytes": archive.stat().st_size,
        "paths": [
            {
                "source": str(entry.source),
                "archive_path": entry.archive_path,
                "exists": entry.exists,
            }
            for entry in paths
        ],
        "skipped_special_files": skipped,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    checksum_path.write_text(f"{digest}  {archive.name}\n")

    json_dump(
        {
            "action": "backup",
            "archive": str(archive),
            "checksum": str(checksum_path),
            "manifest": str(manifest_path),
            "created_at": created_at,
            "sha256": digest,
            "included_paths": [entry.archive_path for entry in paths if entry.exists],
            "missing_paths": [entry.archive_path for entry in paths if not entry.exists],
            "skipped_special_files": skipped,
        }
    )
    return 0


def load_manifest_for_archive(archive: Path) -> dict | None:
    manifest_path, _ = sidecar_paths(archive)
    if not manifest_path.exists():
        return None
    return json.loads(manifest_path.read_text())


def checksum_status(archive: Path) -> tuple[str, str | None]:
    _, checksum_path = sidecar_paths(archive)
    digest = sha256_file(archive)
    if not checksum_path.exists():
        return "missing", digest
    expected = checksum_path.read_text().split()[0]
    if expected == digest:
        return "ok", digest
    return "mismatch", digest


def archive_top_level_paths(archive: Path) -> list[str]:
    paths: set[str] = set()
    with tarfile.open(archive, "r:gz") as tar:
        for member in tar.getmembers():
            parts = Path(member.name).parts
            if not parts:
                continue
            if parts[0] == "Documents" and len(parts) >= 2 and parts[1] == "Codex":
                paths.add("Documents/Codex")
            else:
                paths.add(parts[0])
    return sorted(paths)


def inspect_backup(args: argparse.Namespace) -> int:
    archive = display_path(args.archive)
    if not archive.exists():
        print(f"archive not found: {archive}", file=sys.stderr)
        return 2

    status, digest = checksum_status(archive)
    manifest = load_manifest_for_archive(archive)
    json_dump(
        {
            "action": "inspect",
            "archive": str(archive),
            "checksum_status": status,
            "sha256": digest,
            "manifest_found": manifest is not None,
            "top_level_paths": archive_top_level_paths(archive),
            "manifest": manifest,
        }
    )
    return 0 if status in ("ok", "missing") else 3


def require_valid_archive(archive: Path) -> tuple[str, dict | None]:
    status, digest = checksum_status(archive)
    if status == "mismatch":
        raise RuntimeError(f"checksum mismatch for {archive}")
    return digest or "", load_manifest_for_archive(archive)


def restore_targets(home: Path, manifest: dict | None, archive: Path) -> list[dict]:
    if manifest and manifest.get("paths"):
        archive_paths = [entry["archive_path"] for entry in manifest["paths"] if entry.get("exists")]
    else:
        archive_paths = archive_top_level_paths(archive)

    targets = []
    for archive_path in archive_paths:
        target = home / archive_path
        targets.append(
            {
                "archive_path": archive_path,
                "target_path": str(target),
                "currently_exists": target.exists(),
            }
        )
    return targets


def create_restore_plan(args: argparse.Namespace) -> int:
    home = display_path(args.home)
    archive = display_path(args.archive)
    if not archive.exists():
        print(f"archive not found: {archive}", file=sys.stderr)
        return 2

    digest, manifest = require_valid_archive(archive)
    targets = restore_targets(home, manifest, archive)
    json_dump(
        {
            "action": "restore-plan",
            "archive": str(archive),
            "archive_sha256": digest,
            "home": str(home),
            "requires_explicit_restore": True,
            "would_restore": [target["archive_path"] for target in targets],
            "targets": targets,
            "safety_backup_required": True,
        }
    )
    return 0


def copy_existing_targets_to_safety(targets: Iterable[dict], safety_root: Path) -> list[str]:
    preserved: list[str] = []
    safety_root.mkdir(parents=True, exist_ok=True)
    for target in targets:
        target_path = Path(target["target_path"])
        if not target_path.exists():
            continue
        destination = safety_root / target["archive_path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        if target_path.is_dir() and not target_path.is_symlink():
            shutil.copytree(target_path, destination, symlinks=True)
        else:
            shutil.copy2(target_path, destination, follow_symlinks=False)
        preserved.append(str(destination))
    return preserved


def remove_existing_targets(targets: Iterable[dict]) -> None:
    for target in targets:
        target_path = Path(target["target_path"])
        if not target_path.exists():
            continue
        if target_path.is_dir() and not target_path.is_symlink():
            shutil.rmtree(target_path)
        else:
            target_path.unlink()


def is_safe_member(member: tarfile.TarInfo) -> bool:
    name = member.name
    if name.startswith("/") or name == ".." or name.startswith("../") or "/../" in name:
        return False
    return True


def extract_archive_to_home(archive: Path, home: Path) -> list[str]:
    restored: list[str] = []
    home.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, "r:gz") as tar:
        for member in tar.getmembers():
            if not is_safe_member(member):
                raise RuntimeError(f"unsafe archive member: {member.name}")
            tar.extract(member, path=home)
            restored.append(member.name)
    return restored


def restore_backup(args: argparse.Namespace) -> int:
    if not args.confirm:
        print("restore is destructive and requires --confirm", file=sys.stderr)
        return 2

    home = display_path(args.home)
    archive = display_path(args.archive)
    if not archive.exists():
        print(f"archive not found: {archive}", file=sys.stderr)
        return 2

    digest, manifest = require_valid_archive(archive)
    targets = restore_targets(home, manifest, archive)
    timestamp = args.timestamp or utc_now_timestamp()
    safety_base = display_path(args.safety_dir) if args.safety_dir else home / "CodexRestoreSafety"
    safety_root = safety_base / f"codex-before-restore-{timestamp}"

    preserved = copy_existing_targets_to_safety(targets, safety_root)
    remove_existing_targets(targets)
    restored = extract_archive_to_home(archive, home)

    json_dump(
        {
            "action": "restore",
            "archive": str(archive),
            "archive_sha256": digest,
            "home": str(home),
            "safety_backup": str(safety_root),
            "preserved_targets": preserved,
            "restored_entries": restored,
        }
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Back up and restore local Codex data.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    backup = subparsers.add_parser("backup", help="Create a local Codex backup archive.")
    backup.add_argument("--home", default=str(Path.home()), help="Home directory to read from.")
    backup.add_argument("--output-dir", required=True, help="Directory where backup files are written.")
    backup.add_argument("--timestamp", help="Override timestamp for deterministic tests.")
    backup.set_defaults(func=create_backup)

    inspect = subparsers.add_parser("inspect", help="Inspect a backup archive.")
    inspect.add_argument("--archive", required=True, help="Backup archive to inspect.")
    inspect.set_defaults(func=inspect_backup)

    restore_plan = subparsers.add_parser("restore-plan", help="Show what a restore would do.")
    restore_plan.add_argument("--home", default=str(Path.home()), help="Home directory to restore into.")
    restore_plan.add_argument("--archive", required=True, help="Backup archive to inspect.")
    restore_plan.set_defaults(func=create_restore_plan)

    restore = subparsers.add_parser("restore", help="Restore a backup after explicit confirmation.")
    restore.add_argument("--home", default=str(Path.home()), help="Home directory to restore into.")
    restore.add_argument("--archive", required=True, help="Backup archive to restore.")
    restore.add_argument("--safety-dir", help="Directory where pre-restore safety copies are written.")
    restore.add_argument("--timestamp", help="Override timestamp for deterministic tests.")
    restore.add_argument("--confirm", action="store_true", help="Required to perform restore.")
    restore.set_defaults(func=restore_backup)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except (OSError, RuntimeError, tarfile.TarError, json.JSONDecodeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
