-- Create user_goals table for personalized nutrition goals
CREATE TABLE IF NOT EXISTS user_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Physical metrics
  height_cm DECIMAL(5,2) NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  birthdate DATE NOT NULL,
  
  -- Goal information
  goal_type TEXT NOT NULL CHECK (goal_type IN ('lose', 'gain')),
  target_weight_kg DECIMAL(5,2) NOT NULL,
  
  -- Calculated recommendations
  daily_calories INTEGER NOT NULL,
  daily_protein_g DECIMAL(5,2) NOT NULL,
  daily_carbs_g DECIMAL(5,2) NOT NULL,
  daily_fat_g DECIMAL(5,2) NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one goal per user
  UNIQUE(user_id)
);

-- Create index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);

-- Enable Row Level Security
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own goals
CREATE POLICY "Users can view their own goals"
  ON user_goals FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own goals
CREATE POLICY "Users can insert their own goals"
  ON user_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own goals
CREATE POLICY "Users can update their own goals"
  ON user_goals FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row updates
CREATE TRIGGER update_user_goals_updated_at
  BEFORE UPDATE ON user_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- Helper function to calculate age from birthdate
-- This can be used in queries when age is needed
CREATE OR REPLACE FUNCTION calculate_age(birthdate DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthdate))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a view that includes calculated age for convenience
CREATE OR REPLACE VIEW user_goals_with_age AS
SELECT 
  id,
  user_id,
  height_cm,
  weight_kg,
  birthdate,
  calculate_age(birthdate) as age,
  goal_type,
  target_weight_kg,
  daily_calories,
  daily_protein_g,
  daily_carbs_g,
  daily_fat_g,
  created_at,
  updated_at
FROM user_goals;
