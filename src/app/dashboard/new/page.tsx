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

function NewDashboardInner() {
  const { initialize } = useDashboardStore();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt') || undefined;
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(340);
  const handleChatWidthChange = useCallback((w: number) => setChatWidth(w), []);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
        <DashboardCanvas
          onToggleLibrary={() => setIsLibraryOpen(prev => !prev)}
          isLibraryOpen={isLibraryOpen}
        />
        <WidgetLibraryPanel isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />
        <ResizableDivider width={chatWidth} onWidthChange={handleChatWidthChange} side="right" />
        <div className="flex flex-col shrink-0" style={{ width: chatWidth }}>
          <ChatPanel initialPrompt={initialPrompt} />
          <VersionTimeline />
        </div>
      </div>
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
