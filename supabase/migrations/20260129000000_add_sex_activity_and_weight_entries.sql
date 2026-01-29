-- Add biological sex and activity level to user_goals
ALTER TABLE user_goals
  ADD COLUMN IF NOT EXISTS sex TEXT NOT NULL DEFAULT 'male' CHECK (sex IN ('male', 'female'));

ALTER TABLE user_goals
  ADD COLUMN IF NOT EXISTS activity_level TEXT NOT NULL DEFAULT 'sedentary'
    CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'veryActive'));

-- Create user_weight_entries table for "hybrid" current weight logging
CREATE TABLE IF NOT EXISTS user_weight_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg DECIMAL(5,2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_weight_entries_user_id_recorded_at
  ON user_weight_entries(user_id, recorded_at DESC);

-- Enable Row Level Security
ALTER TABLE user_weight_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own weight entries
CREATE POLICY "Users can view their own weight entries"
  ON user_weight_entries FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own weight entries
CREATE POLICY "Users can insert their own weight entries"
  ON user_weight_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

