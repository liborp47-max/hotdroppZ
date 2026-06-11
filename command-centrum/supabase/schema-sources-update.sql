-- ============================================================
-- HotDroppZ — RSS Sources full reload
-- Run in Supabase SQL Editor
-- Replaces the entire scout_sources table with the verified,
-- deduplicated list from lib/scout-sources.ts (127 sources)
-- ============================================================

-- 1. Wipe existing rows (preserves table structure and constraints)
DELETE FROM scout_sources;

-- 2. Re-insert all verified sources
INSERT INTO scout_sources (name, url, category, lang, active) VALUES

-- ── DROPPZ NEWS (P0) ──────────────────────────────────────
('Billboard',           'https://www.billboard.com/feed/',                  'droppz_news', 'en-us', true),
('Rap-Up',              'https://www.rap-up.com/feed/',                     'droppz_news', 'en-us', true),
('HipHopDX',            'https://hiphopdx.com/rss',                         'droppz_news', 'en-us', true),
('Rolling Stone Music', 'https://www.rollingstone.com/music/feed/',          'droppz_news', 'en-us', true),
('Pitchfork News',      'https://pitchfork.com/rss/news/',                  'droppz_news', 'en-us', true),

-- ── RAP CORE (P1) — USA ───────────────────────────────────
('XXL',                 'https://www.xxlmag.com/feed/',                     'rap_core', 'en-us', true),
('Complex Music',       'https://www.complex.com/music/rss',                'rap_core', 'en-us', true),
('Vibe',                'https://www.vibe.com/feed/',                       'rap_core', 'en-us', true),
('AllHipHop',           'https://allhiphop.com/feed',                       'rap_core', 'en-us', true),
('The Source',          'https://thesource.com/feed',                       'rap_core', 'en-us', true),
('Spin Magazine',       'https://spin.com/feed/',                           'rap_core', 'en-us', true),
('Rapzilla',            'https://rapzilla.com/rss/',                        'rap_core', 'en-us', true),
('Karen Civil',         'https://www.karencivil.com/rss',                   'rap_core', 'en-us', true),

-- ── RAP CORE (P1) — UK ────────────────────────────────────
('GRM Daily',           'https://grmdaily.com/feed/',                       'rap_core', 'en-gb', true),
('NME Music',           'https://www.nme.com/feed/',                        'rap_core', 'en-gb', true),
('The Fader',           'https://www.thefader.com/feed/',                   'rap_core', 'en-gb', true),

-- ── RAP CORE (P1) — CZ ────────────────────────────────────
('Refresher CZ',        'https://refresher.cz/rss',                         'rap_core', 'cs',    true),
('Rap Revue',           'https://raprevue.cz/feed',                         'rap_core', 'cs',    true),
('HipHop.cz',           'https://hiphop.cz/feed',                           'rap_core', 'cs',    true),
('iRadio Beat CZ',      'https://iradiobeat.cz/rss',                        'rap_core', 'cs',    true),
('Rapzname CZ',         'https://rapzname.cz/feed',                         'rap_core', 'cs',    true),

-- ── RAP CORE (P1) — SK ────────────────────────────────────
('Refresher SK',        'https://refresher.sk/rss',                         'rap_core', 'sk',    true),
('Flow SK',             'https://flow.sk/feed',                             'rap_core', 'sk',    true),
('Raps.sk',             'https://raps.sk/feed',                             'rap_core', 'sk',    true),

-- ── RAP CORE (P1) — DE ────────────────────────────────────
('Backspin DE',         'https://backspin.de/feed',                         'rap_core', 'de',    true),
('HipHop.de',           'https://hiphop.de/rss',                            'rap_core', 'de',    true),
('Juice Magazine DE',   'https://juice.de/feed',                            'rap_core', 'de',    true),
('16BARS.de',           'https://16bars.de/feed',                           'rap_core', 'de',    true),
('Rap.de',              'https://rap.de/feed/',                             'rap_core', 'de',    true),
('Musikexpress DE',     'https://www.musikexpress.de/feed/',                'rap_core', 'de',    true),

-- ── RAP CORE (P1) — FR ────────────────────────────────────
('Booska-P',            'https://www.booska-p.com/rss',                     'rap_core', 'fr',    true),
('Abcdr du Son',        'https://www.abcdrduson.com/feed',                  'rap_core', 'fr',    true),
('Raplume FR',          'https://raplume.eu/feed',                          'rap_core', 'fr',    true),

