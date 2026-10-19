# API приёма записей

Версия 0.1 · базовый префикс `/api/v1` · JSON в UTF-8, время — миллисекунды эпохи или ISO 8601.

Сайт — общая точка сбора: Android и Mac присылают метаданные и аудио, кабинет и защищённые ссылки
показывают результат. Аудио в API не публикуется: снаружи оно доступно только по ссылке с паролем,
а внутри — владельцу по cookie.

## Авторизация

Все методы, кроме `GET /health`, требуют заголовок:

```http
Authorization: Bearer <INGEST_TOKEN>
```

Токен задаётся переменной `INGEST_TOKEN` на сервере. Неверный токен — `401 unauthorized`, токен не
задан — `503 not_configured`.

## Поток

```text
1. PUT /api/v1/recordings/{client_id}          метаданные (JSON)
2. PUT /api/v1/recordings/{client_id}/audio    аудио (raw body, поток)
3. GET /api/v1/recordings/{client_id}          проверка / восстановление
```

`client_id` — постоянный id записи в приложении: латиница, цифры и `._:-`, до 100 символов.
Повторная отправка с тем же `client_id` обновляет запись, а не создаёт дубль. Если запись уже есть
на сайте, метаданные можно присылать позже ещё раз — например, после появления отчёта.

Аудио загружается **после** метаданных: если записи нет, будет `404`.

## 1. Метаданные

`PUT /api/v1/recordings/{client_id}`, `Content-Type: application/json`, тело до 6 МБ.

```json
{
  "schema": 1,
  "source_name": "2026-09-13 11-04 встреча.m4a",
  "kind": "meeting",
  "recorded_at_ms": 1790000000000,
  "duration_s": 2060.4,
  "origin_device": "SM-S938B",
  "model": "grok-voice-transcribe-2.0",
  "title": "Планёрка по релизу",
  "tags": ["релиз", "команда"],
  "speaker_names": { "Спикер 1": "Михаил", "Спикер 2": "Анна" },
  "speaker_overrides": { "3": "Спикер 2" },
  "transcript": {
    "id": "6f1c0b9e2d7a4c1e9a3b5d8f0e2c4a6b",
    "text": "Коллеги, начинаем. Первый вопрос — сроки релиза.",
    "duration_s": 2060.4,
    "model": "grok-voice-transcribe-2.0",
    "language": "ru",
    "segments": [
      { "start": 0.0, "end": 6.4, "speaker": "Спикер 1", "text": "Коллеги, начинаем." },
      { "start": 6.4, "end": 14.1, "speaker": "Спикер 2", "text": "Первый вопрос — сроки релиза." }
    ]
  },
  "report": {
    "title": "Планёрка по релизу",
    "summary": ["Релиз назначен на 20 сентября."],
    "decisions": ["Ссылки с паролем входят в первый выпуск."],
    "tasks": [
      { "title": "Подготовить чек-лист", "assignee": "Анна", "due": "18 сентября" }
    ],
    "markdown": "## Договорённости\n\n- Релиз 20 сентября.",
    "model": "claude-sonnet"
  },
  "marks": [{ "start": 65.2, "end": 70.0 }],
  "hints": [
    {
      "key": "release-date",
      "kind": "decision",
      "start": 18.0,
      "end": 25.0,
      "text": "Зафиксирована дата релиза.",
      "quote": "Предлагаю релиз двадцатого сентября.",
      "mark": false
    }
  ],
  "updated_at_ms": 1790000001000
}
```

### Поля

| Поле | Тип | Что это |
|---|---|---|
| `source_name` | строка | Исходное имя файла; используется как запасное название |
| `kind` | `meeting` \| `online_call` \| `phone_call` | Вид записи; по умолчанию `meeting` |
| `source` | `meeting` \| `call` | Старый вариант; `call` → `phone_call`, если нет `kind` |
| `recorded_at_ms` | число | Начало записи, мс эпохи |
| `recorded_at` | ISO 8601 | Альтернатива `recorded_at_ms` |
| `duration_s` | число | Длительность; если не прислать, определится по аудио |
| `origin_device` | строка | Модель устройства, видна в кабинете |
| `model` | строка | Модель расшифровки |
| `title` | строка | Умное название; если нет — `report.title`, имя файла или «Запись» |
| `tags` | массив строк | **Названия тегов**, не id каталога |
| `tag_titles` | объект | Если приложение хранит id: `{ "tag-1": "релиз" }` |
| `speaker_names` | объект | «Спикер 1» → имя, которое дал пользователь |
| `speaker_overrides` | объект | Индекс фразы (строка) → метка говорящего |
| `transcript` | объект | Текст, фразы, модель, язык; `chunks` не обязательны |
| `report` | объект | `title`, `summary`, `decisions`, `tasks`, `markdown`, `tags` |
| `marks` | массив | `{ start, end }` в секундах; подсвечиваются в плеере и тексте |
| `hints` | массив | Подсказки ассистента встречи |
| `updated_at_ms` | число | Время правки на устройстве; см. ниже |
| `deleted` | boolean | Удаление; предпочтительнее `DELETE` |

Теги: сайт показывает `tags` как есть, поэтому приложению стоит отправлять названия. Если присылать
id вместе с `tag_titles`, сайт подставит названия. `report.tags` тоже участвуют в выборе, но в
интерфейсе отображаются общие теги записи.

`transcript.text` можно не присылать, если есть `segments`: текст склеится из фраз. `end` у фразы
необязателен — по умолчанию равен `start`.

### Ответ

`201` — запись создана, `200` — обновлена.

