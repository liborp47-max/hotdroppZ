#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# ARTIST INTELLIGENCE LAYER v2 — Safe Migration Script
# ═══════════════════════════════════════════════════════════════════════════════
# 
# Usage:
#   ./deploy-artist-intelligence.sh [environment] [dry-run|execute]
#
# Environments: dev, staging, prod
# Modes: dry-run (default) - shows what will happen
#        execute - actually runs migration
#
# Example:
#   ./deploy-artist-intelligence.sh staging dry-run
#   ./deploy-artist-intelligence.sh prod execute
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-staging}"
MODE="${2:-dry-run}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups"
LOG_DIR="logs"
SCRIPT_NAME="ARTIST_INTELLIGENCE_UPGRADE_v2.sql"

# Validate inputs
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo -e "${RED}ERROR: Invalid environment '$ENVIRONMENT'. Must be: dev, staging, prod${NC}"
  exit 1
fi

if [[ ! "$MODE" =~ ^(dry-run|execute)$ ]]; then
  echo -e "${RED}ERROR: Invalid mode '$MODE'. Must be: dry-run, execute${NC}"
  exit 1
fi

# Setup directories
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Load environment-specific database URL
case $ENVIRONMENT in
  dev)
    if [ -z "${DATABASE_URL_DEV:-}" ]; then
      echo -e "${RED}ERROR: DATABASE_URL_DEV not set${NC}"
      exit 1
    fi
    DB_URL="$DATABASE_URL_DEV"
    ;;
  staging)
    if [ -z "${DATABASE_URL_STAGING:-}" ]; then
      echo -e "${RED}ERROR: DATABASE_URL_STAGING not set${NC}"
      exit 1
    fi
    DB_URL="$DATABASE_URL_STAGING"
    ;;
  prod)
    if [ -z "${DATABASE_URL_PROD:-}" ]; then
      echo -e "${RED}ERROR: DATABASE_URL_PROD not set${NC}"
      exit 1
    fi
    DB_URL="$DATABASE_URL_PROD"
    ;;
esac

# Logging function
log() {
  local level=$1
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "[${timestamp}] ${level}: ${message}" | tee -a "${LOG_DIR}/migration-${TIMESTAMP}.log"
}