-- ── RAP CORE (P1) — PL ────────────────────────────────────
('Popkiller PL',        'https://popkiller.pl/rss',                         'rap_core', 'pl',    true),
('WhiteHouse PL',       'https://whitehouse.com.pl/feed',                   'rap_core', 'pl',    true),
('HipHop Centrum PL',   'https://hiphopcen.pl/feed',                        'rap_core', 'pl',    true),

-- ── RAP CORE (P1) — IT ────────────────────────────────────
('HiphopTV IT',         'https://hiphoptv.it/feed',                         'rap_core', 'it',    true),
('Rapologia IT',        'https://www.rapologia.it/feed',                    'rap_core', 'it',    true),

-- ── RAP CORE (P1) — ES ────────────────────────────────────
('HipHop.es',           'https://hiphopes.es/feed',                         'rap_core', 'es',    true),
('HHGroups ES',         'https://www.hhgroups.com/rss',                     'rap_core', 'es',    true),

-- ── RAP CORE (P1) — NL ────────────────────────────────────
('FunX NL',             'https://www.funx.nl/rss',                          'rap_core', 'nl',    true),
('Puna NL',             'https://www.puna.nl/feed/',                        'rap_core', 'nl',    true),

-- ── RAP CORE (P1) — EU Regional ──────────────────────────
('The Flow RU',         'https://the-flow.ru/rss',                          'rap_core', 'ru',    true),
('Mondo RS',            'https://mondo.rs/rss',                             'rap_core', 'sr',    true),
('Top Channel AL',      'https://top-channel.tv/rss',                       'rap_core', 'sq',    true),
('Klix BA',             'https://klix.ba/rss',                              'rap_core', 'bs',    true),
('Index HR',            'https://www.index.hr/rss',                         'rap_core', 'hr',    true),

-- ── DRAMA (P2) ────────────────────────────────────────────
('TMZ',                 'https://www.tmz.com/rss.xml',                      'drama',    'en-us', true),
('Uproxx Music',        'https://uproxx.com/music/feed/',                   'drama',    'en-us', true),
('MediaTakeOut',        'https://mtonews.com/feed',                         'drama',    'en-us', true),
('Bossip',              'https://bossip.com/feed',                          'drama',    'en-us', true),
('The Shade Room',      'https://theshaderoom.com/feed',                    'drama',    'en-us', true),
('Reddit HipHopHeads',  'https://www.reddit.com/r/hiphopheads/.rss',        'drama',    'en-us', true),
('Reddit PopCulture',   'https://www.reddit.com/r/PopCultureChat/.rss',     'drama',    'en-us', true),
('Daily Mail US',       'https://www.dailymail.co.uk/ushome/index.rss',     'drama',    'en-us', true),
('Daily Mail UK',       'https://www.dailymail.co.uk/articles.rss',         'drama',    'en-gb', true),
('Blesk CZ',            'https://www.blesk.cz/rss',                         'drama',    'cs',    true),
('Pluska SK',           'https://www.pluska.sk/rss',                        'drama',    'sk',    true),
('Cas.sk',              'https://www.cas.sk/rss',                           'drama',    'sk',    true),
('Bild DE',             'https://www.bild.de/rssfeeds/vw-home/vw-home-16725546,feed=home.bild.html', 'drama', 'de', true),
('Closer FR',           'https://www.closermag.fr/rss',                     'drama',    'fr',    true),
('Gala FR',             'https://www.gala.fr/rss',                          'drama',    'fr',    true),
('Fakt PL',             'https://www.fakt.pl/rss',                          'drama',    'pl',    true),
('Plotek PL',           'https://www.plotek.pl/rss',                        'drama',    'pl',    true),
('Chi IT',              'https://www.chimagazine.it/rss',                   'drama',    'it',    true),
('Gossip.it',           'https://www.gossip.it/rss',                        'drama',    'it',    true),
('20 Minutos ES',       'https://www.20minutos.es/rss',                     'drama',    'es',    true),
('Telegraaf NL',        'https://www.telegraaf.nl/rss',                     'drama',    'nl',    true),
('Lenta RU',            'https://lenta.ru/rss',                             'drama',    'ru',    true),
('Telegraf RS',         'https://telegraf.rs/rss',                          'drama',    'sr',    true),
('Zeri AL',             'https://zeri.info/rss',                            'drama',    'sq',    true),
('Avaz BA',             'https://avaz.ba/rss',                              'drama',    'bs',    true),
('24sata HR',           'https://www.24sata.hr/rss',                        'drama',    'hr',    true),

