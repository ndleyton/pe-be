import React from "react";
import { Outlet } from "react-router-dom";
import {
  AppBar,
  SideDrawer,
  DesktopSidebar,
  BottomNav,
} from "../shared/components/layout";
import { GuestModeBanner } from "../shared/components/feedback";

const AppLayout: React.FC = () => {
  // Guest banner is rendered as an overlay so it won't affect layout

  return (
    <div className="bg-background flex min-h-screen">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-content sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="relative flex flex-1 flex-col lg:ml-64">
        {/* Top App Bar */}
        <AppBar />

        {/* Guest Mode Banner overlay (positioned relative to this container) */}
        <GuestModeBanner />

        {/* Side Drawer (mobile/tablet) */}
        <SideDrawer />

        {/* Main Content */}
        <main
          id="main-content"
          className="flex-1 pb-16 md:pb-0"
          role="main"
          style={{ minHeight: "calc(100vh - 4rem)" }}
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
