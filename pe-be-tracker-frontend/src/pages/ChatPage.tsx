import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Dumbbell, MessageCircle, User, Bot, ArrowLeft } from 'lucide-react';
import api from '@/shared/api/client';
import { useGuestData } from '@/contexts/GuestDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModeToggle } from '@/components/mode-toggle';

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

interface WorkoutType {
  id: number;
  name: string;
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
  const queryClient = useQueryClient();
  const { isAuthenticated } = useGuestData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const examplePrompts = [
    "I did 3 sets of bench press: 135lbs x 8, 155lbs x 6, 165lbs x 4. Then squats: 3 sets of 185lbs x 10.",
    "What exercises should I do to improve my bench press?",
    "I ran 3 miles in 24 minutes today, feeling great!",
    "Can you suggest a good leg workout based on my recent training?",
  ];

  // Fetch reference data
  const { data: workoutTypes = [] } = useQuery<WorkoutType[]>({
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

  const processMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Check if this looks like a workout description
    const looksLikeWorkout = /\b(bench|squat|deadlift|press|curl|row|pull|push|rep|set|lb|kg|x\d+)\b/i.test(messageContent);
    
    if (looksLikeWorkout && isAuthenticated()) {
      // Parse the workout
      parseWorkoutMutation.mutate(messageContent);
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
  };

  const handleSendMessage = async () => {
    await processMessage(inputValue);
    setInputValue('');
  };

  const handleExamplePrompt = async (prompt: string) => {
    setInputValue(prompt);
    // Auto-submit the example prompt
    setTimeout(async () => {
      await processMessage(prompt);
    }, 100);
  };

  const handleSaveWorkout = (workoutData: ParsedWorkout) => {
    saveWorkoutMutation.mutate(workoutData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Navigation header */}
        <div className="flex items-center justify-between mb-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <ModeToggle />
        </div>

        <Card className="h-[90vh] flex flex-col border-border">
          <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-6 w-6" />
              Fitness Coach AI
            </CardTitle>
            <p className="text-primary-foreground/80 text-sm">
              Log your workouts or get personalized fitness advice
            </p>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 bg-background">
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Welcome to your Fitness Coach!
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    I can help you log workouts and provide personalized fitness advice.
                  </p>
                  <div className="grid gap-2 max-w-2xl mx-auto">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Try these examples:</p>
                    {examplePrompts.map((prompt, index) => (
                      <button
                        key={index}
                        onClick={() => handleExamplePrompt(prompt)}
                        className="text-left p-3 bg-secondary hover:bg-secondary/80 rounded-lg text-sm transition-colors text-secondary-foreground"
                      >
                        "{prompt}"
                      </button>
                    ))}
                  </div>
                  {!isAuthenticated() && (
                    <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-destructive text-sm">
                        ⚠️ You need to be signed in to parse and save workouts
                      </p>
                    </div>
                  )}
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 mb-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex gap-3 max-w-[80%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : message.role === "system"
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {message.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={`p-3 rounded-lg ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : message.role === "system"
                          ? "bg-accent/50 text-accent-foreground border border-accent"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {message.showSaveButton && message.workoutData && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            className="bg-accent hover:bg-accent/80 text-accent-foreground"
                            onClick={() => handleSaveWorkout(message.workoutData!)}
                            disabled={saveWorkoutMutation.isPending}
                          >
                            {saveWorkoutMutation.isPending ? (
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                              </div>
                            ) : (
                              '💾 Save Workout'
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMessages(prev => prev.map(msg => 
                                msg.id === message.id 
                                  ? { ...msg, showSaveButton: false }
                                  : msg
                              ));
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </ScrollArea>

            <div className="border-t border-border p-4 bg-background">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Describe your workout or ask for fitness advice..."
                  className="flex-1 bg-background border-input text-foreground placeholder:text-muted-foreground"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !inputValue.trim()}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatPage;