# ARTIST INTELLIGENCE LAYER v2 — Scout Integration Guide

> **Cíl**: Artist databáze není jen seznam — je to "operační mozek" scoutingu. Bez přesné identity, vztahů a metriky scout systém selhává.

---

## 🎯 Co se mění?

### Dřív:
- Jen `artists` tabulka s minimálními daty
- Žádné vztahy mezi umělci (producenti, rivalové, kolaboranti)
- Bez history eventů
- Metrics jen snapshot, ne trend

### Teď:
```
artists (CORE IDENTITY)
  ├─ Full identity (aliases, city, region, language, label, management, crew)
  ├─ Kompletní platform URLs (Spotify, Apple, YT, IG, TikTok, SoundCloud, Bandcamp, web)
  ├─ Live metrics (followers, monthly listeners, popularity score, growth rates)
  └─ Scout routing (priority level, assignments, verification status)
  
├─ artist_collaborations (WHO WORKS WITH WHOM)
│   └─ producer, featured_on, collective_member, label_mate, rival, ally
│
├─ artist_events (ACTIVITY TIMELINE)
│   └─ concerts, festivals, radio, podcasts, interviews, livestreams
│
└─ artist_metrics_history (TREND DETECTION)
    └─ Daily snapshots of followers/listeners for growth analysis
```

---

## 📊 Artist Core Identity (Complete Spec)

### Required Fields (must have):
```javascript
{
  id: "uuid",                    // unique identifier
  name: "Artist Name",
  country: "cz",                 // 2-letter ISO code
  genre: "trap",
  
  // These have defaults but should be filled
  normalized_name: "artist name" // lowercase, auto-filled
}
```

### Identity Fields (SCOUT FILLS):
```javascript
{
  aliases: ["Lil X", "X Money"],        // alternate names artist uses
  city: "Prague",                       // city of origin/base
  region: "EU",                         // geographic cluster for routing
  language: "en",                       // primary language (affects content routing)
  crew_collective: "Crew Name",         // if member of collective
  management_name: "Manager / Mgmt Co", // who represents them
  label_name: "Label Name"              // current record label
}
```

### Platform URLs (CORE FOR SCOUTING):
```javascript
{
  spotify_url: "https://open.spotify.com/artist/...",
  apple_music_url: "https://music.apple.com/...",
  youtube_url: "https://youtube.com/@...",
  instagram_url: "https://instagram.com/...",
  tiktok_url: "https://tiktok.com/@...",
  soundcloud_url: "https://soundcloud.com/...",
  bandcamp_url: "https://..bandcamp.com/",
  website_url: "https://artist-official.com"
}
```

### Social Metrics (REFRESHED VIA CRON):
```javascript
{
  // Spotify
  spotify_monthly_listeners: 125000,
  spotify_followers: 45000,
  
  // YouTube
  youtube_subscribers: 50000,
  
  // Social
  instagram_followers: 120000,
  tiktok_followers: 250000,
  soundcloud_followers: 15000,
  
  // Calculated
  popularity_score: 72.5,              // 0-100 composite score
  follower_growth_7d: 5.3,             // % growth past 7 days
  follower_growth_30d: 18.7,           // % growth past 30 days
  metrics_updated_at: "2026-05-11T..."  // when metrics were refreshed
}
```

### Scout Routing (CRITICAL FOR FEED):
```javascript
{
  scout_priority: "priority",           // watch | priority | critical | archive
  scout_notes: "Rising star, 200% growth TikTok, viral potential",
  scout_assigned_to: "scout-user-id",   // which scout owns this artist
  scout_verified_at: "2026-05-10T..."   // when human verified identity
}
```

---

## 🔗 Artist Relations — The Collaboration Network

### Why it matters:
- **Producer detection**: Who's making beats?
- **Viral patterns**: Groups often rise together
- **Rivalry tracking**: Know the beefs for context
- **Collective routing**: If crew member trends, boost all

### Table: `artist_collaborations`

