#!/usr/bin/env bash
# install-schema.sh — single-command schema installer.
# Reads supabase/MANIFEST.json, applies files in applyOrder, runs health check.
#
# Sub-mission: UM-CC_SCHEMA_MIGRATION / #04
#
# Exit codes:
#   0 = success (all applied + health PASS)
#   1 = apply failure (one or more files failed)
#   2 = health check drift detected (health-check returned 1)
#   3 = setup error (manifest missing, node missing, manifest invalid, env error)
#
# Usage:
#   ./scripts/install-schema.sh [--skip-health] [--dry-run] [--help]
#
# Conventions:
#   - Run from command-centrum/ (script auto-cds via $(dirname "$0")/..)
#   - Idempotent: re-running on already-installed DB → no-op SQL + PASS health
#   - apply-sql.mjs handles per-file connection + SQL execution
#   - schema-health-check.mjs validates DB against MANIFEST.json

set -euo pipefail

# ----------------------------------------------------------------------------
# Color helpers (with TERM-aware fallback)
# ----------------------------------------------------------------------------

if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  C_RED="$(tput setaf 1)"
  C_GREEN="$(tput setaf 2)"
  C_YELLOW="$(tput setaf 3)"
  C_CYAN="$(tput setaf 6)"
  C_BOLD="$(tput bold)"
  C_RESET="$(tput sgr0)"
else
  C_RED=""
  C_GREEN=""
  C_YELLOW=""
  C_CYAN=""
  C_BOLD=""
  C_RESET=""
fi

log_info()  { printf '%s\n' "$*"; }
log_step()  { printf '%s>>> %s%s\n' "$C_CYAN$C_BOLD" "$*" "$C_RESET"; }
log_ok()    { printf '%s%s%s\n' "$C_GREEN" "$*" "$C_RESET"; }
log_warn()  { printf '%s%s%s\n' "$C_YELLOW" "$*" "$C_RESET"; }
log_err()   { printf '%s%s%s\n' "$C_RED" "$*" "$C_RESET" 1>&2; }

# ----------------------------------------------------------------------------
# Arg parsing
# ----------------------------------------------------------------------------

SKIP_HEALTH=0
DRY_RUN=0

print_usage() {
  cat <<'USAGE'
install-schema.sh — single-command schema installer

Usage:
  ./scripts/install-schema.sh [--skip-health] [--dry-run] [--help]

Flags:
  --skip-health   Skip running scripts/schema-health-check.mjs after apply
  --dry-run       Print the apply plan (files in order) but do not execute
  --help, -h      Show this help

Exit codes:
  0  success (all applied + healthy)
  1  apply failure
  2  health check drift (FAIL count > 0)
  3  setup error (missing manifest/node/script)

Environment:
  SUPABASE_DB_URL or DATABASE_URL must be set for apply-sql.mjs to connect.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --skip-health) SKIP_HEALTH=1 ;;
    --dry-run)     DRY_RUN=1 ;;
    --help|-h)     print_usage; exit 0 ;;
    *)
      log_err "Unknown flag: $arg"
      print_usage
      exit 3
      ;;
  esac
done

# ----------------------------------------------------------------------------
# Pre-flight checks
# ----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

MANIFEST_PATH="supabase/MANIFEST.json"
APPLY_SCRIPT="scripts/apply-sql.mjs"
HEALTH_SCRIPT="scripts/schema-health-check.mjs"

if ! command -v node >/dev/null 2>&1; then
  log_err "Setup error: 'node' not found in PATH. Install Node 18+ first."
  exit 3
fi

if [ ! -f "$MANIFEST_PATH" ]; then
  log_err "Setup error: $MANIFEST_PATH missing. Run sub-mission #02 first."
  exit 3
fi

if [ ! -f "$APPLY_SCRIPT" ]; then
  log_err "Setup error: $APPLY_SCRIPT missing. Dependency chain broken (sub-mission #02 prereq)."
  exit 3
fi

if [ ! -f "$HEALTH_SCRIPT" ] && [ "$SKIP_HEALTH" -eq 0 ]; then
  log_err "Setup error: $HEALTH_SCRIPT missing. Run sub-mission #03 first or use --skip-health."
  exit 3
