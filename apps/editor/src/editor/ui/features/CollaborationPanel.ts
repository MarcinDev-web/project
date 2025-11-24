import type { ReplicationClient, PublicUser } from '@engine/net';
import type { ReplicationState } from '@engine/net';
import { DisposableGroup } from '@engine/core/utils';

/**
 * Configuration for CollaborationPanel.
 */
export interface CollaborationPanelConfig {
  /** Replication client for network communication. */
  replicationClient: ReplicationClient;
  /** Callback when collaboration session starts. */
  onStartSession?: (sessionId: string) => void;
  /** Callback when collaboration session stops. */
  onStopSession?: () => void;
  /** Optional: Follow a user's camera */
  onFollowUser?: (userId: string) => void;
  /** Optional: Stop following */
  onStopFollow?: () => void;
  /** Optional: Toggle presenter mode for local user */
  onTogglePresenter?: (active: boolean) => void;
}

/**
 * Collaboration panel UI component.
 * Displays:
 * - Start/Stop Collaboration button
 * - List of active users
 * - Connection status
 */
export class CollaborationPanel {
  private readonly disposables = new DisposableGroup();
  private root: HTMLElement | null = null;
  private startButton: HTMLButtonElement | null = null;
  private stopButton: HTMLButtonElement | null = null;
  private usersList: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private users = new Map<string, PublicUser>();
  private isCollaborating = false;
  private followingUserId: string | null = null;
  private stopFollowButton: HTMLButtonElement | null = null;
  private presenterToggleButton: HTMLButtonElement | null = null;
  private presenterInfoEl: HTMLElement | null = null;
  private presenterUserId: string | null = null;

  constructor(private readonly config: CollaborationPanelConfig) {
    // Subscribe to user events
    this.config.replicationClient.onUserJoined((user) => {
      this.handleUserJoined(user);
    });

    this.config.replicationClient.onUserLeft((userId) => {
      this.handleUserLeft(userId);
    });

    this.config.replicationClient.onStateChange((state) => {
      this.handleStateChange(state);
    });

    this.disposables.add(() => {
      this.config.replicationClient.onUserJoined(() => {});
      this.config.replicationClient.onUserLeft(() => {});
      this.config.replicationClient.onStateChange(() => {});
    });
  }

