import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeLogo from '../components/HomeLogo';

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Here you would typically handle the OAuth callback, e.g. exchanging code for a token
    // For now, just redirect to /dashboard after successful auth
    // You can add more sophisticated logic here as needed
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-base-200">
      <div className="p-4">
        <HomeLogo />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="mt-4 text-lg">Signing you in...</p>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
