import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HomeLogo from '../components/HomeLogo';
import { useGuestData } from '../contexts/GuestDataContext';
import { syncGuestDataToServer, showSyncSuccessToast, showSyncErrorToast } from '../utils/syncGuestData';
import api from '../api/client';

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: guestData, actions: guestActions } = useGuestData();
  const [syncStatus, setSyncStatus] = useState<'processing' | 'syncing' | 'complete' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        setSyncStatus('processing');
        
        // Extract authorization code from URL parameters
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }
        
        if (!code) {
          throw new Error('No authorization code received');
        }

        console.log('Processing OAuth callback with code:', code);

        // Exchange code for token
        const { data: tokenData } = await api.post('/auth/google/callback', {
          code: code,
        });

        if (!tokenData.access_token) {
          throw new Error('No access token received');
        }

        // Store the auth token
        localStorage.setItem('authToken', tokenData.access_token);
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
        }, 2000);

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
