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
  'user.login': 'bg-green-100 text-green-800 border-green-200',
  'user.role_change': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'glossary.create': 'bg-blue-100 text-blue-800 border-blue-200',
  'glossary.update': 'bg-amber-100 text-amber-800 border-amber-200',
  'glossary.delete': 'bg-red-100 text-red-800 border-red-200',
  'dashboard.create': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'dashboard.update': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'dashboard.delete': 'bg-red-100 text-red-800 border-red-200',
  'dashboard.share': 'bg-purple-100 text-purple-800 border-purple-200',
  'dashboard.duplicate': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'version.save': 'bg-teal-100 text-teal-800 border-teal-200',
  'version.revert': 'bg-orange-100 text-orange-800 border-orange-200',
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
  const uniqueUsers = [...new Set(logs.map(log => ({ id: log.userId, name: log.user.name, email: log.user.email })))];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="mt-2 text-sm text-gray-700">
            Monitor all system activities for GDPR/SOC2 compliance
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <select
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resource Type
              </label>
              <select
                value={selectedResourceType}
                onChange={(e) => {
                  setSelectedResourceType(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* End Date filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                Audit Log Entries
              </h2>
              <span className="text-sm text-gray-500">
                {total} total entries
              </span>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading audit logs...</p>
            </div>
          ) : error ? (
            <div className="px-6 py-12 text-center">
              <p className="text-red-600">{error}</p>
              <button
                onClick={fetchLogs}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Try again
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">No audit logs found matching your criteria.</p>
            </div>
          ) : (
            <>
              {/* Logs table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resource
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => {
                      const Icon = RESOURCE_ICONS[log.resourceType] || Activity;
                      return (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {log.user.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {log.user.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={cn(
                              'px-2 inline-flex text-xs leading-5 font-semibold rounded-full border',
                              ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800 border-gray-200'
                            )}>
                              {formatActionName(log.action)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Icon className="w-4 h-4 text-gray-400 mr-2" />
                              <div>
                                <div className="text-sm text-gray-900">
                                  {log.resourceType}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {log.resourceId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {log.metadata ? (
                              <details className="cursor-pointer">
                                <summary className="text-blue-600 hover:text-blue-800">
                                  View metadata
                                </summary>
                                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </details>
                            ) : (
                              <span className="text-gray-400">No metadata</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, total)} of {total} entries
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={cn(
                        'px-3 py-1 rounded-md text-sm font-medium',
                        currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={cn(
                        'px-3 py-1 rounded-md text-sm font-medium',
                        currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
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