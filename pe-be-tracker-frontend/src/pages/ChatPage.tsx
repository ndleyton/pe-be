import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/shared/api/client';
import { useGuestData } from '@/contexts/GuestDataContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  workoutData?: ParsedWorkout;
  showSaveButton?: boolean;
}

interface ParsedWorkout {
  name: string;
  notes?: string;
  workout_type_id: number;
  exercises: {
    exercise_type_name: string;
    notes?: string;
    sets: {
      reps?: number;
      intensity?: number;
      intensity_unit: string;
      rest_time_seconds?: number;
    }[];
  }[];
}

interface SavedWorkout {
  id: number;
  name: string;
  start_time: string;
}

interface ExerciseType {
  id: number;
  name: string;
  description: string;
  default_intensity_unit: number;
  times_used: number;
}

interface IntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

// Parse workout text using LLM
const parseWorkoutText = async (workoutText: string): Promise<ParsedWorkout> => {
  const response = await api.post('/workouts/parse', { workout_text: workoutText });
  return response.data;
};

// Get workout types
const fetchWorkoutTypes = async () => {
  const response = await api.get('/workouts/workout-types');
  return response.data;
};

// Get exercise types
const fetchExerciseTypes = async (): Promise<ExerciseType[]> => {
  const response = await api.get('/exercises/exercise-types');
  return response.data;
};

// Get intensity units  
const fetchIntensityUnits = async (): Promise<IntensityUnit[]> => {
  const response = await api.get('/exercises/intensity-units');
  return response.data;
};

// Create workout
const createWorkout = async (workoutData: {
  name: string;
  notes?: string;
  workout_type_id: number;
  start_time: string;
}): Promise<SavedWorkout> => {
  const response = await api.post('/workouts/', workoutData);
  return response.data;
};

// Create exercise type if it doesn't exist
const createExerciseType = async (exerciseTypeData: {
  name: string;
  description: string;
  default_intensity_unit: number;
}): Promise<ExerciseType> => {
  const response = await api.post('/exercises/exercise-types', exerciseTypeData);
  return response.data;
};

// Create exercise
const createExercise = async (exerciseData: {
  exercise_type_id: number;
  workout_id: number;
  notes?: string;
}) => {
  const response = await api.post('/exercises/', exerciseData);
  return response.data;
};

