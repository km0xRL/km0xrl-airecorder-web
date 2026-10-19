# Состояние деплоя

Дата: 19 октября 2026. Railway, проект `km0xrl-airecorder-web`, сервис того же имени,
регион `sfo`, volume `km0xrl-airecorder-web-volume` в `/data`.

## Адреса

| Что | Адрес |
|---|---|
| Рабочий Railway-адрес | https://km0xrl-airecorder-web-production.up.railway.app |
| Публичный домен | https://recorder.km0xrl.com — ждёт DNS-записи |
| Health | `/health` и `/api/v1/health` |
| Сценарий в интерфейсе | `/help` |
| Настройки и токен приёма | `/settings` |

Владелец и пароль — в локальном `.deploy.local` (не коммитится). В Railway заданы
`OWNER_PASSWORD_HASH`, `SESSION_SECRET`, `INGEST_TOKEN`, `PUBLIC_BASE_URL=https://recorder.km0xrl.com`,
`DATA_DIR=/data`.

## DNS для recorder.km0xrl.com

Добавить в GoDaddy (зона `km0xrl.com`):

| Тип | Имя | Значение |
|---|---|---|
| CNAME | `recorder` | `f17d252f.up.railway.app` |
| TXT | `_railway-verify.recorder` | `railway-verify=f8c0d70ed1b4202a24f87f3c6135710125bb363d11be2b83d0563e5741d002de` |

После добавления Railway сам выпустит сертификат. Проверить:
`railway domain status recorder.km0xrl.com --json` и `curl https://recorder.km0xrl.com/health`.
Пока DNS нет, сайт и вход работают по Railway-адресу; приложения собраны с адресом
`https://recorder.km0xrl.com` и начнут синхронизацию после появления DNS.

## Приложения

Артефакты лежат в `dist/` (в git не входят):

- `dist/airecorder-0.12.0-web-sync.apk` — Android, вшиты `TRANSCRIBE_TOKEN`, `WEB_SYNC_URL`,
  `WEB_SYNC_TOKEN`. Адрес и токен сайта можно менять в «Настройках» → «Синхронизация».
- `dist/AIRecorder-0.2.0-web-sync.zip` — macOS, вшиты `AIRTranscribeToken`, `AIRWebSyncURL`,
  `AIRWebSyncToken`; распаковать и запустить `AIRecorder.app`.

Исходники приложений изменены в их репозиториях (ветки: Android `feature/live-transcribe`,
Mac `main`). Сборка с токенами:

```bash
# Android
TRANSCRIBE_TOKEN=… WEB_SYNC_TOKEN=… gradle :app:assembleDebug
# macOS
TRANSCRIBE_TOKEN=… WEB_SYNC_TOKEN=… Scripts/bundle.sh
```

## Синхронизация

- `GET /v1/library?since=<seq>&limit=<n>` — изменения, `seq`, надгробия.
- `PUT /v1/library/{id}` — версия из приложения, `409 stale` при более новой версии на сайте.
- `PUT /api/v1/recordings/{id}/audio` — аудио отдельным запросом.
- Побеждает последняя правка по `updated_at_ms`; удаления — надгробия.
- Аудио хранится на сайте и отдаётся в плеере и ссылках. На другом устройстве без локального
  аудио запись показывается текстом и отчётом (плеер с аудио сайта — следующий этап).
- Демо-данные в production не загружались: volume пустой, кабинет пуст.

## Ограничения текущего этапа

- Пока нет DNS для `recorder.km0xrl.com`; используется Railway-адрес.
- Нет смены пароля владельца из интерфейса: меняется в Railway (`OWNER_PASSWORD_HASH`).
- Нет транскодирования, докачки больших файлов, бэкапов/CI/E2E/нагрузки — по договорённости позже.
- Удаление на сайте убирает текст/отчёт на Mac, но аудио на Mac остаётся (защита от потери).
