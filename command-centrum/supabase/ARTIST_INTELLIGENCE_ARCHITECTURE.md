# ARTIST INTELLIGENCE LAYER — Architecture & Implementation Plan

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SCOUT FRONTEND                                │
│  (Intake form, network visualization, metrics dashboard, tagging)  │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTP API
┌────────────────────────▼────────────────────────────────────────────┐
│                    BACKEND API LAYER                               │
│  POST   /api/scout/artist/add           (upsert_artist_full)       │
│  GET    /api/scout/artist/{id}          (read identity + metrics)   │
│  GET    /api/scout/artist/{id}/network  (get_artist_network)       │
│  POST   /api/scout/collaboration/add    (link producers, features) │
│  POST   /api/scout/event/add            (log performances)         │
│  POST   /api/scout/tags/update          (assign routing tags)      │
│  GET    /api/scout/dashboard            (artist_scouting_snapshot) │
│  GET    /api/search?q=...               (FTS on artist name)       │
└────────────────────────┬────────────────────────────────────────────┘
                         │ SQL
┌────────────────────────▼────────────────────────────────────────────┐
│                   SUPABASE DATABASE                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  CORE TABLES (ARTIST IDENTITY)                              │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  artists                                                      │  │
│  │  ├─ id (UUID)                                                │  │
│  │  ├─ name, normalized_name                                    │  │
│  │  ├─ country, city, region, language                          │  │
│  │  ├─ aliases, crew_collective, management_name, label_name   │  │
│  │  ├─ ALL platform URLs (Spotify, Apple, YT, IG, TikTok, etc)│  │
│  │  ├─ Metrics (monthly_listeners, followers, popularity_score)│  │
│  │  ├─ Scout routing (priority, notes, verified_at, assigned_to)
│  │  └─ Timestamps (created_at, updated_at, metrics_updated_at) │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  RELATIONSHIPS (WHO WORKS WITH WHOM)                         │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  artist_collaborations                                        │  │
│  │  ├─ artist_id, collaborator_id                               │  │
│  │  ├─ relation_type (producer, featured_on, collective, etc)  │  │
│  │  ├─ track_count, first_collab, last_collab                  │  │
│  │  └─ confidence score                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ACTIVITY TIMELINE                                            │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  artist_events                                                │  │
│  │  ├─ artist_id                                                │  │
│  │  ├─ event_type (concert, festival, podcast, radio, etc)    │  │
│  │  ├─ event_date, venue, city, country                         │  │
│  │  └─ url, notes                                               │  │
│  │                                                               │  │
│  │  artist_releases (existing)                                  │  │
│  │  ├─ track/album/EP/video releases                            │  │
│  │  ├─ dates, platform URLs, hot_trend flag                     │  │
│  │  └─ Used for release frequency calculation                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  METRICS & HISTORY                                            │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  artist_metrics_history                                       │  │
│  │  ├─ Daily snapshots of followers/listeners per platform      │  │
│  │  ├─ Platform: Spotify, YouTube, Instagram, TikTok, etc       │  │
│  │  ├─ measurement_date (unique per artist per day)             │  │
│  │  └─ Used for growth rate calculation & trend detection       │  │
│  │                                                               │  │
│  │  artist_score_history (existing)                             │  │
│  │  ├─ Tracks base_score + boost_multiplier changes             │  │
│  │  └─ Audit trail for feed algorithm tuning                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ROUTING & TAGS                                               │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  scout_routing_tags (predefined labels)                       │  │
│  │  ├─ tag_name, category, description                          │  │
│  │  ├─ Categories: momentum, audience, genre, geographic, etc   │  │
│  │  └─ Used: artists.tags = ARRAY of tag names                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  VIEWS (Optimized Queries)                                    │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  artist_scouting_snapshot                                     │  │
│  │  ├─ Identity + metrics + relationships (one query)            │  │
│  │  └─ Used by scout dashboard for fast rendering               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                         │ Feed Boost Logic
┌────────────────────────▼────────────────────────────────────────────┐
│              FEED RANKING & DISTRIBUTION                           │
│  story_clusters.artist_id ──> artist lookup                        │
│  Apply: base_score × boost_multiplier × routing multipliers        │
│  Result: story_clusters.effective_artist_score                     │
│  Used by: feed ranking algorithm                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagrams

### 1. Scout Intake Flow
```
Scout finds artist on Instagram/TikTok
        │
        ▼
Scout fills intake form:
- Name, country, genre
- Spotify/Apple/YouTube URLs
- Current label, management
- Scout priority + notes
        │
        ▼
POST /api/scout/artist/add
        │
        ▼
upsert_artist_full() in database
        │
        ├─ Check if exists by (normalized_name, country)
        ├─ If NEW: INSERT with first_seen_at = now()
        └─ If EXISTS: UPDATE with new URLs/metrics
        │
        ▼
Return: artist_id
        │
        ▼
Scout assigns tags:
- 'rising_star' (if follower_growth_30d > 50%)
- 'viral_potential' (if recently trending)
- 'underground' (if < 50k followers but engaged)
- Other routing tags
        │
        ▼
Scout tags artist:
UPDATE artists SET tags = array_append(tags, 'rising_star')
```

