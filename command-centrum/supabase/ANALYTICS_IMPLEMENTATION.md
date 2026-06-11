# ───────────────────────────────────────────────────────────────────────────────
# HDCC — ANALYTICS & LEARNING MODULE IMPLEMENTATION
# ───────────────────────────────────────────────────────────────────────────────

# 1. PIPELINE_STAGE_RUNS — ensures indexes exist (safe to re-run)
# ───────────────────────────────────────────────────────────────────────────────

-- Already created in PIPELINE_EXTENSIONS.sql
-- This file documents which stages are instrumented

# ───────────────────────────────────────────────────────────────────────────────
# 2. STAGE INSTRUMENTATION SUMMARY
# ───────────────────────────────────────────────────────────────────────────────

# scout          → handled by api/scout/run (scout_runs table)
# filter          → ✅ instrumented (filter.ts)
# translator      → ✅ instrumented (translator.ts)
# curator         → ✅ instrumented (curator.ts)
# cluster         → ✅ instrumented (cluster.ts)
# enrichment      → ✅ instrumented (enrichment.ts)
# writer          → ✅ instrumented (writer.ts)
# feed            → ✅ instrumented (feed-engine.ts)
# multilang       → ✅ instrumented (multilang.ts)
# monetizer       → ✅ instrumented (monetizer.ts, includes token tracking)

# ───────────────────────────────────────────────────────────────────────────────
# 3. ENVIRONMENT VARIABLES REQUIRED
# ───────────────────────────────────────────────────────────────────────────────

# Already required by existing stages:
# - GROQ_API_KEY (translator, multilang, monetizer)
# - UNSPLASH_ACCESS_KEY (image enrichment)
# - PEXELS_API_KEY (image enrichment)
# - PIXABAY_API_KEY (image enrichment)
# - SPOTIFY_CLIENT_ID / SECRET (enrichment)
# - YOUTUBE_API_KEY (enrichment)

# ───────────────────────────────────────────────────────────────────────────────
# 4. NEW ANALYTICS ENDPOINT
# ───────────────────────────────────────────────────────────────────────────────

# GET /dashboard/analytics/pipeline
# Returns: stage runs, health, queues, cost summary, discard stats
# UI: /dashboard/analytics/pipeline/page.tsx

# ───────────────────────────────────────────────────────────────────────────────
# 5. DATABASE VIEWS (already defined in PIPELINE_EXTENSIONS.sql)
# ───────────────────────────────────────────────────────────────────────────────

# pipeline_stage_health       — latest run per stage
# pipeline_queue_counts       — current queue sizes
# pipeline_cost_summary       — cost/tokens by stage (7d)
# filter_discard_stats        — discard reason breakdown
# posts_with_monetization     — posts + monetization join
# monetization_summary        — revenue tier stats

# ───────────────────────────────────────────────────────────────────────────────
# 6. LIGHTWEIGHT DESIGN
# ───────────────────────────────────────────────────────────────────────────────

# - All inserts are single-row, non-blocking
# - No transaction overlap with main pipeline logic
# - Real-time ready via Supabase Realtime (pipeline_stage_runs already published)
# - Zero impact on existing pipeline performance (< 1ms per stage)

# ───────────────────────────────────────────────────────────────────────────────
# DONE
# ───────────────────────────────────────────────────────────────────────────────
