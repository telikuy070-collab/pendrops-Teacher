/**
 * Main entry point for PenDrops Мугалим (Teacher PWA).
 *
 * Initializes the app, sets up routing, auth state management,
 * and renders the appropriate page based on current route + auth state.
 */
import './styles.css';
import { auth } from './lib/auth.ts';
import { createRouter } from './lib/router.ts';
import { toast } from './utils/toast.ts';
import type { Teacher } from './types/schemas.ts';

// Re-export toast for convenience
export { toast };

// ---------------------------------------------------------------------------
// App State
// ---------------------------------------------------------------------------

interface AppState {
  user: Teacher | null;
  authState: 'loading' | 'authenticated' | 'unauthenticated';
  currentRoute: string;
}

const state: AppState = {
  user: null,
  authState: 'loading',
  currentRoute: window.location.pathname,
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderApp() {
  const app = document.getElementById('appContainer');
  if (!app) return;

  const { authState, currentRoute } = state;

  if (authState === 'loading') {
    app.innerHTML = `
      <div class="loading-screen">
        <div class="spinner"></div>
        <p>Загрузка...</p>
      </div>
    `;
    return;
  }

  if (authState === 'unauthenticated') {
    app.innerHTML = `
      <div class="auth-gate">
        <div class="auth-card">
          <div class="auth-header">
            <span class="logo">📚</span>
            <h1>PenDrops Мугалим</h1>
            <p>Управление домашними заданиями, посещаемостью и оценками</p>
          </div>
          <form id="authForm" class="auth-form">
            <div class="field">
              <label for="teacherEmail">Email</label>
              <input type="email" id="teacherEmail" placeholder="teacher@college.edu" autocomplete="email" required />
            </div>
            <div class="field">
              <label for="teacherPassword">Пароль</label>
              <input type="password" id="teacherPassword" placeholder="••••••••" autocomplete="current-password" required />
            </div>
            <button type="submit" class="btn primary block">Войти</button>
            <div class="admin-error" id="authError"></div>
          </form>
        </div>
      </div>
    `;
    bindAuthForm();
    return;
  }

  // Authenticated — render main app shell
  app.innerHTML = `
    <div class="teacher-app">
      <header class="teacher-header">
        <div class="brand">
          <span class="logo">📚</span>
          <h1>Мугалим</h1>
        </div>
        <nav class="teacher-nav" id="mainNav">
          <a href="/" data-nav="home" class="nav-link">🏠 Главная</a>
          <a href="/groups" data-nav="groups" class="nav-link">👥 Группы</a>
          <a href="/homework" data-nav="homework" class="nav-link">📝 ДЗ</a>
          <a href="/schedule" data-nav="schedule" class="nav-link">📅 Расписание</a>
        </nav>
        <button id="logoutBtn" class="btn ghost small">Выйти</button>
      </header>
      <main class="teacher-main" id="mainContent">
        <div class="loading-screen">
          <div class="spinner"></div>
          <p>Загрузка...</p>
        </div>
      </main>
    </div>
  `;

  bindLogout();
  bindNav();
  router.navigate(currentRoute);
}

function bindAuthForm() {
  const form = document.getElementById('authForm');
  const errorEl = document.getElementById('authError');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('teacherEmail') as HTMLInputElement)?.value?.trim();
    const password = (document.getElementById('teacherPassword') as HTMLInputElement)?.value;

    if (!email || !password) {
      if (errorEl) errorEl.textContent = 'Введите email и пароль';
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Вход...';
    if (errorEl) errorEl.textContent = '';

    try {
      const teacher = await auth.signIn(email, password);
      state.user = teacher;
      state.authState = 'authenticated';
      renderApp();
      toast.show(`Добро пожатала, ${teacher.full_name || 'учитель'}!`, 'ok');
    } catch (error: any) {
      if (errorEl) errorEl.textContent = error.message || 'Ошибка входа';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Войти';
    }
  });
}

function bindLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async () => {
    try {
      await auth.signOut();
      toast.show('Вы вышли из аккаунта', 'ok');
    } catch (error: any) {
      toast.show(error.message || 'Ошибка выхода', 'bad');
    }
  });
}

