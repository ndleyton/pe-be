import { useState } from "react";
import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import { Button } from "@/shared/components/ui/button";

interface GoogleSignInButtonState {
  loading: boolean;
  error: string | null;
}

export default function GoogleSignInButton() {
  const [loading, setLoading] =
    useState<GoogleSignInButtonState["loading"]>(false);
  const [error, setError] = useState<GoogleSignInButtonState["error"]>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(endpoints.auth.googleAuthorize);
      if (data.authorization_url) {
        // Google returns to the backend callback; the backend then redirects
        // the browser to the frontend post-login route.
        window.location.href = data.authorization_url;
      } else {
        throw new Error("No authorization_url in response");
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <Button
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={loading}
        type="button"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          className="inline-block"
        >
          <path
            d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
            fill="currentColor"
          />
        </svg>
        {loading ? "Redirecting..." : "Sign in with Google"}
      </Button>
      {error && <p className="text-destructive mt-2">{error}</p>}
    </div>
  );
}
