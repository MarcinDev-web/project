import { useState, useEffect } from 'react';
import { newsApi, type NewsItem } from '../../api/news';

export function NewsTab() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    try {
      const response = await newsApi.getNews({ limit: 20 });
      setNews(response.news);
    } catch (error) {
      console.error('Failed to load news:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
          Loading news...
        </div>
      ) : (
        <div style={{ padding: 'var(--spacing-4)' }}>
          {news.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
              No news available yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
              {news.map((item) => (
                <article 
                  key={item.id}
                  style={{
                    padding: 'var(--spacing-4)',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-2)',
                    border: '1px solid var(--border-1)'
                  }}
                >
                  <h3 style={{ margin: '0 0 var(--spacing-2) 0', color: 'var(--text-1)' }}>
                    {item.title}
                  </h3>
                  <div style={{ 
                    fontSize: 'var(--font-xs)', 
                    color: 'var(--text-2)', 
                    marginBottom: 'var(--spacing-3)' 
                  }}>
                    {new Date(item.publishedAt || item.createdAt).toLocaleDateString()} • {item.authorName || item.authorId}
                  </div>
                  {item.excerpt && (
                    <p style={{ margin: '0 0 var(--spacing-2) 0', color: 'var(--text-1)', fontWeight: '500' }}>
                      {item.excerpt}
                    </p>
                  )}
                  <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: '1.6' }}>
                    {item.content}
                  </p>
                  {item.tags && item.tags.length > 0 && (
                    <div style={{ marginTop: 'var(--spacing-2)', display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap' }}>
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '0.125rem 0.5rem',
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
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

