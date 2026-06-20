import { useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getProfile, updateProfile, uploadAvatar, type ProfileUpdate } from '@/api/user'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { Avatar } from '@/components/shared/Avatar'
import { ConfirmationNotice, type NoticeTone } from '@/components/shared/ConfirmationNotice'
import { Field } from '@/components/shared/Field'
import { PickerSheet, type PickerOption } from '@/components/shared/PickerSheet'
import { colors, spacing, typography } from '@/styles/theme'

const BIO_MAX = 280
const USERNAME_RE = /^[a-z0-9_]{3,30}$/

const COUNTRIES: PickerOption[] = [
  { value: 'cz', label: 'Česko' },
  { value: 'sk', label: 'Slovensko' },
  { value: 'de', label: 'Německo' },
  { value: 'fr', label: 'Francie' },
  { value: 'es', label: 'Španělsko' },
  { value: 'it', label: 'Itálie' },
  { value: 'pl', label: 'Polsko' },
  { value: 'nl', label: 'Nizozemsko' },
  { value: 'ru', label: 'Rusko' },
  { value: 'sr', label: 'Srbsko' },
  { value: 'hr', label: 'Chorvatsko' },
  { value: 'bs', label: 'Bosna' },
]
const countryLabel = (v?: string | null) => COUNTRIES.find((c) => c.value === v)?.label ?? '—'

// Web image pick without a native dependency (app is web-first). Returns the
// chosen file as a Blob + its mime type, or null when cancelled.
async function pickImageWeb(): Promise<{ blob: Blob; type: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp'
    input.onchange = () => {
      const file = input.files?.[0]
      resolve(file ? { blob: file, type: file.type || 'image/jpeg' } : null)
    }
    input.click()
  })
}

/** Edit profile (HDUA-24) — gated; name/username/bio/country + avatar. */
export default function EditProfileScreen() {
  return (
    <RequireAuth title="Upravit profil" hint="Přihlas se a uprav si profil.">
      <EditProfileContent />
    </RequireAuth>
  )
}

function EditProfileContent() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: getProfile })

  const [displayName, setDisplayName] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [bio, setBio] = useState<string | null>(null)
  const [country, setCountry] = useState<string | null>(null)
  const [countryOpen, setCountryOpen] = useState(false)
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  // Controlled values fall back to the loaded profile until the user edits them.
  const nameVal = displayName ?? profile?.display_name ?? ''
  const userVal = username ?? profile?.username ?? ''
  const bioVal = bio ?? profile?.bio ?? ''
  const countryVal = country ?? profile?.country ?? ''
  const avatarUrl = profile?.avatar_url ?? null

  const usernameInvalid = userVal.trim().length > 0 && !USERNAME_RE.test(userVal.trim().toLowerCase())
  const bioInvalid = bioVal.length > BIO_MAX

  const save = useMutation({
    mutationFn: (patch: ProfileUpdate) => updateProfile(patch),
    onSuccess: (row) => {
      qc.setQueryData(['profile'], row)
      setNotice({ tone: 'success', message: 'Profil uložen.' })
    },
    onError: (e) => setNotice({ tone: 'error', message: e instanceof Error ? e.message : 'Uložení selhalo.' }),
  })

  function onSave() {
    if (usernameInvalid || bioInvalid) {
      setNotice({ tone: 'error', message: 'Zkontroluj uživatelské jméno a bio.' })
      return
    }
    const patch: ProfileUpdate = {
      displayName: nameVal.trim(),
      bio: bioVal.trim(),
      country: countryVal || undefined,
    }
    // Only touch username when a valid value is present (empty keeps the old one).
    const u = userVal.trim().toLowerCase()
    if (u.length > 0) patch.username = u
    save.mutate(patch)
  }

  async function onPickAvatar() {
    if (Platform.OS !== 'web') {
      setNotice({ tone: 'info', message: 'Nahrání avataru je zatím dostupné na webu.' })
      return
    }
    const picked = await pickImageWeb()
    if (!picked) return
    setUploading(true)
    setNotice(null)
    try {
      await uploadAvatar(picked.blob, picked.type)
      await qc.invalidateQueries({ queryKey: ['profile'] })
      setNotice({ tone: 'success', message: 'Avatar nahrán.' })
    } catch (e) {
      setNotice({ tone: 'error', message: e instanceof Error ? e.message : 'Nahrání selhalo.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Upravit profil</Text>
        <Pressable onPress={onSave} hitSlop={10} style={styles.iconBtn} disabled={save.isPending}>
          <Text style={[styles.saveText, save.isPending && styles.saveDisabled]}>Uložit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {notice ? <ConfirmationNotice tone={notice.tone} message={notice.message} /> : null}

        <View style={styles.avatarRow}>
          <Avatar uri={avatarUrl} name={nameVal} size={88} editable onPress={onPickAvatar} />
          <Pressable onPress={onPickAvatar} disabled={uploading}>
            <Text style={styles.avatarHint}>{uploading ? 'Nahrávám…' : 'Změnit fotku'}</Text>
          </Pressable>
        </View>

        <Field label="Jméno" placeholder="Tvé jméno" value={nameVal} onChangeText={setDisplayName} autoCapitalize="words" />

        <View>
          <Field
            label="Uživatelské jméno"
            icon="at-outline"
            placeholder="prezdivka"
            value={userVal}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.help, usernameInvalid && styles.helpError]}>
            {usernameInvalid ? '3–30 znaků, jen malá písmena, čísla a _' : 'Malá písmena, čísla a podtržítko (3–30).'}
          </Text>
        </View>

        <View>
          <Field
            label="Bio"
            placeholder="Něco o tobě…"
            value={bioVal}
            onChangeText={setBio}
            multiline
            maxLength={BIO_MAX}
          />
          <Text style={[styles.help, bioInvalid && styles.helpError]}>{bioVal.length}/{BIO_MAX}</Text>
        </View>

        <Pressable onPress={() => setCountryOpen(true)}>
          <Field
            label="Země"
            icon="flag-outline"
            placeholder="Vyber zemi"
            value={countryLabel(countryVal)}
            editable={false}
            pointerEvents="none"
          />
        </Pressable>
      </ScrollView>

      <PickerSheet
        visible={countryOpen}
        title="Země"
        options={COUNTRIES}
        selected={countryVal}
        onSelect={(v) => setCountry(v)}
        onClose={() => setCountryOpen(false)}
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
  iconBtn: { minWidth: 56, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontSize: typography.headline, fontWeight: '800' },
  saveText: { color: colors.accent, fontSize: typography.body, fontWeight: '800' },
  saveDisabled: { opacity: 0.4 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  avatarRow: { alignItems: 'center', gap: spacing.sm },
  avatarHint: { color: colors.accent, fontSize: typography.label, fontWeight: '700' },
  help: { color: colors.textFaint, fontSize: typography.caption, marginTop: spacing.xs, marginLeft: spacing.xs },
  helpError: { color: colors.danger },
})
