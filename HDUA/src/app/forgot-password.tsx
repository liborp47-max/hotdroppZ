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
 * Forgot-password screen (HDUA-27) — request a recovery e-mail. We never reveal
 * whether the address has an account (anti-enumeration); the success notice is
 * the same either way.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const requestReset = useAuth((s) => s.requestPasswordReset)

  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = email.includes('@') && !busy

  async function onSubmit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await requestReset(email)
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nepodařilo se odeslat. Zkus to znovu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.close} onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth'))} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.title}>Obnova hesla</Text>
        <Text style={styles.sub}>Zadej e-mail a pošleme ti odkaz na nastavení nového hesla.</Text>

        {sent ? (
          <ConfirmationNotice
            tone="success"
            message="Pokud k tomuto e-mailu existuje účet, poslali jsme na něj odkaz pro obnovu hesla."
          />
        ) : (
          <>
            <Field
              icon="mail-outline"
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            {error ? <ConfirmationNotice tone="error" message={error} /> : null}
            <Pressable style={[styles.submit, !canSubmit && styles.submitDisabled]} onPress={onSubmit} disabled={!canSubmit}>
              {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.submitText}>Poslat odkaz</Text>}
            </Pressable>
          </>
        )}

        <Pressable style={styles.backLink} onPress={() => router.replace('/auth')} hitSlop={8}>
          <Text style={styles.backText}>Zpět na přihlášení</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  close: { alignSelf: 'flex-end', padding: spacing.xs },
  title: { color: colors.text, fontSize: typography.display, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: typography.body, marginBottom: spacing.sm },
  submit: {
    marginTop: spacing.sm, backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 50, ...glows.cta,
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: colors.bg, fontSize: typography.body, fontWeight: '800' },
  backLink: { alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm },
  backText: { color: colors.textMuted, fontSize: typography.label, fontWeight: '600' },
})
