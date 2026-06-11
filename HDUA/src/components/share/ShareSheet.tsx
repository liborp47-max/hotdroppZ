import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SHARE_PLATFORMS, buildShareText } from '@/content/share-templates'
import { shareTo, shareUrlFor } from '@/lib/share'
import { useShareSheet } from '@/stores/shareSheet'
import { colors, radius, spacing, typography } from '@/styles/theme'

/**
 * Global share sheet (HDUA-07 "share"). Rendered once at the root; opened from any
 * post via useShareSheet.open(item). Shows the social platforms (templates from
 * content/share-templates.ts) plus a preview of the generated caption.
 */
export function ShareSheet() {
  const insets = useSafeAreaInsets()
  const item = useShareSheet((s) => s.item)
  const close = useShareSheet((s) => s.close)
  const [toast, setToast] = useState<string | null>(null)

  const onPick = async (key: string) => {
    if (!item) return
    try {
      const res = await shareTo(item, key)
      if (res === 'copied') {
        setToast('Zkopírováno do schránky')
        setTimeout(() => setToast(null), 1500)
        return
      }
    } catch {
      /* user cancelled / no app */
    }
    close()
  }

  const preview = item ? buildShareText(
    { title: item.title, artist: item.artist, category: item.category, type: item.type, sourceUrl: item.sourceUrl },
    shareUrlFor(item),
    'generic',
  ) : ''

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.grabber} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Sdílet</Text>
          <Pressable onPress={close} hitSlop={10}><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable>
        </View>

        {item ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>NÁHLED</Text>
            <Text style={styles.previewText} numberOfLines={4}>{preview}</Text>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.platforms}>
          {SHARE_PLATFORMS.map((p) => (
            <Pressable key={p.key} style={styles.platform} onPress={() => onPick(p.key)}>
              <View style={[styles.platformIcon, { backgroundColor: p.brandColor === '#000000' || p.brandColor === '#010101' ? colors.surface : p.brandColor }]}>
                <Ionicons name={p.icon as keyof typeof Ionicons.glyphMap} size={24} color={colors.text} />
              </View>
              <Text style={styles.platformLabel}>{p.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {toast ? (
          <View style={styles.toast}><Ionicons name="checkmark-circle" size={16} color={colors.accent} /><Text style={styles.toastText}>{toast}</Text></View>
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { color: colors.text, fontSize: typography.headline, fontWeight: '700' },
  previewBox: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  previewLabel: { color: colors.textFaint, fontSize: typography.caption, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  previewText: { color: colors.textMuted, fontSize: typography.label, lineHeight: 19 },
  platforms: { gap: spacing.lg, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  platform: { alignItems: 'center', gap: spacing.sm, width: 64 },
  platformIcon: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  platformLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '600' },
  toast: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  toastText: { color: colors.text, fontSize: typography.label },
})
