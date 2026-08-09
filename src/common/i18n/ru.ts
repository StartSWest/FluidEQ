/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
  'app.dismiss': 'Скрыть',

  'tabs.aria': 'Рабочая область звука',
  'tabs.eq': 'Эквалайзер',
  'tabs.autoeq': 'AutoEQ',
  'tabs.voicing': 'Характер',
  'tabs.convolution': 'Свёртка',
  'tabs.config': 'Config',
  'tabs.video': 'Видео',

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
  'autoeq.allDatabases.hint':
    'Ищет одновременно в официальной AutoEq и GadgetryTech.',
  'autoeq.pickDevice': 'Сначала выберите модель 🎧',
  'autoeq.noResponses': 'Подходящих измерений нет 😞',
  'autoeq.pickResponse': 'Выберите измерение! 🔊',
  'autoeq.selectSourcePlaceholder': 'Выберите источник…',
  'autoeq.searchSources': 'Поиск источников…',
  'autoeq.noModel': 'Ни одна измеренная модель не подходит под запрос.',
  'autoeq.searchModels': 'Поиск по марке или модели…',
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
  'config.empty': 'Ничего не подключено — этот выход оставлен как есть.',
  'config.file.missing': 'нет файла',
  'config.export': 'Экспорт цепочки',
  'config.import': 'Импорт цепочки',
  'config.import.hint': 'Импорт применяется к выходу, который вы слушаете.',
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

  'support.game.shareEuphoria': 'Поделиться эйфорией',

  'support.game.shareTitle': 'Поделитесь результатом',

  'support.game.shareUnlock':
    'Дойдите до ×10 — и карточка станет режимом эйфории, со всем спектром.',

  'support.game.shareNote':
    'Сохраните карточку и прикрепите её к записи: ни одна из этих сетей не может взять изображение из ссылки.',

  'support.game.shareSave': 'Сохранить карточку',

  'support.game.shareCopyCard': 'Копировать карточку',

  'support.game.shareCardCopied': 'Скопировано — вставьте',

  'support.game.shareCopy': 'Копировать текст',

  'support.game.shareCopied': 'Скопировано',

  'support.game.shareLinkOnly':
    'Передаётся только ссылка — текст вставьте сами',

  'support.game.euphoria': 'Режим эйфории',

  'support.game.euphoriaToggle': 'Включить или выключить режим эйфории',

  'support.game.perfect': 'Идеально',

  'support.game.great': 'Отлично',

  'support.game.good': 'Хорошо',

  'support.game.miss': 'Мимо',
  'support.title': 'Поддержать работу',
  'support.close': 'Закрыть',
  'support.pitch':
    'FluidEQ бесплатен и с открытым исходным кодом — и таким останется: здесь ничего не спрятано за платной стеной и ничего не отслеживается. Если он заслужил место в вашей системе, поддержка оплачивает время на его сопровождение и следующие идеи из той же мастерской.',
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

  'language.title': 'Язык',
  'language.aria': 'Язык интерфейса',
  'waveform.style': 'Сменить стиль индикатора',
};

export default ru;
