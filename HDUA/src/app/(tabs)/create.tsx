import { ScreenScaffold } from '@/components/shared/ScreenScaffold'
import { EmptyState } from '@/components/shared/EmptyState'

/** Create tab — user submissions / boosts. Scope defined in a later mission. */
export default function CreateScreen() {
  return (
    <ScreenScaffold title="Create">
      <EmptyState icon="add-circle-outline" title="Create" hint="Uživatelské příspěvky a boosty — rozsah upřesní pozdější mise." />
    </ScreenScaffold>
  )
}
