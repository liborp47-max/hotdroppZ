import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { deleteAccount, getSettings, updateSettings, type SettingsUpdate } from '@/api/user'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ConfirmationNotice, type NoticeTone } from '@/components/shared/ConfirmationNotice'
import { PickerSheet, type PickerOption } from '@/components/shared/PickerSheet'
import { SettingRow } from '@/components/shared/SettingRow'
import { useAuth } from '@/stores/auth'
import { colors, spacing, typography } from '@/styles/theme'

const LANGUAGES: PickerOption[] = [
  { value: 'en', label: 'English' },
  { value: 'cs', label: 'Čeština' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'pl', label: 'Polski' },
]
const langLabel = (v: string) => LANGUAGES.find((l) => l.value === v)?.label ?? v.toUpperCase()

// The hdua_settings row shape we read/optimistically patch in the query cache.
type SettingsRow = {
  user_id: string
  language: string | null
  push_enabled: boolean | null
  personalization_opt_out: boolean | null
  followed_artists: string[] | null
  followed_countries: string[] | null
  followed_genres: string[] | null
}

// Map a camelCase update onto the snake_case cached row for optimistic UI.
function applyPatch(row: Partial<SettingsRow>, patch: SettingsUpdate): Partial<SettingsRow> {
  const next = { ...row }
  if (patch.language !== undefined) next.language = patch.language
  if (patch.pushEnabled !== undefined) next.push_enabled = patch.pushEnabled
  if (patch.personalizationOptOut !== undefined) next.personalization_opt_out = patch.personalizationOptOut
  return next
}

/** Settings screen (HDUA-23) — gated; language, toggles, account actions. */
export default function SettingsScreen() {
  return (
    <RequireAuth title="Nastavení" hint="Přihlas se a uprav si jazyk, notifikace a účet.">
      <SettingsContent />
    </RequireAuth>
  )
}

function SettingsContent() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const qc = useQueryClient()
  const user = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null)
  const [langOpen, setLangOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // One mutation for every preference change; optimistic so toggles feel instant.
  const save = useMutation({
    mutationFn: (patch: SettingsUpdate) => updateSettings(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['settings'] })
      const prev = qc.getQueryData<SettingsRow>(['settings'])
      qc.setQueryData<Partial<SettingsRow>>(['settings'], applyPatch(prev ?? {}, patch))
      return { prev }
    },
    onError: (_err, _patch, ctx) => {
      qc.setQueryData(['settings'], ctx?.prev)
      setNotice({ tone: 'error', message: 'Nepodařilo se uložit. Zkus to znovu.' })
    },
    onSuccess: () => setNotice({ tone: 'success', message: 'Uloženo.' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  const del = useMutation({
    mutationFn: deleteAccount,
    onError: () =>
      setNotice({
        tone: 'error',
        message: 'Smazání účtu zatím není dostupné. Zkus to později nebo nás kontaktuj.',
      }),
    onSuccess: () => router.replace('/'),
  })

  const language = settings?.language ?? 'en'
  const pushEnabled = settings?.push_enabled !== false // default on
  const personalized = !settings?.personalization_opt_out // default on

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Nastavení</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {notice ? <ConfirmationNotice tone={notice.tone} message={notice.message} /> : null}

        {/* Preferences */}
        <Text style={styles.sectionTitle}>Předvolby</Text>
        <View style={styles.group}>
          <SettingRow
            icon="language-outline"
            title="Jazyk"
            value={langLabel(language)}
            onPress={() => setLangOpen(true)}
          />
          <SettingRow
            icon="notifications-outline"
            title="Push notifikace"
            subtitle="Upozornění na nové dropy a sledované umělce"
            right={
              <Switch
                value={pushEnabled}
                onValueChange={(v) => save.mutate({ pushEnabled: v })}
                trackColor={{ false: colors.surfaceHover, true: colors.accentDim }}
                thumbColor={pushEnabled ? colors.accent : colors.textFaint}
                ios_backgroundColor={colors.surfaceHover}
              />
            }
          />
          <SettingRow
            icon="sparkles-outline"
            title="Personalizace"
            subtitle="Doporučovat obsah podle tvé aktivity"
            right={
              <Switch
                value={personalized}
                onValueChange={(v) => save.mutate({ personalizationOptOut: !v })}
                trackColor={{ false: colors.surfaceHover, true: colors.accentDim }}
                thumbColor={personalized ? colors.accent : colors.textFaint}
                ios_backgroundColor={colors.surfaceHover}
              />
            }
          />
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>Účet</Text>
        <View style={styles.group}>
          <SettingRow icon="mail-outline" title="E-mail" value={user?.email ?? '—'} />
          <SettingRow icon="log-out-outline" title="Odhlásit se" onPress={() => setLogoutOpen(true)} />
          <SettingRow icon="trash-outline" title="Smazat účet" danger onPress={() => setDeleteOpen(true)} />
        </View>

        <Text style={styles.footer}>HotDroppZ · profil v1</Text>
      </ScrollView>

      {/* Language picker */}
      <PickerSheet
        visible={langOpen}
        title="Jazyk"
        options={LANGUAGES}
        selected={language}
        onSelect={(v) => save.mutate({ language: v })}
        onClose={() => setLangOpen(false)}
      />

      {/* Logout confirm */}
      <ConfirmDialog
        visible={logoutOpen}
        title="Odhlásit se?"
        message="Budeš se muset znovu přihlásit, abys viděl svůj profil a uložené dropy."
        confirmLabel="Odhlásit"
        onConfirm={() => {
          setLogoutOpen(false)
          signOut().catch(() => setNotice({ tone: 'error', message: 'Odhlášení selhalo.' }))
        }}
        onCancel={() => setLogoutOpen(false)}
      />

      {/* Delete-account confirm */}
      <ConfirmDialog
        visible={deleteOpen}
        title="Smazat účet?"
        message="Trvale odstraníme tvůj profil, lajky i uložené dropy. Tuto akci nelze vrátit."
        confirmLabel="Smazat navždy"
        destructive
        busy={del.isPending}
        onConfirm={() => del.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontSize: typography.headline, fontWeight: '800' },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  group: { gap: spacing.sm },
  footer: { color: colors.textFaint, fontSize: typography.caption, textAlign: 'center', marginTop: spacing.xl },
})
