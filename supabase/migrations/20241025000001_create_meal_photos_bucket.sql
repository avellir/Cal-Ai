-- Migration: Create meal-photos storage bucket with RLS policies
-- Requirements: 3.1, 3.4
-- This creates a private bucket for meal photos with user-scoped access

-- Create the meal-photos storage bucket (private access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-photos', 'meal-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can upload photos to their own folder
-- Path pattern: {profile_id}/{meal_id}.{extension}
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'meal-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can view their own photos
CREATE POLICY "Users can view own photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'meal-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can delete their own photos
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'meal-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
