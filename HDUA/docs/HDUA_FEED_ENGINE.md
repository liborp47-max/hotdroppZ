# HDUA — Feed Engine

How content gets from the `hdua_feed_items` view onto the screen. The "engine" here
is client-side: fetch → map → cache → paginate → render → keep live. Heavy ranking
(clustering, enrichment, scoring) happens upstream in HDCC, not in the app.

## Fetch layer — `src/api/content.ts`

| Function | Source | Ordering |
|----------|--------|----------|
| `getFeed` / `getLatest` | `hdua_feed_items` | `published_at` desc, cursor-paginated |
| `getTrending` | `hdua_feed_items` | `score` desc |
| `getRecommended` | RPC `hdua_recommended_feed` (engagement × quality × freshness) | falls back to `getTrending` if the RPC is unavailable — surface never breaks |
| `getPost` | `hdua_feed_items` by id | + related: same category, newest 6, excluding self |
| `search` | `ilike` over `title` | `published_at` desc |
| `searchArtists` | distinct non-null `artist` | client-deduped |

## Cursor pagination

Cursor = `publishedAt` of the last item in the previous page. `getFeed` applies
`.lt('published_at', cursor)` and returns `nextCursor` only when a full page came
back (`items.length === limit`, default 20). Trending/recommended are single-page
(`nextCursor: null`).

## Mapping — `src/api/mappers.ts`

`mapFeedItem` / `mapPost` turn raw view rows into domain types (`FeedItem`, `Post`).
`mapPost` extends `FeedItem` with `body` + `embeds`/`related`; null content → empty
string. Entity/HTML decoding (`decodeEntities`) and number/time formatting live here
and are unit-tested (`tests/mappers.test.ts`, `tests/text.test.ts`).

## React Query hooks — `src/hooks/`

- `useFeed(kind)` — infinite query over `getFeed`/`getTrending`/`getRecommended`;
  `fetchNextPage` on near-end.
- `usePost(id)` — single post + related.
- `useFeedRealtime()` — subscribes to the Supabase realtime topic **`hdua:feed`**,
  broadcast by an HDCC `AFTER INSERT` trigger on `feed_posts`
  (`05_feed_enrichment_join_and_bridge.sql`). New drops invalidate the feed query so
  they appear without a manual refresh — anon never reads raw `feed_posts`, only the view.

## Render surfaces

- **`feed/FeedPager.tsx`** — full-screen vertical pager (HDUA-06), one post per page,
  native paging; a single Reanimated `scrollY` drives parallax on the UI thread and
  feeds the global scrollbar (`sbProgress`/`sbThumbFraction`).
- **`app/post/[id].tsx`** — continuous reader (HDUA-07): opens the tapped post, then
  streams the following feed inline (FlashList) so scrolling flows into the next article.

## Quality / freshness contract

`getRecommended` degrades to trending, `search` returns `[]` on empty term, every
fetch throws a labelled error on Supabase failure (caller/React-Query handles retry).
The feed reflects pipeline truth: an article shows up only when HDCC publishes it,
and media/enrichment is only as rich as the pipeline's enrichment stage produced.

Related: [HDUA_DATABASE.md](HDUA_DATABASE.md), [HDUA_API.md](HDUA_API.md).
