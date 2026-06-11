# CLAUDE.md — Command Centrum

## Purpose

Internal ops dashboard for HotDroppZ editors. Runs and monitors the full AI content pipeline.
URL: admin.hotdroppz.com · Auth: Supabase (admin/editor/viewer roles)

---

## Testing (AUD-CODE-001)

All `test:*` scripts run with **`tsx --test`** — NOT `node --experimental-strip-types`.
`tsx` resolves extensionless relative imports (`from './x'`), `@/` tsconfig path aliases,
and full TS syntax (enums, constructor parameter properties) exactly like the Next build.
`--experimental-strip-types` does none of these, so a strip-types test silently breaks the
moment it loads a module using any of them. **Do not reintroduce `--experimental-strip-types`
in test scripts.** There is no master `test` script — add new suites as a `test:*` entry AND
wire them into `.github/workflows/command-centrum-quality.yml` (else they never run in CI).

---

## Architecture

```
Next.js 16 (App Router)
  ├── app/(auth)/         Login page
  ├── app/(dashboard)/    All protected dashboard pages
  │     ├── overview/     Pipeline status + run controls
  │     ├── scout/        Scout run history
  │     ├── inbox/        Raw SCOUTED items
  │     ├── curated/      CURATED items (scored)
  │     ├── clusters/     Story clusters
  │     ├── writer/       Posts from writer stage
  │     ├── cms/          Full post editor + publish controls
  │     ├── pipeline/     Real-time pipeline monitor
  │     ├── monetization/ Ad campaigns + slots
  │     ├── analytics/    Post analytics
  │     ├── sources/      RSS source management
  │     └── learning/     Feedback loop + model scoring
  ├── app/api/            Route handlers (pipeline triggers)
  ├── lib/
  │     ├── pipeline/     Core pipeline logic (TS)
  │     ├── actions/      Server actions (Next.js)
  │     ├── services/     External integrations (Spotify, YouTube, Genius)
  │     ├── supabase/     DB client setup
  │     ├── types/        Shared TypeScript types
  │     └── utils/        Shared utilities
  ├── components/         UI components (shadcn + custom)
  └── supabase/           DB migrations + schemas
```

---

## Pipeline API Routes

| Route | Triggers |
|-------|---------|
| `POST /api/scout/run` | Scout: fetch RSS sources → store as SCOUTED |
| `POST /api/filter/run` | Filter: discard low-quality SCOUTED items |
| `POST /api/translator/run` | Translate SCOUTED → EN → TRANSLATED |
| `POST /api/curator/run` | Score TRANSLATED items → CURATED |
| `POST /api/cluster/run` | Cluster CURATED items → story_clusters |
| `POST /api/enrichment/run` | Enrich clusters with media (Spotify/YouTube) |
| `POST /api/writer/run` | Write articles from clusters → posts |
| `POST /api/feed/run` | Build feed_posts from clusters |
| `POST /api/multilang/run` | Localize posts to CS/DE/PL/FR |
| `POST /api/monetizer/run` | Score posts for monetization → post_monetization |

---

## DB Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `scout_items` | Raw scouted content, status flow |
| `curated_items` | Legacy scoring table (linked to scout_items) |
| `story_clusters` | Grouped stories (entity-based Jaccard clustering) |
| `story_cluster_sources` | Links clusters → scout_items |
| `posts` | Final articles (draft/approved/published) |
| `feed_posts` | Feed cards (MusicCard/AlbumCard/VideoCard/EventCard) |
| `scout_sources` | RSS feed registry |
| `scout_runs` | Pipeline run history |
| `ad_campaigns` | Ad campaign management |
| `ad_slots` | Ad placement slots |
| `post_monetization` | AI-powered monetization scores per post |

---

## File Ownership

| File | Single source of truth for |
|------|--------------------------|
| `lib/pipeline/prompts.ts` | ALL system prompts — never inline prompts elsewhere |
| `lib/pipeline/ai.ts` | All Groq AI calls |
| `lib/pipeline/droppz-detector.ts` | Release classification, priority assignment |
| `lib/pipeline/cluster.ts` | Entity extraction, Jaccard similarity, cluster logic |
| `lib/types/index.ts` | All TypeScript interfaces |
| `supabase/MASTER_SCHEMA.sql` | Canonical DB schema |

---

## Rules

- Server actions: `'use server'` + `requireAuth()` guard on all mutations
- Admin operations: use `createAdminClient()` (bypasses RLS) for pipeline writes
- Pipeline stages: always use `.eq('status', 'CURRENT_STATUS')` guard on DB updates to prevent double-processing
- Error handling: never throw from pipeline — log + return fallback
- Components: shadcn/ui base, custom cards in `components/cards/`, shared UI in `components/shared/`
- Prompts: versioned in `lib/pipeline/prompts.ts`. Add new versions as `PROMPT_NAME_V2`, keep V1 for fallback A/B testing

---

## Brand Constants (use in prompts)

```
Platform: HotDroppZ — EU's fastest urban intelligence platform
Voice: Short sentences. No bullshit. Strong hooks. Street credibility > formal journalism.
Forbidden: "As an AI...", "According to reports...", "It has been reported..."
```

---

## Adding a Pipeline Stage

1. Create `lib/pipeline/my-stage.ts` — export `runMyStage(db)`
2. Add system prompt to `lib/pipeline/prompts.ts`
3. Create `app/api/my-stage/run/route.ts` — standard POST handler
4. Add DB migration if needed in `supabase/schema-my-stage.sql`
5. Add queue counter to `lib/pipeline/state.ts` → `getPipelineState()`
6. Add button to `app/(dashboard)/hd-central/hd-central-client.tsx`
