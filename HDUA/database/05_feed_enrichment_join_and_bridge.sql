-- ============================================================================
-- HDUA-02 (sub05) — HDCC ↔ HDUA connection hardening
-- Applied to live DB 2026-06-11 via Supabase MCP. Kept here for source control.
--
-- Two problems this fixes:
--   1. hdua_feed_items read enrichment (artist/cover/spotify/...) only from the
--      denormalized feed_posts columns, which are often stale/empty. The real
--      enrichment lives on story_clusters (and artist country on artists). The
--      view now COALESCEs feed_posts → story_clusters → artists so the feed
--      reflects the latest pipeline enrichment regardless of denormalization
--      timing. (Immediate effect: apple_music_url 0 → 17.)
--   2. No realtime path HDCC → HDUA. A trigger now broadcasts new feed rows on
--      the PUBLIC topic 'hdua:feed' so the anon app can refresh live, without
--      opening raw feed_posts to anon (content still flows through the SECURITY
--      DEFINER view only).
-- ============================================================================

-- 1) Enrichment-aware feed projection -----------------------------------------
CREATE OR REPLACE VIEW public.hdua_feed_items AS
SELECT fp.id,
    CASE fp.type
        WHEN 'track'::text THEN 'release'::text
        WHEN 'album'::text THEN 'release'::text
        WHEN 'video_release'::text THEN 'video'::text
        WHEN 'event'::text THEN 'event'::text
        ELSE 'release'::text
    END AS type,
    fp.title,
    COALESCE(fp.content, fp.summary, ''::text) AS content,
    COALESCE(fp.image_url, sc.selected_image_url, sc.image_url) AS cover_image,
    COALESCE(fp.artist, sc.artist_name, ar.name) AS artist,
    ar.country AS country,
    COALESCE(si.language_detected, si.language) AS language,
    COALESCE(si.category, sc.category) AS category,
    NULL::text AS subcategory,
    si.source,
    si.url AS source_url,
    COALESCE(si.attention_score, sc.max_attention_score, 0::double precision)::numeric AS score,
    COALESCE(fp.tags, '{}'::text[]) AS tags,
    fp.created_at,
    fp.created_at AS updated_at,
    COALESCE(si.published_at, fp.created_at) AS published_at,
    jsonb_build_object(
      'spotify_url', COALESCE(fp.spotify_url, sc.spotify_url),
      'youtube_url', COALESCE(fp.youtube_url, sc.youtube_url),
      'apple_music_url', COALESCE(fp.apple_music_url, sc.apple_music_url),
      'genius_url', COALESCE(fp.genius_url, sc.genius_url),
      'card_metadata', fp.card_metadata
    ) AS extra
   FROM feed_posts fp
     LEFT JOIN scout_items si ON si.id = fp.scout_item_id
     LEFT JOIN story_clusters sc ON sc.id = fp.cluster_id
     LEFT JOIN artists ar ON ar.id = COALESCE(fp.artist_id, sc.artist_id)
UNION ALL
 SELECT p.id,
    'article'::text AS type,
    p.title,
    COALESCE(p.summary, p.short_text, "left"(COALESCE(p.body, ''::text), 280)) AS content,
    COALESCE(p.selected_image_url, p.graphic_url, p.image_url) AS cover_image,
    NULL::text AS artist,
    NULL::text AS country,
    'en'::text AS language,
    p.category,
    p.droppz_type AS subcategory,
    p.source_name AS source,
    p.source_url,
    COALESCE(p.ai_score, 0)::numeric AS score,
    COALESCE(p.tags, '{}'::text[]) AS tags,
    p.created_at,
    p.updated_at,
    p.published_at,
    COALESCE(p.embeds, '[]'::jsonb) AS extra
   FROM posts p
  WHERE p.status = 'published'::text;

ALTER VIEW public.hdua_feed_items SET (security_invoker = off);
GRANT SELECT ON public.hdua_feed_items TO anon, authenticated;

-- 2) One-time backfill of stale feed_posts from their cluster (idempotent) -----
UPDATE feed_posts fp SET
  artist          = COALESCE(fp.artist, sc.artist_name),
  artist_id       = COALESCE(fp.artist_id, sc.artist_id),
  image_url       = COALESCE(fp.image_url, sc.selected_image_url, sc.image_url),
  spotify_url     = COALESCE(fp.spotify_url, sc.spotify_url),
  youtube_url     = COALESCE(fp.youtube_url, sc.youtube_url),
  apple_music_url = COALESCE(fp.apple_music_url, sc.apple_music_url),
  genius_url      = COALESCE(fp.genius_url, sc.genius_url)
FROM story_clusters sc
WHERE sc.id = fp.cluster_id
  AND (fp.artist IS NULL OR fp.image_url IS NULL OR fp.apple_music_url IS NULL
       OR fp.spotify_url IS NULL OR fp.youtube_url IS NULL OR fp.genius_url IS NULL);

-- 3) Realtime broadcast bridge ------------------------------------------------
CREATE OR REPLACE FUNCTION public.hdua_broadcast_new_feed_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object('id', NEW.id, 'title', NEW.title, 'type', NEW.type, 'created_at', NEW.created_at),
    'new_feed_item',
    'hdua:feed',
    false
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- broadcast failure must never block the pipeline insert
END;
$$;

DROP TRIGGER IF EXISTS hdua_feed_posts_broadcast ON public.feed_posts;
CREATE TRIGGER hdua_feed_posts_broadcast
AFTER INSERT ON public.feed_posts
FOR EACH ROW EXECUTE FUNCTION public.hdua_broadcast_new_feed_item();
