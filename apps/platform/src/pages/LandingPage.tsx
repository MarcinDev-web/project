/**
 * LandingPage - Modern landing page for new visitors
 * 
 * Features:
 * - Hero section with CTA
 * - Features showcase
 * - Live stats
 * - Screenshots/demos
 * - Social proof
 * - Footer with links
 */

import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi } from '../api/marketplace';

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState({
    totalGames: 0,
    totalPlayers: 0,
    totalCreators: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await marketplaceApi.getBuilds({ limit: 100 });
      const games = response.items;
      const totalPlayers = games.reduce((sum, game) => sum + (game.downloads || 0), 0);
      const creators = new Set(games.map(g => g.authorId)).size;
      
      setStats({
        totalGames: games.length,
        totalPlayers,
        totalCreators: creators,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const features = [
    {
      icon: '🎨',
      title: 'Visual Editor',
      description: 'Intuitive drag-and-drop 3D scene editor powered by WebGPU',
    },
    {
      icon: '🎮',
      title: 'Play Instantly',
      description: 'Test your creations in real-time without leaving the editor',
    },
    {
      icon: '🤝',
      title: 'Collaboration',
      description: 'Work together with your team in real-time',
    },
    {
      icon: '🛒',
      title: 'Marketplace',
      description: 'Share and monetize your creations with the community',
    },
    {
      icon: '⚡',
      title: 'High Performance',
      description: 'Built with cutting-edge WebGPU technology',
    },
    {
      icon: '🌐',
      title: 'Cross-Platform',
      description: 'Works everywhere - browser-based, no installation needed',
    },
  ];

  const showcaseGames = [
    {
      title: 'Adventure Quest',
      thumbnail: '🏰',
      author: 'GameDev123',
      plays: '1.2K',
    },
    {
      title: 'Racing Challenge',
      thumbnail: '🏎️',
      author: 'SpeedMaster',
      plays: '856',
    },
    {
      title: 'Puzzle World',
      thumbnail: '🧩',
      author: 'BrainTeaser',
      plays: '2.4K',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      {/* Navigation */}
      <nav style={{
        padding: 'var(--spacing-4) var(--spacing-6)',
        background: 'rgba(15, 20, 30, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
              textDecoration: 'none',
              color: 'var(--text-1)',
            }}
          >
            <span style={{ fontSize: '2rem' }}>⚡</span>
            <span style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              FORGE
            </span>
          </Link>

          <div style={{ display: 'flex', gap: 'var(--spacing-4)', alignItems: 'center' }}>
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  style={{
                    padding: 'var(--spacing-2) var(--spacing-6)',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-semibold)',
                    transition: 'transform 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Go to Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{
                    padding: 'var(--spacing-2) var(--spacing-4)',
                    color: 'var(--text-2)',
                    textDecoration: 'none',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-medium)',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-2)';
                  }}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  style={{
                    padding: 'var(--spacing-3) var(--spacing-6)',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-semibold)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-2)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span>🚀</span>
                  <span>Get Started Free</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        padding: 'var(--spacing-24) var(--spacing-6)',
        background: 'linear-gradient(180deg, rgba(102, 126, 234, 0.1) 0%, transparent 100%)',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
            fontWeight: 'var(--font-bold)',
            marginBottom: 'var(--spacing-6)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.1,
          }}>
            Create 3D Worlds<br/>Without Limits
          </h1>
          <p style={{
            fontSize: 'var(--text-xl)',
            color: 'var(--text-2)',
            marginBottom: 'var(--spacing-10)',
            maxWidth: '700px',
            margin: '0 auto var(--spacing-10)',
            lineHeight: 1.6,
          }}>
            Professional 3D scene editor powered by WebGPU. Build, play, and share your creations with millions of players.
          </p>

          <div style={{
            display: 'flex',
            gap: 'var(--spacing-4)',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: 'var(--spacing-16)',
          }}>
            <Link
              to={isAuthenticated ? "/editor" : "/register"}
              style={{
                padding: 'var(--spacing-4) var(--spacing-10)',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 'var(--radius-xl)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-bold)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-3)',
                transition: 'all 0.3s ease',
                boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 15px 40px rgba(102, 126, 234, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.3)';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🎨</span>
              <span>Start Creating</span>
            </Link>
            <a
              href="#features"
              style={{
                padding: 'var(--spacing-4) var(--spacing-10)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-1)',
                textDecoration: 'none',
                borderRadius: 'var(--radius-xl)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-bold)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-3)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>▶️</span>
              <span>Watch Demo</span>
            </a>
          </div>

          {/* Live Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-6)',
            maxWidth: '800px',
            margin: '0 auto',
          }}>
            {[
              { label: 'Games Created', value: stats.totalGames.toLocaleString(), icon: '🎮' },
              { label: 'Total Players', value: stats.totalPlayers.toLocaleString(), icon: '👥' },
              { label: 'Creators', value: stats.totalCreators.toLocaleString(), icon: '🎨' },
            ].map((stat) => (
              <div key={stat.label} style={{
                padding: 'var(--spacing-6)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-xl)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-2)' }}>
                  {stat.icon}
                </div>
                <div style={{
                  fontSize: 'var(--text-3xl)',
                  fontWeight: 'var(--font-bold)',
                  color: 'var(--text-1)',
                  marginBottom: 'var(--spacing-1)',
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{
        padding: 'var(--spacing-20) var(--spacing-6)',
        background: 'var(--bg-panel)',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-16)' }}>
            <h2 style={{
              fontSize: 'var(--text-4xl)',
              fontWeight: 'var(--font-bold)',
              marginBottom: 'var(--spacing-4)',
              color: 'var(--text-1)',
            }}>
              Everything You Need to Create
            </h2>
            <p style={{
              fontSize: 'var(--text-lg)',
              color: 'var(--text-2)',
              maxWidth: '600px',
              margin: '0 auto',
            }}>
              Powerful tools and features designed for creators of all skill levels
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--spacing-8)',
          }}>
            {features.map((feature) => (
              <div key={feature.title} style={{
                padding: 'var(--spacing-8)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-xl)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
              >
                <div style={{
                  fontSize: '3rem',
                  marginBottom: 'var(--spacing-4)',
                }}>
                  {feature.icon}
                </div>
                <h3 style={{
                  fontSize: 'var(--text-xl)',
                  fontWeight: 'var(--font-semibold)',
                  marginBottom: 'var(--spacing-2)',
                  color: 'var(--text-1)',
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--text-2)',
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section style={{
        padding: 'var(--spacing-20) var(--spacing-6)',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-16)' }}>
            <h2 style={{
              fontSize: 'var(--text-4xl)',
              fontWeight: 'var(--font-bold)',
              marginBottom: 'var(--spacing-4)',
              color: 'var(--text-1)',
            }}>
              Featured Creations
            </h2>
            <p style={{
              fontSize: 'var(--text-lg)',
              color: 'var(--text-2)',
            }}>
              See what the community is building
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--spacing-6)',
            marginBottom: 'var(--spacing-10)',
          }}>
            {showcaseGames.map((game) => (
              <div key={game.title} style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >
                <div style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '5rem',
                }}>
                  {game.thumbnail}
                </div>
                <div style={{ padding: 'var(--spacing-6)' }}>
                  <h3 style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-semibold)',
                    marginBottom: 'var(--spacing-2)',
                    color: 'var(--text-1)',
                  }}>
                    {game.title}
                  </h3>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-3)',
                  }}>
                    <span>by {game.author}</span>
                    <span>▶️ {game.plays} plays</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center' }}>
            <Link
              to="/marketplace"
              style={{
                padding: 'var(--spacing-3) var(--spacing-8)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-1)',
                textDecoration: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-semibold)',
                display: 'inline-block',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              Browse All Games →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: 'var(--spacing-20) var(--spacing-6)',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: 'var(--text-4xl)',
            fontWeight: 'var(--font-bold)',
            marginBottom: 'var(--spacing-4)',
            color: 'var(--text-1)',
          }}>
            Ready to Start Creating?
          </h2>
          <p style={{
            fontSize: 'var(--text-xl)',
            color: 'var(--text-2)',
            marginBottom: 'var(--spacing-10)',
            lineHeight: 1.6,
          }}>
            Join thousands of creators building amazing 3D experiences. No credit card required.
          </p>
          <Link
            to="/register"
            style={{
              padding: 'var(--spacing-4) var(--spacing-10)',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 'var(--radius-xl)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-bold)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-3)',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(102, 126, 234, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.3)';
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>🚀</span>
            <span>Get Started Free</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: 'var(--spacing-10) var(--spacing-6)',
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border-default)',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            marginBottom: 'var(--spacing-6)',
          }}>
            <span style={{ fontSize: '2rem' }}>⚡</span>
            <span style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {' '}FORGE
            </span>
          </div>
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-6)',
            justifyContent: 'center',
            marginBottom: 'var(--spacing-6)',
            flexWrap: 'wrap',
          }}>
            <Link to="/marketplace" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>
              Marketplace
            </Link>
            <Link to="/community" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>
              Community
            </Link>
            <Link to="/shop" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>
              Shop
            </Link>
            <Link to="/docs" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>
              Documentation
            </Link>
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-3)',
          }}>
            © 2025 FORGE Platform. Built with WebGPU and ❤️
          </div>
        </div>
      </footer>
    </div>
  );
}

