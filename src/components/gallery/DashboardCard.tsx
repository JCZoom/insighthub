'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, Clock, Users, Star } from 'lucide-react';
import { relativeTime } from '@/lib/utils';

export interface DashboardCardData {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  ownerName: string;
  updatedAt: Date;
  widgetCount: number;
  isTemplate?: boolean;
  isPublic?: boolean;
  isFavorite?: boolean;
}

interface DashboardCardProps {
  dashboard: DashboardCardData;
  onToggleFavorite?: (id: string) => void;
}

export function DashboardCard({ dashboard, onToggleFavorite }: DashboardCardProps) {
  // Defer relativeTime to client to avoid SSR/client hydration mismatch
  const [timeLabel, setTimeLabel] = useState('');
  useEffect(() => {
    setTimeLabel(relativeTime(dashboard.updatedAt));
  }, [dashboard.updatedAt]);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(dashboard.id);
  };

  return (
    <Link href={`/dashboard/${dashboard.id}`} className="block group">
      <div className="card p-0 overflow-hidden">
        {/* Thumbnail placeholder */}
        <div className="h-32 bg-gradient-to-br from-accent-blue/10 via-accent-purple/5 to-accent-cyan/10 flex items-center justify-center relative">
          <BarChart3 size={32} className="text-accent-blue/30" />
          <button
            onClick={handleFavoriteClick}
            className="absolute top-2 right-2 p-1 rounded-md hover:bg-black/10 transition-colors"
            title={dashboard.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              size={14}
              className={
                dashboard.isFavorite
                  ? 'text-accent-amber fill-accent-amber'
                  : 'text-[var(--text-muted)] hover:text-accent-amber'
              }
            />
          </button>
          {dashboard.isTemplate && (
            <span className="absolute top-2 left-2 pill pill-purple text-[10px]">Template</span>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-accent-blue transition-colors line-clamp-1 mb-1">
            {dashboard.title}
          </h3>
          {dashboard.description && (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">{dashboard.description}</p>
          )}
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {timeLabel}
            </span>
            <span className="flex items-center gap-1">
              <Users size={10} />
              {dashboard.ownerName}
            </span>
            <span>{dashboard.widgetCount} widgets</span>
          </div>
          {dashboard.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {dashboard.tags.slice(0, 3).map(tag => (
                <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-card-hover)] text-[var(--text-muted)]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
