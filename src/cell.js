import { TYPE_IDS } from './constants.js';
import { norm } from './text.js';
import { fieldExtractor } from './parser/fieldExtractor.ts';

const GROUP_RE = /^([А-ЯA-ZӨҮҢ]{1,6})[-\s]?(\d{1,2})[-\s]?(\d{2})(?:\s*\(?(\d)\)?)?$/;

export function parseGroupCode(name) {
  if (name == null) return null;
  const original = norm(name);
  let m = original.match(GROUP_RE);
  if (!m) {
    const upper = original.toUpperCase();
    m = upper.match(GROUP_RE);
    if (!m) return null;
    return { code: `${m[1]}-${m[2]}-${m[3]}`, subgroup: m[4] || '1', raw: original };
  }
  return { code: `${m[1]}-${m[2]}-${m[3]}`, subgroup: m[4] || '1', raw: original };
}

/**
 * Преобразует результат fieldExtractor.extractAll в формат, совместимый с существующим кодом
 */
function convertExtractedFields(result) {
  return {
    subject: result.subject.value,
    type: result.type?.value || TYPE_IDS.OTHER,
    room: result.room?.value || '',
    teacher: result.teacher?.value || '',
    isExam: false, // TODO: добавить детекцию экзаменов если нужно
  };
}

export function parseCell(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  if (typeof raw === 'number' && !isFinite(raw)) return null;
  const s = norm(raw);
  if (!s) return null;

  const extracted = fieldExtractor.extractAll(s);
  return convertExtractedFields(extracted);
}

export function splitSubs(raw) {
  if (!raw) return [];
  return String(raw)
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}