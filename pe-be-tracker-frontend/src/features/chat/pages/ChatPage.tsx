import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, MessageCircle, User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '@/shared/api/client';
import { useAuthStore } from '@/stores';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';

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

// Format workout data for display
const formatWorkoutDisplay = (workoutData: ParsedWorkout, workoutTypes: WorkoutType[]): string => {
  const workoutTypeName = workoutTypes.find(wt => wt.id === workoutData.workout_type_id)?.name || 'Unknown Type';
  
  const exercisesText = workoutData.exercises.map(ex => {
    const setsText = ex.sets.map((set, idx) => {
      const repsText = set.reps || '?';
      const intensityText = set.intensity ? ` @ ${set.intensity}${set.intensity_unit}` : '';
      const restText = set.rest_time_seconds ? ` (${set.rest_time_seconds}s rest)` : '';
      return `  ${idx + 1}. ${repsText} reps${intensityText}${restText}`;
    }).join('\n');
    
    const exerciseNotes = ex.notes ? ` - ${ex.notes}` : '';
    return `\n• **${ex.exercise_type_name}**${exerciseNotes}:\n${setsText}`;
  }).join('\n');
  
  const notesText = workoutData.notes ? `\n_${workoutData.notes}_\n` : '';
  
  return `I've parsed your workout! Here's what I found:\n\n**${workoutData.name}** (${workoutTypeName})${notesText}${exercisesText}\n\nWould you like me to save this workout to your account?`;
};



