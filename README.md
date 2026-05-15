# Umnico Extension

Браузерное расширение для Chrome + Backend API для работы с CRM Umnico.

## Описание

Система состоит из двух частей:
- **Браузерное расширение** - показывает реферальные ссылки и постбэки для лидов в Umnico
- **Backend API** - управляет интеграциями, ссылками и принимает постбэки от Keitaro

## Структура проекта

```
.
├── backend/              # Backend API (Node.js + Express + PostgreSQL)
│   ├── src/             # Исходный код
│   ├── public/          # Админ-панель
│   ├── init.sql         # SQL схема
│   ├── Dockerfile       # Docker образ
│   ├── docker-compose.yml
│   └── README.md        # Документация
├── ext_v6/              # Браузерное расширение
│   ├── background.js    # Service worker
│   ├── popup.html       # UI расширения
│   ├── popup.js         # Логика расширения
│   ├── style.css        # Стили
│   └── manifest.json    # Конфигурация расширения
└── README.md

```

## Возможности

### Backend
- ✅ REST API для браузерного расширения
- ✅ Прием постбэков от Keitaro (поддержка `external_id` и `sub_id_30`)
- ✅ Автоматическое создание лидов при первом запросе
- ✅ Веб-интерфейс администратора для управления интеграциями и ссылками
- ✅ Docker контейнеризация
- ✅ PostgreSQL база данных

### Браузерное расширение
- ✅ Автоматическое получение `sa_id` из Umnico API
- ✅ Отображение реферальных ссылок с автоматическим `?c={leadId}`
- ✅ Отображение постбэков с визуальным выделением депозитов
- ✅ Копирование ссылок в буфер обмена одним кликом

## Быстрый старт

### Backend

1. Клонируйте репозиторий:
```bash
git clone https://github.com/cnvncd/umnico-extension.git
cd umnico-extension/backend
```

2. Создайте `.env` файл:
```bash
cp .env.example .env
# Отредактируйте .env с вашими настройками
```

3. Запустите с Docker:
```bash
docker compose up -d
```

4. Откройте админ-панель: `http://localhost:3000/admin`

### Браузерное расширение

1. Откройте Chrome: `chrome://extensions/`
2. Включите "Developer mode"
3. Нажмите "Load unpacked"
4. Выберите папку `ext_v6`

## Документация

- [Backend README](backend/README.md) - полная документация по API и деплою
- [Deployment Guide](backend/DEPLOYMENT.md) - инструкции по деплою на VPS
- [Keitaro Setup](backend/KEITARO_SETUP.md) - настройка постбэков в Keitaro

## Технологии

**Backend:**
- Node.js 20
- Express.js
- PostgreSQL 15
- Docker & Docker Compose

**Frontend:**
- Vanilla JavaScript (ES6+)
- Chrome Extension Manifest V3
- HTML5 / CSS3

## API Endpoints

### Для расширения
- `GET /api/browser-extension/:leadId` - получить данные лида
- `GET /api/postback` - прием постбэков от Keitaro
- `POST /api/leads` - создать/обновить лида

### Для админ-панели
- `GET /api/admin/integrations` - список интеграций
- `POST /api/admin/integrations` - создать интеграцию
- `GET /api/admin/integrations/:id/links` - ссылки интеграции
- `POST /api/admin/integrations/:id/links` - добавить ссылку

## Деплой

Подробные инструкции по деплою на Ubuntu VPS смотрите в [backend/README.md](backend/README.md)

## Лицензия

MIT