### 2. Collaboration Discovery Flow
```
Scout researches artist on SoundCloud/Genius
        │
        ▼
Finds: "Produced by Producer X" (on 5 tracks)
       "Features Feature Y" (on 3 tracks)
       "In crew with CrewMate Z"
        │
        ▼
Scout adds collaborations:
POST /api/scout/collaboration/add
{
  artist_id: "main-artist-id",
  collaborator_id: "producer-x-id", // or created if doesn't exist
  relation_type: "producer",
  track_count: 5,
  confidence: 0.95
}
        │
        ▼
INSERT into artist_collaborations
        │
        ▼
TRIGGER: recalculate_artist_popularity()
- Both artist_id and collaborator_id get recalculated
- Collaboration strength affects popularity boost
        │
        ▼
Scout dashboard shows collaborator network
```

### 3. Event Logging Flow
```
Scout finds: Artist performing at Rolling Loud 2026
        │
        ▼
POST /api/scout/event/add
{
  artist_id: "...",
  event_type: "festival",
  event_name: "Rolling Loud Miami 2026",
  event_date: "2026-05-20",
  venue: "Wynwood Field",
  city: "Miami"
}
        │
        ▼
INSERT into artist_events
        │
        ▼
Metrics recalculation includes event count
(for activity_component in popularity score)
        │
        ▼
Feed algorithm knows: "This artist has upcoming festival"
- May boost visibility pre-event
- May amplify post-event coverage
```

### 4. Metrics Refresh Flow (Automated Daily)
```
Cron job (2am UTC daily)
        │
        ▼
For each active artist:
  GET Spotify API: monthly_listeners, followers
  GET YouTube API: subscribers
  GET Instagram API: followers
  GET TikTok API: followers
  GET SoundCloud API: followers
        │
        ▼
INSERT into artist_metrics_history (snapshot)
        │
        ▼
Calculate growth rates:
- follower_growth_7d = (today - 7 days ago) / 7_days_ago * 100
- follower_growth_30d = (today - 30 days ago) / 30_days_ago * 100
        │
        ▼
UPDATE artists table:
- Latest metrics
- Growth rates
- metrics_updated_at = now()
- popularity_score = recalculate()
        │
        ▼
Log in artist_score_history if score changed significantly
```

### 5. Feed Boost Application Flow
```
Backend retrieves story_clusters for feed
        │
        ▼
For each cluster with artist_id:
        │
        ├─ Load artist data + tags
        ├─ base_score = artist.base_score (0-100)
        │
        ├─ Apply scout routing multipliers:
        │  ├─ if 'rising_star' in tags: *= 1.3
        │  ├─ if 'viral_potential' in tags: *= 1.5
        │  ├─ if scout_verified_at: *= 1.1
        │  └─ if 'independent' in tags: *= 1.05
        │
        ├─ Apply activity multiplier:
        │  └─ *= artist.boost_multiplier
        │     (from recent releases + events)
        │
        ├─ Apply priority multiplier:
        │  ├─ if priority_level = 'critical': *= 2.0
        │  ├─ if priority_level = 'high': *= 1.5
        │  └─ if priority_level = 'medium': *= 1.0
        │
        ▼
        effective_score = base_score × all multipliers
        
        ▼
Rank feed by effective_score (highest first)
```

---

## 🔧 Implementation Checklist

### Phase 1: Database Schema (Today)
- [ ] Run `ARTIST_INTELLIGENCE_UPGRADE_v2.sql` migration
- [ ] Verify all tables exist (artist_collaborations, artist_events, artist_metrics_history)
- [ ] Verify all functions exist (upsert_artist_full, get_artist_network, etc)
- [ ] Verify indexes created
- [ ] Verify view exists: artist_scouting_snapshot
- [ ] Verify triggers created (auto-updated_at, recalc popularity)
- [ ] Verify grant permissions set

### Phase 2: Cron Jobs (Day 1)
- [ ] Setup `metrics_refresh` cron job (daily 2am UTC)
  - Calls platform APIs (Spotify, YouTube, Instagram, TikTok, SoundCloud)
  - Inserts snapshot into artist_metrics_history
  - Updates artists table with latest metrics
  - Recalculates popularity scores
  - Logs exceptions to monitoring
- [ ] Test cron with 5 sample artists

