# Desktop: Реализованные функции

## ✅ Готово

| Функция | Описание |
|---------|----------|
| Пинг YM + YT | `api.ping()` — проверка доступности |
| Авторизация YM OAuth | Браузерное окно oauth.yandex.ru |
| Инициализация очереди | Авто при старте |
| Forward с фидбеком | trackFinished/skip при окончании/скипе |
| Back | ⏮ кнопка |
| Play/pause | ▶/⏸ встроенный Audio |
| Seek | Ползунок + отображение времени |
| Volume | Ползунок + кнопки ±1% + проценты |
| Переключение YM↔YT | Кнопка с сохранением режима в конфиг |
| Лог ссылки YT | В консоль при старте трека |
| Auto-refill очереди | Фоновый prefetch |
| Ручной матчинг (≡) | Overlay с кандидатами (song + video), предпросмотр, выбор |
| Скоринг кандидатов | title=150 + artist=50, titleScore===0 → отсев других треков артиста |
| Like / Dislike | Кнопки с отображением статуса из YM API |
| Настройки волны (~) | Меню с выбором Mood/Energy, Diversity, Language |
| Волна по треку (↻) | Кнопка запуска радио по текущему треку |
| Статус-бар волны | Отображение текущего режима + ✕ сброс |
| Сборка EXE | Electron Forge + Squirrel, установщик ZeetPlayer-Setup.exe |
| Поиск (строка в хедере) | Поиск YM треков с авто-резолвом в YT, клик → волна по треку |
| Хранение конфигов | `config.json` + `secrets.json` в `%APPDATA%/Zeet Player/configs/`: настройки отдельно от токенов |
| Разделение конфига | `ConfigManager` (config.json) + `SecretsManager` (secrets.json). Токены не попадают в config |
| Меню настроек (⚙) | Overlay: player config, window size, theme colors, download path, logout |
| Хранение ручных матчей | `matches.json` в `configs/`. При ручном выборе YT-трека сохраняется пара artist:title→ytVideoId |
| Скачивание треков | Кнопка ⬇ в плеере. Если папка не задана — диалог выбора |
| Поиск кандидатов для матчинга | Fallback через `item.overlay.content.endpoint.payload.videoId` при пустом `item.id` |
| Рефакторинг компонентов | Логика в хуках, UI в экранах, CSS по компонентам |
| Физический матчинг — бэкенд | `PhysicalMatchStore`, медиа-папка, все IPC (pickAudio/Cover/Save/Delete/List/GetForTrack/ReadFile) |
| Физический матчинг — UI | `PhysicalMatchMenu.tsx` с выбором файла, обложки, полями названия/исполнителя |
| Тема оформления (3 цвета) | `ThemeColors` (accent/surface/bg) в конфиге, hex-поля в настройках, CSS-переменные |
| Размер окна | Ширина/высота в конфиге, поля ввода в настройках, применяется сразу |
| Auto-resize | Сохранение размера окна при ресайзе (с дебаунсом) |
| Display mode persistence | Состояние YM/YT сохраняется в конфиг, восстанавливается при старте |
| Редизайн PlayerScreen.css | Все цвета через CSS-переменные, фикс seek-bar, фикс кнопок, Firefox-стили |
| Валидация физических файлов | `PhysicalMatchStore.load()` проверяет существование файлов, битые записи удаляются |
| Окно логов (Ctrl+L) | BrowserWindow с буфером логов, Copy All, автообновление, подсветка ошибок |
| Глобальный Ctrl+L | Работает на любом экране приложения (пинг, логин, загрузка, плеер) |

## ❌ Осталось

