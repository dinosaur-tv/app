# Dino TV Home

На `https://home.dym-dino.ru` живут три поверхности:

- `/` — публичный лендинг для случайного гостя;
- `/console/` — Telegram Mini App и телефон;
- `/tv/` — экран в гостиной.

Экран поддерживает самостоятельные интерьерные, природные, городские и орнаментальные сцены: `gallery`, `home-day`, `home-evening`, `palace`, `oak-study`, `palace-study`, `night`, `play`, `forest`, `autumn-forest`, `mountains`, `sea`, `space`, `petersburg`, `petersburg-streets`, `oranienbaum`, `peterhof`, `rome`, `florence`, `venice`, `italy-sunset`, `rus`, `gzhel`, `soviet-carpet`, `byzantium`, `india` и `italy`. У каждой своя композиция, типографика и фоновое движение; весь интерфейс дополнительно сдвигается на несколько пикселей каждые 90 секунд для защиты телевизора от статичного изображения.

Для локальной визуальной проверки сцен откройте, например, `http://localhost:4173/tv/?scene=sea` — параметр работает только на `localhost`.

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
