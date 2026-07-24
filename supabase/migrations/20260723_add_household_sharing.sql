-- 1. Add household_id columns
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.feeding_logs ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.care_tasks ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.mood_logs ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.meds ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.vet_logs ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.sleep_logs ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.pet_gallery ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.weight_history ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE public.custom_recipes ADD COLUMN IF NOT EXISTS household_id UUID;

-- 2. Update user_profiles RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view profiles in same household" ON public.user_profiles 
FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) 
  OR id = auth.uid()
);

-- 3. Update Resource Tables RLS

-- Update policies for pets
DROP POLICY IF EXISTS "Users can view own pets" ON public.pets;
DROP POLICY IF EXISTS "Users can update own pets" ON public.pets;
DROP POLICY IF EXISTS "Users can delete own pets" ON public.pets;
CREATE POLICY "Users can view pets in same household" ON public.pets FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update pets in same household" ON public.pets FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete pets in same household" ON public.pets FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);

-- Update policies for feeding_logs
DROP POLICY IF EXISTS "Users can view own logs" ON public.feeding_logs;
DROP POLICY IF EXISTS "Users can update own logs" ON public.feeding_logs;
DROP POLICY IF EXISTS "Users can delete own logs" ON public.feeding_logs;
CREATE POLICY "Users can view logs in same household" ON public.feeding_logs FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update logs in same household" ON public.feeding_logs FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete logs in same household" ON public.feeding_logs FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);

-- Update policies for care_tasks
DROP POLICY IF EXISTS "Users can view own tasks" ON public.care_tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.care_tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.care_tasks;
CREATE POLICY "Users can view tasks in same household" ON public.care_tasks FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update tasks in same household" ON public.care_tasks FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete tasks in same household" ON public.care_tasks FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);

-- Update policies for stock_items
DROP POLICY IF EXISTS "Users can view own stock" ON public.stock_items;
DROP POLICY IF EXISTS "Users can update own stock" ON public.stock_items;
DROP POLICY IF EXISTS "Users can delete own stock" ON public.stock_items;
CREATE POLICY "Users can view stock in same household" ON public.stock_items FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update stock in same household" ON public.stock_items FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete stock in same household" ON public.stock_items FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);

-- Update policies for expenses
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;
CREATE POLICY "Users can view expenses in same household" ON public.expenses FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update expenses in same household" ON public.expenses FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete expenses in same household" ON public.expenses FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);

-- Update policies for mood_logs
DROP POLICY IF EXISTS "Users can view own moods" ON public.mood_logs;
DROP POLICY IF EXISTS "Users can update own moods" ON public.mood_logs;
DROP POLICY IF EXISTS "Users can delete own moods" ON public.mood_logs;
CREATE POLICY "Users can view moods in same household" ON public.mood_logs FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update moods in same household" ON public.mood_logs FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete moods in same household" ON public.mood_logs FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);

-- Update policies for meds
DROP POLICY IF EXISTS "Users can view own medications" ON public.meds;
DROP POLICY IF EXISTS "Users can update own medications" ON public.meds;
DROP POLICY IF EXISTS "Users can delete own medications" ON public.meds;
CREATE POLICY "Users can view medications in same household" ON public.meds FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update medications in same household" ON public.meds FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete medications in same household" ON public.meds FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);

-- Update policies for vet_logs
DROP POLICY IF EXISTS "Users can view own vet logs" ON public.vet_logs;
DROP POLICY IF EXISTS "Users can update own vet logs" ON public.vet_logs;
DROP POLICY IF EXISTS "Users can delete own vet logs" ON public.vet_logs;
CREATE POLICY "Users can view vet logs in same household" ON public.vet_logs FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update vet logs in same household" ON public.vet_logs FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete vet logs in same household" ON public.vet_logs FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);

-- Update policies for sleep_logs
DROP POLICY IF EXISTS "Users can view own sleep logs" ON public.sleep_logs;
DROP POLICY IF EXISTS "Users can update own sleep logs" ON public.sleep_logs;
DROP POLICY IF EXISTS "Users can delete own sleep logs" ON public.sleep_logs;
CREATE POLICY "Users can view sleep logs in same household" ON public.sleep_logs FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update sleep logs in same household" ON public.sleep_logs FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete sleep logs in same household" ON public.sleep_logs FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);

-- Update policies for pet_gallery
DROP POLICY IF EXISTS "Users can view own gallery photos" ON public.pet_gallery;
DROP POLICY IF EXISTS "Users can update own gallery photos" ON public.pet_gallery;
DROP POLICY IF EXISTS "Users can delete own gallery photos" ON public.pet_gallery;
CREATE POLICY "Users can view gallery photos in same household" ON public.pet_gallery FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update gallery photos in same household" ON public.pet_gallery FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete gallery photos in same household" ON public.pet_gallery FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);

-- Update policies for weight_history
DROP POLICY IF EXISTS "Users can view own weight records" ON public.weight_history;
DROP POLICY IF EXISTS "Users can update own weight records" ON public.weight_history;
DROP POLICY IF EXISTS "Users can delete own weight records" ON public.weight_history;
CREATE POLICY "Users can view weight records in same household" ON public.weight_history FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update weight records in same household" ON public.weight_history FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete weight records in same household" ON public.weight_history FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);

-- Update policies for custom_recipes
DROP POLICY IF EXISTS "Users can view own recipes" ON public.custom_recipes;
DROP POLICY IF EXISTS "Users can update own recipes" ON public.custom_recipes;
DROP POLICY IF EXISTS "Users can delete own recipes" ON public.custom_recipes;
CREATE POLICY "Users can view recipes in same household" ON public.custom_recipes FOR SELECT USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can update recipes in same household" ON public.custom_recipes FOR UPDATE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
CREATE POLICY "Users can delete recipes in same household" ON public.custom_recipes FOR DELETE USING (
  (household_id = (SELECT household_id FROM public.user_profiles WHERE id = auth.uid()) AND household_id IS NOT NULL) OR user_id = auth.uid()
);