### Phase 3: API Endpoints (Days 1-2)
- [ ] POST `/api/scout/artist/add` — calls upsert_artist_full()
- [ ] GET `/api/scout/artist/{id}` — returns full artist record
- [ ] GET `/api/scout/artist/{id}/network` — calls get_artist_network()
- [ ] POST `/api/scout/collaboration/add` — links artists
- [ ] POST `/api/scout/event/add` — logs performances/appearances
- [ ] POST `/api/scout/tags/update` — assign routing tags
- [ ] GET `/api/scout/dashboard` — returns artist_scouting_snapshot
- [ ] GET `/api/search?q=...` — FTS on artist name + aliases
- [ ] Test each endpoint with sample data

### Phase 4: Frontend Scout UI (Days 2-3)
- [ ] Scout intake form (name, URLs, platforms, metrics, priority)
- [ ] Network visualization (producers, features, collaborators, rivals)
- [ ] Event timeline (performances, festivals, radio)
- [ ] Metrics chart (followers over time, growth rate)
- [ ] Tag assignment UI (checkboxes for routing tags)
- [ ] Search/autocomplete for artist lookup
- [ ] Dashboard view (filters by priority, verified, tags)

### Phase 5: Feed Integration (Days 3-4)
- [ ] Update feed ranking algorithm with artist boost logic
- [ ] Apply routing multipliers based on scout tags
- [ ] Add artist_id lookup to story_clusters
- [ ] Test feed ranking with real data
- [ ] Monitor effective scores in production

### Phase 6: Testing & Validation (Day 4)
- [ ] Integration tests for each API endpoint
- [ ] Load test: 100,000 artists + metrics fetch
- [ ] Scout acceptance tests (with actual scouts)
- [ ] Monitor cron job success rate
- [ ] Validate metrics accuracy vs. platform APIs

### Phase 7: Training & Launch (Day 5)
- [ ] Scout team training on new system
- [ ] Handoff documentation (this file + SCOUT_GUIDE.md)
- [ ] Launch to production
- [ ] Monitor for 2 weeks

---

## 💾 Database Sizing & Performance

### Expected Volume (Year 1)
```
artists:                    10,000 → 100,000
artist_collaborations:      50,000 → 500,000
artist_events:               5,000 → 50,000
artist_metrics_history:     30,000,000 (3.65M/year per platform)
story_clusters:            100,000 → 1,000,000
```

### Storage Estimate
```
artists table:                    ~300MB (100k rows × 3KB)
artist_collaborations:            ~50MB
artist_events:                    ~10MB
artist_metrics_history:           ~500MB (daily snapshots)
Indexes:                          ~200MB
Total:                            ~1.1GB
```

### Query Performance
```
GET /api/scout/artist/{id}           : < 10ms (indexes on id)
GET /api/scout/artist/{id}/network   : < 50ms (FK indexes)
GET /api/scout/dashboard             : < 500ms (view materialization)
Search artist by name                : < 100ms (GIN FTS index)
Metrics refresh (10k artists)        : < 5min (parallel API calls)
```

### Indexes Created
```
idx_artists_normalized_name          — Fast artist lookup by name
idx_artists_country                  — Geo-based queries
idx_artists_genre                    — Genre-based filtering
idx_artists_score_desc               — Ranking queries
idx_artists_active                   — Activity filtering
idx_artists_recent                   — Latest release queries
idx_artists_tags                     — GIN index for tag searches
idx_artists_priority                 — Scout priority routing
idx_artist_collabs_artist            — Find collaborations for artist
idx_artist_collabs_confidence        — Sort by certainty
idx_artist_events_artist_date        — Timeline queries
idx_metrics_history_artist_date      — Growth trend queries
```

---

## 🔐 Security & Permissions

### Role-Based Access
```
SCOUT (authenticated users)
├─ SELECT artists, artist_collaborations, artist_events, metrics_history
├─ UPDATE artists (except created_at, first_seen_at)
├─ INSERT artist_collaborations, artist_events
└─ INSERT artist_metrics_history

SCOUT_LEAD (admin)
├─ Full CRUD on all artist tables
├─ Can modify scout_priority, scout_assigned_to
└─ Can approve bulk updates

SYSTEM (Cron jobs)
├─ INSERT/UPDATE artist_metrics_history
├─ UPDATE artists (metrics only)
└─ Call recalculate_artist_popularity()

API (Backend service account)
├─ Full CRUD as needed
└─ Limited by business logic (not DB constraints)
```

### Row-Level Security (Optional Future)
```sql
-- Scouts can only modify artists assigned to them
CREATE POLICY scout_own_artists ON artists
  FOR UPDATE
  USING (scout_assigned_to = auth.uid() OR auth.is_admin())
```

---

## 📚 Database Relationships Diagram