// Create exercise set
const createExerciseSet = async (setData: {
  exercise_id: number;
  reps?: number;
  intensity?: number;
  intensity_unit_id: number;
  rest_time_seconds?: number;
  done: boolean;
}) => {
  const response = await api.post('/exercise-sets/', setData);
  return response.data;
};

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useGuestData();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I can help you convert your plaintext workout descriptions into structured workouts. Just paste or type your workout details and I\'ll parse them for you.\n\nFor example, you could paste something like:\n"Did chest and triceps today\n- Bench press: 135lbs x 8, 155lbs x 6, 165lbs x 4\n- Incline dumbbell press: 60lbs x 10, 65lbs x 8\n- Tricep dips: bodyweight x 12, x 10, x 8"',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch reference data
  const { data: workoutTypes = [] } = useQuery({
    queryKey: ['workout-types'],
    queryFn: fetchWorkoutTypes,
    enabled: isAuthenticated(),
  });

  const { data: exerciseTypes = [] } = useQuery({
    queryKey: ['exercise-types'],
    queryFn: fetchExerciseTypes,
    enabled: isAuthenticated(),
  });

  const { data: intensityUnits = [] } = useQuery({
    queryKey: ['intensity-units'],
    queryFn: fetchIntensityUnits,
    enabled: isAuthenticated(),
  });

  const parseWorkoutMutation = useMutation({
    mutationFn: parseWorkoutText,
    onSuccess: (parsedWorkout) => {
      // Add assistant response showing the parsed workout
      const workoutTypeName = workoutTypes.find(wt => wt.id === parsedWorkout.workout_type_id)?.name || 'Unknown Type';
      
      const assistantMessage: ChatMessage = {
        id: Date.now().toString() + '-assistant',
        role: 'assistant',
        content: `I've parsed your workout! Here's what I found:\n\n**${parsedWorkout.name}** (${workoutTypeName})\n${parsedWorkout.notes ? `\n_${parsedWorkout.notes}_\n` : ''}${parsedWorkout.exercises.map(ex => 
          `\n• **${ex.exercise_type_name}**${ex.notes ? ` - ${ex.notes}` : ''}:\n${ex.sets.map((set, idx) => `  ${idx + 1}. ${set.reps || '?'} reps${set.intensity ? ` @ ${set.intensity}${set.intensity_unit}` : ''}${set.rest_time_seconds ? ` (${set.rest_time_seconds}s rest)` : ''}`).join('\n')}`
        ).join('\n')}\n\nWould you like me to save this workout to your account?`,
        timestamp: new Date(),
        workoutData: parsedWorkout,
        showSaveButton: true,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    },
    onError: (error) => {
      console.error('Failed to parse workout:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        content: 'Sorry, I had trouble parsing that workout. Could you try rephrasing it or providing more details about the exercises and sets?',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    },
  });

  const saveWorkoutMutation = useMutation({
    mutationFn: async (parsedWorkout: ParsedWorkout) => {
      // Step 1: Create the workout
      const workout = await createWorkout({
        name: parsedWorkout.name,
        notes: parsedWorkout.notes,
        workout_type_id: parsedWorkout.workout_type_id,
        start_time: new Date().toISOString(),
      });

      // Step 2: For each exercise, create exercise type if needed, then exercise and sets
      for (const parsedExercise of parsedWorkout.exercises) {
        // Find or create exercise type
        let exerciseType = exerciseTypes.find(et => 
          et.name.toLowerCase() === parsedExercise.exercise_type_name.toLowerCase()
        );

        if (!exerciseType) {
          // Create new exercise type - find appropriate intensity unit
          const defaultIntensityUnit = intensityUnits.find(iu => 
            iu.abbreviation === 'kg' || iu.abbreviation === 'lbs'
          )?.id || 1;

          exerciseType = await createExerciseType({
            name: parsedExercise.exercise_type_name,
            description: `Exercise created from workout parsing`,
            default_intensity_unit: defaultIntensityUnit,
          });
        }

        // Create exercise
        const exercise = await createExercise({
          exercise_type_id: exerciseType.id,
          workout_id: workout.id,
          notes: parsedExercise.notes,
        });

        // Create sets
        for (const parsedSet of parsedExercise.sets) {
          // Find intensity unit ID
          const intensityUnit = intensityUnits.find(iu => 
            iu.abbreviation.toLowerCase() === parsedSet.intensity_unit.toLowerCase()
          );

          if (intensityUnit) {
            await createExerciseSet({
              exercise_id: exercise.id,
              reps: parsedSet.reps,
              intensity: parsedSet.intensity,
              intensity_unit_id: intensityUnit.id,
              rest_time_seconds: parsedSet.rest_time_seconds,
              done: true, // Mark as completed since it's from past workout
            });
          }
        }
      }

      return workout;
    },
    onSuccess: (savedWorkout) => {
      const successMessage: ChatMessage = {
        id: Date.now().toString() + '-success',
        role: 'system',
        content: `✅ Workout "${savedWorkout.name}" has been saved successfully! You can find it in your workouts list.`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, successMessage]);
      
      // Refresh workouts list
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
    onError: (error) => {
      console.error('Failed to save workout:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '-save-error',
        role: 'system',
        content: 'Sorry, I couldn\'t save the workout. Please try again or create it manually.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Check if this looks like a workout description
    const looksLikeWorkout = /\b(bench|squat|deadlift|press|curl|row|pull|push|rep|set|lb|kg|x\d+)\b/i.test(inputValue);
    
    if (looksLikeWorkout && isAuthenticated()) {
      // Parse the workout
      parseWorkoutMutation.mutate(inputValue);
    } else {
      // Simple response for now
      setTimeout(() => {
        const response: ChatMessage = {
          id: Date.now().toString() + '-response',
          role: 'assistant',
          content: isAuthenticated() 
            ? 'That doesn\'t look like a workout description. Try describing your exercises with sets, reps, and weights!'
            : 'Please sign in to use the workout parsing feature.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, response]);
        setIsLoading(false);
      }, 1000);
    }

    setInputValue('');
  };

  const handleSaveWorkout = (workoutData: ParsedWorkout) => {
    saveWorkoutMutation.mutate(workoutData);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-screen flex flex-col bg-base-100">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat ${message.role === 'user' ? 'chat-end' : 'chat-start'}`}
          >
            <div className="chat-image avatar">
              <div className="w-10 rounded-full bg-base-300 flex items-center justify-center">
                {message.role === 'user' ? '👤' : message.role === 'system' ? '⚙️' : '🤖'}
              </div>
            </div>
            <div 
              className={`chat-bubble ${
                message.role === 'user' 
                  ? 'chat-bubble-primary' 
                  : message.role === 'system'
                  ? 'chat-bubble-accent'
                  : 'chat-bubble-secondary'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.showSaveButton && message.workoutData && (
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleSaveWorkout(message.workoutData!)}
                    disabled={saveWorkoutMutation.isPending}
                  >
                    {saveWorkoutMutation.isPending ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      '💾 Save Workout'
                    )}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setMessages(prev => prev.map(msg => 
                        msg.id === message.id 
                          ? { ...msg, showSaveButton: false }
                          : msg
                      ));
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="chat-footer opacity-50 text-xs">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="chat chat-start">
            <div className="chat-image avatar">
              <div className="w-10 rounded-full bg-base-300 flex items-center justify-center">
                🤖
              </div>
            </div>
            <div className="chat-bubble chat-bubble-secondary">
              <span className="loading loading-dots loading-sm"></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-base-200 border-t">
        <div className="flex gap-2">
          <textarea
            className="textarea textarea-bordered flex-1 resize-none"
            placeholder="Describe your workout or paste your workout notes here..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            rows={3}
            disabled={isLoading}
          />
          <button
            className="btn btn-primary"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
          >
            Send
          </button>
        </div>
        <div className="text-xs text-base-content/60 mt-2">
          Tip: Describe exercises with sets, reps, and weights (e.g., "Bench press 135lbs x 8 reps")
        </div>
        {!isAuthenticated() && (
          <div className="text-xs text-warning mt-1">
            ⚠️ You need to be signed in to parse and save workouts
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;