// Send chat message to general chat endpoint
const sendChatMessage = async (messages: Array<{ role: string; content: string }>, conversationId?: number): Promise<{ message: string; conversation_id: number }> => {
  const response = await api.post('/chat', { 
    messages, 
    conversation_id: conversationId 
  });
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
  // Get state from stores
  const isAuthenticated = useAuthStore(state => state.isAuthenticated); 
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
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
    enabled: isAuthenticated,
  });

  const { data: exerciseTypes = [] } = useQuery({
    queryKey: ['exercise-types'],
    queryFn: fetchExerciseTypes,
    enabled: isAuthenticated,
  });

  const { data: intensityUnits = [] } = useQuery({
    queryKey: ['intensity-units'],
    queryFn: fetchIntensityUnits,
    enabled: isAuthenticated,
  });

  const chatMutation = useMutation({
    mutationFn: ({ messages: chatMessages, conversationId: convId }: { messages: Array<{ role: string; content: string }>, conversationId?: number }) => 
      sendChatMessage(chatMessages, convId),
    onSuccess: (response) => {
      // Set conversation ID from response
      if (response.conversation_id && !conversationId) {
        setConversationId(response.conversation_id);
      }
      
      // Regular conversational response
      const assistantMessage: ChatMessage = {
        id: Date.now().toString() + '-assistant',
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      setIsLoading(false);
      
      // Force scroll after a short delay to ensure content has rendered
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    },
    onError: (error) => {
      console.error('Failed to send chat message:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
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
    // Use a slight delay to ensure DOM has updated
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

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
    
    setInputValue('');

    if (!isAuthenticated) {
      setTimeout(() => {
        const response: ChatMessage = {
          id: Date.now().toString() + '-response',
          role: 'assistant',
          content: 'Please sign in to use the AI fitness coach features.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, response]);
        setIsLoading(false);
      }, 1000);
      return;
    }

    // Build conversation history for context
    const conversationMessages = messages.map(msg => ({
      role: msg.role === 'system' ? 'assistant' : msg.role,
      content: msg.content
    }));
    
    // Add the new user message
    conversationMessages.push({
      role: 'user',
      content: messageContent
    });

    chatMutation.mutate({ 
      messages: conversationMessages, 
      conversationId 
    });
  };

  const handleSendMessage = async () => {
    const messageToSend = inputValue;
    await processMessage(messageToSend);
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
    <div className="h-screen flex flex-col bg-background">
      {/* Header - Fixed */}
      <div className="bg-card border-b border-border/20 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Dumbbell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold leading-tight">AI Personal Trainer</h1>
          <p className="text-xs text-muted-foreground">Always here to help</p>
        </div>
      </div>

      {/* Messages - Scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-4 min-h-0">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-8 px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Welcome to your AI Personal Trainer!
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                I can help you log workouts and provide personalized fitness advice.
              </p>
              <div className="space-y-2 max-w-md mx-auto">
                <p className="text-xs font-medium text-muted-foreground mb-3">Try these examples:</p>
                {examplePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleExamplePrompt(prompt)}
                    className="w-full text-left px-4 py-3 bg-muted/50 hover:bg-muted rounded-2xl text-sm transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              {!isAuthenticated && (
                <div className="mt-6 mx-auto max-w-md px-4 py-3 bg-destructive/10 rounded-2xl">
                  <p className="text-destructive text-sm">
                    ⚠️ Sign in to parse and save workouts
                  </p>
                </div>
              )}
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex mb-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex gap-2 max-w-[85%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar - only show for assistant/system */}
                {message.role !== "user" && (
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === "system"
                        ? "bg-accent/20"
                        : "bg-muted"
                    }`}
                  >
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div
                  className={`px-4 py-2.5 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                      : message.role === "system"
                      ? "bg-accent/50 text-accent-foreground rounded-2xl shadow-sm"
                      : "bg-muted/80 text-foreground rounded-2xl rounded-tl-sm shadow-sm"
                  }`}
                >
                  <div className="text-sm">
                    {message.role === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props}>{children}</p>,
                          ul: ({ children, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props}>{children}</ul>,
                          ol: ({ children, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props}>{children}</ol>,
                          li: ({ children, ...props }) => <li className="mb-0.5" {...props}>{children}</li>,
                          strong: ({ children, ...props }) => <strong className="font-semibold" {...props}>{children}</strong>,
                          em: ({ children, ...props }) => <em className="italic" {...props}>{children}</em>,
                          code: ({ children, ...props }) => {
                            const isInline = !props.className?.includes('language-');
                            return isInline ? (
                              <code className="px-1.5 py-0.5 rounded-md bg-background/50 text-xs font-mono" {...props}>
                                {children}
                              </code>
                            ) : (
                              <code {...props}>{children}</code>
                            );
                          },
                          pre: ({ children, ...props }) => (
                            <pre className="bg-background/50 p-2 rounded-lg overflow-x-auto mb-2 text-xs" {...props}>
                              {children}
                            </pre>
                          ),
                          h1: ({ children, ...props }) => <h1 className="text-base font-bold mb-2" {...props}>{children}</h1>,
                          h2: ({ children, ...props }) => <h2 className="text-sm font-bold mb-1.5" {...props}>{children}</h2>,
                          h3: ({ children, ...props }) => <h3 className="text-sm font-semibold mb-1" {...props}>{children}</h3>,
                          blockquote: ({ children, ...props }) => (
                            <blockquote className="border-l-2 border-border pl-3 italic my-2" {...props}>
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {message.content || ''}
                      </ReactMarkdown>
                    ) : (
                      <p className="leading-relaxed">{message.content}</p>
                    )}
                  </div>
                  {message.showSaveButton && message.workoutData && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="h-8 text-xs rounded-xl"
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
                        className="h-8 text-xs rounded-xl"
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
            <div className="flex gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="bg-muted/80 px-4 py-3 rounded-2xl rounded-tl-sm">
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
        </div>
      </div>

      {/* Input - Fixed at bottom */}
      <div className="border-t border-border/20 bg-card p-3 shrink-0 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Message..."
              className="flex-1 h-11 rounded-xl border-border/30 bg-muted/30 focus:bg-background transition-colors"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="h-11 w-11 p-0 rounded-xl shrink-0"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;