**Relation Types:**
```
- producer           : A produces for B
- featured_on        : A is featured on B's track
- features           : A features B on their track
- collective_member  : A and B in same crew
- label_mate         : A and B on same label
- rival              : A and B competitive/beef
- ally               : A and B affiliated/supportive
```

**Example Schema:**
```sql
artist_id         | collaborator_id | relation_type    | track_count | first_collab | last_collab
──────────────────┼─────────────────┼──────────────────┼─────────────┼──────────────┼──────────
artist-uuid-1     | artist-uuid-2   | producer         | 12          | 2024-01-15   | 2026-04-20
artist-uuid-1     | artist-uuid-3   | featured_on      | 3           | 2025-06-01   | 2025-12-30
artist-uuid-1     | artist-uuid-4   | collective_member| 40+         | 2022-03-10   | 2026-04-15
```

### Insert Collaboration (Scout Action):
```sql
INSERT INTO artist_collaborations (
  artist_id,
  collaborator_id,
  relation_type,
  track_count,
  first_collab,
  last_collab,
  notes,
  confidence
) VALUES (
  'artist-id-1',
  'artist-id-2',
  'producer',
  12,
  '2024-01-15',
  '2026-04-20',
  'Produced 12 tracks on last 2 albums',
  0.95
);
```

### Query: Get Artist's Collaborators:
```sql
SELECT * FROM get_artist_network('artist-uuid-1', depth => 1);
-- Returns: immediate producers, features, collective members, sorted by collaboration count
```

---

## 🎤 Artist Events — Performance & Appearance History

**Why it matters:**
- Tour dates = peak visibility
- Radio/podcast = media reach
- Festivals = legitimacy signal

### Table: `artist_events`

```sql
CREATE TABLE artist_events (
  id: uuid,
  artist_id: uuid,
  event_type: 'concert' | 'festival' | 'radio' | 'podcast' | 'interview' | 'livestream' | 'award_show',
  event_name: "XXL Freshman Showcase",
  event_date: date,
  
  venue: "Madison Square Garden",
  city: "New York",
  country: "us",
  
  url: "https://xxx.com/event",
  notes: "Performed 20min set"
);
```

### Insert Event (Scout Logs Performance):
```sql
INSERT INTO artist_events (
  artist_id,
  event_type,
  event_name,
  event_date,
  venue,
  city,
  country,
  url,
  notes
) VALUES (
  'artist-uuid',
  'festival',
  'Rolling Loud Miami 2026',
  '2026-05-20',
  'Wynwood Field',
  'Miami',
  'us',
  'https://rollingloud.com',
  'Main stage, 30min slot'
);
```

### Query: Upcoming Events for Artist:
```sql
SELECT * FROM artist_events
WHERE artist_id = 'artist-uuid'
  AND event_date BETWEEN now()::date AND (now()::date + interval '90 days')
ORDER BY event_date ASC;
```

---

## 📈 Artist Metrics History — Trend Detection

**Why it matters:**
- Raw followers meaningless without direction
- Track week-over-week growth
- Spot viral moments
- Predict next breakout

### Table: `artist_metrics_history`

```sql
CREATE TABLE artist_metrics_history (
  id: uuid,
  artist_id: uuid,
  measurement_date: date,
  
  spotify_monthly_listeners: integer,
  spotify_followers: integer,
  youtube_subscribers: integer,
  instagram_followers: integer,
  tiktok_followers: integer,
  soundcloud_followers: integer,
  
  popularity_score: numeric,
  total_engagement: integer,
  
  created_at: timestamptz
);
```

### Automated Flow:
1. **Cron job (daily)**: Fetch metrics from platform APIs
2. **Store snapshot**: Insert row into `artist_metrics_history`
3. **Calc growth**: `follower_growth_7d` = (today - 7days) / 7days_ago * 100
4. **Update artists table**: Latest metrics + growth rates

