/**
 * Group detail page — shows students, attendance, and grades for a group.
 *
 * Uses a sub-navigation system to switch between views:
 * - Students: list of all students in the group
 * - Attendance: mark attendance for a specific date
 * - Grades: view and manage grades
 */
import { studentRepository, attendanceRepository, gradeRepository } from '../../models/index.ts';
import { toast } from '../../utils/toast.ts';
import { edgeClient } from '../../utils/edgeClient.ts';
import { auth } from '../../lib/auth.ts';
import { formatDate } from '../../utils/formatters.ts';
import type { Group, Attendance } from '../../types/schemas.ts';

export async function renderGroupPage(container: HTMLElement, teacher: any, groupId: string) {
  if (!teacher) {
    container.innerHTML = '<div class="error">Пользователь не авторизован</div>';
    return;
  }

  // Fetch group info
  let group: Group | null = null;
  try {
    // We need to fetch group details — we'll use student data and infer group
    const students = await studentRepository.listByGroup(groupId);
    if (students.length > 0) {
      group = {
        id: groupId,
        teacher_id: teacher.id,
        name: '',
        description: null,
        created_at: null,
      } as Group;
    }
  } catch (error: any) {
    toast.show(error.message || 'Ошибка загрузки группы', 'bad');
    return;
  }

  // Render page structure
  container.innerHTML = `
    <div class="group-detail-page" data-group-id="${groupId}">
      <header class="page-header">
        <h2>📖 Группа ${group ? group.name : groupId}</h2>
        <div class="header-actions">
          <button class="btn small primary" id="exportCsvBtn" title="Экспорт посещаемости в CSV">
            📥 Экспорт
          </button>
          <button class="btn small ghost" id="statsBtn" title="Статистика группы">
            📊 Статистика
          </button>
        </div>
      </header>

      <nav class="subnav">
        <button class="subnav-btn active" data-view="students">Ученики</button>
        <button class="subnav-btn" data-view="attendance">Посещаемость</button>
        <button class="subnav-btn" data-view="grades">Оценки</button>
      </nav>

      <section class="subview-container">
        <div class="subview active" id="studentsView">
          <div class="loading">Загрузка учеников...</div>
        </div>
        <div class="subview" id="attendanceView">
          <div class="loading">Загрузка посещаемости...</div>
        </div>
        <div class="subview" id="gradesView">
          <div class="loading">Загрузка оценок...</div>
        </div>
      </section>
    </div>
  `;

  // Bind subnav
  const subnavBtns = container.querySelectorAll('.subnav-btn') as NodeListOf<HTMLButtonElement>;
  subnavBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      subnavBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const views = container.querySelectorAll('.subview') as unknown as NodeListOf<HTMLElement>;
      views.forEach((v) => v.classList.remove('active'));

      const targetView = btn.dataset.view;
      const target = container.querySelector(`#${targetView}View`) as HTMLElement;
      target?.classList.add('active');
    });
  });

  // Load students initially
  await loadStudents(container, teacher, groupId);

  // Bind export button
  const exportBtn = container.querySelector('#exportCsvBtn');
  exportBtn?.addEventListener('click', async () => {
    try {
      const blob = await edgeClient.exportAttendanceCsv(groupId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${groupId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.show('CSV экспортирован', 'ok');
    } catch (error: any) {
      toast.show(error.message || 'Ошибка экспорта', 'bad');
    }
  });

  // Bind stats button
  const statsBtn = container.querySelector('#statsBtn');
  statsBtn?.addEventListener('click', async () => {
    try {
      const stats = await edgeClient.getClassStats(groupId);
      showStatsModal(stats);
    } catch (error: any) {
      toast.show(error.message || 'Ошибка загрузки статистики', 'bad');
    }
  });

  // Load attendance on view switch
  const attendanceBtn = container.querySelector('[data-view="attendance"]');
  attendanceBtn?.addEventListener('click', () => {
    loadAttendance(container, teacher, groupId);
  });

  // Load grades on view switch
  const gradesBtn = container.querySelector('[data-view="grades"]');
  gradesBtn?.addEventListener('click', () => {
    loadGrades(container, teacher, groupId);
  });
}

// ---------------------------------------------------------------------------
// Students View
// ---------------------------------------------------------------------------

async function loadStudents(container: HTMLElement, teacher: any, groupId: string) {
  const view = container.querySelector('#studentsView');
  if (!view) return;

  view.innerHTML = '<div class="loading">Загрузка учеников...</div>';

  try {
    const students = await studentRepository.listByGroup(groupId);
    view.innerHTML = '';

    if (students.length === 0) {
      view.innerHTML = `
        <div class="empty-state">
          <div class="empty-illu">👤</div>
          <h3>Учеников пока нет</h3>
          <p>Добавьте первого ученика в эту группу</p>
          <button class="btn primary" id="addStudentBtn">➕ Добавить ученика</button>
        </div>
      `;
      view
        .querySelector('#addStudentBtn')
        ?.addEventListener('click', () => showAddStudentModal(container, groupId));
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>ФИО</th>
          <th>Последняя посещаемость</th>
          <th>Средний балл</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${students
          .map((s) => {
            const attendance = s.latest_attendance;
            const attendanceText = attendance
              ? `${formatDate(attendance.date)} — ${attendance.status === 'present' ? '✅' : attendance.status === 'absent' ? '❌' : '⚠️'}`
              : '—';
            return `
              <tr data-student-id="${s.id}">
                <td>
                  <span class="avatar">${s.full_name.charAt(0)}</span>
                  ${escapeHtml(s.full_name)}
                </td>
                <td>${escapeHtml(attendanceText)}</td>
                <td class="avg-grade" data-student-id="${s.id}">…</td>
                <td>
                  <button class="btn small ghost" onclick="window.router?.go('/students/${s.id}')">
                    📋
                  </button>
                </td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    `;

    view.appendChild(table);

    // Load average grades in background
    for (const student of students) {
      loadAvgGrade(student.id);
    }
  } catch (error: any) {
    view.innerHTML = `<div class="error">Ошибка загрузки учеников: ${error.message}</div>`;
  }
}

async function loadAvgGrade(studentId: string) {
  try {
    const grades = await gradeRepository.listByStudent(studentId);
    const avg = grades.length > 0 ? grades.reduce((sum, g) => sum + g.value, 0) / grades.length : 0;

    const el = document.querySelector(`.avg-grade[data-student-id="${studentId}"]`);
    if (el) {
      el.textContent = avg > 0 ? avg.toFixed(1) : '—';
    }
  } catch {
    // Silent fail — grade not critical for student list
  }
}

// ---------------------------------------------------------------------------
// Attendance View
// ---------------------------------------------------------------------------

async function loadAttendance(container: HTMLElement, teacher: any, groupId: string) {
  const view = container.querySelector('#attendanceView');
  if (!view) return;

  view.innerHTML = '<div class="loading">Загрузка посещаемости...</div>';

  try {
    const students = await studentRepository.listByGroup(groupId);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    view.innerHTML = `
      <div class="attendance-editor">
        <div class="attendance-header">
          <label>Дата:</label>
          <input type="date" id="attendanceDate" value="${todayStr}" />
        </div>
        <div class="attendance-grid" id="attendanceGrid">
          ${students
            .map((s) => {
              const initialStatus = s.latest_attendance?.status || 'present';
              return `
                <div class="attendance-cell" data-student-id="${s.id}">
                  <div class="avatar">${s.full_name.charAt(0)}</div>
                  <div class="student-name">${escapeHtml(s.full_name)}</div>
                  <div class="status-buttons">
                    <button class="btn small ${initialStatus === 'present' ? 'active' : ''}" data-status="present">✅</button>
                    <button class="btn small ${initialStatus === 'absent' ? 'active' : ''}" data-status="absent">❌</button>
                    <button class="btn small ${initialStatus === 'late' ? 'active' : ''}" data-status="late">⚠️</button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
        <button class="btn primary" id="saveAttendance">💾 Сохранить посещаемость</button>
      </div>
    `;

    // Bind status buttons
    view.querySelectorAll('.status-buttons .btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const cell = target.closest('.attendance-cell') as HTMLElement;

        // Update active state
        cell.querySelectorAll('.btn').forEach((b) => b.classList.remove('active'));
        target.classList.add('active');

        // Store selected status
        cell.dataset.selectedStatus = target.dataset.status || 'present';
      });
    });

    // Bind save
    view.querySelector('#saveAttendance')?.addEventListener('click', async () => {
      const date = (view.querySelector('#attendanceDate') as HTMLInputElement)?.value;
      if (!date) return;

      const records: Omit<Attendance, 'id'>[] = [];
      view.querySelectorAll('.attendance-cell').forEach((cell) => {
        const studentId = (cell as HTMLElement).dataset.studentId || '';
        const status = (cell as HTMLElement).dataset.selectedStatus || 'present';
        records.push({
          student_id: studentId,
          date,
          status: status as any,
          note: null,
          created_at: new Date().toISOString(),
        });
      });

      try {
        await attendanceRepository.bulkUpsert(records);
        toast.show('Посещаемость сохранена', 'ok');
      } catch (error: any) {
        toast.show(error.message || 'Ошибка сохранения', 'bad');
      }
    });
  } catch (error: any) {
    view.innerHTML = `<div class="error">Ошибка загрузки: ${error.message}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Grades View
// ---------------------------------------------------------------------------

async function loadGrades(container: HTMLElement, teacher: any, groupId: string) {
  const view = container.querySelector('#gradesView');
  if (!view) return;

  view.innerHTML = '<div class="loading">Загрузка оценок...</div>';

  try {
    const students = await studentRepository.listByGroup(groupId);

    view.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Ученик</th>
            <th>Средний балл</th>
            <th>Оценки</th>
          </tr>
        </thead>
        <tbody>
          ${students
            .map(
              (s) => `
              <tr data-student-id="${s.id}">
                <td>
                  <span class="avatar">${s.full_name.charAt(0)}</span>
                  ${escapeHtml(s.full_name)}
                </td>
                <td class="student-avg" data-student-id="${s.id}">…</td>
                <td><button class="btn small ghost" onclick="viewStudentGrades('${s.id}')">📋</button></td>
              </tr>
            `
            )
            .join('')}
        </tbody>
      </table>
    `;

    // Load averages
    for (const student of students) {
      const grades = await gradeRepository.listByStudent(student.id);
      const avg =
        grades.length > 0 ? grades.reduce((sum, g) => sum + g.value, 0) / grades.length : 0;

      const el = view.querySelector(`.student-avg[data-student-id="${student.id}"]`);
      if (el) {
        el.textContent = avg > 0 ? `${avg.toFixed(2)} (${grades.length})` : '—';
      }
    }
  } catch (error: any) {
    view.innerHTML = `<div class="error">Ошибка загрузки: ${error.message}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showAddStudentModal(container: HTMLElement, groupId: string) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>➕ Добавить ученика</h3>
        <button class="modal-close" aria-label="Закрыть">✕</button>
      </div>
      <form id="addStudentForm" class="modal-form">
        <div class="field">
          <label>ФИО ученика</label>
          <input type="text" id="studentName" placeholder="Иванов Иван Иванович" required />
        </div>
        <div class="field">
          <label>Email (необязательно)</label>
          <input type="email" id="studentEmail" placeholder="student@example.com" />
        </div>
        <button type="submit" class="btn primary block">Добавить</button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-backdrop')?.addEventListener('click', () => modal.remove());

  const form = modal.querySelector('#addStudentForm') as HTMLFormElement;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (modal.querySelector('#studentName') as HTMLInputElement)?.value?.trim();

    if (!name) return;

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Добавляю...';

    try {
      await studentRepository.create({
        group_id: groupId,
        full_name: name,
        avatar_url: null,
        phone: null,
        birth_date: null,
      });
      toast.show('Ученик добавлен', 'ok');
      modal.remove();

      // Refresh students
      await loadStudents(container, auth.user!, groupId);
    } catch (error: any) {
      toast.show(error.message || 'Ошибка добавления ученика', 'bad');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Добавить';
    }
  });
}

function showStatsModal(stats: any) {
  const modal = document.createElement('div');
  modal.className = 'modal';

  const gradeStats = stats.grades;

  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content stats-modal">
      <div class="modal-header">
        <h3>📊 Статистика группы</h3>
        <button class="modal-close" aria-label="Закрыть">✕</button>
      </div>
      <div class="modal-form">
        <div class="stats-summary">
          <div class="stat-card">
            <div class="stat-value">${gradeStats.overallAverage ?? '—'}</div>
            <div class="stat-label">Средний балл</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.studentCount}</div>
            <div class="stat-label">Учеников</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.submissions.rate ?? '—'}</div>
            <div class="stat-label">Сдача ДЗ</div>
          </div>
        </div>
        <div class="stat-section">
          <h4>Оценки по ученикам</h4>
          <div class="grade-list">
            ${(gradeStats.byStudent ?? [])
              .map(
                (s: any) => `
                <div class="grade-item">
                  <span>Ученик ${s.studentId.substring(0, 8)}...</span>
                  <span>${s.average.toFixed(1)} (${s.count})</span>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-backdrop')?.addEventListener('click', () => modal.remove());
}
