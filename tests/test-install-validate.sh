#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

TMP_ROOT="$(mktemp -d /tmp/codexbackup-install-validate.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

TEST_HOME="$TMP_ROOT/home"
LABEL="dev.codexbackup.toolkit.test.$(date +%s)"
mkdir -p "$TEST_HOME/Library/LaunchAgents"

HOME="$TEST_HOME" \
CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LAUNCHD_LABEL="$LABEL" \
CODEX_BACKUP_INSTALL_DIR="$TMP_ROOT/install" \
CODEX_BACKUP_LOCAL_DIR="$TMP_ROOT/backups" \
CODEX_BACKUP_SPOOL_DIR="$TMP_ROOT/spool" \
CODEX_BACKUP_STATE_DIR="$TMP_ROOT/state" \
./scripts/codexinstallautomation.sh validate >/tmp/codexbackup-install-validate.out

grep -Fq "Validated launchd plist for label: $LABEL" /tmp/codexbackup-install-validate.out
grep -Fq "No launchd job was loaded." /tmp/codexbackup-install-validate.out
[[ ! -e "$TEST_HOME/Library/LaunchAgents/${LABEL}.plist" ]] || { echo "validate left plist behind" >&2; exit 1; }

if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "validate unexpectedly loaded launchd job: $LABEL" >&2
  launchctl bootout "gui/$(id -u)" "$TEST_HOME/Library/LaunchAgents/${LABEL}.plist" >/dev/null 2>&1 || true
  exit 1
fi

rm -f /tmp/codexbackup-install-validate.out
echo "Install validate isolation passed."
