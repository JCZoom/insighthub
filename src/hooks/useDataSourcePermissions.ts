'use client';

import { useState, useEffect } from 'react';

export interface DataSourcePermission {
  name: string;
  accessLevel: 'FULL' | 'FILTERED' | 'NONE';
  category?: string;
  isRestricted: boolean;
}

export interface DataSourcePermissions {
  allowedSources: string[];
  sourcesWithAccess: DataSourcePermission[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch data source permissions for the current user
 */
export function useDataSourcePermissions(): DataSourcePermissions {
  const [data, setData] = useState<DataSourcePermissions>({
    allowedSources: [],
    sourcesWithAccess: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }));

        const response = await fetch('/api/data/query');
        if (!response.ok) {
          throw new Error('Failed to fetch data source permissions');
        }

        const result = await response.json();

        setData({
          allowedSources: result.sources || [],
          sourcesWithAccess: result.sourcesWithAccess || [],
          loading: false,
          error: null,
        });
      } catch (error) {
        setData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    fetchPermissions();
  }, []);

  return data;
}

/**
 * Check if a specific data source is accessible with the given restrictions
 */
export function useDataSourceAccess(sourceName: string): {
  hasAccess: boolean;
  accessLevel: 'FULL' | 'FILTERED' | 'NONE';
  isRestricted: boolean;
  category?: string;
} {
  const { sourcesWithAccess } = useDataSourcePermissions();

  const sourcePermission = sourcesWithAccess.find(s =>
    s.name === sourceName ||
    s.name.toLowerCase().includes(sourceName.toLowerCase()) ||
    sourceName.toLowerCase().includes(s.name.toLowerCase())
  );

  if (!sourcePermission) {
    return {
      hasAccess: false,
      accessLevel: 'NONE',
      isRestricted: true,
    };
  }

  return {
    hasAccess: sourcePermission.accessLevel !== 'NONE',
    accessLevel: sourcePermission.accessLevel,
    isRestricted: sourcePermission.isRestricted,
    category: sourcePermission.category,
  };
}