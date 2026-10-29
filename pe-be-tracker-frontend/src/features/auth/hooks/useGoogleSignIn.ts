import { useCallback } from "react";
import { toast } from "sonner";
import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";

const SIGN_IN_ERROR = "Couldn't start Google sign-in. Please try again.";

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
        toast.error(SIGN_IN_ERROR);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Google sign-in failed", error);
      toast.error(SIGN_IN_ERROR);
    }
  }, []);
};
