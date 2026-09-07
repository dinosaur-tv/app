# Dino TV Home

На `https://home.dym-dino.ru` живут три поверхности:

- `/` — публичный лендинг для случайного гостя;
- `/console/` — Telegram Mini App и телефон;
- `/tv/` — экран в гостиной.

В BotFather в поле Mini App вставляйте только:

```text
https://home.dym-dino.ru/console/
```

## Запуск на VPS

```bash
cp .env.example .env
docker compose -f docker-compose.traefik.yml up -d --build
```

В backend `.env`:

```dotenv
MINI_APP_ORIGIN=https://home.dym-dino.ru
TELEGRAM_WEB_APP_URL=https://home.dym-dino.ru/console/
```
