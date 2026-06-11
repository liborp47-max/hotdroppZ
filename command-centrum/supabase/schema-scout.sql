-- ═══════════════════════════════════════════════════════════════
-- HDCC — Scout Module Migration
-- Run AFTER schema.sql
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────
-- SCOUT SOURCES — managed source library
-- ───────────────────────────────────────────
create table if not exists scout_sources (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  url                 text not null unique,
  category            text not null check (category in ('rap_core','culture','drama','fashion','global_news','science')),
  lang                text not null,
  active              boolean not null default true,
  last_fetched_at     timestamptz,
  total_items_found   integer not null default 0,
  health              text not null default 'unknown' check (health in ('ok','error','unknown')),
  error_message       text,
  created_at          timestamptz default now()
);

-- Add columns that may be missing if the table was created by schema.sql
alter table scout_sources add column if not exists last_fetched_at   timestamptz;
alter table scout_sources add column if not exists total_items_found integer not null default 0;
alter table scout_sources add column if not exists health            text not null default 'unknown';
alter table scout_sources add column if not exists error_message     text;

-- Add check constraint for health if not present
do $$ begin
  alter table scout_sources add constraint scout_sources_health_check
    check (health in ('ok','error','unknown'));
exception when duplicate_object then null; end $$;

create index if not exists idx_scout_sources_active   on scout_sources(active);
create index if not exists idx_scout_sources_category on scout_sources(category);
create index if not exists idx_scout_sources_health   on scout_sources(health);

-- ───────────────────────────────────────────
-- SCOUT RUNS — execution history
-- ───────────────────────────────────────────
create table if not exists scout_runs (
  id              uuid primary key default gen_random_uuid(),
  status          text not null default 'running'
                  check (status in ('running', 'complete', 'error')),
  sources_count   integer not null default 0,
  items_found     integer not null default 0,
  duration_ms     integer,
  triggered_by    text not null default 'manual',
  error_message   text,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz
);

-- Add columns that may be missing from a previous partial run
alter table scout_runs add column if not exists sources_count   integer not null default 0;
alter table scout_runs add column if not exists items_found     integer not null default 0;
alter table scout_runs add column if not exists duration_ms     integer;
alter table scout_runs add column if not exists triggered_by    text not null default 'manual';
alter table scout_runs add column if not exists error_message   text;
alter table scout_runs add column if not exists started_at      timestamptz not null default now();
alter table scout_runs add column if not exists completed_at    timestamptz;

create index if not exists idx_scout_runs_status     on scout_runs(status);
create index if not exists idx_scout_runs_started_at on scout_runs(started_at desc);

-- ───────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────
alter table scout_sources enable row level security;
alter table scout_runs    enable row level security;

drop policy if exists "scout_sources: authenticated can read" on scout_sources;
create policy "scout_sources: authenticated can read"
  on scout_sources for select using (auth.role() = 'authenticated');

drop policy if exists "scout_sources: editors and admins can modify" on scout_sources;
create policy "scout_sources: editors and admins can modify"
  on scout_sources for all using (get_user_role() in ('admin', 'editor'));

drop policy if exists "scout_runs: authenticated can read" on scout_runs;
create policy "scout_runs: authenticated can read"
  on scout_runs for select using (auth.role() = 'authenticated');

drop policy if exists "scout_runs: editors and admins can insert" on scout_runs;
create policy "scout_runs: editors and admins can insert"
  on scout_runs for insert with check (get_user_role() in ('admin', 'editor'));

drop policy if exists "scout_runs: editors and admins can update" on scout_runs;
create policy "scout_runs: editors and admins can update"
  on scout_runs for update using (get_user_role() in ('admin', 'editor'));

-- ───────────────────────────────────────────
-- REALTIME
-- ───────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table scout_sources;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table scout_runs;
exception when duplicate_object then null; end $$;

