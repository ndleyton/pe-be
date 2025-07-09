import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HomeLogo } from '@/shared/components/layout';
import { useGuestData } from '@/contexts/GuestDataContext';
import { syncGuestDataToServer, showSyncSuccessToast, showSyncErrorToast } from '@/utils/syncGuestData';
import api from '@/shared/api/client';

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: guestData, actions: guestActions } = useGuestData();
  const [syncStatus, setSyncStatus] = useState<'processing' | 'syncing' | 'complete' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Avoid double execution in React 18 StrictMode (dev) which re-mounts components
  const processedRef = React.useRef(false);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (processedRef.current) {
        return; // already handled once
      }
      processedRef.current = true;
      try {
        setSyncStatus('processing');
        
        // Extract access_token from query string first, then fallback to hash fragment (legacy)
        const qsToken = searchParams.get('access_token');
        const hashToken = new URLSearchParams(window.location.hash.substring(1)).get('access_token');
        const accessToken = qsToken || hashToken;

        // Extract authorization code and state from URL parameters (for authorization code flow)
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Handle any error returned by the provider immediately
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        // Ensure we have either an access token (implicit flow) or both code and state (auth code flow)
        if (!accessToken && (!code || !state)) {
          throw new Error('Missing authorization data in callback URL');
        }
        
        let finalAccessToken = accessToken;

        // If we don’t already have the token (implicit flow), exchange code+state with the backend
        if (!finalAccessToken) {
          console.log('Processing OAuth callback with code:', code, 'and state:', state);

          const callbackUrl = `/auth/google/callback?code=${code}&state=${state}`;
          const { data: tokenData } = await api.get(callbackUrl);

          if (!tokenData.access_token) {
            throw new Error('No access token received from backend');
          }

          finalAccessToken = tokenData.access_token;
        }

        // Ensure we have a token before storing (type narrowing for TypeScript)
        if (!finalAccessToken) {
          throw new Error('No access token available to store');
        }

        localStorage.setItem('authToken', finalAccessToken);
        console.log('Auth token stored successfully');
  

        // Check if there's guest data to sync
        if (guestData.workouts.length > 0) {
          setSyncStatus('syncing');
          console.log('Syncing guest data to server...');
          
          const syncResult = await syncGuestDataToServer(guestData, guestActions.clear);
          
          if (syncResult.success) {
            showSyncSuccessToast(syncResult);
            setSyncStatus('complete');
          } else {
            throw new Error(syncResult.error || 'Failed to sync guest data');
          }
        } else {
          console.log('No guest data to sync');
          setSyncStatus('complete');
        }

        // Wait a moment to show success state, then redirect
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);

      } catch (error) {
        console.error('OAuth callback error:', error);
        const errorMsg = error instanceof Error ? error.message : 'Authentication failed';
        setErrorMessage(errorMsg);
        setSyncStatus('error');
        showSyncErrorToast(errorMsg);
        
        // Redirect back to login after error
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, [navigate, searchParams, guestData, guestActions]);

  const getStatusContent = () => {
    switch (syncStatus) {
      case 'processing':
        return {
          icon: <div className="loading loading-spinner loading-lg"></div>,
          title: 'Signing you in...',
          description: 'Processing your authentication'
        };
      case 'syncing':
        return {
          icon: <div className="loading loading-spinner loading-lg text-blue-500"></div>,
          title: 'Syncing your data...',
          description: `Uploading ${guestData.workouts.length} workout${guestData.workouts.length !== 1 ? 's' : ''} to your account`
        };
      case 'complete':
        return {
          icon: <div className="text-green-500 text-4xl">✓</div>,
          title: 'Welcome back!',
          description: 'Your data has been synced successfully'
        };
      case 'error':
        return {
          icon: <div className="text-red-500 text-4xl">⚠</div>,
          title: 'Authentication failed',
          description: errorMessage
        };
      default:
        return {
          icon: <div className="loading loading-spinner loading-lg"></div>,
          title: 'Loading...',
          description: ''
        };
    }
  };

  const statusContent = getStatusContent();

  return (
    <div className="min-h-screen flex flex-col bg-base-200">
      <div className="p-4">
        <HomeLogo />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          {statusContent.icon}
          <h2 className="mt-4 text-xl font-semibold">{statusContent.title}</h2>
          {statusContent.description && (
            <p className="mt-2 text-gray-600">{statusContent.description}</p>
          )}
          {syncStatus === 'error' && (
            <p className="mt-2 text-sm text-gray-500">Redirecting to login...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
