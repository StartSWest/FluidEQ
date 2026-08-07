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
  'tabs.eq': 'Эквалайзер и тип наушников',
  'tabs.voicing': 'Характер',
  'tabs.convolution': 'Свёртка',
  'tabs.config': 'Config',
  'tabs.video': 'Видео',

  'graph.resize': 'Потяните, чтобы изменить размер графика',
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
  'video.blockedTitle': 'Эта ссылка ведёт за пределы плеера',
  'video.blockedSignInTitle': 'Вход выполняется в браузере, а не здесь',
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
  'eq.smart.auto': 'Авто',
  'eq.smart.autoAria': 'Перемерять умный эквалайзер при смене музыки',
  'eq.smart.auto.waiting': 'Новый трек - скоро начнём слушать',
  'eq.layers': 'Также применено',
  'eq.layers.aria': 'Что ещё влияет на этот выход',
  'eq.layers.eq': 'Эквалайзер',
  'eq.layers.eq.modified': '(изменён)',
  'eq.layers.eq.bands': 'полос: {count}',
  'eq.layers.convolution': 'Свёртка',
  'eq.layers.voicing': 'Характер',
  'eq.layers.driver': 'Излучатель',
  'eq.layers.disable': 'Отключить «{layer}», не удаляя',
  'eq.layers.enable': 'Снова включить «{layer}»',
  'eq.layers.smart': 'Умный EQ',
  'eq.layers.smart.fullRange': 'Измерено · весь диапазон',
  'eq.layers.smart.range': 'Измерено · от {low} до {high}',
  'eq.layers.remove': 'Убрать слой «{layer}»',
  'eq.layers.clearReference': 'Убрать эталонную модель и созданные ею полосы',
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
  'voicing.none': 'Нет',
  'voicing.none.hint': 'Только ваши полосы, ничего сверху',
  'voicing.strength': 'Сила',
  'voicing.off': 'Выкл',
  'voicing.full': 'Максимум',
  'voicing.inert': 'При силе 0% этот характер ничего не делает.',
  'voicing.headroom':
    'Добавляет до +{peak} дБ. Авто-нормализация резервирует запас; оставьте её включённой, если не задаёте предусиление вручную.',

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
