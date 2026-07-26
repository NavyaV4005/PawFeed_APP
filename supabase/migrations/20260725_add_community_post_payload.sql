-- Add payload column to community_posts to store full post metadata
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS payload JSONB;