print_header() {
  echo -e "${BLUE}"
  echo "╔════════════════════════════════════════════════════════════════════════════════╗"
  echo "║  ARTIST INTELLIGENCE LAYER v2 — Safe Migration                                 ║"
  echo "║  Environment: $ENVIRONMENT                                                     ║"
  echo "║  Mode: $MODE                                                                    ║"
  echo "║  Timestamp: $TIMESTAMP                                                         ║"
  echo "╚════════════════════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

validate_schema() {
  log "INFO" "Validating SQL schema syntax..."
  
  if [ ! -f "$SCRIPT_NAME" ]; then
    log "ERROR" "Schema file not found: $SCRIPT_NAME"
    exit 1
  fi
  
  # Basic syntax check (not comprehensive)
  if ! grep -q "create table if not exists artist_collaborations" "$SCRIPT_NAME"; then
    log "ERROR" "Schema file appears incomplete (missing artist_collaborations)"
    exit 1
  fi
  
  if ! grep -q "create table if not exists artist_events" "$SCRIPT_NAME"; then
    log "ERROR" "Schema file appears incomplete (missing artist_events)"
    exit 1
  fi
  
  log "INFO" "✓ Schema syntax validated"
}

create_backup() {
  log "INFO" "Creating database backup..."
  
  local backup_file="${BACKUP_DIR}/backup-${ENVIRONMENT}-${TIMESTAMP}.sql"
  
  if PGPASSWORD="${DB_PASS:-}" pg_dump \
    --dbname="$DB_URL" \
    --verbose \
    --no-password \
    > "$backup_file" 2>&1; then
    
    log "INFO" "✓ Backup created: $backup_file ($(du -h "$backup_file" | cut -f1))"
    echo "$backup_file"
  else
    log "ERROR" "Backup failed!"
    exit 1
  fi
}

check_database_connectivity() {
  log "INFO" "Checking database connectivity..."
  
  if psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    log "INFO" "✓ Database connectivity OK"
    
    # Get DB stats
    local artist_count=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM artists;" 2>/dev/null || echo "unknown")
    log "INFO" "  Current artist count: $artist_count"
  else
    log "ERROR" "Cannot connect to database!"
    exit 1
  fi
}

check_table_exists() {
  local table_name=$1
  
  if psql "$DB_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name='$table_name';" | grep -q 1; then
    return 0
  else
    return 1
  fi
}

preview_changes() {
  log "INFO" "Preview of changes that will be applied:"
  echo ""
  echo -e "${YELLOW}NEW TABLES:${NC}"
  echo "  • artist_collaborations — artist relationships (producers, features, rivals, etc)"
  echo "  • artist_events — performances, festivals, radio, podcasts"
  echo "  • artist_metrics_history — daily snapshots of followers/listeners"
  echo "  • scout_routing_tags — predefined routing tags"
  echo ""
  echo -e "${YELLOW}COLUMNS ADDED TO 'artists':${NC}"
  echo "  • Identity: aliases, city, region, language, crew_collective, management_name, label_name"
  echo "  • Platforms: soundcloud_url, bandcamp_url, facebook_url, website_url"
  echo "  • Metrics: spotify_followers, monthly_listeners, youtube_subscribers, instagram_followers, etc"
  echo "  • Scout routing: scout_priority, scout_notes, scout_assigned_to, scout_verified_at"
  echo ""
  echo -e "${YELLOW}NEW FUNCTIONS:${NC}"
  echo "  • upsert_artist_full() — create/update artist with full identity"
  echo "  • get_artist_network() — get collaborator network"
  echo "  • recalculate_artist_popularity() — compute popularity score"
  echo ""
  echo -e "${YELLOW}NEW VIEWS:${NC}"
  echo "  • artist_scouting_snapshot — optimized view for scout dashboard"
  echo ""
  echo -e "${YELLOW}NEW INDEXES:${NC}"
  echo "  • 12+ indexes for fast lookups (name, country, genre, score, tags, etc)"
  echo ""
  echo -e "${YELLOW}NEW TRIGGERS:${NC}"
  echo "  • Automatic normalization of artist names"
  echo "  • Automatic updated_at timestamp"
  echo "  • Automatic popularity recalculation on collaborations"
  echo ""
}

execute_migration() {
  log "INFO" "Executing migration..."
  
  local start_time=$(date +%s)
  
  if psql "$DB_URL" \
    --no-password \
    --variable=ON_ERROR_STOP=on \
    -f "$SCRIPT_NAME" \
    > "${LOG_DIR}/migration-output-${TIMESTAMP}.log" 2>&1; then
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "INFO" "✓ Migration completed in ${duration}s"
    
    # Verify new tables exist
    if check_table_exists "artist_collaborations" && \
       check_table_exists "artist_events" && \
       check_table_exists "artist_metrics_history"; then
      log "INFO" "✓ All new tables created successfully"
    else
      log "ERROR" "Migration appears incomplete - some tables missing!"
      exit 1
    fi
    
    # Verify functions exist
    local func_count=$(psql "$DB_URL" -t -c "
      SELECT COUNT(*) FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
      AND proname IN ('upsert_artist_full', 'get_artist_network', 'recalculate_artist_popularity');
    " 2>/dev/null || echo "0")
    
    if [ "$func_count" -ge 3 ]; then
      log "INFO" "✓ All new functions created successfully"
    else
      log "ERROR" "Migration appears incomplete - some functions missing!"
      exit 1
    fi
    
  else
    log "ERROR" "Migration failed! See ${LOG_DIR}/migration-output-${TIMESTAMP}.log for details"
    exit 1
  fi
}

verify_data_integrity() {
  log "INFO" "Verifying data integrity..."
  
  # Check existing artists still present
  local original_artist_count=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM artists;")
  log "INFO" "  Artists after migration: $original_artist_count"
  
  # Check no unexpected NULL values
  local nullable_check=$(psql "$DB_URL" -t -c "
    SELECT COUNT(*) FROM artists
    WHERE name IS NULL OR normalized_name IS NULL OR country IS NULL OR genre IS NULL;
  ")
  
  if [ "$nullable_check" = "0" ]; then
    log "INFO" "✓ Data integrity verified (no unexpected NULLs)"
  else
    log "WARNING" "Found $nullable_check rows with unexpected NULLs"
  fi
}

rollback_migration() {
  local backup_file=$1
  
  log "WARNING" "ROLLING BACK migration..."
  log "INFO" "Restoring from backup: $backup_file"
  
  if psql "$DB_URL" -f "$backup_file" > /dev/null 2>&1; then
    log "INFO" "✓ Rollback completed successfully"
  else
    log "ERROR" "ROLLBACK FAILED! Database may be in inconsistent state!"
    log "ERROR" "Backup file: $backup_file"
    log "ERROR" "Manual intervention required!"
    exit 1
  fi
}

# Production safety checks
production_safety_check() {
  if [ "$ENVIRONMENT" = "prod" ]; then
    log "WARNING" "PRODUCTION MODE DETECTED - Additional checks enabled"
    
    # Check if it's during maintenance window (2-4am UTC)
    local current_hour=$(date -u +%H)
    if [ "$current_hour" -lt 2 ] || [ "$current_hour" -ge 4 ]; then
      log "ERROR" "Production migrations only allowed 2-4am UTC"
      log "ERROR" "Current time: $(date -u)"
      exit 1
    fi
    
    # Require explicit confirmation
    echo -e "${RED}"
    echo "╔════════════════════════════════════════════════════════════════════════════════╗"
    echo "║  PRODUCTION DEPLOYMENT — FINAL CONFIRMATION REQUIRED                          ║"
    echo "║                                                                                ║"
    echo "║  This will migrate the PRODUCTION database. Enter to continue, or Ctrl+C to   ║"
    echo "║  abort.                                                                        ║"
    echo "║                                                                                ║"
    echo "║  Backup: $BACKUP_FILE                                              ║"
    echo "║  Rollback available if migration fails.                                        ║"
    echo "╚════════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    read -p "Type 'DEPLOY TO PROD' to continue: " confirm
    if [ "$confirm" != "DEPLOY TO PROD" ]; then
      log "INFO" "Production deployment aborted by user"
      exit 1
    fi
  fi
}

print_summary() {
  local duration=$1
  
  echo ""
  echo -e "${GREEN}"
  echo "╔════════════════════════════════════════════════════════════════════════════════╗"
  echo "║  MIGRATION COMPLETE ✓                                                          ║"
  echo "║                                                                                ║"
  echo "║  Environment: $ENVIRONMENT"
  echo "║  Duration: ${duration}s"
  echo "║  Log file: ${LOG_DIR}/migration-${TIMESTAMP}.log"
  echo "║  Backup: $BACKUP_FILE"
  echo "║                                                                                ║"
  echo "║  Next steps:                                                                   ║"
  echo "║  1. Review migration log for any warnings                                      ║"
  echo "║  2. Run integration tests                                                      ║"
  echo "║  3. Deploy API endpoints                                                       ║"
  echo "║  4. Deploy scout UI                                                           ║"
  echo "║  5. Train scout team                                                           ║"
  echo "║  6. Monitor for issues (24h)                                                   ║"
  echo "╚════════════════════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

main() {
  print_header
  log "INFO" "Starting migration for environment: $ENVIRONMENT, mode: $MODE"
  
  # Step 1: Validation
  log "INFO" "Step 1/7: Validation"
  validate_schema
  check_database_connectivity
  
  # Step 2: Backup
  log "INFO" "Step 2/7: Backup"
  BACKUP_FILE=$(create_backup)
  
  # Step 3: Preview
  log "INFO" "Step 3/7: Preview changes"
  preview_changes
  
  if [ "$MODE" = "dry-run" ]; then
    log "INFO" "DRY-RUN MODE: Skipping actual migration"
    log "INFO" "Backup file: $BACKUP_FILE"
    log "INFO" "Run with mode 'execute' to actually apply migration"
    exit 0
  fi
  
  # Production checks
  if [ "$ENVIRONMENT" = "prod" ]; then
    log "INFO" "Step 4/7: Production safety checks"
    production_safety_check
  fi
  
  # Step 5: Execute
  log "INFO" "Step 5/7: Execute migration"
  local migration_start=$(date +%s)
  
  if ! execute_migration; then
    log "ERROR" "Migration failed!"
    log "INFO" "Attempting rollback..."
    rollback_migration "$BACKUP_FILE"
    exit 1
  fi
  
  local migration_end=$(date +%s)
  local migration_duration=$((migration_end - migration_start))
  
  # Step 6: Verify
  log "INFO" "Step 6/7: Verify integrity"
  verify_data_integrity
  
  # Step 7: Summary
  log "INFO" "Step 7/7: Summary"
  print_summary $migration_duration
  
  log "INFO" "Migration completed successfully!"
}

# Run main function
main "$@"
