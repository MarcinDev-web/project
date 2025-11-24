import { useState, useEffect } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { studioApi, type StudioProject, type GamePassConfig, type ShopItemConfig, type RevenueStats } from '../../api/studio';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/studio.css';

interface StudioMonetizationProps {
  projects: StudioProject[];
}

export function StudioMonetization({ projects }: StudioMonetizationProps) {
  const { showToast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [gamePasses, setGamePasses] = useState<GamePassConfig[]>([]);
  const [shopItems, setShopItems] = useState<ShopItemConfig[]>([]);
  const [revenue, setRevenue] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'revenue' | 'gamepasses' | 'shop'>('revenue');

  // Form states
  const [isEditingPass, setIsEditingPass] = useState<GamePassConfig | null | 'new'>(null);
  const [isEditingItem, setIsEditingItem] = useState<ShopItemConfig | null | 'new'>(null);

  useEffect(() => {
    if (selectedProjectId) {
      void loadMonetizationData(selectedProjectId);
    }
  }, [selectedProjectId]);

  const loadMonetizationData = async (projectId: string) => {
    setLoading(true);
    try {
      const data = await studioApi.getMonetizationSettings(projectId);
      setGamePasses(data.gamePasses);
      setShopItems(data.shopItems);
      setRevenue(data.revenue);
    } catch (error) {
      console.error('Failed to load monetization data:', error);
      // Graceful degradation if API endpoint not fully ready
      setGamePasses([]);
      setShopItems([]);
      setRevenue(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    
    const passData = {
      id: isEditingPass !== 'new' ? isEditingPass?.id : undefined,
      name: data.get('name') as string,
      description: data.get('description') as string,
      monthlyPrice: {
        currency: 'COINS',
        amount: Number(data.get('amount')),
      },
      benefits: (data.get('benefits') as string).split('\n').filter(b => b.trim()),
      active: data.get('active') === 'on',
    };

    try {
      await studioApi.upsertGamePass(selectedProjectId, passData);
      showToast('Game Pass zapisany', 'success');
      setIsEditingPass(null);
      void loadMonetizationData(selectedProjectId);
    } catch (error) {
      showToast('Błąd zapisu Game Pass', 'error');
      console.error(error);
    }
  };

  const handleSaveItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const itemData = {
      id: isEditingItem !== 'new' ? isEditingItem?.id : undefined,
      name: data.get('name') as string,
      description: data.get('description') as string,
      price: {
        currency: 'COINS',
        amount: Number(data.get('amount')),
      },
      category: data.get('category') as 'consumable' | 'cosmetic' | 'permanent',
      available: data.get('available') === 'on',
      quantity: data.get('quantity') ? Number(data.get('quantity')) : undefined,
    };

    try {
      await studioApi.upsertShopItem(selectedProjectId, itemData);
      showToast('Przedmiot zapisany', 'success');
      setIsEditingItem(null);
      void loadMonetizationData(selectedProjectId);
    } catch (error) {
      showToast('Błąd zapisu przedmiotu', 'error');
      console.error(error);
    }
  };

  if (projects.length === 0) {
    return (
      <Card>
        <div className="studio-empty-state">
          <h3>Brak projektów</h3>
          <p>Stwórz najpierw grę, aby zarządzać jej monetyzacją.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="studio-monetization">
      <div className="monetization-header">
        <select 
          value={selectedProjectId} 
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="project-selector"
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        
        <div className="monetization-tabs">
          <button 
            className={`tab-btn ${activeSection === 'revenue' ? 'active' : ''}`}
            onClick={() => setActiveSection('revenue')}
          >
            Przychody
          </button>
          <button 
            className={`tab-btn ${activeSection === 'gamepasses' ? 'active' : ''}`}
            onClick={() => setActiveSection('gamepasses')}
          >
            Game Passy
          </button>
          <button 
            className={`tab-btn ${activeSection === 'shop' ? 'active' : ''}`}
            onClick={() => setActiveSection('shop')}
          >
            Sklep
          </button>
        </div>
      </div>

      {loading ? (
        <div className="studio-loading">Ładowanie danych monetyzacji...</div>
      ) : (
        <div className="monetization-content">
          {activeSection === 'revenue' && (
            <div className="revenue-dashboard">
              <div className="stats-grid">
                <Card>
                  <div className="stat-item">
                    <div className="stat-label">Całkowity Przychód</div>
                    <div className="stat-value accent">
                      {revenue?.totalRevenue.amount ?? 0} <small>COINS</small>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="stat-item">
                    <div className="stat-label">Ostatni Miesiąc</div>
                    <div className="stat-value">
                      {revenue?.lastMonthRevenue.amount ?? 0} <small>COINS</small>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="stat-item">
                    <div className="stat-label">Twój Udział (Split)</div>
                    <div className="stat-value">
                      {((revenue?.creatorSplit ?? 0.7) * 100)}%
                    </div>
                    <div className="stat-desc">Platforma pobiera 30% prowizji</div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeSection === 'gamepasses' && (
            <div className="gamepasses-section">
              <div className="section-header">
                <h3>Twoje Game Passy</h3>
                <Button onClick={() => setIsEditingPass('new')} variant="primary" size="sm">
                  + Dodaj Game Pass
                </Button>
              </div>

              {isEditingPass && (
                <Card className="edit-form-card">
                  <form onSubmit={handleSavePass}>
                    <h4>{isEditingPass === 'new' ? 'Nowy Game Pass' : 'Edytuj Game Pass'}</h4>
                    <div className="form-group">
                      <label>Nazwa</label>
                      <input name="name" defaultValue={isEditingPass !== 'new' ? isEditingPass?.name : ''} required />
                    </div>
                    <div className="form-group">
                      <label>Opis</label>
                      <textarea name="description" defaultValue={isEditingPass !== 'new' ? isEditingPass?.description : ''} />
                    </div>
                    <div className="form-group">
                      <label>Cena (Coins)</label>
                      <input type="number" name="amount" defaultValue={isEditingPass !== 'new' ? isEditingPass?.monthlyPrice.amount : 100} required min="0" />
                    </div>
                    <div className="form-group">
                      <label>Benefity (jeden per linia)</label>
                      <textarea name="benefits" defaultValue={isEditingPass !== 'new' ? isEditingPass?.benefits.join('\n') : ''} rows={4} />
                    </div>
                    <div className="form-group checkbox">
                      <label>
                        <input type="checkbox" name="active" defaultChecked={isEditingPass !== 'new' ? isEditingPass?.active : true} />
                        Aktywny
                      </label>
                    </div>
                    <div className="form-actions">
                      <Button type="button" variant="secondary" onClick={() => setIsEditingPass(null)}>Anuluj</Button>
                      <Button type="submit" variant="primary">Zapisz</Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="items-list">
                {gamePasses.map(pass => (
                  <Card key={pass.id} className="item-card">
                    <div className="item-header">
                      <h4>{pass.name}</h4>
                      <span className={`status-badge ${pass.active ? 'active' : 'inactive'}`}>
                        {pass.active ? 'Aktywny' : 'Nieaktywny'}
                      </span>
                    </div>
                    <p className="item-price">{pass.monthlyPrice.amount} Coins / mc</p>
                    <div className="item-actions">
                      <Button size="sm" variant="secondary" onClick={() => setIsEditingPass(pass)}>Edytuj</Button>
                    </div>
                  </Card>
                ))}
                {gamePasses.length === 0 && !isEditingPass && (
                  <p className="empty-text">Brak zdefiniowanych Game Passów.</p>
                )}
              </div>
            </div>
          )}

          {activeSection === 'shop' && (
            <div className="shop-section">
              <div className="section-header">
                <h3>Przedmioty w Sklepie</h3>
                <Button onClick={() => setIsEditingItem('new')} variant="primary" size="sm">
                  + Dodaj Przedmiot
                </Button>
              </div>

              {isEditingItem && (
                <Card className="edit-form-card">
                  <form onSubmit={handleSaveItem}>
                    <h4>{isEditingItem === 'new' ? 'Nowy Przedmiot' : 'Edytuj Przedmiot'}</h4>
                    <div className="form-group">
                      <label>Nazwa</label>
                      <input name="name" defaultValue={isEditingItem !== 'new' ? isEditingItem?.name : ''} required />
                    </div>
                    <div className="form-group">
                      <label>Opis</label>
                      <textarea name="description" defaultValue={isEditingItem !== 'new' ? isEditingItem?.description : ''} />
                    </div>
                    <div className="form-group">
                      <label>Kategoria</label>
                      <select name="category" defaultValue={isEditingItem !== 'new' ? isEditingItem?.category : 'cosmetic'}>
                        <option value="cosmetic">Kosmetyczny</option>
                        <option value="consumable">Zużywalny</option>
                        <option value="permanent">Stały</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Cena (Coins)</label>
                      <input type="number" name="amount" defaultValue={isEditingItem !== 'new' ? isEditingItem?.price.amount : 50} required min="0" />
                    </div>
                    <div className="form-group">
                      <label>Limit ilości (opcjonalne)</label>
                      <input type="number" name="quantity" defaultValue={isEditingItem !== 'new' ? isEditingItem?.quantity : ''} min="0" placeholder="Bez limitu" />
                    </div>
                    <div className="form-group checkbox">
                      <label>
                        <input type="checkbox" name="available" defaultChecked={isEditingItem !== 'new' ? isEditingItem?.available : true} />
                        Dostępny w sklepie
                      </label>
                    </div>
                    <div className="form-actions">
                      <Button type="button" variant="secondary" onClick={() => setIsEditingItem(null)}>Anuluj</Button>
                      <Button type="submit" variant="primary">Zapisz</Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="items-list">
                {shopItems.map(item => (
                  <Card key={item.id} className="item-card">
                    <div className="item-header">
                      <h4>{item.name}</h4>
                      <span className={`status-badge ${item.available ? 'active' : 'inactive'}`}>
                        {item.available ? 'Dostępny' : 'Niedostępny'}
                      </span>
                    </div>
                    <p className="item-meta">{item.category} • {item.price.amount} Coins</p>
                    {item.quantity !== undefined && (
                      <p className="item-stock">Pozostało: {item.quantity}</p>
                    )}
                    <div className="item-actions">
                      <Button size="sm" variant="secondary" onClick={() => setIsEditingItem(item)}>Edytuj</Button>
                    </div>
                  </Card>
                ))}
                {shopItems.length === 0 && !isEditingItem && (
                  <p className="empty-text">Brak przedmiotów w sklepie.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

