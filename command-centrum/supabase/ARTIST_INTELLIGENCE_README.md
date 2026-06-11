# ARTIST INTELLIGENCE LAYER v2 — Deployment Guide

> **Status**: Production Ready  
> **Version**: 2.0  
> **Created**: May 11, 2026  
> **Scope**: Complete artist identity + relationships + metrics system for scouting

---

## 📋 Summary

The Artist Intelligence Layer transforms the `artists` table from a basic registry into a comprehensive "source of truth" for scouting accuracy. 

**What you get:**
- **Identity**: Complete artist profiles (aliases, city, label, management, crew)
- **Platforms**: All social + streaming URLs (Spotify, Apple, YouTube, Instagram, TikTok, SoundCloud, Bandcamp, website)
- **Metrics**: Live follower counts, monthly listeners, growth rates, popularity scores
- **Relationships**: Producer links, collaborators, collective members, rivals, allies
- **Events**: Performance history (concerts, festivals, radio, podcasts, interviews)
- **Scouting**: Priority routing tags, verification status, scout assignments

**Impact:**
- ✅ Scouts can see complete artist profile in one view
- ✅ Feed algorithm boosts artists with verified scouting data
- ✅ Relationships surface producer trends + viral networks
- ✅ Metrics enable data-driven routing (rising stars, viral potential)
- ✅ Event timeline captures visibility spikes

---

## 🚀 Quick Start (5 minutes)

### 1. Deploy Schema
```bash
# Copy the SQL file to your Supabase instance
cat ARTIST_INTELLIGENCE_UPGRADE_v2.sql | psql $DATABASE_URL

# Verify tables created
psql $DATABASE_URL -c "
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name LIKE 'artist%'
  ORDER BY table_name;
"
```

**Expected output:**
```
                       table_name
──────────────────────────────────────────
artist_collaborations
artist_events
artist_metrics_history
artist_score_history
artist_scouting_snapshot (view)
artists
scout_routing_tags
```

### 2. Verify Functions
```bash
psql $DATABASE_URL -c "
  SELECT p.proname FROM pg_proc p
  WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND p.proname LIKE '%artist%'
  ORDER BY p.proname;
"
```

**Expected output:**
```
         proname
──────────────────────────────────────
boost_artist_on_release (removed in v2)
get_artist_network
normalize_artist_name
recalculate_artist_popularity
trigger_recalc_on_collaboration_change
update_artists_updated_at
update_collaborations_updated_at
upsert_artist_full
upsert_artist_from_scout
```

### 3. Test with Sample Data
```bash
# Insert sample artist
psql $DATABASE_URL -c "
SELECT upsert_artist_full(
  p_name => 'Testing Artist',
  p_country => 'us',
  p_genre => 'trap',
  p_city => 'NYC',
  p_aliases => ARRAY['Test', 'T-Series'],
  p_spotify_url => 'https://open.spotify.com/artist/...',
  p_scout_priority => 'priority'
);
"

# Query scout dashboard view
psql $DATABASE_URL -c "SELECT id, name, country, genre, spotify_monthly_listeners, popularity_score FROM artist_scouting_snapshot LIMIT 5;"
```

---

## 📂 Files Included

| File | Purpose | Audience |
|------|---------|----------|
| `ARTIST_INTELLIGENCE_UPGRADE_v2.sql` | Database schema migration | DevOps, Database Admin |
| `ARTIST_INTELLIGENCE_SCOUT_GUIDE.md` | How scouts use the system | Scouts, Scout Lead |
| `ARTIST_INTELLIGENCE_ARCHITECTURE.md` | Full technical architecture | Backend Devs, Architects |
| `ARTIST_INTELLIGENCE_README.md` | This file | Everyone |

---

## 🔧 Architecture Overview

### Tables

**`artists`** — Core artist identity
```sql
Columns:
  id, name, normalized_name, country, city, region, language, genre
  aliases[], crew_collective, management_name, label_name
  spotify_url, apple_music_url, youtube_url, instagram_url, tiktok_url, soundcloud_url, bandcamp_url, website_url
  spotify_followers, spotify_monthly_listeners, youtube_subscribers, instagram_followers, tiktok_followers, ...
  popularity_score (0-100), follower_growth_7d, follower_growth_30d, metrics_updated_at
  scout_priority, scout_notes, scout_assigned_to, scout_verified_at
  base_score, boost_multiplier, trending_boost
  tags[] (for routing: 'rising_star', 'viral_potential', 'underground', etc)
  is_active, created_at, updated_at
```

**`artist_collaborations`** — Who works with whom
```sql
Columns:
  id, artist_id, collaborator_id
  relation_type: 'producer' | 'featured_on' | 'features' | 'collective_member' | 'label_mate' | 'rival' | 'ally'
  track_count, first_collab, last_collab, confidence
  notes, created_at, updated_at
```

