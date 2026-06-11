-- Fix 1: Expand scout_sources lang constraint to include all supported languages
-- Adds: ru (Russian), sr (Serbian), sq (Albanian), bs (Bosnian), hr (Croatian)

alter table scout_sources drop constraint if exists scout_sources_lang_check;
alter table scout_sources add constraint scout_sources_lang_check
  check (lang in (
    'cs','sk','de','fr','pl','it','es','nl','se',
    'ru','sr','sq','bs','hr',
    'en-gb','en-us','global'
  ));

-- Fix 2: Update Refresher CZ to rap_core (was mistakenly 'culture')
update scout_sources
  set category = 'rap_core'
  where url = 'https://refresher.cz/rss';

-- Fix 3: Replace dead/broken sources with working alternatives
-- Genius News → Spin Magazine
update scout_sources
  set name = 'Spin Magazine', url = 'https://spin.com/feed/'
  where url = 'https://genius.com/news/rss';

-- Rap Radar → Pigeons & Planes
update scout_sources
  set name = 'Pigeons & Planes', url = 'https://pigeonsandplanes.com/feed/'
  where url = 'https://rapradar.com/feed';

-- WorldStar → Uproxx Music
update scout_sources
  set name = 'Uproxx Music', url = 'https://uproxx.com/music/feed/'
  where url = 'https://worldstarhiphop.com/rss';

-- BuzzFeed world.xml → The Root
update scout_sources
  set name = 'The Root', url = 'https://theroot.com/rss'
  where url = 'https://www.buzzfeed.com/world.xml';

-- Business of Fashion → Fashionista
update scout_sources
  set name = 'Fashionista', url = 'https://fashionista.com/feed'
  where url = 'https://www.businessoffashion.com/rss';

-- Bild DE duplicate → Musikexpress DE
update scout_sources
  set name = 'Musikexpress DE', url = 'https://www.musikexpress.de/feed/', category = 'rap_core'
  where url = 'https://www.bild.de/rss'
    and category = 'drama'
    and lang = 'de';

-- Fix 4: Insert Global Matrix sources that were missing from the initial install
insert into scout_sources (name, url, category, lang, active) values
  ('Rapzname CZ',    'https://rapzname.cz/feed',               'rap_core', 'cs', true),
  ('iReport CZ',     'https://www.ireport.cz/rss',             'fashion',  'cs', true),
  ('Raps.sk',        'https://raps.sk/feed',                   'rap_core', 'sk', true),
  ('Cas.sk',         'https://www.cas.sk/rss',                 'drama',    'sk', true),
  ('Rapologia IT',   'https://www.rapologia.it/feed',          'rap_core', 'it', true),
  ('Gossip.it',      'https://www.gossip.it/rss',              'drama',    'it', true),
  ('HHGroups ES',    'https://www.hhgroups.com/rss',           'rap_core', 'es', true),
  ('20 Minutos ES',  'https://www.20minutos.es/rss',           'drama',    'es', true),
  ('Musikexpress DE','https://www.musikexpress.de/feed/',      'rap_core', 'de', true),
  ('Gala FR',        'https://www.gala.fr/rss',                'drama',    'fr', true),
  ('Puna NL',        'https://www.puna.nl/feed/',              'rap_core', 'nl', true),
  ('Telegraaf NL',   'https://www.telegraaf.nl/rss',           'drama',    'nl', true),
  ('Plotek PL',      'https://www.plotek.pl/rss',              'drama',    'pl', true),
  ('Daily Mail UK',  'https://www.dailymail.co.uk/articles.rss', 'drama',  'en-gb', true),
  ('The Flow RU',    'https://the-flow.ru/rss',                'rap_core', 'ru', true),
  ('Lenta RU',       'https://lenta.ru/rss',                   'drama',    'ru', true),
  ('Mondo RS',       'https://mondo.rs/rss',                   'rap_core', 'sr', true),
  ('Telegraf RS',    'https://telegraf.rs/rss',                'drama',    'sr', true),
  ('Top Channel AL', 'https://top-channel.tv/rss',             'rap_core', 'sq', true),
  ('Zeri AL',        'https://zeri.info/rss',                  'drama',    'sq', true),
  ('Klix BA',        'https://klix.ba/rss',                    'rap_core', 'bs', true),
  ('Avaz BA',        'https://avaz.ba/rss',                    'drama',    'bs', true),
  ('Index HR',       'https://www.index.hr/rss',               'rap_core', 'hr', true),
  ('24sata HR',      'https://www.24sata.hr/rss',              'drama',    'hr', true)
on conflict (url) do update set
  name     = excluded.name,
  category = excluded.category,
  lang     = excluded.lang,
  active   = excluded.active;
