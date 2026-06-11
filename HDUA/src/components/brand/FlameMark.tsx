/**
 * FlameMark — the flagship HotDroppZ brand glyph for HDUA.
 *
 * A sleek, slightly asymmetric single-flame mark rendered in HDCC "venom"
 * neon-emerald green, with an optional knockout plus (+) cut into the flame
 * body. Designed to read crisp as a 28px nav icon (withPlus) and as a 40–56px
 * standalone brand glyph (withPlus=false), against pure-black HDCC surfaces.
 *
 * Pure react-native-svg — no image assets — so it scales cleanly everywhere.
 * The optional venom glow uses native shadow props plus a web boxShadow, with
 * a graceful no-glow path. See bottom-of-file notes for web vs native behavior.
 */
import { Platform, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg'

export interface FlameMarkProps {
  /** Width in px; height scales with the glyph aspect ratio. */
  size?: number
  /** Primary flame fill / glow tint. */
  color?: string
  /** Soft venom glow around the mark. */
  glow?: boolean
  /** Render a + centered in the flame body. */
  withPlus?: boolean
  /** Knockout color for the + (near-black on the green by default). */
  plusColor?: string
  /** Optional wrapper style. */
  style?: StyleProp<ViewStyle>
}

// Source artwork is authored on a 100×128 grid (flames are taller than wide).
const VB_W = 100
const VB_H = 128
const ASPECT = VB_H / VB_W

/**
 * Flame silhouette — confident single flame with a sharp tapered tip and a
 * subtle asymmetric lean. Authored once on the 100×128 viewBox.
 */
const FLAME_PATH =
  'M54 2 C58 22 72 33 80 46 C90 61 92 80 84 96 ' +
  'C76 112 60 122 47 126 C61 116 66 104 60 92 ' +
  'C56 84 47 80 43 71 C39 80 41 90 36 98 ' +
  'C32 105 25 108 18 107 C28 99 28 88 24 78 ' +
  'C19 65 22 49 33 38 C43 28 50 18 54 2 Z'

/** Slim inner highlight that gives the flame a glossy, lit-from-within read. */
const HIGHLIGHT_PATH =
  'M53 16 C55 31 64 40 70 51 C77 63 78 77 72 89 ' +
  'C70 78 63 71 57 63 C51 55 49 44 51 33 C52 27 53 22 53 16 Z'

/** Geometric plus, sharp square terminals, sized for the flame's optical mass. */
function Plus({ color }: { color: string }) {
  // Centered horizontally; nudged below geometric center because flames are
  // top-heavy, so the + sits in the visually densest part of the body.
  const cx = 50
  const cy = 78
  const arm = 17 // half-length of each bar
  const half = 5.5 // half-thickness of each bar
  return (
    <Path
      d={
        `M${cx - half} ${cy - arm} H${cx + half} V${cy - half} ` +
        `H${cx + arm} V${cy + half} H${cx + half} V${cy + arm} ` +
        `H${cx - half} V${cy + half} H${cx - arm} V${cy - half} ` +
        `H${cx - half} Z`
      }
      fill={color}
    />
  )
}

/** HDUA brand mark — HDCC venom green flame, optional knockout plus. */
export function FlameMark({
  size = 28,
  color = '#00E085',
  glow = true,
  withPlus = false,
  plusColor = '#001A10',
  style,
}: FlameMarkProps) {
  const height = Math.round(size * ASPECT)

  // Web: react-native-web maps boxShadow to a CSS box-shadow (not in core RN's
  // ViewStyle, hence the cast). Native: shadow* props (iOS) + elevation
  // (Android). Tasteful, non-blooming venom halo either way.
  const webGlow = { boxShadow: '0 0 14px rgba(0, 224, 133, 0.45)' } as ViewStyle
  const nativeGlow: ViewStyle = {
    shadowColor: '#00E085',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  }
  const glowStyle: ViewStyle | undefined = glow
    ? Platform.OS === 'web'
      ? webGlow
      : nativeGlow
    : undefined

  return (
    <View style={[{ width: size, height }, glowStyle, style]}>
      <Svg width={size} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <LinearGradient id="flameBody" x1="50" y1="2" x2="50" y2="126" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#1AEE99" />
            <Stop offset="0.5" stopColor={color} />
            <Stop offset="1" stopColor="#00B870" />
          </LinearGradient>
          <LinearGradient id="flameSheen" x1="40" y1="14" x2="74" y2="92" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#9CFFD6" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#9CFFD6" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Path d={FLAME_PATH} fill="url(#flameBody)" />
        <Path d={HIGHLIGHT_PATH} fill="url(#flameSheen)" />

        {withPlus ? <Plus color={plusColor} /> : null}
      </Svg>
    </View>
  )
}
