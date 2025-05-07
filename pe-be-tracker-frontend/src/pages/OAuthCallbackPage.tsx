import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Here you would typically handle the OAuth callback, e.g. exchanging code for a token
    // For now, just redirect to /my-workouts after successful auth
    // You can add more sophisticated logic here as needed
    navigate('/my-workouts', { replace: true });
  }, [navigate]);

  return <div>Signing you in...</div>;
};

export default OAuthCallbackPage;
