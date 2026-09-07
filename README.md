# Расписание PWA

PWA-приложение для отображения расписания мед. колледжа из Excel (`.xls` / `.xlsx`).

## Запуск

```
cd C:\Users\user\Desktop\pendrops
python -m http.server 8080
```

Открой `http://localhost:8080` → меню браузера → «Установить приложение» (PWA).

## Возможности

- Чтение `.xls` (через SheetJS 0.20.3)
- Авто-разбор сетки листа: повторяющиеся блоки `[День | Пара | Время | Группа1 (1) | Группа1 (2) | …]`
- Извлечение кодов групп из заголовков (`ПСТ-1-25`, `ЛД-2-23`, `ФЯ-4-25 (1)`…)
- Разбивка ячеек по `/` (подгруппы в одной ячейке)
- Парсинг: предмет, тип (лекция / практика / лабораторная), аудитория, преподаватель
- Дни недели: кыргызский (`Дүйшөмбү`, `Шейшемби`…) → русский
- Фильтры: отделение/лист, группа, подгруппа, день, неделя (1/2), поиск
- Сохранение в localStorage
- Офлайн-режим (Service Worker)

## Структура файлов

### Студенческое PWA (PenDrops Студент)

- `index.html`, `styles.css`, `app.js` — приложение
- `manifest.json`, `sw.js` — PWA
- `assets/icons/` — иконки 192/512
- `src/` — исходники студенческого приложения

### Учительское PWA (PenDrops Мугалим)

- `teacher-app/index.html` — точка входа
- `teacher-app/src/` — исходники (TypeScript)
- `teacher-app/src/config/supabaseConfig.ts` — конфигурация Supabase
- `teacher-app/src/models/index.ts` — слой доступа к данным (repositories)
- `teacher-app/src/lib/` — auth, router, supabase клиент
- `teacher-app/src/view/pages/` — страницы (lazy-loaded)
- `teacher-app/src/utils/` — toast, formatters, edgeClient
- `teacher-app/config/sw.template.js` — шаблон service worker
- `teacher-app/manifest.teacher.json` — манифест
- `teacher-app/public/` — статические файлы (sw.js после сборки)
- `dist-teacher/` — сборка для продакшена

Сборка и запуск учительского PWA:

```
npm run dev:teacher    # dev-сервер на http://localhost:8081
npm run build:teacher  # сборка в dist-teacher/
npm test:teacher       # тесты
npm typecheck:teacher  # проверка типов
```

## Поддерживаемый формат Excel

Книга с листами-отделениями. В каждом листе шапка в строке 6 (`Апта күндөрү | Паралар | Убакты | Группа1 | Группа2 | …`), далее строки по дням недели.
