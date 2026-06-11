-- ═══════════════════════════════════════════════════════════════════════════════
-- HOTDROPPZ — AI IMAGE MATCHING ENGINE
-- Semantic image selection using CLIP embeddings
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ARTICLE EMBEDDINGS — cache text embeddings for articles
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists article_embeddings (
  article_id        uuid primary key references posts(id) on delete cascade,
  embedding         vector(512) not null,  -- CLIP text embedding (512-dim)
  title             text not null,
  main_entity       text,
  category          text,
  content_hash      text,                  -- SHA256 of content for change detection
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Index for similarity search (cosine distance)
create index if not exists idx_article_embeddings_vector
  on article_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index for fast lookup by article
create unique index if not exists idx_article_embeddings_article_id
  on article_embeddings(article_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. IMAGE EMBEDDINGS — cache image embeddings from various sources
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists image_embeddings (
  id            uuid primary key default gen_random_uuid(),
  image_url     text not null,
  source        text not null check (source in ('spotify','youtube','unsplash','pexels','pixabay','wikimedia')),
  embedding     vector(512) not null,  -- CLIP image embedding
  caption       text,                  -- alt text / description if available
  author        text,                  -- photographer / artist
  license       text,                  -- license type (cc-by, etc.)
  width         integer,
  height        integer,
  color         text,                  -- dominant color hex
  fetched_at    timestamptz not null default now(),
  
  -- Ensure unique per URL (same image from same source)
  unique(image_url, source)
);

-- Index for similarity search
create index if not exists idx_image_embeddings_vector
  on image_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists idx_image_embeddings_source
  on image_embeddings(source, fetched_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ARTICLE IMAGES — selected image per article with alternatives
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists article_images (
  article_id        uuid primary key references posts(id) on delete cascade,
  best_image_url    text not null,
  best_source       text not null check (source in ('spotify','youtube','unsplash','pexels','pixabay','wikimedia','manual')),
  best_score        numeric(4,3) not null default 0,  -- similarity score 0-1
  
  -- Top 3 alternatives (JSON array of {url, source, score})
  alternatives      jsonb not null default '[]',
  
  -- Metadata
  selected_by       text not null default 'ai' check (selected_by in ('ai','manual','fallback')),
  selected_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Index for lookups
create index if not exists idx_article_images_article_id
  on article_images(article_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. IMAGE CANDIDATES — raw candidates before selection (for audit/re-scoring)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists image_candidates (
  id            uuid primary key default gen_random_uuid(),
  article_id    uuid references posts(id) on delete cascade,
  image_url     text not null,
  source        text not null,
  score         numeric(4,3) not null,  -- computed similarity
  embedding_id  uuid references image_embeddings(id) on delete set null,
  fetched_at    timestamptz not null default now(),
  
  -- Keep top N per article (e.g., 10)
  unique(article_id, image_url)
);

-- Index for candidate retrieval
create index if not exists idx_image_candidates_article
  on image_candidates(article_id, score desc);

create index if not exists idx_image_candidates_source
  on image_candidates(source);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. FUNCTIONS — embedding generation & similarity search
-- ─────────────────────────────────────────────────────────────────────────────

-- Generate article embedding from text (title + main_entity + excerpt)
-- This would be called by an external service (Python with CLIP)
create or replace function embed_article(
  p_title       text,
  p_main_entity text,
  p_category    text,
  p_content     text
) returns vector(512) language sql immutable as $$
  -- Placeholder: actual embedding generation happens in service
  -- In practice, this would call an edge function that uses CLIP
  select null::vector(512);
$$;

-- Search best image for article using precomputed embeddings
create or replace function find_best_image_for_article(
  p_article_id uuid,
  p_limit      integer default 10,
  p_min_width  integer default 400,
  p_min_height integer default 300
) returns table (
  image_url     text,
  source        text,
  score         numeric(4,3),
  rank          integer,
  embedding_id  uuid
) language sql stable as $$
  with article_emb as (
    select embedding
    from article_embeddings
    where article_id = p_article_id
  ),
  candidates as (
    select
      ie.image_url,
      ie.source,
      ie.id as embedding_id,
      1 - (ie.embedding <=> ae.embedding) as similarity_score  -- cosine distance → similarity
    from image_embeddings ie
    cross join article_emb ae
    where ie.width >= p_min_width
      and ie.height >= p_min_height
      and ie.embedding is not null
  )
  select
    image_url,
    source,
    similarity_score as score,
    row_number() over (order by similarity_score desc) as rank,
    embedding_id
  from candidates
  order by similarity_score desc
  limit p_limit;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  alter publication supabase_realtime add table article_embeddings;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table image_embeddings;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table article_images;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table image_candidates;
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────────

alter table article_embeddings enable row level security;
alter table image_embeddings enable row level security;
alter table article_images enable row level security;
alter table image_candidates enable row level security;

-- article_embeddings: read/write for authenticated
drop policy if exists "article_embeddings: read" on article_embeddings;
drop policy if exists "article_embeddings: write" on article_embeddings;
create policy "article_embeddings: read" on article_embeddings
  for select using (auth.role() = 'authenticated');
create policy "article_embeddings: write" on article_embeddings
  for all using (get_user_role() in ('admin','service'));

-- image_embeddings: read/write for service role, read for authenticated
drop policy if exists "image_embeddings: read" on image_embeddings;
drop policy if exists "image_embeddings: write" on image_embeddings;
create policy "image_embeddings: read" on image_embeddings
  for select using (auth.role() = 'authenticated');
create policy "image_embeddings: write" on image_embeddings
  for all using (get_user_role() in ('admin','service'));

-- article_images: read for authenticated, write for admin/editor
drop policy if exists "article_images: read" on article_images;
drop policy if exists "article_images: write" on article_images;
create policy "article_images: read" on article_images
  for select using (auth.role() = 'authenticated');
create policy "article_images: write" on article_images
  for all using (get_user_role() in ('admin','editor'));

-- image_candidates: read/write for service, read for authenticated
drop policy if exists "image_candidates: read" on image_candidates;
drop policy if exists "image_candidates: write" on image_candidates;
create policy "image_candidates: read" on image_candidates
  for select using (auth.role() = 'authenticated');
create policy "image_candidates: write" on image_candidates
  for all using (get_user_role() in ('admin','service'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TRIGGERS — auto-update timestamps
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function update_article_embeddings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists article_embeddings_set_updated_at on article_embeddings;
create trigger article_embeddings_set_updated_at
  before update on article_embeddings
  for each row execute function update_article_embeddings_updated_at();

create or replace function update_article_images_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists article_images_set_updated_at on article_images;
create trigger article_images_set_updated_at
  before update on article_images
  for each row execute function update_article_images_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables:      article_embeddings, image_embeddings, article_images, image_candidates
-- Functions:   embed_article (placeholder), find_best_image_for_article
-- Indexes:     IVFFLAT for vector similarity search (cosine)
-- RLS:         service role can write, authenticated can read
-- ─────────────────────────────────────────────────────────────────────────────
