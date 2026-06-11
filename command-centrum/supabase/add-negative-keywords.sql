-- Add negative_keywords column to artists table
-- Used by the Python artist_tagger to disqualify false-positive matches.
-- e.g. artist "Cee Lo Green" could have ["green", "apple"] to avoid unrelated articles.

ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS negative_keywords text[] DEFAULT '{}';

COMMENT ON COLUMN artists.negative_keywords IS
  'Words that disqualify an article from being tagged with this artist. Checked against full article text (title + body).';
