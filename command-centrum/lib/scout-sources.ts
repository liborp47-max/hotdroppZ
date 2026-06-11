export type SourceCategory =
  | 'droppz'
  | 'usa_rap'
  | 'uk_rap'
  | 'eu_rap'
  | 'ru_rap'
  | 'balkan_rap'
  | 'fashion'
  | 'culture'
  | 'fun'
  | 'news'

export type SourceStyle = 'streetrap' | 'rap' | 'rnb' | 'other'

export type SourceLang =
  | 'cs' | 'sk' | 'de' | 'fr' | 'pl' | 'it' | 'es' | 'nl' | 'se'
  | 'ru' | 'sr' | 'sq' | 'bs' | 'hr'
  | 'en-gb' | 'en-us' | 'global'

export interface SourceDefinition {
  name: string
  url: string
  category: SourceCategory
  lang: SourceLang
  style?: SourceStyle  // default 'rap' if omitted
}

export const CATEGORY_LABELS: Record<SourceCategory, string> = {
  droppz:     'DROPPZ',
  usa_rap:    'USA Rap',
  uk_rap:     'UK Rap',
  eu_rap:     'EU Rap',
  ru_rap:     'RU Rap',
  balkan_rap: 'Balkan Rap',
  fashion:    'Fashion',
  culture:    'Culture',
  fun:        'Fun',
  news:       'News',
}

export const CATEGORY_COLORS: Record<SourceCategory, string> = {
  droppz:     'bg-purple-600/20 text-purple-300 border-purple-500/30',
  usa_rap:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  uk_rap:     'bg-blue-500/15 text-blue-400 border-blue-500/20',
  eu_rap:     'bg-[#00E085]/15 text-[#00E085] border-emerald-500/20',
  ru_rap:     'bg-red-500/15 text-red-400 border-red-500/20',
  balkan_rap: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  fashion:    'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20',
  culture:    'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  fun:        'bg-rose-500/15 text-rose-400 border-rose-500/20',
  news:       'bg-white/[0.06] text-[#A8A8A8] border-white/15',
}

export const LANG_FLAG: Record<SourceLang, string> = {
  cs:      '🇨🇿',
  sk:      '🇸🇰',
  de:      '🇩🇪',
  fr:      '🇫🇷',
  pl:      '🇵🇱',
  it:      '🇮🇹',
  es:      '🇪🇸',
  nl:      '🇳🇱',
  se:      '🇸🇪',
  ru:      '🇷🇺',
  sr:      '🇷🇸',
  sq:      '🇦🇱',
  bs:      '🇧🇦',
  hr:      '🇭🇷',
  'en-gb': '🇬🇧',
  'en-us': '🇺🇸',
  global:  '🌍',
}

export const PRIORITY_MAP: Record<SourceCategory, string> = {
  droppz:     'P0',
  usa_rap:    'P1',
  uk_rap:     'P1',
  eu_rap:     'P1',
  ru_rap:     'P1',
  balkan_rap: 'P1',
  fashion:    'P2',
  culture:    'P2',
  fun:        'P2',
  news:       'P3',
}

export const STYLE_RANKS: Record<SourceStyle, number> = {
  streetrap: 1,
  rap:       2,
  rnb:       3,
  other:     4,
}

