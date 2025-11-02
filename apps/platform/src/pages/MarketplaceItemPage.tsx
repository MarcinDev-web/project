import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { Button } from '../components/shared/Button';
import { marketplaceApi, type MarketplaceItem } from '../api/marketplace';
import { apiClient } from '../api/client';

function LikeButton({ item, onToggle }: { item: MarketplaceItem; onToggle: () => void }) {
  const [liked, setLiked] = useState(item.liked ?? false);
  const [likes, setLikes] = useState(item.likes);
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    setLoading(true);
    try {
      const result = await marketplaceApi.likeItem(item.id);
      setLiked(result.liked);
      setLikes(result.likes);
      onToggle();
    } catch (error) {
      console.error('Failed to like item:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-2)',
        padding: 'var(--spacing-2) var(--spacing-4)',
        background: 'var(--bg-button)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        color: liked ? 'var(--color-error)' : 'var(--text-1)',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 'var(--text-sm)',
      }}
      title={liked ? 'Unlike' : 'Like'}
    >
      <span>{liked ? '❤️' : '🤍'}</span>
      <span>{likes}</span>
    </button>
  );
}

export function MarketplaceItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [forumThreadId, setForumThreadId] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [playingGame, setPlayingGame] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadItem();
    loadForumThread();
  }, [id]);

  const loadForumThread = async () => {
    if (!id) return;
    try {
      setLoadingThread(true);
      const response = await apiClient.get<{ threadId: string }>(`/api/marketplace/${id}/forum-thread`);
      setForumThreadId(response.threadId);
    } catch (error) {
      console.error('Failed to load forum thread:', error);
    } finally {
      setLoadingThread(false);
    }
  };

  const handleDiscussClick = () => {
    if (forumThreadId) {
      navigate(`/community/thread/${forumThreadId}`);
    }
  };

  const handlePlayBuild = async () => {
    if (!item || item.type !== 'build') {
      console.warn('Can only play builds, not avatars');
      return;
    }

    try {
      setPlayingGame(true);
      
      // Track player joining (for players online counter)
      await marketplaceApi.joinGame(item.id);
      
      // Navigate to player page with build ID
      navigate(`/player/${item.id}`);
    } catch (error) {
      console.error('Failed to join game:', error);
      setPlayingGame(false);
      // TODO: Show error toast
    }
  };

  const loadItem = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await marketplaceApi.getItem(id);
      setItem(data);
    } catch (error) {
      console.error('Failed to load item:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="page-container">Loading...</div>
      </Layout>
    );
  }

  if (!item) {
    return (
      <Layout>
        <div className="page-container">
          <h1>Item not found</h1>
          <Link to="/marketplace">
            <Button variant="secondary">Back to Marketplace</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container">
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--text-2)', fontSize: 'var(--text-sm)' }}>
          ← Back to Home
        </Link>
        
        <Card style={{ marginTop: 'var(--spacing-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-6)', marginBottom: 'var(--spacing-6)' }}>
            <div>
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl.startsWith('http') || item.thumbnailUrl.startsWith('/api') ? item.thumbnailUrl : `/api${item.thumbnailUrl}`}
                  alt={item.title}
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-lg)',
                    aspectRatio: '16/9',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = '<div style="width: 100%; aspect-ratio: 16/9; background: var(--color-base-200); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; font-size: 5rem;">🎮</div>';
                    }
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  background: 'var(--color-base-200)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '5rem',
                }}>
                  🎮
                </div>
              )}
            </div>
            <div>
              <h1 style={{ marginTop: 0, marginBottom: 'var(--spacing-4)' }}>{item.title}</h1>
              {item.description && (
                <p style={{ color: 'var(--text-2)', marginBottom: 'var(--spacing-4)' }}>
                  {item.description}
                </p>
              )}
              <div style={{ marginBottom: 'var(--spacing-4)' }}>
                <p style={{ margin: 0, color: 'var(--text-2)' }}>
                  <strong>Author:</strong> {item.authorName || 'Unknown'}
                </p>
                <p style={{ margin: 0, color: 'var(--text-2)' }}>
                  <strong>Published:</strong> {new Date(item.createdAt).toLocaleDateString()}
                </p>
                <p style={{ margin: 0, color: 'var(--text-2)' }}>
                  <strong>Downloads:</strong> {item.downloads}
                </p>
                {(item.playersOnline ?? 0) > 0 && (
                  <p style={{ margin: 0, color: 'var(--color-success)', fontWeight: 'var(--font-medium)' }}>
                    🟢 <strong>{item.playersOnline}</strong> players online
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                {item.type === 'build' && (
                  <Button 
                    variant="primary" 
                    onClick={handlePlayBuild}
                    disabled={playingGame}
                  >
                    {playingGame ? 'Loading...' : 'Play Game'}
                  </Button>
                )}
                <Button variant="secondary">Download</Button>
                {forumThreadId && (
                  <Button 
                    variant="secondary" 
                    onClick={handleDiscussClick}
                    disabled={loadingThread}
                  >
                    💬 {loadingThread ? 'Loading...' : 'Discuss'}
                  </Button>
                )}
                <LikeButton 
                  item={item} 
                  onToggle={() => {
                    // Reload item to get updated like count
                    void loadItem();
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

