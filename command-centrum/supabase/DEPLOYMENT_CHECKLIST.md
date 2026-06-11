# ARTIST INTELLIGENCE LAYER v2 — DevOps Deployment Checklist

**Status**: Ready for Production  
**Release Date**: May 11, 2026  
**Owner**: DevOps Lead  
**Estimated Downtime**: 30 minutes  
**Rollback Time**: 5 minutes  

---

## 📋 Pre-Deployment (Do This First)

### Day 1: Approval & Planning

- [ ] **Get stakeholder sign-off**
  - [ ] Scout Lead approves scout features
  - [ ] Backend Lead approves API endpoints
  - [ ] Product approves feed algorithm changes
  - [ ] Security reviews database permissions

- [ ] **Schedule maintenance window**
  - [ ] Chose date/time: ________________
  - [ ] Between 2-4am UTC (preferred)
  - [ ] Notified: Ops, Support, Comms team
  - [ ] Posted: Maintenance notice to status page
  - [ ] Backup window: 15min before start

- [ ] **Prepare migration team**
  - [ ] DevOps Lead: ________________
  - [ ] DBA: ________________
  - [ ] Backend Lead: ________________
  - [ ] Scout Lead (standby): ________________
  - [ ] All on call during maintenance

- [ ] **Gather all files** (in `command-centrum/supabase/`)
  - [ ] `ARTIST_INTELLIGENCE_UPGRADE_v2.sql` — schema migration
  - [ ] `deploy-artist-intelligence.sh` — safe deployment script
  - [ ] `ARTIST_INTELLIGENCE_README.md` — overview
  - [ ] `ARTIST_INTELLIGENCE_SCOUT_GUIDE.md` — scout documentation
  - [ ] `ARTIST_INTELLIGENCE_ARCHITECTURE.md` — full architecture

### Day 2: Staging Validation

- [ ] **Dry-run in staging**
  ```bash
  ./deploy-artist-intelligence.sh staging dry-run
  ```
  - [ ] No errors in output
  - [ ] Backup file created: ________________
  - [ ] Preview of changes reviewed

- [ ] **Execute migration in staging**
  ```bash
  ./deploy-artist-intelligence.sh staging execute
  ```
  - [ ] Migration completes successfully
  - [ ] No warnings/errors
  - [ ] Log reviewed: `logs/migration-*.log`

- [ ] **Verify schema integrity**
  ```sql
  -- Run these queries in staging
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema='public' AND table_name LIKE 'artist%' 
  ORDER BY table_name;
  -- Expected: 7 tables (artists, artist_*, scout_routing_tags)
  
  SELECT proname FROM pg_proc 
  WHERE pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')
  AND proname LIKE '%artist%'
  ORDER BY proname;
  -- Expected: 8+ functions
  
  SELECT COUNT(*) FROM scout_routing_tags;
  -- Expected: 12 pre-populated tags
  ```

- [ ] **Test sample data**
  ```sql
  -- Insert test artist
  SELECT upsert_artist_full(
    p_name => 'Test Artist',
    p_country => 'us',
    p_genre => 'trap',
    p_city => 'NYC'
  );
  -- Returns: artist_id (UUID)
  
  -- Verify scouting snapshot
  SELECT COUNT(*) FROM artist_scouting_snapshot;
  -- Expected: ≥1
  ```

- [ ] **API endpoint testing** (backend team)
  - [ ] POST `/api/scout/artist/add` — tested with sample data
  - [ ] GET `/api/scout/artist/{id}` — returns full record
  - [ ] GET `/api/scout/artist/{id}/network` — returns collaborators
  - [ ] POST `/api/scout/collaboration/add` — links artists
  - [ ] POST `/api/scout/event/add` — logs event
  - [ ] POST `/api/scout/tags/update` — assigns tags
  - [ ] GET `/api/scout/dashboard` — returns snapshot

