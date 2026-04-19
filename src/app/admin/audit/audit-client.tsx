'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Calendar, User, Activity, Database, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, any> | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const ACTION_COLORS: Record<string, string> = {
  'user.login': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
  'user.role_change': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  'glossary.create': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  'glossary.update': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  'glossary.delete': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
  'dashboard.create': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  'dashboard.update': 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  'dashboard.delete': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
  'dashboard.share': 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  'dashboard.duplicate': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  'version.save': 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  'version.revert': 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800',
};

const RESOURCE_ICONS: Record<string, typeof User> = {
  user: User,
  glossary: Database,
  dashboard: Activity,
  version: Shield,
};

export function AuditLogClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedResourceType, setSelectedResourceType] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(50);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      const offset = (currentPage - 1) * limit;

      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      if (selectedAction) params.append('action', selectedAction);
      if (selectedResourceType) params.append('resourceType', selectedResourceType);
      if (selectedUserId) params.append('userId', selectedUserId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/admin/audit?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch audit logs: ${response.status}`);
      }

      const data: AuditLogsResponse = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, selectedAction, selectedResourceType, selectedUserId, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const clearFilters = () => {
    setSelectedAction('');
    setSelectedResourceType('');
    setSelectedUserId('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatActionName = (action: string) => {
    return action.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  };

  const totalPages = Math.ceil(total / limit);
  const hasFilters = selectedAction || selectedResourceType || selectedUserId || startDate || endDate;

  const uniqueActions = [...new Set(logs.map(log => log.action))];
  const uniqueResourceTypes = [...new Set(logs.map(log => log.resourceType))];
  const uniqueUsers = [...new Map(logs.map(log => [log.userId, { id: log.userId, name: log.user.name, email: log.user.email }])).values()];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Audit Logs</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Monitor all system activities for GDPR/SOC2 compliance
          </p>
        </div>

        {/* Filters */}
        <div className="bg-[var(--bg-card)] p-6 rounded-lg shadow-sm border border-[var(--border-color)] mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-[var(--text-primary)] flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filters
            </h2>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Action filter */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Action
              </label>
              <select
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-md text-sm focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
              >
                <option value="">All actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>
                    {formatActionName(action)}
                  </option>
                ))}
              </select>
            </div>

            {/* Resource Type filter */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Resource Type
              </label>
              <select
                value={selectedResourceType}
                onChange={(e) => {
                  setSelectedResourceType(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-md text-sm focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
              >
                <option value="">All types</option>
                {uniqueResourceTypes.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* User filter */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                User
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-md text-sm focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
              >
                <option value="">All users</option>
                {uniqueUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date filter */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Start Date
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-md text-sm focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
              />
            </div>

            {/* End Date filter */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                End Date
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-md text-sm focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-[var(--bg-card)] rounded-lg shadow-sm border border-[var(--border-color)]">
          <div className="px-6 py-4 border-b border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-[var(--text-primary)]">
                Audit Log Entries
              </h2>
              <span className="text-sm text-[var(--text-muted)]">
                {total} total entries
              </span>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">Loading audit logs...</p>
            </div>
          ) : error ? (
            <div className="px-6 py-12 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={fetchLogs}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Try again
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[var(--text-muted)]">No audit logs found matching your criteria.</p>
            </div>
          ) : (
            <>
              {/* Logs table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--bg-card-hover)]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                        Resource
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--bg-card)] divide-y divide-[var(--border-color)]">
                    {logs.map((log) => {
                      const Icon = RESOURCE_ICONS[log.resourceType] || Activity;
                      return (
                        <tr key={log.id} className="hover:bg-[var(--bg-card-hover)]">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-primary)]">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-[var(--text-primary)]">
                                {log.user.name}
                              </div>
                              <div className="text-sm text-[var(--text-secondary)]">
                                {log.user.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={cn(
                              'px-2 inline-flex text-xs leading-5 font-semibold rounded-full border',
                              ACTION_COLORS[log.action] || 'bg-[var(--bg-card-hover)] text-[var(--text-primary)] border-[var(--border-color)]'
                            )}>
                              {formatActionName(log.action)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Icon className="w-4 h-4 text-[var(--text-muted)] mr-2" />
                              <div>
                                <div className="text-sm text-[var(--text-primary)]">
                                  {log.resourceType}
                                </div>
                                <div className="text-xs text-[var(--text-muted)]">
                                  {log.resourceId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-[var(--text-muted)]">
                            {log.metadata ? (
                              <details className="cursor-pointer">
                                <summary className="text-accent-blue hover:text-accent-blue/80">
                                  View metadata
                                </summary>
                                <pre className="mt-2 text-xs bg-[var(--bg-card-hover)] text-[var(--text-primary)] p-2 rounded overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </details>
                            ) : (
                              <span className="text-[var(--text-muted)]">No metadata</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-[var(--border-color)]">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-[var(--text-secondary)]">
                    Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, total)} of {total} entries
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={cn(
                        'px-3 py-1 rounded-md text-sm font-medium',
                        currentPage === 1
                          ? 'bg-[var(--bg-card-hover)] text-[var(--text-muted)] cursor-not-allowed'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card-hover)]'
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 text-sm text-[var(--text-secondary)]">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={cn(
                        'px-3 py-1 rounded-md text-sm font-medium',
                        currentPage === totalPages
                          ? 'bg-[var(--bg-card-hover)] text-[var(--text-muted)] cursor-not-allowed'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card-hover)]'
                      )}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}