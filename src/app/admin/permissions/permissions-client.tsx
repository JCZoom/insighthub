'use client';

import { useState, useEffect } from 'react';
import { SessionUser } from '@/lib/auth/session';
import { DATA_CATEGORIES, type DataCategory, type FeaturePermissions, type DataPermissions } from '@/lib/auth/permissions';

interface PermissionGroup {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  featurePermissions: string;
  dataPermissions: string;
  userAssignments: Array<{
    user: { id: string; name: string; email: string };
  }>;
  _count: {
    userAssignments: number;
  };
}

interface PermissionGroupsClientProps {
  user: SessionUser;
}

const FEATURE_PERMISSION_LABELS = {
  canCreateDashboard: 'Create Dashboards',
  canEditGlossary: 'Edit Glossary',
  canAccessSensitiveData: 'Access Sensitive Data',
  canPublishWidgets: 'Publish Widgets',
  canManageUsers: 'Manage Users',
  canManagePermissions: 'Manage Permissions',
  canViewAuditLog: 'View Audit Log',
  canExportData: 'Export Data',
  canShareDashboards: 'Share Dashboards',
  canCreateFilters: 'Create Filters',
};

export default function PermissionGroupsClient({ user }: PermissionGroupsClientProps) {
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/permission-groups');
      if (!response.ok) {
        throw new Error('Failed to fetch permission groups');
      }
      const data = await response.json();
      setGroups(data.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (groupData: {
    name: string;
    description?: string;
    featurePermissions: FeaturePermissions;
    dataPermissions: DataPermissions;
  }) => {
    try {
      const response = await fetch('/api/admin/permission-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create permission group');
      }

      await fetchGroups();
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const updateGroup = async (
    id: string,
    groupData: {
      name?: string;
      description?: string;
      featurePermissions?: FeaturePermissions;
      dataPermissions?: DataPermissions;
    }
  ) => {
    try {
      const response = await fetch('/api/admin/permission-groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...groupData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update permission group');
      }

      await fetchGroups();
      setEditingGroup(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this permission group?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/permission-groups?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete permission group');
      }

      await fetchGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
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
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400">Error: {error}</p>
        <button
          onClick={() => {
            setError(null);
            fetchGroups();
          }}
          className="mt-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Permission Groups</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Group
        </button>
      </div>

      <div className="grid gap-6">
        {groups.map((group) => (
          <PermissionGroupCard
            key={group.id}
            group={group}
            onEdit={() => setEditingGroup(group)}
            onDelete={() => deleteGroup(group.id)}
          />
        ))}
      </div>

      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createGroup}
        />
      )}

      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onUpdate={(data) => updateGroup(editingGroup.id, data)}
        />
      )}
    </div>
  );
}

function PermissionGroupCard({
  group,
  onEdit,
  onDelete,
}: {
  group: PermissionGroup;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const featurePerms = JSON.parse(group.featurePermissions) as FeaturePermissions;
  const dataPerms = JSON.parse(group.dataPermissions) as DataPermissions;

  const enabledFeatures = Object.entries(featurePerms)
    .filter(([, enabled]) => enabled)
    .map(([key]) => FEATURE_PERMISSION_LABELS[key as keyof FeaturePermissions])
    .filter(Boolean);

  const dataAccess = Object.entries(dataPerms)
    .filter(([, level]) => level !== 'NONE')
    .map(([category, level]) => `${category}: ${level}`);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {group.name}
            {group.isSystem && (
              <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                System
              </span>
            )}
          </h3>
          {group.description && (
            <p className="text-gray-600 dark:text-gray-300 mt-1">{group.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            disabled={group.isSystem}
            className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            disabled={group.isSystem || group._count.userAssignments > 0}
            className="text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Feature Permissions</h4>
          {enabledFeatures.length > 0 ? (
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              {enabledFeatures.map((feature) => (
                <li key={feature} className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  {feature}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No feature permissions</p>
          )}
        </div>

        <div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Data Access</h4>
          {dataAccess.length > 0 ? (
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              {dataAccess.map((access) => (
                <li key={access} className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  {access}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No data access</p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <strong>{group._count.userAssignments}</strong> users assigned
        </p>
      </div>
    </div>
  );
}

function CreateGroupModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    featurePermissions: Object.fromEntries(
      Object.keys(FEATURE_PERMISSION_LABELS).map(key => [key, false])
    ) as unknown as FeaturePermissions,
    dataPermissions: Object.fromEntries(
      Object.keys(DATA_CATEGORIES).map(key => [key, 'NONE'])
    ) as unknown as DataPermissions,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Create Permission Group</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Feature Permissions</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(FEATURE_PERMISSION_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.featurePermissions[key as keyof FeaturePermissions]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          featurePermissions: {
                            ...formData.featurePermissions,
                            [key]: e.target.checked,
                          },
                        })
                      }
                      className="rounded border-gray-300 text-blue-600 mr-2"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Data Permissions</h3>
              <div className="space-y-2">
                {Object.keys(DATA_CATEGORIES).map((category) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{category}</span>
                    <select
                      value={formData.dataPermissions[category as DataCategory]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dataPermissions: {
                            ...formData.dataPermissions,
                            [category]: e.target.value as 'FULL' | 'NONE' | 'FILTERED',
                          },
                        })
                      }
                      className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1 text-sm"
                    >
                      <option value="NONE">None</option>
                      <option value="FILTERED">Filtered</option>
                      <option value="FULL">Full</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditGroupModal({
  group,
  onClose,
  onUpdate,
}: {
  group: PermissionGroup;
  onClose: () => void;
  onUpdate: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: group.name,
    description: group.description || '',
    featurePermissions: JSON.parse(group.featurePermissions) as FeaturePermissions,
    dataPermissions: JSON.parse(group.dataPermissions) as DataPermissions,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Edit Permission Group</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Feature Permissions</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(FEATURE_PERMISSION_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.featurePermissions[key as keyof FeaturePermissions]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          featurePermissions: {
                            ...formData.featurePermissions,
                            [key]: e.target.checked,
                          },
                        })
                      }
                      className="rounded border-gray-300 text-blue-600 mr-2"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Data Permissions</h3>
              <div className="space-y-2">
                {Object.keys(DATA_CATEGORIES).map((category) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{category}</span>
                    <select
                      value={formData.dataPermissions[category as DataCategory]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dataPermissions: {
                            ...formData.dataPermissions,
                            [category]: e.target.value as 'FULL' | 'NONE' | 'FILTERED',
                          },
                        })
                      }
                      className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1 text-sm"
                    >
                      <option value="NONE">None</option>
                      <option value="FILTERED">Filtered</option>
                      <option value="FULL">Full</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Update Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}