'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNotice } from '@/components/layout/MobileNotice';
import { DashboardCanvas } from '@/components/dashboard/DashboardCanvas';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { VersionTimeline } from '@/components/versioning/VersionTimeline';
import { WidgetLibraryPanel } from '@/components/widgets/WidgetLibraryPanel';
import { ResizableDivider } from '@/components/layout/ResizableDivider';
import { useDashboardStore } from '@/stores/dashboard-store';
import { TEMPLATE_SCHEMAS } from '@/lib/data/templates';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useToast } from '@/components/ui/toast';

interface EditorClientProps {
  dashboardId: string;
}

export function DashboardEditorClient({ dashboardId }: EditorClientProps) {
  const { initialize } = useDashboardStore();
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(340);
  const handleChatWidthChange = useCallback((w: number) => setChatWidth(w), []);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
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
        <DashboardCanvas
          onToggleLibrary={() => setIsLibraryOpen(prev => !prev)}
          isLibraryOpen={isLibraryOpen}
        />
        <WidgetLibraryPanel isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />
        <ResizableDivider width={chatWidth} onWidthChange={handleChatWidthChange} side="right" />
        <div className="flex flex-col shrink-0" style={{ width: chatWidth }}>
          <ChatPanel />
          <VersionTimeline />
        </div>
      </div>
    </div>
  );
}
