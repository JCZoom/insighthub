'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardCanvas } from '@/components/dashboard/DashboardCanvas';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { VersionTimeline } from '@/components/versioning/VersionTimeline';
import { WidgetLibraryPanel } from '@/components/widgets/WidgetLibraryPanel';
import { ResizableDivider } from '@/components/layout/ResizableDivider';
import { MobileNotice } from '@/components/layout/MobileNotice';
import { useDashboardStore } from '@/stores/dashboard-store';
import { EMPTY_DASHBOARD_SCHEMA } from '@/types';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useToast } from '@/components/ui/toast';
import { useViewport } from '@/hooks/useViewport';
import { MobileTabBar } from '@/components/layout/MobileTabBar';

function NewDashboardInner() {
  const { initialize } = useDashboardStore();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt') || undefined;
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [phoneMode, setPhoneMode] = useState<'canvas' | 'chat'>('canvas');
  const [chatWidth, setChatWidth] = useState(340);
  const handleChatWidthChange = useCallback((w: number) => setChatWidth(w), []);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const viewport = useViewport();

  const { save } = useAutoSave({ enabled: false }); // Enable after first save

  useKeyboardShortcuts({
    onSave: async () => {
      await save();
      toast({ type: 'success', title: 'Dashboard saved' });
    },
    onFocusChat: () => chatInputRef.current?.focus(),
  });

  useEffect(() => {
    initialize(null, 'Untitled Dashboard', EMPTY_DASHBOARD_SCHEMA);
  }, [initialize]);

  return (
    <div className="h-screen flex flex-col">
      <MobileNotice />
      <Navbar />
      <div className="flex-1 flex min-h-0">
        {/* Phone mode: Canvas or Chat (full screen) */}
        {viewport.layoutMode === 'mobile' && (
          <>
            {phoneMode === 'canvas' ? (
              <DashboardCanvas
                onToggleLibrary={() => setIsLibraryOpen(prev => !prev)}
                isLibraryOpen={isLibraryOpen}
              />
            ) : (
              <div className="flex-1 flex flex-col">
                <ChatPanel initialPrompt={initialPrompt} />
                <VersionTimeline />
              </div>
            )}
            <WidgetLibraryPanel isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />
          </>
        )}

        {/* Tablet mode: Drawer layout */}
        {viewport.layoutMode === 'tablet' && (
          <>
            <DashboardCanvas
              onToggleLibrary={() => setIsLibraryOpen(prev => !prev)}
              isLibraryOpen={isLibraryOpen}
              onToggleChatDrawer={() => setIsChatDrawerOpen(prev => !prev)}
              isChatDrawerOpen={isChatDrawerOpen}
            />
            <WidgetLibraryPanel isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />

            {/* Chat drawer */}
            {isChatDrawerOpen && (
              <div
                className="fixed inset-0 bg-black/20 z-30"
                onClick={() => setIsChatDrawerOpen(false)}
              />
            )}

            <div className={`
              fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-[var(--bg-primary)]
              border-l border-[var(--border-color)] shadow-xl z-40
              transform transition-transform duration-300 ease-in-out
              ${isChatDrawerOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
              <div className="flex flex-col h-full">
                <ChatPanel initialPrompt={initialPrompt} />
                <VersionTimeline />
              </div>
            </div>
          </>
        )}

        {/* Desktop mode: Side-by-side layout */}
        {viewport.layoutMode === 'desktop' && (
          <>
            <DashboardCanvas
              onToggleLibrary={() => setIsLibraryOpen(prev => !prev)}
              isLibraryOpen={isLibraryOpen}
            />
            <WidgetLibraryPanel isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />
            <ResizableDivider width={chatWidth} onWidthChange={handleChatWidthChange} side="right" />
            <div className="flex flex-col shrink-0 min-h-0 overflow-hidden" style={{ width: chatWidth }}>
              <ChatPanel initialPrompt={initialPrompt} />
              <VersionTimeline />
            </div>
          </>
        )}
      </div>

      {/* Mobile bottom navigation */}
      {viewport.isMobileNav && (
        <MobileTabBar
          phoneMode={phoneMode}
          onPhoneModeChange={setPhoneMode}
          isDashboardEditor={true}
        />
      )}
    </div>
  );
}

export default function NewDashboardPage() {
  return (
    <Suspense>
      <NewDashboardInner />
    </Suspense>
  );
}
