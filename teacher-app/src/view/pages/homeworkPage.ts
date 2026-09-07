/**
 * Homework list page — shows all homework assignments for the logged-in teacher.
 */
import { homeworkRepository, groupRepository } from '../../models/index.ts';
import { toast } from '../../utils/toast.ts';
import { formatDateShort } from '../../utils/formatters.ts';
import { auth } from '../../lib/auth.ts';
import type { Homework, Group } from '../../types/schemas.ts';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderHomeworkPage(container: HTMLElement, teacher: any) {
  if (!teacher) {
    container.innerHTML = '<div class="error">Пользователь не авторизован</div>';
    return;
  }

  container.innerHTML = `
    <div class="homework-page">
      <div class="page-header">
        <h2>📝 Домашние задания</h2>
        <button class="btn primary small" id="addHomeworkBtn">➕ Создать задание</button>
      </div>
      <div class="homework-list" id="homeworkList">
        <div class="loading">Загрузка заданий...</div>
      </div>
    </div>
  `;

  const list = document.getElementById('homeworkList');
  const addBtn = document.getElementById('addHomeworkBtn');

  addBtn?.addEventListener('click', () => showCreateHomeworkModal(container, teacher));

  try {
    const homeworks = await homeworkRepository.list(teacher.id, { limit: 50 });
    renderHomeworkList(homeworks);
  } catch (error: any) {
    toast.show(error.message || 'Ошибка загрузки заданий', 'bad');
    if (list) list.innerHTML = '<div class="error">Не удалось загрузить задания</div>';
  }
}

