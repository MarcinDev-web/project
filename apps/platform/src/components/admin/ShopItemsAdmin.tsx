/**
 * Shop Items Admin Component
 */

import { useState, useEffect } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { shopApi, type ShopItem } from '../../api/shop';

export function ShopItemsAdmin() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({
    category: '' as '' | 'consumable' | 'cosmetic' | 'upgrade' | 'collectible',
    currency: '',
    available: '' as '' | 'true' | 'false',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    void loadItems();
  }, [page, filters.category, filters.currency, filters.available, filters.search]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await shopApi.getItems({
        ...(filters.category && { category: filters.category }),
        ...(filters.currency && { currency: filters.currency }),
        ...(filters.available !== '' && { available: filters.available === 'true' }),
        ...(filters.search && { search: filters.search }),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load shop items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (itemData: Omit<ShopItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await shopApi.createItem(itemData);
      await loadItems();
      alert('Item created successfully');
    } catch (error) {
      console.error('Failed to create item:', error);
      alert('Failed to create item');
    }
  };

  const handleUpdate = async (id: string, updates: Partial<ShopItem>) => {
    try {
      await shopApi.updateItem(id, updates);
      await loadItems();
    } catch (error) {
      console.error('Failed to update item:', error);
      alert('Failed to update item');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      try {
        await shopApi.deleteItem(id);
        await loadItems();
      } catch (error) {
        console.error('Failed to delete item:', error);
        alert('Failed to delete item');
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
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => {
                setFilters({ ...filters, category: e.target.value as typeof filters.category });
                setPage(1);
              }}
              style={{
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <option value="">All Categories</option>
              <option value="consumable">Consumable</option>
              <option value="cosmetic">Cosmetic</option>
              <option value="upgrade">Upgrade</option>
              <option value="collectible">Collectible</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Currency
            </label>
            <select
              value={filters.currency}
              onChange={(e) => {
                setFilters({ ...filters, currency: e.target.value });
                setPage(1);
              }}
              style={{
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <option value="">All Currencies</option>
              <option value="coins">Coins</option>
              <option value="gems">Gems</option>
              <option value="credits">Credits</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Available
            </label>
            <select
              value={filters.available}
              onChange={(e) => {
                setFilters({ ...filters, available: e.target.value as typeof filters.available });
                setPage(1);
              }}
              style={{
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <option value="">All</option>
              <option value="true">Available</option>
              <option value="false">Unavailable</option>
            </select>
          </div>

          <Button
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
          >
            + New Item
          </Button>
        </div>
      </Card>

      {/* Items List */}
      {loading && items.length === 0 ? (
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
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Price</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Stock</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Available</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 'var(--font-medium)' }}>{item.name}</div>
                        {item.description && (
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>
                            {item.description.substring(0, 50)}...
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>{item.category}</td>
                      <td style={{ padding: '0.75rem' }}>
                        {item.price.amount} {item.price.currency}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {item.stock !== undefined ? item.stock : 'Unlimited'}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            background: item.available ? 'var(--color-success)' : 'var(--color-error)',
                            color: 'white',
                            fontSize: '0.75rem',
                          }}
                        >
                          {item.available ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => {
                              setEditingItem(item);
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => handleToggleAvailable(item.id, item.available)}
                          >
                            {item.available ? 'Hide' : 'Show'}
                          </Button>
                          <Button
                            size="small"
                            variant="danger"
                            onClick={() => handleDelete(item.id)}
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
            <ShopItemForm
              item={editingItem}
              onSave={async (itemData) => {
                if (editingItem) {
                  await handleUpdate(editingItem.id, itemData);
                } else {
                  await handleCreate(itemData);
                }
                setShowForm(false);
                setEditingItem(null);
              }}
              onCancel={() => {
                setShowForm(false);
                setEditingItem(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

interface ShopItemFormProps {
  item: ShopItem | null;
  onSave: (itemData: Omit<ShopItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

function ShopItemForm({ item, onSave, onCancel }: ShopItemFormProps) {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    description: item?.description || '',
    category: (item?.category || 'consumable') as ShopItem['category'],
    priceCurrency: item?.price.currency || 'coins',
    priceAmount: item?.price.amount || 0,
    imageUrl: item?.imageUrl || '',
    stock: item?.stock?.toString() || '',
    available: item?.available ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: formData.name,
        ...(formData.description && { description: formData.description }),
        category: formData.category,
        price: {
          currency: formData.priceCurrency,
          amount: formData.priceAmount,
        },
        ...(formData.imageUrl && { imageUrl: formData.imageUrl }),
        ...(formData.stock && { stock: parseInt(formData.stock, 10) }),
        available: formData.available,
      });
    } catch (error) {
      console.error('Failed to save item:', error);
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
        <h2 style={{ marginBottom: '1rem' }}>{item ? 'Edit Item' : 'Create Item'}</h2>

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
                Category *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as ShopItem['category'] })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <option value="consumable">Consumable</option>
                <option value="cosmetic">Cosmetic</option>
                <option value="upgrade">Upgrade</option>
                <option value="collectible">Collectible</option>
              </select>
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
                Image URL
              </label>
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
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
                Stock (leave empty for unlimited)
              </label>
              <input
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="Unlimited"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={formData.available}
                onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                id="available"
              />
              <label htmlFor="available" style={{ fontSize: '0.875rem' }}>
                Available
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : item ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

