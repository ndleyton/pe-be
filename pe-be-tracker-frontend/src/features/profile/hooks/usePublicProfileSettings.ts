import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { getMyProfile, updateMyProfile } from "@/features/profile/api";

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

const getProfileMutationErrorMessage = (error: unknown): string | null => {
  if (!error) {
    return null;
  }
  if (axios.isAxiosError(error)) {
    return (
      (typeof error.response?.data?.detail === "string"
        ? error.response.data.detail
        : null) ?? "Could not update public profile."
    );
  }
  return "Could not update public profile.";
};

export const usePublicProfileSettings = (enabled: boolean) => {
  const queryClient = useQueryClient();
  const hasInitializedUsername = useRef(false);
  const [username, setUsername] = useState("");
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
      setUsername(profile.username);
      hasInitializedUsername.current = true;
    }
  }, [isUsernameFocused, profile?.username, username]);

  const mutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(PROFILE_ME_QUERY_KEY, updatedProfile);
      setUsername(updatedProfile.username ?? "");
      hasInitializedUsername.current = true;
    },
  });

  const createProfile = useCallback(() => {
    mutation.mutate({
      username,
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
