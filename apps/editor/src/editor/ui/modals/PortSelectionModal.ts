/**
 * PortSelectionModal - Modal dialog for selecting a logic port when multiple ports are available.
 */

import type { LogicPort } from '@engine/script';
import { createIcon } from '../../utils/icons';

export interface PortSelectionModalOptions {
  /** Title of the modal */
  title?: string;
  /** Message to display */
  message?: string;
  /** Available ports to choose from */
  ports: LogicPort[];
  /** Entity name for context */
  entityName?: string;
}

/**
 * Shows a modal dialog for selecting a logic port.
 * Returns a promise that resolves to the selected port, or null if cancelled.
 */
export async function showPortSelectionModal(
  options: PortSelectionModalOptions
): Promise<LogicPort | null> {
  const {
    title = 'Select Port',
    message = 'Select an output port:',
    ports,
    entityName,
  } = options;

  if (ports.length === 0) {
    return null;
  }

  // If only one port, return it immediately
  if (ports.length === 1) {
    return ports[0] || null;
  }

  return new Promise<LogicPort | null>((resolve) => {
    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'notification-modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(null);
      }
    });

    // Modal
    const modal = document.createElement('div');
    modal.className = 'notification-modal port-selection-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'port-modal-title');

    // Header
    const header = document.createElement('div');
    header.className = 'notification-modal-header';

    const titleEl = document.createElement('h3');
    titleEl.id = 'port-modal-title';
    titleEl.className = 'notification-modal-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'notification-modal-close';
    closeBtn.setAttribute('aria-label', 'Close dialog');
    closeBtn.appendChild(createIcon('close', 20));
    closeBtn.addEventListener('click', () => closeModal(null));
    header.appendChild(closeBtn);

    modal.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.className = 'notification-modal-content';

    // Message
    if (message) {
      const messageEl = document.createElement('p');
      messageEl.className = 'notification-modal-message';
      messageEl.textContent = message;
      content.appendChild(messageEl);
    }

    // Entity name context
    if (entityName) {
      const entityEl = document.createElement('p');
      entityEl.className = 'port-selection-entity-name';
      entityEl.textContent = `Entity: ${entityName}`;
      content.appendChild(entityEl);
    }

    // Port list
    const portList = document.createElement('div');
    portList.className = 'port-selection-list';

    for (const port of ports) {
      const portItem = document.createElement('button');
      portItem.type = 'button';
      portItem.className = 'port-selection-item';
      portItem.setAttribute('data-port-id', port.id);

      // Port icon based on type
      const iconName = getPortIcon(port.type);
      const icon = createIcon(iconName as any, 20, 'port-selection-icon');
      portItem.appendChild(icon);

      // Port info
      const portInfo = document.createElement('div');
      portInfo.className = 'port-selection-info';

      const portLabel = document.createElement('div');
      portLabel.className = 'port-selection-label';
      portLabel.textContent = port.label || port.id;
      portInfo.appendChild(portLabel);

      if (port.description) {
        const portDesc = document.createElement('div');
        portDesc.className = 'port-selection-description';
        portDesc.textContent = port.description;
        portInfo.appendChild(portDesc);
      }

      const portType = document.createElement('div');
      portType.className = 'port-selection-type';
      portType.textContent = `${port.type}${port.dataType ? ` (${port.dataType})` : ''}`;
      portInfo.appendChild(portType);

      portItem.appendChild(portInfo);

      // Click handler
      portItem.addEventListener('click', () => {
        closeModal(port);
      });

      // Keyboard navigation
      portItem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          closeModal(port);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeModal(null);
        }
      });

      portList.appendChild(portItem);
    }

    content.appendChild(portList);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'notification-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => closeModal(null));
    actions.appendChild(cancelBtn);

    content.appendChild(actions);

    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('notification-modal-visible');
    });

    // Focus first port item
    setTimeout(() => {
      const firstItem = portList.querySelector('.port-selection-item') as HTMLElement;
      if (firstItem) {
        firstItem.focus();
      }
    }, 100);

    // Close on Escape
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal(null);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Store handler for cleanup
    (overlay as any)._escapeHandler = escapeHandler;

    function closeModal(selectedPort: LogicPort | null): void {
      overlay.classList.remove('notification-modal-visible');

      // Cleanup escape handler
      const handler = (overlay as any)._escapeHandler;
      if (handler) {
        document.removeEventListener('keydown', handler);
      }

      setTimeout(() => {
        overlay.remove();
        resolve(selectedPort);
      }, 300);
    }
  });
}

/**
 * Gets icon name for a port type
 */
function getPortIcon(type: string): string {
  switch (type) {
    case 'trigger':
      return 'link'; // Represents connection/trigger
    case 'data':
      return 'box'; // Represents data storage
    case 'condition':
      return 'check'; // Represents condition/check
    default:
      return 'circle';
  }
}