export const SOURCES: SourceDefinition[] = [

  // ═══════════════════════════════════════════
  // DROPPZ — P0 — NEW RELEASES, SINGLES, ALBUMS, EPS, VIDEOCLIPS
  // ═══════════════════════════════════════════
  { name: 'Billboard',              url: 'https://www.billboard.com/feed/',                   category: 'droppz', lang: 'en-us' },
  { name: 'Rap-Up',                 url: 'https://www.rap-up.com/feed/',                     category: 'droppz', lang: 'en-us' },
  { name: 'HipHopDX',               url: 'https://hiphopdx.com/rss',                         category: 'droppz', lang: 'en-us' },
  { name: 'Rolling Stone Music',    url: 'https://www.rollingstone.com/music/feed/',          category: 'droppz', lang: 'en-us' },
  { name: 'Pitchfork News',         url: 'https://pitchfork.com/rss/news/',                  category: 'droppz', lang: 'en-us' },
  { name: 'Rap Radar',              url: 'https://rapradar.com/feed/',                       category: 'droppz', lang: 'en-us', style: 'streetrap' },
  { name: '2DopeBoyz',              url: 'https://2dopeboyz.com/feed/',                      category: 'droppz', lang: 'en-us' },
  { name: 'Okayplayer',             url: 'https://www.okayplayer.com/feed/',                 category: 'droppz', lang: 'en-us' },
  { name: 'Official UK Charts',     url: 'https://www.officialcharts.com/rss',               category: 'droppz', lang: 'en-gb' },
  { name: 'Music Week',             url: 'https://www.musicweek.com/feed',                   category: 'droppz', lang: 'en-gb' },
  { name: 'Reddit NewMusicFriday',  url: 'https://www.reddit.com/r/NewMusicFriday/.rss',     category: 'droppz', lang: 'global' },
  { name: 'Offiz. Charts DE',       url: 'https://www.offiziellecharts.de/hits-charts.rss',  category: 'droppz', lang: 'de' },
  { name: 'Charts FR SNEP',         url: 'https://www.snepmusique.com/feed/',                category: 'droppz', lang: 'fr' },
  { name: 'Platz 5 DE',             url: 'https://platz5.net/feed/',                         category: 'droppz', lang: 'de', style: 'streetrap' },
  { name: 'Rap2Soul DE',            url: 'https://rap2soul.de/feed/',                        category: 'droppz', lang: 'de', style: 'streetrap' },
  { name: 'Strassenrap DE',         url: 'https://www.strassenrap.de/feed/',                 category: 'droppz', lang: 'de', style: 'streetrap' },
  { name: 'Booska-P',               url: 'https://www.booska-p.com/rss',                     category: 'droppz', lang: 'fr', style: 'streetrap' },
  { name: 'Oklm FR',                url: 'https://www.oklm.com/feed/',                       category: 'droppz', lang: 'fr', style: 'streetrap' },
  { name: 'Skyrock Actus FR',       url: 'https://www.skyrock.com/rss/actus.xml',            category: 'droppz', lang: 'fr' },
  { name: 'Konbini Music FR',       url: 'https://www.konbini.com/fr/music/feed/',            category: 'droppz', lang: 'fr' },
  { name: 'Nofi FR',                url: 'https://www.nofi.fr/feed/',                        category: 'droppz', lang: 'fr' },
  { name: 'Planète Rap FR',         url: 'https://www.skyrock.com/rss/planeterap.xml',       category: 'droppz', lang: 'fr' },
  { name: 'Ghettoblaster IT',       url: 'https://www.ghettoblaster.it/feed/',               category: 'droppz', lang: 'it', style: 'streetrap' },
  { name: 'Loudvision IT',          url: 'https://www.loudvision.it/feed/',                  category: 'droppz', lang: 'it' },
  { name: 'Reddit GermanReleases',  url: 'https://www.reddit.com/r/germanrap/new/.rss',      category: 'droppz', lang: 'de' },

  // ═══════════════════════════════════════════
  // USA RAP — P1
  // ═══════════════════════════════════════════
  { name: 'XXL',                    url: 'https://www.xxlmag.com/feed/',                     category: 'usa_rap', lang: 'en-us' },
  { name: 'Complex Music',          url: 'https://www.complex.com/music/rss',                category: 'usa_rap', lang: 'en-us' },
  { name: 'Vibe',                   url: 'https://www.vibe.com/feed/',                       category: 'usa_rap', lang: 'en-us' },
  { name: 'AllHipHop',              url: 'https://allhiphop.com/feed',                       category: 'usa_rap', lang: 'en-us' },
  { name: 'The Source',             url: 'https://thesource.com/feed',                       category: 'usa_rap', lang: 'en-us' },
  { name: 'Spin Magazine',          url: 'https://spin.com/feed/',                           category: 'usa_rap', lang: 'en-us' },
  { name: 'Rapzilla',               url: 'https://rapzilla.com/rss/',                        category: 'usa_rap', lang: 'en-us' },
  { name: 'Karen Civil',            url: 'https://www.karencivil.com/rss',                   category: 'usa_rap', lang: 'en-us' },
  { name: 'Rated RnB',              url: 'https://ratedrnb.com/feed/',                      category: 'usa_rap', lang: 'en-us', style: 'rnb' },
  { name: 'Grungecake',             url: 'https://grungecake.com/feed/',                    category: 'usa_rap', lang: 'en-us' },
  { name: 'Pigeons & Planes',       url: 'https://www.complex.com/pigeons-and-planes/rss',  category: 'usa_rap', lang: 'en-us' },
  { name: 'Ones To Watch',          url: 'https://www.onestowatch.com/rss.xml',             category: 'usa_rap', lang: 'en-us' },
  { name: 'HipHop-N-More',          url: 'https://hiphopnmore.com/feed/',                   category: 'usa_rap', lang: 'en-us' },
  { name: 'Pitchfork Albums',       url: 'https://pitchfork.com/rss/reviews/albums/',       category: 'usa_rap', lang: 'en-us' },
  { name: 'Pitchfork Tracks',       url: 'https://pitchfork.com/rss/reviews/tracks/',       category: 'usa_rap', lang: 'en-us' },
  { name: 'Pitchfork Best New',     url: 'https://pitchfork.com/rss/reviews/best/',         category: 'usa_rap', lang: 'en-us' },
  { name: 'Stereogum',              url: 'https://www.stereogum.com/feed/',                 category: 'usa_rap', lang: 'en-us' },
  { name: 'Stereogum Hip-Hop',      url: 'https://www.stereogum.com/category/hip-hop/feed/', category: 'usa_rap', lang: 'en-us' },
  { name: 'Consequence Sound',      url: 'https://consequence.net/category/new-music/feed/', category: 'usa_rap', lang: 'en-us' },
  { name: 'Passion of the Weiss',   url: 'https://www.passionweiss.com/feed/',              category: 'usa_rap', lang: 'en-us' },
  { name: 'Nah Right',              url: 'https://nahright.com/feed/',                      category: 'usa_rap', lang: 'en-us' },
  { name: 'Audiomack Blog',         url: 'https://audiomack.com/blog/feed',                 category: 'usa_rap', lang: 'en-us' },
  { name: 'DJBooth',                url: 'https://djbooth.net/rss',                         category: 'usa_rap', lang: 'en-us' },
  { name: 'The Root',               url: 'https://theroot.com/rss',                         category: 'usa_rap', lang: 'en-us' },
  { name: 'Reddit Underground',     url: 'https://www.reddit.com/r/undergroundhiphop/.rss', category: 'usa_rap', lang: 'en-us' },
  { name: 'Reddit ListenToThis',    url: 'https://www.reddit.com/r/listentothis/.rss',      category: 'usa_rap', lang: 'global' },
  { name: 'Reddit HipHop',          url: 'https://www.reddit.com/r/hiphop/.rss',            category: 'usa_rap', lang: 'en-us' },

  // ═══════════════════════════════════════════
  // UK RAP — P1
  // ═══════════════════════════════════════════
  { name: 'GRM Daily',              url: 'https://grmdaily.com/feed/',                      category: 'uk_rap', lang: 'en-gb', style: 'streetrap' },
  { name: 'NME Music',              url: 'https://www.nme.com/feed/',                       category: 'uk_rap', lang: 'en-gb' },
  { name: 'The Fader',              url: 'https://www.thefader.com/feed/',                  category: 'uk_rap', lang: 'en-gb' },
  { name: 'Soulculture UK',         url: 'https://soulculture.co.uk/feed/',                 category: 'uk_rap', lang: 'en-gb' },
  { name: 'Clash Music',            url: 'https://www.clashmusic.com/feed',                 category: 'uk_rap', lang: 'en-gb' },
  { name: 'The Line of Best Fit',   url: 'https://www.thelineofbestfit.com/rss',            category: 'uk_rap', lang: 'en-gb' },
  { name: 'Clash New Music',        url: 'https://www.clashmusic.com/news/feed',            category: 'uk_rap', lang: 'en-gb' },
  { name: 'Reddit UK HipHop',       url: 'https://www.reddit.com/r/ukhiphopheads/.rss',     category: 'uk_rap', lang: 'en-gb' },
  { name: 'Reddit UK Drill',        url: 'https://www.reddit.com/r/ukdrill/.rss',           category: 'uk_rap', lang: 'en-gb', style: 'streetrap' },
  { name: 'Reddit Grime',           url: 'https://www.reddit.com/r/grime/.rss',             category: 'uk_rap', lang: 'en-gb', style: 'streetrap' },

  // ═══════════════════════════════════════════
  // EU RAP — P1
  // ═══════════════════════════════════════════

  // CZ
  { name: 'Refresher CZ',           url: 'https://refresher.cz/rss',                        category: 'eu_rap', lang: 'cs' },
  { name: 'Rap Revue',              url: 'https://raprevue.cz/feed',                        category: 'eu_rap', lang: 'cs' },
  { name: 'HipHop.cz',              url: 'https://hiphop.cz/feed',                          category: 'eu_rap', lang: 'cs' },
  { name: 'iRadio Beat CZ',         url: 'https://iradiobeat.cz/rss',                       category: 'eu_rap', lang: 'cs' },
  { name: 'Rapzname CZ',            url: 'https://rapzname.cz/feed',                        category: 'eu_rap', lang: 'cs' },

  // SK
  { name: 'Refresher SK',           url: 'https://refresher.sk/rss',                        category: 'eu_rap', lang: 'sk' },
  { name: 'Flow SK',                url: 'https://flow.sk/feed',                            category: 'eu_rap', lang: 'sk' },
  { name: 'Raps.sk',                url: 'https://raps.sk/feed',                            category: 'eu_rap', lang: 'sk' },

  // DE
  { name: 'Backspin DE',            url: 'https://backspin.de/feed',                        category: 'eu_rap', lang: 'de' },
  { name: 'HipHop.de',              url: 'https://hiphop.de/rss',                           category: 'eu_rap', lang: 'de' },
  { name: 'Juice Magazine DE',      url: 'https://juice.de/feed',                           category: 'eu_rap', lang: 'de' },
  { name: '16BARS.de',              url: 'https://16bars.de/feed',                          category: 'eu_rap', lang: 'de', style: 'streetrap' },
  { name: 'Rap.de',                 url: 'https://rap.de/feed/',                            category: 'eu_rap', lang: 'de' },
  { name: 'Musikexpress DE',        url: 'https://www.musikexpress.de/feed/',               category: 'eu_rap', lang: 'de' },
  { name: 'Laut.de',                url: 'https://www.laut.de/rss/news.xml',               category: 'eu_rap', lang: 'de' },
  { name: 'MZEE News DE',           url: 'https://mzee.com/magazin/feed',                  category: 'eu_rap', lang: 'de' },

  // FR
  { name: 'Abcdr du Son',           url: 'https://www.abcdrduson.com/feed',                 category: 'eu_rap', lang: 'fr' },
  { name: 'Raplume FR',             url: 'https://raplume.eu/feed',                         category: 'eu_rap', lang: 'fr' },
  { name: 'HHB FR',                 url: 'https://www.hhb.fr/feed',                        category: 'eu_rap', lang: 'fr' },
  { name: 'Sniper FR',              url: 'https://www.sniper.fr/feed',                     category: 'eu_rap', lang: 'fr' },
  { name: 'Lire la Musique FR',     url: 'https://www.lirelam.fr/feed',                    category: 'eu_rap', lang: 'fr' },

  // PL
  { name: 'Popkiller PL',           url: 'https://popkiller.pl/rss',                        category: 'eu_rap', lang: 'pl' },
  { name: 'WhiteHouse PL',          url: 'https://whitehouse.com.pl/feed',                  category: 'eu_rap', lang: 'pl' },
  { name: 'HipHop Centrum PL',      url: 'https://hiphopcen.pl/feed',                       category: 'eu_rap', lang: 'pl' },

  // IT
  { name: 'HiphopTV IT',            url: 'https://hiphoptv.it/feed',                        category: 'eu_rap', lang: 'it' },
  { name: 'Rapologia IT',           url: 'https://www.rapologia.it/feed',                   category: 'eu_rap', lang: 'it' },

  // ES
  { name: 'HipHop.es',              url: 'https://hiphopes.es/feed',                        category: 'eu_rap', lang: 'es' },
  { name: 'HHGroups ES',            url: 'https://www.hhgroups.com/rss',                    category: 'eu_rap', lang: 'es' },

  // NL
  { name: 'FunX NL',                url: 'https://www.funx.nl/rss',                         category: 'eu_rap', lang: 'nl' },
  { name: 'Puna NL',                url: 'https://www.puna.nl/feed/',                       category: 'eu_rap', lang: 'nl' },

  // Scandinavian / Nordic
  { name: 'Diffus DK',              url: 'https://www.diffus.dk/feed',                     category: 'eu_rap', lang: 'se' },
  { name: 'Gaffa NO',               url: 'https://gaffa.no/feed',                          category: 'eu_rap', lang: 'se' },

  // Reddit EU
  { name: 'Reddit GermanRap',       url: 'https://www.reddit.com/r/germanrap/.rss',         category: 'eu_rap', lang: 'de', style: 'streetrap' },
  { name: 'Reddit FrenchRap',       url: 'https://www.reddit.com/r/frenchrap/.rss',         category: 'eu_rap', lang: 'fr', style: 'streetrap' },
  { name: 'Reddit EuropeanHipHop',  url: 'https://www.reddit.com/r/EuropeanHipHop/.rss',   category: 'eu_rap', lang: 'global' },
  { name: 'Reddit ItalianHipHop',   url: 'https://www.reddit.com/r/italianhiphop/.rss',    category: 'eu_rap', lang: 'it' },

  // ═══════════════════════════════════════════
  // RU RAP — P1
  // ═══════════════════════════════════════════
  { name: 'The Flow RU',            url: 'https://the-flow.ru/rss',                         category: 'ru_rap', lang: 'ru' },

  // ═══════════════════════════════════════════
  // BALKAN RAP — P1
  // ═══════════════════════════════════════════
  { name: 'Mondo RS',               url: 'https://mondo.rs/rss',                            category: 'balkan_rap', lang: 'sr' },
  { name: 'Top Channel AL',         url: 'https://top-channel.tv/rss',                      category: 'balkan_rap', lang: 'sq' },
  { name: 'Klix BA',                url: 'https://klix.ba/rss',                             category: 'balkan_rap', lang: 'bs' },
  { name: 'Index HR',               url: 'https://www.index.hr/rss',                        category: 'balkan_rap', lang: 'hr' },
  { name: 'Reddit BalkanHipHop',    url: 'https://www.reddit.com/r/BalkanHipHop/.rss',      category: 'balkan_rap', lang: 'sr', style: 'streetrap' },
  { name: 'Trap Muzika RS',         url: 'https://trapmuzika.net/feed/',                    category: 'balkan_rap', lang: 'sr', style: 'streetrap' },
  { name: 'Muzika.hr',              url: 'https://muzika.hr/feed/',                         category: 'balkan_rap', lang: 'hr' },

  // ═══════════════════════════════════════════
  // FASHION — P2
  // ═══════════════════════════════════════════
  { name: 'Hypebeast',              url: 'https://hypebeast.com/feed',                      category: 'fashion', lang: 'global' },
  { name: 'Highsnobiety',           url: 'https://www.highsnobiety.com/feed',               category: 'fashion', lang: 'global' },
  { name: 'Sneaker News',           url: 'https://sneakernews.com/feed/',                   category: 'fashion', lang: 'global' },
  { name: 'Nice Kicks',             url: 'https://www.nicekicks.com/feed/',                 category: 'fashion', lang: 'global' },
  { name: 'Kicks On Fire',          url: 'https://www.kicksonfire.com/feed',                category: 'fashion', lang: 'global' },
  { name: 'Vogue',                  url: 'https://www.vogue.com/feed/',                     category: 'fashion', lang: 'global' },
  { name: 'GQ Global',              url: 'https://www.gq.com/feed/rss',                     category: 'fashion', lang: 'global' },
  { name: 'GQ UK',                  url: 'https://www.gq-magazine.co.uk/feed/rss',          category: 'fashion', lang: 'en-gb' },
  { name: 'Fashionista',            url: 'https://fashionista.com/feed',                    category: 'fashion', lang: 'global' },
  { name: 'Complex Style',          url: 'https://www.complex.com/style/rss',               category: 'fashion', lang: 'en-us' },
  { name: 'Hype.cz',                url: 'https://hype.cz/feed',                            category: 'fashion', lang: 'cs' },
  { name: 'Street Machine CZ',      url: 'https://streetmachine.cz/feed',                   category: 'fashion', lang: 'cs' },
  { name: 'iReport CZ',             url: 'https://www.ireport.cz/rss',                      category: 'fashion', lang: 'cs' },

  // ═══════════════════════════════════════════
  // CULTURE — P2
  // ═══════════════════════════════════════════
  { name: 'Upworthy',               url: 'https://www.upworthy.com/feed',                   category: 'culture', lang: 'en-us' },
  { name: 'The Nation',             url: 'https://www.thenation.com/feed/',                 category: 'culture', lang: 'en-us' },
  { name: 'Reddit Memes',           url: 'https://www.reddit.com/r/memes/.rss',             category: 'culture', lang: 'en-us' },
  { name: 'Reddit DankMemes',       url: 'https://www.reddit.com/r/dankmemes/.rss',         category: 'culture', lang: 'en-us' },
  { name: 'Know Your Meme',         url: 'https://knowyourmeme.com/rss',                    category: 'culture', lang: 'en-us' },
  { name: 'The Poke UK',            url: 'https://www.thepoke.co.uk/feed/',                 category: 'culture', lang: 'en-gb' },
  { name: 'Reddit CasualUK',        url: 'https://www.reddit.com/r/CasualUK/.rss',          category: 'culture', lang: 'en-gb' },
  // Local culture
  { name: 'Musicserver CZ',         url: 'https://musicserver.cz/rss',                      category: 'culture', lang: 'cs' },
  { name: 'Reflex CZ',              url: 'https://www.reflex.cz/rss',                       category: 'culture', lang: 'cs' },
  { name: 'Kapital SK',             url: 'https://kapital.sk/rss',                          category: 'culture', lang: 'sk' },
  { name: 'Život SK',               url: 'https://zivot.pluska.sk/rss',                     category: 'culture', lang: 'sk' },
  { name: 'MZEE.com DE',            url: 'https://mzee.com/magazine/feed',                  category: 'culture', lang: 'de' },
  { name: 'Focus DE',               url: 'https://www.focus.de/feeds/rss/gesellschaft',     category: 'culture', lang: 'de' },
  { name: 'Yard FR',                url: 'https://www.yard.live/feed',                      category: 'culture', lang: 'fr' },
  { name: 'GEO FR',                 url: 'https://www.geo.fr/rss',                          category: 'culture', lang: 'fr' },
  { name: 'AllMusic Italia',        url: 'https://allmusicitalia.it/feed',                  category: 'culture', lang: 'it' },
  { name: 'Rockit IT',              url: 'https://www.rockit.it/feed',                      category: 'culture', lang: 'it' },
  { name: 'Bass Culture ES',        url: 'https://bassculturemagazine.com/feed',            category: 'culture', lang: 'es' },
  { name: '3voor12 NL',             url: 'https://3voor12.vpro.nl/rss',                     category: 'culture', lang: 'nl' },
  { name: 'Gaffa SE',               url: 'https://gaffa.se/rss',                            category: 'culture', lang: 'se' },
  { name: 'National Geo PL',        url: 'https://www.national-geographic.pl/rss',          category: 'culture', lang: 'pl' },

  // ═══════════════════════════════════════════
  // FUN — P2 (viral, drama, entertainment)
  // ═══════════════════════════════════════════
  { name: 'TMZ',                    url: 'https://www.tmz.com/rss.xml',                     category: 'fun', lang: 'en-us' },
  { name: 'Uproxx Music',           url: 'https://uproxx.com/music/feed/',                  category: 'fun', lang: 'en-us' },
  { name: 'MediaTakeOut',           url: 'https://mtonews.com/feed',                        category: 'fun', lang: 'en-us' },
  { name: 'Bossip',                 url: 'https://bossip.com/feed',                         category: 'fun', lang: 'en-us' },
  { name: 'The Shade Room',         url: 'https://theshaderoom.com/feed',                   category: 'fun', lang: 'en-us' },
  { name: 'Reddit HipHopHeads',     url: 'https://www.reddit.com/r/hiphopheads/.rss',       category: 'fun', lang: 'en-us' },
  { name: 'Reddit PopCulture',      url: 'https://www.reddit.com/r/PopCultureChat/.rss',    category: 'fun', lang: 'en-us' },
  { name: 'Daily Mail US',          url: 'https://www.dailymail.co.uk/ushome/index.rss',    category: 'fun', lang: 'en-us' },
  { name: 'Blesk CZ',               url: 'https://www.blesk.cz/rss',                        category: 'fun', lang: 'cs' },
  { name: 'Pluska SK',              url: 'https://www.pluska.sk/rss',                       category: 'fun', lang: 'sk' },
  { name: 'Cas.sk',                 url: 'https://www.cas.sk/rss',                          category: 'fun', lang: 'sk' },
  { name: 'Bild DE',                url: 'https://www.bild.de/rssfeeds/vw-home/vw-home-16725546,feed=home.bild.html', category: 'fun', lang: 'de' },
  { name: 'Closer FR',              url: 'https://www.closermag.fr/rss',                    category: 'fun', lang: 'fr' },
  { name: 'Gala FR',                url: 'https://www.gala.fr/rss',                         category: 'fun', lang: 'fr' },
  { name: 'Fakt PL',                url: 'https://www.fakt.pl/rss',                         category: 'fun', lang: 'pl' },
  { name: 'Plotek PL',              url: 'https://www.plotek.pl/rss',                       category: 'fun', lang: 'pl' },
  { name: 'Chi IT',                 url: 'https://www.chimagazine.it/rss',                  category: 'fun', lang: 'it' },
  { name: 'Gossip.it',              url: 'https://www.gossip.it/rss',                       category: 'fun', lang: 'it' },
  { name: '20 Minutos ES',          url: 'https://www.20minutos.es/rss',                    category: 'fun', lang: 'es' },
  { name: 'Telegraaf NL',           url: 'https://www.telegraaf.nl/rss',                    category: 'fun', lang: 'nl' },
  { name: 'Lenta RU',               url: 'https://lenta.ru/rss',                            category: 'fun', lang: 'ru' },
  { name: 'Telegraf RS',            url: 'https://telegraf.rs/rss',                         category: 'fun', lang: 'sr' },
  { name: 'Zeri AL',                url: 'https://zeri.info/rss',                           category: 'fun', lang: 'sq' },
  { name: 'Avaz BA',                url: 'https://avaz.ba/rss',                             category: 'fun', lang: 'bs' },
  { name: '24sata HR',              url: 'https://www.24sata.hr/rss',                       category: 'fun', lang: 'hr' },
  { name: 'Daily Mail UK',          url: 'https://www.dailymail.co.uk/articles.rss',        category: 'fun', lang: 'en-gb' },

  // ═══════════════════════════════════════════
  // NEWS — P3 (global news + science merged)
  // ═══════════════════════════════════════════
  { name: 'BBC News',               url: 'https://feeds.bbci.co.uk/news/rss.xml',           category: 'news', lang: 'global' },
  { name: 'BBC UK',                 url: 'https://www.bbc.co.uk/news/uk/rss.xml',           category: 'news', lang: 'en-gb' },
  { name: 'Al Jazeera',             url: 'https://www.aljazeera.com/xml/rss/all.xml',       category: 'news', lang: 'global' },
  { name: 'France 24',              url: 'https://www.france24.com/en/rss',                 category: 'news', lang: 'global' },
  { name: 'Euronews',               url: 'https://www.euronews.com/rss',                    category: 'news', lang: 'global' },
  { name: 'NPR News',               url: 'https://www.npr.org/rss/rss.php?id=1001',         category: 'news', lang: 'en-us' },
  { name: 'The Guardian World',     url: 'https://www.theguardian.com/world/rss',           category: 'news', lang: 'en-us' },
  { name: 'The Guardian UK',        url: 'https://www.theguardian.com/uk/rss',              category: 'news', lang: 'en-gb' },
  { name: 'The Verge',              url: 'https://www.theverge.com/rss/index.xml',          category: 'news', lang: 'en-us' },
  { name: 'CoinDesk',               url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', category: 'news', lang: 'global' },
  { name: 'The Standard UK',        url: 'https://www.standard.co.uk/rss',                  category: 'news', lang: 'en-gb' },
  { name: 'The Independent',        url: 'https://www.independent.co.uk/rss',               category: 'news', lang: 'en-gb' },
  { name: 'Novinky.cz',             url: 'https://www.novinky.cz/rss',                      category: 'news', lang: 'cs' },
  { name: 'iDNES.cz',               url: 'https://servis.idnes.cz/rss.aspx?c=zpravodaj',    category: 'news', lang: 'cs' },
  { name: 'Pravda SK',              url: 'https://spravy.pravda.sk/rss',                    category: 'news', lang: 'sk' },
  { name: 'Spiegel',                url: 'https://www.spiegel.de/international/index.rss',  category: 'news', lang: 'de' },
  { name: 'Le Monde',               url: 'https://www.lemonde.fr/rss/une.xml',              category: 'news', lang: 'fr' },
  { name: 'Gazeta Wyborcza',        url: 'https://wyborcza.pl/pub/rss/wyborcza.xml',        category: 'news', lang: 'pl' },
  { name: 'Corriere della Sera',    url: 'https://rss.corriere.it/rss/homepage.xml',        category: 'news', lang: 'it' },
  { name: 'MIT Tech Review',        url: 'https://www.technologyreview.com/feed',           category: 'news', lang: 'global' },
  { name: 'TechCrunch',             url: 'https://techcrunch.com/feed/',                    category: 'news', lang: 'global' },
  { name: 'Nature',                 url: 'https://www.nature.com/nature.rss',               category: 'news', lang: 'global' },
  { name: 'Wired Science',          url: 'https://www.wired.com/feed/category/science/latest/rss', category: 'news', lang: 'global' },
  { name: 'Věda24 CZ',              url: 'https://www.ceskatelevize.cz/rss/veda24/',        category: 'news', lang: 'cs' },
  { name: 'Quark SK',               url: 'https://www.quark.sk/rss',                        category: 'news', lang: 'sk' },
  { name: 'Spektrum DE',            url: 'https://www.spektrum.de/rss/spektrum-rss2.xml',   category: 'news', lang: 'de' },
  { name: 'Sciences et Avenir',     url: 'https://www.sciencesetavenir.fr/rss.xml',         category: 'news', lang: 'fr' },
  { name: 'Nauka w Polsce',         url: 'https://naukawpolsce.pl/rss.xml',                 category: 'news', lang: 'pl' },
  { name: 'Le Scienze IT',          url: 'https://www.lescienze.it/rss',                    category: 'news', lang: 'it' },

]

export const SOURCES_BY_CATEGORY = SOURCES.reduce<Record<SourceCategory, SourceDefinition[]>>(
  (acc, source) => {
    if (!acc[source.category]) acc[source.category] = []
    acc[source.category].push(source)
    return acc
  },
  {} as Record<SourceCategory, SourceDefinition[]>
)

export const SOURCE_STATS = {
  total: SOURCES.length,
  byCategory: Object.fromEntries(
    Object.entries(SOURCES_BY_CATEGORY).map(([cat, sources]) => [cat, sources.length])
  ),
  byLang: SOURCES.reduce<Record<string, number>>((acc, s) => {
    acc[s.lang] = (acc[s.lang] ?? 0) + 1
    return acc
  }, {}),
}
