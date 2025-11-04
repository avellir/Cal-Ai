# Supabase Migrations

This directory contains SQL migration files for the Cal AI database schema.

## Applying Migrations

### Option 1: Supabase Dashboard (Recommended for Development)

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file
4. Paste and execute the SQL

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
# Link your project (first time only)
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### Option 3: Manual Execution

You can also execute the SQL directly using any PostgreSQL client connected to your Supabase database.

## Migration Files

- `20241024000000_create_user_goals_table.sql` - Creates the user_goals table with RLS policies for personalized nutrition goals

## Schema Overview

### user_goals Table

Stores personalized nutrition goals and recommendations for each user.

**Columns:**
- `id` - Primary key (UUID)
- `user_id` - Foreign key to auth.users (UUID)
- `height_cm` - User's height in centimeters (DECIMAL)
- `weight_kg` - User's weight in kilograms (DECIMAL)
- `birthdate` - User's date of birth (DATE)
- `goal_type` - Fitness goal: 'lose' or 'gain' (TEXT)
- `target_weight_kg` - Target weight in kilograms (DECIMAL)
- `daily_calories` - Calculated daily calorie target (INTEGER)
- `daily_protein_g` - Calculated daily protein target in grams (DECIMAL)
- `daily_carbs_g` - Calculated daily carbs target in grams (DECIMAL)
- `daily_fat_g` - Calculated daily fat target in grams (DECIMAL)
- `created_at` - Timestamp of record creation (TIMESTAMPTZ)
- `updated_at` - Timestamp of last update (TIMESTAMPTZ)

**Constraints:**
- Unique constraint on `user_id` (one goal per user)
- Check constraint on `goal_type` (must be 'lose' or 'gain')
- Foreign key to `auth.users` with CASCADE delete

**Indexes:**
- `idx_user_goals_user_id` - Fast lookups by user_id

**RLS Policies:**
- Users can SELECT their own goals
- Users can INSERT their own goals
- Users can UPDATE their own goals

**Triggers:**
- Automatically updates `updated_at` timestamp on row updates

**Helper Functions:**
- `calculate_age(birthdate)` - Calculates age from birthdate (can be used in queries)

**Views:**
- `user_goals_with_age` - Includes all columns plus calculated `age` field

**Note on Age:**
Age is not stored as a column due to PostgreSQL immutability constraints with generated columns. Instead:
- Use the `calculate_age()` function in SQL queries when needed
- Use the `user_goals_with_age` view for convenience
- Calculate age in the application layer using the `calculateAge()` utility function from `lib/user-goals-types.ts`
