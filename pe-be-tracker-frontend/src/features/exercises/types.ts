import type { Muscle } from "@/shared/types";

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
  default_intensity_unit: any;
  times_used: number;
  images?: string[];
  muscles?: Muscle[];
}
