# Prowlarr Plugin for Lampa

![Icon](https://raw.githubusercontent.com/<ваш-username>/lampa-prowlarr-plugin/main/icon.png)

Плагин для интеграции Prowlarr с медиа-центром Lampa.

## Установка

1. В приложении Lampa:
   - Откройте Настройки → Плагины
   - Введите URL: 
     ```
     https://<ваш-username>.github.io/lampa-prowlarr-plugin/plugin.js
     ```
   - Нажмите "Добавить"

2. Настройте Prowlarr:
   ```javascript
   // В plugin.js укажите свои параметры
   this.config = {
     host: 'ваш_сервер',
     apiKey: 'ваш_ключ'
   };
   ```

## Возможности

- Поиск фильмов и сериалов
- Автоматическое обновление
- Кэширование запросов
- Поддержка магнет-ссылок

## Скриншоты

![Пример интерфейса](screenshot.jpg)

## Лицензия

MIT
