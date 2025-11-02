import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi, type Notification } from '../../api/notifications';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Load initial count
  useEffect(() => {
    loadUnreadCount();
    loadNotifications();
  }, []);

  // Handle WebSocket notifications
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    if (message.type === 'notification:new') {
      setUnreadCount(prev => prev + 1);
      loadNotifications();
    }
  };

  useWebSocket(handleWebSocketMessage, true);

  const loadUnreadCount = async () => {
    try {
      const count = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const data = await notificationsApi.getNotifications(10);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      setUnreadCount(prev => Math.max(0, prev - 1));
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
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            loadNotifications();
          }
        }}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-2)',
          cursor: 'pointer',
          fontSize: 'var(--text-lg)',
          padding: 'var(--spacing-2)',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'var(--bg-button-primary)',
            color: 'white',
            borderRadius: '50%',
            minWidth: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--text-xs)',
            fontWeight: 'bold',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998,
            }}
            onClick={() => setIsOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + var(--spacing-2))',
            right: 0,
            width: '350px',
            maxHeight: '500px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: 'var(--spacing-4)',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div style={{
              overflowY: 'auto',
              flex: 1,
            }}>
              {notifications.length === 0 ? (
                <div style={{
                  padding: 'var(--spacing-8)',
                  textAlign: 'center',
                  color: 'var(--text-2)',
                }}>
                  No notifications
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (notif.link) {
                        setIsOpen(false);
                      }
                      if (!notif.read) {
                        handleMarkAsRead(notif.id);
                      }
                    }}
                    style={{
                      padding: 'var(--spacing-4)',
                      borderBottom: '1px solid var(--border-default)',
                      background: notif.read ? 'transparent' : 'var(--bg-button)',
                      cursor: notif.link ? 'pointer' : 'default',
                    }}
                  >
                    {notif.link ? (
                      <Link
                        to={notif.link}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <div style={{ fontWeight: notif.read ? 'normal' : 'bold', fontSize: 'var(--text-sm)' }}>
                          {notif.title}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 'var(--spacing-1)' }}>
                          {notif.message}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 'var(--spacing-1)' }}>
                          {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString()}
                        </div>
                      </Link>
                    ) : (
                      <>
                        <div style={{ fontWeight: notif.read ? 'normal' : 'bold', fontSize: 'var(--text-sm)' }}>
                          {notif.title}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 'var(--spacing-1)' }}>
                          {notif.message}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 'var(--spacing-1)' }}>
                          {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString()}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            <div style={{
              padding: 'var(--spacing-3)',
              borderTop: '1px solid var(--border-default)',
              textAlign: 'center',
            }}>
              <Link
                to="/notifications"
                style={{
                  color: 'var(--text-2)',
                  textDecoration: 'none',
                  fontSize: 'var(--text-sm)',
                }}
                onClick={() => setIsOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

