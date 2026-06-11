import { ScreenScaffold } from '@/components/shared/ScreenScaffold'
import { EmptyState } from '@/components/shared/EmptyState'

/** Profile tab — settings, history, followed artists. Auth gate + data later. */
export default function ProfileScreen() {
  return (
    <ScreenScaffold title="Profile" subtitle="Settings · history · saved">
      <EmptyState icon="person-outline" title="Profil" hint="Přihlášení (Supabase), historie a nastavení — auth gate v HDUA-03, data v HDUA-02." />
    </ScreenScaffold>
  )
}
