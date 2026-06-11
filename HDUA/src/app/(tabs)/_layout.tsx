import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Image, Platform, StyleSheet, View } from 'react-native'
import type { ViewStyle } from 'react-native'

import { colors, layout, radius } from '@/styles/theme'

/**
 * Bottom navigation (HDUA-03) — Home / Search / Create / Alerts / Profile.
 * HDCC "venom" language: pure-black bar, no hard borders. The center Create
 * button is the real HotDroppZ flame (logo-shaped, recolored to a venom
 * gradient) with a knockout plus and a soft shape-accurate blur behind it —
 * no box, no outline. Active icons turn venom with a gentle glow.
 */

// Real brand flame (extracted from logoFIRE.ico) + a pre-blurred glow layer that
// follows the flame's exact silhouette (so the glow is shaped, never a box).
const FLAME = require('@/assets/brand/flame.png')
const FLAME_GLOW = require('@/assets/brand/flame-glow.png')
const FLAME_W = 34
const FLAME_H = Math.round(FLAME_W / 0.834) // 368×441 aspect
const GLOW_W = 46
const GLOW_H = Math.round(GLOW_W * (581 / 508)) // 508×581 aspect

type IoniconName = keyof typeof Ionicons.glyphMap

// Web-only soft glow that follows the glyph's alpha (no box). No-op on native.
const iconGlow: ViewStyle | null =
  Platform.OS === 'web' ? ({ filter: 'drop-shadow(0 0 6px rgba(0,236,136,0.65))' } as ViewStyle) : null

/** Outline icon that turns venom with a gentle glow when focused. */
function TabIcon({ name, focused }: { name: IoniconName; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && iconGlow]}>
      <Ionicons name={name} size={24} color={focused ? colors.accent : colors.textFaint} />
      {focused ? <View style={styles.activeDot} /> : null}
    </View>
  )
}

/** Center brand button — the flame logo itself, soft blur behind, plus in belly. */
function CreateButton() {
  return (
    <View style={styles.create}>
      <Image source={FLAME_GLOW} style={styles.flameGlow} />
      <Image source={FLAME} style={styles.flame} resizeMode="contain" />
      <View style={styles.plusWrap} pointerEvents="none">
        <View style={styles.plusBox}>
          <View style={[styles.plusBar, styles.plusH]} />
          <View style={[styles.plusBar, styles.plusV]} />
        </View>
      </View>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} /> }} />
      <Tabs.Screen name="create" options={{ title: 'Create', tabBarIcon: () => <CreateButton /> }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ focused }) => <TabIcon name="notifications" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,236,136,0.16)', // faint venom edge, not a hard line
    height: layout.tabBarHeight,
    paddingTop: 6,
  },
  tabItem: { paddingTop: 4 },
  iconWrap: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  activeDot: {
    position: 'absolute', bottom: -1, width: 4, height: 4,
    borderRadius: radius.pill, backgroundColor: colors.accent,
  },

  // Center create button — flame logo, no box/border, soft shaped blur behind.
  create: {
    width: FLAME_W, height: FLAME_H, marginTop: -16,
    alignItems: 'center', justifyContent: 'center',
  },
  flameGlow: {
    position: 'absolute',
    width: GLOW_W, height: GLOW_H,
    left: (FLAME_W - GLOW_W) / 2, top: (FLAME_H - GLOW_H) / 2,
    opacity: 0.45,
  },
  flame: { width: FLAME_W, height: FLAME_H },
  // Plus sits in the solid lower belly of the flame.
  plusWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 7,
  },
  plusBox: { width: 12, height: 12 },
  plusBar: { position: 'absolute', backgroundColor: '#04130C', borderRadius: 1 },
  plusH: { top: 4.4, left: 0, width: 12, height: 3.2 },
  plusV: { left: 4.4, top: 0, width: 3.2, height: 12 },
})
