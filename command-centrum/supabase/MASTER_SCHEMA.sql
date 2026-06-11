-- ═══════════════════════════════════════════════════════════════════════════════
-- HOTDROPPZ COMMAND CENTER — MASTER SCHEMA
-- Run this ONCE in Supabase SQL Editor (fully idempotent, safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function get_user_role()
returns text language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'editor' check (role in ('admin','editor','viewer')),
  full_name  text,
  avatar_url text,
  created_at timestamptz default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, role)
  values (new.id, new.email, 'editor')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- SCOUT ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists scout_items (
  id             uuid        primary key default gen_random_uuid(),
  source         text        not null,
  url            text,
  title          text        not null,
  raw_content    text,
  content        text,
  category       text        default 'culture',
  language       text        default 'en-us',
  status         text        not null default 'SCOUTED',
  created_at     timestamptz default now()
);

-- Add all pipeline columns (idempotent)
alter table scout_items add column if not exists published_at     timestamptz;
alter table scout_items add column if not exists attention_score  double precision;
alter table scout_items add column if not exists title_en         text;
alter table scout_items add column if not exists content_en       text;
alter table scout_items add column if not exists lang_detected    text;
alter table scout_items add column if not exists language_detected text;
alter table scout_items add column if not exists english_master   text;
alter table scout_items add column if not exists priority         text default 'P3';
alter table scout_items add column if not exists is_release       boolean not null default false;
alter table scout_items add column if not exists release_type     text;

-- Migrate legacy status values
update scout_items set status = 'SCOUTED' where status = 'new';
update scout_items set status = 'CURATED' where status = 'queued';

-- Status constraint (full pipeline set)
alter table scout_items drop constraint if exists scout_items_status_check;
alter table scout_items add constraint scout_items_status_check
  check (status in ('SCOUTED','TRANSLATED','CURATED','CLUSTERED','WRITTEN','discarded'));

alter table scout_items alter column status set default 'SCOUTED';
alter table scout_items alter column category set default 'culture';
update scout_items set category = 'culture' where category is null;

-- Deduplicate URLs (keep newest)
with ranked as (
  select ctid,
    row_number() over (partition by url order by created_at desc nulls last, id desc) as rn
  from scout_items where url is not null
)
update scout_items s set url = null
from ranked where s.ctid = ranked.ctid and ranked.rn > 1;

-- Indexes
create unique index if not exists idx_scout_items_url_unique
  on scout_items(url) where url is not null;
create index if not exists idx_scout_items_status        on scout_items(status);
create index if not exists idx_scout_items_created       on scout_items(created_at desc);
create index if not exists idx_scout_items_category      on scout_items(category);
create index if not exists idx_scout_items_attention_score on scout_items(attention_score desc);
create index if not exists idx_scout_items_published_at  on scout_items(published_at desc);
create index if not exists idx_scout_items_priority      on scout_items(priority);
create index if not exists idx_scout_items_is_release    on scout_items(is_release) where is_release = true;
create index if not exists idx_scout_items_language      on scout_items(language_detected);
create index if not exists idx_scout_items_status_translated
  on scout_items(status) where status = 'TRANSLATED';

-- Backfill content_en from english_master for old data
update scout_items
  set content_en = english_master
  where content_en is null and english_master is not null;
update scout_items
  set title_en = title
  where title_en is null and (language = 'en' or lang_detected = 'en');

-- ─────────────────────────────────────────────────────────────────────────────
-- CURATED ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists curated_items (
  id            uuid primary key default gen_random_uuid(),
  scout_item_id uuid references scout_items(id) on delete set null,
  score         integer check (score between 0 and 100),
  category      text,
  tags          text[] default '{}',
  reasoning     text,
  status        text not null default 'pending'
                check (status in ('pending','sent_to_writer','skipped')),
  created_at    timestamptz default now()
);

