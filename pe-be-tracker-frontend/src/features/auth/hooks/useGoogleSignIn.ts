import { useCallback } from "react";
import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";

/**
 * Returns a memoized callback that initiates the Google OAuth flow.
 * The backend handles Google's callback, creates the session cookie,
 * and then redirects the browser back to the frontend post-login route.
 */
export const useGoogleSignIn = () => {
  return useCallback(async () => {
    try {
      const { data } = await api.get(endpoints.auth.googleAuthorize);
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
