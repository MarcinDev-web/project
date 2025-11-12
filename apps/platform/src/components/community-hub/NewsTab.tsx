import { useState, useEffect } from 'react';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
}

export function NewsTab() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call to fetch news
      // const data = await newsApi.getNews();
      // setNews(data);
      
      // Temporary mock data
      setNews([
        {
          id: '1',
          title: 'Welcome to the News Section',
          content: 'Stay updated with the latest announcements and updates from the community.',
          date: new Date().toISOString(),
          author: 'System'
        }
      ]);
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
                    {new Date(item.date).toLocaleDateString()} • {item.author}
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: '1.6' }}>
                    {item.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

