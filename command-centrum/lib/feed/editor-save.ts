/**
 * Editor save payload builder — pure function, unit-testable without DOM.
 *
 * UM-FEED_SCHEMA_AND_EDITOR_DONE sub-03. handleSave in app/(dashboard)/feed/
 * editor/page.tsx was previously building the PUT body inline. Extracting it
 * here makes the contract regression-testable AND lets future stages (bulk
 * save, autosave) reuse the same shape.
 *
 * Contract (matches /api/feed/[id] PUT body shape):
 *   - All editorial fields optional; missing keys leave server state intact.
 *   - image_url omitted (not just null) when empty so PUT doesn't blank it.
 *   - metadata is deep-merged on the server (route.ts:107) so we send the
 *     incremental seo block, not the whole metadata object.
 */

import type { FeedPostRow } from '@/lib/supabase/feed-admin'

export interface EditorDraft {
  headline: string
  content: string
  status: FeedPostRow['status']
  platforms: string[]
  languages: string[]
  imageUrl: string
  metaTitle: string
  metaDescription: string
  slug: string
}

export interface EditorSavePayload {
  headline: string
  content: string
  status: FeedPostRow['status']
  platforms: string[]
  languages: string[]
  image_url?: string
  metadata: { seo: { metaTitle: string; metaDescription: string; slug: string } }
}

export function buildEditorSavePayload(draft: EditorDraft): EditorSavePayload {
  const payload: EditorSavePayload = {
    headline: draft.headline,
    content: draft.content,
    status: draft.status,
    platforms: draft.platforms,
    languages: draft.languages,
    metadata: {
      seo: {
        metaTitle: draft.metaTitle,
        metaDescription: draft.metaDescription,
        slug: draft.slug,
      },
    },
  }
  if (draft.imageUrl) {
    payload.image_url = draft.imageUrl
  }
  return payload
}
