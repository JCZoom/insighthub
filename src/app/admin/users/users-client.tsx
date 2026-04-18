'use client';

import { useState, useEffect } from 'react';
import { SessionUser } from '@/lib/auth/session';

interface UserWithPermissions {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  hasOnboarded: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  permissionAssignments: Array<{
    permissionGroup: {
      id: string;
      name: string;
      description: string | null;
      isSystem: boolean;
    };
  }>;
  _count: {
    dashboards: number;
    chatSessions: number;
    publishedWidgets: number;
  };
}

interface PermissionGroup {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

interface UsersClientProps {
  currentUser: SessionUser;
}

export default function UsersClient({ currentUser }: UsersClientProps) {
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersResponse, groupsResponse] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/permission-groups'),
      ]);

      if (!usersResponse.ok || !groupsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [usersData, groupsData] = await Promise.all([
        usersResponse.json(),
        groupsResponse.json(),
      ]);

      setUsers(usersData.users);
      setPermissionGroups(groupsData.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const assignPermissionGroup = async (userId: string, permissionGroupId: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permissionGroupId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign permission group');
      }

      await fetchData();
      setShowAssignModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const removePermissionGroup = async (userId: string, permissionGroupId: string) => {
    if (!confirm('Are you sure you want to remove this permission group?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/users?userId=${userId}&permissionGroupId=${permissionGroupId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove permission group');
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error: {error}</p>
        <button
          onClick={() => {
            setError(null);
            fetchData();
          }}
          className="mt-2 bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Users ({users.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permission Groups
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.name}
                        {user.id === currentUser.id && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      {user.department && (
                        <div className="text-xs text-gray-400">{user.department}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="space-y-1">
                      <div>Joined: {formatDate(user.createdAt)}</div>
                      <div>Last login: {formatDate(user.lastLoginAt)}</div>
                      <div className="text-xs text-gray-500">
                        {user._count.dashboards} dashboards, {user._count.publishedWidgets} widgets
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {user.permissionAssignments.map((assignment) => (
                        <div
                          key={assignment.permissionGroup.id}
                          className="flex items-center justify-between bg-gray-100 rounded px-2 py-1"
                        >
                          <span className="text-xs font-medium">
                            {assignment.permissionGroup.name}
                            {assignment.permissionGroup.isSystem && (
                              <span className="ml-1 text-gray-500">(System)</span>
                            )}
                          </span>
                          <button
                            onClick={() =>
                              removePermissionGroup(user.id, assignment.permissionGroup.id)
                            }
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {user.permissionAssignments.length === 0 && (
                        <span className="text-sm text-gray-500">No permission groups assigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowAssignModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Assign Permission
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAssignModal && selectedUser && (
        <AssignPermissionModal
          user={selectedUser}
          permissionGroups={permissionGroups}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedUser(null);
          }}
          onAssign={assignPermissionGroup}
        />
      )}
    </div>
  );
}

function AssignPermissionModal({
  user,
  permissionGroups,
  onClose,
  onAssign,
}: {
  user: UserWithPermissions;
  permissionGroups: PermissionGroup[];
  onClose: () => void;
  onAssign: (userId: string, permissionGroupId: string) => void;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState('');

  // Filter out groups that are already assigned to the user
  const assignedGroupIds = user.permissionAssignments.map(
    (assignment) => assignment.permissionGroup.id
  );
  const availableGroups = permissionGroups.filter(
    (group) => !assignedGroupIds.includes(group.id)
  );

  const handleAssign = () => {
    if (selectedGroupId) {
      onAssign(user.id, selectedGroupId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Assign Permission Group to {user.name}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Permission Group
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a permission group...</option>
                {availableGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                    {group.isSystem && ' (System)'}
                  </option>
                ))}
              </select>
            </div>

            {selectedGroupId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="font-medium text-blue-900 mb-1">Selected Group Details</h4>
                {(() => {
                  const group = availableGroups.find((g) => g.id === selectedGroupId);
                  return group ? (
                    <div>
                      <p className="text-blue-700 text-sm">{group.description}</p>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {availableGroups.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-gray-600 text-sm">
                  All available permission groups have already been assigned to this user.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedGroupId}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Assign Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