-- ───────────────────────────────────────────
-- SEED — import all sources from SOURCES constant
-- Run via: psql or Supabase SQL editor
-- ───────────────────────────────────────────
insert into scout_sources (name, url, category, lang, active) values
  -- CZ
  ('Refresher CZ',    'https://refresher.cz/rss',                    'rap_core',    'cs',     true),
  ('Rap Revue',       'https://raprevue.cz/feed',                    'rap_core',    'cs',     true),
  ('Musicserver',     'https://musicserver.cz/rss',                  'culture',     'cs',     true),
  ('HipHop.cz',       'https://hiphop.cz/feed',                      'rap_core',    'cs',     true),
  ('Street Machine',  'https://streetmachine.cz/feed',               'fashion',     'cs',     true),
  ('iRadio Beat CZ',  'https://iradiobeat.cz/rss',                   'rap_core',    'cs',     false),
  -- SK
  ('Refresher SK',    'https://refresher.sk/rss',                    'rap_core',    'sk',     true),
  ('Flow SK',         'https://flow.sk/feed',                        'rap_core',    'sk',     true),
  ('Kapital SK',      'https://kapital.sk/rss',                      'culture',     'sk',     false),
  -- DE
  ('Backspin',        'https://backspin.de/feed',                    'rap_core',    'de',     true),
  ('HipHop.de',       'https://hiphop.de/rss',                       'rap_core',    'de',     true),
  ('Juice Magazine',  'https://juice.de/feed',                       'rap_core',    'de',     true),
  ('16BARS.de',       'https://16bars.de/feed',                      'rap_core',    'de',     true),
  ('Rap.de',          'https://rap.de/feed',                         'rap_core',    'de',     false),
  ('MZEE.com',        'https://mzee.com/magazine/feed',              'culture',     'de',     false),
  -- FR
  ('Booska-P',        'https://www.booska-p.com/rss',                'rap_core',    'fr',     true),
  ('Raplume',         'https://raplume.eu/feed',                     'rap_core',    'fr',     true),
  ('Abcdr du Son',    'https://www.abcdrduson.com/feed',             'rap_core',    'fr',     true),
  ('Yard',            'https://www.yard.live/feed',                  'culture',     'fr',     true),
  ('Mouvement',       'https://mouvement.net/feed',                  'culture',     'fr',     false),
  ('Rap Genius FR',   'https://genius.com/fr/news/rss',              'rap_core',    'fr',     false),
  -- PL
  ('Popkiller',       'https://popkiller.pl/rss',                    'rap_core',    'pl',     true),
  ('WhiteHouse PL',   'https://whitehouse.com.pl/feed',              'rap_core',    'pl',     true),
  ('HipHop Centrum',  'https://hiphopcen.pl/feed',                   'rap_core',    'pl',     false),
  -- IT
  ('HiphopTV',        'https://hiphoptv.it/feed',                    'rap_core',    'it',     true),
  ('AllMusic Italia', 'https://allmusicitalia.it/feed',              'culture',     'it',     true),
  ('Rockit',          'https://www.rockit.it/feed',                  'culture',     'it',     false),
  -- ES
  ('HipHop.es',       'https://hiphopes.es/feed',                    'rap_core',    'es',     true),
  ('Bass Culture',    'https://bassculturemagazine.com/feed',        'culture',     'es',     false),
  -- NL
  ('3voor12',         'https://3voor12.vpro.nl/rss',                 'culture',     'nl',     true),
  ('FunX NL',         'https://www.funx.nl/rss',                     'rap_core',    'nl',     true),
  -- SE
  ('Gaffa SE',        'https://gaffa.se/rss',                        'culture',     'se',     false),
  -- UK
  ('GRM Daily',       'https://grmdaily.com/feed',                   'rap_core',    'en-gb',  true),
  ('Mixtape Madness', 'https://mixtapemadness.com/feed',             'rap_core',    'en-gb',  true),
  ('Link Up TV',      'https://linkuptv.co.uk/feed',                 'rap_core',    'en-gb',  true),
  ('Knowledge Mag',   'https://knowledgemagazine.co.uk/feed',        'culture',     'en-gb',  false),
  ('Notion Mag',      'https://notion.online/feed',                  'culture',     'en-gb',  false),
  -- US RAP CORE
  ('HipHopDX',        'https://hiphopdx.com/feed',                   'rap_core',    'en-us',  true),
  ('XXL',             'https://xxlmag.com/feed',                     'rap_core',    'en-us',  true),
  ('HotNewHipHop',    'https://www.hotnewhiphop.com/rss.php',        'rap_core',    'en-us',  true),
  ('AllHipHop',       'https://allhiphop.com/feed',                  'rap_core',    'en-us',  true),
  ('Genius News',     'https://genius.com/news/rss',                 'rap_core',    'en-us',  true),
  ('The Source',      'https://thesource.com/feed',                  'rap_core',    'en-us',  true),
  ('Rap Radar',       'https://rapradar.com/feed',                   'rap_core',    'en-us',  false),
  -- US CULTURE
  ('Complex',         'https://complex.com/music/rss',               'culture',     'en-us',  true),
  ('The Fader',       'https://www.thefader.com/rss',                'culture',     'en-us',  true),
  ('Pitchfork',       'https://pitchfork.com/feed/feed.json',        'culture',     'en-us',  false),
  ('Mass Appeal',     'https://massappeal.com/feed',                 'culture',     'en-us',  false),
  ('DJBooth',         'https://djbooth.net/feed',                    'culture',     'en-us',  false),
  -- DRAMA
  ('TMZ',             'https://www.tmz.com/rss.xml',                 'drama',       'en-us',  true),
  ('WorldStar',       'https://worldstarhiphop.com/rss',             'drama',       'en-us',  true),
  ('MediaTakeOut',    'https://mtonews.com/feed',                    'drama',       'en-us',  false),
  ('Bossip',          'https://bossip.com/feed',                     'drama',       'en-us',  false),
  ('The Shade Room',  'https://theshaderoom.com/feed',               'drama',       'en-us',  false),
  -- FASHION
  ('Hypebeast',       'https://hypebeast.com/feed',                  'fashion',     'global', true),
  ('Highsnobiety',    'https://www.highsnobiety.com/feed',           'fashion',     'global', true),
  ('Sneaker News',    'https://sneakernews.com/feed',                'fashion',     'global', true),
  ('Sole Collector',  'https://solecollector.com/feed',              'fashion',     'global', true),
  ('Kicks On Fire',   'https://www.kicksonfire.com/feed',            'fashion',     'global', false),
  ('Nice Kicks',      'https://www.nicekicks.com/feed',              'fashion',     'global', false),
  ('Hype.cz',         'https://hype.cz/feed',                        'fashion',     'cs',     true),
  -- GLOBAL NEWS
  ('Reuters',         'https://feeds.reuters.com/reuters/topNews',   'global_news', 'global', true),
  ('BBC News',        'https://feeds.bbci.co.uk/news/rss.xml',       'global_news', 'global', true),
  ('Vice',            'https://www.vice.com/en/rss',                 'global_news', 'global', false),
  -- SCIENCE
  ('MIT Tech Review', 'https://www.technologyreview.com/feed',       'science',     'global', true),
  ('TechCrunch',      'https://techcrunch.com/feed',                 'science',     'global', false),
  ('Nature',          'https://www.nature.com/rss',                  'science',     'global', false)
on conflict (url) do nothing;
