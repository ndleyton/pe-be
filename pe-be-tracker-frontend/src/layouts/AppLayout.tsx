import React from 'react';
import { Outlet } from 'react-router-dom';
import { DrawerProvider } from '../contexts/DrawerContext';
import AppBar from '../components/AppBar';
import SideDrawer from '../components/SideDrawer';
import BottomNav from '../components/BottomNav';

const AppLayout: React.FC = () => {
  return (
    <DrawerProvider>
      <div className="min-h-screen bg-base-200 flex flex-col">
        {/* Skip to content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-content focus:rounded-md"
        >
          Skip to content
        </a>
        
        {/* Top App Bar */}
        <AppBar />
        
        {/* Side Drawer */}
        <SideDrawer />
        
        {/* Main Content */}
        <main 
          id="main-content" 
          className="flex-1 pb-16 md:pb-0"
          role="main"
        >
          <Outlet />
        </main>
        
        {/* Bottom Navigation (mobile only) */}
        <BottomNav />
      </div>
    </DrawerProvider>
  );
};

export default AppLayout;