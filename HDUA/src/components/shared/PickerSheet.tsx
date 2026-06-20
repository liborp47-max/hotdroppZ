import { Ionicons } from '@expo/vector-icons'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useModalA11y } from '@/hooks/useModalA11y'
import { colors, radius, spacing, typography } from '@/styles/theme'

export type PickerOption = { value: string; label: string; sublabel?: string }

/**
 * Bottom-sheet option picker (HDUA-22) — language / country / single- or
 * multi-select taste pickers in Settings & Onboarding. Single-select closes on
 * pick; multi-select stays open with a "Hotovo" button. Web Esc + focus trap via
 * useModalA11y; mirrors the ShareSheet sheet language.
 */
export function PickerSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  multi = false,
}: {
  visible: boolean
  title: string
  options: PickerOption[]
  selected: string | string[]
  onSelect: (value: string) => void
  onClose: () => void
  multi?: boolean
}) {
  const insets = useSafeAreaInsets()
  const ref = useModalA11y(visible, onClose)
  const isSelected = (v: string) => (Array.isArray(selected) ? selected.includes(v) : selected === v)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Zavřít" />
      <View ref={ref} style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.grabber} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {options.map((opt) => {
            const sel = isSelected(opt.value)
            return (
              <Pressable
                key={opt.value}
                style={styles.option}
                onPress={() => {
                  onSelect(opt.value)
                  if (!multi) onClose()
                }}
                accessibilityRole={multi ? 'checkbox' : 'radio'}
                accessibilityState={{ selected: sel }}
              >
                <View style={styles.optTexts}>
                  <Text style={[styles.optLabel, sel && styles.optLabelActive]}>{opt.label}</Text>
                  {opt.sublabel ? <Text style={styles.optSub}>{opt.sublabel}</Text> : null}
                </View>
                {sel ? (
                  <Ionicons name={multi ? 'checkbox' : 'checkmark'} size={20} color={colors.accent} />
                ) : multi ? (
                  <Ionicons name="square-outline" size={20} color={colors.textFaint} />
                ) : null}
              </Pressable>
            )
          })}
        </ScrollView>

        {multi ? (
          <Pressable style={styles.done} onPress={onClose}>
            <Text style={styles.doneText}>Hotovo</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '80%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: typography.headline, fontWeight: '700' },
  list: { flexGrow: 0 },
  listContent: { paddingBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optTexts: { flex: 1, gap: 2 },
  optLabel: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  optLabelActive: { color: colors.accent },
  optSub: { color: colors.textFaint, fontSize: typography.label },
  done: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  doneText: { color: colors.bg, fontSize: typography.body, fontWeight: '800' },
})