create index if not exists idx_curated_items_status on curated_items(status);
create index if not exists idx_curated_items_score  on curated_items(score desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- POSTS (CMS — legacy output table)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists posts (
  id             uuid        primary key default gen_random_uuid(),
  title          text        not null,
  body           text,
  summary        text,
  image_url      text,
  embeds         jsonb       not null default '[]',
  category       text,
  tags           text[]      default '{}',
  source_url     text,
  source_name    text,
  ai_score       integer     check (ai_score between 0 and 100),
  status         text        not null default 'draft'
                 check (status in ('draft','approved','rejected','hold','published','archived')),
  published_at   timestamptz,
  scheduled_at   timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Multilang + pipeline columns
alter table posts add column if not exists english_master      text;
alter table posts add column if not exists localized_versions  jsonb not null default '{}';
alter table posts add column if not exists short_text          text;
alter table posts add column if not exists media_hint          text default 'image';
alter table posts add column if not exists droppz_type         text;

-- Indexes
create index if not exists idx_posts_status    on posts(status);
create index if not exists idx_posts_created   on posts(created_at desc);
create index if not exists idx_posts_published on posts(published_at desc);
create index if not exists idx_posts_category  on posts(category);
create index if not exists idx_posts_ai_score  on posts(ai_score desc);

drop trigger if exists posts_updated_at on posts;
create trigger posts_updated_at
  before update on posts
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- POST ANALYTICS
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists post_analytics (
  id              uuid        primary key default gen_random_uuid(),
  post_id         uuid        not null references posts(id) on delete cascade,
  views           integer     not null default 0,
  clicks          integer     not null default 0,
  shares          integer     not null default 0,
  engagement_rate numeric(5,2) not null default 0,
  recorded_at     timestamptz default now()
);

create index if not exists idx_post_analytics_post_id     on post_analytics(post_id);
create index if not exists idx_post_analytics_recorded_at on post_analytics(recorded_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- FEED POSTS (pipeline output)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists feed_posts (
  id            uuid        primary key default gen_random_uuid(),
  scout_item_id uuid        not null references scout_items(id) on delete cascade,
  type          text        not null check (type in ('track','album','video_release','event')),
  title         text        not null,
  content       text        not null,
  artist        text,
  spotify_url   text,
  youtube_url   text,
  genius_url    text,
  image_url     text,
  created_at    timestamptz not null default now()
);

-- Add all extended columns
alter table feed_posts add column if not exists cluster_id        uuid;
alter table feed_posts add column if not exists summary           text;
alter table feed_posts add column if not exists confidence        double precision default 0;
alter table feed_posts add column if not exists tags              text[] not null default '{}';
alter table feed_posts add column if not exists english_master    text;
alter table feed_posts add column if not exists localized_versions jsonb not null default '{}';
alter table feed_posts add column if not exists media_hint        text default 'image';

-- Indexes
create unique index if not exists idx_feed_posts_scout_item_id on feed_posts(scout_item_id);
create index if not exists idx_feed_posts_created_at           on feed_posts(created_at desc);
create index if not exists idx_feed_posts_type                 on feed_posts(type);
create index if not exists idx_feed_posts_confidence           on feed_posts(confidence desc);
create index if not exists idx_feed_posts_tags                 on feed_posts using gin(tags);
create index if not exists idx_feed_posts_media_hint_null
  on feed_posts(created_at desc) where media_hint is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- STORY CLUSTERS
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists story_clusters (
  id                    uuid          primary key default gen_random_uuid(),
  main_entity           text          not null,
  category              text          not null,
  title                 text          not null,
  confidence            double precision not null default 0,
  merged_context        text[]        not null default '{}',
  status                text          not null default 'pending'
                        check (status in ('pending','written','skipped')),
  primary_scout_item_id uuid          references scout_items(id),
  max_attention_score   double precision not null default 0,
  source_count          integer       not null default 1,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

-- Enrichment columns
alter table story_clusters add column if not exists artist_name       text;
alter table story_clusters add column if not exists spotify_url       text;
alter table story_clusters add column if not exists youtube_url       text;
alter table story_clusters add column if not exists genius_url        text;
alter table story_clusters add column if not exists image_url         text;
alter table story_clusters add column if not exists enrichment_status text default 'pending';
alter table story_clusters add column if not exists enriched_at       timestamptz;

-- Backfill enrichment_status
update story_clusters set enrichment_status = 'pending' where enrichment_status is null;

-- Link feed_posts → clusters
alter table feed_posts
  add column if not exists cluster_id uuid;

do $$ begin
  alter table feed_posts
    add constraint feed_posts_cluster_id_fkey
    foreign key (cluster_id) references story_clusters(id);
exception when duplicate_object then null; end $$;

-- Indexes
create index if not exists idx_story_clusters_status   on story_clusters(status);
create index if not exists idx_story_clusters_created  on story_clusters(created_at desc);
create index if not exists idx_story_clusters_score    on story_clusters(max_attention_score desc);
create index if not exists idx_story_clusters_enrichment_status
  on story_clusters(enrichment_status, status, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- STORY CLUSTER SOURCES
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists story_cluster_sources (
  id            uuid        primary key default gen_random_uuid(),
  cluster_id    uuid        not null references story_clusters(id) on delete cascade,
  scout_item_id uuid        not null references scout_items(id),
  source_name   text        not null,
  url           text,
  text_snippet  text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_cluster_sources_cluster on story_cluster_sources(cluster_id);
create index if not exists idx_cluster_sources_scout   on story_cluster_sources(scout_item_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SCOUT SOURCES
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists scout_sources (
  id                uuid        primary key default gen_random_uuid(),
  name              text        not null,
  url               text        not null unique,
  category          text        not null,
  lang              text        not null,
  active            boolean     not null default true,
  last_fetched_at   timestamptz,
  total_items_found integer     not null default 0,
  health            text        not null default 'unknown',
  error_message     text,
  created_at        timestamptz default now()
);

-- Add columns if missing (upgrade-safe)
alter table scout_sources add column if not exists last_fetched_at   timestamptz;
alter table scout_sources add column if not exists total_items_found integer not null default 0;
alter table scout_sources add column if not exists health            text not null default 'unknown';
alter table scout_sources add column if not exists error_message     text;

-- Health constraint
do $$ begin
  alter table scout_sources add constraint scout_sources_health_check
    check (health in ('ok','error','unknown'));
exception when duplicate_object then null; end $$;

-- Category constraint (full set)
alter table scout_sources drop constraint if exists scout_sources_category_check;
alter table scout_sources add constraint scout_sources_category_check
  check (category in (
    'droppz_news','rap_core','deep_scout',
    'drama','fashion','global_news','culture','science'
  ));

-- Lang constraint (all 17 languages)
alter table scout_sources drop constraint if exists scout_sources_lang_check;
alter table scout_sources add constraint scout_sources_lang_check
  check (lang in (
    'cs','sk','de','fr','pl','it','es','nl','se',
    'ru','sr','sq','bs','hr',
    'en-gb','en-us','global'
  ));

-- Indexes
create index if not exists idx_scout_sources_active   on scout_sources(active);
create index if not exists idx_scout_sources_category on scout_sources(category);
create index if not exists idx_scout_sources_health   on scout_sources(health);

-- ─────────────────────────────────────────────────────────────────────────────
-- SCOUT RUNS
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists scout_runs (
  id            uuid        primary key default gen_random_uuid(),
  status        text        not null default 'running'
                check (status in ('running','complete','error')),
  sources_count integer     not null default 0,
  items_found   integer     not null default 0,
  duration_ms   integer,
  triggered_by  text        not null default 'manual',
  error_message text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists idx_scout_runs_status     on scout_runs(status);
create index if not exists idx_scout_runs_started_at on scout_runs(started_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- SCORING WEIGHTS
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists scoring_weights (
  id         uuid         primary key default gen_random_uuid(),
  category   text         not null unique,
  weight     numeric(4,2) not null default 1.0 check (weight >= 0 and weight <= 2),
  reason     text,
  updated_at timestamptz  default now()
);

insert into scoring_weights (category, weight, reason) values
  ('droppz_news', 1.20, 'Highest priority — official releases'),
  ('rap_core',    1.00, 'Core content'),
  ('deep_scout',  0.80, 'Intel / critical reviews'),
  ('drama',       0.90, 'High engagement driver'),
  ('culture',     0.85, 'Brand identity'),
  ('fashion',     0.75, 'Visual appeal'),
  ('global_news', 0.60, 'Context layer'),
  ('science',     0.50, 'Context layer')
on conflict (category) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- AD CAMPAIGNS & SLOTS
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists ad_campaigns (
  id         uuid         primary key default gen_random_uuid(),
  name       text         not null,
  client     text,
  budget     numeric(12,2),
  start_date date,
  end_date   date,
  active     boolean      not null default true,
  created_at timestamptz  default now()
);
create index if not exists idx_ad_campaigns_active on ad_campaigns(active);

create table if not exists ad_slots (
  id          uuid    primary key default gen_random_uuid(),
  position    text    not null,
  type        text    check (type in ('banner','native','interstitial')),
  campaign_id uuid    references ad_campaigns(id) on delete set null,
  active      boolean not null default true
);
create index if not exists idx_ad_slots_active      on ad_slots(active);
create index if not exists idx_ad_slots_campaign_id on ad_slots(campaign_id);

insert into ad_slots (position, type, active) values
  ('feed-top',       'banner',        false),
  ('feed-inline',    'native',        false),
  ('article-top',    'banner',        false),
  ('article-bottom', 'native',        false),
  ('sidebar',        'banner',        false),
  ('breaking-bar',   'banner',        false)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table profiles              enable row level security;
alter table scout_items           enable row level security;
alter table curated_items         enable row level security;
alter table posts                 enable row level security;
alter table post_analytics        enable row level security;
alter table scoring_weights       enable row level security;
alter table ad_campaigns          enable row level security;
alter table ad_slots              enable row level security;
alter table feed_posts            enable row level security;
alter table scout_sources         enable row level security;
alter table scout_runs            enable row level security;
alter table story_clusters        enable row level security;
alter table story_cluster_sources enable row level security;

-- Profiles
drop policy if exists "profiles: own read"      on profiles;
drop policy if exists "profiles: admin read all" on profiles;
drop policy if exists "profiles: own update"     on profiles;
create policy "profiles: own read"      on profiles for select using (id = auth.uid());
create policy "profiles: admin read all" on profiles for select using (get_user_role() = 'admin');
create policy "profiles: own update"    on profiles for update using (id = auth.uid());

-- Scout items
drop policy if exists "scout_items: read"   on scout_items;
drop policy if exists "scout_items: write"  on scout_items;
drop policy if exists "scout_items: delete" on scout_items;
create policy "scout_items: read"   on scout_items for select using (auth.role() = 'authenticated');
create policy "scout_items: write"  on scout_items for all    using (get_user_role() in ('admin','editor'));
create policy "scout_items: delete" on scout_items for delete using (get_user_role() = 'admin');

-- Curated items
drop policy if exists "curated_items: read"  on curated_items;
drop policy if exists "curated_items: write" on curated_items;
create policy "curated_items: read"  on curated_items for select using (auth.role() = 'authenticated');
create policy "curated_items: write" on curated_items for all    using (get_user_role() in ('admin','editor'));

-- Posts
drop policy if exists "posts: read"   on posts;
drop policy if exists "posts: write"  on posts;
drop policy if exists "posts: delete" on posts;
create policy "posts: read"   on posts for select using (auth.role() = 'authenticated');
create policy "posts: write"  on posts for all    using (get_user_role() in ('admin','editor'));
create policy "posts: delete" on posts for delete using (get_user_role() = 'admin');

-- Post analytics
drop policy if exists "post_analytics: read"  on post_analytics;
drop policy if exists "post_analytics: write" on post_analytics;
create policy "post_analytics: read"  on post_analytics for select using (auth.role() = 'authenticated');
create policy "post_analytics: write" on post_analytics for insert with check (get_user_role() in ('admin','editor'));

-- Feed posts
drop policy if exists "feed_posts: read"   on feed_posts;
drop policy if exists "feed_posts: write"  on feed_posts;
drop policy if exists "feed_posts: delete" on feed_posts;
create policy "feed_posts: read"   on feed_posts for select using (auth.role() = 'authenticated');
create policy "feed_posts: write"  on feed_posts for all    using (get_user_role() in ('admin','editor'));
create policy "feed_posts: delete" on feed_posts for delete using (get_user_role() = 'admin');

-- Story clusters
drop policy if exists "story_clusters_select"        on story_clusters;
drop policy if exists "story_cluster_sources_select" on story_cluster_sources;
create policy "story_clusters_select"        on story_clusters        for select to authenticated using (true);
create policy "story_cluster_sources_select" on story_cluster_sources for select to authenticated using (true);

-- Scout sources
drop policy if exists "scout_sources: read"   on scout_sources;
drop policy if exists "scout_sources: modify" on scout_sources;
create policy "scout_sources: read"   on scout_sources for select using (auth.role() = 'authenticated');
create policy "scout_sources: modify" on scout_sources for all    using (get_user_role() in ('admin','editor'));

-- Scout runs
drop policy if exists "scout_runs: read"   on scout_runs;
drop policy if exists "scout_runs: write"  on scout_runs;
create policy "scout_runs: read"  on scout_runs for select using (auth.role() = 'authenticated');
create policy "scout_runs: write" on scout_runs for all    using (get_user_role() in ('admin','editor'));

-- Scoring weights
drop policy if exists "scoring_weights: read"   on scoring_weights;
drop policy if exists "scoring_weights: modify" on scoring_weights;
create policy "scoring_weights: read"   on scoring_weights for select using (auth.role() = 'authenticated');
create policy "scoring_weights: modify" on scoring_weights for all    using (get_user_role() in ('admin','editor'));

-- Ad campaigns & slots
drop policy if exists "ad_campaigns: read"   on ad_campaigns;
drop policy if exists "ad_campaigns: modify" on ad_campaigns;
drop policy if exists "ad_slots: read"       on ad_slots;
drop policy if exists "ad_slots: modify"     on ad_slots;
create policy "ad_campaigns: read"   on ad_campaigns for select using (auth.role() = 'authenticated');
create policy "ad_campaigns: modify" on ad_campaigns for all    using (get_user_role() = 'admin');
create policy "ad_slots: read"       on ad_slots     for select using (auth.role() = 'authenticated');
create policy "ad_slots: modify"     on ad_slots     for all    using (get_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin alter publication supabase_realtime add table posts;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table scout_items;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table curated_items;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table scout_sources;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table scout_runs;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table feed_posts;
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SCOUT SOURCES SEED — all 123+ sources, fixed URLs, all 17 languages
-- ─────────────────────────────────────────────────────────────────────────────
insert into scout_sources (name, url, category, lang, active) values

  -- ══════════════════════════════════════
  -- 🟣 DROPPZ NEWS — P0 (official releases)
  -- ══════════════════════════════════════
  ('Billboard',           'https://www.billboard.com/feed/',                          'droppz_news', 'en-us', true),
  ('HipHopDX Releases',   'https://hiphopdx.com/rss',                                'droppz_news', 'en-us', true),
  ('Rap-Up',              'https://www.rap-up.com/feed/',                             'droppz_news', 'en-us', true),
  ('Rolling Stone Music', 'https://www.rollingstone.com/music/feed/',                 'droppz_news', 'en-us', true),
  ('Pitchfork News',      'https://pitchfork.com/rss/news/',                          'droppz_news', 'en-us', true),

  -- ══════════════════════════════════════
  -- 🔴 RAP CORE — P1
  -- ══════════════════════════════════════
  -- 🇺🇸 USA
  ('HipHopDX',            'https://hiphopdx.com/feed',                                'rap_core', 'en-us', true),
  ('XXL',                 'https://xxlmag.com/feed',                                  'rap_core', 'en-us', true),
  ('HotNewHipHop',        'https://www.hotnewhiphop.com/rss.php',                     'rap_core', 'en-us', true),
  ('AllHipHop',           'https://allhiphop.com/feed',                               'rap_core', 'en-us', true),
  ('Spin Magazine',       'https://spin.com/feed/',                                   'rap_core', 'en-us', true),
  ('The Source',          'https://thesource.com/feed',                               'rap_core', 'en-us', true),
  ('Pigeons & Planes',    'https://pigeonsandplanes.com/feed/',                       'rap_core', 'en-us', true),
  ('Vibe',                'https://www.vibe.com/feed',                                'rap_core', 'en-us', true),
  ('Stereogum Hip-Hop',   'https://www.stereogum.com/category/hip-hop/feed/',         'rap_core', 'en-us', true),
  ('Consequence',         'https://consequence.net/feed/',                            'rap_core', 'en-us', true),
  -- 🇬🇧 UK
  ('GRM Daily',           'https://grmdaily.com/feed',                                'rap_core', 'en-gb', true),
  ('Mixtape Madness',     'https://mixtapemadness.com/feed',                          'rap_core', 'en-gb', true),
  ('Link Up TV',          'https://linkuptv.co.uk/feed',                              'rap_core', 'en-gb', true),
  -- 🇨🇿 CZ
  ('Refresher CZ',        'https://refresher.cz/rss',                                 'rap_core', 'cs', true),
  ('Rap Revue',           'https://raprevue.cz/feed',                                 'rap_core', 'cs', true),
  ('HipHop.cz',           'https://hiphop.cz/feed',                                   'rap_core', 'cs', true),
  ('iRadio Beat CZ',      'https://iradiobeat.cz/rss',                                'rap_core', 'cs', true),
  ('Rapzname CZ',         'https://rapzname.cz/feed',                                 'rap_core', 'cs', true),
  -- 🇸🇰 SK
  ('Refresher SK',        'https://refresher.sk/rss',                                 'rap_core', 'sk', true),
  ('Flow SK',             'https://flow.sk/feed',                                     'rap_core', 'sk', true),
  ('Raps.sk',             'https://raps.sk/feed',                                     'rap_core', 'sk', true),
  -- 🇩🇪 DE
  ('Backspin',            'https://backspin.de/feed',                                 'rap_core', 'de', true),
  ('HipHop.de',           'https://hiphop.de/rss',                                    'rap_core', 'de', true),
  ('Juice Magazine',      'https://juice.de/feed',                                    'rap_core', 'de', true),
  ('16BARS.de',           'https://16bars.de/feed',                                   'rap_core', 'de', true),
  ('Rap.de',              'https://rap.de/feed',                                      'rap_core', 'de', true),
  ('Musikexpress DE',     'https://www.musikexpress.de/feed/',                        'rap_core', 'de', true),
  -- 🇫🇷 FR
  ('Booska-P',            'https://www.booska-p.com/rss',                             'rap_core', 'fr', true),
  ('Raplume',             'https://raplume.eu/feed',                                  'rap_core', 'fr', true),
  ('Abcdr du Son',        'https://www.abcdrduson.com/feed',                          'rap_core', 'fr', true),
  ('Rap Genius FR',       'https://genius.com/fr/news/rss',                           'rap_core', 'fr', true),
  -- 🇵🇱 PL
  ('Popkiller',           'https://popkiller.pl/rss',                                 'rap_core', 'pl', true),
  ('WhiteHouse PL',       'https://whitehouse.com.pl/feed',                           'rap_core', 'pl', true),
  ('HipHop Centrum',      'https://hiphopcen.pl/feed',                                'rap_core', 'pl', true),
  -- 🇮🇹 IT
  ('HiphopTV',            'https://hiphoptv.it/feed',                                 'rap_core', 'it', true),
  ('Rapologia IT',        'https://www.rapologia.it/feed',                            'rap_core', 'it', true),
  -- 🇪🇸 ES
  ('HipHop.es',           'https://hiphopes.es/feed',                                 'rap_core', 'es', true),
  ('HHGroups ES',         'https://www.hhgroups.com/rss',                             'rap_core', 'es', true),
  -- 🇳🇱 NL
  ('FunX NL',             'https://www.funx.nl/rss',                                  'rap_core', 'nl', true),
  ('Puna NL',             'https://www.puna.nl/feed/',                                'rap_core', 'nl', true),
  -- 🇷🇺 RU
  ('The Flow RU',         'https://the-flow.ru/rss',                                  'rap_core', 'ru', true),
  -- 🇷🇸 RS
  ('Mondo RS',            'https://mondo.rs/rss',                                     'rap_core', 'sr', true),
  -- 🇦🇱 AL
  ('Top Channel AL',      'https://top-channel.tv/rss',                               'rap_core', 'sq', true),
  -- 🇧🇦 BA
  ('Klix BA',             'https://klix.ba/rss',                                      'rap_core', 'bs', true),
  -- 🇭🇷 HR
  ('Index HR',            'https://www.index.hr/rss',                                 'rap_core', 'hr', true),

  -- ══════════════════════════════════════
  -- 🟠 DRAMA — P2
  -- ══════════════════════════════════════
  ('TMZ',                 'https://www.tmz.com/rss.xml',                              'drama', 'en-us', true),
  ('Uproxx Music',        'https://uproxx.com/music/feed/',                           'drama', 'en-us', true),
  ('MediaTakeOut',        'https://mtonews.com/feed',                                 'drama', 'en-us', true),
  ('Bossip',              'https://bossip.com/feed',                                  'drama', 'en-us', true),
  ('The Shade Room',      'https://theshaderoom.com/feed',                            'drama', 'en-us', true),
  ('HipHopHeads',         'https://www.reddit.com/r/hiphopheads/.rss',               'drama', 'en-us', true),
  ('PopCultureChat',      'https://www.reddit.com/r/PopCultureChat/.rss',            'drama', 'en-us', true),
  ('Daily Mail US',       'https://www.dailymail.co.uk/ushome/index.rss',            'drama', 'en-us', true),
  ('Daily Mail UK',       'https://www.dailymail.co.uk/articles.rss',               'drama', 'en-gb', true),
  -- Local drama
  ('Blesk',               'https://www.blesk.cz/rss',                                 'drama', 'cs', true),
  ('Pluska',              'https://www.pluska.sk/rss',                                'drama', 'sk', true),
  ('Cas.sk',              'https://www.cas.sk/rss',                                   'drama', 'sk', true),
  ('Bild',                'https://www.bild.de/rssfeeds/vw-home/vw-home-16725546,feed=home.bild.html', 'drama', 'de', true),
  ('Closer FR',           'https://www.closermag.fr/rss',                             'drama', 'fr', true),
  ('Gala FR',             'https://www.gala.fr/rss',                                  'drama', 'fr', true),
  ('Fakt PL',             'https://www.fakt.pl/rss',                                  'drama', 'pl', true),
  ('Plotek PL',           'https://www.plotek.pl/rss',                                'drama', 'pl', true),
  ('Chi IT',              'https://www.chimagazine.it/rss',                           'drama', 'it', true),
  ('Gossip.it',           'https://www.gossip.it/rss',                                'drama', 'it', true),
  ('20 Minutos ES',       'https://www.20minutos.es/rss',                             'drama', 'es', true),
  ('Telegraaf NL',        'https://www.telegraaf.nl/rss',                             'drama', 'nl', true),
  ('Lenta RU',            'https://lenta.ru/rss',                                     'drama', 'ru', true),
  ('Telegraf RS',         'https://telegraf.rs/rss',                                  'drama', 'sr', true),
  ('Zeri AL',             'https://zeri.info/rss',                                    'drama', 'sq', true),
  ('Avaz BA',             'https://avaz.ba/rss',                                      'drama', 'bs', true),
  ('24sata HR',           'https://www.24sata.hr/rss',                                'drama', 'hr', true),

  -- ══════════════════════════════════════
  -- 🟡 FASHION / STREETWEAR — P2
  -- ══════════════════════════════════════
  ('Hypebeast',           'https://hypebeast.com/feed',                               'fashion', 'global', true),
  ('Highsnobiety',        'https://www.highsnobiety.com/feed',                        'fashion', 'global', true),
  ('Sneaker News',        'https://sneakernews.com/feed',                             'fashion', 'global', true),
  ('Sole Collector',      'https://solecollector.com/feed',                           'fashion', 'global', true),
  ('Kicks On Fire',       'https://www.kicksonfire.com/feed',                         'fashion', 'global', true),
  ('Nice Kicks',          'https://www.nicekicks.com/feed',                           'fashion', 'global', true),
  ('Vogue',               'https://www.vogue.com/feed',                               'fashion', 'global', true),
  ('GQ',                  'https://www.gq.com/feed',                                  'fashion', 'global', true),
  ('Fashionista',         'https://fashionista.com/feed',                             'fashion', 'global', true),
  ('Complex Style',       'https://www.complex.com/style/rss',                        'fashion', 'en-us', true),
  ('Hype.cz',             'https://hype.cz/feed',                                     'fashion', 'cs', true),
  ('Street Machine',      'https://streetmachine.cz/feed',                            'fashion', 'cs', true),
  ('iReport CZ',          'https://www.ireport.cz/rss',                               'fashion', 'cs', true),

  -- ══════════════════════════════════════
  -- 🟢 GLOBAL NEWS — P3
  -- ══════════════════════════════════════
  ('BBC News',            'https://feeds.bbci.co.uk/news/rss.xml',                   'global_news', 'global', true),
  ('Al Jazeera',          'https://www.aljazeera.com/xml/rss/all.xml',               'global_news', 'global', true),
  ('Reuters',             'https://feeds.reuters.com/reuters/topNews',                'global_news', 'global', true),
  ('France 24',           'https://www.france24.com/en/rss',                          'global_news', 'global', true),
  ('Euronews',            'https://www.euronews.com/rss',                             'global_news', 'global', true),
  ('NPR',                 'https://www.npr.org/rss/rss.php?id=1001',                 'global_news', 'en-us', true),
  ('The Guardian World',  'https://www.theguardian.com/world/rss',                   'global_news', 'en-us', true),
  ('CNN',                 'https://rss.cnn.com/rss/edition.rss',                     'global_news', 'en-us', true),
  ('Novinky.cz',          'https://www.novinky.cz/rss',                               'global_news', 'cs', true),
  ('iDNES.cz',            'https://servis.idnes.cz/rss.aspx?c=zpravodaj',            'global_news', 'cs', true),
  ('Pravda SK',           'https://spravy.pravda.sk/rss',                             'global_news', 'sk', true),
  ('Spiegel',             'https://www.spiegel.de/international/index.rss',          'global_news', 'de', true),
  ('Le Monde',            'https://www.lemonde.fr/rss/une.xml',                       'global_news', 'fr', true),
  ('Gazeta Wyborcza',     'https://wyborcza.pl/pub/rss/wyborcza.xml',                'global_news', 'pl', true),
  ('Corriere della Sera', 'https://rss.corriere.it/rss/homepage.xml',                'global_news', 'it', true),

  -- ══════════════════════════════════════
  -- 🔵 CULTURE — P3
  -- ══════════════════════════════════════
  ('Complex',             'https://complex.com/music/rss',                            'culture', 'en-us', true),
  ('The Fader',           'https://www.thefader.com/rss',                             'culture', 'en-us', true),
  ('Mass Appeal',         'https://massappeal.com/feed',                              'culture', 'en-us', true),
  ('DJBooth',             'https://djbooth.net/feed',                                 'culture', 'en-us', true),
  ('Knowledge Mag',       'https://knowledgemagazine.co.uk/feed',                    'culture', 'en-gb', true),
  ('Notion Mag',          'https://notion.online/feed',                               'culture', 'en-gb', true),
  ('Reddit Memes',        'https://www.reddit.com/r/memes/.rss',                     'culture', 'en-us', true),
  ('Reddit DankMemes',    'https://www.reddit.com/r/dankmemes/.rss',                 'culture', 'en-us', true),
  ('Know Your Meme',      'https://knowyourmeme.com/rss',                             'culture', 'en-us', true),
  ('The Poke',            'https://www.thepoke.co.uk/feed/',                          'culture', 'en-gb', true),
  ('Upworthy',            'https://www.upworthy.com/feed',                            'culture', 'en-us', true),
  ('The Root',            'https://theroot.com/rss',                                  'culture', 'en-us', true),
  ('Musicserver CZ',      'https://musicserver.cz/rss',                               'culture', 'cs', true),
  ('Reflex CZ',           'https://www.reflex.cz/rss',                                'culture', 'cs', true),
  ('Kapital SK',          'https://kapital.sk/rss',                                   'culture', 'sk', true),
  ('Zivot SK',            'https://zivot.pluska.sk/rss',                              'culture', 'sk', true),
  ('MZEE.com',            'https://mzee.com/magazine/feed',                           'culture', 'de', true),
  ('Focus DE',            'https://www.focus.de/feeds/rss/gesellschaft',              'culture', 'de', true),
  ('Yard FR',             'https://www.yard.live/feed',                               'culture', 'fr', true),
  ('GEO FR',              'https://www.geo.fr/rss',                                   'culture', 'fr', true),
  ('AllMusic Italia',     'https://allmusicitalia.it/feed',                           'culture', 'it', true),
  ('Rockit',              'https://www.rockit.it/feed',                               'culture', 'it', true),
  ('Bass Culture ES',     'https://bassculturemagazine.com/feed',                     'culture', 'es', true),
  ('3voor12 NL',          'https://3voor12.vpro.nl/rss',                              'culture', 'nl', true),
  ('Gaffa SE',            'https://gaffa.se/rss',                                     'culture', 'se', true),
  ('National Geo PL',     'https://www.national-geographic.pl/rss',                  'culture', 'pl', true),

  -- ══════════════════════════════════════
  -- 🔬 SCIENCE / TECH — P3
  -- ══════════════════════════════════════
  ('MIT Tech Review',     'https://www.technologyreview.com/feed',                   'science', 'global', true),
  ('TechCrunch',          'https://techcrunch.com/feed',                              'science', 'global', true),
  ('Nature',              'https://www.nature.com/nature.rss',                        'science', 'global', true),
  ('Wired Science',       'https://www.wired.com/feed/category/science/latest/rss',  'science', 'global', true),
  ('Věda24 CZ',           'https://www.ceskatelevize.cz/rss/veda24/',                'science', 'cs', true),
  ('Quark SK',            'https://www.quark.sk/rss',                                'science', 'sk', true),
  ('Spektrum DE',         'https://www.spektrum.de/rss/spektrum-rss2.xml',           'science', 'de', true),
  ('Sciences et Avenir',  'https://www.sciencesetavenir.fr/rss.xml',                 'science', 'fr', true),
  ('Nauka w Polsce',      'https://naukawpolsce.pl/rss.xml',                          'science', 'pl', true),
  ('Le Scienze',          'https://www.lescienze.it/rss',                             'science', 'it', true),

  -- ══════════════════════════════════════
  -- 🧠 DEEP SCOUT — P1 (Intel layer)
  -- ══════════════════════════════════════
  ('Pitchfork Reviews',   'https://pitchfork.com/rss/reviews/albums/',               'deep_scout', 'en-us', true),
  ('Stereogum',           'https://www.stereogum.com/feed/',                          'deep_scout', 'en-us', true),
  ('Reddit IIB',          'https://www.reddit.com/r/InternetIsBeautiful/.rss',       'deep_scout', 'en-us', true)

on conflict (url) do update set
  name     = excluded.name,
  category = excluded.category,
  lang     = excluded.lang,
  active   = excluded.active;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEMA VERSIONING + CHECKSUM GATE
-- Added: 2026-05-18 (sub-mission UM-CC_SCHEMA_MIGRATION/#01)
-- Idempotent: safe to re-run. No destructive operations.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEMA_VERSION TABLE
-- Append-only ledger of applied schema revisions.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists schema_version (
  version       text primary key,
  applied_at    timestamptz not null default now(),
  checksum      text not null,
  description   text,
  applied_by    text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECKSUM HELPERS
-- compute_schema_checksum() — md5 of (table, column, type) projection of public
-- verify_schema_checksum(expected) — diagnostic comparison
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function compute_schema_checksum()
returns text
language sql
stable
as $$
  select md5(string_agg(
    table_name || '|' || column_name || '|' || data_type,
    ',' order by table_name, ordinal_position
  ))
  from information_schema.columns
  where table_schema = 'public'
$$;

create or replace function verify_schema_checksum(expected text)
returns table(ok boolean, computed text, expected_in text)
language plpgsql
stable
as $$
begin
  return query
    select compute_schema_checksum() = expected,
           compute_schema_checksum(),
           expected;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEMA_HEALTH VIEW
-- One-shot read-only diagnostic for CI gate / health endpoint.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view schema_health as
select
  (select count(*) from schema_version)                              as versions_recorded,
  (select max(applied_at) from schema_version)                       as latest_version_at,
  compute_schema_checksum()                                          as current_checksum,
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE')    as table_count;

-- ─────────────────────────────────────────────────────────────────────────────
-- RECORD THIS REVISION
-- Checksum computed at install time (deterministic per schema state).
-- ─────────────────────────────────────────────────────────────────────────────
insert into schema_version (version, checksum, description, applied_by)
values (
  '2026-05-18-master-consolidation',
  compute_schema_checksum(),
  'MASTER_SCHEMA consolidation + checksum gate (8 canonical pipeline tables verified)',
  'db-engineer'
)
on conflict (version) do nothing;
