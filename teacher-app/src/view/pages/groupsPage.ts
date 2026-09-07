/**
 * Groups list page — shows all groups for the logged-in teacher.
 */
import { groupRepository } from '../../models/index.ts';
import { toast } from '../../utils/toast.ts';
import { auth } from '../../lib/auth.ts';
import type { Group } from '../../types/schemas.ts';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderGroupsPage(container: HTMLElement, teacher: any) {
  if (!teacher) {
    container.innerHTML = '<div class="error">Пользователь не авторизован</div>';
    return;
  }

  container.innerHTML = `
    <div class="groups-page">
      <div class="page-header">
        <h2>👥 Мои группы</h2>
        <button class="btn primary small" id="addGroupBtn">➕ Добавить группу</button>
      </div>
      <div class="groups-grid" id="groupsGrid">
        <div class="loading">Загрузка групп...</div>
      </div>
    </div>
  `;

  const grid = document.getElementById('groupsGrid');
  const addBtn = document.getElementById('addGroupBtn');

  addBtn?.addEventListener('click', () => showAddGroupModal());

  try {
    const groups = await groupRepository.list(teacher.id);
    renderGroupsGrid(groups);
  } catch (error: any) {
    toast.show(error.message || 'Ошибка загрузки групп', 'bad');
    if (grid) grid.innerHTML = '<div class="error">Не удалось загрузить группы</div>';
  }
}

function renderGroupsGrid(groups: Group[]) {
  const grid = document.getElementById('groupsGrid');
  if (!grid) return;

  if (groups.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-illu">👥</div>
        <h3>Пока нет групп</h3>
        <p>Создайте первую группу для начала работы</p>
        <button class="btn primary" id="addGroupBtnEmpty">➕ Создать группу</button>
      </div>
    `;
    document
      .getElementById('addGroupBtnEmpty')
      ?.addEventListener('click', () => showAddGroupModal());
    return;
  }

  grid.innerHTML = groups
    .map(
      (group) => `
      <div class="card group-card" data-group-id="${group.id}">
        <div class="card-top">
          <span class="group-icon">${getGroupIcon(group.name)}</span>
          <div class="group-info">
            <div class="group-name">${escapeHtml(group.name)}</div>
            <div class="group-meta">${escapeHtml(group.description || '')}</div>
          </div>
        </div>
        <div class="card-footer">
          <button class="btn small primary" onclick="window.router?.go('/groups/${group.id}')">
            Открыть
          </button>
        </div>
      </div>
    `
    )
    .join('');
}

function getGroupIcon(name: string): string {
  // First letter of the group name as avatar
  const firstChar = name.charAt(0).toUpperCase();
  return firstChar;
}

function showAddGroupModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>➕ Новая группа</h3>
        <button class="modal-close" aria-label="Закрыть">✕</button>
      </div>
      <form id="addGroupForm" class="modal-form">
        <div class="field">
          <label>Название группы</label>
          <input type="text" id="groupName" placeholder="например: 1К-2ж" required />
        </div>
        <div class="field">
          <label>Описание (необязательно)</label>
          <textarea id="groupDescription" placeholder="Краткое описание..."></textarea>
        </div>
        <button type="submit" class="btn primary block">Создать</button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-backdrop')?.addEventListener('click', () => modal.remove());

  const form = modal.querySelector('#addGroupForm') as HTMLFormElement;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (modal.querySelector('#groupName') as HTMLInputElement)?.value?.trim();
    const description = (
      modal.querySelector('#groupDescription') as HTMLTextAreaElement
    )?.value?.trim();

    if (!name) return;

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Создаю...';

    try {
      const teacher = auth.user;
      if (!teacher) throw new Error('Пользователь не авторизован');

      await groupRepository.create(teacher.id, name, description || null);
      toast.show('Группа создана', 'ok');
      modal.remove();

      // Refresh the groups list
      await renderGroupsPage(document.getElementById('mainContent')!, teacher);
    } catch (error: any) {
      toast.show(error.message || 'Ошибка создания группы', 'bad');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Создать';
    }
  });
}
