-- Add Apple Music URL columns
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS apple_music_url TEXT;
ALTER TABLE posts          ADD COLUMN IF NOT EXISTS apple_music_url TEXT;
ALTER TABLE feed_posts     ADD COLUMN IF NOT EXISTS apple_music_url TEXT;
ALTER TABLE feed_posts     ADD COLUMN IF NOT EXISTS artist_id        UUID REFERENCES artists(id) ON DELETE SET NULL;
