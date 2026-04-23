import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  type ChatMessage,
  type ChatPageLocationState,
  type ExerciseSubstitutionChatIntent,
} from "../types";

const getSubstitutionFollowUpQuestion = (exerciseTypeName: string) =>
  `I can help with alternatives to ${exerciseTypeName}. What equipment do you have available, or what do you want to avoid?`;

interface LocationStateShape {
  hash: string;
  pathname: string;
  search: string;
}

interface UseChatSubstitutionIntentOptions {
  autoStartChatIntent: boolean;
  chatIntent?: ExerciseSubstitutionChatIntent;
  location: LocationStateShape;
  messages: ChatMessage[];
  navigate: (
    nextLocation: LocationStateShape,
    options: {
      replace: boolean;
      state: ChatPageLocationState | null;
    },
  ) => void;
  restorationResolved: boolean;
  routeState: ChatPageLocationState | null;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}

export const useChatSubstitutionIntent = ({
  autoStartChatIntent,
  chatIntent,
  location,
  messages,
  navigate,
  restorationResolved,
  routeState,
  setMessages,
}: UseChatSubstitutionIntentOptions) => {
  const [pendingSubstitutionIntent, setPendingSubstitutionIntent] =
    useState<ExerciseSubstitutionChatIntent | null>(null);
  const seededIntentKeyRef = useRef<string | null>(null);

  const clearPendingSubstitutionIntent = useCallback(() => {
    setPendingSubstitutionIntent(null);
  }, []);

  useEffect(() => {
    const nextIntent = autoStartChatIntent ? chatIntent : undefined;
    const seedKey = nextIntent
      ? `${nextIntent.kind}:${nextIntent.exerciseTypeId}`
      : null;

    if (
      !restorationResolved ||
      !nextIntent ||
      !seedKey ||
      seededIntentKeyRef.current === seedKey ||
      messages.length > 0
    ) {
      return;
    }

    seededIntentKeyRef.current = seedKey;
    setPendingSubstitutionIntent(nextIntent);

    const followUpQuestion = getSubstitutionFollowUpQuestion(
      nextIntent.exerciseTypeName,
    );

    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-assistant-intent`,
        role: "assistant",
        content: followUpQuestion,
        parts: [
          {
            type: "text",
            text: followUpQuestion,
          },
        ],
        timestamp: new Date(),
      },
    ]);

    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      {
        replace: true,
        state: routeState
          ? { ...routeState, autoStartChatIntent: false }
          : routeState,
      },
    );
  }, [
    autoStartChatIntent,
    chatIntent,
    location.hash,
    location.pathname,
    location.search,
    messages.length,
    navigate,
    restorationResolved,
    routeState,
    setMessages,
  ]);

  return {
    clearPendingSubstitutionIntent,
    pendingSubstitutionIntent,
  };
};
