import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { updateProfile, updateSettings } from '@/api/user'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { ConfirmationNotice } from '@/components/shared/ConfirmationNotice'
import { PickerSheet, type PickerOption } from '@/components/shared/PickerSheet'
import { SelectableChip } from '@/components/shared/SelectableChip'
import { colors, glows, radius, spacing, typography } from '@/styles/theme'

// Static taxonomy seeds — stable, so onboarding works regardless of pipeline
// data (decision: static seed over an endpoint that can return empty).
const GENRES = ['Rap', 'Trap', 'Drill', 'Boom Bap', 'Afrobeats', 'R&B', 'Grime', 'Cloud Rap', 'Hyperpop', 'Amapiano', 'Pop', 'Dancehall']
const ARTISTS = ['Yzomandias', 'Viktor Sheen', 'Calin', 'Nik Tendo', 'Rytmus', 'Separ', 'Apache 207', 'RAF Camora', 'Ufo361', 'Ninho', 'SCH', 'Central Cee', 'Travis Scott', 'Drake', 'Sfera Ebbasta', 'Quevedo']
const COUNTRIES: PickerOption[] = [
  { value: 'cz', label: 'Česko' }, { value: 'sk', label: 'Slovensko' }, { value: 'de', label: 'Německo' },
  { value: 'fr', label: 'Francie' }, { value: 'es', label: 'Španělsko' }, { value: 'it', label: 'Itálie' },
  { value: 'pl', label: 'Polsko' }, { value: 'nl', label: 'Nizozemsko' }, { value: 'ru', label: 'Rusko' },
  { value: 'sr', label: 'Srbsko' }, { value: 'hr', label: 'Chorvatsko' }, { value: 'bs', label: 'Bosna' },
]
const LANGUAGES: PickerOption[] = [
  { value: 'cs', label: 'Čeština' }, { value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' }, { value: 'es', label: 'Español' }, { value: 'pl', label: 'Polski' },
]
const langLabel = (v: string) => LANGUAGES.find((l) => l.value === v)?.label ?? v

const STEPS = ['welcome', 'genres', 'artists', 'countries', 'notifications'] as const
const TOTAL = STEPS.length

/** Onboarding flow (P1-004) — first-run taste + preferences, gated on
 *  profile.onboarding_completed (OnboardingGate redirects here). */
export default function OnboardingScreen() {
  return (
    <RequireAuth title="Vítej v HotDroppZ" hint="Přihlas se a nastav si feed na míru.">
      <OnboardingContent />
    </RequireAuth>
  )
}

function OnboardingContent() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const qc = useQueryClient()

  const [step, setStep] = useState(0)
  const [genres, setGenres] = useState<string[]>([])
  const [artists, setArtists] = useState<string[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [pushEnabled, setPushEnabled] = useState(true)
  const [language, setLanguage] = useState('cs')
  const [langOpen, setLangOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      const row = await updateProfile({ onboardingCompleted: true })
      await updateSettings({
        followedGenres: genres,
        followedArtists: artists,
        followedCountries: countries,
        language,
        pushEnabled,
      })
      // Seed the cache so OnboardingGate sees completion immediately (no loop).
      qc.setQueryData(['profile'], row)
      qc.invalidateQueries({ queryKey: ['settings'] })
      router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení selhalo. Zkus to znovu.')
      setBusy(false)
    }
  }

  const isLast = step === TOTAL - 1
  const next = () => (isLast ? finish() : setStep((s) => s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      {/* Progress dots */}
      <View style={styles.progress}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <View style={styles.welcome}>
            <Ionicons name="flame" size={44} color={colors.accent} />
            <Text style={styles.title}>Pojďme to nastavit</Text>
            <Text style={styles.sub}>Pár ťuknutí a feed bude tvůj — žánry, umělci a země, co tě baví.</Text>
          </View>
        ) : null}

        {step === 1 ? (
          <Step title="Co posloucháš?" sub="Vyber žánry, které tě zajímají.">
            <View style={styles.chips}>
              {GENRES.map((g) => (
                <SelectableChip key={g} label={g} selected={genres.includes(g)} onPress={() => toggle(genres, setGenres, g)} />
              ))}
            </View>
          </Step>
        ) : null}

        {step === 2 ? (
          <Step title="Koho sleduješ?" sub="Přidej si oblíbené umělce.">
            <View style={styles.chips}>
              {ARTISTS.map((a) => (
                <SelectableChip key={a} label={a} selected={artists.includes(a)} onPress={() => toggle(artists, setArtists, a)} />
              ))}
            </View>
          </Step>
        ) : null}

        {step === 3 ? (
          <Step title="Odkud?" sub="Scény, které chceš sledovat.">
            <View style={styles.chips}>
              {COUNTRIES.map((c) => (
                <SelectableChip
                  key={c.value}
                  label={c.label}
                  selected={countries.includes(c.value)}
                  onPress={() => toggle(countries, setCountries, c.value)}
                />
              ))}
            </View>
          </Step>
        ) : null}

        {step === 4 ? (
          <Step title="Poslední krok" sub="Notifikace a jazyk.">
            <View style={styles.prefRow}>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>Push notifikace</Text>
                <Text style={styles.prefSub}>Upozornění na nové dropy</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: colors.surfaceHover, true: colors.accentDim }}
                thumbColor={pushEnabled ? colors.accent : colors.textFaint}
                ios_backgroundColor={colors.surfaceHover}
              />
            </View>
            <Pressable style={styles.prefRow} onPress={() => setLangOpen(true)}>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>Jazyk</Text>
                <Text style={styles.prefSub}>{langLabel(language)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          </Step>
        ) : null}

        {error ? <ConfirmationNotice tone="error" message={error} /> : null}
      </ScrollView>

      {/* Footer nav */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.footerRow}>
          {step > 0 ? (
            <Pressable style={styles.secondary} onPress={back} disabled={busy}>
              <Text style={styles.secondaryText}>Zpět</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.secondary} onPress={finish} disabled={busy}>
              <Text style={styles.secondaryText}>Přeskočit</Text>
            </Pressable>
          )}
          <Pressable style={[styles.primary, busy && styles.primaryDisabled]} onPress={next} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryText}>{step === 0 ? 'Začít' : isLast ? 'Hotovo' : 'Pokračovat'}</Text>
            )}
          </Pressable>
        </View>
      </View>

      <PickerSheet
        visible={langOpen}
        title="Jazyk"
        options={LANGUAGES}
        selected={language}
        onSelect={(v) => setLanguage(v)}
        onClose={() => setLangOpen(false)}
      />
    </View>
  )
}

function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  progress: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginBottom: spacing.xl },
  dot: { width: 28, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHover },
  dotActive: { backgroundColor: colors.accent },
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  step: { gap: spacing.sm },
  title: { color: colors.text, fontSize: typography.display, fontWeight: '800', textAlign: 'center' },
  sub: { color: colors.textMuted, fontSize: typography.body, textAlign: 'center', marginBottom: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  prefRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginBottom: spacing.sm,
  },
  prefText: { flex: 1, gap: 2 },
  prefTitle: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  prefSub: { color: colors.textFaint, fontSize: typography.label },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  footerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  secondary: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  secondaryText: { color: colors.textMuted, fontSize: typography.body, fontWeight: '700' },
  primary: {
    flex: 1, backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 50, ...glows.cta,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: colors.bg, fontSize: typography.body, fontWeight: '800' },
})