-- ── FASHION (P2) ──────────────────────────────────────────
('Hypebeast',           'https://hypebeast.com/feed',                       'fashion',  'global',true),
('Highsnobiety',        'https://www.highsnobiety.com/feed',                'fashion',  'global',true),
('Sneaker News',        'https://sneakernews.com/feed/',                    'fashion',  'global',true),
('Nice Kicks',          'https://www.nicekicks.com/feed/',                  'fashion',  'global',true),
('Kicks On Fire',       'https://www.kicksonfire.com/feed',                 'fashion',  'global',true),
('Vogue',               'https://www.vogue.com/feed/',                      'fashion',  'global',true),
('GQ Global',           'https://www.gq.com/feed/rss',                      'fashion',  'global',true),
('GQ UK',               'https://www.gq-magazine.co.uk/feed/rss',           'fashion',  'en-gb', true),
('Fashionista',         'https://fashionista.com/feed',                     'fashion',  'global',true),
('Complex Style',       'https://www.complex.com/style/rss',                'fashion',  'en-us', true),
('Hype.cz',             'https://hype.cz/feed',                             'fashion',  'cs',    true),
('Street Machine CZ',   'https://streetmachine.cz/feed',                    'fashion',  'cs',    true),
('iReport CZ',          'https://www.ireport.cz/rss',                       'fashion',  'cs',    true),

-- ── GLOBAL NEWS (P3) ──────────────────────────────────────
('BBC News',            'https://feeds.bbci.co.uk/news/rss.xml',            'global_news','global',true),
('BBC UK',              'https://www.bbc.co.uk/news/uk/rss.xml',            'global_news','en-gb', true),
('Al Jazeera',          'https://www.aljazeera.com/xml/rss/all.xml',        'global_news','global',true),
('France 24',           'https://www.france24.com/en/rss',                  'global_news','global',true),
('Euronews',            'https://www.euronews.com/rss',                     'global_news','global',true),
('NPR News',            'https://www.npr.org/rss/rss.php?id=1001',          'global_news','en-us', true),
('The Guardian World',  'https://www.theguardian.com/world/rss',            'global_news','en-us', true),
('The Guardian UK',     'https://www.theguardian.com/uk/rss',               'global_news','en-gb', true),
('The Verge',           'https://www.theverge.com/rss/index.xml',           'global_news','en-us', true),
('CoinDesk',            'https://www.coindesk.com/arc/outboundfeeds/rss/',  'global_news','global',true),
('The Standard UK',     'https://www.standard.co.uk/rss',                   'global_news','en-gb', true),
('The Independent',     'https://www.independent.co.uk/rss',                'global_news','en-gb', true),
('Novinky.cz',          'https://www.novinky.cz/rss',                       'global_news','cs',    true),
('iDNES.cz',            'https://servis.idnes.cz/rss.aspx?c=zpravodaj',     'global_news','cs',    true),
('Pravda SK',           'https://spravy.pravda.sk/rss',                     'global_news','sk',    true),
('Spiegel',             'https://www.spiegel.de/international/index.rss',   'global_news','de',    true),
('Le Monde',            'https://www.lemonde.fr/rss/une.xml',               'global_news','fr',    true),
('Gazeta Wyborcza',     'https://wyborcza.pl/pub/rss/wyborcza.xml',         'global_news','pl',    true),
('Corriere della Sera', 'https://rss.corriere.it/rss/homepage.xml',         'global_news','it',    true),

