/**
 * Assets Admin Component
 */

import { useState, useEffect } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { shopApi, type Asset } from '../../api/shop';

export function AssetsAdmin() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({
    type: '' as '' | 'material' | 'model' | 'texture' | 'script',
    category: '',
    authorId: '',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    void loadAssets();
  }, [page, filters.type, filters.category, filters.authorId, filters.search]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const response = await shopApi.getAssets({
        ...(filters.type && { type: filters.type }),
        ...(filters.category && { category: filters.category }),
        ...(filters.authorId && { authorId: filters.authorId }),
        ...(filters.search && { search: filters.search }),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setAssets(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Asset>) => {
    try {
      await shopApi.updateAsset(id, updates);
      await loadAssets();
    } catch (error) {
      console.error('Failed to update asset:', error);
      alert('Failed to update asset');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this asset? This action cannot be undone.')) {
      try {
        await shopApi.deleteAsset(id);
        await loadAssets();
      } catch (error) {
        console.error('Failed to delete asset:', error);
        alert('Failed to delete asset');
      }
    }
  };

  const handleToggleAvailable = async (id: string, currentAvailable: boolean) => {
    try {
      await handleUpdate(id, { available: !currentAvailable });
    } catch (error) {
      console.error('Failed to toggle availability:', error);
    }
  };

  return (
    <div>
      {/* Filters */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Search by name..."
              value={filters.search}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => {
                setFilters({ ...filters, type: e.target.value as typeof filters.type });
                setPage(1);
              }}
              style={{
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <option value="">All Types</option>
              <option value="material">Material</option>
              <option value="model">Model</option>
              <option value="texture">Texture</option>
              <option value="script">Script</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Category
            </label>
            <input
              type="text"
              placeholder="Category..."
              value={filters.category}
              onChange={(e) => {
                setFilters({ ...filters, category: e.target.value });
                setPage(1);
              }}
              style={{
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Author ID
            </label>
            <input
              type="text"
              placeholder="Author ID..."
              value={filters.authorId}
              onChange={(e) => {
                setFilters({ ...filters, authorId: e.target.value });
                setPage(1);
              }}
              style={{
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>
        </div>
      </Card>

      {/* Assets List */}
      {loading && assets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
      ) : (
        <>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <strong>Total: {total}</strong>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-default)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Price</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Author</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Available</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 'var(--font-medium)' }}>{asset.name}</div>
                        {asset.description && (
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>
                            {asset.description.substring(0, 50)}...
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>{asset.type}</td>
                      <td style={{ padding: '0.75rem' }}>{asset.category || '-'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        {asset.price.amount} {asset.price.currency}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{asset.authorId}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            background: asset.available ? 'var(--color-success)' : 'var(--color-error)',
                            color: 'white',
                            fontSize: '0.75rem',
                          }}
                        >
                          {asset.available ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => {
                              setEditingAsset(asset);
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => handleToggleAvailable(asset.id, asset.available)}
                          >
                            {asset.available ? 'Hide' : 'Show'}
                          </Button>
                          <Button
                            size="small"
                            variant="danger"
                            onClick={() => handleDelete(asset.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {total > pageSize && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                  Page {page} of {Math.ceil(total / pageSize)}
                </span>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                  disabled={page >= Math.ceil(total / pageSize)}
                >
                  Next
                </Button>
              </div>
            )}
          </Card>

          {/* Create/Edit Form Modal */}
          {showForm && (
            <AssetForm
              asset={editingAsset}
              onSave={async (assetData) => {
                if (editingAsset) {
                  await handleUpdate(editingAsset.id, assetData);
                }
                setShowForm(false);
                setEditingAsset(null);
              }}
              onCancel={() => {
                setShowForm(false);
                setEditingAsset(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

interface AssetFormProps {
  asset: Asset | null;
  onSave: (assetData: Partial<Asset>) => Promise<void>;
  onCancel: () => void;
}

function AssetForm({ asset, onSave, onCancel }: AssetFormProps) {
  const [formData, setFormData] = useState({
    name: asset?.name || '',
    description: asset?.description || '',
    type: (asset?.type || 'material') as Asset['type'],
    category: asset?.category || '',
    priceCurrency: asset?.price.currency || 'coins',
    priceAmount: asset?.price.amount || 0,
    previewUrl: asset?.previewUrl || '',
    fileUrl: asset?.fileUrl || '',
    metadata: JSON.stringify(asset?.metadata || {}, null, 2),
    available: asset?.available ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [metadataError, setMetadataError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate metadata JSON
    let parsedMetadata: Record<string, unknown> = {};
    try {
      parsedMetadata = JSON.parse(formData.metadata);
    } catch (error) {
      setMetadataError('Invalid JSON format');
      return;
    }

    setMetadataError('');
    setSaving(true);
    try {
      await onSave({
        name: formData.name,
        ...(formData.description && { description: formData.description }),
        type: formData.type,
        ...(formData.category && { category: formData.category }),
        price: {
          currency: formData.priceCurrency,
          amount: formData.priceAmount,
        },
        ...(formData.previewUrl && { previewUrl: formData.previewUrl }),
        fileUrl: formData.fileUrl,
        metadata: parsedMetadata,
        available: formData.available,
      });
    } catch (error) {
      console.error('Failed to save asset:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <Card
        style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '1rem' }}>Edit Asset</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                Type *
              </label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Asset['type'] })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <option value="material">Material</option>
                <option value="model">Model</option>
                <option value="texture">Texture</option>
                <option value="script">Script</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                  Currency *
                </label>
                <select
                  required
                  value={formData.priceCurrency}
                  onChange={(e) => setFormData({ ...formData, priceCurrency: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <option value="coins">Coins</option>
                  <option value="gems">Gems</option>
                  <option value="credits">Credits</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                  Amount *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.priceAmount}
                  onChange={(e) => setFormData({ ...formData, priceAmount: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                Preview URL
              </label>
              <input
                type="url"
                value={formData.previewUrl}
                onChange={(e) => setFormData({ ...formData, previewUrl: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                File URL *
              </label>
              <input
                type="url"
                required
                value={formData.fileUrl}
                onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                Metadata (JSON)
              </label>
              <textarea
                value={formData.metadata}
                onChange={(e) => {
                  setFormData({ ...formData, metadata: e.target.value });
                  setMetadataError('');
                }}
                rows={5}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: `1px solid ${metadataError ? 'var(--color-error)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}
              />
              {metadataError && (
                <div style={{ color: 'var(--color-error)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {metadataError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={formData.available}
                onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                id="asset-available"
              />
              <label htmlFor="asset-available" style={{ fontSize: '0.875rem' }}>
                Available
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !!metadataError}>
              {saving ? 'Saving...' : 'Update'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

