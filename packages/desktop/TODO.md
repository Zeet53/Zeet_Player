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
| Переключение YM↔YT | Кнопка YM (жёлтый) / YT (красный) |
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
| Меню настроек (⚙) | Overlay: Batch Size, Refill Threshold, Match лимиты, путь скачивания, выход из аккаунта. Reset/Cancel/Save |
| Хранение ручных матчей | `matches.json` в `configs/`. При ручном выборе YT-трека сохраняется пара artist:title→ytVideoId. При загрузке трека сначала проверяются сохранённые матчи. Автоматические матчи не сохраняются |
| Скачивание треков | Кнопка ⬇ в плеере. Если папка не задана — диалог выбора (сохраняется как основная). Если задана — сразу качает. Сохраняется как `.mp3` (фактически mp4) |
| Поиск кандидатов для матчинга | Fallback через `item.overlay.content.endpoint.payload.videoId` при пустом `item.id`. Поиск лимит 9, показ 9 |
| Рефакторинг компонентов | Логика вынесена в хуки (`usePlayer`, `useAuth`), UI в экраны (`PlayerScreen`, `LoginScreen` и т.д.), CSS разбит по компонентам. App.tsx — только композиция |

## ❌ Осталось

| № | Функция | Приоритет | Что нужно |
|---|---------|-----------|-----------|
| 1 | **Лайкнутые треки** | Средний | Список лайкнутых из YM с авто-резолвом в YT, клик → волна по треку. `getLikedTracks()` в core готов |
| 2 | **Last.fm интеграция** | Средний | Вход в аккаунт Last.fm. Scrobbling прослушанных треков. Отображение жанра у текущего трека. Страница со статистикой жанров |
| 3 | **Плейлисты UI** | Низкий | Создание/добавление/сохранение/просмотр плейлистов в UI |
| 4 | **Смена иконки приложения** | Средний | Заменить дефолтную Electron-иконку на свою. Нужен `.ico` для Windows |
| 5 | **Обновление дизайна** | Низкий | Переработать визуальный стиль плеера |
| 6 | **Физический матчинг** | Средний | ✅ UI: кнопка "Локальный файл..." в меню матчинга (≡), окно с выбором файла/обложки, полями названия/исполнителя. Бэкенд: `PhysicalMatchStore`, IPC `physical:pickAudio/Cover/Save/Delete/List/GetForTrack`. **Осталось:** интеграция с `resolveTrack()` в core, валидация файлов при загрузке (проверка существования, удаление битых записей) |
| 7 | **Окно с логами приложения** | Средний | Вывод всех `console.log` из renderer + main process в отдельное окно (Ctrl+L) для отладки ошибок без открытия DevTools. Нужен IPC `log` (уже есть), буфер логов в main process, Electron BrowserWindow или in-app overlay |

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
4. ✅ **IPC** — `physical:pickAudio/Cover` (диалоги выбора), `physical:save` (копирование + сохранение), `physical:delete`, `physical:list`, `physical:getForTrack`
5. ✅ **UI** — кнопка "📁 Локальный файл..." в меню матчинга (≡), окно с полями (аудиофайл, название, исполнитель, обложка), авто-заполнение из существующего матча
6. ❌ **Валидация** — при загрузке `physical-matches.json` проверять существование файлов, битые записи удалять

## IPC-каналы

- `queue:search` — поиск + резолв через `YtRadioQueue.searchAndResolve()`
- `queue:selectSearchTrack` — старт волны по выбранному треку
- `queue:trackRadio` — `YtRadioQueue.startTrackRadio()` по текущему треку
- `queue:getLikedTracks` — лайкнутые с YT
- `config:get` — полный конфиг
- `config:setVolume` — сохранить громкость
- `config:setWaveSettings` — сохранить настройки волны
- `config:setPlayerSettings` — сохранить batchSize/refillThreshold/match лимиты
- `config:openFolderDialog` — нативный выбор папки
- `config:reset` — сброс конфига до дефолтов
- `config:saveAll` — сохранить все настройки и применить к очереди
- `queue:downloadTrack` — скачать текущий трек (с диалогом папки если не задана)
- `ym:logout` — выход из аккаунта (чистит secrets.json)
- `ym:restoreSession` — восстановление сессии по токену из secrets.json
- `physical:pickAudio` — диалог выбора аудиофайла (возвращает путь + имя файла)
- `physical:pickCover` — диалог выбора изображения для обложки
- `physical:save` — копирование в `media/` + запись в `physical-matches.json`
- `physical:delete` — удаление записи из `physical-matches.json` (файл остаётся)
- `physical:list` — список всех физических матчей
- `physical:getForTrack` — получить матч по artist:title