function renderHomeworkList(homeworks: Homework[]) {
  const list = document.getElementById('homeworkList');
  if (!list) return;

  if (homeworks.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-illu">📝</div>
        <h3>Пока нет заданий</h3>
        <p>Создайте первое домашнее задание для начала работы</p>
        <button class="btn primary" id="addHomeworkBtnEmpty">➕ Создать задание</button>
      </div>
    `;
    document.getElementById('addHomeworkBtnEmpty')?.addEventListener('click', () => {
      const teacher = auth.user;
      if (teacher) showCreateHomeworkModal(document.getElementById('mainContent')!, teacher);
    });
    return;
  }

  const now = new Date();
  list.innerHTML = homeworks
    .map((hw) => {
      const due = new Date(hw.due_date);
      const isPast = due < now;
      const statusClass = hw.status === 'published' ? 'status-published' : 'status-draft';
      const statusLabel =
        hw.status === 'published' ? 'Опубликовано' : hw.status === 'draft' ? 'Черновик' : 'Архив';
      const deadlineClass = isPast ? 'overdue' : '';

      return `
        <div class="card homework-card" data-id="${hw.id}">
          <div class="card-top">
            <span class="time">${formatDateShort(hw.due_date)}</span>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </div>
          <div class="subject">${escapeHtml(hw.title)}</div>
          <div class="row-info">
            <span class="chip ${deadlineClass}" data-if="hasDeadline">
              <b>Дедлайн:</b> ${formatDateShort(hw.due_date)}
            </span>
          </div>
          <div class="card-footer">
            <button class="btn small primary" onclick="window.router?.go('/homework/${hw.id}')">
              Подробнее
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

async function showCreateHomeworkModal(container: HTMLElement, teacher: any) {
  if (!teacher) return;

  // Fetch groups for the dropdown
  let groups: Group[] = [];
  try {
    groups = await groupRepository.list(teacher.id);
  } catch {
    toast.show('Не удалось загрузить группы', 'bad');
  }

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>➕ Новое задание</h3>
        <button class="modal-close" aria-label="Закрыть">✕</button>
      </div>
      <form id="createHomeworkForm" class="modal-form">
        <div class="field">
          <label>Название</label>
          <input type="text" id="hwTitle" placeholder="Введите название задания" required />
        </div>
        <div class="field">
          <label>Описание</label>
          <textarea id="hwDescription" placeholder="Подробное описание задания..."></textarea>
        </div>
        <div class="field">
          <label>Группа</label>
          <select id="hwGroup">
            <option value="">Вся группа (все группы)</option>
            ${groups.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Дедлайн</label>
          <input type="datetime-local" id="hwDeadline" required />
        </div>
        <div class="field">
          <label>Прикрепить файлы</label>
          <div class="drop-zone" id="hwDropZone">
            <div class="drop-zone-text">
              <div class="drop-zone-icon">📎</div>
              <div>Перетащите файлы сюда</div>
              <div class="drop-zone-sub">или нажмите чтобы выбрать</div>
            </div>
            <input type="file" id="hwFiles" multiple hidden />
          </div>
          <div class="picked-files" id="hwPickedFiles"></div>
        </div>
        <div class="field">
          <label>Статус</label>
          <select id="hwStatus">
            <option value="draft">Черновик</option>
            <option value="published" selected>Опубликовать</option>
          </select>
        </div>
        <button type="submit" class="btn primary block">Создать задание</button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-backdrop')?.addEventListener('click', () => modal.remove());

  const dropZone = modal.querySelector('#hwDropZone') as HTMLElement;
  const fileInput = modal.querySelector('#hwFiles') as HTMLInputElement;
  const pickedFiles = modal.querySelector('#hwPickedFiles') as HTMLElement;
  let selectedFiles: File[] = [];

  dropZone?.addEventListener('click', () => fileInput?.click());
  dropZone?.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
    dropZone.classList.add('is-drag');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('is-drag'));
  dropZone?.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault();
    dropZone.classList.remove('is-drag');
    const files = Array.from(e.dataTransfer?.files || []) as File[];
    if (files.length > 0) {
      selectedFiles = [...selectedFiles, ...files];
      updatePickedFiles();
    }
  });

  fileInput?.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []) as File[];
    selectedFiles = [...selectedFiles, ...files];
    updatePickedFiles();
  });

  function updatePickedFiles() {
    if (selectedFiles.length === 0) {
      pickedFiles.innerHTML = '';
      return;
    }
    pickedFiles.innerHTML = selectedFiles
      .map(
        (f) => `<div class="picked-file">📎 ${escapeHtml(f.name)} (${formatFileSize(f.size)})</div>`
      )
      .join('');
  }

  // Set default deadline to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(tomorrow.getHours() + 2);
  const deadlineInput = modal.querySelector('#hwDeadline') as HTMLInputElement;
  if (deadlineInput) {
    deadlineInput.value = tomorrow.toISOString().slice(0, 16);
  }

  const form = modal.querySelector('#createHomeworkForm') as HTMLFormElement;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = (modal.querySelector('#hwTitle') as HTMLInputElement)?.value?.trim();
    const description = (
      modal.querySelector('#hwDescription') as HTMLTextAreaElement
    )?.value?.trim();
    const groupId = (modal.querySelector('#hwGroup') as HTMLSelectElement)?.value;
    const deadline = (modal.querySelector('#hwDeadline') as HTMLInputElement)?.value;
    const status = (modal.querySelector('#hwStatus') as HTMLSelectElement)?.value;

    if (!title || !deadline) return;

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Создаю...';

    try {
      const hw = await homeworkRepository.create(teacher.id, {
        title,
        description: description || null,
        due_date: new Date(deadline).toISOString(),
        group_id: groupId || null,
        status: status as any,
      });

      // Upload attachments
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          try {
            await uploadAttachment(teacher.id, hw.id, file);
          } catch (uploadError: any) {
            toast.show(`Ошибка загрузки ${file.name}: ${uploadError.message}`, 'warning');
          }
        }
      }

      toast.show('Задание создано', 'ok');
      modal.remove();
      await renderHomeworkPage(container, teacher);
    } catch (error: any) {
      toast.show(error.message || 'Ошибка создания задания', 'bad');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Создать задание';
    }
  });
}

async function uploadAttachment(_teacherId: string, _homeworkId: string, _file: File) {
  // This would use the storage repository to upload
  // For now we just simulate the upload
  await new Promise((resolve) => setTimeout(resolve, 300));
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
