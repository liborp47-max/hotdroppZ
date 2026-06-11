-- ═══════════════════════════════════════════════════════════════════════════════
-- POST MONETIZATION — Schema
-- AI-powered monetization scoring for published posts.
-- Safe to re-run (fully idempotent).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── post_monetization table ──────────────────────────────────────────────────

create table if not exists post_monetization (
  id              uuid        primary key default gen_random_uuid(),
  post_id         uuid        not null unique references posts(id) on delete cascade,
  ad_categories   text[]      not null default '{}',
  premium_score   smallint    not null default 0 check (premium_score >= 0 and premium_score <= 10),
  affiliate_hints text[]      not null default '{}',
  trending_boost  boolean     not null default false,
  sponsored_fit   text[]      not null default '{}',
  revenue_tier    text        not null default 'low' check (revenue_tier in ('low','medium','high','premium')),
  scored_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Indexes for dashboard queries
create index if not exists idx_post_monetization_post_id       on post_monetization (post_id);
create index if not exists idx_post_monetization_revenue_tier  on post_monetization (revenue_tier);
create index if not exists idx_post_monetization_premium_score on post_monetization (premium_score desc);
create index if not exists idx_post_monetization_trending       on post_monetization (trending_boost) where trending_boost = true;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table post_monetization enable row level security;

-- Admins + editors can read all
create policy "admin_editor_read_monetization"
  on post_monetization for select
  using (get_user_role() in ('admin', 'editor'));

-- Only admins can write (pipeline uses service role / admin client)
create policy "admin_write_monetization"
  on post_monetization for all
  using (get_user_role() = 'admin');

-- ─── Helper view: posts with monetization data ────────────────────────────────

create or replace view posts_with_monetization as
select
  p.id,
  p.title,
  p.short_text,
  p.category,
  p.tags,
  p.ai_score,
  p.status,
  p.published_at,
  pm.revenue_tier,
  pm.premium_score,
  pm.trending_boost,
  pm.ad_categories,
  pm.affiliate_hints,
  pm.sponsored_fit,
  pm.scored_at
from posts p
left join post_monetization pm on p.id = pm.post_id
where p.status in ('approved', 'published');

-- ─── Revenue summary view ─────────────────────────────────────────────────────

create or replace view monetization_summary as
select
  revenue_tier,
  count(*) as post_count,
  avg(premium_score)::numeric(4,2) as avg_premium_score,
  count(*) filter (where trending_boost = true) as trending_count
from post_monetization
group by revenue_tier
order by
  case revenue_tier
    when 'premium' then 1
    when 'high'    then 2
    when 'medium'  then 3
    when 'low'     then 4
  end;
