-- Add payload column to care_tasks table
ALTER TABLE public.care_tasks 
ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