**`artist_events`** — Performance history
```sql
Columns:
  id, artist_id
  event_type: 'concert' | 'festival' | 'radio' | 'podcast' | 'interview' | 'livestream' | 'award_show'
  event_name, event_date, venue, city, country
  url, notes, created_at
```

**`artist_metrics_history`** — Daily metrics snapshots
```sql
Columns:
  id, artist_id, measurement_date
  spotify_monthly_listeners, spotify_followers, youtube_subscribers, instagram_followers, tiktok_followers, soundcloud_followers
  popularity_score, total_engagement, created_at
```

**`scout_routing_tags`** — Predefined routing labels
```sql
Pre-populated tags:
  rising_star, underground, viral_potential, local_hero, international,
  conscious_rap, trap_king, collaboration_magnet, signed_priority, independent,
  podcast_active, verified_authentic
```

### Views

**`artist_scouting_snapshot`** — Scout dashboard (one query)
```sql
Returns: identity + metrics + relationships for quick scouting view
Used by: /api/scout/dashboard endpoint
```

### Functions

**`upsert_artist_full(...)`** — Create or update artist from scout intake
```
Called by: POST /api/scout/artist/add
Params: name, country, genre, city, aliases, label, management, all URLs, metrics, priority
Returns: artist_id
Behavior: 
  - Creates new artist if (normalized_name, country) doesn't exist
  - Updates existing if found
  - Preserves first_seen_at
```

**`get_artist_network(artist_id, depth)`** — Get collaborator network
```
Called by: GET /api/scout/artist/{id}/network
Returns: Recursive collaborators up to depth (producers, features, collectives, etc)
Used for: Network visualization, context
```

**`recalculate_artist_popularity(artist_id)`** — Compute popularity score
```
Called by: Metrics cron job, or manually
Calculation:
  - Spotify component (0-30 pts): ln(monthly_listeners)
  - Social component (0-40 pts): avg of (YouTube + Instagram + TikTok) followers
  - Activity component (0-30 pts): recent releases + events
  - Total: capped at 100
```

---

## 🔗 Integration Points

### 1. Scout Intake API
```javascript
POST /api/scout/artist/add
Body: {
  name: "Artist Name",
  country: "cz",
  genre: "trap",
  city: "Prague",
  aliases: ["Alias1"],
  language: "en",
  label_name: "Universal Music",
  management_name: "Manager",
  crew_collective: "Crew",
  
  // URLs
  spotify_url: "https://...",
  youtube_url: "https://...",
  instagram_url: "https://...",
  tiktok_url: "https://...",
  soundcloud_url: "https://...",
  bandcamp_url: "https://...",
  website_url: "https://...",
  
  // Metrics
  spotify_monthly_listeners: 125000,
  spotify_followers: 45000,
  
  // Scout routing
  scout_priority: "priority",
  scout_notes: "Rising star, viral TikTok"
}
Returns: { artist_id: "uuid", status: "created|updated" }
```

### 2. Collaboration Link API
```javascript
POST /api/scout/collaboration/add
Body: {
  artist_id: "uuid",
  collaborator_id: "uuid", // or auto-create if needed
  relation_type: "producer",
  track_count: 12,
  first_collab: "2024-01-15",
  last_collab: "2026-05-08",
  confidence: 0.95
}
```

### 3. Event Logging API
```javascript
POST /api/scout/event/add
Body: {
  artist_id: "uuid",
  event_type: "festival",
  event_name: "Rolling Loud 2026",
  event_date: "2026-05-20",
  venue: "Miami Field",
  city: "Miami",
  country: "us"
}
```

### 4. Tagging API
```javascript
POST /api/scout/tags/update
Body: {
  artist_id: "uuid",
  add_tags: ["rising_star", "viral_potential"],
  remove_tags: ["underground"]
}
```

### 5. Scout Dashboard API
```javascript
GET /api/scout/dashboard?priority=critical&sort=popularity_score&limit=50
Returns: artist_scouting_snapshot records
Used by: Scout UI dashboard
```

### 6. Feed Boost Integration
```javascript
// In feed ranking algorithm:
if (cluster.artist_id) {
  const artist = await getArtist(cluster.artist_id);
  
  // Base score from scouting
  let score = artist.base_score;
  
  // Apply routing multipliers
  if (artist.tags.includes('rising_star')) score *= 1.3;
  if (artist.tags.includes('viral_potential')) score *= 1.5;
  if (artist.scout_verified_at) score *= 1.1;
  if (artist.tags.includes('independent')) score *= 1.05;
  
  // Apply activity multiplier
  score *= artist.boost_multiplier;
  
  // Apply priority level
  const priorityMult = {
    critical: 2.0,
    high: 1.5,
    medium: 1.0,
    low: 0.7
  };
  score *= priorityMult[artist.scout_priority] || 1.0;
  
  cluster.effective_artist_score = score;
}
```

