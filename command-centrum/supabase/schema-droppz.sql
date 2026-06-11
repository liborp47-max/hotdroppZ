-- ═══════════════════════════════════════════════════════════════
-- HDCC — DROPPZ Multi-Layer System Migration
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. New columns on scout_items ───────────────────────────────
alter table scout_items add column if not exists priority      text    default 'P3';
alter table scout_items add column if not exists is_release    boolean not null default false;
alter table scout_items add column if not exists release_type  text;

create index if not exists idx_scout_items_priority    on scout_items(priority);
create index if not exists idx_scout_items_is_release  on scout_items(is_release) where is_release = true;

-- ── 2. Expand scout_sources category constraint ─────────────────
alter table scout_sources drop constraint if exists scout_sources_category_check;
alter table scout_sources add constraint scout_sources_category_check
  check (category in ('droppz_news','rap_core','deep_scout','drama','fashion','global_news','culture','science'));

-- ── 3. Seed new sources ─────────────────────────────────────────
insert into scout_sources (name, url, category, lang, active) values
  -- 🟣 DROPPZ NEWS (P0)
  ('Billboard',           'https://www.billboard.com/feed/',                  'droppz_news', 'en-us', true),
  ('HipHopDX Releases',   'https://hiphopdx.com/rss',                         'droppz_news', 'en-us', true),
  ('Rap-Up',              'https://www.rap-up.com/feed/',                     'droppz_news', 'en-us', true),
  ('Rolling Stone Music', 'https://www.rollingstone.com/music/feed/',          'droppz_news', 'en-us', true),
  ('Pitchfork News',      'https://pitchfork.com/rss/news/',                  'droppz_news', 'en-us', true),
  -- 🔴 RAP CORE additions
  ('Vibe',                'https://www.vibe.com/feed',                        'rap_core',    'en-us', true),
  ('Stereogum Hip-Hop',   'https://www.stereogum.com/category/hip-hop/feed/', 'rap_core',    'en-us', true),
  ('Consequence',         'https://consequence.net/feed/',                    'rap_core',    'en-us', true),
  -- 🟠 DRAMA additions
  ('HipHopHeads',         'https://www.reddit.com/r/hiphopheads/.rss',        'drama',       'en-us', true),
  ('PopCultureChat',      'https://www.reddit.com/r/PopCultureChat/.rss',     'drama',       'en-us', true),
  ('Daily Mail US',       'https://www.dailymail.co.uk/ushome/index.rss',     'drama',       'en-us', true),
  -- 🟡 FASHION additions
  ('Vogue',               'https://www.vogue.com/feed',                       'fashion',     'global', true),
  ('GQ',                  'https://www.gq.com/feed',                          'fashion',     'global', true),
  ('Business of Fashion', 'https://www.businessoffashion.com/rss',            'fashion',     'global', true),
  ('Complex Style',       'https://www.complex.com/style/rss',                'fashion',     'en-us', true),
  -- 🟢 GLOBAL NEWS additions
  ('Al Jazeera',          'https://www.aljazeera.com/xml/rss/all.xml',        'global_news', 'global', true),
  ('France 24',           'https://www.france24.com/en/rss',                  'global_news', 'global', true),
  ('Euronews',            'https://www.euronews.com/rss',                     'global_news', 'global', true),
  ('NPR',                 'https://www.npr.org/rss/rss.php?id=1001',          'global_news', 'en-us', true),
  ('The Guardian World',  'https://www.theguardian.com/world/rss',            'global_news', 'en-us', true),
  ('CNN',                 'https://rss.cnn.com/rss/edition.rss',              'global_news', 'en-us', true),
  -- 🔬 SCIENCE additions
  ('Wired Science',       'https://www.wired.com/feed/category/science/latest/rss', 'science', 'global', true),
  -- 🔵 CULTURE additions
  ('Reddit Memes',        'https://www.reddit.com/r/memes/.rss',              'culture',     'en-us', true),
  ('Reddit DankMemes',    'https://www.reddit.com/r/dankmemes/.rss',          'culture',     'en-us', true),
  ('Know Your Meme',      'https://knowyourmeme.com/rss',                     'culture',     'en-us', true),
  ('The Poke',            'https://www.thepoke.co.uk/feed/',                  'culture',     'en-gb', true),
  ('Upworthy',            'https://www.upworthy.com/feed',                    'culture',     'en-us', true),
  ('BuzzFeed',            'https://www.buzzfeed.com/world.xml',               'culture',     'en-us', true),
  -- 🧠 DEEP SCOUT (P1 Intel)
  ('Pitchfork Reviews',   'https://pitchfork.com/rss/reviews/albums/',        'deep_scout',  'en-us', true),
  ('Stereogum',           'https://www.stereogum.com/feed/',                  'deep_scout',  'en-us', true),
  ('Reddit IIB',          'https://www.reddit.com/r/InternetIsBeautiful/.rss','deep_scout',  'en-us', true)
on conflict (url) do update set
  category = excluded.category,
  active   = excluded.active;

-- ── 4. Seed scoring weights for new categories ──────────────────
insert into scoring_weights (category, weight, reason) values
  ('droppz_news', 1.20, 'Highest priority — official releases'),
  ('deep_scout',  0.80, 'Intel / critical reviews')
on conflict (category) do nothing;
