import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HomeLogo } from '@/shared/components/layout';
import { useGuestStore } from '@/stores';
import { useShallow } from 'zustand/react/shallow';
import { syncGuestDataToServer, showSyncSuccessToast, showSyncErrorToast } from '@/utils/syncGuestData';
import api from '@/shared/api/client';
import { NAV_PATHS } from '@/shared/navigation/constants';

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { workouts: rawWorkouts, clear } = useGuestStore(useShallow((state) => ({
    workouts: state.workouts,
    clear: state.clear
  })));
  
  // Ensure workouts is always an array
  const workouts = Array.isArray(rawWorkouts) ? rawWorkouts : [];
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


        // Exchange code for token
        const { data: tokenData } = await api.post('/auth/google/callback', {
          code: code,
        });

        // The backend's CookieTransportWithRedirect will set the cookie automatically.
  

        // Check if there's guest data to sync
        if (workouts.length > 0) {
          setSyncStatus('syncing');
          
          const syncResult = await syncGuestDataToServer({ 
            workouts, 
            exerciseTypes: useGuestStore.getState().exerciseTypes,
            workoutTypes: useGuestStore.getState().workoutTypes,
            recipes: useGuestStore.getState().recipes
          }, clear);
          
          if (syncResult.success) {
            showSyncSuccessToast(syncResult);
            setSyncStatus('complete');
          } else {
            throw new Error(syncResult.error || 'Failed to sync guest data');
          }
        } else {
          setSyncStatus('complete');
        }

        // Wait a moment to show success state, then redirect
        setTimeout(() => {
          navigate(NAV_PATHS.WORKOUTS, { replace: true });
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
  }, [navigate, searchParams, workouts, clear]);

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
          description: `Uploading ${workouts.length} workout${workouts.length !== 1 ? 's' : ''} to your account`
        };
      case 'complete':
        return {
          icon: <div className="text-green-500 text-4xl">✓</div>,
          title: 'Welcome back!',
          description: 'Your data has been synced successfully'
        };
      case 'error':
        return {
          icon: <div className="text-destructive text-4xl">⚠</div>,
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
    <div className="min-h-screen flex flex-col bg-background">
      <div className="p-4">
        <HomeLogo />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-5xl mx-auto p-8 text-center">
          {statusContent.icon}
          <h2 className="mt-4 text-xl font-semibold text-foreground">{statusContent.title}</h2>
          {statusContent.description && (
            <p className="mt-2 text-muted-foreground">{statusContent.description}</p>
          )}
          {syncStatus === 'error' && (
            <p className="mt-2 text-sm text-muted-foreground">Redirecting to login...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
