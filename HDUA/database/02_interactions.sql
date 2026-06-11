-- HDUA-01 · 02 — User interactions (saves, likes, comments, views)
-- Drive personalization (HDUA-09) and analytics (HDUA-12). RLS owner-only for
-- writes; views are aggregated server-side so no public read needed here.
-- `post_id` is a free uuid referencing the content id surfaced by the Content
-- API (feed_posts.id or posts.id); not FK-constrained because content lives in
-- pipeline tables that may be re-projected.

create table if not exists hdua_saved_posts (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  post_id    uuid        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists hdua_liked_posts (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  post_id    uuid        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists hdua_comments (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  post_id    uuid        not null,
  body       text        not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_hdua_comments_post on hdua_comments(post_id, created_at desc);

-- Impression / view events — also feed scroll-depth + dwell (HDUA-09).
create table if not exists hdua_post_views (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete set null,
  post_id     uuid        not null,
  dwell_ms    integer,
  scroll_pct  integer,
  created_at  timestamptz not null default now()
);
create index if not exists idx_hdua_views_post on hdua_post_views(post_id, created_at desc);
create index if not exists idx_hdua_views_user on hdua_post_views(user_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table hdua_saved_posts enable row level security;
alter table hdua_liked_posts enable row level security;
alter table hdua_comments    enable row level security;
alter table hdua_post_views  enable row level security;

drop policy if exists hdua_saved_owner on hdua_saved_posts;
create policy hdua_saved_owner on hdua_saved_posts
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists hdua_liked_owner on hdua_liked_posts;
create policy hdua_liked_owner on hdua_liked_posts
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Comments: owner writes; everyone authenticated can read (social surface).
drop policy if exists hdua_comments_read on hdua_comments;
create policy hdua_comments_read on hdua_comments
  for select using (auth.role() = 'authenticated');
drop policy if exists hdua_comments_write on hdua_comments;
create policy hdua_comments_write on hdua_comments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists hdua_views_owner on hdua_post_views;
create policy hdua_views_owner on hdua_post_views
  using (auth.uid() = user_id) with check (auth.uid() = user_id or user_id is null);
