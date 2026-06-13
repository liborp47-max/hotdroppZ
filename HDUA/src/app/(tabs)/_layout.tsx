import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Image, Platform, StyleSheet, View } from 'react-native'
import type { ImageStyle, ViewStyle } from 'react-native'

import { colors, layout, radius } from '@/styles/theme'

/**
 * Bottom navigation (HDUA-03) — Create / Search / HOME / Alerts / Profile.
 * HDCC "venom" language: pure-black bar, no hard borders. The raised CENTER
 * button is the HotDroppZ brand mark (flame + globe, recolored to a venom
 * gradient) and routes to the home feed. A little glow + shadow, no box.
 */

// Brand home mark (flame + globe) + a pre-blurred glow layer that follows its
// exact silhouette (shaped glow, never a box). Same venom gradient as the feed.
const HOME = require('@/assets/brand/home-mark.png')
const HOME_GLOW = require('@/assets/brand/home-glow.png')
const HOME_W = 38
const HOME_H = Math.round(HOME_W / 0.826) // 423×512 aspect
const HGLOW_W = 54
const HGLOW_H = Math.round(HGLOW_W * (652 / 563)) // padded-glow aspect

type IoniconName = keyof typeof Ionicons.glyphMap

// Web-only soft glow that follows the glyph's alpha (no box). No-op on native.
const iconGlow: ViewStyle | null =
  Platform.OS === 'web' ? ({ filter: 'drop-shadow(0 0 6px rgba(0,236,136,0.65))' } as ViewStyle) : null

// Glow + drop shadow for the brand mark (shape-accurate on web).
const homeShadow: ImageStyle | null =
  Platform.OS === 'web'
    ? ({ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.5)) drop-shadow(0 0 8px rgba(0,236,136,0.55))' } as ImageStyle)
    : null

/** Outline icon that turns venom with a gentle glow when focused. */
function TabIcon({ name, focused }: { name: IoniconName; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && iconGlow]}>
      <Ionicons name={name} size={24} color={focused ? colors.accent : colors.textFaint} />
      {focused ? <View style={styles.activeDot} /> : null}
    </View>
  )
}

/** Raised center brand button — flame + globe logo, routes home. Glow + shadow. */
function HomeButton() {
  return (
    <View style={styles.home}>
      <Image source={HOME_GLOW} style={styles.homeGlow} />
      <Image source={HOME} style={[styles.homeMark, homeShadow]} resizeMode="contain" />
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen name="create" options={{ title: 'Create', tabBarIcon: ({ focused }) => <TabIcon name="add-circle-outline" focused={focused} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} /> }} />
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: () => <HomeButton /> }} />
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

  // Center brand button — flame+globe logo, raised, soft shaped glow behind.
  home: {
    width: HOME_W, height: HOME_H, marginTop: -18,
    alignItems: 'center', justifyContent: 'center',
  },
  homeGlow: {
    position: 'absolute',
    width: HGLOW_W, height: HGLOW_H,
    left: (HOME_W - HGLOW_W) / 2, top: (HOME_H - HGLOW_H) / 2,
    opacity: 0.5,
  },
  homeMark: { width: HOME_W, height: HOME_H },
})
