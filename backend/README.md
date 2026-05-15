# Umnico Extension Backend

Backend API для браузерного расширения Umnico с веб-интерфейсом администратора.

## Возможности

- **API для браузерного расширения**: получение реферальных ссылок и постбэков по лидам
- **Webhook для постбэков**: прием постбэков от Keitaro
- **Админ-панель**: управление интеграциями и реферальными ссылками
- **PostgreSQL**: надежное хранение данных
- **Docker**: простой деплой

## Архитектура

```
backend/
├── src/
│   ├── index.js       # Express сервер и API эндпоинты
│   └── db.js          # Подключение к PostgreSQL
├── public/
│   ├── index.html     # Админ-панель
│   ├── app.js         # JavaScript админ-панели
│   └── style.css      # Стили админ-панели
├── init.sql           # SQL схема базы данных
├── Dockerfile         # Docker образ приложения
├── docker-compose.yml # Docker Compose конфигурация
├── package.json       # Node.js зависимости
└── .env.example       # Пример переменных окружения
```

## API Эндпоинты

### Для браузерного расширения

**GET /api/browser-extension/:leadId**
- Возвращает данные по лиду: информацию, постбэки, реферальные ссылки
- Ссылки подбираются по `sa_id` лида

**GET /api/postback**
- Принимает постбэки от Keitaro
- Параметры: `external_id`, `status`, `offer`, `sub_id`, `payout`

**POST /api/leads**
- Создает или обновляет лида
- Body: `{ umnico_id, telegram_fullname, sa_id }`

### Для админ-панели

**GET /api/admin/integrations** - список интеграций  
**POST /api/admin/integrations** - создать интеграцию  
**DELETE /api/admin/integrations/:id** - удалить интеграцию  
**GET /api/admin/integrations/:id/links** - ссылки интеграции  
**POST /api/admin/integrations/:id/links** - добавить ссылку  
**PUT /api/admin/links/:id** - обновить ссылку  
**DELETE /api/admin/links/:id** - удалить ссылку  

**GET /health** - healthcheck

## Деплой на Ubuntu VPS

### 1. Установка Docker и Docker Compose

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавить пользователя в группу docker
sudo usermod -aG docker $USER

# Установить Docker Compose
sudo apt install docker-compose -y

# Проверить установку
docker --version
docker-compose --version
```

### 2. Клонирование и настройка проекта

```bash
# Создать директорию для проекта
mkdir -p /opt/umnico-backend
cd /opt/umnico-backend

# Скопировать файлы проекта на сервер
# Используйте scp, rsync или git clone

# Создать .env файл
cp .env.example .env
nano .env
```

Настройте `.env`:
```env
PORT=3000
NODE_ENV=production

POSTGRES_USER=umnico_user
POSTGRES_PASSWORD=ваш_надежный_пароль
POSTGRES_DB=umnico_db

ALLOWED_ORIGINS=https://ваш-домен.com,chrome-extension://
```

### 3. Запуск приложения

```bash
# Запустить контейнеры
docker-compose up -d

# Проверить статус
docker-compose ps

# Посмотреть логи
docker-compose logs -f app

# Проверить healthcheck
curl http://localhost:3000/health
```

### 4. Настройка Nginx как Reverse Proxy

```bash
# Установить Nginx
sudo apt install nginx -y

# Создать конфигурацию
sudo nano /etc/nginx/sites-available/umnico-backend
```

Добавьте конфигурацию:
```nginx
server {
    listen 80;
    server_name ваш-домен.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активируйте конфигурацию:
```bash
# Создать символическую ссылку
sudo ln -s /etc/nginx/sites-available/umnico-backend /etc/nginx/sites-enabled/

# Проверить конфигурацию
sudo nginx -t

# Перезапустить Nginx
sudo systemctl restart nginx
```

### 5. Настройка SSL с Certbot

```bash
# Установить Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получить SSL сертификат
sudo certbot --nginx -d ваш-домен.com

# Certbot автоматически настроит HTTPS и перенаправление
```

Certbot автоматически обновляет сертификаты. Проверить:
```bash
sudo certbot renew --dry-run
```

### 6. Настройка Firewall

```bash
# Разрешить HTTP, HTTPS и SSH
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включить firewall
sudo ufw enable

# Проверить статус
sudo ufw status
```

## Использование

### Админ-панель

Откройте в браузере: `https://ваш-домен.com/admin`

1. **Добавить интеграцию**: укажите название и `sa_id` из Umnico
2. **Добавить ссылки**: для каждой интеграции добавьте реферальные ссылки
3. Ссылки будут автоматически показываться в расширении для лидов с соответствующим `sa_id`

### Настройка расширения

В файле `background.js` расширения измените `BASE_URL`:
```javascript
const BASE_URL = "https://ваш-домен.com/api";
```

### Настройка Keitaro

Добавьте postback URL в Keitaro:
```
https://ваш-домен.com/api/postback?external_id={external_id}&status={status}&offer={offer_name}&sub_id={sub_id_5}&payout={payout}
```

## Управление

### Просмотр логов
```bash
docker-compose logs -f app
docker-compose logs -f db
```

### Перезапуск
```bash
docker-compose restart
```

### Остановка
```bash
docker-compose down
```

### Обновление
```bash
# Остановить контейнеры
docker-compose down

# Обновить код
git pull  # или скопировать новые файлы

# Пересобрать и запустить
docker-compose up -d --build
```

### Бэкап базы данных
```bash
# Создать бэкап
docker-compose exec db pg_dump -U umnico_user umnico_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из бэкапа
docker-compose exec -T db psql -U umnico_user umnico_db < backup_20260514_120000.sql
```

## Структура базы данных

**integrations** - интеграции (боты) из Umnico  
**leads** - лиды с привязкой к интеграции  
**postbacks** - история постбэков  
**referral_links** - реферальные ссылки для каждой интеграции  

## Troubleshooting

### Проблемы с подключением к БД
```bash
# Проверить статус контейнера БД
docker-compose ps db

# Проверить логи БД
docker-compose logs db

# Подключиться к БД вручную
docker-compose exec db psql -U umnico_user umnico_db
```

### Проблемы с CORS
Убедитесь, что в `.env` указан правильный `ALLOWED_ORIGINS`:
```env
ALLOWED_ORIGINS=https://ваш-домен.com,chrome-extension://
```

### Порт уже занят
Если порт 3000 занят, измените в `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # внешний:внутренний
```

## Безопасность

- Используйте сильные пароли в `.env`
- Регулярно обновляйте Docker образы
- Настройте автоматические бэкапы БД
- Ограничьте доступ к админ-панели через Nginx (basic auth)
- Мониторьте логи на подозрительную активность

## Лицензия

MIT
