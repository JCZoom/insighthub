'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNotice } from '@/components/layout/MobileNotice';
import { DashboardCanvas } from '@/components/dashboard/DashboardCanvas';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { VersionTimeline } from '@/components/versioning/VersionTimeline';
import { WidgetLibraryPanel } from '@/components/widgets/WidgetLibraryPanel';
import { GlossaryPanel } from '@/components/glossary/GlossaryPanel';
import { ResizableDivider } from '@/components/layout/ResizableDivider';
import { useDashboardStore } from '@/stores/dashboard-store';
import { TEMPLATE_SCHEMAS } from '@/lib/data/templates';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAutoSaveWithThumbnails } from '@/hooks/useAutoSaveWithThumbnails';
import { useToast } from '@/components/ui/toast';
import { useViewport } from '@/hooks/useViewport';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { trackRecentlyViewed } from '@/app/gallery-client';
import { usePresentationMode } from '@/hooks/usePresentationMode';

interface EditorClientProps {
  dashboardId: string;
}

export function DashboardEditorClient({ dashboardId }: EditorClientProps) {
  const { initialize } = useDashboardStore();
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [phoneMode, setPhoneMode] = useState<'canvas' | 'chat'>('canvas');
  // Responsive chat width based on screen size for desktop excellence
  const [chatWidth, setChatWidth] = useState(() => {
    if (typeof window === 'undefined') return 340;
    const screenWidth = window.innerWidth;
    if (screenWidth >= 1920) return 420; // Larger chat panel for ultrawide monitors
    if (screenWidth >= 1440) return 380; // Medium-large screens
    if (screenWidth >= 1200) return 340; // Standard desktop
    return 300; // Smaller desktops
  });
  const handleChatWidthChange = useCallback((w: number) => setChatWidth(w), []);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const dashboardGridRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const viewport = useViewport();
  const router = useRouter();
  const { isPresentationMode, enterPresentationMode, exitPresentationMode, togglePresentationMode } = usePresentationMode();

  const { save, getIsGeneratingThumbnail } = useAutoSaveWithThumbnails({
    getDashboardElement: () => dashboardGridRef.current,
    enableThumbnails: true
  });

  useKeyboardShortcuts({
    onSave: async () => {
      await save();
      const isGenerating = getIsGeneratingThumbnail();
      toast({
        type: 'success',
        title: 'Dashboard saved',
        description: isGenerating ? 'Generating thumbnail...' : undefined
      });
    },
    onSaveAs: async () => {
      // Snapshot current work so the duplicate/clone reflects unsaved edits,
      // then open the shared Save-As dialog (title + folder picker).
      await save();
      useDashboardStore.getState().openSaveAsDialog();
    },
    onFocusChat: () => chatInputRef.current?.focus(),
  });

  const [loadError, setLoadError] = useState(false);

  // Responsive chat width adjustment on window resize for desktop excellence
  useEffect(() => {
    if (viewport.layoutMode !== 'desktop') return;

    const handleResize = () => {
      const screenWidth = window.innerWidth;
      let newWidth = 340;
      if (screenWidth >= 1920) newWidth = 420;
      else if (screenWidth >= 1440) newWidth = 380;
      else if (screenWidth >= 1200) newWidth = 340;
      else newWidth = Math.max(280, Math.min(340, screenWidth * 0.25));

      setChatWidth(newWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewport.layoutMode]);

  useEffect(() => {
    // Track this dashboard in recently viewed
    trackRecentlyViewed(dashboardId);

    const template = TEMPLATE_SCHEMAS[dashboardId];
    if (template) {
      initialize(dashboardId, template.title, template.schema);
      return;
    }

    // Not a template — fetch from DB
    async function loadFromDb() {
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}`);
        if (!res.ok) { setLoadError(true); return; }
        const { dashboard } = await res.json();
        if (!dashboard) { setLoadError(true); return; }
        const schema = dashboard.currentSchema
          || { layout: { columns: 12, rowHeight: 80, gap: 16 }, globalFilters: [], widgets: [] };
        initialize(dashboardId, dashboard.title || 'Untitled Dashboard', schema);
      } catch {
        setLoadError(true);
      }
    }
    loadFromDb();
  }, [dashboardId, initialize]);

  return (
    <div className="h-screen flex flex-col">
      {!isPresentationMode && <MobileNotice />}
      {!isPresentationMode && <Navbar />}
      <div className="flex-1 flex min-h-0">
        {/* Phone mode: Canvas or Chat (full screen) */}
        {viewport.layoutMode === 'mobile' && (
          <>
            {phoneMode === 'canvas' ? (
              <DashboardCanvas
                onToggleLibrary={() => setIsLibraryOpen(prev => !prev)}
                isLibraryOpen={isLibraryOpen}
                onToggleGlossary={() => setIsGlossaryOpen(prev => !prev)}
                isGlossaryOpen={isGlossaryOpen}
                dashboardRef={dashboardGridRef}
                isPresentationMode={isPresentationMode}
                onTogglePresentationMode={togglePresentationMode}
                onExitPresentationMode={exitPresentationMode}
              />
            ) : (
              <div className="flex-1 flex flex-col">
                <ChatPanel />
                <VersionTimeline />
              </div>
            )}
            <WidgetLibraryPanel isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />
            <GlossaryPanel isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} />
          </>
        )}

        {/* Tablet mode: Drawer layout */}
        {viewport.layoutMode === 'tablet' && (
          <>
            <DashboardCanvas
              onToggleLibrary={() => setIsLibraryOpen(prev => !prev)}
              isLibraryOpen={isLibraryOpen}
              onToggleGlossary={() => setIsGlossaryOpen(prev => !prev)}
              isGlossaryOpen={isGlossaryOpen}
              onToggleChatDrawer={() => setIsChatDrawerOpen(prev => !prev)}
              isChatDrawerOpen={isChatDrawerOpen}
              dashboardRef={dashboardGridRef}
              isPresentationMode={isPresentationMode}
              onTogglePresentationMode={togglePresentationMode}
              onExitPresentationMode={exitPresentationMode}
            />
            <WidgetLibraryPanel isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />
            <GlossaryPanel isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} />

            {/* Chat drawer */}
            {isChatDrawerOpen && (
              <div
                className="fixed inset-0 bg-black/20 z-30"
                onClick={() => setIsChatDrawerOpen(false)}
              />
            )}

            <div className={`
              fixed right-0 top-0 h-full w-80 max-w-[min(85vw,400px)] bg-[var(--bg-primary)]
              border-l border-[var(--border-color)] shadow-xl z-40
              transform transition-transform duration-300 ease-in-out
              ${isChatDrawerOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
              <div className="flex flex-col h-full">
                <ChatPanel />
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
              onToggleGlossary={() => setIsGlossaryOpen(prev => !prev)}
              isGlossaryOpen={isGlossaryOpen}
              dashboardRef={dashboardGridRef}
              isPresentationMode={isPresentationMode}
              onTogglePresentationMode={togglePresentationMode}
              onExitPresentationMode={exitPresentationMode}
            />
            {!isPresentationMode && (
              <>
                <WidgetLibraryPanel isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />
                <GlossaryPanel isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} />
                <ResizableDivider width={chatWidth} onWidthChange={handleChatWidthChange} side="right" />
                <div className="flex flex-col shrink-0 min-h-0 overflow-hidden" style={{ width: chatWidth }}>
                  <ChatPanel />
                  <VersionTimeline />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Mobile bottom navigation */}
      {!isPresentationMode && viewport.isMobileNav && (
        <MobileTabBar
          phoneMode={phoneMode}
          onPhoneModeChange={setPhoneMode}
          isDashboardEditor={true}
        />
      )}
    </div>
  );
}