function bindNav() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href') || '/';
      router.go(href);
    });
  });
}

// ---------------------------------------------------------------------------
// Router setup (lazy-loaded pages)
// ---------------------------------------------------------------------------

const router = createRouter();

// Home page
router.addRoute('/', async () => {
  state.currentRoute = '/';
  const main = document.getElementById('mainContent');
  if (!main) return;

  main.innerHTML = `
    <div class="home-page">
      <h2>Добро пожаловать, ${state.user?.full_name || 'учитель'}!</h2>
      <p>Управляйте группами, заданиями и посещаемостью через меню навигации.</p>
      <div class="quick-actions">
        <a href="/groups" class="btn primary">👥 Мои группы</a>
        <a href="/homework" class="btn primary">📝 Домашние задания</a>
      </div>
    </div>
  `;
});

// Groups page
router.addRoute('/groups', async () => {
  state.currentRoute = '/groups';
  const main = document.getElementById('mainContent');
  if (!main) return;

  // Lazy load groups page
  try {
    const { renderGroupsPage } = await import('./view/pages/groupsPage.ts');
    await renderGroupsPage(main, state.user!);
  } catch (error: any) {
    main.innerHTML = `<div class="error">Ошибка загрузки страницы: ${error.message}</div>`;
  }
});

// Group detail
router.addRoute('/groups/:groupId', async (params) => {
  state.currentRoute = `/groups/${params.groupId}`;
  const main = document.getElementById('mainContent');
  if (!main) return;

  try {
    const { renderGroupPage } = await import('./view/pages/groupPage.ts');
    await renderGroupPage(main, state.user!, params.groupId ?? '');
  } catch (error: any) {
    main.innerHTML = `<div class="error">Ошибка загрузки страницы: ${error.message}</div>`;
  }
});

// Homework page
router.addRoute('/homework', async () => {
  state.currentRoute = '/homework';
  const main = document.getElementById('mainContent');
  if (!main) return;

  try {
    const { renderHomeworkPage } = await import('./view/pages/homeworkPage.ts');
    await renderHomeworkPage(main, state.user!);
  } catch (error: any) {
    main.innerHTML = `<div class="error">Ошибка загрузки страницы: ${error.message}</div>`;
  }
});

// Homework detail
router.addRoute('/homework/:homeworkId', async (params) => {
  state.currentRoute = `/homework/${params.homeworkId}`;
  const main = document.getElementById('mainContent');
  if (!main) return;

  try {
    const { renderHomeworkDetailPage } = await import('./view/pages/homeworkDetailPage.ts');
    await renderHomeworkDetailPage(main, state.user!, params.homeworkId ?? '');
  } catch (error: any) {
    main.innerHTML = `<div class="error">Ошибка загрузки страницы: ${error.message}</div>`;
  }
});

// Schedule page
router.addRoute('/schedule', async () => {
  state.currentRoute = '/schedule';
  const main = document.getElementById('mainContent');
  if (!main) return;

  main.innerHTML = `
    <div class="schedule-page">
      <h2>📅 Расписание</h2>
      <p>Функция в разработке</p>
    </div>
  `;
});

// Catch-all for unknown routes
router.addRoute('*', async () => {
  state.currentRoute = '/';
  const main = document.getElementById('mainContent');
  if (!main) return;

  main.innerHTML = `
    <div class="error-page">
      <h2>404 — Страница не найдена</h2>
      <button class="btn primary" onclick="history.back()">Назад</button>
    </div>
  `;
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function init() {
  // Register service worker (PWA)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (import.meta.env.DEV) {
        console.log('SW registered:', reg.scope);
      }
    } catch (err) {
      console.error('SW registration failed:', err);
    }
  }

  // Listen for auth state changes
  auth.subscribe((event) => {
    state.authState = event.state;
    state.user = event.user;
    renderApp();
  });

  // Start auth listener for token refresh
  auth.startListening();

  // Initialize auth state
  await auth.init();

  // Start the router
  router.start();

  // Render initial state
  renderApp();
}

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
