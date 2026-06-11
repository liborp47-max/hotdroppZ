-- ═══════════════════════════════════════════════════════════════
-- HDCC — HotDroppZ Control Centrum
-- Supabase PostgreSQL Schema + RLS Policies
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ───────────────────────────────────────────
-- PROFILES (extends Supabase auth.users)
-- ───────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Auto-create profile on signup
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

-- ───────────────────────────────────────────
-- SCOUT ITEMS — raw content from scouting
-- ───────────────────────────────────────────
create table if not exists scout_items (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,
  url          text,
  title        text not null,
  raw_content  text,
  category     text,
  language     text default 'cs',
  status       text not null default 'new'
               check (status in ('new', 'queued', 'discarded')),
  created_at   timestamptz default now()
);

create index if not exists idx_scout_items_status    on scout_items(status);
create index if not exists idx_scout_items_created   on scout_items(created_at desc);
create index if not exists idx_scout_items_category  on scout_items(category);

-- ───────────────────────────────────────────
-- CURATED ITEMS — after AI scoring
-- ───────────────────────────────────────────
create table if not exists curated_items (
  id              uuid primary key default gen_random_uuid(),
  scout_item_id   uuid references scout_items(id) on delete set null,
  score           integer check (score between 0 and 100),
  category        text,
  tags            text[] default '{}',
  reasoning       text,
  status          text not null default 'pending'
                  check (status in ('pending', 'sent_to_writer', 'skipped')),
  created_at      timestamptz default now()
);

create index if not exists idx_curated_items_status  on curated_items(status);
create index if not exists idx_curated_items_score   on curated_items(score desc);