### Query: Artist Growth Over Time:
```sql
SELECT
  measurement_date,
  spotify_monthly_listeners,
  spotify_followers,
  follower_growth_7d
FROM artist_metrics_history
WHERE artist_id = 'artist-uuid'
  AND measurement_date >= now()::date - interval '30 days'
ORDER BY measurement_date ASC;
```

---

## 🏷️ Scout Routing Tags — Dynamic Feed Routing

**Pre-loaded tags** in `scout_routing_tags`:

| Tag | Category | What it means | Scout uses for |
|-----|----------|---------------|-----------------|
| `rising_star` | momentum | >50% follower growth in 30d | Priority boost |
| `underground` | audience | <50k followers, engaged community | Niche feeds |
| `viral_potential` | momentum | Hit trending this week | Front-page test |
| `local_hero` | geographic | Dominates specific country/city | Regional feeds |
| `international` | geographic | Multi-country appeal | Global routing |
| `conscious_rap` | genre | Lyrically focused | Quality-focused routing |
| `trap_king` | genre | Heavy trap focus | Genre-specific |
| `collaboration_magnet` | collab | 10+ collaborations/year | Network signals |
| `signed_priority` | label | Major label (Universal, Sony, etc.) | Premium tier |
| `independent` | label | Self-released | Indie platform |
| `podcast_active` | media | 5+ podcasts in 6mo | Media reach routing |
| `verified_authentic` | quality | Human scout verified identity + quality | Trust signals |

### Assign Tags to Artist:
```sql
UPDATE artists
SET tags = array_append(tags, 'rising_star')
WHERE id = 'artist-uuid';
```

### Query: All Artists with Tag:
```sql
SELECT * FROM artists
WHERE 'rising_star' = ANY(tags)
  AND is_active = true
ORDER BY popularity_score DESC;
```

---

## 🚀 Scout Functions — How to Use from Code

### 1. Upsert Full Artist (Scout Intake):
```sql
SELECT upsert_artist_full(
  p_name => 'Artist Name',
  p_country => 'cz',
  p_genre => 'trap',
  p_city => 'Prague',
  p_aliases => ARRAY['Alias1', 'Alias2'],
  p_language => 'en',
  p_label_name => 'Universal Music',
  p_management => 'Big Hit Entertainment',
  p_crew => 'Crew Name',
  
  -- URLs
  p_spotify_url => 'https://open.spotify.com/artist/...',
  p_instagram_url => 'https://instagram.com/...',
  
  -- Metrics
  p_monthly_listeners => 125000,
  p_followers_spotify => 45000,
  
  -- Scout routing
  p_scout_priority => 'priority',
  p_scout_notes => 'Rising star, viral TikTok, verified authentic'
);
```

### 2. Add Collaboration Link:
```sql
INSERT INTO artist_collaborations (
  artist_id, collaborator_id, relation_type, track_count,
  first_collab, last_collab, confidence
) VALUES (
  'producer-artist-uuid',
  'collaborator-artist-uuid',
  'producer',
  15,
  '2024-01-10',
  '2026-05-08',
  0.95
);
```

### 3. Record Event:
```sql
INSERT INTO artist_events (
  artist_id, event_type, event_name, event_date, venue, city, country
) VALUES (
  'artist-uuid',
  'festival',
  'Rolling Loud 2026',
  '2026-05-20',
  'Miami Field',
  'Miami',
  'us'
);
```

### 4. Get Artist's Full Network:
```sql
SELECT
  collaborator_name,
  relation_type,
  track_count,
  distance
FROM get_artist_network('artist-uuid', depth => 2)
ORDER BY distance, track_count DESC;
```

### 5. Query Scout Dashboard View:
```sql
SELECT
  id, name, country, city, genre,
  scout_priority, scout_verified_at,
  spotify_monthly_listeners,
  popularity_score,
  follower_growth_30d,
  collaboration_count,
  recent_event_count
FROM artist_scouting_snapshot
WHERE scout_priority IN ('critical', 'priority')
  AND scout_verified_at IS NOT NULL
ORDER BY popularity_score DESC;
```

---

## ⚙️ Integration Points (For Dev Team)

