-- ============================================================
-- MIGRACE: artist_history
-- Historie vydaných projektů (alba, singly, EP, mixtapy, produkty)
-- ============================================================

create table if not exists artist_history (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  title text not null,
  type text not null check (type in ('album','single','ep','mixtape','produkt','video','project')),
  release_date date,
  platform text, -- např. 'spotify', 'apple_music', 'youtube', 'soundcloud', 'bandcamp', 'produkt'
  url text,
  thumbnail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_artist_history_artist on artist_history(artist_id, release_date desc);
create index if not exists idx_artist_history_type on artist_history(type);