-- ── CULTURE (P3) ──────────────────────────────────────────
('The Root',            'https://theroot.com/rss',                          'culture',  'en-us', true),
('DJBooth',             'https://djbooth.net/rss',                          'culture',  'en-us', true),
('Consequence',         'https://consequence.net/feed/',                    'culture',  'en-us', true),
('Upworthy',            'https://www.upworthy.com/feed',                    'culture',  'en-us', true),
('The Nation',          'https://www.thenation.com/feed/',                  'culture',  'en-us', true),
('Reddit Memes',        'https://www.reddit.com/r/memes/.rss',              'culture',  'en-us', true),
('Reddit DankMemes',    'https://www.reddit.com/r/dankmemes/.rss',          'culture',  'en-us', true),
('Know Your Meme',      'https://knowyourmeme.com/rss',                     'culture',  'en-us', true),
('The Poke UK',         'https://www.thepoke.co.uk/feed/',                  'culture',  'en-gb', true),
('Reddit CasualUK',     'https://www.reddit.com/r/CasualUK/.rss',           'culture',  'en-gb', true),
('Reddit UK Drill',     'https://www.reddit.com/r/ukdrill/.rss',            'culture',  'en-gb', true),
('Reddit Grime',        'https://www.reddit.com/r/grime/.rss',              'culture',  'en-gb', true),
('Musicserver CZ',      'https://musicserver.cz/rss',                       'culture',  'cs',    true),
('Reflex CZ',           'https://www.reflex.cz/rss',                        'culture',  'cs',    true),
('Kapital SK',          'https://kapital.sk/rss',                           'culture',  'sk',    true),
('Život SK',            'https://zivot.pluska.sk/rss',                      'culture',  'sk',    true),
('MZEE.com DE',         'https://mzee.com/magazine/feed',                   'culture',  'de',    true),
('Focus DE',            'https://www.focus.de/feeds/rss/gesellschaft',      'culture',  'de',    true),
('Yard FR',             'https://www.yard.live/feed',                       'culture',  'fr',    true),
('GEO FR',              'https://www.geo.fr/rss',                           'culture',  'fr',    true),
('AllMusic Italia',     'https://allmusicitalia.it/feed',                   'culture',  'it',    true),
('Rockit IT',           'https://www.rockit.it/feed',                       'culture',  'it',    true),
('Bass Culture ES',     'https://bassculturemagazine.com/feed',             'culture',  'es',    true),
('3voor12 NL',          'https://3voor12.vpro.nl/rss',                      'culture',  'nl',    true),
('Gaffa SE',            'https://gaffa.se/rss',                             'culture',  'se',    true),
('National Geo PL',     'https://www.national-geographic.pl/rss',           'culture',  'pl',    true),

-- ── SCIENCE / TECH (P3) ───────────────────────────────────
('MIT Tech Review',     'https://www.technologyreview.com/feed',            'science',  'global',true),
('TechCrunch',          'https://techcrunch.com/feed/',                     'science',  'global',true),
('Nature',              'https://www.nature.com/nature.rss',                'science',  'global',true),
('Wired Science',       'https://www.wired.com/feed/category/science/latest/rss','science','global',true),
('Věda24 CZ',           'https://www.ceskatelevize.cz/rss/veda24/',         'science',  'cs',    true),
('Quark SK',            'https://www.quark.sk/rss',                         'science',  'sk',    true),
('Spektrum DE',         'https://www.spektrum.de/rss/spektrum-rss2.xml',    'science',  'de',    true),
('Sciences et Avenir',  'https://www.sciencesetavenir.fr/rss.xml',          'science',  'fr',    true),
('Nauka w Polsce',      'https://naukawpolsce.pl/rss.xml',                  'science',  'pl',    true),
('Le Scienze IT',       'https://www.lescienze.it/rss',                     'science',  'it',    true),

-- ── DEEP SCOUT (P1) ───────────────────────────────────────
('Pitchfork Reviews',   'https://pitchfork.com/rss/reviews/albums/',        'deep_scout','en-us', true),
('Stereogum',           'https://www.stereogum.com/feed/',                  'deep_scout','en-us', true),
('Stereogum Hip-Hop',   'https://www.stereogum.com/category/hip-hop/feed/', 'deep_scout','en-us', true),
('Reddit Underground',  'https://www.reddit.com/r/undergroundhiphop/.rss',  'deep_scout','en-us', true),
('Reddit Indieheads',   'https://www.reddit.com/r/indieheads/.rss',         'deep_scout','en-us', true),
('Reddit IIB',          'https://www.reddit.com/r/InternetIsBeautiful/.rss','deep_scout','en-us', true),
('Reddit UK HipHop',    'https://www.reddit.com/r/ukhiphopheads/.rss',      'deep_scout','en-gb', true);

-- 3. Verify count
SELECT category, count(*) FROM scout_sources GROUP BY category ORDER BY category;
