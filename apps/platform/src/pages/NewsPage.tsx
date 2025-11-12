/**
 * News Page
 */

import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { newsApi, type NewsItem } from '../api/news';

export function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    try {
      const response = await newsApi.getNews({ limit: 50 });
      setNews(response.news);
    } catch (error) {
      console.error('Failed to load news:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="page-container">
        <h1>News</h1>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
            Loading news...
          </div>
        ) : news.length === 0 ? (
          <Card>
            <p>No news available yet. Check back later for updates!</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-4)' }}>
            {news.map((item) => (
              <Card key={item.id}>
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    style={{
                      width: '100%',
                      maxHeight: '300px',
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-2)',
                      marginBottom: 'var(--spacing-3)',
                    }}
                  />
                )}
                <h2 style={{ margin: '0 0 var(--spacing-2) 0' }}>{item.title}</h2>
                <div style={{ 
                  fontSize: 'var(--font-xs)', 
                  color: 'var(--text-2)', 
                  marginBottom: 'var(--spacing-3)' 
                }}>
                  {new Date(item.publishedAt || item.createdAt).toLocaleDateString()} • {item.authorName || item.authorId}
                </div>
                {item.excerpt && (
                  <p style={{ margin: '0 0 var(--spacing-3) 0', color: 'var(--text-1)', fontSize: 'var(--font-lg)', fontWeight: '500' }}>
                    {item.excerpt}
                  </p>
                )}
                <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {item.content}
                </p>
                {item.tags && item.tags.length > 0 && (
                  <div style={{ marginTop: 'var(--spacing-3)', display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: 'var(--surface-3)',
                          borderRadius: 'var(--radius-1)',
                          fontSize: 'var(--font-xs)',
                          color: 'var(--text-2)',
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

