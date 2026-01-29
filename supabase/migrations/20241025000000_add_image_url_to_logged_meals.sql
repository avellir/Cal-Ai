-- Migration: Add image_url column to logged_meals table
-- Requirements: 5.1, 5.2
-- This enables storing Supabase Storage URLs for meal photos

ALTER TABLE logged_meals 
ADD COLUMN image_url TEXT DEFAULT NULL;

COMMENT ON COLUMN logged_meals.image_url IS 
  'URL to meal photo in Supabase Storage';
