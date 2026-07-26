-- ======================================================================
-- PawFeed — Supabase RLS Policies & Storage Buckets
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ======================================================================

-- ──────────────────────────────────────────────────────────────────────
-- 1. ENABLE RLS ON ALL TABLES
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeding_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;


-- ──────────────────────────────────────────────────────────────────────
-- 2. HELPER FUNCTION — get current user's household_id
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_household_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT household_id
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;


-- ──────────────────────────────────────────────────────────────────────
-- 3. PETS — scoped to household_id
-- ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pets_household_select" ON public.pets;
CREATE POLICY "pets_household_select" ON public.pets
  FOR SELECT USING (household_id = public.get_my_household_id());

DROP POLICY IF EXISTS "pets_household_insert" ON public.pets;
CREATE POLICY "pets_household_insert" ON public.pets
  FOR INSERT WITH CHECK (household_id = public.get_my_household_id());

DROP POLICY IF EXISTS "pets_household_update" ON public.pets;
CREATE POLICY "pets_household_update" ON public.pets
  FOR UPDATE USING (household_id = public.get_my_household_id());

DROP POLICY IF EXISTS "pets_household_delete" ON public.pets;
CREATE POLICY "pets_household_delete" ON public.pets
  FOR DELETE USING (household_id = public.get_my_household_id());


-- ──────────────────────────────────────────────────────────────────────
-- 4. FEEDING LOGS — scoped to household_id
-- ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "feeding_logs_household" ON public.feeding_logs;
CREATE POLICY "feeding_logs_household" ON public.feeding_logs
  FOR ALL USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());


-- ──────────────────────────────────────────────────────────────────────
-- 5. CARE TASKS — scoped to household_id
-- ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "care_tasks_household" ON public.care_tasks;
CREATE POLICY "care_tasks_household" ON public.care_tasks
  FOR ALL USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());


-- ──────────────────────────────────────────────────────────────────────
-- 6. MEDICAL RECORDS — scoped to household_id
-- ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "medical_records_household" ON public.medical_records;
CREATE POLICY "medical_records_household" ON public.medical_records
  FOR ALL USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());

DROP POLICY IF EXISTS "medical_reports_household" ON public.medical_reports;
CREATE POLICY "medical_reports_household" ON public.medical_reports
  FOR ALL USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());


-- ──────────────────────────────────────────────────────────────────────
-- 7. COMMUNITY POSTS — public read, authenticated insert, own delete
-- ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "community_posts_public_read" ON public.community_posts;
CREATE POLICY "community_posts_public_read" ON public.community_posts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "community_posts_auth_insert" ON public.community_posts;
CREATE POLICY "community_posts_auth_insert" ON public.community_posts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "community_posts_own_delete" ON public.community_posts;
CREATE POLICY "community_posts_own_delete" ON public.community_posts
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "community_posts_own_update" ON public.community_posts;
CREATE POLICY "community_posts_own_update" ON public.community_posts
  FOR UPDATE USING (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────────────────
-- 8. DIRECT MESSAGES — sender or recipient can read, only sender inserts
-- ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dm_participants_select" ON public.direct_messages;
CREATE POLICY "dm_participants_select" ON public.direct_messages
  FOR SELECT USING (
    sender_id = auth.uid() OR recipient_id = auth.uid()
  );

DROP POLICY IF EXISTS "dm_sender_insert" ON public.direct_messages;
CREATE POLICY "dm_sender_insert" ON public.direct_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "dm_sender_delete" ON public.direct_messages;
CREATE POLICY "dm_sender_delete" ON public.direct_messages
  FOR DELETE USING (sender_id = auth.uid());


-- ──────────────────────────────────────────────────────────────────────
-- 9. OTHER HOUSEHOLD-SCOPED TABLES
-- ──────────────────────────────────────────────────────────────────────
-- Weight history
DROP POLICY IF EXISTS "weight_history_household" ON public.weight_history;
CREATE POLICY "weight_history_household" ON public.weight_history
  FOR ALL USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());

-- Pet gallery
DROP POLICY IF EXISTS "pet_gallery_household" ON public.pet_gallery;
CREATE POLICY "pet_gallery_household" ON public.pet_gallery
  FOR ALL USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());

-- Mood logs
DROP POLICY IF EXISTS "mood_logs_household" ON public.mood_logs;
CREATE POLICY "mood_logs_household" ON public.mood_logs
  FOR ALL USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());

-- Sleep logs
DROP POLICY IF EXISTS "sleep_logs_household" ON public.sleep_logs;
CREATE POLICY "sleep_logs_household" ON public.sleep_logs
  FOR ALL USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());

-- Stock items
DROP POLICY IF EXISTS "stock_items_household" ON public.stock_items;
CREATE POLICY "stock_items_household" ON public.stock_items
  FOR ALL USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());

-- Expenses
DROP POLICY IF EXISTS "expenses_household" ON public.expenses;
CREATE POLICY "expenses_household" ON public.expenses
  FOR ALL USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());

-- Custom recipes
DROP POLICY IF EXISTS "custom_recipes_household" ON public.custom_recipes;
CREATE POLICY "custom_recipes_household" ON public.custom_recipes
  FOR ALL USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());


-- ──────────────────────────────────────────────────────────────────────
-- 10. USER PROFILES — user can only read/write their own row
-- ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_profiles_own_row" ON public.user_profiles;
CREATE POLICY "user_profiles_own_row" ON public.user_profiles
  FOR ALL USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ──────────────────────────────────────────────────────────────────────
-- 11. ENABLE REALTIME PUBLICATION FOR KEY TABLES
-- ──────────────────────────────────────────────────────────────────────
-- Run these if tables are not already in the realtime publication.
-- Go to: Dashboard → Database → Replication → supabase_realtime publication
-- and enable the following tables, OR run:

ALTER PUBLICATION supabase_realtime ADD TABLE public.pets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feeding_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.care_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;


-- ──────────────────────────────────────────────────────────────────────
-- 12. STORAGE BUCKETS
-- ──────────────────────────────────────────────────────────────────────
-- Run in SQL Editor OR create manually in Storage → New Bucket

-- Pet avatars — private (only the owner can upload/view)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-avatars', 'pet-avatars', false)
ON CONFLICT (id) DO NOTHING;

-- Community photos — public (anyone can view)
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-photos', 'community-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Medical reports — private
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-reports', 'medical-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Recipe images — public
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;


-- ──────────────────────────────────────────────────────────────────────
-- 13. STORAGE POLICIES
-- ──────────────────────────────────────────────────────────────────────

-- Pet avatars: user can upload/view files in their own user_id folder
CREATE POLICY "pet_avatars_own_folder" ON storage.objects
  FOR ALL USING (
    bucket_id = 'pet-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'pet-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Community photos: authenticated insert, public read
CREATE POLICY "community_photos_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'community-photos' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "community_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'community-photos');

-- Medical reports: own folder only
CREATE POLICY "medical_reports_own_folder" ON storage.objects
  FOR ALL USING (
    bucket_id = 'medical-reports' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'medical-reports' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Recipe images: authenticated insert, public read
CREATE POLICY "recipe_images_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'recipe-images' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "recipe_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'recipe-images');