```
artists (PK: id)
├── artist_id
├── normalized_name (unique with country)
├── Updated by: upsert_artist_full()
├── Updated by: metrics cron (daily)
└── Triggers: normalize_name, update_updated_at
    │
    ├─→ artist_collaborations (FK: artist_id, collaborator_id)
    │   ├─ Stores: producer, featured_on, collective, etc.
    │   ├─ Trigger on INSERT/UPDATE: recalculate popularity
    │   └─ Query: get_artist_network()
    │
    ├─→ artist_events (FK: artist_id)
    │   ├─ Stores: concerts, festivals, radio, podcasts
    │   ├─ Used for: activity score calculation
    │   └─ Query: upcoming events, tour history
    │
    ├─→ artist_metrics_history (FK: artist_id)
    │   ├─ Daily snapshots: followers, listeners
    │   ├─ Calculated: growth_7d, growth_30d
    │   └─ Query: trend detection, growth analysis
    │
    ├─→ artist_score_history (FK: artist_id)
    │   ├─ Audit trail: score changes + reasons
    │   └─ Query: feed algorithm tuning
    │
    └─→ story_clusters (FK: artist_id)
        ├─ Link clusters to known artists
        ├─ Used for: content attribution + feed boosting
        └─ Query: "show me stories about rising_star artists"
```

---

## 🚀 Deployment Steps

### 1. Pre-deployment Validation
```bash
# Test migration script locally
psql hotdroppz_dev < ARTIST_INTELLIGENCE_UPGRADE_v2.sql

# Verify schema
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'artist%';
# Should return: artists, artist_collaborations, artist_events, artist_metrics_history, artist_score_history

# Verify functions
SELECT p.proname FROM pg_proc p
WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND p.proname LIKE '%artist%';
```

### 2. Staging Deployment
```bash
# 1. Backup production DB
pg_dump -h prod-db -U postgres hotdroppz > backup-2026-05-11.sql

# 2. Apply to staging
psql -h staging-db -U postgres < ARTIST_INTELLIGENCE_UPGRADE_v2.sql

# 3. Test all endpoints
npm run test:api -- --tag scout

# 4. Validate metrics cron
node scripts/test-metrics-cron.js
```

### 3. Production Deployment
```bash
# 1. Schedule maintenance window (2am UTC, 30 min)
# 2. Run migration (batched if large)
psql -h prod-db -U postgres < ARTIST_INTELLIGENCE_UPGRADE_v2.sql

# 3. Verify migration succeeded
SELECT COUNT(*) FROM artists;
SELECT COUNT(*) FROM artist_collaborations;

# 4. Monitor for errors
tail -f /var/log/app/error.log

# 5. Gradual rollout: Enable scout features to 10% users
# 6. Monitor, then 100%
```

---

## 📞 Troubleshooting

### Issue: Migration fails on unique constraint
**Cause**: Duplicate (normalized_name, country) pairs exist
**Fix**: Manually merge before running migration
```sql
-- Find duplicates
SELECT normalized_name, country, COUNT(*)
FROM artists GROUP BY 1, 2 HAVING COUNT(*) > 1;

-- Manual merge script (case-by-case)
UPDATE artist_collaborations SET artist_id = final_id WHERE artist_id = duplicate_id;
DELETE FROM artists WHERE id = duplicate_id;
```

### Issue: Metrics refresh fails
**Cause**: Platform API rate limit or timeout
**Fix**: 
```python
# Add retry logic + exponential backoff
# Add circuit breaker: if 5 consecutive failures, skip platform
# Add monitoring alert
```

### Issue: Scout dashboard slow
**Cause**: View materialization too slow
**Fix**:
```sql
-- Materialize the view (refreshed hourly)
CREATE MATERIALIZED VIEW artist_scouting_snapshot_cached AS
SELECT ... FROM artist_scouting_snapshot;

CREATE INDEX ON artist_scouting_snapshot_cached(scout_priority);

-- Refresh hourly
SELECT REFRESH MATERIALIZED VIEW artist_scouting_snapshot_cached;
```

---

## 📈 Future Enhancements

1. **Machine Learning**: 
   - Predict next artist breakout (trending score)
   - Recommend collaborations (if A works with B, suggest B works with C)
   - Auto-tag artists (rising_star, underground) based on metrics

2. **Social Graph Visualization**:
   - Network graph: artists as nodes, collaborations as edges
   - Community detection (find crews, find rival clusters)
   - Influence propagation (if A trends, expect B to trend)

3. **Predictive Metrics**:
   - Forecast follower growth (time series model)
   - Flag anomalies (unusual growth spike = investigate)
   - Predict churn (losing followers = may be slowing)

4. **Integration with Content Management**:
   - Auto-route stories to artist's fan communities
   - Cross-reference artist relationships with story themes
   - Suggest artist collaborations before they happen

5. **Scout Gamification**:
   - Leaderboard: scouts who find biggest breakouts
   - Accuracy score: compare scout predictions vs. actual metrics
   - Badges: "spotted 10 rising stars"
