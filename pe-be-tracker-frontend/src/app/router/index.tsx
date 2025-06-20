import React from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import routes from '@/routes';

const router = createBrowserRouter(routes);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};