fi

# ----------------------------------------------------------------------------
# Read MANIFEST.files[] sorted by applyOrder
# ----------------------------------------------------------------------------
# Output one path per line on stdout. Node fail → exit 3.

PLAN="$(node -e '
  try {
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync("supabase/MANIFEST.json", "utf8"));
    if (!Array.isArray(m.files) || m.files.length === 0) {
      console.error("MANIFEST.files[] empty or missing");
      process.exit(2);
    }
    const sorted = m.files.slice().sort((a, b) => a.applyOrder - b.applyOrder);
    for (const f of sorted) console.log(f.path);
  } catch (e) {
    console.error("Failed to parse MANIFEST.json: " + e.message);
    process.exit(2);
  }
')" || {
  log_err "Setup error: could not read MANIFEST.json (see above)."
  exit 3
}

# Split PLAN into array (POSIX-compatible: read into array via IFS)
FILES=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  FILES+=("$line")
done <<< "$PLAN"

TOTAL=${#FILES[@]}

if [ "$TOTAL" -eq 0 ]; then
  log_err "Setup error: MANIFEST.files[] resolved to 0 entries."
  exit 3
fi

# ----------------------------------------------------------------------------
# Dry run
# ----------------------------------------------------------------------------

if [ "$DRY_RUN" -eq 1 ]; then
  log_step "Dry run — apply plan ($TOTAL files):"
  i=1
  for f in "${FILES[@]}"; do
    printf '  %2d. %s\n' "$i" "$f"
    i=$((i + 1))
  done
  log_info ""
  if [ "$SKIP_HEALTH" -eq 0 ]; then
    log_info "Then: $HEALTH_SCRIPT"
  else
    log_info "Health check: SKIPPED (--skip-health)"
  fi
  exit 0
fi

# ----------------------------------------------------------------------------
# Apply loop
# ----------------------------------------------------------------------------

START_TS=$(date +%s 2>/dev/null || echo 0)
APPLIED=0

log_step "Schema install starting — $TOTAL files"

for f in "${FILES[@]}"; do
  IDX=$((APPLIED + 1))
  log_step "Applying [$IDX/$TOTAL] $f"
  if [ ! -f "$f" ]; then
    log_err "SQL file not found: $f"
    log_err "Apply aborted at step $IDX/$TOTAL"
    exit 1
  fi
  if ! node "$APPLY_SCRIPT" "$f"; then
    log_err "Apply failed at [$IDX/$TOTAL] $f"
    exit 1
  fi
  APPLIED=$((APPLIED + 1))
  log_ok "OK [$IDX/$TOTAL] $f"
done

# ----------------------------------------------------------------------------
# Health check
# ----------------------------------------------------------------------------

HEALTH_LABEL="SKIPPED"
HEALTH_RC=0

if [ "$SKIP_HEALTH" -eq 0 ]; then
  log_step "Running schema health check"
  set +e
  node "$HEALTH_SCRIPT"
  HEALTH_RC=$?
  set -e
  case "$HEALTH_RC" in
    0) HEALTH_LABEL="PASS" ;;
    1) HEALTH_LABEL="FAIL (drift)" ;;
    2) HEALTH_LABEL="SETUP ERROR" ;;
    *) HEALTH_LABEL="UNKNOWN (rc=$HEALTH_RC)" ;;
  esac
fi

# ----------------------------------------------------------------------------
# Final report
# ----------------------------------------------------------------------------

END_TS=$(date +%s 2>/dev/null || echo 0)
DUR=$((END_TS - START_TS))

log_info ""
log_info "===================================="
log_info "Schema installation complete."
log_info "Applied: $APPLIED/$TOTAL files"
log_info "Health:  $HEALTH_LABEL"
log_info "Duration: ${DUR}s"
log_info "===================================="

# Propagate health exit code into installer exit
if [ "$SKIP_HEALTH" -eq 0 ]; then
  case "$HEALTH_RC" in
    0) exit 0 ;;
    1) exit 2 ;;   # drift
    2) exit 3 ;;   # setup error from health check
    *) exit 3 ;;
  esac
fi

exit 0
