export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

export function formatName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

export function validateName(name: string): string | null {
  if (!name || name.trim().length < 2) return 'Слишком короткое';
  if (name.trim().length > 50) return 'Слишком длинное';
  if (!/^[а-яa-z\s-]+$/i.test(name)) return 'Только буквы, пробел и дефис';
  return null;
}

export function validatePassword(pwd: string): string | null {
  if (!pwd || pwd.length < 4) return 'Минимум 4 символа';
  if (pwd.length > 100) return 'Слишком длинный';
  return null;
}