# Настройка Keitaro для работы с расширением

## Проблема
Постбэк приходит с пустым `external_id`, поэтому не сохраняется в базе.

## Решение

### 1. Настройка параметра в потоке Keitaro

В настройках потока (Campaign) в Keitaro нужно:

1. Перейти в **Поток → Настройки**
2. В разделе **Parameters** добавить параметр:
   - **Name:** `external_id` или `subid` (в зависимости от вашей настройки)
   - **Value:** `{c}` (значение из URL параметра `c`)

### 2. Настройка Postback URL

В настройках оффера добавьте postback URL:

**Вариант 1 (если используете параметр `c`):**
```
http://5.42.124.161/api/postback?external_id={c}&status={status}&offer={offer_name}&sub_id={sub_id_5}&payout={payout}
```

**Вариант 2 (если используете subid):**
```
http://5.42.124.161/api/postback?external_id={subid}&status={status}&offer={offer_name}&sub_id={sub_id_5}&payout={payout}
```

**Вариант 3 (универсальный - используйте external_id):**
```
http://5.42.124.161/api/postback?external_id={external_id}&status={status}&offer={offer_name}&sub_id={sub_id_5}&payout={payout}
```

### 3. Проверка ссылки

Ссылка, которую вы отправляете лиду, должна содержать параметр `c`:
```
https://eazyreturn.xyz/wq1SDy?c=64836768
```

Где `64836768` - это `umnico_id` (leadId) из Umnico.

### 4. Тестирование

После настройки:

1. Отправьте ссылку с параметром `c` лиду
2. Лид переходит и регистрируется
3. Keitaro отправляет постбэк с заполненным `external_id`
4. Постбэк сохраняется в базе
5. Расширение показывает постбэк

### 5. Проверка логов

Проверить, что приходит в постбэке:
```bash
tail -f /var/log/nginx/access.log | grep postback
```

Должно быть:
```
GET /api/postback?external_id=64836768&status=lead&offer=Pinko...
```

А не:
```
GET /api/postback?external_id=&status=lead&offer=Pinko...
```

---

## Альтернативное решение

Если в Keitaro сложно настроить `external_id`, можно использовать другой параметр, который Keitaro уже передает.

Посмотрите, какие параметры доступны в Keitaro:
- `{click_id}` - ID клика
- `{sub_id_1}` до `{sub_id_10}` - дополнительные параметры
- `{campaign_id}` - ID кампании

Можно передавать `leadId` через один из `sub_id` параметров и настроить бэкенд соответственно.
