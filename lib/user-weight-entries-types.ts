export type UserWeightEntry = {
  id: string;
  userId: string;
  weightKg: number;
  recordedAt: string; // ISO timestamp string from database
  createdAt: string; // ISO timestamp string from database
};

export type UserWeightEntryRow = {
  id: string;
  user_id: string;
  weight_kg: number;
  recorded_at: string;
  created_at: string;
};

export type UserWeightEntryInput = {
  user_id: string;
  weight_kg: number;
  recorded_at?: string;
};

