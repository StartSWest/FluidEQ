/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The Karaoke tab, its player and the Maker. */
import { Dictionary } from '../en';

const karaoke: Partial<Dictionary> = {
  'karaoke.eyebrow': 'ЛОКАЛЬНОЕ КАРАОКЕ',
  'karaoke.title': 'Сцена, созданная для вашей музыки',
  'karaoke.intro':
    'Здесь будут объединены песни, синхронизированные тексты, мониторинг микрофона и контроль высоты тона — полностью локально на вашем ПК.',
  'karaoke.fullscreen.enter': 'Перейти в полноэкранный режим',
  'karaoke.fullscreen.exit': 'Выйти из полноэкранного режима',
  'karaoke.fullscreen.hideHeader': 'Скрыть панель FluidEQ',
  'karaoke.fullscreen.showHeader': 'Показать панель FluidEQ',
  'karaoke.actions': 'Действия караоке',
  'karaoke.readiness.resize': 'Изменить размер панелей микрофона и высоты тона',
  'karaoke.empty.title': 'Ваша сцена готова',
  'karaoke.empty.body':
    'Откройте аудио с необязательными текстами или добавьте целую папку. FluidEQ связывает одноимённые файлы в плейлист.',
  'karaoke.import.pending': 'Далее: импорт песен',
  'karaoke.import.open': 'Открыть песню',
  'karaoke.import.replace': 'Заменить песню',
  'karaoke.import.addFiles': 'Добавить файлы',
  'karaoke.import.folder': 'Добавить папку',
  'karaoke.import.clear': 'Убрать',
  'karaoke.import.loading': 'Подготовка песни…',
  'karaoke.import.formats':
    'Аудио: MP3, WAV, OGG, Opus, FLAC, M4A или AAC · Текст: LRC, eLRC или UltraStar TXT · Обложку и видео тоже можно добавить',
  'karaoke.import.drop': 'Перетащите сюда песни, тексты или папки',
  'karaoke.error.missingAudio':
    'Добавьте аудиофайл вместе с этим файлом текста.',
  'karaoke.error.ambiguous':
    'Возможно несколько сочетаний. Выберите один аудиофайл и, при желании, один файл текста.',
  'karaoke.error.unsupported':
    'Среди этих файлов пока нет поддерживаемого аудио или текста Karaoke. Обложке и видео нужна песня рядом с ними.',
  'karaoke.error.read': 'FluidEQ не смог прочитать выбранные локальные файлы.',
  'karaoke.error.playback':
    'Эта сборка Chromium не смогла воспроизвести аудиофайл или кодек.',
  'karaoke.warning.lyrics': 'не удалось разобрать.',
  'karaoke.warning.lyricsEmpty': 'пуст.',
  'karaoke.warning.lyricsMissingTiming':
    'не содержит таймингов, которые FluidEQ смог бы прочитать.',
  'karaoke.warning.lyricsMissingBpm':
    'не указывает BPM, который нужен файлу UltraStar.',
  'karaoke.warning.lyricsInvalidBpm':
    'указывает BPM, который не является пригодным числом.',
  'karaoke.warning.lyricsMalformedNote':
    'содержит строку ноты, которую FluidEQ не смог прочитать.',
  'karaoke.warning.lyricsUnsupportedVariant':
    'использует вариант караоке, который FluidEQ пока не умеет петь, например дуэт.',
  'karaoke.warning.lyricsAtLine': 'Строка {line}.',
  'karaoke.warning.lyricsAudioIntact':
    'Аудио останется доступно без синхронного текста.',
  'karaoke.warning.setAside':
    'FluidEQ пока не умеет читать эти файлы как караоке, поэтому отложил их: {formats}.',
  'karaoke.warning.unpairedLyrics':
    'Ни один аудиофайл не подходит к этим файлам с текстом, поэтому они не использованы: {files}.',
  'karaoke.warning.ambiguousLyrics':
    'Два файла с текстом подошли к одной песне, поэтому не использован ни один: {files}.',
  'karaoke.warning.andMore': 'и ещё {count}',
  'karaoke.countdown.sing': 'Пой',
  'karaoke.song.unknownArtist': 'Локальная песня',
  'karaoke.stage.videoUnsupported': 'Видео {format} здесь воспроизвести нельзя',
  'karaoke.stage.videoFailed': 'Видео {format} здесь не удалось декодировать',
  'karaoke.stage.hideArt': 'Скрыть обложку',
  'karaoke.stage.showArt': 'Показать обложку',
  'karaoke.stage.noArt': 'У этой песни нет обложки',
  'karaoke.playlist.title': 'Плейлист',
  'karaoke.playlist.groupFolders': 'Группировать по папкам',
  'karaoke.playlist.looseFiles': 'Файлы без папки',
  'karaoke.playlist.resize': 'Изменить размер плейлиста и сцены',
  'karaoke.playlist.collapse': 'Свернуть плейлист',
  'karaoke.playlist.expand': 'Развернуть плейлист',
  'karaoke.playlist.select': 'Выбрать {title}',
  'karaoke.playlist.moveUp': 'Переместить {title} вверх',
  'karaoke.playlist.moveDown': 'Переместить {title} вниз',
  'karaoke.playlist.remove': 'Удалить {title}',
  'karaoke.source.audioOnly': 'Только аудио',
  'karaoke.source.lrc': 'LRC · по строкам',
  'karaoke.source.elrc': 'eLRC · по словам',
  'karaoke.source.ultrastar': 'UltraStar · слоги + высота',
  'karaoke.lyrics.none':
    'Синхронный текст не выбран. Воспроизведение и тюнер остаются доступными.',
  'karaoke.lyrics.line': 'Строка текста {number}',
  'karaoke.lyrics.previous': 'Предыдущая строка',
  'karaoke.lyrics.next': 'Следующая строка',
  'karaoke.lyrics.follow': 'Следить за текстом',
  'karaoke.lyrics.textSize': 'Размер текста песни',
  'karaoke.transport.title': 'Управление воспроизведением Karaoke',
  'karaoke.transport.restart': 'Начать песню заново',
  'karaoke.transport.play': 'Воспроизвести',
  'karaoke.transport.pause': 'Пауза',
  'karaoke.transport.spaceShortcut': '{action} · Пробел',
  'karaoke.transport.seek': 'Позиция песни',
  'karaoke.transport.volume': 'Громкость',
  'karaoke.transport.vocalLevel': 'Направляющий вокал',
  'karaoke.transport.vocalOff': 'Только минус',
  'karaoke.transport.vocalFull': 'Оригинал',
  'karaoke.transport.mixSettings': 'Настройки микса',
  'karaoke.transport.openMixSettings': 'Открыть настройки микса для {channel}',
  'karaoke.mic.title': 'Микрофон',
  'karaoke.mic.settings': 'Настройки микрофона',
  'karaoke.mic.off': 'Выкл.',
  'karaoke.mic.hint':
    'Выберите вход. FluidEQ запросит доступ к микрофону только после его включения.',
  'karaoke.mic.select': 'Вход микрофона',
  'karaoke.mic.default': 'Системный по умолчанию',
  'karaoke.mic.unnamed': 'Микрофон {number}',
  'karaoke.mic.turnOn': 'Включить микрофон',
  'karaoke.mic.turnOff': 'Выключить микрофон',
  'karaoke.mic.requesting': 'Подключение…',
  'karaoke.mic.live': 'Активен',
  'karaoke.mic.denied': 'Доступ запрещён',
  'karaoke.mic.unavailable': 'Нет микрофона',
  'karaoke.mic.disconnected': 'Отключён',
  'karaoke.mic.error': 'Не удалось запустить',
  'karaoke.mic.level': 'Уровень входа микрофона',
  'karaoke.mic.levelValue': 'Уровень входа микрофона: {percent} %',
  'karaoke.mic.privacy':
    'Только локальный анализ уровня и высоты тона. FluidEQ не записывает микрофон и не выводит его на динамики.',
  'karaoke.mic.volume': 'Громкость микрофона',
  'karaoke.mic.volumeValue': 'Громкость микрофона: {percent}%',
  'karaoke.pitch.title': 'Линия высоты тона',
  'karaoke.pitch.resize': 'Изменить размер линии высоты тона',
  'karaoke.pitch.show': 'Показать направляющую высоты тона',
  'karaoke.pitch.hide': 'Скрыть направляющую высоты тона',
  'karaoke.pitch.guide': 'Мелодический ориентир',
  'karaoke.pitch.toneGuide': 'Тон мелодии',
  'karaoke.pitch.toneEnable': 'Воспроизвести мелодию тоном',
  'karaoke.pitch.toneDisable': 'Остановить тон мелодии',
  'karaoke.pitch.toneVolume': 'Громкость тона мелодии',
  'karaoke.pitch.scrubHint':
    'Перетащите влево или вправо для перемещения по песне; отпустите, чтобы оставить паузу.',
  'karaoke.pitch.viewSelector': 'Отображение высоты тона',
  'karaoke.pitch.viewNotes': 'Ноты',
  'karaoke.pitch.viewWave': 'Кривая',
  'karaoke.pitch.waveCanvas':
    'Кривая высоты голоса певца в реальном времени поверх нот песни',
  'karaoke.pitch.waveSong': 'Песня',
  'karaoke.pitch.waveVoice': 'Ваш голос',
  'karaoke.pitch.waveFooter':
    'Синие блоки — это ноты песни; тонкая живая кривая показывает высоту тона с микрофона.',
  'karaoke.pitch.review': 'Анализ исполнения',
  'karaoke.pitch.reviewCount': 'Фрагментов для тренировки: {count}',
  'karaoke.pitch.issueHigh': 'Высокая нота на {time}. Повторите этот фрагмент.',
  'karaoke.pitch.issueLow': 'Низкая нота на {time}. Повторите этот фрагмент.',
  'karaoke.pitch.issueMissed':
    'Пропущенные ноты на {time}. Повторите этот фрагмент.',
  'karaoke.practice.go': 'ПОЕХАЛИ!',
  'karaoke.practice.ready': 'Приготовьтесь спеть снова',
  'karaoke.countIn.ready': 'Приготовьтесь — песня начнётся после «ВПЕРЁД»',
  'karaoke.pitch.canvas':
    'Линия высоты микрофона и целевых нот в реальном времени',
  'karaoke.pitch.micOff':
    'Включите микрофон, чтобы увидеть высоту своего голоса.',
  'karaoke.pitch.loading': 'Запуск анализа высоты тона…',
  'karaoke.pitch.unavailable':
    'Анализ высоты тона недоступен. Индикатор уровня микрофона продолжает работать.',
  'karaoke.pitch.noSignal':
    'Пойте в микрофон, чтобы увидеть линию высоты голоса.',
  'karaoke.pitch.empty':
    'Целевые ноты появятся, только если они действительно есть в импортированной песне.',
  'karaoke.pitch.high': 'Высоко',
  'karaoke.pitch.tuned': 'В тон',
  'karaoke.pitch.low': 'Низко',
  'karaoke.pitch.ultrastar':
    'Синие полосы — целевые ноты; линия показывает, поёте ли вы выше, в тон или ниже.',
  'karaoke.chords.aria': 'Гитарные аккорды, оценённые по минусовке',
  'karaoke.chords.analyzing': 'Поиск аккордов… {percent}%',
  'karaoke.chords.estimate': 'Оценочный аккорд',
  'karaoke.chords.next': 'Следующий',
  'karaoke.chords.in': 'через {seconds} с',
  'karaoke.chords.none': 'Стабильный аккорд не найден',
  'karaoke.chords.confidence': 'Достоверность аудиооценки: {percent}%',
  'karaoke.maker.open': 'Создать',
  'karaoke.maker.openTitle': 'Создать или изменить это караоке',
  'karaoke.maker.dialog': 'Редактор караоке',
  'karaoke.maker.eyebrow': 'РЕДАКТОР КАРАОКЕ FLUIDEQ',
  'karaoke.maker.close': 'Закрыть редактор',
  'karaoke.maker.exitBusy':
    'Локальная модель ещё работает. Отмените её или дождитесь завершения, прежде чем выходить из редактора.',
  'karaoke.maker.songTitle': 'Название песни',
  'karaoke.maker.untitled': 'Караоке без названия',
  'karaoke.maker.undo': 'Отменить',
  'karaoke.maker.redo': 'Повторить',
  'karaoke.maker.preview': 'Предпросмотр · 1, 2, 3',
  'karaoke.maker.apply': 'Использовать в проигрывателе',
  'karaoke.maker.applyHint':
    'Использовать эти изменения в проигрывателе. Исходный файл не изменится; экспорт создаст новый файл.',
  'karaoke.maker.lyrics': 'Текст',
  'karaoke.maker.toolsEdit': 'Инструменты редактирования',
  'karaoke.maker.toolsAnalysis': 'Инструменты анализа',
  'karaoke.maker.lyricsTiming': 'Время текста',
  'karaoke.maker.timingAll': 'Вся песня',
  'karaoke.maker.timingFromWord': 'От выбранного слова',
  'karaoke.maker.timingAllHint':
    'Сдвигает вместе все синхронизированные слова и ноты.',
  'karaoke.maker.timingFromWordHint':
    'Сдвигает «{word}» и всё после него. Предыдущая часть остаётся на месте.',
  'karaoke.maker.earlier': 'Сдвинуть весь текст раньше',
  'karaoke.maker.later': 'Сдвинуть весь текст позже',
  'karaoke.maker.openProject': 'Импортировать караоке',
  'karaoke.maker.projectLoaded':
    'Проект загружен. Текущее аудио осталось подключено.',
  'karaoke.maker.karaokeImported':
    'Синхронизация импортирована. Текущее аудио осталось подключено.',
  'karaoke.maker.tapWords': 'Разметить слова',
  'karaoke.maker.recordLines': 'Записать начала строк',
  'karaoke.maker.syncLinesFromHere': 'Синхронизировать строки отсюда',
  'karaoke.maker.syncWordsFromHere': 'Синхронизировать слова отсюда',
  'karaoke.maker.syncNow': 'Сейчас',
  'karaoke.maker.syncNext': 'Далее: {item}',
  'karaoke.maker.markLine': 'Отметить начало строки',
  'karaoke.maker.markLineEnd': 'Отметить конец строки',
  'karaoke.maker.captureEnd': 'Ожидание конца',
  'karaoke.maker.capturePressStart': 'Шаг 1 · Enter в НАЧАЛЕ',
  'karaoke.maker.captureReplaceStart':
    'Следующая строка готова · Enter заменит НАЧАЛО',
  'karaoke.maker.captureStartSaved':
    'Начало сохранено в {time} · Enter в КОНЦЕ',
  'karaoke.maker.captureAutomaticStart':
    'Автоматическое начало {time} · Enter в КОНЦЕ',
  'karaoke.maker.captureAutomaticSuggestion':
    'Предложенное начало {time} · Enter записывает НАЧАЛО',
  'karaoke.maker.captureFixEnd': 'Строка записана · Enter исправляет КОНЕЦ',
  'karaoke.maker.captureStartPoint': 'НАЧАЛО',
  'karaoke.maker.captureEndPoint': 'КОНЕЦ',
  'karaoke.maker.captureGuideTitle': 'Тайминг строки',
  'karaoke.maker.captureSetupTitle': 'Готовы записать тайминг текста?',
  'karaoke.maker.captureSetupBody':
    'Слушайте вокал. Нажмите Enter в начале строки, при желании Tab на каждом новом слове, затем Enter в конце. Так последнее протяжное слово сохранит полную длительность.',
  'karaoke.maker.captureSetupStatus':
    'Прочитайте подсказку в предпросмотре и начните запись.',
  'karaoke.maker.captureStartRecording': 'Начать запись',
  'karaoke.maker.captureMoveGuide':
    'Перетащите подсказку. Двойной щелчок вернёт её на место.',
  'karaoke.maker.selectionPanel': 'Инструменты выделения',
  'karaoke.maker.selectionMoveGuide':
    'Перетащите инструменты. Двойной щелчок вернёт их на место.',
  'karaoke.maker.dismissSelection': 'Закрыть инструменты выделения',
  'karaoke.maker.captureCountdownReady': 'Приготовьтесь к первой строке',
  'karaoke.maker.captureGuideNext': 'Далее',
  'karaoke.maker.captureGuideAudio':
    'сдвигает аудио на 2 секунды · Shift: 1 секунда',
  'karaoke.maker.captureGuideLyrics': 'выбирает строку текста',
  'karaoke.maker.captureGuidePlayback': 'воспроизводит или ставит на паузу',
  'karaoke.maker.captureGuideWords': 'отметить следующее слово',
  'karaoke.maker.captureGuideUndo': 'отменяет последнюю метку',
  'karaoke.maker.stopRecording': 'Остановить запись',
  'karaoke.maker.markWord': 'Отметить слово',
  'karaoke.maker.markNextWord': 'Следующее слово',
  'karaoke.maker.done': 'Готово',
  'karaoke.maker.ignoreLine': 'Пропустить строку',
  'karaoke.maker.lineTimingComplete':
    'Синхронизация строк завершена. Можно проверить и использовать в проигрывателе.',
  'karaoke.maker.recordLinesHint':
    'ENTER отмечает начало/конец · ↑/↓ выбирает строку · ←/→ двигает только аудио на 2 с · ПРОБЕЛ запускает или ставит на паузу · Backspace отменяет',
  'karaoke.maker.panView': 'Рука · перемещение шкалы',
  'karaoke.maker.panHint':
    'Инструмент «Рука»: перетаскивайте холст для навигации по песне без редактирования.',
  'karaoke.maker.scrubHint':
    'Щёлкните или перетащите указатель воспроизведения для навигации по песне.',
  'karaoke.maker.addNote': 'Нота',
  'karaoke.maker.selectNotes': 'Выбрать ноты',
  'karaoke.maker.paintNotes': 'Рисовать ноты',
  'karaoke.maker.selectNotesHint':
    'Обведите ноты рамкой. Перетащите выбранную ноту, чтобы переместить группу. Удерживайте Ctrl и перетащите её на слово или слог для привязки.',
  'karaoke.maker.paintNotesHint':
    'Проведите по сетке высоты, чтобы нарисовать ноту. Инструмент останется активным для следующих нот.',
  'karaoke.maker.notesSelected': 'нот выбрано',
  'karaoke.maker.copyNotes': 'Копировать выбранные ноты',
  'karaoke.maker.pasteNotes': 'Вставить ноты у курсора',
  'karaoke.maker.notePasted': 'Нота вставлена у курсора.',
  'karaoke.maker.notesPasted': 'У курсора вставлено нот: {count}.',
  'karaoke.maker.attachNotesByTime': 'Привязать к тексту',
  'karaoke.maker.detachNotes': 'Отвязать от текста',
  'karaoke.maker.noteAttachHelp':
    'Удерживайте Ctrl и перетащите ноту на слово или слог. Привязанные ноты следуют таймингу текста и блокируются.',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C копирует выбор · Ctrl+V вставляет первую ноту у курсора.',
  'karaoke.maker.attachedTo': 'Привязана к «{word}»',
  'karaoke.maker.noteUnattached': 'Не привязана к тексту',
  'karaoke.maker.splitWordSyllables': 'Разделить слово на слоги',
  'karaoke.maker.syllableEditorEyebrow': 'Редактор слогов',
  'karaoke.maker.syllableEditorTitle': 'Разделить «{word}»',
  'karaoke.maker.syllableEditorHint':
    'Нажмите между буквами, чтобы добавить или убрать границу слога.',
  'karaoke.maker.syllableSplitPoint': 'Переключить границу после «{text}»',
  'karaoke.maker.syllableEditorPreview': 'Полученные слоги',
  'karaoke.maker.applySyllableSplit': 'Применить деление',
  'karaoke.maker.hearNote': 'Прослушать ноту',
  'karaoke.maker.split': 'Разделить',
  'karaoke.maker.delete': 'Удалить',
  'karaoke.maker.analyze': 'Анализ мелодии',
  'karaoke.maker.prepare': 'Подготовить караоке',
  'karaoke.maker.advanced': 'Дополнительно',
  'karaoke.maker.prepared':
    'В этом караоке уже есть синхронизированные ноты мелодии.',
  'karaoke.maker.repairLyrics': 'Повторно определить время текста',
  'karaoke.maker.repairMelody': 'Повторно определить ноты мелодии',
  'karaoke.maker.rebuildKaraoke': 'Пересоздать текст + мелодию',
  'karaoke.maker.autoAlign': 'Автовыравнивание',
  'karaoke.maker.aiMelody': 'ИИ-мелодия',
  'karaoke.maker.transcribe': 'Распознать',
  'karaoke.maker.vocalStem': 'Использовать вокальную дорожку',
  'karaoke.maker.vocalStemLoaded': 'Вокальная дорожка загружена',
  'karaoke.maker.groupVoice': 'Голос и музыка',
  'karaoke.maker.stemsTitle': 'Разделённые дорожки',
  'karaoke.maker.stemBacking': 'Минусовка',
  'karaoke.maker.stemSaveAs': 'Сохранить {name} как',
  'karaoke.maker.stemSaveFormat': 'Сохранить {name} как {format}',
  'karaoke.maker.stemMp3Encoding': 'Кодирование MP3…',
  'karaoke.maker.stemMp3Saved': 'MP3 сохранён.',
  'karaoke.maker.stemMp3Failed': 'Не удалось закодировать MP3.',
  'karaoke.maker.stemVoice': 'Голос',
  'karaoke.maker.stemSave': 'Сохранить',
  'karaoke.maker.groupLyrics': 'Текст и тайминг',
  'karaoke.maker.removeBackground': 'Отделить голос от музыки',
  'karaoke.maker.removeBackgroundDone': 'Голос уже отделён',
  'karaoke.maker.separationDownloading':
    'Загрузка модели разделения ({percent}%) · один раз, около 700 МБ',
  'karaoke.maker.separationReading': 'Чтение песни',
  'karaoke.maker.separating': 'Отделение голоса от музыки',
  'karaoke.maker.separationDone': 'Голос отделён. Распознавание текста готово.',
  'karaoke.maker.separationSlow':
    'На этом компьютере нет графического ускорения, поэтому это займёт несколько минут вместо менее чем одной.',
  'karaoke.maker.separationRequired':
    'Сначала отделите голос — распознавание текста читает изолированный вокал.',
  'karaoke.maker.separationRequiredMelody':
    'Сначала отделите голос — определение нот следует за одним голосом, а в миксе это обычно инструмент.',
  'karaoke.maker.wizardTitle': 'Настроить эту песню автоматически',
  'karaoke.maker.wizardIntro':
    'У этой песни ещё нет тайминга текста. FluidEQ может отделить голос от музыки, а затем прочитать по нему слова и их тайминг. Всё выполняется на этом компьютере.',
  'karaoke.maker.wizardStepSeparate': 'Отделить голос',
  'karaoke.maker.wizardStepTranscribe': 'Прочитать слова и тайминг',
  'karaoke.maker.wizardLanguage': 'Язык текста',
  'karaoke.maker.wizardLanguageAuto': 'Определить автоматически',
  'karaoke.maker.wizardStart': 'Настроить автоматически',
  'karaoke.maker.wizardSkip': 'Я сделаю сам',
  'karaoke.maker.wizardCancel': 'Остановить',
  'karaoke.maker.wizardHide': 'Продолжить в фоне',
  'karaoke.maker.wizardCancelled': 'Остановлено. Готовое сохранено.',
  'karaoke.maker.vocalFocus': 'Фокус на центральном вокале',
  'karaoke.maker.export': 'Экспорт',
  'karaoke.maker.exportProject': 'Проект FluidEQ',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'Расширенный LRC',
  'karaoke.maker.exportInstrumental': 'Минусовка (без голоса)',
  'karaoke.maker.tapHint':
    'Нажмите ПРОБЕЛ или ENTER для «{word}» · Backspace отменяет',
  'karaoke.maker.editHint':
    'Перетаскивайте ноты для изменения высоты/времени. Тяните края для размера. Ctrl + колёсико — масштаб.',
  'karaoke.maker.stats': '{notes} нот · {words} слов · {checks} проверок',
  'karaoke.maker.wordStateLegend': 'Состояние синхронизации текста',
  'karaoke.maker.userAdjustedWords': 'Исправлено: {count}',
  'karaoke.maker.pendingWords': 'Ожидает: {count}',
  'karaoke.maker.artist': 'Исполнитель',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'Масштаб',
  'karaoke.maker.songPosition': 'Позиция в песне',
  'karaoke.maker.previousView': 'Предыдущий участок',
  'karaoke.maker.nextView': 'Следующий участок',
  'karaoke.maker.resetZoom': 'Двойной щелчок — вместить текст',
  'karaoke.maker.livePreview': 'Предпросмотр',
  'karaoke.maker.showPreview': 'Показать предпросмотр',
  'karaoke.maker.hidePreview': 'Скрыть предпросмотр',
  'karaoke.maker.previewEmpty':
    'Добавьте или выровняйте текст по времени для предпросмотра.',
  'karaoke.maker.noteNormal': 'Нота',
  'karaoke.maker.noteGolden': 'Золотая',
  'karaoke.maker.noteFree': 'Свободная',
  'karaoke.maker.untimed': 'Без времени',
  'karaoke.maker.applyUntimed':
    'У {count} слов текста ещё нет подтверждённого времени голоса. Определите или разместите их перед использованием караоке в плеере.',
  'karaoke.maker.selectHint': 'Выберите слово или ноту мелодии для просмотра.',
  'karaoke.maker.rights':
    'У меня есть разрешение использовать и экспортировать это аудио и текст.',
  'karaoke.maker.cancel': 'Отмена',
  'karaoke.maker.localAnalysis': 'Локальный анализ',
  'karaoke.maker.lyricsEyebrow': 'ТЕКСТ',
  'karaoke.maker.lyricsTitle':
    'Вставьте или измените по одной строке текста в каждой строке',
  'karaoke.maker.lyricsWarning':
    'При замене текста связи слов удаляются, чтобы их можно было безопасно разметить заново.',
  'karaoke.maker.lyricsReferenceHint':
    'Укажите полный текст, включая повторяющиеся строки и метки вроде [Куплет] или [Припев]. FluidEQ сохраняет этот текст и использует локальное распознавание речи для определения времени.',
  'karaoke.maker.referenceLyrics': 'Эталонный текст',
  'karaoke.maker.wordTiming': 'Время слова',
  'karaoke.maker.lyricsWordCount': '{count} слов в тексте',
  'karaoke.maker.lyricsTimedCount': '{timed} из {total} с временем',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'Определите новый текст перед редактированием времени слов',
  'karaoke.maker.lyricsNoTimedWords': 'Слов с временем пока нет',
  'karaoke.maker.lyricsTimingEditorHint':
    'После определения выберите слово, чтобы исправить его текст, начало или длительность.',
  'karaoke.maker.lyricsSelectWord': 'Выберите слово для изменения его времени.',
  'karaoke.maker.lyricsSelectedWord': 'Выбранное слово',
  'karaoke.maker.lyricsWordNavigation': 'Навигация по словам',
  'karaoke.maker.previousWord': 'Предыдущее слово',
  'karaoke.maker.nextWord': 'Следующее слово',
  'karaoke.maker.lyricsPlaceholder':
    'Вставьте полный текст здесь…\n\n[Куплет]\nПервая строка\nВторая строка',
  'karaoke.maker.loadLyricsFile': 'Загрузить файл текста',
  'karaoke.maker.lyricsFileLoaded': 'Текст загружен из {file}.',
  'karaoke.maker.lyricsRequired':
    'Добавьте или вставьте полный текст перед определением времени и мелодии.',
  'karaoke.maker.detectTimingMelody': 'Определить время и мелодию',
  'karaoke.maker.acceptLyrics': 'Принять текст',
  'karaoke.maker.acceptAndRecordLines': 'Принять и записать время',
  'karaoke.maker.continueInBackground': 'Продолжить в фоне',
  'karaoke.maker.clearLyrics': 'Очистить текст',
  'karaoke.maker.clearLyricsTitle': 'Очистить весь текст?',
  'karaoke.maker.clearLyricsBody':
    'Это удалит весь текст и его время. Ноты мелодии останутся, но связи со словами будут удалены. Действие можно отменить.',
  'karaoke.maker.clearNotes': 'Очистить ноты',
  'karaoke.maker.clearNotesTitle': 'Очистить все ноты мелодии?',
  'karaoke.maker.clearNotesBody':
    'Это удалит все ноты мелодии, сохранив текст и время слов. Действие можно отменить.',
  'karaoke.maker.notesCleared': 'Все ноты мелодии удалены.',
  'karaoke.maker.lyricsCleared':
    'Весь текст удалён. Существующие ноты сохранены без связей со словами.',
  'karaoke.maker.restore': 'Восстановить оригинал',
  'karaoke.maker.restoreTitle': 'Восстановить исходное караоке?',
  'karaoke.maker.restoreBody':
    'Все правки этого сеанса будут отброшены, а караоке будет собрано заново в том виде, в каком оно было импортировано, включая сохранённый черновик. После восстановления доступна отмена.',
  'karaoke.maker.restored': 'Импортированный оригинал восстановлен.',
  'karaoke.maker.replaceLyricsWarning':
    'Слова изменились. Замена пересоздаст идентификаторы и автоматическое время; существующие ручные исправления нельзя надёжно перенести. Ноты останутся и будут привязаны заново.',
  'karaoke.maker.replaceAndDetect': 'Заменить и определить',
  'karaoke.maker.wordText': 'Слово',
  'karaoke.maker.wordStart': 'Начало (мс)',
  'karaoke.maker.wordPosition': 'Позиция',
  'karaoke.maker.wordDuration': 'Длительность (мс)',
  'karaoke.maker.wordTimingSliderHint':
    'Изменяет общую границу: соседнее слово отдаёт или получает время, а диапазон строки остаётся неизменным.',
  'karaoke.maker.usePlayhead': 'Использовать позицию воспроизведения',
  'karaoke.maker.playWord': 'Воспроизвести слово',
  'karaoke.maker.allowAutoTiming': 'Разрешить автоматическое время',
  'karaoke.maker.replaceLyrics': 'Заменить текст',
  'karaoke.maker.lyricsAutoAligned':
    'Новый текст применён и выровнен по доступной мелодии.',
  'karaoke.maker.lyricsNeedPreparation':
    'Новый текст применён. Выберите Подготовить караоке, чтобы определить его время.',
  'karaoke.maker.transcriptionEyebrow':
    'НЕОБЯЗАТЕЛЬНОЕ ЛОКАЛЬНОЕ РАСПОЗНАВАНИЕ',
  'karaoke.maker.transcriptionTitle': 'Скачать локальную модель речи?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ загрузит модель {model} под лицензией MIT с Hugging Face и сохранит её на этом ПК — один раз, около 570 МБ с графическим ускорением и около 1,1 ГБ без него. Ваше аудио никогда не покидает компьютер. Первый запуск занимает несколько минут и требует много памяти.',
  'karaoke.maker.transcriptionReview':
    'Распознавание — лишь начало. FluidEQ сохраняет написание вашего текста при сопоставлении, а все времена можно редактировать.',
  'karaoke.maker.notNow': 'Не сейчас',
  'karaoke.maker.downloadTranscribe': 'Скачать и распознать',
  'karaoke.maker.downloadPrepare': 'Скачать и подготовить текст',
  'karaoke.maker.downloadingWhisper': 'Загрузка модели Whisper',
  'karaoke.maker.downloadOverall': 'Общая загрузка',
  'karaoke.maker.downloadFiles': '{complete} из {total} файлов',
  'karaoke.maker.loadingWhisper': 'Запуск модели Whisper',
  'karaoke.maker.analysisRunning': 'Локальный анализ высоты тона',
  'karaoke.maker.analysisAligned':
    'Неизменённые слова выровнены по {count} найденным участкам нот. Ручная синхронизация сохранена.',
  'karaoke.maker.analysisFound': 'Анализ обнаружил участки нот: {count}.',
  'karaoke.maker.basicPitchRunning': 'Распознавание нот мелодии',
  'karaoke.maker.basicPitchFound':
    'Найдено {count} редактируемых нот мелодии по голосу.',
  'karaoke.maker.whisperPreparing': 'Подготовка Whisper',
  'karaoke.maker.whisperDecoding': 'Локальное декодирование аудио',
  'karaoke.maker.whisperTranscribing': 'Локальное распознавание',
  'karaoke.maker.whisperTranscribingProgress':
    'Определение тайминга · проход {pass}/{passes} · блок {chunk}/{chunks}',
  'karaoke.maker.whisperAligning': 'Совмещение текста с пением',
  'karaoke.maker.whisperComplete': 'Распознавание завершено',
  'karaoke.maker.whisperMatched':
    'Whisper сопоставил распознанные слова: {count}. Проверьте редактируемую синхронизацию перед экспортом.',
  'karaoke.maker.autoAlignComplete':
    'Неизменённый текст выровнен по обнаруженной мелодии. Ручная синхронизация сохранена.',
  'karaoke.maker.speechMemory': 'Память моделей ИИ',
  'karaoke.maker.speechMemoryReady': 'Готова в ОЗУ',
  'karaoke.maker.speechMemoryCached': 'Сохранена на диске',
  'karaoke.maker.speechMemoryMissing': 'Не загружена',
  'karaoke.maker.modelWhisper': 'Речь (Whisper)',
  'karaoke.maker.modelPitch': 'Высота тона (RMVPE)',
  'karaoke.maker.modelSeparation': 'Разделение (RoFormer)',
  'karaoke.maker.freeMemory': 'Освободить ОЗУ сейчас',
  'karaoke.maker.memoryReleased':
    'Речевая модель удалена из ОЗУ. Загруженные файлы остались в кэше.',
  'karaoke.maker.memoryReleaseBusy':
    'Речевая модель занята и пока не может быть выгружена.',
  'karaoke.maker.memoryAfterUse': 'Когда модель не используется',
  'karaoke.maker.memoryPolicy.ask': 'Спрашивать',
  'karaoke.maker.memoryPolicy.auto': 'Выгружать автоматически',
  'karaoke.maker.memoryPolicy.keep': 'Оставлять загруженной',
  'karaoke.maker.memoryAfter': 'Через',
  'karaoke.maker.memoryMinutes': '{count} мин',
  'karaoke.maker.memoryPromptTitle': 'Освободить память речевой модели?',
  'karaoke.maker.memoryPromptBody':
    'Локальная речевая модель не используется. Её выгрузка освободит ОЗУ; файлы останутся в кэше для быстрой повторной загрузки.',
  'karaoke.maker.keepLoaded': 'Оставить загруженной',
  'karaoke.maker.exported': 'Экспортировано: {file}',
  'karaoke.maker.exportedPartialLrc':
    'Экспортировано: {file} — без строк текста в количестве {lines}: LRC нужно время на строке или на одном из её слов, а у этих строк нет ни того ни другого. Задайте им время в Редакторе и экспортируйте снова, чтобы получить полный файл.',
  'karaoke.maker.exportedPartialUltraStar':
    'Экспортировано: {file} — без слов текста в количестве {words}: UltraStar переносит слово только там, где у мелодии есть нота, а у этих слов её нет. Определите или нарисуйте их ноты и экспортируйте снова, чтобы получить полный файл.',
  'karaoke.maker.exportFallback': 'файл караоке',
  'karaoke.maker.projectTooLarge': 'Размер проекта превышает 16 МБ.',
  'karaoke.maker.previewResize': 'Изменить размер предпросмотра',
  'karaoke.maker.seekBack': 'Назад на {seconds} с',
  'karaoke.maker.seekForward': 'Вперёд на {seconds} с',
  'karaoke.maker.jumpToStart': 'Перейти к началу песни',
  'karaoke.maker.jumpToEnd': 'Перейти к концу песни',
  'karaoke.maker.errorAudioLimits':
    'Локальный анализ поддерживает аудиофайлы до 1 ГБ и записи короче 30 минут.',
  'karaoke.maker.errorComponentUnavailable':
    'Необходимый компонент локального анализа недоступен. Перезапустите FluidEQ и повторите попытку.',
  'karaoke.maker.errorAnalysis':
    'FluidEQ не удалось локально проанализировать это аудио.',
  'karaoke.maker.errorExportNeedsNotes':
    'Для экспорта UltraStar нужна хотя бы одна нота мелодии.',
  'karaoke.maker.errorExport': 'FluidEQ не удалось экспортировать это караоке.',
  'karaoke.maker.errorProjectVersion':
    'Этот проект создан в неподдерживаемой версии FluidEQ.',
  'karaoke.maker.errorImport':
    'FluidEQ не удалось импортировать это караоке или проект.',
  'karaoke.maker.errorParse':
    'Не удалось прочитать выбранный файл текста или караоке.',
  'karaoke.maker.downloadFailed': 'Не удалось загрузить модель Whisper',
  'karaoke.maker.localAnalysisFailed': 'Ошибка локального анализа',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ не удалось загрузить модель с Hugging Face. Проверьте подключение или брандмауэр и повторите попытку.',
  'karaoke.maker.tryAgain': 'Повторить',
  'karaoke.maker.dismiss': 'Закрыть ошибку',
  'karaoke.maker.analysisSource':
    '«{file}» используется только как локальный источник анализа.',
  'karaoke.maker.rightsRequired':
    'Перед публикацией экспорта подтвердите права на аудио и текст.',
  'karaoke.maker.draftRestored': 'Черновик восстановлен',
  'karaoke.maker.playerTimingLoaded':
    'Используется синхронизация из проигрывателя. Отмена восстановит сохранённый черновик.',

  'karaoke.translation.picker': 'Язык текста',
  'karaoke.translation.original': 'Как в записи',
  'karaoke.translation.add': 'Добавить язык',
  'karaoke.translation.remove': 'Удалить этот язык',
  'karaoke.translation.target': 'Язык вставляемого текста',
  'karaoke.translation.paste':
    'Вставьте текст на этом языке, по одной строке на каждую строку песни.',
  'karaoke.translation.mismatch':
    'В песне {expected} спетых строк, а в этом тексте — {received}. Совместите их с пронумерованными строками рядом с полем.',
  'karaoke.translation.fit': '{syllables} слогов, {notes} нот',
  'karaoke.translation.fitOk': 'Соответствует мелодии',
  'karaoke.translation.empty': 'На этом языке пока нет текста.',
};

export default karaoke;
