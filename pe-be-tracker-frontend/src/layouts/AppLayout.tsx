import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppBar, SideDrawer, DesktopSidebar, BottomNav } from '../shared/components/layout';
import { GuestModeBanner } from '../shared/components/feedback';
import { useAuthStore } from '@/stores';

const AppLayout: React.FC = () => {
  const authLoading = useAuthStore(state => state.loading);

  return (
    <div className="min-h-screen bg-background flex">
        {/* Skip to content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-content focus:rounded-md"
        >
          Skip to content
        </a>
        
        {/* Desktop Sidebar */}
        <DesktopSidebar />
        
        {/* Main Content Area */}
        <div className="flex flex-col flex-1 lg:ml-64">
          {/* Top App Bar */}
          <AppBar />
          
          {/* Guest Mode Banner with placeholder height during auth loading to prevent CLS */}
          <div className={authLoading ? 'min-h-16' : ''}>
            <GuestModeBanner />
          </div>
          
          {/* Side Drawer (mobile/tablet) */}
          <SideDrawer />
          
          {/* Main Content */}
          <main 
            id="main-content" 
            className="flex-1 pb-16 md:pb-0"
            role="main"
            style={{ minHeight: 'calc(100vh - 4rem)' }}
          >
            <Outlet />
          </main>
          
          {/* Bottom Navigation (mobile only) */}
          <BottomNav />
        </div>
      </div>
  );
};

export default AppLayout;