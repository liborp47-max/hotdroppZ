-- System hotfixes for runtime DB mismatches observed in pipeline logs

-- Legacy dashboards and helper queries still reference scout_items.summary in some environments.
alter table if exists scout_items
  add column if not exists summary text;

-- Enrichment/Writer/Feed queries require apple_music_url across these tables.
alter table if exists story_clusters
  add column if not exists apple_music_url text;

alter table if exists feed_posts
  add column if not exists apple_music_url text;

alter table if exists posts
  add column if not exists apple_music_url text;
