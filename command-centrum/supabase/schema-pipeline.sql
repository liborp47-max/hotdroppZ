-- HOTDROPPZ CONTROL CENTER
-- Pipeline migration: SCOUT -> CURATOR -> WRITER
-- Run AFTER schema.sql and schema-scout.sql

-- scout_items additions for pipeline state
alter table if exists scout_items
  add column if not exists content text,
  add column if not exists published_at timestamptz,
  add column if not exists attention_score double precision;

update scout_items
set content = coalesce(content, raw_content)
where content is null;

update scout_items
set status = case
  when status = 'new' then 'SCOUTED'
  when status = 'queued' then 'CURATED'
  else status
end
where status in ('new', 'queued');

alter table if exists scout_items
  alter column status set default 'SCOUTED';

alter table if exists scout_items
  drop constraint if exists scout_items_status_check;

alter table if exists scout_items
  add constraint scout_items_status_check
  check (status in ('SCOUTED', 'CURATED', 'CLUSTERED', 'WRITTEN', 'discarded'));

with ranked as (
  select
    ctid,
    row_number() over (
      partition by url
      order by created_at desc nulls last, id desc
    ) as row_num
  from scout_items
  where url is not null
)
update scout_items as s
set url = null
from ranked
where s.ctid = ranked.ctid
  and ranked.row_num > 1;

create unique index if not exists idx_scout_items_url_unique
  on scout_items(url)
  where url is not null;

create index if not exists idx_scout_items_attention_score
  on scout_items(attention_score desc);

create index if not exists idx_scout_items_published_at
  on scout_items(published_at desc);

-- Feed-ready writer output
create table if not exists feed_posts (
  id            uuid primary key default gen_random_uuid(),
  scout_item_id uuid not null references scout_items(id) on delete cascade,
  type          text not null check (type in ('track', 'album', 'video_release', 'event')),
  title         text not null,
  content       text not null,
  artist        text,
  spotify_url   text,
  youtube_url   text,
  genius_url    text,
  image_url     text,
  created_at    timestamptz not null default now()
);

create unique index if not exists idx_feed_posts_scout_item_id
  on feed_posts(scout_item_id);

create index if not exists idx_feed_posts_created_at
  on feed_posts(created_at desc);

create index if not exists idx_feed_posts_type
  on feed_posts(type);

alter table if exists feed_posts enable row level security;

drop policy if exists "feed_posts: authenticated users can read" on feed_posts;
create policy "feed_posts: authenticated users can read"
  on feed_posts for select using (auth.role() = 'authenticated');

drop policy if exists "feed_posts: editors and admins can insert" on feed_posts;
create policy "feed_posts: editors and admins can insert"
  on feed_posts for insert with check (get_user_role() in ('admin', 'editor'));

drop policy if exists "feed_posts: editors and admins can update" on feed_posts;
create policy "feed_posts: editors and admins can update"
  on feed_posts for update using (get_user_role() in ('admin', 'editor'));

drop policy if exists "feed_posts: admins can delete" on feed_posts;
create policy "feed_posts: admins can delete"
  on feed_posts for delete using (get_user_role() = 'admin');

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feed_posts'
  ) then
    alter publication supabase_realtime add table feed_posts;
  end if;
exception
  when undefined_table then null;
  when undefined_object then null;
end $$;
