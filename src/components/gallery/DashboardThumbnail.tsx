'use client';

import { useState } from 'react';
import { BarChart3, PieChart, TrendingUp, Activity, Database, Users } from 'lucide-react';

interface DashboardThumbnailProps {
  /** Dashboard ID for loading thumbnail */
  dashboardId: string;
  /** Dashboard title for alt text */
  title: string;
  /** Widget count to determine placeholder type */
  widgetCount?: number;
  /** Whether this is a template dashboard */
  isTemplate?: boolean;
  /** Custom CSS classes */
  className?: string;
}

// Fallback icons based on dashboard type and widget count
const FALLBACK_ICONS = [
  { icon: BarChart3, color: 'text-accent-blue' },
  { icon: PieChart, color: 'text-accent-purple' },
  { icon: TrendingUp, color: 'text-accent-green' },
  { icon: Activity, color: 'text-accent-cyan' },
  { icon: Database, color: 'text-accent-amber' },
  { icon: Users, color: 'text-accent-red' },
];

// Generate consistent fallback based on dashboard ID
function getFallbackIcon(dashboardId: string, isTemplate: boolean) {
  // Use hash of dashboard ID to pick consistent icon
  let hash = 0;
  for (let i = 0; i < dashboardId.length; i++) {
    const char = dashboardId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const index = Math.abs(hash) % FALLBACK_ICONS.length;
  const fallback = FALLBACK_ICONS[index];

  return {
    ...fallback,
    // Templates get a consistent blue/purple gradient
    gradient: isTemplate
      ? 'from-accent-blue/15 via-accent-purple/10 to-accent-blue/5'
      : `from-${fallback.color.split('-')[1]}/10 via-accent-purple/5 to-accent-cyan/8`
  };
}

export function DashboardThumbnail({
  dashboardId,
  title,
  widgetCount = 0,
  isTemplate = false,
  className = ''
}: DashboardThumbnailProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const thumbnailUrl = `/thumbnails/${dashboardId}.png`;
  const fallback = getFallbackIcon(dashboardId, isTemplate);
  const IconComponent = fallback.icon;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background gradient - always visible for smooth loading */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${fallback.gradient} transition-opacity duration-300 ${
          imageLoaded && !imageError ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Thumbnail image */}
      {!imageError && (
        <img
          src={thumbnailUrl}
          alt={`${title} dashboard preview`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          loading="lazy"
        />
      )}

      {/* Fallback icon - visible when no image or loading */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          imageLoaded && !imageError ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <IconComponent size={32} className={`${fallback.color}/40`} />
      </div>


      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}