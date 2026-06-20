import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { useModalA11y } from '@/hooks/useModalA11y'
import { colors, radius, spacing, typography } from '@/styles/theme'

/**
 * Centered confirm dialog (HDUA-22) — "Opravdu se odhlásit?", "Smazat účet?".
 * `destructive` paints the confirm button red; `busy` swaps it for a spinner and
 * locks both buttons. Web Esc + focus trap via useModalA11y (Esc = cancel).
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Potvrdit',
  cancelLabel = 'Zrušit',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useModalA11y(visible, onCancel)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.center}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Zavřít" />
        <View ref={ref} style={styles.dialog} accessibilityViewIsModal accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel} disabled={busy}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, destructive ? styles.danger : styles.confirm]}
              onPress={onConfirm}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={destructive ? colors.text : colors.bg} />
              ) : (
                <Text style={[styles.confirmText, destructive && styles.dangerText]}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing.xl },
  dialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: { color: colors.text, fontSize: typography.headline, fontWeight: '800' },
  message: { color: colors.textMuted, fontSize: typography.body, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  btn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  cancel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  confirm: { backgroundColor: colors.accent },
  confirmText: { color: colors.bg, fontSize: typography.body, fontWeight: '800' },
  danger: { backgroundColor: colors.danger },
  dangerText: { color: colors.text },
})
