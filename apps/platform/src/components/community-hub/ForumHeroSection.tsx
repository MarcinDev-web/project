import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface FeaturedContent {
  id: string;
  type: 'thread' | 'event' | 'announcement';
  title: string;
  subtitle: string;
  thumbnail?: string;
  gradientColors: [string, string];
  link: string;
  badge?: string;
  stats?: {
    views?: number;
    participants?: number;
    endDate?: string;
  };
}

interface ForumHeroSectionProps {
  onNewThread?: () => void;
}

// Mock data - replace with API call
const mockFeatured: FeaturedContent[] = [
  {
    id: '1',
    type: 'event',
    title: 'Winter Build Competition 2025',
    subtitle: 'Create stunning winter-themed worlds and win exclusive prizes!',
    gradientColors: ['#00b4ff', '#b026ff'],
    link: '/community/events/winter-build-2025',
    badge: '🎄 EVENT',
    stats: { participants: 342, endDate: 'Dec 31' },
  },
  {
    id: '2',
    type: 'announcement',
    title: 'New Scripting API Released',
    subtitle: 'Check out the powerful new scripting features in PLAYVERSE 2.5',
    gradientColors: ['#ff6b00', '#ffd700'],
    link: '/community/thread/scripting-api-2-5',
    badge: '📢 NEW',
    stats: { views: 8432 },
  },
  {
    id: '3',
    type: 'thread',
    title: 'Community Spotlight: Amazing Creations',
    subtitle: 'Featured builds from our talented community members',
    gradientColors: ['#ff00e5', '#00f0ff'],
    link: '/community/thread/community-spotlight',
    badge: '⭐ FEATURED',
    stats: { views: 12453 },
  },
];

export function ForumHeroSection({ onNewThread }: ForumHeroSectionProps) {
  const [featured, setFeatured] = useState<FeaturedContent[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Simulate API call
    setFeatured(mockFeatured);
  }, []);

  // Auto-rotate featured content
  useEffect(() => {
    if (isPaused || featured.length <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % featured.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [featured.length, isPaused]);

  const activeFeatured = featured[activeIndex];

  if (!activeFeatured) return null;

  return (
    <div 
      className="forum-hero"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background gradient effect */}
      <div 
        className="forum-hero__bg"
        style={{
          background: `linear-gradient(135deg, ${activeFeatured.gradientColors[0]}15 0%, ${activeFeatured.gradientColors[1]}15 100%)`,
        }}
      />
      
      {/* Animated particles/grid effect */}
      <div className="forum-hero__grid" />

      <div className="forum-hero__content">
        {/* Left side - Featured content */}
        <div className="forum-hero__featured">
          {activeFeatured.badge && (
            <span className="forum-hero__badge" style={{
              background: `linear-gradient(135deg, ${activeFeatured.gradientColors[0]}, ${activeFeatured.gradientColors[1]})`,
            }}>
              {activeFeatured.badge}
            </span>
          )}
          
          <h1 className="forum-hero__title">{activeFeatured.title}</h1>
          <p className="forum-hero__subtitle">{activeFeatured.subtitle}</p>
          
          {activeFeatured.stats && (
            <div className="forum-hero__stats">
              {activeFeatured.stats.views && (
                <span className="forum-hero__stat">
                  <span className="forum-hero__stat-icon">👁</span>
                  {formatNumber(activeFeatured.stats.views)} views
                </span>
              )}
              {activeFeatured.stats.participants && (
                <span className="forum-hero__stat">
                  <span className="forum-hero__stat-icon">👥</span>
                  {activeFeatured.stats.participants} participants
                </span>
              )}
              {activeFeatured.stats.endDate && (
                <span className="forum-hero__stat">
                  <span className="forum-hero__stat-icon">⏰</span>
                  Ends {activeFeatured.stats.endDate}
                </span>
              )}
            </div>
          )}

          <div className="forum-hero__actions">
            <Link 
              to={activeFeatured.link}
              className="forum-hero__btn forum-hero__btn--primary"
              style={{
                background: `linear-gradient(135deg, ${activeFeatured.gradientColors[0]}, ${activeFeatured.gradientColors[1]})`,
              }}
            >
              Learn More
              <span className="forum-hero__btn-arrow">→</span>
            </Link>
            
            {onNewThread && (
              <button 
                onClick={onNewThread}
                className="forum-hero__btn forum-hero__btn--secondary"
              >
                <span className="forum-hero__btn-icon">✏️</span>
                Create Thread
              </button>
            )}
          </div>
        </div>

        {/* Right side - Quick stats */}
        <div className="forum-hero__quick-stats">
          <div className="forum-hero__quick-stat">
            <span className="forum-hero__quick-stat-value">12.4K</span>
            <span className="forum-hero__quick-stat-label">Active Users</span>
          </div>
          <div className="forum-hero__quick-stat">
            <span className="forum-hero__quick-stat-value">45.2K</span>
            <span className="forum-hero__quick-stat-label">Discussions</span>
          </div>
          <div className="forum-hero__quick-stat">
            <span className="forum-hero__quick-stat-value">892K</span>
            <span className="forum-hero__quick-stat-label">Posts</span>
          </div>
        </div>
      </div>

      {/* Carousel indicators */}
      {featured.length > 1 && (
        <div className="forum-hero__indicators">
          {featured.map((_, index) => (
            <button
              key={index}
              className={`forum-hero__indicator ${index === activeIndex ? 'forum-hero__indicator--active' : ''}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
              style={index === activeIndex ? {
                background: `linear-gradient(135deg, ${featured[index].gradientColors[0]}, ${featured[index].gradientColors[1]})`,
              } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

