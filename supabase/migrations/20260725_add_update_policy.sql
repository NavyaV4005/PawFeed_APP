-- Add UPDATE policy for community_posts so likes can be saved
CREATE POLICY "Anyone can update community posts" ON public.community_posts FOR UPDATE TO authenticated USING (true);
