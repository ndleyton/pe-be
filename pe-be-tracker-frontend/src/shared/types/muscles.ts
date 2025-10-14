export interface MuscleGroup {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Muscle {
  id: number;
  name: string;
  muscle_group_id: number;
  muscle_group: MuscleGroup;
  created_at: string;
  updated_at: string;
}
