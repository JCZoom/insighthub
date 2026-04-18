'use client';

import { useState, useEffect } from 'react';
import { Monitor, X } from 'lucide-react';

export function MobileNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('mobile-notice-dismissed');
    if (!dismissed && window.innerWidth < 768) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="sm:hidden fixed inset-x-0 bottom-0 z-[100] p-3 bg-accent-blue/95 text-white text-center text-sm backdrop-blur-sm">
      <button
        onClick={() => {
          setShow(false);
          sessionStorage.setItem('mobile-notice-dismissed', '1');
        }}
        className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-lg transition-colors"
      >
        <X size={14} />
      </button>
      <div className="flex items-center justify-center gap-2">
        <Monitor size={16} />
        <span>Best experienced on desktop — the editor needs screen space!</span>
      </div>
    </div>
  );
}