  /**
   * Mount panel to container.
   */
  mount(container: HTMLElement): void {
    if (this.root) {
      return;
    }

    const panel = document.createElement('div');
    panel.className = 'collaboration-panel';
    panel.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: rgba(20, 20, 20, 0.95);
      border: 1px solid #444;
      border-radius: 8px;
      padding: 16px;
      min-width: 280px;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #fff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Collaboration';
    title.style.cssText = `
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #444;
    `;
    panel.appendChild(title);

    // Status
    this.statusEl = document.createElement('div');
    this.statusEl.textContent = 'Not connected';
    this.statusEl.style.cssText = `
      margin-bottom: 12px;
      padding: 8px;
      background: rgba(100, 100, 100, 0.2);
      border-radius: 4px;
      font-size: 12px;
      color: #aaa;
    `;
    panel.appendChild(this.statusEl);

    // Presenter info
    this.presenterInfoEl = document.createElement('div');
    this.presenterInfoEl.textContent = 'Presenter: none';
    this.presenterInfoEl.style.cssText = `
      margin-bottom: 12px;
      padding: 6px 8px;
      background: rgba(120, 120, 120, 0.15);
      border-radius: 4px;
      font-size: 12px;
      color: #ccc;
    `;
    panel.appendChild(this.presenterInfoEl);

    // Start button
    this.startButton = document.createElement('button');
    this.startButton.textContent = 'Start Collaboration';
    this.startButton.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #4a9eff;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 12px;
      transition: background 0.2s;
    `;
    this.startButton.addEventListener('mouseenter', () => {
      if (this.startButton) {
        this.startButton.style.background = '#3a8eef';
      }
    });
    this.startButton.addEventListener('mouseleave', () => {
      if (this.startButton && !this.isCollaborating) {
        this.startButton.style.background = '#4a9eff';
      }
    });
    this.startButton.addEventListener('click', () => {
      this.handleStartCollaboration();
    });
    panel.appendChild(this.startButton);

    // Invite button (hidden by default)
    const inviteButton = document.createElement('button');
    inviteButton.id = 'collab-invite-btn';
    inviteButton.textContent = 'Copy Invite Link';
    inviteButton.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #34d399;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 12px;
      display: none;
      transition: background 0.2s;
    `;
    inviteButton.addEventListener('mouseenter', () => {
      inviteButton.style.background = '#10b981';
    });
    inviteButton.addEventListener('mouseleave', () => {
      inviteButton.style.background = '#34d399';
    });
    inviteButton.addEventListener('click', () => {
      this.handleCopyInviteLink(inviteButton);
    });
    panel.appendChild(inviteButton);

    // Stop button
    this.stopButton = document.createElement('button');
    this.stopButton.textContent = 'Stop Collaboration';
    this.stopButton.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #ff4444;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 12px;
      display: none;
      transition: background 0.2s;
    `;
    this.stopButton.addEventListener('mouseenter', () => {
      if (this.stopButton) {
        this.stopButton.style.background = '#ee3333';
      }
    });
    this.stopButton.addEventListener('mouseleave', () => {
      if (this.stopButton) {
        this.stopButton.style.background = '#ff4444';
      }
    });
    this.stopButton.addEventListener('click', () => {
      this.handleStopCollaboration();
    });
    panel.appendChild(this.stopButton);

    // Users list
    const usersTitle = document.createElement('div');
    usersTitle.textContent = 'Active Users';
    usersTitle.style.cssText = `
      font-weight: 500;
      margin-top: 12px;
      margin-bottom: 8px;
      font-size: 12px;
      color: #aaa;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    panel.appendChild(usersTitle);

    this.usersList = document.createElement('div');
    this.usersList.style.cssText = `
      max-height: 200px;
      overflow-y: auto;
    `;
    panel.appendChild(this.usersList);

    // Stop follow button (shown only when following)
    this.stopFollowButton = document.createElement('button');
    this.stopFollowButton.textContent = 'Stop Following';
    this.stopFollowButton.style.cssText = `
      width: 100%;
      padding: 8px;
      background: #666;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      margin-top: 8px;
      display: none;
    `;
    this.stopFollowButton.addEventListener('click', () => {
      this.setFollowing(null);
      this.config.onStopFollow?.();
    });
    panel.appendChild(this.stopFollowButton);

    // Presenter toggle button
    this.presenterToggleButton = document.createElement('button');
    this.presenterToggleButton.textContent = 'Enable Presenter Mode';
    this.presenterToggleButton.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #8a5ef1;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      margin-top: 4px;
      transition: background 0.2s;
    `;
    this.presenterToggleButton.addEventListener('mouseenter', () => {
      if (this.presenterToggleButton) {
        this.presenterToggleButton.style.background = '#784ae8';
      }
    });
    this.presenterToggleButton.addEventListener('mouseleave', () => {
      if (this.presenterToggleButton) {
        this.presenterToggleButton.style.background = '#8a5ef1';
      }
    });
    this.presenterToggleButton.addEventListener('click', () => {
      const localId = this.config.replicationClient.getLocalUserId?.() ?? null;
      const isLocalPresenter = localId && this.presenterUserId === localId;
      const next = !isLocalPresenter;
      this.config.onTogglePresenter?.(next);
      // Optimistic UI update; authoritative update comes from network
      if (next && localId) {
        this.setPresenter(localId);
      } else if (!next && localId && this.presenterUserId === localId) {
        this.setPresenter(null);
      }
    });
    panel.appendChild(this.presenterToggleButton);

    container.appendChild(panel);
    this.root = panel;
  }

  /**
   * Unmount panel.
   */
  unmount(): void {
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this.startButton = null;
    this.stopButton = null;
    this.usersList = null;
    this.statusEl = null;
  }

  /**
   * Handle start collaboration.
   */
  private async handleStartCollaboration(): Promise<void> {
    try {
      // Generate session ID (in a real app, this would come from server)
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Connect to session
      await this.config.replicationClient.connect(sessionId);
      
      this.isCollaborating = true;
      
      // Update UI
      if (this.startButton) {
        this.startButton.style.display = 'none';
      }
      const inviteButton = this.root?.querySelector('#collab-invite-btn') as HTMLElement;
      if (inviteButton) {
        inviteButton.style.display = 'block';
        inviteButton.dataset.sessionId = sessionId;
      }
      if (this.stopButton) {
        this.stopButton.style.display = 'block';
      }
      if (this.statusEl) {
        this.statusEl.textContent = 'Connected';
        this.statusEl.style.color = '#4a9eff';
      }

      // Notify callback
      if (this.config.onStartSession) {
        this.config.onStartSession(sessionId);
      }
    } catch (error) {
      console.error('Failed to start collaboration:', error);
      if (this.statusEl) {
        this.statusEl.textContent = 'Connection failed';
        this.statusEl.style.color = '#ff4444';
      }
    }
  }

  /**
   * Handle stop collaboration.
   */
  private handleStopCollaboration(): void {
    this.config.replicationClient.disconnect();
    this.isCollaborating = false;
    this.users.clear();

    // Update UI
    if (this.startButton) {
      this.startButton.style.display = 'block';
    }
    const inviteButton = this.root?.querySelector('#collab-invite-btn') as HTMLElement;
    if (inviteButton) {
      inviteButton.style.display = 'none';
    }
    if (this.stopButton) {
      this.stopButton.style.display = 'none';
    }
    if (this.statusEl) {
      this.statusEl.textContent = 'Not connected';
      this.statusEl.style.color = '#aaa';
    }

    this.updateUsersList();

    // Notify callback
    if (this.config.onStopSession) {
      this.config.onStopSession();
    }
  }

  private handleCopyInviteLink(button: HTMLButtonElement): void {
    const sessionId = button.dataset.sessionId;
    if (!sessionId) return;

    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    
    navigator.clipboard.writeText(url.toString()).then(() => {
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      button.style.background = '#10b981';
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '#34d399';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy invite link:', err);
    });
  }

  /**
   * Handle user joined.
   */
  private handleUserJoined(user: PublicUser): void {
    this.users.set(user.id, user);
    this.updateUsersList();
  }

  /**
   * Handle user left.
   */
  private handleUserLeft(userId: string): void {
    this.users.delete(userId);
    this.updateUsersList();
  }

  /**
   * Handle state change.
   */
  private handleStateChange(state: ReplicationState): void {
    if (this.statusEl) {
      switch (state) {
        case 'disconnected':
          this.statusEl.textContent = 'Not connected';
          this.statusEl.style.color = '#aaa';
          break;
        case 'connecting':
          this.statusEl.textContent = 'Connecting...';
          this.statusEl.style.color = '#ffaa00';
          break;
        case 'connected':
          this.statusEl.textContent = 'Connected';
          this.statusEl.style.color = '#4a9eff';
          break;
        case 'joined':
          this.statusEl.textContent = 'Joined session';
          this.statusEl.style.color = '#4a9eff';
          break;
        case 'error':
          this.statusEl.textContent = 'Connection error';
          this.statusEl.style.color = '#ff4444';
          break;
      }
    }
  }

  /**
   * Update users list UI.
   */
  private updateUsersList(): void {
    if (!this.usersList) return;

    this.usersList.innerHTML = '';

    if (this.users.size === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No other users';
      empty.style.cssText = `
        padding: 8px;
        color: #666;
        font-size: 12px;
        font-style: italic;
      `;
      this.usersList.appendChild(empty);
      return;
    }

    for (const [, user] of this.users.entries()) {
      const userItem = document.createElement('div');
      userItem.style.cssText = `
        padding: 8px;
        margin-bottom: 4px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: space-between;
      `;

      // User avatar/indicator
      const avatar = document.createElement('div');
      avatar.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #4a9eff;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: 600;
      `;
      avatar.textContent = user.email.charAt(0).toUpperCase();
      userItem.appendChild(avatar);

      // User info
      const info = document.createElement('div');
      info.style.cssText = `
        flex: 1;
        overflow: hidden;
      `;
      const name = document.createElement('div');
      name.textContent = user.email;
      name.style.cssText = `
        font-size: 13px;
        color: #fff;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      info.appendChild(name);
      userItem.appendChild(info);

      // Actions
      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '6px';
      const followBtn = document.createElement('button');
      followBtn.textContent = this.followingUserId === user.id ? 'Following' : 'Follow';
      followBtn.disabled = this.followingUserId === user.id;
      followBtn.style.cssText = `
        padding: 6px 10px;
        background: #4a9eff;
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      `;
      const localId = this.config.replicationClient.getLocalUserId?.() ?? null;
      if (localId && user.id === localId) {
        followBtn.style.display = 'none';
      } else {
        followBtn.addEventListener('click', () => {
          this.setFollowing(user.id);
          this.config.onFollowUser?.(user.id);
        });
      }
      actions.appendChild(followBtn);

      // Presenter badge
      if (this.presenterUserId && user.id === this.presenterUserId) {
        const badge = document.createElement('span');
        badge.textContent = 'Presenter';
        badge.style.cssText = `
          padding: 4px 6px;
          background: #8a5ef1;
          color: #fff;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        `;
        actions.appendChild(badge);
      }
      userItem.appendChild(actions);

