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
    <div className="notification-bell">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            loadNotifications();
          }
        }}
        className="notification-bell__button"
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-bell__badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="user-menu__backdrop"
            onClick={() => setIsOpen(false)}
          />
          <div className="notification-bell__dropdown">
            <div className="notification-bell__header">
              <h3 className="notification-bell__title">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="notification-bell__mark-all"
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div className="notification-bell__list">
              {notifications.length === 0 ? (
                <div className="notification-bell__empty">
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
                    className={`notification-item ${!notif.read ? 'notification-item--unread' : ''} ${notif.link ? 'notification-item--clickable' : ''}`}
                  >
                    {notif.link ? (
                      <Link
                        to={notif.link}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <div className={`notification-item__title ${!notif.read ? 'notification-item__title--unread' : ''}`}>
                          {notif.title}
                        </div>
                        <div className="notification-item__message">
                          {notif.message}
                        </div>
                        <div className="notification-item__time">
                          {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString()}
                        </div>
                      </Link>
                    ) : (
                      <>
                        <div className={`notification-item__title ${!notif.read ? 'notification-item__title--unread' : ''}`}>
                          {notif.title}
                        </div>
                        <div className="notification-item__message">
                          {notif.message}
                        </div>
                        <div className="notification-item__time">
                          {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString()}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="notification-bell__footer">
              <Link
                to="/notifications"
                className="notification-bell__view-all"
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

