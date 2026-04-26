import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { getMyProfile, updateMyProfile } from "@/features/profile/api";
import type { ProfileMeUpdate } from "@/features/profile/types";

export const PROFILE_ME_QUERY_KEY = ["profile-me"] as const;

const shouldRetryProfileSettings = (failureCount: number, error: unknown) => {
  if (
    axios.isAxiosError(error) &&
    (error.response?.status === 401 || error.response?.status === 403)
  ) {
    return false;
  }
  return failureCount < 3;
};

const cleanValidationMessage = (message: string): string =>
  message.replace(/^Value error,\s*/i, "").trim();

const getValidationDetailMessage = (detail: unknown): string | null => {
  if (typeof detail === "string") {
    return cleanValidationMessage(detail);
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return cleanValidationMessage(item);
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          if (typeof record.msg === "string") {
            return cleanValidationMessage(record.msg);
          }
          if (typeof record.detail === "string") {
            return cleanValidationMessage(record.detail);
          }
        }
        return null;
      })
      .filter((message): message is string => Boolean(message));
    return messages.length > 0 ? messages.join(" ") : null;
  }

  if (detail && typeof detail === "object") {
    const record = detail as Record<string, unknown>;
    if (typeof record.msg === "string") return cleanValidationMessage(record.msg);
    if (typeof record.detail === "string") {
      return cleanValidationMessage(record.detail);
    }
  }

  return null;
};

const getProfileMutationErrorMessage = (error: unknown): string | null => {
  if (!error) {
    return null;
  }
  if (axios.isAxiosError(error)) {
    return (
      getValidationDetailMessage(error.response?.data?.detail) ??
      "Could not update public profile."
    );
  }
  return "Could not update public profile.";
};

export const usePublicProfileSettings = (enabled: boolean) => {
  const queryClient = useQueryClient();
  const hasInitializedUsername = useRef(false);
  const [username, setUsernameState] = useState("");
  const [isUsernameFocused, setUsernameFocused] = useState(false);

  const {
    data: profile,
    error,
    isLoading,
  } = useQuery({
    queryKey: PROFILE_ME_QUERY_KEY,
    queryFn: getMyProfile,
    enabled,
    retry: shouldRetryProfileSettings,
  });

  useEffect(() => {
    if (
      profile?.username &&
      !hasInitializedUsername.current &&
      !isUsernameFocused &&
      username === ""
    ) {
      setUsernameState(profile.username);
      hasInitializedUsername.current = true;
    }
  }, [isUsernameFocused, profile?.username, username]);

  const setUsername = useCallback((value: string) => {
    setUsernameState(value.trim());
  }, []);

  const mutation = useMutation({
    mutationFn: (profileUpdate: ProfileMeUpdate) => updateMyProfile(profileUpdate),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(PROFILE_ME_QUERY_KEY, updatedProfile);
      setUsernameState(updatedProfile.username ?? "");
      hasInitializedUsername.current = true;
    },
  });

  const createProfile = useCallback(() => {
    const trimmedUsername = username.trim();
    setUsernameState(trimmedUsername);
    mutation.mutate({
      username: trimmedUsername,
      is_profile_public: true,
    });
  }, [mutation, username]);

  const toggleVisibility = useCallback(() => {
    if (!profile) return;
    mutation.mutate({
      is_profile_public: !profile.is_profile_public,
    });
  }, [mutation, profile]);

  return {
    createProfile,
    error,
    errorMessage: getProfileMutationErrorMessage(mutation.error),
    isLoading,
    isPending: mutation.isPending,
    profile,
    setUsernameFocused,
    setUsername,
    toggleVisibility,
    username,
  };
};