### 1. Scout Intake Endpoint:
```python
POST /api/scout/artist/add
{
  "name": "Artist Name",
  "country": "cz",
  "genre": "trap",
  "urls": {
    "spotify": "...",
    "instagram": "...",
    ...
  },
  "scout_priority": "priority",
  "scout_notes": "..."
}
→ Calls upsert_artist_full()
→ Returns: artist_id
```

### 2. Metrics Refresh Cron:
```python
# Run daily (e.g., 2am UTC)
for artist in get_active_artists():
    metrics = fetch_from_platforms(artist)
    insert_metrics_snapshot(artist.id, metrics)
    update_artist_metrics(artist.id, metrics)
    recalculate_artist_popularity(artist.id)
```

### 3. Feed Boost Algorithm:
```python
# When building feed, apply scout routing:
for cluster in get_story_clusters():
    if cluster.artist_id:
        artist = get_artist(cluster.artist_id)
        
        # Base score
        score = artist.base_score
        
        # Apply routing multipliers
        if 'rising_star' in artist.tags:
            score *= 1.3
        if 'viral_potential' in artist.tags:
            score *= 1.5
        if artist.scout_verified_at:
            score *= 1.1
            
        # Apply boost multiplier (from releases, events, etc)
        score *= artist.boost_multiplier
        
        cluster.effective_score = score
```

### 4. Search & Discovery:
```python
# Scout finds artist by name or collaborator
GET /api/scout/search?q=artist+name
→ Uses idx_artists_name_fts (full-text search)
→ Returns: matching artists + their networks

GET /api/scout/artist/{id}/network
→ Calls get_artist_network()
→ Returns: producers, features, collective mates, rivals
```

---

## 📋 Checklist: Setting Up Artist Intelligence Layer

- [ ] Run `ARTIST_INTELLIGENCE_UPGRADE_v2.sql` in Supabase
- [ ] Verify tables created: `artist_collaborations`, `artist_events`, `artist_metrics_history`
- [ ] Verify view created: `artist_scouting_snapshot`
- [ ] Verify functions exist: `upsert_artist_full`, `get_artist_network`, `recalculate_artist_popularity`
- [ ] Setup daily metrics cron job
- [ ] Test scout intake endpoint with sample data
- [ ] Add scout UI for tagging artists (rising_star, viral_potential, etc.)
- [ ] Add scout UI for recording collaborations
- [ ] Add scout UI for logging events
- [ ] Integrate feed boost algorithm with existing feed_score logic
- [ ] Train scouts on new fields + routing tags
- [ ] Monitor: check metrics accuracy vs. platform APIs

---

## 🎯 Key Principles (For Scouts)

1. **Identity first**: Wrong name/country = wrong routing forever. Verify 2x.
2. **Complete URLs**: One missing URL = lost platform signal. Copy from artist's official links.
3. **Relationships matter**: Producer/collective = context for feeds. Log them.
4. **Metrics tell story**: 5% growth = normal. 50% growth = priority signal. Tag it.
5. **Events = visibility**: Concert announcement = future content spike. Log it.
6. **Tags aren't labels**: They're routing signals. Multiple tags per artist OK.
7. **Confidence scores**: 0.80+ = high confidence. Log lower scores with notes.

---

## 🔧 Troubleshooting

**Q: Scout can't find artist after adding**
A: Check `normalized_name` matches. Try full-text search on names table.

**Q: Collaborations not showing on feed**
A: Verify `relation_type` matches intent. Verify both artist IDs exist.

**Q: Popularity score seems wrong**
A: Run `SELECT recalculate_artist_popularity('artist-uuid')` manually. Check metrics_history has recent data.

**Q: Growth rates showing 0%**
A: Need at least 2 days of metrics history. Check cron job ran successfully.

---

## 📞 Questions?

Ask DevOps:
- Schema issues, migrations, function errors
- Metrics cron job setup
- API endpoint integration

Ask Scout Team Lead:
- Routing strategy questions
- Tag usage standards
- Scout priority assignments
