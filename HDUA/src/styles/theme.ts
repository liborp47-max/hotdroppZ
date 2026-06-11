/**
 * HDUA design system — aligned to the HotDroppZ Command Centrum (HDCC) "venom"
 * language: pure-black surfaces, neon-emerald (#00E085) accent, glassy panels,
 * sharp (near-square) edges, and tasteful venom glows. Single source of truth
 * for color, spacing, radius, typography, and glow tokens. Import `theme`
 * everywhere; never hardcode hex values in components.
 */
import { Platform } from 'react-native'
import type { ViewStyle } from 'react-native'

export const colors = {
  // Surfaces (pure black → glass tints, per HDCC)
  bg: '#000000',
  bgElevated: '#070807',
  surface: '#0C0E0D',
  surfaceHover: '#141716',
  border: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(0,236,136,0.45)',

  // Glass (translucent white over black)
  glass: 'rgba(255,255,255,0.035)',
  glassHi: 'rgba(255,255,255,0.06)',

  // Text (gray scale, HDCC)
  text: '#E8E8E8',
  textMuted: '#A8A8A8',
  textFaint: '#6A6A6A',

  // Brand accent — venom neon-emerald, a touch more toxic/saturated
  accent: '#00EC88',
  accentBright: '#2BFFA0',
  accentDim: '#00C878',
  accentDeep: '#009C5A',
  accentGlow: 'rgba(0,236,136,0.32)',

  // Secondary accent — drop-post violet
  violet: '#5B3BFF',

  // Semantic
  success: '#00EC88',
  warning: '#FFB84D',
  danger: '#FF5A5A',
  live: '#FF3B3B',

  // Source brand chips
  spotify: '#1DB954',
  appleMusic: '#FA2D48',
  youtube: '#FF0000',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

// Sharp / near-square — HDCC uses 0px radii; HDUA keeps a hair of softness on
// touch targets but stays crisp. `pill` retained for the few rounded chips.
export const radius = {
  sm: 2,
  md: 4,
  lg: 6,
  xl: 10,
  pill: 999,
} as const

export const typography = {
  // sizes
  display: 28,
  title: 22,
  headline: 18,
  body: 15,
  label: 13,
  caption: 11,
  // weights
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const

export const layout = {
  tabBarHeight: 64,
  miniPlayerHeight: 56,
  screenPadding: spacing.lg,
} as const

/**
 * Venom glow helpers. On web react-native-web maps `boxShadow` to CSS; on native
 * we use colored shadow props (iOS) + elevation (Android). Use these on active
 * tabs, CTAs, and the brand mark — sparingly, like HDCC.
 */
function glow(radius: number, opacity: number, elevation: number): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: `0 0 ${radius}px rgba(0,236,136,${opacity})` } as ViewStyle
  }
  return {
    shadowColor: colors.accent,
    shadowOpacity: opacity + 0.15,
    shadowRadius: radius * 0.6,
    shadowOffset: { width: 0, height: 0 },
    elevation,
  }
}

export const glows = {
  soft: glow(10, 0.3, 4),
  cta: glow(16, 0.4, 6),
  strong: glow(22, 0.5, 10),
} as const

export const theme = { colors, spacing, radius, typography, layout, glows } as const
export type Theme = typeof theme
