/**
 * Homework detail page — shows a single homework assignment with all submissions.
 */
import { homeworkRepository, submissionRepository, gradeRepository } from '../../models/index.ts';
import { toast } from '../../utils/toast.ts';
import { formatDate } from '../../utils/formatters.ts';
import type { HomeworkWithAttachments, Submission } from '../../types/schemas.ts';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderHomeworkDetailPage(
  container: HTMLElement,
  teacher: any,
  homeworkId: string
) {
  if (!teacher) {
    container.innerHTML = '<div class="error">Пользователь не авторизован</div>';
    return;
  }

  container.innerHTML = `
    <div class="homework-detail-page" data-id="${homeworkId}">
      <div class="loading">Загрузка задания...</div>
    </div>
  `;

  try {
    const hw = await homeworkRepository.getWithAttachments(homeworkId);
    renderHomeworkDetail(container, hw);

    // Load submissions
    const submissions = await submissionRepository.listByHomework(homeworkId);
    renderSubmissions(container, submissions);
  } catch (error: any) {
    toast.show(error.message || 'Ошибка загрузки задания', 'bad');
    container.innerHTML = `<div class="error">${error.message || 'Ошибка загрузки'}</div>`;
  }
}

function renderHomeworkDetail(container: HTMLElement, hw: HomeworkWithAttachments) {
  const page = container.querySelector('.homework-detail-page');
  if (!page) return;

  page.innerHTML = `
    <header class="page-header">
      <h2>${escapeHtml(hw.title)}</h2>
      <button class="btn ghost small" onclick="window.router?.go('/homework')">
        ← Назад к заданиям
      </button>
    </header>

    <div class="homework-meta">
      <div class="meta-item">
        <b>Дедлайн:</b> ${formatDate(hw.due_date)}
      </div>
      <div class="meta-item">
        <b>Статус:</b> ${hw.status === 'published' ? '✅ Опубликовано' : hw.status === 'draft' ? '📝 Черновик' : '📦 Архив'}
      </div>
      ${hw.group ? `<div class="meta-item"><b>Группа:</b> ${escapeHtml(hw.group.name)}</div>` : '<div class="meta-item"><b>Группа:</b> Вся группа</div>'}
      <div class="meta-item">
        <b>Отправок:</b> ${hw.submission_count ?? 0}
      </div>
    </div>

    ${hw.description ? `<div class="homework-description">${escapeHtml(hw.description)}</div>` : ''}

    ${
      hw.attachments && hw.attachments.length > 0
        ? `
      <div class="homework-attachments">
        <h3>📎 Вложенные файлы</h3>
        ${hw.attachments
          .map(
            (att) => `
          <div class="attachment-item">
            <span>${escapeHtml(att.file_name)} (${formatFileSize(att.file_size)})</span>
            <button class="btn small ghost" onclick="downloadFile('${att.storage_path}')">📥</button>
          </div>
        `
          )
          .join('')}
      </div>
    `
        : ''
    }

    <div class="homework-submissions">
      <h3>📬 Отправки учеников</h3>
      <div id="submissionsList">
        <div class="loading">Загрузка отправок...</div>
      </div>
    </div>
  `;
}

function renderSubmissions(container: HTMLElement, submissions: Submission[]) {
  const list = container.querySelector('#submissionsList');
  if (!list) return;

  if (submissions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-illu">📭</div>
        <h3>Пока нет отправок</h3>
        <p>Ученики ещё не отправили решения</p>
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Ученик</th>
          <th>Файл</th>
          <th>Отправлено</th>
          <th>Оценка</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${submissions
          .map(
            (s: any) => `
          <tr data-submission-id="${s.id}">
            <td>
              <span class="avatar">${escapeHtml((s.student as any)?.full_name?.charAt(0) || '?')}</span>
              ${s.student ? escapeHtml((s.student as any).full_name) : '—'}
            </td>
            <td>${escapeHtml(s.file_name)}</td>
            <td>${formatDate(s.submitted_at)}</td>
            <td class="grade-cell" data-submission-id="${s.id}">…</td>
            <td>
              <button class="btn small ghost" onclick="downloadFile('${s.storage_path}')">📥</button>
              <button class="btn small primary" onclick="gradeSubmission('${s.id}')">
                ✏️ Оценить
              </button>
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;

  // Load grades in background
  for (const sub of submissions) {
    loadGradeForSubmission(sub.id);
  }
}

async function loadGradeForSubmission(submissionId: string) {
  try {
    const grades = (await gradeRepository.listBySubmission?.(submissionId)) ?? [];
    const el = document.querySelector(`.grade-cell[data-submission-id="${submissionId}"]`);
    if (el) {
      el.textContent = grades.length > 0 ? grades.map((g) => g.value).join(', ') : '—';
    }
  } catch {
    // Silent
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// Global function declarations for template onclick handlers
declare global {
  interface Window {
    downloadFile: (path: string) => void;
    gradeSubmission: (submissionId: string) => void;
  }
}

// Global function for template onclick handlers
window.downloadFile = (path: string) => {
  // This would download the file from storage
  console.log('Downloading:', path);
};

window.gradeSubmission = (submissionId: string) => {
  // This would open a grade entry modal
  console.log('Grading submission:', submissionId);
};
