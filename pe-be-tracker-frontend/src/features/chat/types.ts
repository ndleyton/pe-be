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

export interface RoutineRecommendationItem {
  id: number;
  name: string;
  description?: string | null;
  author?: string | null;
  category?: string | null;
  exerciseCount: number;
  setCount: number;
  exerciseNamesPreview: string[];
  score: number;
  reason: string;
}

export interface RoutineRecommendedEvent {
  type: "routine_recommended";
  title?: string;
  query: string;
  recommendations: RoutineRecommendationItem[];
}

export interface RoutineProgramRecommendationItem {
  id: number;
  name: string;
  description?: string | null;
  author?: string | null;
  category?: string | null;
  sourceLabel?: string | null;
  dayCount: number;
  routineCount: number;
  dayLabelsPreview: string[];
  score: number;
  reason: string;
}

export interface RoutineProgramRecommendedEvent {
  type: "routine_program_recommended";
  title?: string;
  query: string;
  recommendations: RoutineProgramRecommendationItem[];
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

export interface ChatApiRoutineRecommendationItem {
  id: number;
  name: string;
  description?: string | null;
  author?: string | null;
  category?: string | null;
  exercise_count: number;
  set_count: number;
  exercise_names_preview: string[];
  score: number;
  reason: string;
}

export interface ChatApiRoutineRecommendedEvent {
  type: "routine_recommended";
  title?: string | null;
  query: string;
  recommendations: ChatApiRoutineRecommendationItem[];
}

export interface ChatApiRoutineProgramRecommendationItem {
  id: number;
  name: string;
  description?: string | null;
  author?: string | null;
  category?: string | null;
  source_label?: string | null;
  day_count: number;
  routine_count: number;
  day_labels_preview: string[];
  score: number;
  reason: string;
}

export interface ChatApiRoutineProgramRecommendedEvent {
  type: "routine_program_recommended";
  title?: string | null;
  query: string;
  recommendations: ChatApiRoutineProgramRecommendationItem[];
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
  mime_type?: string;
  filename?: string;
}

export interface ChatApiMessage {
  role: string;
  content?: string;
  parts?: ChatApiPart[];
}

export interface ConversationMessagePartResponse {
  id: number;
  type: "text" | "image";
  text?: string | null;
  attachment_id?: number | null;
  mime_type?: string | null;
  filename?: string | null;
}

export interface ConversationMessageResponse {
  id: number;
  role: string;
  content: string;
  parts: ConversationMessagePartResponse[];
  created_at: string;
}

export interface ConversationResponse {
  id: number;
  title?: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  messages?: ConversationMessageResponse[] | null;
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
  | RoutineRecommendedEvent
  | RoutineProgramRecommendedEvent
  | ExerciseSubstitutionsEvent;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: UIMessagePart[];
  events?: ChatEvent[];
  timestamp: Date;
}

export interface PendingAttachment {
  localId: string;
  file: File;
  previewUrl: string;
}

export interface PersistedChatMessage
  extends Omit<ChatMessage, "timestamp"> {
  timestamp: string;
}
