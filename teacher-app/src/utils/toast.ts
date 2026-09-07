/**
 * Toast notification utility for PenDrops Мугалим.
 *
 * Reuses the toast infrastructure from the student PWA where possible.
 * Provides a type-safe interface for showing notifications.
 */

type ToastType = 'ok' | 'bad' | 'info' | 'warning';

export interface ToastOptions {
  /** Duration in milliseconds before auto-dismiss (0 = manual dismiss) */
  duration?: number;
  /** Optional action button label */
  label?: string;
  /** Optional action callback */
  onClick?: () => void;
}

export class Toast {
  private container: HTMLElement;
  private activeToast: HTMLElement | null = null;

  constructor(containerId: string = 'toast') {
    const existing = document.getElementById(containerId);
    if (existing) {
      this.container = existing;
    } else {
      const el = document.createElement('div');
      el.id = containerId;
      el.className = 'toast';
      document.body.appendChild(el);
      this.container = el;
    }
  }

  show(message: string, type: ToastType = 'ok', options: ToastOptions = {}) {
    // Hide existing toast
    if (this.activeToast) {
      this.activeToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    const icon = this.getIcon(type);
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
    `;

    if (options.label) {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'toast-action';
      actionBtn.textContent = options.label;
      actionBtn.addEventListener('click', () => {
        options.onClick?.();
        this.hide(toast);
      });
      toast.appendChild(actionBtn);
    }

    this.container.appendChild(toast);
    this.activeToast = toast;

    // Auto-dismiss
    const duration = options.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        this.hide(toast);
      }, duration);
    }

    // Trigger animation
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 10);
  }

  hide(toast?: HTMLElement) {
    const el =
      toast ?? this.activeToast ?? (document.querySelector('.toast-item') as HTMLElement | null);
    if (!el) return;

    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.addEventListener('transitionend', () => el.remove(), { once: true });

    if (el === this.activeToast) {
      this.activeToast = null;
    }
  }

  private getIcon(type: ToastType): string {
    switch (type) {
      case 'ok':
        return '✅';
      case 'bad':
        return '❌';
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      default:
        return '💧';
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const toast = new Toast();
