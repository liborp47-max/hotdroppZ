import type { CategoryDesign, CategoryStyle, FontConfig } from './types'

// Each category has a distinct visual identity: color palette + font personality
const DESIGNS: Record<CategoryStyle, CategoryDesign> = {
  droppz: {
    primaryColor:   '#f97316',
    secondaryColor: '#7c2d12',
    textColor:      '#ffffff',
    pillBg:         '#f97316',
    pillText:       '#ffffff',
    categoryLabel:  'DROPPZ',
    font: { family: 'Bebas Neue', googleName: 'Bebas+Neue', weight: 700, style: 'normal' },
  },
  usa_rap: {
    primaryColor:   '#1e40af',
    secondaryColor: '#0f172a',
    textColor:      '#ffffff',
    pillBg:         '#2563eb',
    pillText:       '#ffffff',
    categoryLabel:  'USA RAP',
    font: { family: 'Anton', googleName: 'Anton', weight: 700, style: 'normal' },
  },
  uk_rap: {
    primaryColor:   '#dc2626',
    secondaryColor: '#0f172a',
    textColor:      '#ffffff',
    pillBg:         '#dc2626',
    pillText:       '#ffffff',
    categoryLabel:  'UK RAP',
    font: { family: 'Oswald', googleName: 'Oswald:wght@700', weight: 700, style: 'normal' },
  },
  eu_rap: {
    primaryColor:   '#059669',
    secondaryColor: '#0f172a',
    textColor:      '#ffffff',
    pillBg:         '#059669',
    pillText:       '#ffffff',
    categoryLabel:  'EU RAP',
    font: { family: 'Barlow Condensed', googleName: 'Barlow+Condensed:wght@800', weight: 800, style: 'normal' },
  },
  ru_rap: {
    primaryColor:   '#7c3aed',
    secondaryColor: '#0f172a',
    textColor:      '#ffffff',
    pillBg:         '#7c3aed',
    pillText:       '#ffffff',
    categoryLabel:  'RU RAP',
    font: { family: 'Oswald', googleName: 'Oswald:wght@700', weight: 700, style: 'normal' },
  },
  balkan_rap: {
    primaryColor:   '#d97706',
    secondaryColor: '#1c1917',
    textColor:      '#ffffff',
    pillBg:         '#d97706',
    pillText:       '#ffffff',
    categoryLabel:  'BALKAN',
    font: { family: 'Anton', googleName: 'Anton', weight: 700, style: 'normal' },
  },
  rnb: {
    primaryColor:   '#db2777',
    secondaryColor: '#1e1b4b',
    textColor:      '#ffffff',
    pillBg:         '#db2777',
    pillText:       '#ffffff',
    categoryLabel:  'R&B',
    font: { family: 'Raleway', googleName: 'Raleway:wght@900', weight: 900, style: 'italic' },
  },
  fashion: {
    primaryColor:   '#1e1b4b',
    secondaryColor: '#000000',
    textColor:      '#f8fafc',
    pillBg:         '#4f46e5',
    pillText:       '#ffffff',
    categoryLabel:  'FASHION',
    font: { family: 'Playfair Display', googleName: 'Playfair+Display:ital,wght@1,900', weight: 900, style: 'italic' },
  },
  culture: {
    primaryColor:   '#0f766e',
    secondaryColor: '#0f172a',
    textColor:      '#ffffff',
    pillBg:         '#0d9488',
    pillText:       '#ffffff',
    categoryLabel:  'CULTURE',
    font: { family: 'Barlow Condensed', googleName: 'Barlow+Condensed:wght@800', weight: 800, style: 'normal' },
  },
  fun: {
    primaryColor:   '#ca8a04',
    secondaryColor: '#1c1917',
    textColor:      '#ffffff',
    pillBg:         '#eab308',
    pillText:       '#000000',
    categoryLabel:  'FUN',
    font: { family: 'Bebas Neue', googleName: 'Bebas+Neue', weight: 700, style: 'normal' },
  },
  news: {
    primaryColor:   '#374151',
    secondaryColor: '#111827',
    textColor:      '#f9fafb',
    pillBg:         '#4b5563',
    pillText:       '#ffffff',
    categoryLabel:  'NEWS',
    font: { family: 'Oswald', googleName: 'Oswald:wght@600', weight: 700, style: 'normal' },
  },
  default: {
    primaryColor:   '#111827',
    secondaryColor: '#000000',
    textColor:      '#ffffff',
    pillBg:         '#374151',
    pillText:       '#ffffff',
    categoryLabel:  '',
    font: { family: 'Oswald', googleName: 'Oswald:wght@700', weight: 700, style: 'normal' },
  },
}

// Map legacy category names to v2
const CATEGORY_ALIAS: Record<string, CategoryStyle> = {
  droppz_news:     'droppz',
  rap_core:        'usa_rap',
  deep_scout:      'usa_rap',
  drama:           'fun',
  global_news:     'news',
  science:         'news',
  rap:             'usa_rap',
}

export function getCategoryDesign(category: string | null | undefined): CategoryDesign {
  if (!category) return DESIGNS.default
  const key = CATEGORY_ALIAS[category] ?? category
  return DESIGNS[key as CategoryStyle] ?? DESIGNS.default
}
