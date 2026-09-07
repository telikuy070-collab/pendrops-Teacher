# PenDrops Мугалим (Teacher PWA)

PWA-приложение для преподавателей — управление домашними заданиями, посещаемостью и оценками.

## Ссылки

- **PWA**: https://telikuy070-collab.github.io/pendrops-Teacher/
- **Исходники (студенческая PWA)**: https://github.com/telikuy070-collab/pendrops

## Запуск (локально)

```bash
npm ci
npm run dev:teacher     # dev-сервер на http://localhost:8081
```

## Сборка

```bash
npm run build:teacher   # сборка в dist-teacher/
```

## Тесты

```bash
npm test:teacher        # unit-тесты
npm typecheck:teacher   # проверка типов TypeScript
```

## Структура

- `teacher-app/index.html` — точка входа
- `teacher-app/src/` — исходники (TypeScript, strict-mode)
- `teacher-app/src/config/supabaseConfig.ts` — конфигурация Supabase
- `teacher-app/src/models/index.ts` — слой доступа к данным (repositories)
- `teacher-app/src/lib/` — auth, router, supabase клиент
- `teacher-app/src/view/pages/` — страницы (lazy-loaded)
- `teacher-app/src/utils/` — toast, formatters, edgeClient
- `teacher-app/config/sw.template.js` — шаблон service worker
- `teacher-app/manifest.teacher.json` — манифест PWA
- `supabase/functions/` — Edge Functions (export-csv, student-stats)

## Переменные окружения

```bash
cp .env.example .env
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY — из Supabase dashboard
# VITE_TEACHER_BUCKET, VITE_SUBMISSIONS_BUCKET, VITE_PROFILES_BUCKET
```

## GitHub Pages

Сайт доступен по адресу: `https://telikuy070-collab.github.io/pendrops-Teacher/`

Автоматическая сборка и деплой при пуше в `main`.
