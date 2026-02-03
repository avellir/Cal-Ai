import { supabase } from '@/lib/supabase';
import type {
  UserWeightEntry,
  UserWeightEntryInput,
  UserWeightEntryRow,
} from '@/lib/user-weight-entries-types';

export type ServiceResponse<T> = {
  data: T | null;
  error: string | null;
};

function rowToUserWeightEntry(row: UserWeightEntryRow): UserWeightEntry {
  return {
    id: row.id,
    userId: row.user_id,
    weightKg: row.weight_kg,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

export async function getLatestUserWeightEntry(userId: string): Promise<ServiceResponse<UserWeightEntry>> {
  try {
    const { data, error } = await supabase
      .from('user_weight_entries')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching latest weight entry:', error);
      return { data: null, error: 'Failed to load weight. Please try again.' };
    }

    const row = (data as UserWeightEntryRow[] | null)?.[0] ?? null;
    if (!row) {
      return { data: null, error: null };
    }

    return { data: rowToUserWeightEntry(row), error: null };
  } catch (err) {
    console.error('Unexpected error fetching latest weight entry:', err);
    return { data: null, error: 'An unexpected error occurred. Please check your connection.' };
  }
}

export async function addUserWeightEntry(
  userId: string,
  weightKg: number,
  recordedAt: Date = new Date()
): Promise<ServiceResponse<UserWeightEntry>> {
  try {
    const input: UserWeightEntryInput = {
      user_id: userId,
      weight_kg: weightKg,
      recorded_at: recordedAt.toISOString(),
    };

    const { data, error } = await supabase
      .from('user_weight_entries')
      .insert(input)
      .select()
      .single();

    if (error) {
      console.error('Error inserting weight entry:', error);
      return { data: null, error: 'Unable to save weight. Please try again.' };
    }

    // Keep user_goals.weight_kg aligned with the latest entry when possible.
    // If the user has no goals yet, this update can fail and we ignore it.
    await supabase.from('user_goals').update({ weight_kg: weightKg }).eq('user_id', userId);

    return { data: rowToUserWeightEntry(data as UserWeightEntryRow), error: null };
  } catch (err) {
    console.error('Unexpected error inserting weight entry:', err);
    return { data: null, error: 'An unexpected error occurred. Please try again.' };
  }
}

export async function getUserWeightEntries(
  userId: string,
  start: Date,
  end: Date
): Promise<ServiceResponse<UserWeightEntry[]>> {
  try {
    const { data, error } = await supabase
      .from('user_weight_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', start.toISOString())
      .lte('recorded_at', end.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) {
      console.error('Error fetching weight entries:', error);
      return { data: null, error: 'Failed to load weight history. Please try again.' };
    }

    const rows = (data as UserWeightEntryRow[] | null) ?? [];
    return { data: rows.map(rowToUserWeightEntry), error: null };
  } catch (err) {
    console.error('Unexpected error fetching weight entries:', err);
    return { data: null, error: 'An unexpected error occurred. Please check your connection.' };
  }
}