      this.usersList.appendChild(userItem);
    }
  }

  /**
   * Get root element (for visibility control).
   */
  getRoot(): HTMLElement | null {
    return this.root;
  }

  /**
   * Dispose panel.
   */
  dispose(): void {
    this.disposables.dispose();
    this.unmount();
  }

  /** Update following state (controls buttons visibility/labels) */
  setFollowing(userId: string | null): void {
    this.followingUserId = userId;
    if (this.stopFollowButton) {
      this.stopFollowButton.style.display = this.followingUserId ? 'block' : 'none';
    }
    this.updateUsersList();
  }

  /** Update current presenter and UI */
  setPresenter(userId: string | null): void {
    this.presenterUserId = userId;
    const localId = this.config.replicationClient.getLocalUserId?.() ?? null;
    const text = userId
      ? (userId === localId ? 'Presenter: you' : `Presenter: ${this.users.get(userId)?.email ?? userId}`)
      : 'Presenter: none';
    if (this.presenterInfoEl) {
      this.presenterInfoEl.textContent = text;
    }
    if (this.presenterToggleButton) {
      const isLocalPresenter = !!localId && userId === localId;
      this.presenterToggleButton.textContent = isLocalPresenter ? 'Disable Presenter Mode' : 'Enable Presenter Mode';
    }
    // If presenter exists and is not local, reflect following state
    if (userId && localId && userId !== localId) {
      this.setFollowing(userId);
    } else if (!userId) {
      this.setFollowing(null);
    }
    this.updateUsersList();
  }
}