---

## ⚙️ Setup Steps

### Step 1: Deploy to Staging
```bash
# 1. Backup existing DB
pg_dump -h staging-db -U postgres hotdroppz > backup-2026-05-11.sql

# 2. Apply migration
psql -h staging-db -U postgres hotdroppz < ARTIST_INTELLIGENCE_UPGRADE_v2.sql

# 3. Verify
psql -h staging-db -U postgres -c "SELECT COUNT(*) FROM artists;"

# 4. Test with sample data (see Quick Start above)
```

### Step 2: Build API Endpoints
```typescript
// api/scout/artist/add
app.post('/api/scout/artist/add', authenticate, async (req, res) => {
  const { name, country, genre, ...params } = req.body;
  
  const artistId = await db.call('upsert_artist_full', {
    p_name: name,
    p_country: country,
    p_genre: genre,
    ...params
  });
  
  res.json({ artist_id: artistId, status: 'created' });
});

// api/scout/artist/{id}/network
app.get('/api/scout/artist/:id/network', async (req, res) => {
  const network = await db.call('get_artist_network', {
    p_artist_id: req.params.id,
    p_depth: req.query.depth || 1
  });
  
  res.json(network);
});

// Similar for collaboration, event, tags, dashboard endpoints
```

### Step 3: Build Scout UI
- Artist intake form (multipart)
- Network visualization (node-link graph)
- Metrics chart (followers over time)
- Tag selector (checkboxes for routing)
- Event timeline (chronological)
- Search/autocomplete

### Step 4: Setup Metrics Cron Job
```python
# scripts/refresh_artist_metrics.py (runs daily 2am UTC)

import supabase
import requests
from datetime import datetime

def get_active_artists():
    """Fetch all active artists"""
    return supabase.client.table('artists').select('*').eq('is_active', true).execute()

def fetch_spotify_metrics(artist_id, spotify_url):
    """Get Spotify followers + monthly listeners"""
    # Call Spotify API, return dict
    pass

def fetch_youtube_metrics(artist_id, youtube_url):
    """Get YouTube subscriber count"""
    pass

def fetch_social_metrics(artist_id, instagram_url, tiktok_url):
    """Get Instagram + TikTok followers"""
    pass

def main():
    artists = get_active_artists()
    
    for artist in artists:
        try:
            # Fetch metrics from all platforms
            metrics = {
                'measurement_date': datetime.now().date(),
                'spotify_monthly_listeners': fetch_spotify_metrics(...),
                'youtube_subscribers': fetch_youtube_metrics(...),
                'instagram_followers': fetch_social_metrics(...),
                # ... etc
            }
            
            # Insert into history
            supabase.client.table('artist_metrics_history').insert({
                'artist_id': artist['id'],
                **metrics
            }).execute()
            
            # Calculate growth rates (7d, 30d)
            growth_7d = calculate_growth(artist_id, days=7)
            growth_30d = calculate_growth(artist_id, days=30)
            
            # Update artists table
            supabase.client.table('artists').update({
                'spotify_followers': metrics['spotify_followers'],
                'spotify_monthly_listeners': metrics['spotify_monthly_listeners'],
                'follower_growth_7d': growth_7d,
                'follower_growth_30d': growth_30d,
                'metrics_updated_at': datetime.now()
            }).eq('id', artist['id']).execute()
            
            # Recalculate popularity
            supabase.rpc('recalculate_artist_popularity', { p_artist_id: artist['id'] })
            
        except Exception as e:
            print(f"Error updating {artist['name']}: {e}")
            # Continue to next artist

if __name__ == '__main__':
    main()
```

### Step 5: Update Feed Algorithm
```typescript
// In feed ranking code

async function applyArtistBoost(cluster, artist) {
  if (!cluster.artist_id) return cluster.base_score;
  
  const artist = await getArtist(cluster.artist_id);
  
  let multiplier = 1.0;
  
  // Scout routing tags
  const tagMultipliers = {
    'rising_star': 1.3,
    'viral_potential': 1.5,
    'underground': 0.8,
    'local_hero': 1.1,
    'international': 1.2,
    'verified_authentic': 1.1
  };
  
  for (const tag of artist.tags) {
    multiplier *= tagMultipliers[tag] || 1.0;
  }
  
  // Verification boost
  if (artist.scout_verified_at) {
    multiplier *= 1.1;
  }
  
  // Priority level
  const priorityMult = { critical: 2.0, high: 1.5, medium: 1.0, low: 0.7 };
  multiplier *= priorityMult[artist.scout_priority] || 1.0;
  
  // Activity boost (from releases/events)
  multiplier *= artist.boost_multiplier;
  
  return cluster.base_score * multiplier;
}

// Usage in feed ranking:
for (const cluster of clusters) {
  const effective_score = await applyArtistBoost(cluster, cluster.artist_id);
  cluster.feed_rank_score = effective_score;
}

// Sort by feed_rank_score (highest first)
clusters.sort((a, b) => b.feed_rank_score - a.feed_rank_score);
```

