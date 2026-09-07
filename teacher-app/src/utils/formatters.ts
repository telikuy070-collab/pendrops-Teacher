/**
 * Date formatting utilities for PenDrops Мугалим.
 *
 * Uses Intl.DateTimeFormat for locale-aware formatting
 * with explicit options to avoid runtime locale differences.
 */

const ruOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

const ruShortOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

const ruTimeOptions: Intl.DateTimeFormatOptions = {
  ...ruShortOptions,
  hour: '2-digit',
  minute: '2-digit',
};

/**
 * Format a date to a long string: "1 сентября 2026"
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', ruOptions).format(d);
}

/**
 * Format a date to a short string: "01.09.2026"
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', ruShortOptions).format(d);
}

/**
 * Format a date+time to a string: "01.09.2026, 14:30"
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', ruTimeOptions).format(d);
}

/**
 * Get ISO date string (YYYY-MM-DD) from a date.
 */
export function toISODate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0] ?? '';
}
