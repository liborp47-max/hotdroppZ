-- ═══════════════════════════════════════════════════════════════════════════════
-- HOTDROPPZ — ARTIST INTELLIGENCE LAYER
-- Production-ready schema for artist tracking, release detection, and feed boosting
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ARTISTS — master artist registry with metadata and scoring
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists artists (
  -- Identity
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  normalized_name     text        not null unique,  -- lowercase, trimmed for dedupe
  country             text        not null,          -- 'cz', 'us', 'de', etc.
  genre               text        not null,          -- 'rap', 'hiphop', 'drill', 'trap', etc.
  
  -- Streaming / social URLs (from enrichment)
  spotify_url         text,
  youtube_url         text,
  apple_music_url     text,
  genius_url          text,
  twitter_url         text,
  instagram_url       text,
  tiktok_url          text,
  
  -- Activity tracking
  first_seen_at       timestamptz not null default now(),
  last_release_at     timestamptz,
  total_releases      integer     not null default 0,
  monthly_releases    numeric(5,2) default 0,  -- rolling 30d average
  
  -- Scoring for feed ranking
  base_score          numeric(4,2) not null default 50.0,  -- 0-100 base importance
  trending_boost      boolean      not null default false,
  priority_level      text         not null default 'medium'
                      check (priority_level in ('low','medium','high','critical')),
  boost_multiplier    numeric(3,2) not null default 1.00,   -- feed score × this
  
  -- AI enrichment metadata
  ai_fetched_at       timestamptz,
  ai_confidence       numeric(3,2) default 0.0,  -- 0.00-1.00 confidence in artist data
  
  -- Denormalized flags
  is_active           boolean      not null default true,
  tags                text[]       not null default '{}',
  metadata            jsonb        not null default '{}',
  
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Indexes for fast artist lookup
create index if not exists idx_artists_normalized_name   on artists(normalized_name);
create index if not exists idx_artists_country           on artists(country);
create index if not exists idx_artists_genre             on artists(genre);
create index if not exists idx_artists_score_desc        on artists(base_score desc);
create index if not exists idx_artists_active            on artists(is_active) where is_active = true;
create index if not exists idx_artists_recent            on artists(last_release_at desc) where last_release_at is not null;
create index if not exists idx_artists_tags              on artists using gin(tags);
create index if not exists idx_artists_priority         on artists(priority_level, base_score desc);

-- Full-text search for artist name (fuzzy matching during scouting)
create index if not exists idx_artists_name_fts
  on artists using gin(to_tsvector('simple', name));


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ARTIST_RELEASES — individual release tracking (albums, tracks, videos)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists artist_releases (
  id              uuid        primary key default gen_random_uuid(),
  artist_id       uuid        not null references artists(id) on delete cascade,
  
  -- Release metadata
  title           text        not null,
  type            text        not null check (type in ('album','track','ep','single','video','mixtape')),
  release_date    date        not null,
  
  -- Links
  spotify_url     text,
  apple_music_url text,
  youtube_url     text,
  genius_url      text,
  
  -- Enrichment flags
  is_new_release  boolean     not null default true,   -- within last 7 days
  is_hot_trend    boolean     not null default false,  -- algorithmic hotness flag
  
  created_at      timestamptz not null default now()
);

-- Indexes
create index if not exists idx_artist_releases_artist    on artist_releases(artist_id, release_date desc);
create index if not exists idx_artist_releases_date      on artist_releases(release_date desc);
create index if not exists idx_artist_releases_new       on artist_releases(is_new_release) where is_new_release = true;
create index if not exists idx_artist_releases_hot       on artist_releases(is_hot_trend) where is_hot_trend = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ARTIST_SOURCES — map artists to RSS sources that frequently cover them
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists artist_sources (
  id          uuid        primary key default gen_random_uuid(),
  artist_id   uuid        not null references artists(id) on delete cascade,
  source_name text        not null,  -- e.g. "XXL", "Complex", "Billboard"
  coverage_score numeric(3,2) not null default 1.00,  -- how often this source covers this artist
  last_seen   timestamptz,
  
  created_at  timestamptz not null default now(),
  
  unique(artist_id, source_name)
);

create index if not exists idx_artist_sources_artist  on artist_sources(artist_id);
create index if not exists idx_artist_sources_source  on artist_sources(source_name);
create index if not exists idx_artist_sources_score   on artist_sources(coverage_score desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CLUSTER_ARTIST_LINKS — connect story_clusters to known artists
-- ─────────────────────────────────────────────────────────────────────────────

-- Add artist_id column to story_clusters (if not already there from PIPELINE_EXTENSIONS)
alter table if exists story_clusters
  add column if not exists artist_id uuid references artists(id) on delete set null;

-- Index for clustering lookups
create index if not exists idx_story_clusters_artist_id
  on story_clusters(artist_id)
  where artist_id is not null;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. FEED/POST ARTIST LINKAGE — denormalized for fast analytics
-- ─────────────────────────────────────────────────────────────────────────────

-- Link posts to artists (for CMS posts derived from writer)
alter table if exists posts
  add column if not exists artist_id uuid references artists(id) on delete set null;
create index if not exists idx_posts_artist_id
  on posts(artist_id)
  where artist_id is not null;

-- Link feed_posts to artists (for real-time feed)
alter table if exists feed_posts
  add column if not exists artist_id uuid references artists(id) on delete set null;
create index if not exists idx_feed_posts_artist_id
  on feed_posts(artist_id)
  where artist_id is not null;

-- Denormalized enrichment fields that were missing from base schema
alter table if exists feed_posts
  add column if not exists apple_music_url text;

-- Optional: store effective boost multiplier on posts for historical analytics
alter table if exists posts
  add column if not exists artist_boost_factor numeric(4,3) default 1.0;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ARTIST_SCORE_HISTORY — track score changes over time (for analytics)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists artist_score_history (
  id            uuid        primary key default gen_random_uuid(),
  artist_id     uuid        not null references artists(id) on delete cascade,
  base_score    numeric(4,2) not null,
  boost_mult    numeric(3,2) not null,
  effective_score numeric(5,2) not null,  -- base_score × boost_mult
  reason        text,                        -- e.g. "new_release", "trending", "manual_adjust"
  created_at    timestamptz not null default now()
);

create index if not exists idx_artist_score_history_artist on artist_score_history(artist_id, created_at desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-update updated_at on artist changes
create or replace function update_artists_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists artists_set_updated_at on artists;
create trigger artists_set_updated_at
  before update on artists
  for each row execute function update_artists_updated_at();


-- Auto-normalize artist name on insert/update (lowercase, trim)
create or replace function normalize_artist_name()
returns trigger language plpgsql as $$
begin
  new.normalized_name := lower(trim(new.name));
  return new;
end;
$$;

drop trigger if exists artists_normalize_name on artists;
create trigger artists_normalize_name
  before insert or update of name on artists
  for each row execute function normalize_artist_name();


-- Upsert artist from scouting result (creates new or updates existing)
create or replace function upsert_artist_from_scout(
  p_name         text,
  p_country      text,
  p_genre        text,
  p_spotify_url  text default null,
  p_youtube_url  text default null,
  p_genius_url   text default null,
  p_instagram_url text default null
) returns uuid language plpgsql as $$
declare
  v_artist      uuid;
  v_now         timestamptz := now();
begin
  -- Try to find existing artist by normalized name + country
  select id into v_artist
  from artists
  where normalized_name = lower(trim(p_name))
    and country = p_country
  limit 1;

  if v_artist is null then
    -- Insert new artist
    insert into artists (
      name, normalized_name, country, genre,
      spotify_url, youtube_url, genius_url, instagram_url,
      first_seen_at, last_release_at
    ) values (
      p_name, lower(trim(p_name)), p_country, p_genre,
      p_spotify_url, p_youtube_url, p_genius_url, p_instagram_url,
      v_now, v_now
    ) returning id into v_artist;
  else
    -- Update enrichment data if provided (keep first_seen_at)
    update artists set
      spotify_url    = coalesce(p_spotify_url,    spotify_url),
      youtube_url    = coalesce(p_youtube_url,    youtube_url),
      genius_url     = coalesce(p_genius_url,     genius_url),
      instagram_url  = coalesce(p_instagram_url,  instagram_url),
      ai_fetched_at  = v_now,
      updated_at     = v_now
    where id = v_artist;
  end if;

  return v_artist;
end;
$$;


-- Boost artist score when new release detected
create or replace function boost_artist_on_release(
  p_artist_id uuid,
  p_release_date date
) returns void language plpgsql as $$
declare
  v_recent_releases integer;
  v_mult           numeric(3,2);
begin
  -- Count releases in last 30 days
  select count(*) into v_recent_releases
  from artist_releases
  where artist_id = p_artist_id
    and release_date >= (p_release_date - interval '30 days')
    and release_date <= p_release_date;

  -- Boost multiplier: 1.0 → 1.5 based on release frequency
  if v_recent_releases >= 3 then
    v_mult := 1.50;  -- very active (≥3 releases/30d)
  elsif v_recent_releases >= 2 then
    v_mult := 1.30;  -- active (2 releases/30d)
  elsif v_recent_releases = 1 then
    v_mult := 1.15;  -- normal (1 release/30d)
  else
    v_mult := 1.00;  -- no recent activity
  end if;

  -- Update artist
  update artists set
    boost_multiplier = v_mult,
    last_release_at  = p_release_date,
    total_releases   = total_releases + 1,
    updated_at       = now()
  where id = p_artist_id;

  -- Log score change
  insert into artist_score_history (artist_id, base_score, boost_mult, effective_score, reason)
  select
    a.id,
    a.base_score,
    v_mult,
    round(a.base_score * v_mult, 2),
    'new_release'
  from artists a
  where a.id = p_artist_id;
end;
$$;


-- Auto-detect trending artists (≥3 new releases in 7 days)
create or replace function mark_trending_artists()
returns integer language plpgsql as $$
declare
  v_count integer := 0;
begin
  -- Reset all trending flags
  update artists set trending_boost = false where trending_boost = true;

  -- Mark artists with ≥3 releases in last 7 days as trending
  with trending as (
    select artist_id
    from artist_releases
    where release_date >= (current_date - interval '7 days')
    group by artist_id
    having count(*) >= 3
  )
  update artists a
  set trending_boost = true,
      priority_level = 'high',
      boost_multiplier = greatest(boost_multiplier, 1.50)
  from trending t
  where a.id = t.artist_id
    and a.trending_boost = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. FEED BOOST FUNCTION
-- ─────────────────────────────────────────────────────────────────────────────

-- Calculate boosted feed score for a post based on artist metadata
create or replace function calculate_artist_boost(
  p_artist_name   text,
  p_category      text,
  p_ai_score      numeric,
  p_created_at    timestamptz
) returns numeric language plpgsql immutable as $$
declare
  v_artist        artists%rowtype;
  v_base_boost    numeric(3,2) := 1.00;
  v_trending_bonus numeric(3,2) := 1.00;
  v_recency_bonus numeric(3,2) := 1.00;
  v_final         numeric(5,3);
begin
  -- Try to find artist
  select * into v_artist
  from artists
  where normalized_name = lower(trim(p_artist_name))
  limit 1;

  if v_artist.id is not null then
    v_base_boost := v_artist.boost_multiplier;

    -- Trending bonus (extra 20% if artist is currently trending)
    if v_artist.trending_boost then
      v_trending_bonus := 1.20;
    end if;

    -- Recency bonus: if artist released within last 14 days, +10%
    if v_artist.last_release_at >= (current_date - interval '14 days') then
      v_recency_bonus := 1.10;
    end if;
  end if;

  v_final := p_ai_score * v_base_boost * v_trending_bonus * v_recency_bonus;
  return round(v_final, 2);
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  alter publication supabase_realtime add table artists;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table artist_releases;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table artist_sources;
exception when duplicate_object then null; end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────────

alter table artists enable row level security;
alter table artist_releases enable row level security;
alter table artist_sources enable row level security;

-- Artists: authenticated users can read, admins can write
drop policy if exists "artists: read" on artists;
drop policy if exists "artists: write" on artists;
create policy "artists: read" on artists
  for select using (auth.role() = 'authenticated');
create policy "artists: write" on artists
  for all using (get_user_role() in ('admin','editor'));

-- Artist releases: read for authenticated, write for admin/editor
drop policy if exists "artist_releases: read" on artist_releases;
drop policy if exists "artist_releases: write" on artist_releases;
create policy "artist_releases: read" on artist_releases
  for select using (auth.role() = 'authenticated');
create policy "artist_releases: write" on artist_releases
  for all using (get_user_role() in ('admin','editor'));

-- Artist sources: read for authenticated, write for admin
drop policy if exists "artist_sources: read" on artist_sources;
drop policy if exists "artist_sources: write" on artist_sources;
create policy "artist_sources: read" on artist_sources
  for select using (auth.role() = 'authenticated');
create policy "artist_sources: write" on artist_sources
  for all using (get_user_role() = 'admin');


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. INITIAL DATA SEED — Street Rap/HipHop 40 Countries (P0 Priority)
-- ─────────────────────────────────────────────────────────────────────────────
-- This seeds known high-value artists per country for immediate boost calculations
-- Run this separately or extend with your full dataset

insert into artists (name, normalized_name, country, genre, base_score, priority_level, tags) values
  -- USA (critical priority — origin market)
  ('Travis Scott',      'travis scott',      'us', 'rap',       95.0, 'critical',  '{trap,astroworld,rovers}'),
  ('Drake',             'drake',             'us', 'rap',       98.0, 'critical',  '{rap,OVO,canadian}'),
  ('Kendrick Lamar',    'kendrick lamar',    'us', 'rap',       97.0, 'critical',  '{conscious,pgLang}'),
  ('J. Cole',           'j. cole',           'us', 'rap',       92.0, 'high',      '{dreamville,cole world}'),
  ('Future',            'future',            'us', 'rap',       90.0, 'high',      '{trap,freebandz}'),
  ('Metro Boomin',      'metro boomin',      'us', 'rap',       88.0, 'high',      '{producer,metro}'),
  ('21 Savage',         '21 savage',         'us', 'rap',       87.0, 'high',      '{slaughter,gwinnett}'),
  ('Offset',            'offset',            'us', 'rap',       85.0, 'high',      '{migos,quality}'),
  ('Takeoff',           'takeoff',           'us', 'rap',       84.0, 'high',      '{migos,no_limit}'),
  ('Quavo',             'quavo',             'us', 'rap',       86.0, 'high',      '{migos,quavo hinges}'),
  ('Lil Uzi Vert',      'lil uzi vert',      'us', 'rap',       89.0, 'high',      '{emo rap,soundcloud}'),
  ('Playboi Carti',     'playboi carti',     'us', 'rap',       93.0, 'critical',  '{punk,rage}'),
  ('Young Thug',        'young thug',        'us', 'rap',       88.0, 'high',      '{yung,slime}'),
  ('Gunna',             'gunna',             'us', 'rap',       85.0, 'high',      '{yung,slime}'),
  ('Lil Baby',          'lil baby',          'us', 'rap',       87.0, 'high',      '{4pf,quality}'),
  ('Roddy Ricch',       'roddy ricch',       'us', 'rap',       84.0, 'high',      '{please excuse me}'),
  ('Tyler, The Creator','tyler the creator', 'us', 'rap',       91.0, 'high',      '{odd future,golf}'),
  ('A$AP Rocky',        'a$ap rocky',        'us', 'rap',       86.0, 'high',      '{asap,mob}'),
  ('A$AP Ferg',         'a$ap ferg',         'us', 'rap',       82.0, 'medium',    '{asap,mob}'),
  ('Megan Thee Stallion','megan thee stallion','us','rap',      88.0, 'high',      '{houston,hotties}'),

  -- UK (high priority — grime/drill hub)
  ('Central Cee',       'central cee',       'uk', 'hiphop',    94.0, 'critical',  '{drill,west london}'),
  ('Dave',              'dave',              'uk', 'hiphop',    92.0, 'high',      '{south london,psycho}'),
  ('Stormzy',           'stormzy',           'uk', 'hiphop',    90.0, 'high',      '{grime,merky}'),
  ('Skepta',            'skepta',            'uk', 'hiphop',    88.0, 'high',      '{grime,boy better know}'),
  ('J Hus',             'j hus',             'uk', 'hiphop',    86.0, 'high',      '{afroswing,common sense}'),
  ('Slowthai',          'slowthai',          'uk', 'hiphop',    84.0, 'medium',    '{british,rag'}),

  -- CZ (medium priority — local market)
  ('Atlantida',         'atlantida',         'cz', 'rap',       75.0, 'medium',    '{cz,hiphop}'),  
  ('Basi & DJ Wich',    'basi & dj wich',    'cz', 'rap',       78.0, 'medium',    '{cz,legend}'),
  ('Bizzy',             'bizzy',             'cz', 'rap',       76.0, 'medium',    '{brasno,rok}'),
  ('CDK',               'cdk',               'cz', 'rap',       80.0, 'high',      '{cz,majk}'),
  ('D Feet',            'd feet',            'cz', 'rap',       72.0, 'medium',    '{cz,víc}'),
  ('Denis',             'denis',             'cz', 'rap',       79.0, 'medium',    '{cz,sen}'),
  ('Drizzly',           'drizzly',           'cz', 'rap',       71.0, 'medium',    '{cz}'),
  ('H16',               'h16',               'cz', 'rap',       73.0, 'medium',    '{cz}'),
  ('HAVEL',             'havel',             'cz', 'rap',       77.0, 'medium',    '{cz,hiphop}'),
  ('Hubert',            'hubert',            'cz', 'rap',       74.0, 'medium',    '{cz}'),
  ('Jasyo',             'jasyo',             'cz', 'rap',       75.0, 'medium',    '{cz,výbor}'),
  ('KVN',               'kvn',               'cz', 'rap',       78.0, 'medium',    '{cz,praha}'),
  ('Lvcas Dope',        'lvcas dope',        'cz', 'rap',       72.0, 'medium',    '{cz}'),
  ('Majk Spirit',       'majk spirit',       'cz', 'rap',       85.0, 'high',      '{cz,legend}'),
  ('Man清楚',          'man清楚',           'cz', 'rap',       70.0, 'medium',    '{cz}'),
  ('Mikro',             'mikro',             'cz', 'rap',       73.0, 'medium',    '{cz}'),
  ('Nemilek',           'nemilek',           'cz', 'rap',       71.0, 'medium',    '{cz}'),
  ('Nik Tendo',         'nik tendo',         'cz', 'rap',       76.0, 'medium',    '{cz,sage}'),
  ('Onsuch',            'onsuch',            'cz', 'rap',       70.0, 'medium',    '{cz}'),
  ('Osa',               'osa',               'cz', 'rap',       74.0, 'medium',    '{cz,thug}'),
  ('Rest',              'rest',              'cz', 'rap',       75.0, 'medium',    '{cz}'),
  ('Ryl',               'ryl',               'cz', 'rap',       72.0, 'medium',    '{cz}'),
  ('Sadist',            'sadist',            'cz', 'rap',       71.0, 'medium',    '{cz}'),
  ('Sayuw',             'sayuw',             'cz', 'rap',       73.0, 'medium',    '{cz}'),
  ('Separace',          'separace',          'cz', 'rap',       76.0, 'medium',    '{cz}'),
  ('Sergej',            'sergej',            'cz', 'rap',       72.0, 'medium',    '{cz,kecy}'),
  ('Sigor',             'sigor',             'cz', 'rap',       78.0, 'medium',    '{cz,kecy}'),
  ('Slime',             'slime',             'cz', 'rap',       74.0, 'medium',    '{cz}'),
  ('Victor',            'victor',            'cz', 'rap',       71.0, 'medium',    '{cz}'),
  ('W&amp;W',           'w&w',               'cz', 'rap',       70.0, 'medium',    '{cz}'),
  ('Yami',              'yami',              'cz', 'rap',       73.0, 'medium',    '{cz}'),
  ('Yungblud',          'yungblud',          'cz', 'rap',       72.0, 'medium',    '{cz}'),
  ('Zakky',             'zakky',             'cz', 'rap',       71.0, 'medium',    '{cz}'),

  -- Expand to 40 countries × 40 artists each (1600 total)
  -- SK, DE, FR, PL, IT, ES, NL, RU, SR, SQ, BS, HR, etc.
  -- (Add remaining countries following same pattern)
  --
  -- Quick seeds for demo:
  ('Kano',              'kano',              'uk', 'hiphop',    82.0, 'medium',  '{grime,roll deep}'),
  ('Ghetts',            'ghetts',            'uk', 'hiphop',    80.0, 'medium',  '{grime}'),
  ('Loyle Carner',      'loyle carner',      'uk', 'hiphop',    79.0, 'medium',  '{jazz,uk}'),
  ('AJ Tracey',         'aj tracey',         'uk', 'hiphop',    83.0, 'high',    '{uk,road rap}'),
  ('M Huncho',          'm huncho',          'uk', 'hiphop',    81.0, 'medium',  '{uk,afrobeats}'),
  ('Nines',             'nines',             'uk', 'hiphop',    85.0, 'high',    '{uk,croydon}'),
  ('Wiley',             'wiley',             'uk', 'hiphop',    86.0, 'high',    '{grime,eskibeat}'),
  ('D Double E',        'd double e',        'uk', 'hiphop',    78.0, 'medium',  '{grime}'),
  ('Chip',              'chip',              'uk', 'hiphop',    80.0, 'medium',  '{grime}'),
  ('Sampa the Great',   'sampa the great',   'uk', 'hiphop',    77.0, 'medium',  '{zambia,uk}')
on conflict (normalized_name) do nothing;
