import React from 'react';
import { RouteObject } from 'react-router-dom';
import App from './App';
import MyWorkoutsPage from './pages/MyWorkoutsPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/my-workouts',
    element: <MyWorkoutsPage />,
  },
  {
    path: '/oauth/callback',
    element: <OAuthCallbackPage />,
  },
];

export default routes;