```json
{
  "ok": true,
  "id": "rec_20260913_1104_7f3a",
  "created": true,
  "skipped": false,
  "updated_at_ms": 1790000001000,
  "title": "Планёрка по релизу",
  "audio_upload_url": "https://voice.km0xrl.com/api/v1/recordings/rec_20260913_1104_7f3a/audio"
}
```

`skipped: true` — на сайте уже более новая версия (по `updated_at_ms`), присланная не применена.
Это защищает правки, сделанные позже на другом устройстве или в кабинете.

### Правило `updated_at_ms`

Побеждает последняя правка. Если у сайта `updated_at_ms` больше присланного, документ не
перезаписывается и возвращается `skipped: true`. Приложение должно присылать текущее время правки,
а не время записи. Повтор с тем же временем принимается.

## 2. Аудио

`PUT /api/v1/recordings/{client_id}/audio?name=meeting.m4a`

| Заголовок | Обязателен | Что это |
|---|---|---|
| `Content-Type` | желательно | `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `video/mp4`… |
| `Content-Length` | желательно | Позволяет сразу отклонить слишком большой файл |
| `X-Sha256` | нет | Hex SHA-256; при расхождении — `400 sha_mismatch` |
| `X-File-Name` | нет | Имя файла, если не передан `?name=` |

Тело — сам файл, без multipart. Поддерживаются m4a/mp4, mp3, ogg/opus, wav, webm, amr/3gp, aac,
flac, caf. Формат определяется по первым байтам, а не по расширению. Лимит — `MAX_AUDIO_BYTES`
(по умолчанию 500 МБ). Длительность извлекается автоматически, если не была прислана.

Повторная загрузка заменяет прежний файл; тот же файл с тем же содержимым можно присылать
повторно. Аудио хранится в `DATA_DIR/audio/<internal-id>/<sha256>.<ext>`.

Ответ:

```json
{
  "ok": true,
  "id": "rec_20260913_1104_7f3a",
  "audio": {
    "size": 28415332,
    "mime": "audio/mp4",
    "sha256": "9b1d…",
    "duration_s": 2060.2
  }
}
```

Удалить аудио, оставив текст и отчёт: `DELETE .../audio`.

## 3. Чтение

`GET /api/v1/recordings/{client_id}` → документ записи в форме библиотеки:

```json
{
  "schema": 1,
  "id": "rec_20260913_1104_7f3a",
  "source_name": "2026-09-13 11-04 встреча.m4a",
  "kind": "meeting",
  "recorded_at_ms": 1790000000000,
  "duration_s": 2060.4,
  "origin_device": "SM-S938B",
  "model": "grok-voice-transcribe-2.0",
  "title": "Планёрка по релизу",
  "tags": ["релиз", "команда"],
  "speaker_names": { "Спикер 1": "Михаил" },
  "speaker_overrides": {},
  "transcript": { "…": "…" },
  "report": { "…": "…" },
  "marks": [],
  "hints": [],
  "updated_at_ms": 1790000001000,
  "deleted": false,
  "audio": { "uploaded": true, "size": 28415332, "mime": "audio/mp4", "sha256": "9b1d…" }
}
```

`GET /api/v1/recordings?since=<ms>&limit=100` — изменения после `since` по возрастанию
`updated_at_ms`, включая надгробия `deleted: true`.

```json
{
  "items": [
    {
      "id": "rec_20260913_1104_7f3a",
      "title": "Планёрка по релизу",
      "kind": "meeting",
      "recorded_at_ms": 1790000000000,
      "duration_s": 2060.4,
      "updated_at_ms": 1790000001000,
      "deleted": false,
      "has_audio": true,
      "has_transcript": true,
      "has_report": true
    }
  ],
  "next": 1790000001000,
  "more": false
}
```

Для следующего запроса передавайте `since=next`.

## 4. Удаление

`DELETE /api/v1/recordings/{client_id}` — мягкое удаление: запись исчезает из кабинета и ссылок,
аудио удаляется с тома. Повторное создание с тем же `client_id` восстанавливает запись.

```json
{ "ok": true, "id": "rec_20260913_1104_7f3a", "deleted": true }
```

## 5. Ошибки

| Код | `error.code` | Когда |
|---|---|---|
| `400` | `bad_client_id` | id не по шаблону |
| `400` | `bad_json` | тело не JSON |
| `400` | `bad_request` | не прошла валидация полей |
| `400` | `sha_mismatch` | `X-Sha256` не совпал |
| `401` | `unauthorized` | нет или неверный Bearer |
| `404` | `not_found` | записи нет (в т. ч. аудио до метаданных) |
| `409` | `deleted` | запись удалена |
| `413` | `too_large` | JSON или файл больше лимита |
| `415` | `unsupported` | не распознан аудиоформат |
| `415` | `bad_content_type` | метаданные не `application/json` |
| `503` | `not_configured` | на сервере нет `INGEST_TOKEN` |

Формат ошибки:

```json
{ "error": { "code": "bad_request", "message": "tags: Ожидается массив" } }
```

## 6. Здоровье

`GET /api/v1/health` — без токена:

```json
{
  "ok": true,
  "service": "airecorder-web",
  "version": "0.1.0",
  "time": "2026-09-13T08:00:00.000Z",
  "features": { "ingest": true, "audio": true, "transcript": true, "report": true, "pdf": true, "share": true }
}
```

## 7. Что пока не в API

- Создание и отзыв ссылок с паролем — только в кабинете владельца. Для автоматизации появится
  отдельный owner-API.
- Двусторонняя синхронизация: сайт принимает правки и отдаёт их через `GET`, но приложения пока
  не опрашивают сайт. Следующий шаг — добавить веб-адрес в настройки приложения и слить библиотеку
  по тому же правилу `updated_at_ms`.
- Транскодирование, HLS и DRM. Аудио отдаётся как есть; прослушивание идёт через `Range`.
