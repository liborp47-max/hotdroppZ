import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getAlerts, type Alert } from '@/api/user'
import { EmptyState } from '@/components/shared/EmptyState'
import { colors, radius, spacing, typography } from '@/styles/theme'
import { timeAgo } from '@/utils/text'

const PRIORITY_COLOR: Record<Alert['priority'], string> = {
  P0: colors.live, P1: colors.accent, P2: colors.warning, P3: colors.textFaint,
}

/** Alerts tab — P0/P1 drop radar (HDUA-02 `getAlerts`). */
export default function AlertsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { data, isLoading } = useQuery({ queryKey: ['alerts'], queryFn: () => getAlerts() })

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.heading}>Alerts</Text>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator
          ListEmptyComponent={<EmptyState icon="notifications-outline" title="Žádná upozornění" hint="P0/P1 dropy se objeví tady, jakmile je Trend Engine zachytí." />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => item.postId && router.push(`/post/${item.postId}`)}>
              <View style={[styles.badge, { backgroundColor: PRIORITY_COLOR[item.priority] }]}>
                <Text style={styles.badgeText}>{item.priority}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                {item.artist ? <Text style={styles.artist}>{item.artist}</Text> : null}
              </View>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  heading: { color: colors.text, fontSize: typography.title, fontWeight: '800', marginBottom: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  badge: { width: 34, height: 24, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.bg, fontSize: typography.caption, fontWeight: '800' },
  rowBody: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: typography.label, fontWeight: '600', lineHeight: 19 },
  artist: { color: colors.accent, fontSize: typography.caption, fontWeight: '600' },
  time: { color: colors.textFaint, fontSize: typography.caption },
})
