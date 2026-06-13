import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/stores/auth'
import { colors, glows, radius, spacing, typography } from '@/styles/theme'

type Mode = 'signIn' | 'signUp'

// Web-only: kill the default focus outline on inputs (RN types don't include it).
const webNoOutline = { outlineStyle: 'none' } as object

/**
 * Auth screen (HDUA-14 sub01) — email/password sign-in & registration plus
 * Google OAuth, in the HDCC venom language. Presented as a modal over the tabs.
 * On success the session listener (auth store) flips `status` and we dismiss;
 * when email confirmation is required we show a notice instead of dismissing.
 */
export default function AuthScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const status = useAuth((s) => s.status)
  const signIn = useAuth((s) => s.signInWithPassword)
  const signUp = useAuth((s) => s.signUp)
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle)

  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Once a session exists, leave the modal (covers password + OAuth return).
  useEffect(() => {
    if (status === 'authed') {
      if (router.canGoBack()) router.back()
      else router.replace('/')
    }
  }, [status, router])

  const isSignUp = mode === 'signUp'
  const canSubmit = email.includes('@') && password.length >= 6 && !busy

  async function onSubmit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (isSignUp) {
        const { needsConfirmation } = await signUp(email, password, displayName || undefined)
        if (needsConfirmation) {
          setNotice('Účet vytvořen. Potvrď e-mail v doručené poště a pak se přihlas.')
          setMode('signIn')
        }
      } else {
        await signIn(email, password)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Něco se pokazilo. Zkus to znovu.')
    } finally {
      setBusy(false)
    }
  }

  async function onGoogle() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google přihlášení selhalo.')
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.close} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>

        <View style={styles.brand}>
          <Ionicons name="flame" size={34} color={colors.accent} />
          <Text style={styles.brandText}>HotDroppZ</Text>
        </View>

        <Text style={styles.title}>{isSignUp ? 'Vytvoř si účet' : 'Vítej zpátky'}</Text>
        <Text style={styles.sub}>
          {isSignUp ? 'Pár vteřin a feed je tvůj.' : 'Přihlas se a pokračuj tam, kde jsi skončil.'}
        </Text>

        {/* Segmented mode switch */}
        <View style={styles.segment}>
          {(['signIn', 'signUp'] as Mode[]).map((m) => (
            <Pressable key={m} style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]} onPress={() => { setMode(m); setError(null) }}>
              <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                {m === 'signIn' ? 'Přihlásit' : 'Registrovat'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.form}>
          {isSignUp ? (
            <Field
              icon="person-outline"
              placeholder="Jméno (nepovinné)"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          ) : null}
          <Field
            icon="mail-outline"
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            icon="lock-closed-outline"
            placeholder="Heslo (min. 6 znaků)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Pressable style={[styles.submit, !canSubmit && styles.submitDisabled]} onPress={onSubmit} disabled={!canSubmit}>
            {busy ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.submitText}>{isSignUp ? 'Vytvořit účet' : 'Přihlásit se'}</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.divLine} />
            <Text style={styles.divText}>nebo</Text>
            <View style={styles.divLine} />
          </View>

          <Pressable style={styles.oauth} onPress={onGoogle} disabled={busy}>
            <Ionicons name="logo-google" size={18} color={colors.text} />
            <Text style={styles.oauthText}>Pokračovat přes Google</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Field(props: React.ComponentProps<typeof TextInput> & { icon: keyof typeof Ionicons.glyphMap }) {
  const { icon, ...input } = props
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={colors.textFaint} />
      <TextInput
        {...input}
        style={[styles.input, Platform.OS === 'web' ? webNoOutline : null]}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.accent}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  close: { alignSelf: 'flex-end', padding: spacing.xs },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xl },
  brandText: { color: colors.text, fontSize: typography.title, fontWeight: '900', letterSpacing: 0.5 },
  title: { color: colors.text, fontSize: typography.display, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: typography.body, marginTop: spacing.xs, marginBottom: spacing.xl },

  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 3, borderWidth: 1, borderColor: colors.border },
  segmentBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  segmentBtnActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.textMuted, fontSize: typography.label, fontWeight: '700' },
  segmentTextActive: { color: colors.bg },

  form: { marginTop: spacing.xl, gap: spacing.md },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
  },
  input: { flex: 1, color: colors.text, fontSize: typography.body, paddingVertical: spacing.md },

  error: { color: colors.danger, fontSize: typography.label, fontWeight: '600' },
  notice: { color: colors.accent, fontSize: typography.label, fontWeight: '600' },

  submit: {
    marginTop: spacing.sm, backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 50, ...glows.cta,
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: colors.bg, fontSize: typography.body, fontWeight: '800' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.sm },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  divText: { color: colors.textFaint, fontSize: typography.caption },

  oauth: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.md,
  },
  oauthText: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
})
