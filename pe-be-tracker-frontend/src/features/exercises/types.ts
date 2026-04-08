import type { Muscle } from "@/shared/types";

export type ExerciseTypeStatus = "candidate" | "in_review" | "released";

export interface ExerciseType {
  id: number;
  name: string;
  description: string | null;
  muscle_groups: string[];
  equipment: string | null;
  instructions: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  usage_count: number;
  default_intensity_unit: number | null;
  times_used: number;
  owner_id?: number | null;
  status?: ExerciseTypeStatus;
  review_requested_at?: string | null;
  released_at?: string | null;
  reviewed_by?: number | null;
  review_notes?: string | null;
  images?: string[];
  muscles?: Muscle[];
}
