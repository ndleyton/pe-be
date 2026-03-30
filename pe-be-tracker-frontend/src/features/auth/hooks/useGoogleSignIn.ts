import { useCallback } from "react";
import api from "@/shared/api/client";

/**
 * Returns a memoized callback that initiates the Google OAuth flow.
 * The user will be redirected to the Google consent screen and then
 * back to the `/oauth/callback` route defined in the backend.
 */
export const useGoogleSignIn = () => {
  return useCallback(async () => {
    try {
      const { data } = await api.get("/auth/google/authorize");
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        // eslint-disable-next-line no-console
        console.error(
          "Google sign-in failed",
          new Error("Authorization URL missing in response"),
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Google sign-in failed", error);
    }
  }, []);
};
