import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { Button } from '../components/shared/Button';
import { notificationsApi, type Notification } from '../api/notifications';
import { useWebSocket, type WebSocketMessage } from '../hooks/useWebSocket';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Handle WebSocket notifications
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    if (message.type === 'notification:new') {
      loadNotifications();
    }
  };

  useWebSocket(handleWebSocketMessage, true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationsApi.getNotifications(100);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationsApi.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="page-container">Loading...</div>
      </Layout>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Layout>
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
          <h1 style={{ margin: 0 }}>Notifications</h1>
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card>
            <p style={{ color: 'var(--text-2)', textAlign: 'center', padding: 'var(--spacing-8)' }}>
              No notifications
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            {notifications.map(notif => (
              <Card
                key={notif.id}
                style={{
                  background: notif.read ? 'transparent' : 'var(--bg-button)',
                  opacity: notif.read ? 0.8 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    {notif.link ? (
                      <Link
                        to={notif.link}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                        onClick={() => !notif.read && handleMarkAsRead(notif.id)}
                      >
                        <h3 style={{ margin: 0, marginBottom: 'var(--spacing-2)', fontSize: 'var(--text-base)', fontWeight: notif.read ? 'normal' : 'bold' }}>
                          {notif.title}
                        </h3>
                        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 'var(--text-sm)' }}>
                          {notif.message}
                        </p>
                        <p style={{ margin: 'var(--spacing-2) 0 0 0', color: 'var(--text-3)', fontSize: 'var(--text-xs)' }}>
                          {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString()}
                        </p>
                      </Link>
                    ) : (
                      <>
                        <h3 style={{ margin: 0, marginBottom: 'var(--spacing-2)', fontSize: 'var(--text-base)', fontWeight: notif.read ? 'normal' : 'bold' }}>
                          {notif.title}
                        </h3>
                        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 'var(--text-sm)' }}>
                          {notif.message}
                        </p>
                        <p style={{ margin: 'var(--spacing-2) 0 0 0', color: 'var(--text-3)', fontSize: 'var(--text-xs)' }}>
                          {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString()}
                        </p>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginLeft: 'var(--spacing-4)' }}>
                    {!notif.read && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)',
                          padding: 'var(--spacing-1) var(--spacing-2)',
                          color: 'var(--text-2)',
                          cursor: 'pointer',
                          fontSize: 'var(--text-xs)',
                        }}
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notif.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-3)',
                        cursor: 'pointer',
                        fontSize: 'var(--text-lg)',
                        padding: 0,
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

