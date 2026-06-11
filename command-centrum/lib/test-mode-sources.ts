import { TEST_MODE_CONFIG } from '@/config/testMode'
import { PRIORITY_MAP, type SourceCategory } from '@/lib/scout-sources'

export type TestCountry =
  | 'DE'
  | 'FR'
  | 'IT'
  | 'ES'
  | 'UK'
  | 'PL'
  | 'CZ_SK'
  | 'BALKAN'
  | 'NL'
  | 'BE'
  | 'SCANDINAVIA'

type SourceLike = {
  name: string
  url: string
  category: string
  lang: string
  style?: string
  isDynamic?: boolean
}

const PREFERRED_SOURCE_ORDER: Record<TestCountry, string[]> = {
  DE: ['Backspin DE', 'HipHop.de', '16BARS.de', 'Platz 5 DE', 'Reddit GermanRap'],
  FR: ['Booska-P', 'Raplume FR', 'Abcdr du Son', 'HHB FR', 'Planete Rap FR'],
  IT: ['Ghettoblaster IT', 'Rapologia IT', 'HiphopTV IT', 'Loudvision IT'],
  ES: ['HipHop.es', 'HHGroups ES', 'Bass Culture ES'],
  UK: ['GRM Daily', 'The Fader', 'NME Music', 'Reddit UK Drill'],
  PL: ['Popkiller PL', 'HipHop Centrum PL', 'WhiteHouse PL'],
  CZ_SK: ['Refresher CZ', 'Rap Revue', 'HipHop.cz', 'Refresher SK', 'Flow SK'],
  BALKAN: ['Trap Muzika RS', 'Reddit BalkanHipHop', 'Muzika.hr', 'Mondo RS'],
  NL: ['Puna NL', 'FunX NL', '3voor12 NL'],
  BE: ['Reddit EuropeanHipHop'],
  SCANDINAVIA: ['Gaffa NO', 'Diffus DK', 'Gaffa SE'],
}

const BROAD_LOW_VALUE_CATEGORIES = new Set(['news', 'fashion', 'fun'])

function countryForSource(source: SourceLike): TestCountry | null {
  const haystack = `${source.name} ${source.url} ${source.lang}`.toLowerCase()

  if (['sr', 'sq', 'bs', 'hr'].includes(source.lang)) return 'BALKAN'
  if (source.lang === 'cs' || source.lang === 'sk') return 'CZ_SK'
  if (source.lang === 'en-gb') return 'UK'
  if (source.lang === 'de') return 'DE'
  if (source.lang === 'fr') return haystack.includes('belg') ? 'BE' : 'FR'
  if (source.lang === 'it') return 'IT'
  if (source.lang === 'es') return 'ES'
  if (source.lang === 'pl') return 'PL'
  if (source.lang === 'nl') return haystack.includes('belg') ? 'BE' : 'NL'
  if (source.lang === 'se' || /\b(dk|no|se|sweden|norway|denmark|gaffa|diffus)\b/.test(haystack)) return 'SCANDINAVIA'
  if (source.category === 'balkan_rap') return 'BALKAN'
  return null
}

function sourceScore(source: SourceLike, country: TestCountry) {
  const preferredIndex = PREFERRED_SOURCE_ORDER[country].findIndex((name) =>
    source.name.toLowerCase().includes(name.toLowerCase())
  )
  const categoryPriority = PRIORITY_MAP[source.category as SourceCategory] ?? 'P3'
  const categoryScore = categoryPriority === 'P0' ? 50 : categoryPriority === 'P1' ? 40 : categoryPriority === 'P2' ? 20 : 0
  const styleScore = source.style === 'streetrap' ? 10 : source.style === 'rap' ? 6 : source.style === 'rnb' ? 4 : 0
  const preferredScore = preferredIndex >= 0 ? 100 - preferredIndex : 0
  const redditPenalty = source.url.includes('reddit.com') ? -5 : 0

  return preferredScore + categoryScore + styleScore + redditPenalty
}

export function limitSourcesForTestMode<T extends SourceLike>(sources: T[]) {
  const grouped = new Map<TestCountry, T[]>()

  for (const source of sources) {
    if (source.isDynamic) continue
    if (BROAD_LOW_VALUE_CATEGORIES.has(source.category)) continue

    const country = countryForSource(source)
    if (!country) continue
    if (!grouped.has(country)) grouped.set(country, [])
    grouped.get(country)!.push(source)
  }

  return Array.from(grouped.entries()).flatMap(([country, countrySources]) =>
    countrySources
      .sort((a, b) => sourceScore(b, country) - sourceScore(a, country))
      .slice(0, TEST_MODE_CONFIG.country_source_limit)
  )
}

