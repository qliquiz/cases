# Telegram Mini App: проверка личности

Исследование от 25 сентября 2026 года. Реализация: `src/game/telegram-auth.ts`, `src/app/actions.ts`, `src/server/session.ts`.

## Проверенные факты

- Mini App передаёт исходную строку `Telegram.WebApp.initData`; объект `initDataUnsafe` нельзя считать доказательством личности без серверной проверки. [Документация Telegram](https://core.telegram.org/bots/webapps#initializing-mini-apps)
- Для проверки бот-токеном нужно исключить `hash`, отсортировать пары `key=value` по ключу, соединить через перевод строки; ключ проверки — HMAC-SHA-256 от токена с ключом `WebAppData`, затем HMAC-SHA-256 от строки данных с этим ключом. Полученный hex сравнивается с `hash`. `auth_date` содержит время аутентификации. [Документация Telegram](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- `user` в `WebAppInitData` необязателен. Его ID помещается в безопасный диапазон целых чисел JavaScript, но использовать ID можно только после проверки всей `initData`. [Тип WebAppInitData](https://core.telegram.org/bots/webapps#webappinitdata)
- Server Action доступна по POST и должна сама проверять подлинность пользователя и входные данные. [Документация Next.js](https://nextjs.org/docs/app/guides/server-actions#security)
- Переменные без префикса `NEXT_PUBLIC_` остаются на сервере; токен бота нельзя класть в клиентский bundle. [Документация Next.js](https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser)

## Принятое решение

Сервер принимает сырую `initData`, отклоняет дублирующиеся ключи, проверяет HMAC сравнением без утечки времени, возраст до одного часа и будущие timestamps с допуском 60 секунд. Затем выдаёт случайную HttpOnly-сессию на 30 дней; в PostgreSQL хранится только SHA-256 хеш её токена. Каждое открытие получает пользователя из этой сессии. Без действующей сессии или проверенной `initData` открытие недоступно.

Один час и 30 дней — продуктовые настройки проекта, не лимиты Telegram. `initData` можно повторно использовать в пределах этого окна; HMAC не делает запрос одноразовым. Поле `signature` относится к отдельному алгоритму проверки третьей стороной; его правила не следует смешивать с проверкой бот-токеном. [Алгоритмы Telegram](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
