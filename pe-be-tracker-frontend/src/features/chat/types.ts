import { type Workout } from "@/features/workouts";

export interface TextMessagePart {
  type: "text";
  text: string;
}

export interface ImageMessagePart {
  type: "image";
  attachment_id: number;
  mime_type?: string;
  filename?: string;
  url: string;
}

export type UIMessagePart = TextMessagePart | ImageMessagePart;

export type WorkoutWidgetData = Pick<
  Workout,
  "id" | "name" | "notes" | "start_time" | "end_time"
>;

export interface RoutineWidgetData {
  id: number;
  name: string;
  description?: string | null;
  workout_type_id: number;
  exercise_count: number;
  set_count: number;
}

export interface WorkoutCreatedEvent {
  type: "workout_created";
  title?: string;
  ctaLabel?: string;
  workout: WorkoutWidgetData;
}

export interface RoutineCreatedEvent {
  type: "routine_created";
  title?: string;
  ctaLabel?: string;
  routine: RoutineWidgetData;
}

export interface ExerciseSubstitutionItem {
  id: number;
  name: string;
  description?: string | null;
  equipment?: string | null;
  category?: string | null;
  matchReason: "same_primary_muscle" | "same_primary_muscle_group";
  muscles: string[];
}

export interface ExerciseSubstitutionsEvent {
  type: "exercise_substitutions_recommended";
  title?: string;
  strategy: string;
  sourceExercise: {
    id: number;
    name: string;
  };
  substitutions: ExerciseSubstitutionItem[];
}

export interface ChatApiWorkoutCreatedEvent {
  type: "workout_created";
  title?: string | null;
  cta_label?: string | null;
  workout: {
    id: Workout["id"];
    name: string | null;
    notes: string | null;
    start_time: string;
    end_time: string | null;
  };
}

export interface ChatApiRoutineCreatedEvent {
  type: "routine_created";
  title?: string | null;
  cta_label?: string | null;
  routine: {
    id: number;
    name: string;
    description?: string | null;
    workout_type_id: number;
    exercise_count: number;
    set_count: number;
  };
}

export interface ChatApiExerciseSubstitutionItem {
  id: number;
  name: string;
  description?: string | null;
  equipment?: string | null;
  category?: string | null;
  match_reason: "same_primary_muscle" | "same_primary_muscle_group";
  muscles: string[];
}

export interface ChatApiExerciseSubstitutionsEvent {
  type: "exercise_substitutions_recommended";
  title?: string | null;
  strategy: string;
  source_exercise: {
    id: number;
    name: string;
  };
  substitutions: ChatApiExerciseSubstitutionItem[];
}

export interface ChatApiPart {
  type: "text" | "image";
  text?: string;
  attachment_id?: number;
}

export interface ChatApiMessage {
  role: string;
  content?: string;
  parts?: ChatApiPart[];
}

export interface ExerciseSubstitutionChatIntent {
  kind: "exercise_substitutions";
  exerciseTypeId: number;
  exerciseTypeName: string;
}

export interface ChatPageLocationState {
  chatIntent?: ExerciseSubstitutionChatIntent;
  autoStartChatIntent?: boolean;
}

export type ChatEvent =
  | WorkoutCreatedEvent
  | RoutineCreatedEvent
  | ExerciseSubstitutionsEvent;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: UIMessagePart[];
  events?: ChatEvent[];
  timestamp: Date;
}
