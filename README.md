# Dino TV Home

Telegram Mini App для управления экраном. Запускается в Telegram, получает подписанный `initData` и отправляет изменения на `https://api.dym-dino.ru`.

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

Затем перезапустите backend и выполните `bash scripts/set-telegram-webhook.sh`. У бота появится кнопка **Dino TV**, а команда `/home` отправит ссылку на Mini App.