| № | Функция | Приоритет | Что нужно | Статус |
|---|---------|-----------|-----------|--------|
| 1 | **Лайкнутые треки** | Средний | Список лайкнутых из YM с авто-резолвом в YT, клик → волна по треку. `getLikedTracks()` в core готов | ❌ Не начато (IPC + UI + hook) |
| 2 | **Last.fm интеграция** | Средний | Вход в аккаунт, scrobbling, жанр трека, статистика | ❌ Не начато |
| 3 | **Плейлисты UI** | Низкий | Создание/добавление/сохранение/просмотр плейлистов | ❌ Не начато |
| 4 | **Смена иконки приложения** | Средний | Заменить дефолтную Electron-иконку на свою. `.ico` для Windows + `forge.config.js` | ❌ Не начато |
| 5 | **Обновление дизайна** | Низкий | Переработать визуальный стиль плеера | ✅ Частично (тема + цвета) |
| 6 | **Физический матчинг — финал** | Средний | Добить два пункта | ⏳ См. план ниже (валидация ✅) |
| 7 | **Окно с логами (Ctrl+L)** | Средний | Вывод логов в отдельное окно для отладки без DevTools | ✅ Готово — BrowserWindow с буфером, Copy All, автообновление |

## Last.fm план (#2)

1. **API-клиент** — `lastfm/client.ts` в core. Методы: `auth.getMobileSession`, `track.getInfo`, `track.scrobble`, `user.getTopTags`, `user.getTopArtists`
2. **Вход** — кнопка в меню настроек (⚙), браузерное окно/API-ключ, сохранение session key в `secrets.json` (`lastfm.sessionKey`)
3. **Жанр трека** — при старте трека запрашиваем `track.getInfo` по artist + title, показываем `toptags[0].name` под названием
4. **Scrobbling** — при `trackFinished` (или после 50% длительности) отправляем `track.scrobble` с artist, title, timestamp
5. **Страница статистики** — кнопка в хедере, overlay с топ-жанрами из `user.getTopTags` и `user.getTopArtists`

## Физический матчинг план (#6)

1. ✅ **Хранилище** — `PhysicalMatchStore` в `config.ts`, файл `physical-matches.json` в `configs/`
2. ✅ **Медиа-папка** — `%APPDATA%/Zeet Player/media/`, куда копируются загружаемые файлы
3. ❌ **Core** — в `resolveTrack()` проверяется физический матч по key `artist:title` перед YT-поиском
4. ✅ **IPC** — `physical:pickAudio/Cover/Save/Delete/List/GetForTrack/ReadFile`
5. ✅ **UI** — `PhysicalMatchMenu.tsx` с полями (аудиофайл, название, исполнитель, обложка)
6. ✅ **Валидация** — при загрузке `physical-matches.json` проверять существование файлов, битые записи удалять

## IPC-каналы

- `queue:search` — поиск + резолв через `YtRadioQueue.searchAndResolve()`
- `queue:selectSearchTrack` — старт волны по выбранному треку
- `queue:trackRadio` — `YtRadioQueue.startTrackRadio()` по текущему треку
- `queue:like/dislike/unlike/undislike/feedbackStatus` — лайки
- `config:get` — полный конфиг
- `config:setVolume` — сохранить громкость
- `config:setWaveSettings` — сохранить настройки волны
- `config:setPlayerSettings` — сохранить batchSize/refillThreshold/match лимиты
- `config:setDisplayMode` — сохранить режим YM/YT
- `config:setWindowSize` — сохранить размер окна
- `config:setAutoResize` — сохранить авто-ресайз
- `config:setTheme` — сохранить тему оформления
- `config:openFolderDialog` — нативный выбор папки
- `config:reset` — сброс конфига до дефолтов
- `config:saveAll` — сохранить все настройки и применить к очереди
- `queue:downloadTrack` — скачать текущий трек
- `ym:logout` — выход из аккаунта
- `ym:restoreSession` — восстановление сессии по токену
- `physical:pickAudio` — диалог выбора аудиофайла
- `physical:pickCover` — диалог выбора изображения
- `physical:save` — копирование в `media/` + запись в `physical-matches.json`
- `physical:delete` — удаление записи
- `physical:list` — список всех физических матчей
- `physical:getForTrack` — получить матч по artist:title
- `physical:readFile` — прочитать файл для отправки в renderer
- `app:log` — пересылка console.log из renderer в main process
- `log:getBuffer` — получить буфер логов
- `log:openWindow` — открыть окно логов
