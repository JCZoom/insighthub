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
import { useAutoSave } from '@/hooks/useAutoSave';
import { useToast } from '@/components/ui/toast';
import { useViewport } from '@/hooks/useViewport';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { trackRecentlyViewed } from '@/app/gallery-client';

interface EditorClientProps {
  dashboardId: string;
}

export function DashboardEditorClient({ dashboardId }: EditorClientProps) {
  const { initialize } = useDashboardStore();
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [phoneMode, setPhoneMode] = useState<'canvas' | 'chat'>('canvas');
  const [chatWidth, setChatWidth] = useState(340);
  const handleChatWidthChange = useCallback((w: number) => setChatWidth(w), []);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const viewport = useViewport();
  const router = useRouter();

  const { save } = useAutoSave();

  useKeyboardShortcuts({
    onSave: async () => {
      await save();
      toast({ type: 'success', title: 'Dashboard saved' });
    },
    onSaveAs: async () => {
      // Save current work first
      await save();
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}/duplicate`, { method: 'POST' });
        if (res.ok) {
          const { dashboard } = await res.json();
          toast({ type: 'success', title: 'Saved as copy', description: `"${dashboard.title}" created.` });
          router.push(`/dashboard/${dashboard.id}`);
        } else {
          toast({ type: 'error', title: 'Save As failed', description: 'Could not duplicate dashboard.' });
        }
      } catch {
        toast({ type: 'error', title: 'Save As failed', description: 'Network error.' });
      }
    },
    onFocusChat: () => chatInputRef.current?.focus(),
  });

  const [loadError, setLoadError] = useState(false);

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
                onToggleGlossary={() => setIsGlossaryOpen(prev => !prev)}
                isGlossaryOpen={isGlossaryOpen}
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
              fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-[var(--bg-primary)]
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
            />
            <WidgetLibraryPanel isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />
            <GlossaryPanel isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} />
            <ResizableDivider width={chatWidth} onWidthChange={handleChatWidthChange} side="right" />
            <div className="flex flex-col shrink-0" style={{ width: chatWidth }}>
              <ChatPanel />
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
