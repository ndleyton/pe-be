import React from 'react';
import { useAuthStore } from '@/stores';
import { ModeToggle } from '@/components/mode-toggle';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorTestComponent } from '@/shared/components/error';

const SettingsPage: React.FC = () => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Customize your experience</p>
        </div>

        {!isAuthenticated && (
          <Alert className="mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <AlertTitle>Guest Mode Active</AlertTitle>
            <AlertDescription>
              Please sign in to access and save your settings. Some settings may be temporarily available but won't be preserved.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how the application looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Theme</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred color scheme
                  </p>
                </div>
                <ModeToggle />
              </div>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>
                Manage your account information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Status</label>
                  <p className="font-medium">
                    {isAuthenticated ? 'Signed In' : 'Guest Mode'}
                  </p>
                </div>
                
                {!isAuthenticated && (
                  <div className="pt-2">
                    <p className="text-sm text-muted-foreground">
                      Sign in to access account settings and sync your data across devices.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Development Tools */}
          {process.env.NODE_ENV === 'development' && (
            <ErrorTestComponent className="border-dashed" />
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;