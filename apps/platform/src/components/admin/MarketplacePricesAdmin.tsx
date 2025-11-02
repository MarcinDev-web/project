/**
 * Marketplace Prices Admin Component
 */

import { useState, useEffect } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { adminApi, type MarketplaceItem } from '../../api/admin';
import { marketplaceApi } from '../../api/marketplace';

export function MarketplacePricesAdmin() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'with-price' | 'without-price'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'build' | 'avatar'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingPrice, setEditingPrice] = useState<{ id: string; price: { currency: string; amount: number } | null } | null>(null);
  const pageSize = 20;

  useEffect(() => {
    void loadItems();
  }, [page, filter, typeFilter, search]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getMarketplaceItems({
        limit: pageSize * 2, // Get more to filter
        offset: 0,
        ...(typeFilter !== 'all' && { type: typeFilter }),
      });

      let filtered = response.items;

      // Filter by search
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(item =>
          item.title.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower)
        );
      }

      // Filter by price
      if (filter === 'with-price') {
        filtered = filtered.filter(item => item.price !== undefined);
      } else if (filter === 'without-price') {
        filtered = filtered.filter(item => item.price === undefined);
      }

      // Apply pagination
      const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

      setItems(paginated);
      setTotal(filtered.length);
    } catch (error) {
      console.error('Failed to load marketplace items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrice = async (id: string, price: { currency: string; amount: number } | null) => {
    try {
      await marketplaceApi.setPrice(id, price);
      await loadItems();
      setEditingPrice(null);
    } catch (error) {
      console.error('Failed to set price:', error);
      alert('Failed to set price');
    }
  };

  const handleBulkSetPrice = async (price: { currency: string; amount: number }) => {
    if (selectedItems.size === 0) {
      alert('Please select items first');
      return;
    }

    if (confirm(`Set price ${price.amount} ${price.currency} for ${selectedItems.size} item(s)?`)) {
      try {
        await Promise.all(
          Array.from(selectedItems).map(id => marketplaceApi.setPrice(id, price))
        );
        setSelectedItems(new Set());
        await loadItems();
      } catch (error) {
        console.error('Failed to bulk set price:', error);
        alert('Failed to set prices');
      }
    }
  };

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  };

  return (
    <div>
      {/* Filters and Bulk Actions */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Search by title..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
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
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as typeof typeFilter);
                setPage(1);
              }}
              style={{
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <option value="all">All Types</option>
              <option value="build">Builds</option>
              <option value="avatar">Avatars</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Price Filter
            </label>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as typeof filter);
                setPage(1);
              }}
              style={{
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <option value="all">All Items</option>
              <option value="with-price">With Price</option>
              <option value="without-price">Without Price</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedItems.size > 0 && (
          <div style={{ padding: '1rem', background: 'var(--bg-button)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ marginBottom: '0.5rem', fontWeight: 'var(--font-medium)' }}>
              {selectedItems.size} item(s) selected
            </div>
            <BulkPriceForm
              onSetPrice={handleBulkSetPrice}
              onCancel={() => setSelectedItems(new Set())}
            />
          </div>
        )}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={selectedItems.size === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                />
                <span style={{ fontSize: '0.875rem' }}>Select All</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-default)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedItems.size === items.length && items.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Title</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Current Price</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Author</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 'var(--font-medium)' }}>{item.title}</div>
                        {item.description && (
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>
                            {item.description.substring(0, 50)}...
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>{item.type}</td>
                      <td style={{ padding: '0.75rem' }}>
                        {item.price ? (
                          <span style={{ fontWeight: 'var(--font-medium)' }}>
                            {item.price.amount} {item.price.currency}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Free</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                        {item.authorName || item.authorId}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => setEditingPrice({
                            id: item.id,
                            price: item.price || null,
                          })}
                        >
                          {item.price ? 'Edit Price' : 'Set Price'}
                        </Button>
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

          {/* Price Edit Modal */}
          {editingPrice && (
            <PriceEditModal
              itemId={editingPrice.id}
              currentPrice={editingPrice.price}
              onSave={async (price) => {
                await handleSetPrice(editingPrice.id, price);
              }}
              onCancel={() => setEditingPrice(null)}
              onRemove={async () => {
                await handleSetPrice(editingPrice.id, null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

interface BulkPriceFormProps {
  onSetPrice: (price: { currency: string; amount: number }) => Promise<void>;
  onCancel: () => void;
}

function BulkPriceForm({ onSetPrice, onCancel }: BulkPriceFormProps) {
  const [currency, setCurrency] = useState('coins');
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('Amount must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      await onSetPrice({ currency, amount });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
          Currency
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          style={{
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
          Amount
        </label>
        <input
          type="number"
          required
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          style={{
            padding: '0.5rem',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
          }}
        />
      </div>

      <Button type="submit" disabled={saving || amount <= 0}>
        {saving ? 'Setting...' : 'Set Price'}
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

interface PriceEditModalProps {
  itemId: string;
  currentPrice: { currency: string; amount: number } | null;
  onSave: (price: { currency: string; amount: number } | null) => Promise<void>;
  onCancel: () => void;
  onRemove: () => Promise<void>;
}

function PriceEditModal({ currentPrice, onSave, onCancel, onRemove }: PriceEditModalProps) {
  const [currency, setCurrency] = useState(currentPrice?.currency || 'coins');
  const [amount, setAmount] = useState(currentPrice?.amount || 0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('Amount must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      await onSave({ currency, amount });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (confirm('Remove price (make item free)?')) {
      setSaving(true);
      try {
        await onRemove();
      } finally {
        setSaving(false);
      }
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
        style={{ maxWidth: '400px', width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '1rem' }}>Set Price</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                Currency *
              </label>
              <select
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
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
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            {currentPrice && (
              <Button type="button" variant="danger" onClick={handleRemove} disabled={saving}>
                Remove Price
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || amount <= 0}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

