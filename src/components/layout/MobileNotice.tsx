'use client';

import { useState, useEffect } from 'react';
import { Monitor, X } from 'lucide-react';

export function MobileNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('mobile-notice-dismissed');
    // Show notice for phones (<640px) and tablets (<1024px touch devices)
    const isSmallScreen = window.innerWidth < 1024;

    if (!dismissed && isSmallScreen) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg-primary)]/95 backdrop-blur-md p-6">
      <div className="max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-blue/10 mb-6">
          <Monitor size={28} className="text-accent-blue" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Desktop Recommended</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          InsightHub is optimized for desktop browsers. Mobile and tablet support is coming soon.
        </p>
        <button
          onClick={() => {
            setShow(false);
            sessionStorage.setItem('mobile-notice-dismissed', '1');
          }}
          className="px-5 py-2.5 rounded-xl bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 transition-colors"
        >
          Continue Anyway
        </button>
      </div>
    </div>
  );
}