- [ ] **Performance testing**
  - [ ] Query `artist_scouting_snapshot` with 10k+ artists
  - [ ] Confirm response time < 500ms
  - [ ] Check index usage: `EXPLAIN ANALYZE SELECT * FROM artist_scouting_snapshot LIMIT 100;`

- [ ] **Backup verification**
  - [ ] Backup file exists: ________________
  - [ ] File size reasonable: ________________
  - [ ] Can restore from backup (test in dev): [ ]

---

## 🚀 Deployment Day (Maintenance Window)

### T-30 minutes: Pre-flight Check

- [ ] **All stakeholders assembled** (Discord/Slack in #deployment)
  - [ ] DevOps Lead: ________________ (ready)
  - [ ] DBA: ________________ (ready)
  - [ ] Backend Lead: ________________ (ready)
  - [ ] Scout Lead: ________________ (standby)

- [ ] **Final checks**
  ```bash
  # Verify connectivity to production
  psql $DATABASE_URL_PROD -c "SELECT COUNT(*) FROM artists;"
  # Expected: [current artist count]
  
  # Verify backup directory
  ls -lh backups/
  # Expected: clean, space available
  ```

- [ ] **Announce start of maintenance** (if not already done)
  - [ ] Status page updated
  - [ ] Team Slack notification sent
  - [ ] External stakeholders notified

- [ ] **Enable deployment mode** (if applicable)
  - [ ] Load balancer in maintenance mode
  - [ ] Cache purged (if using caching layer)
  - [ ] Background jobs paused

### T+0: Start Migration

- [ ] **Execute dry-run in production** (confirm no errors)
  ```bash
  ./deploy-artist-intelligence.sh prod dry-run
  ```
  - [ ] Output reviewed and approved
  - [ ] Backup file: ________________
  - [ ] DBA confirms backup completeness

- [ ] **Execute actual migration**
  ```bash
  ./deploy-artist-intelligence.sh prod execute
  ```
  - [ ] Script starts at: ________________
  - [ ] Confirm prompt appears (requires manual confirmation)
  - [ ] Type "DEPLOY TO PROD" and press Enter
  - [ ] Migration progress monitored
  - [ ] No errors in console output

- [ ] **Monitor migration progress**
  - [ ] Check logs in real-time:
    ```bash
    tail -f logs/migration-*.log
    ```
  - [ ] No long hangs (should complete in ~5-15 minutes)
  - [ ] DBA monitoring database performance (CPU, memory, connections)

### T+15min: Verification Phase

- [ ] **Verify schema created successfully**
  ```sql
  -- Check new tables exist
  SELECT count(*) FROM pg_tables 
  WHERE schemaname='public' AND tablename IN (
    'artist_collaborations', 'artist_events', 
    'artist_metrics_history', 'scout_routing_tags'
  );
  -- Expected: 4 (all tables created)
  
  -- Check data still intact
  SELECT COUNT(*) FROM artists;
  -- Expected: [same count as before]
  ```

- [ ] **Verify functions exist**
  ```sql
  SELECT proname FROM pg_proc 
  WHERE proname IN ('upsert_artist_full', 'get_artist_network', 'recalculate_artist_popularity')
  ORDER BY proname;
  -- Expected: 3 functions returned
  ```

- [ ] **Quick sanity test**
  ```sql
  -- Test upsert function
  SELECT upsert_artist_full(
    'Sanity Test Artist',
    'prod-test',
    'trap'
  );
  -- Expected: UUID returned
  ```

- [ ] **Check database size**
  ```bash
  # Monitor disk usage
  df -h /data/postgres
  # Expected: reasonable increase (likely <1GB)
  ```

- [ ] **Verify indexes are created**
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE schemaname='public' AND tablename='artists'
  ORDER BY indexname;
  -- Expected: 12+ indexes (idx_artists_*)
  ```

### T+20min: App Integration

- [ ] **Deploy backend API code**
  - [ ] New endpoints deployed (scout API)
  - [ ] Feed boost algorithm updated
  - [ ] All services restarted: [ ]

- [ ] **Deploy frontend code**
  - [ ] Scout UI deployed
  - [ ] New forms available
  - [ ] Dashboard accessible

- [ ] **Verify API endpoints active**
  ```bash
  # Test one endpoint
  curl -X GET http://api.example.com/api/scout/dashboard?limit=1
  # Expected: 200 OK, returns artist data
  ```

- [ ] **Check error logs**
  ```bash
  tail -f /var/log/app/error.log
  # Expected: no new errors related to artist_*
  ```

### T+25min: Health Check

- [ ] **Monitor application metrics**
  - [ ] API response times normal
  - [ ] Database connection pool healthy
  - [ ] No spike in errors

- [ ] **Scout team standby test** (optional)
  - [ ] One scout logs in, tries intake form
  - [ ] Can submit sample artist data
  - [ ] Dashboard loads without errors

### T+30min: Exit Maintenance Mode

- [ ] **Disable maintenance mode**
  - [ ] Load balancer back to normal
  - [ ] Traffic flowing to app
  - [ ] Cache warmed (if applicable)

- [ ] **Update status page**
  - [ ] Maintenance completed
  - [ ] All services nominal

- [ ] **Announce deployment complete**
  - [ ] Slack notification: "Deployment successful ✓"
  - [ ] Team message with change summary
  - [ ] Link to new documentation

---

## ✅ Post-Deployment (Next 24 Hours)

### Within 1 Hour

- [ ] **Monitor error logs closely**
  ```bash
  # Watch for errors
  tail -f /var/log/app/error.log | grep -i artist
  # Expected: no errors (if errors appear, escalate immediately)
  ```

- [ ] **Monitor database metrics**
  - [ ] CPU usage: < 70%
  - [ ] Memory usage: normal
  - [ ] Connection count: stable
  - [ ] Query performance: no new slow queries

- [ ] **Validate data integrity**
  ```sql
  -- Spot check
  SELECT COUNT(*) FROM artists WHERE is_active=true;
  SELECT COUNT(*) FROM artist_collaborations;
  SELECT COUNT(*) FROM scout_routing_tags;
  ```

- [ ] **Test critical user paths**
  - [ ] Can add artist via scout intake form
  - [ ] Can view artist on scout dashboard
  - [ ] Can search for artists
  - [ ] Feed still displays normally

### Within 4 Hours

- [ ] **Setup metrics cron job** (if not already running)
  ```bash
  # Verify cron is scheduled
  crontab -l | grep artist_metrics
  # Expected: job scheduled for 2am UTC daily
  
  # Or run manually once to test
  python scripts/refresh_artist_metrics.py
  ```

- [ ] **Enable scout features gradually**
  - [ ] Feature flag: `artist_intelligence_enabled = true` for 10% users
  - [ ] Monitor adoption and errors
  - [ ] Gradual rollout: 10% → 25% → 50% → 100%

- [ ] **Scout team training** (if scheduled)
  - [ ] Conduct walkthrough with scouts
  - [ ] Share Scout Guide documentation
  - [ ] Answer initial questions

### Within 24 Hours

- [ ] **Review all logs**
  - [ ] Check for warnings: `logs/migration-*.log`
  - [ ] Check app errors: `/var/log/app/error.log`
  - [ ] Check database errors: PostgreSQL logs

- [ ] **Performance baseline**
  - [ ] Compare before/after metrics
  - [ ] Query response times acceptable
  - [ ] No unexpected resource usage

- [ ] **Scout adoption metrics**
  - [ ] # artists added: ________________
  - [ ] # collaborations linked: ________________
  - [ ] # tags assigned: ________________
  - [ ] # scout users active: ________________

- [ ] **Documentation cleanup**
  - [ ] Post deployment notes to wiki
  - [ ] Link Scout Guide in team handbook
  - [ ] Archive deployment log

---

## 🔄 Rollback Procedure (If Needed)

**Only execute if critical errors prevent normal operation**

### Pre-Rollback Checklist

- [ ] **Get approval from**
  - [ ] Product Lead
  - [ ] Engineering Lead

- [ ] **Locate backup file**
  ```bash
  ls -lh backups/
  # Expected: backup-prod-[timestamp].sql
  ```

- [ ] **Announce rollback**
  - [ ] Team notified
  - [ ] Users informed
  - [ ] Status page updated: "Rolling back to previous version"

### Execute Rollback

- [ ] **Restore from backup**
  ```bash
  psql $DATABASE_URL_PROD < backups/backup-prod-[TIMESTAMP].sql
  ```
  - [ ] Command completes successfully
  - [ ] Monitor output for errors

- [ ] **Verify restoration**
  ```sql
  SELECT COUNT(*) FROM artists;
  -- Expected: original count (before deployment)
  
  -- Verify old schema intact
  SELECT column_name FROM information_schema.columns
  WHERE table_name='artists'
  ORDER BY ordinal_position;
  ```

- [ ] **Revert application code**
  - [ ] Deploy previous version
  - [ ] Restart services
  - [ ] Clear cache

- [ ] **Verify application functional**
  - [ ] Feed displays normally
  - [ ] No API errors
  - [ ] Old features working

- [ ] **Post-mortem**
  - [ ] Document what went wrong
  - [ ] Schedule investigation meeting
  - [ ] File incident report

---

## 📊 Deployment Checklist Summary

```
Pre-Deployment:     ☐ ☐ ☐ ☐ ☐ (5 items)
Staging Validation: ☐ ☐ ☐ ☐ ☐ (5 items)
Deployment Day:     ☐ ☐ ☐ ☐ ☐ (5 items)
Verification:       ☐ ☐ ☐ ☐ ☐ (5 items)
Post-Deployment:    ☐ ☐ ☐ ☐ ☐ (5 items)

TOTAL: ☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐ / 25
```

---

## 🆘 Emergency Contacts

- **DevOps Lead**: ________________ (Slack: @)
- **DBA**: ________________ (Slack: @)
- **Backend Lead**: ________________ (Slack: @)
- **Scout Lead**: ________________ (Slack: @)
- **On-Call (24h)**: ________________ (Pagerduty)

---

## 📝 Notes

**Pre-Deployment Observations:**
```
_________________________________________________________________________
_________________________________________________________________________
_________________________________________________________________________
```

**During Deployment Issues:**
```
_________________________________________________________________________
_________________________________________________________________________
_________________________________________________________________________
```

**Post-Deployment Observations:**
```
_________________________________________________________________________
_________________________________________________________________________
_________________________________________________________________________
```

**Metrics Recorded:**
- Migration duration: ________________
- Downtime: ________________
- User complaints: ________________
- Feed performance change: ________________
- Scout adoption (24h): ________________

---

## ✅ Sign-off

- [ ] **DevOps Lead**: _____________ Date: _______
- [ ] **DBA**: _____________ Date: _______
- [ ] **Backend Lead**: _____________ Date: _______
- [ ] **Scout Lead**: _____________ Date: _______
- [ ] **Product Lead**: _____________ Date: _______

---

## 📚 Related Documents

- [ARTIST_INTELLIGENCE_README.md](ARTIST_INTELLIGENCE_README.md) — Overview
- [ARTIST_INTELLIGENCE_SCOUT_GUIDE.md](ARTIST_INTELLIGENCE_SCOUT_GUIDE.md) — Scout training
- [ARTIST_INTELLIGENCE_ARCHITECTURE.md](ARTIST_INTELLIGENCE_ARCHITECTURE.md) — Technical details
- [ARTIST_INTELLIGENCE_UPGRADE_v2.sql](ARTIST_INTELLIGENCE_UPGRADE_v2.sql) — Schema migration
- [deploy-artist-intelligence.sh](deploy-artist-intelligence.sh) — Deployment script

