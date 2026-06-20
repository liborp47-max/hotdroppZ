import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ConfirmationNotice } from '@/components/shared/ConfirmationNotice'
import { Field } from '@/components/shared/Field'
import { useAuth } from '@/stores/auth'
import { colors, glows, radius, spacing, typography } from '@/styles/theme'

/**
 * Reset-password screen (HDUA-27) — reached from the recovery e-mail link. The
 * link drops the user back here with a recovery session (web: detectSessionInUrl;
 * native: deep link), so `status === 'authed'`. We then set the new password via
 * updateUser. Without that session the link is expired/invalid.
 */
export default function ResetPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const status = useAuth((s) => s.status)
  const updatePassword = useAuth((s) => s.updatePassword)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = password.length >= 6 && password === confirm && !busy

  async function onSubmit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nepodařilo se změnit heslo.')
    } finally {
      setBusy(false)
    }
  }

  // No recovery session → the link is invalid or expired.
  const noSession = status === 'guest'

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Nové heslo</Text>

        {done ? (
          <>
            <ConfirmationNotice tone="success" message="Heslo bylo změněno. Teď se s ním můžeš přihlásit." />
            <Pressable style={styles.submit} onPress={() => router.replace('/')}>
              <Text style={styles.submitText}>Pokračovat</Text>
            </Pressable>
          </>
        ) : noSession ? (
          <>
            <ConfirmationNotice tone="error" message="Odkaz pro obnovu hesla je neplatný nebo vypršel. Vyžádej si nový." />
            <Pressable style={styles.submit} onPress={() => router.replace('/forgot-password')}>
              <Text style={styles.submitText}>Vyžádat nový odkaz</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sub}>Zvol si nové heslo (min. 6 znaků).</Text>
            <Field
              icon="lock-closed-outline"
              placeholder="Nové heslo"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <Field
              icon="lock-closed-outline"
              placeholder="Heslo znovu"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
            />
            {mismatch ? <ConfirmationNotice tone="error" message="Hesla se neshodují." /> : null}
            {error ? <ConfirmationNotice tone="error" message={error} /> : null}
            <Pressable style={[styles.submit, !canSubmit && styles.submitDisabled]} onPress={onSubmit} disabled={!canSubmit}>
              {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.submitText}>Změnit heslo</Text>}
            </Pressable>
          </>
        )}

        <Pressable style={styles.backLink} onPress={() => router.replace('/auth')} hitSlop={8}>
          <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          <Text style={styles.backText}>Zpět na přihlášení</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { color: colors.text, fontSize: typography.display, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: typography.body, marginBottom: spacing.sm },
  submit: {
    marginTop: spacing.sm, backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 50, ...glows.cta,
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: colors.bg, fontSize: typography.body, fontWeight: '800' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm },
  backText: { color: colors.textMuted, fontSize: typography.label, fontWeight: '600' },
})