### Step 6: Scout Training
- Share `ARTIST_INTELLIGENCE_SCOUT_GUIDE.md` with scout team
- Walkthrough of intake form
- Walkthrough of network visualization
- Best practices for scouting tags
- Best practices for event logging

### Step 7: Launch to Production
```bash
# 1. Schedule maintenance window (2am UTC, 30min)

# 2. Backup production DB
pg_dump -h prod-db -U postgres hotdroppz > backup-prod-2026-05-11.sql

# 3. Apply migration
psql -h prod-db -U postgres hotdroppz < ARTIST_INTELLIGENCE_UPGRADE_v2.sql

# 4. Verify
psql -h prod-db -U postgres -c "SELECT COUNT(*) FROM artists;"
psql -h prod-db -U postgres -c "SELECT COUNT(*) FROM artist_collaborations;"

# 5. Monitor logs for 30 minutes
tail -f /var/log/app/*.log

# 6. If all good, enable scout features:
#    - Deploy frontend with new scout UI
#    - Announce to scouts

# 7. Gradual rollout: 10% of users first week, then 100%

# 8. Monitor metrics:
#    - API response times
#    - Cron job success rate
#    - Scout adoption (# artists added, # tags assigned)
#    - Feed boost effectiveness
```

---

## 🎯 Key Features Unlocked

### For Scouts
1. **Complete artist profile** — Identity + URLs + metrics in one view
2. **Network visualization** — See producers, collaborators, rivals
3. **Event timeline** — Know when artists perform (visibility signals)
4. **Growth tracking** — See follower trends, spot rising stars
5. **Smart tagging** — Route artists to feeds (rising_star, viral_potential, etc)
6. **Search** — Find artists by name, alias, or collaborator

### For Feed Algorithm
1. **Intelligent boosting** — Amplify verified, rising, signed artists
2. **Context-aware routing** — Route underground to niche, international to global
3. **Activity signals** — Boost pre/post concert, post-release, post-podcast
4. **Relationship leverage** — If producer trends, boost features + collectives
5. **Audit trail** — Score history explains why artist was boosted

### For Business
1. **Scouting accuracy** — Source of truth reduces dupes, improves coverage
2. **Scout productivity** — One form instead of multiple platforms
3. **Data-driven routing** — Metrics-based decisions, not guesses
4. **Relationship intelligence** — Spot viral networks before they blow up
5. **Content planning** — Know who's performing, who's releasing, who's collaborating

---

## 📊 Expected Impact

### Week 1
- ✅ 80% scout adoption
- ✅ 5,000+ artists added with complete identity
- ✅ 10,000+ collaboration links recorded
- ✅ Feed boost algorithm active

### Week 4
- ✅ 50,000+ artists in system
- ✅ 200,000+ collaboration links
- ✅ 30+ scouting tags assigned
- ✅ Metrics history available (growth trends)
- ✅ Scout dashboard showing verified rising stars

### Month 3
- ✅ 100,000+ artists in system
- ✅ 500,000+ collaboration links
- ✅ Feed algorithm optimized with scout tags
- ✅ Measurable lift in feed engagement
- ✅ ML recommendations enabled (predict breakouts)

---

## 🆘 Troubleshooting

**Q: Migration takes too long**  
A: Can be run in batches. Split `ALTER TABLE` commands if >100M rows.

**Q: Metrics cron fails on API rate limits**  
A: Add queue + retry logic. Prioritize active/verified artists. Stagger API calls.

**Q: Scout dashboard slow**  
A: Materialize the view (refresh hourly). Add caching layer.

**Q: Duplicate artists**  
A: Check `normalized_name` logic. Run deduplication script before upsert.

**Q: Feed scores too high for boosted artists**  
A: Tune multipliers (cap at 5x base score). Monitor feed diversity.

---

## 📞 Support

**For Database Issues**  
→ See `ARTIST_INTELLIGENCE_ARCHITECTURE.md` → Troubleshooting

**For Scout Questions**  
→ See `ARTIST_INTELLIGENCE_SCOUT_GUIDE.md` → Key Principles

**For Integration Issues**  
→ Contact Backend Lead with specific API endpoint + error log

---

## 🎉 You're Ready!

Next steps:
1. [ ] Review this README
2. [ ] Read Scout Guide
3. [ ] Read Architecture doc
4. [ ] Deploy to staging
5. [ ] Run integration tests
6. [ ] Scout team training
7. [ ] Deploy to production
8. [ ] Launch to scouts
9. [ ] Monitor for 2 weeks
10. [ ] Celebrate! 🚀