-- ───────────────────────────────────────────
-- POSTS — final content ready to publish
-- ───────────────────────────────────────────
create table if not exists posts (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  body           text,
  summary        text,
  image_url      text,
  embeds         jsonb not null default '[]',
  category       text,
  tags           text[] default '{}',
  source_url     text,
  source_name    text,
  ai_score       integer check (ai_score between 0 and 100),
  status         text not null default 'draft'
                 check (status in ('draft', 'approved', 'rejected', 'hold', 'published', 'archived')),
  published_at   timestamptz,
  scheduled_at   timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_posts_status         on posts(status);
create index if not exists idx_posts_created        on posts(created_at desc);
create index if not exists idx_posts_published      on posts(published_at desc);
create index if not exists idx_posts_category       on posts(category);
create index if not exists idx_posts_ai_score       on posts(ai_score desc);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_updated_at on posts;
create trigger posts_updated_at
  before update on posts
  for each row execute function update_updated_at();

-- ───────────────────────────────────────────
-- POST ANALYTICS — performance metrics
-- ───────────────────────────────────────────

-- ───────────────────────────────────────────
-- SCOUT SOURCES — zdroje pro scouting
-- ───────────────────────────────────────────
create table if not exists scout_sources (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  url       text not null unique,
  category  text,
  lang      text default 'cs',
  active    boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists idx_scout_sources_active on scout_sources(active);
create table if not exists post_analytics (
  id               uuid primary key default gen_random_uuid(),
  post_id          uuid not null references posts(id) on delete cascade,
  views            integer not null default 0,
  clicks           integer not null default 0,
  shares           integer not null default 0,
  engagement_rate  numeric(5, 2) not null default 0,
  recorded_at      timestamptz default now()
);

create index if not exists idx_post_analytics_post_id     on post_analytics(post_id);
create index if not exists idx_post_analytics_recorded_at on post_analytics(recorded_at desc);

-- ───────────────────────────────────────────
-- SCORING WEIGHTS — learning / AI tuning
-- ───────────────────────────────────────────
create table if not exists scoring_weights (
  id          uuid primary key default gen_random_uuid(),
  category    text not null unique,
  weight      numeric(4, 2) not null default 1.0 check (weight >= 0 and weight <= 2),
  reason      text,
  updated_at  timestamptz default now()
);

-- Seed default weights — categories must match scout_sources and curator
insert into scoring_weights (category, weight, reason) values
  ('rap_core',    1.00, 'Core content — highest priority'),
  ('drama',       0.90, 'High engagement driver'),
  ('culture',     0.85, 'Brand identity'),
  ('fashion',     0.75, 'Visual appeal'),
  ('global_news', 0.60, 'Context layer'),
  ('science',     0.50, 'Context layer')
on conflict (category) do nothing;

-- ───────────────────────────────────────────
-- AD CAMPAIGNS
-- ───────────────────────────────────────────
create table if not exists ad_campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  client      text,
  budget      numeric(12, 2),
  start_date  date,
  end_date    date,
  active      boolean not null default true,
  created_at  timestamptz default now()
);

create index if not exists idx_ad_campaigns_active on ad_campaigns(active);

-- ───────────────────────────────────────────
-- AD SLOTS — placement positions
-- ───────────────────────────────────────────
create table if not exists ad_slots (
  id           uuid primary key default gen_random_uuid(),
  position     text not null,
  type         text check (type in ('banner', 'native', 'interstitial')),
  campaign_id  uuid references ad_campaigns(id) on delete set null,
  active       boolean not null default true
);

create index if not exists idx_ad_slots_active      on ad_slots(active);
create index if not exists idx_ad_slots_campaign_id on ad_slots(campaign_id);

-- Seed default ad slots
insert into ad_slots (position, type, active) values
  ('feed-top',        'banner',       false),
  ('feed-inline',     'native',       false),
  ('article-top',     'banner',       false),
  ('article-bottom',  'native',       false),
  ('sidebar',         'banner',       false),
  ('breaking-bar',    'banner',       false)
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

alter table profiles        enable row level security;
alter table scout_items     enable row level security;
alter table curated_items   enable row level security;
alter table posts            enable row level security;
alter table post_analytics  enable row level security;
alter table scoring_weights enable row level security;
alter table ad_campaigns    enable row level security;
alter table ad_slots        enable row level security;

-- Helper: get current user role
create or replace function get_user_role()
returns text language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

-- ── profiles ────────────────────────────────
drop policy if exists "profiles: users can read own profile" on profiles;
create policy "profiles: users can read own profile"
  on profiles for select using (id = auth.uid());

drop policy if exists "profiles: admins can read all" on profiles;
create policy "profiles: admins can read all"
  on profiles for select using (get_user_role() = 'admin');

drop policy if exists "profiles: users can update own profile" on profiles;
create policy "profiles: users can update own profile"
  on profiles for update using (id = auth.uid());

-- ── scout_items ─────────────────────────────
drop policy if exists "scout_items: authenticated users can read" on scout_items;
create policy "scout_items: authenticated users can read"
  on scout_items for select using (auth.role() = 'authenticated');

drop policy if exists "scout_items: editors and admins can insert" on scout_items;
create policy "scout_items: editors and admins can insert"
  on scout_items for insert with check (get_user_role() in ('admin', 'editor'));

drop policy if exists "scout_items: editors and admins can update" on scout_items;
create policy "scout_items: editors and admins can update"
  on scout_items for update using (get_user_role() in ('admin', 'editor'));

drop policy if exists "scout_items: admins can delete" on scout_items;
create policy "scout_items: admins can delete"
  on scout_items for delete using (get_user_role() = 'admin');

-- ── curated_items ────────────────────────────
drop policy if exists "curated_items: authenticated users can read" on curated_items;
create policy "curated_items: authenticated users can read"
  on curated_items for select using (auth.role() = 'authenticated');

drop policy if exists "curated_items: editors and admins can insert" on curated_items;
create policy "curated_items: editors and admins can insert"
  on curated_items for insert with check (get_user_role() in ('admin', 'editor'));

drop policy if exists "curated_items: editors and admins can update" on curated_items;
create policy "curated_items: editors and admins can update"
  on curated_items for update using (get_user_role() in ('admin', 'editor'));

drop policy if exists "curated_items: admins can delete" on curated_items;
create policy "curated_items: admins can delete"
  on curated_items for delete using (get_user_role() = 'admin');

-- ── posts ────────────────────────────────────
drop policy if exists "posts: authenticated users can read" on posts;
create policy "posts: authenticated users can read"
  on posts for select using (auth.role() = 'authenticated');

drop policy if exists "posts: editors and admins can insert" on posts;
create policy "posts: editors and admins can insert"
  on posts for insert with check (get_user_role() in ('admin', 'editor'));

drop policy if exists "posts: editors and admins can update" on posts;
create policy "posts: editors and admins can update"
  on posts for update using (get_user_role() in ('admin', 'editor'));

drop policy if exists "posts: admins can delete" on posts;
create policy "posts: admins can delete"
  on posts for delete using (get_user_role() = 'admin');

-- ── post_analytics ───────────────────────────
drop policy if exists "post_analytics: authenticated users can read" on post_analytics;
create policy "post_analytics: authenticated users can read"
  on post_analytics for select using (auth.role() = 'authenticated');

drop policy if exists "post_analytics: editors and admins can insert" on post_analytics;
create policy "post_analytics: editors and admins can insert"
  on post_analytics for insert with check (get_user_role() in ('admin', 'editor'));

-- ── scoring_weights ──────────────────────────
drop policy if exists "scoring_weights: authenticated users can read" on scoring_weights;
create policy "scoring_weights: authenticated users can read"
  on scoring_weights for select using (auth.role() = 'authenticated');

drop policy if exists "scoring_weights: admins and editors can modify" on scoring_weights;
create policy "scoring_weights: admins and editors can modify"
  on scoring_weights for all using (get_user_role() in ('admin', 'editor'));

-- ── ad_campaigns ─────────────────────────────
drop policy if exists "ad_campaigns: authenticated users can read" on ad_campaigns;
create policy "ad_campaigns: authenticated users can read"
  on ad_campaigns for select using (auth.role() = 'authenticated');

drop policy if exists "ad_campaigns: admins can modify" on ad_campaigns;
create policy "ad_campaigns: admins can modify"
  on ad_campaigns for all using (get_user_role() = 'admin');

-- ── ad_slots ─────────────────────────────────
drop policy if exists "ad_slots: authenticated users can read" on ad_slots;
create policy "ad_slots: authenticated users can read"
  on ad_slots for select using (auth.role() = 'authenticated');

drop policy if exists "ad_slots: admins can modify" on ad_slots;
create policy "ad_slots: admins can modify"
  on ad_slots for all using (get_user_role() = 'admin');

-- ═══════════════════════════════════════════════════════════════
-- REALTIME — enable for live dashboard updates
-- ═══════════════════════════════════════════════════════════════
do $$ begin
  alter publication supabase_realtime add table posts;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table scout_items;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table curated_items;
exception when duplicate_object then null; end $$;
