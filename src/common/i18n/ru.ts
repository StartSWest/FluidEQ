/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { Dictionary } from './en';

/** Russian. */
const ru: Partial<Dictionary> = {
  'app.tagline': 'Ваш звук. На каждом устройстве. Автоматически.',
  'app.actions': 'Действия FluidEQ',
  'app.actions.title': 'Действия со звуком',
  'app.status.ready': 'Подключено к Equalizer APO',
  'app.status.checking': 'Проверка Equalizer APO…',
  'app.status.error': 'Equalizer APO не отвечает',
  'app.menu.importEq': 'Импорт настроек эквалайзера…',
  'app.menu.importConvolution': 'Импорт импульсной характеристики…',
  'app.menu.restartAudio': 'Перезапустить звук Windows',
  'app.menu.reconfigure': 'Перенастроить Equalizer APO',
  'app.menu.apoSettings': 'Настройки Equalizer APO',
  'app.menu.support': 'Поддержать проект',
  'whatsNew.eyebrow': 'ЗАМЕТКИ О ВЫПУСКЕ',
  'whatsNew.title': 'Что нового в FluidEQ',
  'whatsNew.loading': 'Загрузка заметок о выпуске…',
  'whatsNew.missing':
    'Заметки о выпуске не найдены в этой сборке. Они также есть на GitHub.',
  'app.menu.whatsNew': 'Что нового',
  'app.menu.language': 'Язык',
  'app.window.minimize': 'Свернуть',
  'app.window.maximize': 'Развернуть',
  'app.window.restore': 'Восстановить',
  'app.window.close': 'Закрыть',
  'app.window.minimizeApp': 'Свернуть FluidEQ',
  'app.window.maximizeApp': 'Развернуть FluidEQ',
  'app.window.restoreApp': 'Восстановить FluidEQ',
  'app.window.closeApp': 'Закрыть FluidEQ',
  'app.media.previous': 'Предыдущий трек',
  'app.media.playPause': 'Воспроизведение или пауза',
  'app.media.next': 'Следующий трек',
  'app.media.previousAria':
    'Предыдущий трек в любой программе на этом компьютере',
  'app.media.playPauseAria':
    'Воспроизведение или пауза в любой программе на этом компьютере',
  'app.media.nextAria': 'Следующий трек в любой программе на этом компьютере',
  'app.dismiss': 'Скрыть',

  'tabs.aria': 'Рабочая область звука',
  'tabs.eq': 'Эквалайзер',
  'tabs.autoeq': 'AutoEQ',
  'tabs.voicing': 'Характер',
  'tabs.convolution': 'Свёртка',
  'tabs.config': 'Config',
  'tabs.media': 'Медиа',
  'tabs.karaoke': 'Караоке',

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
    'Аудио: MP3, WAV, OGG, FLAC или M4A · Текст: LRC, eLRC или UltraStar TXT',
  'karaoke.import.drop': 'Перетащите сюда песни, тексты или папки',
  'karaoke.error.missingAudio':
    'Добавьте аудиофайл вместе с этим файлом текста.',
  'karaoke.error.ambiguous':
    'Возможно несколько сочетаний. Выберите один аудиофайл и, при желании, один файл текста.',
  'karaoke.error.unsupported':
    'Среди этих файлов пока нет поддерживаемого аудио или текста Karaoke.',
  'karaoke.error.read': 'FluidEQ не смог прочитать выбранные локальные файлы.',
  'karaoke.error.playback':
    'Эта сборка Chromium не смогла воспроизвести аудиофайл или кодек.',
  'karaoke.warning.lyrics':
    'не удалось разобрать; аудио останется доступно без синхронного текста.',
  'karaoke.song.unknownArtist': 'Локальная песня',
  'karaoke.playlist.title': 'Плейлист',
  'karaoke.playlist.groupFolders': 'Группировать по папкам',
  'karaoke.playlist.looseFiles': 'Файлы без папки',
  'karaoke.playlist.select': 'Выбрать {title}',
  'karaoke.playlist.moveUp': 'Переместить {title} вверх',
  'karaoke.playlist.moveDown': 'Переместить {title} вниз',
  'karaoke.playlist.remove': 'Удалить {title}',
  'karaoke.playlist.resize': 'Изменить размер плейлиста и сцены',
  'karaoke.playlist.collapse': 'Свернуть плейлист',
  'karaoke.playlist.expand': 'Развернуть плейлист',
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
  'karaoke.countIn.ready': 'Приготовьтесь — песня начнётся после «ВПЕРЁД»',
  'karaoke.chords.aria': 'Гитарные аккорды, оценённые по минусовке',
  'karaoke.chords.analyzing': 'Поиск аккордов… {percent}%',
  'karaoke.chords.estimate': 'Оценочный аккорд',
  'karaoke.chords.next': 'Следующий',
  'karaoke.chords.in': 'через {seconds} с',
  'karaoke.chords.none': 'Стабильный аккорд не найден',
  'karaoke.chords.confidence': 'Достоверность аудиооценки: {percent}%',
  'karaoke.transport.title': 'Управление воспроизведением Karaoke',
  'karaoke.transport.restart': 'Начать песню заново',
  'karaoke.transport.play': 'Воспроизвести',
  'karaoke.transport.pause': 'Пауза',
  'karaoke.transport.spaceShortcut': '{action} · Пробел',
  'karaoke.transport.seek': 'Позиция песни',
  'karaoke.transport.volume': 'Громкость',
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

  'graph.resize': 'Потяните, чтобы изменить размер графика',
  'graph.meter.aria':
    'Текущий уровень выхода, в реальных децибелах относительно полной шкалы',
  'graph.meter.left': 'Л',
  'graph.meter.right': 'П',
  'graph.meter.mono': 'М',
  'video.sites': 'Видеосайты',
  'video.back': 'Назад',
  'video.forward': 'Вперёд',
  'video.reload': 'Обновить',
  'video.stop': 'Остановить',
  'video.searchAria': 'Поиск по текущему сайту',
  'video.searchOn': 'Поиск на {site}',
  'video.searchGo': 'Найти',
  'video.searchClear': 'Очистить поиск',
  'video.searchRecent': 'Недавние запросы',
  'video.searchForget': 'Забыть «{term}»',
  'video.searchForgetAll': 'Очистить недавние запросы',
  'video.adBlock': 'Блокировать рекламу',
  'video.adBlockHint':
    'Пропускает рекламу в видео и скрывает рекламные блоки на YouTube.',
  'video.signOut': 'Выйти со всех сайтов',
  'video.signOutBusy': 'Выход…',
  'video.signOutHint':
    'Удаляет все файлы cookie, сохранённые входы и кешированные страницы плеера.',
  'video.signOutDone': 'Выход выполнен',
  'video.signOutFailed': 'Не удалось выйти',
  'video.blockedTitle': 'Эта ссылка ведёт за пределы плеера',
  'video.openInBrowser': 'Открыть в браузере',
  'video.resize': 'Потяните, чтобы изменить размер плеера',

  'notice.apoReconfigured':
    'Equalizer APO был установлен или перенастроен. Если звук пропал, перезапустите службу звука Windows, а не весь компьютер.',
  'notice.restartNow': 'Перезапустить звук сейчас',
  'notice.importComplete': 'Импорт завершён',
  'notice.restartConfirm':
    'Звук пропадёт на несколько секунд, и Windows запросит права администратора. Продолжить?',
  'update.title': 'Обновление FluidEQ',
  'update.available': 'Доступна версия {version}. Загружается.',
  'update.downloading': 'Загрузка обновления… {percent}%',
  'update.ready':
    'Версия {version} готова. Перезапустите FluidEQ, чтобы завершить.',
  'update.restart': 'Перезапустить сейчас',
  'update.restarting': 'Перезапуск…',
  'update.mandatory.title': 'Эту версию необходимо обновить',
  'update.mandatory.body':
    'Этот выпуск исправляет проблему, достаточно серьёзную, чтобы FluidEQ не продолжал работать в нынешнем виде. Обновление уже загружается.',
  'update.mandatory.notOptional':
    'Это не необязательное обновление. Уведомление можно закрыть и доделать начатое — оно будет возвращаться, пока FluidEQ не будет обновлён.',
  'update.mandatory.later': 'Не сейчас',
  'update.mandatory.waiting': 'Получение обновления…',
  'update.mandatory.readyPrompt':
    'Обновление загружено. FluidEQ закроется на время установки и откроется снова после неё.',
  'update.mandatory.install': 'Установить и перезапустить',
  'update.mandatory.installing': 'Установка…',
  'update.mandatory.failedDownload':
    'Не удалось загрузить обновление. Либо сервер загрузки недоступен, либо соединение прервалось на полпути.',
  'update.mandatory.failedInstall':
    'Обновление загружено, но установщик не запустился. Возможно, его отклонила Windows, либо загруженный файл повреждён.',
  'update.mandatory.manual':
    'Можно установить его и вручную: скачайте последнюю версию со страницы выпусков и запустите её. Настройки и профили сохранятся.',
  'update.mandatory.releasePage': 'Открыть страницу загрузки',
  'notice.restartDone':
    'Служба звука Windows перезапущена. Откройте заново приложения, которые ещё молчат.',

  'sidebar.engine': 'ОБРАБОТКА',
  'sidebar.systemEq': 'Системный эквалайзер',
  'sidebar.preamp': 'Предусиление',
  'sidebar.preampAria': 'Предусиление (дБ)',
  'sidebar.preampAuto':
    'Подбирается автоматически. Отключите авто-нормализацию, чтобы задать вручную.',
  'sidebar.headroom': 'ЗАПАС APO',
  'sidebar.autoPreamp': 'Авто-нормализация',
  'sidebar.visualizer': 'ВИЗУАЛИЗАЦИЯ',
  'sidebar.graphView': 'График АЧХ',

  'output.eyebrow': 'СЛЕДУЕТ ЗА ВЫХОДОМ',
  'output.title': 'Автоматический профиль',
  'output.device': 'Устройство вывода',
  'output.active': 'АКТИВНО',
  'output.none': 'Активные выходы не найдены',
  'output.mapping': 'Автоматическая привязка',
  'output.mapping.neutral': 'Нейтральный выход',
  'output.mapping.live': 'Привязана текущая настройка',
  'output.mapping.hint':
    'Измените любой регулятор эквалайзера — настройка сохранится и привяжется к этому выходу автоматически.',
  'output.hint':
    'FluidEQ запоминает постоянный идентификатор устройства, поэтому звук следует за ним всякий раз, когда Windows его выбирает.',

  'extraOutput.eyebrow': 'ЗВУЧИТ В ДВУХ МЕСТАХ',
  'extraOutput.title': 'Второй выход',
  'extraOutput.target': 'Дублировать на',
  'extraOutput.off': 'Выключено',
  'extraOutput.none': 'Других выходов не найдено',
  'extraOutput.active': 'ДУБЛИРУЕТСЯ',
  'extraOutput.volume': 'Громкость',
  'extraOutput.latency':
    'Продублированный звук приходит примерно на пятую долю секунды позже. Для музыки в соседней комнате нормально, для видео и игр непригодно, а если слышно оба сразу, получается эхо.',
  'extraOutput.virtual':
    'Установлен драйвер маршрутизации. Направьте приложения на него, и оба выхода останутся синхронными, а затем задайте каждому свой профиль выше.',
  'extraOutput.ambiguous':
    'Два выхода носят одно и то же имя, поэтому FluidEQ не может понять, какой из них нужен. Переименуйте один в параметрах звука Windows.',
  'extraOutput.unmatched':
    'Windows показывает этот выход, но FluidEQ до него не достаёт, поэтому дублировать на него нельзя.',
  'extraOutput.labelsHidden':
    'FluidEQ пока не может прочитать имена выходов и потому не может их сопоставить. Разрешите FluidEQ доступ к микрофону и откройте эту панель заново.',
  'extraOutput.hint':
    'Дублирование выводит то, что вы уже слышите, ещё и на второе устройство. Работает только пока FluidEQ открыт.',

  'driver.eyebrow': 'ЧЕМ ВЫ СЛУШАЕТЕ',
  'driver.title': 'Тип излучателя',
  'driver.none': 'Без коррекции',
  'driver.none.hint': 'Только ваши полосы и характер',
  'driver.strength': 'Сила',
  'driver.range': '±1,5 дБ',

  'profiles.eyebrow': 'ВАШ ЗВУК',
  'profiles.title': 'Сохранённые профили',
  'profiles.name': 'Имя профиля',
  'profiles.nameAria': 'Имя профиля',
  'profiles.new': 'Новый профиль',
  'profiles.newAria': 'Создать новый профиль из текущего эквалайзера',
  'profiles.untitled': 'Профиль без имени',
  'profiles.save': 'Сохранить как новый',
  'profiles.update': 'Обновить',
  'profiles.saveAria': 'Сохранить настройки в профиль',
  'profiles.restore': 'Восстановить',
  'profiles.restoring': 'Восстановление…',
  'profiles.restoreAria':
    'Восстановить последнюю версию профиля, сохранённую вручную',
  'profiles.attached': 'ВКЛ',
  'profiles.attachedTitle': 'Звучит на этом выходе',
  'profiles.detecting': 'Определяем ваш выход…',
  'profiles.empty': 'Профилей пока нет. Создайте свой первый звук.',
  'profiles.error.empty': 'Имя профиля не может быть пустым.',
  'profiles.error.restricted': 'Недопустимое имя, выберите другое.',
  'profiles.error.duplicate': 'Такое имя уже есть, выберите другое.',
  'profiles.edit': 'Изменить имя профиля',

  'autoeq.page.eyebrow': 'НАСТРОЙТЕ ПОД СВОИ НАУШНИКИ',
  'autoeq.page.title': 'Коррекция наушников',
  'autoeq.page.intro':
    'Укажите, в каких наушниках вы слушаете, и FluidEQ применит опубликованную для них коррекцию. Она ложится отдельным слоем, со своей силой и своим выключателем, так что ваши полосы эквалайзера не трогаются. Каждое измерение сделано на настоящем стенде и кем-то опубликовано — ничего не угадывается по названию модели.',
  'autoeq.source.hint':
    'Из какой базы взяты измерения. «Все базы» ищет сразу во всех.',
  'autoeq.model.hint':
    'Ищите по марке или модели. Если вашей нет, близкий родственник из той же линейки обычно даёт почти то же самое.',
  'autoeq.target.hint':
    'Большинство моделей измеряют не один раз — разные стенды, разные целевые кривые — и звучат они по-разному. Стоит попробовать несколько.',
  'autoeq.eyebrow': 'НАЧНИТЕ С ЭТАЛОНА',
  'autoeq.title': 'Библиотека AutoEQ',
  'autoeq.selectSource': 'Выберите источник',
  'autoeq.applied': 'Применено: {name}',
  'autoeq.notApplied': 'Эталон не применён',
  'autoeq.source': 'Источник измерений',
  'autoeq.model': 'Модель наушников',
  'autoeq.target': 'Измерение / целевая кривая',
  'autoeq.apply': 'Применить EQ модели',
  'autoeq.applying': 'Применение…',
  'autoeq.applyAria': 'Применить эквалайзер выбранной модели',
  'autoeq.checking': 'Проверка официальной базы…',
  'autoeq.updateAvailable': 'Доступно обновление ({count} моделей)',
  'autoeq.upToDate': 'База актуальна — {count} моделей',
  'autoeq.updateUnknown': 'Не удалось проверить обновление',
  'autoeq.update': 'Обновить базу',
  'autoeq.updating': 'Обновление…',
  'autoeq.updateAria': 'Обновить базу AutoEq',
  'autoeq.allDatabases': 'Все базы',
  'autoeq.allDatabases.hint': 'Поиск в официальной базе данных AutoEq.',
  'autoeq.pickDevice': 'Сначала выберите модель 🎧',
  'autoeq.noResponses': 'Подходящих измерений нет 😞',
  'autoeq.pickResponse': 'Выберите измерение! 🔊',
  'autoeq.selectSourcePlaceholder': 'Выберите источник…',
  'autoeq.searchSources': 'Поиск источников…',
  'autoeq.noModel': 'Ни одна измеренная модель не подходит под запрос.',
  'autoeq.searchModels': 'Поиск по марке или модели…',
  'squigImport.eyebrow': 'BRING YOUR CURVE WITH YOU',
  'squigImport.title': 'Import a Squiglink EQ',
  'squigImport.intro':
    'Use Squiglink’s calculator, then import its EQ export here.',
  'squigImport.open': 'Open Squiglink',
  'squigImport.stepOne': 'Choose a headset and target',
  'squigImport.stepTwo': 'Export the EQ text',
  'squigImport.stepThree': 'Paste it here and apply',
  'squigImport.pasteLabel': 'EQ export',
  'squigImport.placeholder': 'Paste the ParametricEQ or GraphicEQ text here…',
  'squigImport.fileAria': 'Choose an EQ export text file',
  'squigImport.chooseFile': 'Choose a .txt file',
  'squigImport.applyAria': 'Apply this imported EQ',
  'squigImport.importing': 'Applying…',
  'squigImport.apply': 'Apply imported EQ',
  'squigImport.applied': 'Applied curve',
  'squigImport.livePreview': 'Live preview',
  'squigImport.notApplied': 'Not applied',
  'squigImport.currentText': 'Current EQ text',
  'squigImport.flatPreview': 'Flat preview',
  'squigImport.flatCurve': 'No curve applied · 0 dB',
  'squigImport.bands': 'bands',
  'squigImport.clear': 'Remove import',
  'squigImport.chartAria': 'Frequency response of the imported EQ',
  'squigImport.emptyTitle': 'Your imported curve will appear here',
  'squigImport.emptyHint': 'Paste an export to preview its shape here.',
  'voicing.quickAria': 'Характер: {name}',
  'voicing.quickNone': 'Характер: нет',
  'voicing.quickTitle': 'Характер не применён',
  'voicing.quickLabel': 'Характер',
  'voicing.quickNoneHint': 'Только ваши полосы',

  'eq.eyebrow': 'ТОЧНАЯ НАСТРОЙКА',
  'eq.title': 'Параметрический эквалайзер',
  'eq.smart': 'Умный EQ',
  'eq.smart.cancel': 'Отмена',
  'eq.smart.aria': 'Умный эквалайзер по текущему сигналу',
  'eq.smart.cancelAria': 'Отменить измерение умного эквалайзера',
  'eq.smart.continuous': 'Непрерывно',
  'eq.smart.continuousAria':
    'Продолжать измерять и подстраивать эквалайзер во время музыки',
  'eq.smart.modeAria': 'Выбрать способ измерения',
  'eq.smart.mode.once.note': 'Одно измерение, применяется сразу',
  'eq.smart.mode.detail': 'Детали',
  'eq.smart.mode.detail.note': 'Измеряет постоянно · только пики и провалы',
  'eq.smart.mode.balance': 'Баланс',
  'eq.smart.mode.balance.note':
    'Измеряет постоянно · выравнивает яркость и теплоту',
  'eq.smart.mode.target': 'Цель',
  'eq.smart.mode.target.note':
    'Продолжает измерять · каждую запись к одной кривой',
  'eq.layers': 'Также применено',
  'eq.layers.aria': 'Что ещё влияет на этот выход',
  'eq.layers.eq': 'Эквалайзер',
  'eq.layers.eq.modified': '(изменён)',
  'eq.layers.eq.bands': 'полос: {count}',
  'eq.layers.convolution': 'Свёртка',
  'eq.layers.voicing': 'Характер',
  'eq.layers.driver': 'Излучатель',
  'eq.layers.headphone': 'Наушники',
  'eq.layers.custom': 'Пользовательский FX',
  'eq.layers.disable': 'Отключить «{layer}», не удаляя',
  'eq.layers.enable': 'Снова включить «{layer}»',
  'eq.layers.smart': 'Умный EQ',
  'eq.layers.smart.fullRange': 'Измерено · весь диапазон',
  'eq.layers.smart.range': 'Измерено · от {low} до {high}',
  'eq.layers.remove': 'Убрать слой «{layer}»',
  'eq.layers.clearBands': 'Вернуть все полосы к 0 dB',
  'eq.layers.clearReference': 'Убрать коррекцию наушников',
  'eq.layers.clearSmart':
    'Убрать измеренную коррекцию. Ваши полосы и эталон останутся на месте.',
  'eq.layers.clearCustom': 'Очистить фильтры и текст пользовательских FX',
  'eq.clear': 'Сбросить EQ',
  'eq.addBand': 'Добавить полосу',
  'eq.addBandAria': 'Добавить полосу эквалайзера',
  'eq.quickLayouts': 'Готовые раскладки',
  'eq.bandCount': '{count} полос',
  'eq.selected': 'Выбранная полоса',
  'eq.filter': 'Фильтр',
  'eq.frequency': 'Частота',
  'eq.gain': 'Усиление',
  'eq.gainDisabled': 'Усиление · —',
  'eq.quality': 'Добротность (Q)',
  'eq.delete': 'Удалить полосу',
  'eq.deleteAria': 'Удалить выбранную полосу эквалайзера',

  // Клаузы построены как подпись — диапазон, двоеточие, вывод, — чтобы название
  // диапазона осталось в именительном падеже. «Не хватает воздуха» требует
  // родительного, «ждём верхнюю середину» — винительного, а подставить в дырку
  // можно только одну форму. Двоеточие снимает вопрос падежа целиком.
  'eq.smart.range.deepBass': 'глубокий бас',
  'eq.smart.range.bass': 'бас',
  'eq.smart.range.lowMids': 'нижняя середина',
  'eq.smart.range.mids': 'середина',
  'eq.smart.range.upperMids': 'верхняя середина',
  'eq.smart.range.presence': 'презенс',
  'eq.smart.range.treble': 'высокие',
  'eq.smart.range.highTreble': 'верхние высокие',
  'eq.smart.range.air': 'воздух',
  'eq.smart.range.separator': ', ',
  'eq.smart.shape.lifted': '{range}: подъём',
  'eq.smart.shape.eased': '{range}: ослабление',
  'eq.smart.need.more': '{range}: не хватает',
  'eq.smart.need.less': '{range}: слишком много',
  'eq.smart.status.listening': 'Слушаем',
  'eq.smart.status.listeningPercent': 'Слушаем {percent}%',
  'eq.smart.status.settling': 'Слушаем {percent}% - стабилизация',
  'eq.smart.status.waitingOn': 'Слушаем {percent}% - ждём: {ranges}',
  'eq.smart.status.waitingOnMore':
    'Слушаем {percent}% - ждём: {ranges} +{count}',
  'eq.smart.status.paused': 'Пауза',
  'eq.smart.status.pausedResume': 'Пауза - продолжите, чтобы закончить',
  'eq.smart.status.pausedSilent': 'Пауза - звука нет',
  'eq.smart.status.waitingForSound': 'Ждём звук',
  'eq.smart.status.soundChanged': 'Звук изменился - измеряем заново',
  'eq.smart.status.keptChanging': 'Звук всё время менялся - остановлено',
  'eq.smart.status.notEnoughRange': 'Слишком узкий диапазон для измерения',
  'eq.smart.status.alreadyBalanced': 'Уже сбалансировано',
  'eq.smart.status.applying': 'Применение…',
  'eq.smart.status.cancelled': 'Отменено - ничего не изменилось',
  'eq.smart.status.failed': 'Не удалось измерить выход.',
  'eq.smart.result.fullRange': 'Сбалансировано - весь диапазон',
  'eq.smart.result.range': 'Сбалансировано - только от {low} до {high}',
  'eq.smart.result.withShape': '{result} · {shape}',
  'eq.smart.frequency.hz': '{value} Гц',
  'eq.smart.frequency.khz': '{value} кГц',
  'eq.smart.error.noCapture': 'Захват звука в этой среде недоступен.',
  'eq.smart.error.noLoopback':
    'Захват системного вывода в этой среде недоступен.',
  'eq.smart.error.streamStopped': 'Вывод прекратился до окончания измерения.',
  'eq.smart.error.analyserPaused':
    'Анализатор на паузе, поэтому измерение остановлено.',
  'eq.smart.error.noSound':
    'Ничего не играло. Включите музыку и измерьте заново.',
  'eq.smart.error.noAudioTrack': 'Windows не дала системный аудиопоток.',
  'eq.smart.error.formatChanged':
    'Формат вывода изменился во время измерения. Попробуйте ещё раз.',
  'eq.smart.error.deviceChanged':
    'Устройство вывода изменилось во время измерения. Попробуйте ещё раз.',
  'eq.smart.error.captureFailed':
    'Не удалось захватить обработанный системный вывод.',
  'eq.smart.error.analyserOff':
    'Анализатор живого вывода не работает, измерять нечего.',
  'eq.smart.error.alreadyRunning': 'Измерение уже идёт.',
  'eq.smart.error.timedOut': 'Время измерения истекло. Попробуйте ещё раз.',
  'eq.smart.error.closed': 'FluidEQ завершил измерение.',
  // «Не считаем» — от первого лица, как и остальной словарь, и заодно без
  // согласования: «не учитывается» пришлось бы менять для «высокие».
  'eq.smart.presence.ignoredBelow': 'ниже {db} дБ не считаем',
  'eq.smart.presence.trustedAbove': 'выше {db} дБ доверяем',
  'eq.smart.presence.reset': 'Сбросить {range} для этого режима',
  'eq.smart.limit.label': 'Предел Smart EQ {db} дБ',
  'eq.smart.gap.title':
    '{range}: насколько расходится, против порога для действия',
  'eq.smart.gap.countdown': 'запишем через {seconds}с',

  'convolution.eyebrow': 'ИМПУЛЬСНЫЕ ХАРАКТЕРИСТИКИ APO',
  'convolution.title': 'Библиотека свёртки',
  'convolution.intro':
    'Скачайте проверенную минимально-фазовую импульсную характеристику для ваших наушников и примените её до параметрического эквалайзера. График ниже показывает обе кривые.',
  'convolution.import': 'Импортировать WAV…',
  'convolution.importing': 'Импорт…',
  'convolution.applied': 'Применено к этому выходу',
  'convolution.clear': 'Убрать',
  'convolution.search': 'Поиск моделей наушников',
  'convolution.searchPlaceholder':
    'Попробуйте «Kraken», «HD 650» или название лаборатории',
  'convolution.notice':
    'Загружаемый каталог предоставляет AutoEq. Файлы импортируются как WAV 48 кГц, потому что Equalizer APO требует, чтобы частота дискретизации импульса совпадала с активным выходом.',
  'convolution.loading': 'Загрузка официального каталога…',
  'convolution.empty':
    'Подходящих импульсов нет. Попробуйте более короткое название модели.',
  'convolution.source': 'Источник',
  'convolution.apply': 'Скачать и применить',
  'convolution.downloading': 'Загрузка…',
  'convolution.isApplied': 'Применено',
  'convolution.none':
    'Свёртка не загружена. Вкладка эквалайзера работает полностью независимо.',

  'voicing.eyebrow': 'ЦЕЛЕВЫЕ КРИВЫЕ',
  'voicing.title': 'Характер',
  'voicing.intro':
    'Подобранная цель под то, чем вы сейчас заняты. Каждая пишется отдельным слоем после ваших полос, поэтому ваша настройка не трогается, а возврат к «Нет» восстанавливает её в точности.',
  'voicing.refused': 'Не удалось сменить воисинг',
  'voicing.groupPurpose': 'Для чего',
  'voicing.groupGenre': 'Жанр',
  'voicing.none': 'Нет',
  'voicing.none.hint': 'Только ваши полосы, ничего сверху',
  'voicing.strength': 'Сила',
  'voicing.off': 'Выкл',
  'voicing.full': 'Максимум',
  'voicing.inert': 'При силе 0% этот характер ничего не делает.',
  'voicing.headroom':
    'Добавляет до +{peak} дБ. Авто-нормализация резервирует запас; оставьте её включённой, если не задаёте предусиление вручную.',

  'config.eyebrow': 'ЧТО ЧИТАЕТ ДВИЖОК',
  'config.title': 'Конфигурация Equalizer APO',
  'config.lede': 'То, что сейчас лежит на диске, а не то, что задумал FluidEQ.',
  'config.reload': 'Обновить',
  'config.reloadTitle': 'Перечитать конфигурацию с диска',
  'config.reading': 'Чтение…',
  'config.absent':
    'FluidEQ ещё ничего не записал в эту установку Equalizer APO.',
  'config.status.notIncluded':
    'Equalizer APO не подключает эту конфигурацию. Ничего из перечисленного ниже не применяется.',
  'config.status.engineOff':
    'Движок FluidEQ выключен — в этой конфигурации не назван ни один выход, поэтому Equalizer APO ничего из неё не применяет.',
  'config.status.active': 'Активна — Equalizer APO применяет эту конфигурацию.',
  'config.outputsAria': 'Выходы в конфигурации Equalizer APO',
  'config.filters.one': '{count} фильтр',
  'config.filters.many': 'фильтров: {count}',
  'config.impulse': 'импульс',
  'config.playingNow': 'Звучит сейчас',
  'config.liveTitle': 'Непрерывный EQ поддерживает это измерение',
  'config.layer.on': 'вкл',
  'config.layer.off': 'выкл',
  'config.layers.noFile': 'Без своего файла',
  'config.layers.inFile': 'Записывается в этот файл, а не в отдельный.',
  'config.empty': 'Ничего не подключено — этот выход оставлен как есть.',
  'config.file.missing': 'нет файла',
  'config.export': 'Экспорт цепочки',
  'config.import': 'Импорт цепочки',
  'config.import.hint': 'Импорт применяется к выходу, который вы слушаете.',
  'config.import.customSkipped':
    'Собственный файл отправителя пропущен: строка Include: или Plugin: в нём загрузила бы код в аудиотракт Windows.',
  'config.file.yours': 'ваш',
  'config.hint.custom': 'Ваш файл. Никогда не перезаписывается.',
  'config.hint.generated':
    'Создан автоматически — будет переписан при следующем изменении.',
  'config.hint.saving':
    'Сохранение записывает файл; Equalizer APO его подхватывает.',
  'config.edit': 'Изменить',
  'config.cancel': 'Отмена',
  'config.save': 'Сохранить',

  'support.eyebrow': 'СОВЕРШЕННО ДОБРОВОЛЬНО',

  'support.petHint': 'Нажмите пробел, чтобы он подпрыгнул',

  'support.game.hint': 'Нажимайте в такт, когда пик доходит до линии',

  'support.game.howTo':
    'Нажимайте на питомца или пробел на каждый удар. Продолжайте — на ×10 кое-что случится.',

  'support.game.thanks':
    'Если что-то из этого вас порадовало — идеи и поддержка и есть то, что движет проектом.',

  'support.game.noAudio': 'Включите музыку, и ритм появится здесь',

  'support.game.listening': 'Ищем ритм…',

  'support.game.share': 'Поделиться',

  'support.game.shareEuphoria': 'Поделиться радугой',

  'support.game.shareTitle': 'Поделитесь результатом',

  'support.game.shareUnlock':
    'Дойдите до ×10 — и карточка перейдёт в режим радуги, со всем спектром.',

  'support.game.shareNote':
    'Сохраните карточку и прикрепите её к записи: ни одна из этих сетей не может взять изображение из ссылки.',

  'support.game.shareSave': 'Сохранить карточку',

  'support.game.shareCopyCard': 'Копировать карточку',

  'support.game.shareCardCopied': 'Скопировано — вставьте',

  'support.game.shareCopy': 'Копировать текст',

  'support.game.shareCopied': 'Скопировано',

  'support.game.shareLinkOnly':
    'Передаётся только ссылка — текст вставьте сами',

  'support.game.euphoria': 'Режим радуги',

  'support.game.euphoriaToggle': 'Включить или выключить режим радуги',

  'support.game.perfect': 'Идеально',

  'support.game.great': 'Отлично',

  'support.game.good': 'Хорошо',

  'support.game.miss': 'Мимо',
  'support.title': 'Поддержать работу',
  'support.close': 'Закрыть',
  'support.pitch':
    'FluidEQ бесплатен и с открытым исходным кодом — и таким останется: код открыт, вы всегда можете собрать его сами и бесплатно, и здесь ничего не отслеживается. Продаётся подписанная, готовая к запуску сборка. Если он заслужил место в вашей системе, поддержка оплачивает время на его сопровождение и следующие идеи из той же мастерской.',
  'support.craft':
    'Это работа одного человека, сделанная с большой любовью и неразумным вниманием к деталям. Каждая панель нарисована вручную и обдумана: как кривая читается с одного взгляда, как раскрывается меню, что делает ручка, если крутить её медленно, какие слова стоят на кнопке. Здесь нет ни одного готового компонента, на который просто натянули тему.',
  'support.card': 'Карта или кошелёк',
  'support.card.hint':
    'Безопасная оплата через Stripe. Откроется в браузере — приложение никогда не видит данные карты.',
  'support.coffee': 'Купить мне кофе',
  'support.coffee.hint':
    'Разовая благодарность, аккаунт не нужен. Нажмите, чтобы открыть в браузере, или отсканируйте код телефоном.',
  'support.verify': 'Проверьте адрес перед отправкой.',
  'support.copy': 'Скопировать адрес',
  'support.copied': 'Скопировано',
  'support.openWallet': 'Открыть в кошельке',
  'support.contributed': 'Я поддержал — открыть звезду и танец',
  'support.thanks':
    'Спасибо — у питомца появилась звезда, и теперь он танцует.',
  'support.releaseNotes': 'Что нового в этой версии',
  'support.footerBefore':
    'Хотите помочь временем? Issue и pull request так же желанны на',

  'disclaimer.heading': 'Без гарантий и без ответственности',
  'disclaimer.asIs':
    'FluidEQ предоставляется как есть, без каких-либо гарантий. Никто не обещает, что программа работает, что она подходит для ваших задач или что она будет работать и дальше. Об этом говорят разделы 15 и 16 GNU General Public License, и это верно независимо от того, получили вы эту копию даром или заплатили за неё.',
  'disclaimer.liability':
    'FluidEQ меняет обработку звука на вашем компьютере, а также устанавливает Equalizer APO и управляет им — это отдельная программа, которая работает с правами администратора и встраивается в звуковой тракт Windows. В максимальной степени, допускаемой законом, {author} не несёт ответственности за ущерб, возникший из-за использования программы: для вашего слуха, для колонок, наушников и другого оборудования, для данных или другого программного обеспечения, а также за любой иной ущерб, включая убытки, которые вы не могли предвидеть.',
  'disclaimer.volume':
    'Звук бывает громким, а эквализация может сделать его громче исходной записи. Убавьте громкость перед изменением настройки и прибавьте её после.',
  'disclaimer.localLaw':
    'В некоторых странах продавцу не разрешено исключать отдельные гарантии или виды ответственности. Там, где это так, действуют местные правила, и настоящее уведомление не лишает вас прав, которые даёт закон.',
  'disclaimer.accepting': 'Пользуясь FluidEQ, вы принимаете сказанное выше.',
  'disclaimer.language':
    'Это уведомление составлено на английском языке. Если перевод расходится с английским текстом, применяется английский текст.',
  'disclaimer.accept': 'Понимаю и принимаю',
  'disclaimer.decline': 'Выйти',
  'provenance.heading': 'Проверьте, откуда взялась эта копия',
  'provenance.body':
    'Официальный подписанный установщик FluidEQ распространяется только через fluideq.com. Сборки из исходного кода следует брать из официального репозитория. GPL разрешает третьим лицам копировать, изменять, пересобирать и продавать FluidEQ, но их сборки не подписаны, не проверены, не поддерживаются и не одобрены FluidEQ автоматически. Если загрузка выдаёт себя за официальную и не имеет действительной цифровой подписи Windows, закройте её и сообщите о ней.',
  'provenance.site': 'Официальный сайт: fluideq.com',
  'provenance.repository':
    'Официальный исходный код: github.com/StartSWest/FluidEQ',

  'language.title': 'Язык',
  'language.aria': 'Язык интерфейса',
  'waveform.style': 'Сменить стиль индикатора',
};

export default ru;
