import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Card } from '../../components/shared/Card';
import { Button } from '../../components/shared/Button';
import { adminApi, type AdminUser } from '../../api/admin';

export function UsersManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadUsers();
  }, [page, search, roleFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getUsers({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
      });
      setUsers(response.users);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string, updates: { active?: boolean; role?: string }) => {
    try {
      await adminApi.updateUser(userId, updates);
      await loadUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('Failed to update user');
    }
  };

  if (loading && users.length === 0) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>User Management</h1>

        {/* Filters */}
        <Card style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </Card>

        {/* Users List */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          {users.map((user) => (
            <Card key={user.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{user.email}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                    ID: {user.id} | Created: {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: user.active ? 'var(--bg-success, #e8f5e9)' : 'var(--bg-error, #ffebee)',
                      color: user.active ? 'var(--color-success, #2e7d32)' : 'var(--color-error, #c62828)',
                      fontSize: '0.75rem',
                    }}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-button)',
                      fontSize: '0.75rem',
                    }}>
                      {user.role || 'user'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    value={user.role || 'user'}
                    onChange={(e) => handleUpdateUser(user.id, { role: e.target.value })}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button
                    variant={user.active ? 'secondary' : 'primary'}
                    size="small"
                    onClick={() => handleUpdateUser(user.id, { active: !user.active })}
                  >
                    {user.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
              Page {page} of {Math.ceil(total / pageSize)}
            </span>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

