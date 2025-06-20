import React, { useState } from "react";
import api from '@/shared/api/client';

interface GoogleSignInButtonProps {}

interface GoogleSignInButtonState {
  loading: boolean;
  error: string | null;
}

export default function GoogleSignInButton(props: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState<GoogleSignInButtonState["loading"]>(false);
  const [error, setError] = useState<GoogleSignInButtonState["error"]>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/auth/google/authorize');
      if (data.authorization_url) {
        // User will be redirected to Google's OAuth page, then back to /oauth/callback
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
      <button
        className="btn btn-primary w-full flex items-center justify-center gap-2"
        onClick={handleGoogleSignIn}
        disabled={loading}
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" className="inline-block"><g><path fill="#4285F4" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.4-5.7 7.5-11.3 7.5-6.6 0-12-5.4-12-12s5.4-12 12-12c2.9 0 5.5 1 7.6 2.7l6.4-6.4C34.5 6.5 29.5 4.5 24 4.5 12.7 4.5 4.5 12.7 4.5 24S12.7 43.5 24 43.5c11 0 19.5-8 19.5-19.5 0-1.3-.1-2.2-.3-3.5z"/><path fill="#34A853" d="M6.3 14.1l6.6 4.8C14.5 16.1 18.8 13.5 24 13.5c2.9 0 5.5 1 7.6 2.7l6.4-6.4C34.5 6.5 29.5 4.5 24 4.5c-7.4 0-13.7 4.3-16.7 10.6z"/><path fill="#FBBC05" d="M24 43.5c5.5 0 10.5-1.8 14.3-5l-6.6-5.4c-2.1 1.4-4.8 2.4-7.7 2.4-5.6 0-10.3-3.6-12-8.5l-6.5 5c3 6.1 9.3 10.5 16.5 10.5z"/><path fill="#EA4335" d="M43.6 20.5H42V20H24v8h11.3c-1.2 3.1-4.6 6.5-11.3 6.5-6.6 0-12-5.4-12-12s5.4-12 12-12c2.9 0 5.5 1 7.6 2.7l6.4-6.4C34.5 6.5 29.5 4.5 24 4.5c-9.5 0-17.5 8-17.5 17.5S14.5 43.5 24 43.5c8.5 0 15.5-5.5 18.5-13.5z"/></g></svg>
        {loading ? "Redirecting..." : "Sign in with Google"}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
