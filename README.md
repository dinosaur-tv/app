# Dino TV Home

На `https://home.dym-dino.ru` живут две поверхности:

- `/` — Telegram Mini App и телефон: вид экрана, тема, фон, заметка, гостевой режим;
- `/tv/` — сам телевизор. Android-приложение только открывает эту страницу.

## Запуск на VPS

```bash
cp .env.example .env
docker compose -f docker-compose.traefik.yml up -d --build
```

В backend `.env` задайте:

```dotenv
MINI_APP_ORIGIN=https://home.dym-dino.ru
TELEGRAM_WEB_APP_URL=https://home.dym-dino.ru
```

Затем перезапустите backend и выполните `bash scripts/set-telegram-webhook.sh`. У бота появится кнопка **Dino TV** у поля ввода, а нижняя клавиатура скроется после `/start`.
