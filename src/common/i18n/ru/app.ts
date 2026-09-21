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

/** The shell around everything: menus, tabs, updates, config, notices. */
import { Dictionary } from '../en';

const app: Partial<Dictionary> = {
  'recovery.title': 'FluidEQ восстанавливается',
  'recovery.working':
    'Воспроизведение останавливается, окно перезагружается с сохранёнными настройками. Несохранённая работа может быть потеряна.',
  'recovery.stopped':
    'Не удалось безопасно восстановить FluidEQ. Автоматические попытки остановлены. Можно перезагрузить окно или выйти. Несохранённая работа может быть потеряна.',
  'recovery.reload': 'Перезагрузить FluidEQ',
  'recovery.quit': 'Выйти',
  'recovery.copy': 'Копировать сведения',
  'recovery.history': 'Прежние сбои',
  'app.tagline': 'Ваш звук. На каждом устройстве. Автоматически.',
  'app.actions': 'Действия FluidEQ',
  'app.actions.title': 'Действия со звуком',
  'app.status.ready': 'Аудиодвижок подключён',
  'app.status.checking': 'Проверка аудиодвижка…',
  'app.status.error': 'Аудиодвижок не отвечает',
  'app.menu.importEq': 'Импорт настроек эквалайзера…',
  'app.menu.importConvolution': 'Импорт импульсной характеристики…',
  'app.menu.restartAudio': 'Перезапустить звук Windows',
  'engine.apo.reconfigure': 'Перенастроить Equalizer APO',
  'engine.apo.settings': 'Настройки Equalizer APO',
  'app.menu.support': 'Поддержать проект',
  'app.menu.fix': 'Исправить',
  'app.menu.reportProblem': 'Сообщить о проблеме',
  'app.menu.about': 'О программе {product}…',
  'app.processes.menu': 'Процессы…',
  'app.processes.eyebrow': 'Процессы',
  'app.processes.hint':
    'Windows называет каждый из них именем приложения, потому что это одна и та же программа. Здесь видно, что каждый из них делает для FluidEQ.',
  'app.processes.hintSplit':
    'Разделение сделано намеренно: интерфейс, отрисовка и звук работают порознь, поэтому занятое окно не тормозит музыку, а сбой в одной части не утягивает за собой остальные.',
  'app.processes.process': 'Процесс',
  'app.processes.pid': 'PID',
  'app.processes.memory': 'Память',
  'app.processes.cpu': 'ЦП',
  'app.processes.thisWindow': 'это окно',
  'app.processes.total': 'Всего {megabytes} МБ и {cpu} % ЦП.',
  'app.processes.unmeasured':
    'Прочерк — величина, которую ещё никто не измерил.',
  'app.processes.scene':
    '{place}: {name}, {ms} мс на кадр при {fps} fps, рисуется в {drawn} для {shown}',
  'app.processes.sceneRate':
    '{place}: {name} при {fps} fps, рисуется в {drawn} для {shown}',
  'app.processes.place.graph': 'Визуализатор на графике',
  'app.processes.place.studio': 'Сцена Студии',
  'app.processes.name.window': 'Интерфейс',
  'app.processes.what.window':
    'Окно, которое вы видите: кривая, библиотека, проигрыватель, все регуляторы. По одному процессу на окно, чтобы тяжёлая перерисовка не тормозила звук. Визуализаторы Plus работают внутри него в собственном потоке, чтобы тяжёлая сцена не задерживала регуляторы.',
  'app.processes.name.core': 'Ядро приложения',
  'app.processes.what.core':
    'Часть без собственного окна. Хранит настройки, общается с аудиоустройствами и системным эквалайзером, проверяет обновления и запускает всё остальное из этого списка.',
  'app.processes.name.engine': 'Аудиодвижок (C++)',
  'app.processes.what.engine':
    'Собственный движок FluidEQ. Декодирует то, что вы слушаете, и попутно применяет эквалайзер. Это отдельная программа — потому Windows и держит её в стороне от остальных.',
  'app.processes.name.graphics': 'Графика',
  'app.processes.what.graphics':
    'Рисует всё на экране на видеокарте: спектр, кривую, каждую анимацию и сцены визуализаторов Plus. Занята всякий раз, когда что-то движется; никаких моделей здесь не работает.',
  'app.processes.name.desktop': 'Визуализатор рабочего стола',
  'app.processes.what.desktop':
    'Визуализатор Plus в роли фона рабочего стола монитора, отдельно от этого окна: по одному на каждый монитор, где он показан. Встаёт на паузу, пока окна закрывают этот монитор или ПК заблокирован.',
  'app.processes.name.desktopHost': 'Помощник визуализатора рабочего стола',
  'app.processes.what.desktopHost':
    'Помещает визуализатор рабочего стола этого монитора за значки и сообщает ему, когда окна закрывают экран. По одному на каждый монитор, где он показан.',
  'app.processes.name.shareCapture': 'Захват для отправки аудио',
  'app.processes.what.shareCapture':
    'Захватывает то, что играет этот ПК, до эквалайзера, чтобы отправить в другой FluidEQ. Работает, только пока вы делитесь аудио.',
  'app.processes.name.mediaWatch': 'Медиа других приложений',
  'app.processes.what.mediaWatch':
    'Читает, что играет Spotify, браузер или другой проигрыватель, чтобы панель проигрывателя могла это показать и управлять им. Закрывается, когда FluidEQ он больше не нужен.',
  'app.processes.name.models': 'Модели караоке',
  'app.processes.what.models':
    'Отделяет голос от музыки и следит за высотой пения, когда песня готовится для караоке. Запускается при первой необходимости и работает отдельно, чтобы сбой модели не обрушил приложение.',
  'app.processes.name.libraryScan': 'Сканирование библиотеки',
  'app.processes.what.libraryScan':
    'Читает ваши папки с музыкой, пока библиотека их сканирует: теги, длительность и обложки. Запускается на время сканирования и закрывается по его окончании.',
  'app.processes.name.sound': 'Звук браузера',
  'app.processes.what.sound':
    'Собственный звук Chromium — для вкладки «Онлайн-медиа» и звуков страницы. Ваша музыка через него не идёт.',
  'app.processes.name.network': 'Сеть',
  'app.processes.what.network':
    'Проверка обновлений, обложки и всё, что загружает вкладка «Онлайн-медиа». Больше ничто здесь в сеть не выходит.',
  'app.processes.name.devices': 'Список устройств',
  'app.processes.what.devices':
    'Запускается Chromium, когда приложение спрашивает у Windows, какие есть аудиоустройства; тот же запрос перечисляет и видеоустройства. Не открывает ни одной камеры и ничего не записывает.',
  'app.processes.name.page': 'Веб-страница',
  'app.processes.what.page':
    'Страница, открытая во вкладке «Онлайн-медиа». Работает в отдельном процессе, в стороне от интерфейса.',
  'app.processes.name.systemEngine': 'Движок FluidEQ (звук Windows)',
  'app.processes.what.systemEngine':
    'Эквалайзер, работающий внутри звуковой службы Windows, которая применяет его ко всему, что вы слышите. Windows делит эту службу с эффектами вашей звуковой карты, поэтому её память и ЦП показаны, но не входят в итог.',
  'app.processes.name.meter': 'Счётчик процессов',
  'app.processes.what.meter':
    'Измеряет цифры этого списка так же, как Диспетчер задач, чтобы итог сходился. Работает, только пока этот список открыт.',
  'app.processes.name.lighting': 'Динамическая подсветка',
  'app.processes.what.lighting':
    'Передаёт цвета сцены устройствам с поддержкой Windows Dynamic Lighting. Работает, только пока подсветка включена или открыта её страница.',
  'app.processes.name.helper': 'Вспомогательная служба',
  'app.processes.what.helper':
    'Служба Chromium, запускаемая по необходимости. FluidEQ никогда не просит её по имени.',
  'app.menu.reinstallApp': 'Переустановить {product}…',
  'app.menu.fixAudio': 'Исправить проблемы со звуком…',
  'engine.apo.reinstall': 'Переустановить Equalizer APO…',
  'engine.title': 'Как FluidEQ должен обрабатывать ваш звук?',
  'engine.subtitle':
    'Для всего компьютера работает один движок. Смена один раз запросит разрешение Windows.',
  'engine.now': 'Сейчас: {engine}',
  'engine.recommended': 'РЕКОМЕНДУЕТСЯ',
  'engine.fluid.name': 'Движок FluidEQ',
  'engine.fluid.l1':
    'Собственные эффекты и панель вашей звуковой карты продолжают работать',
  'engine.fluid.l2':
    'Эквалайзер и стойка DSP применяются ко всему, без перезапуска',
  'engine.fluid.l3': 'Свои команды APO, Peace и плагины VST не работают',
  'engine.fluid.l4':
    'Equalizer APO отключается, пока работает этот движок, и возвращается ровно таким же, если переключиться на него',
  'engine.apo.name': 'Equalizer APO',
  'engine.apo.l1': 'Свои команды, Peace, плагины VST',
  'engine.apo.l2':
    'Занимает слот эффектов вашей звуковой карты; панели производителя могут потерять регуляторы',
  'engine.apo.l3':
    'Стойка DSP работает только при воспроизведении из Библиотеки. Отдельная установка, Windows перезагружается.',
  'engine.apply': 'Применить',
  'engine.cancel': 'Отмена',
  'engine.close': 'Закрыть',
  'engine.switched': 'Переключено на {engine}',
  'engine.installing': 'Смена движка…',
  'engine.declined':
    'Разрешение Windows отклонено, поэтому ничего не изменилось.',
  'engine.failed': 'Не удалось сменить движок. Ничего не изменилось.',
  'engine.detachFailed':
    'Не удалось убрать движок FluidEQ с этого выхода. Ничего не изменилось.',
  'engine.unsupported': 'Требуется Windows 10 версии 1803 или новее.',
  'prereq.title.apo': 'Equalizer APO требует внимания',
  'prereq.title.fluid': 'Движок FluidEQ требует внимания',
  'prereq.install.apo': 'Установить APO',
  'prereq.install.fluid': 'Установить движок FluidEQ',
  'prereq.retry': 'Повторить',
  'prereq.dismiss': 'Закрыть',
  'prereq.credit.apo':
    'Equalizer APO входит в состав {product} — ничего скачиваться не будет. Его установщик спросит, какие звуковые устройства обрабатывать, и попросит перезагрузку. Отдельный проект под GPLv2 от {author}, включён без изменений.',
  'prereq.starting': 'Запуск…',
  'prereq.bundleMissing':
    'В этой сборке нет копии Equalizer APO. Вместо неё откроется официальный проект.',
  'prereq.notStarted':
    'Equalizer APO не запустился — нужны права администратора. Повторите и подтвердите запрос Windows.',
  'whatsNew.eyebrow': 'ИСТОРИЯ ВЕРСИЙ',
  'whatsNew.title': 'Примечания к выпускам FluidEQ',
  'whatsNew.loading': 'Загрузка заметок о выпуске…',
  'whatsNew.missing':
    'Заметки о выпуске не найдены в этой сборке. Они также есть на GitHub.',
  'whatsNew.ok': 'ОК',
  'app.menu.whatsNew': 'Что нового',
  'app.menu.language': 'Язык',
  'app.window.minimize': 'Свернуть',
  'app.window.maximize': 'Развернуть',
  'app.window.restore': 'Восстановить',
  'app.window.close': 'Закрыть',
  'app.tray.open': 'Открыть {product}',
  'app.tray.quit': 'Выйти из {product}',
  'app.tray.tooltip': '{product} — продолжает работать',
  'app.tray.installUpdate': 'Установить обновление и перезапустить',
  'app.tray.checkForUpdates': 'Проверить наличие обновлений',
  'app.tray.tooltip.updateReady': '{product} — обновление готово к установке',
  'app.notification.updateReady.title': 'Обновление FluidEQ готово',
  'app.notification.updateReady.body':
    'Версия {version} готова. Нажмите, чтобы перезапустить FluidEQ.',
  'app.notification.updateReady.bodyNoVersion':
    'Обновление готово. Нажмите, чтобы перезапустить FluidEQ.',
  'app.notification.upToDate.title': 'FluidEQ обновлён',
  'app.notification.upToDate.body': 'У вас уже последняя версия.',
  'app.notification.updateFound.title': 'Найдено обновление FluidEQ',
  'app.notification.updateFound.body':
    'Версия {version} загружается. Мы сообщим, когда её можно будет установить.',
  'app.notification.checkFailed.title': 'Не удалось проверить обновления',
  'app.notification.checkFailed.body':
    'Сервер обновлений недоступен. FluidEQ повторит попытку позже.',
  'app.notification.installFailed.title': 'Не удалось установить обновление',
  'app.notification.installFailed.body':
    'FluidEQ не смог запустить установщик. Нажмите, чтобы открыть FluidEQ и попробовать снова.',
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
  'common.search': 'Поиск…',
  'common.recentSearches': 'Недавние запросы',
  'common.clearRecentSearches': 'Очистить недавние запросы',
  'common.clearSearch': 'Очистить поиск',
  'common.noMatches': 'Ничего не найдено',
  'common.filterOptions': 'Фильтровать варианты',
  'common.increase': 'Увеличить {item}',
  'common.decrease': 'Уменьшить {item}',
  'common.icon.edit': 'Изменить',
  'common.icon.delete': 'Удалить',
  'common.icon.trash': 'Убрать',
  'common.icon.accept': 'Принять',
  'common.icon.cancel': 'Отмена',
  'tabs.aria': 'Рабочая область звука',
  'tabs.eq': 'Эквалайзер',
  'tabs.eqMain': 'Полосы',
  'tabs.presets': 'Пресеты EQ',
  'tabs.convolution': 'Свёртка',
  'tabs.games': 'Пресеты игр',
  'tabs.config': 'Config',
  'tabs.media': 'Онлайн-медиа',
  'tabs.mediaShort': 'Медиа',
  'tabs.karaoke': 'Караоке',
  'tabs.plus': 'Plus',
  'tabs.scrollBack': 'Прокрутить вкладки назад',
  'tabs.scrollForward': 'Прокрутить вкладки вперёд',
  'notice.apoReconfigured':
    'Equalizer APO был установлен или перенастроен. Если звук пропал, перезапустите службу звука Windows, а не весь компьютер.',
  'notice.restartNow': 'Перезапустить звук сейчас',
  'notice.importComplete': 'Импорт завершён',
  'notice.restartConfirm':
    'Звук пропадёт на несколько секунд, и Windows запросит права администратора. Продолжить?',
  'restart.title': 'Перезапустить звук Windows',
  'restart.action': 'Перезапустить звук',
  'restart.running': 'Перезапуск звука…',
  'restart.failed': 'Не удалось перезапустить звук Windows.',
  'restart.tryAgain': 'Попробовать снова',
  'restart.close': 'Закрыть',
  'restart.declined':
    'Разрешение Windows отклонено, поэтому звук не был перезапущен.',
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
  'sidebar.headroom.fluid': 'ЗАПАС',
  'sidebar.autoPreamp': 'Авто-нормализация',
  'sidebar.visualizer': 'ВИЗУАЛИЗАЦИЯ',
  'sidebar.graphView': 'График АЧХ',
  'config.eyebrow': 'ЧТО ЧИТАЕТ ДВИЖОК',
  'config.title': 'Конфигурация Equalizer APO',
  'config.title.fluid': 'Конфигурация движка FluidEQ',
  'config.lede': 'То, что сейчас лежит на диске, а не то, что задумал FluidEQ.',
  'config.reload': 'Обновить',
  'config.reloadTitle': 'Перечитать конфигурацию с диска',
  'config.reading': 'Чтение…',
  'config.absent':
    'FluidEQ ещё ничего не записал в эту установку Equalizer APO.',
  'config.absent.fluid': 'FluidEQ ещё не записал конфигурацию движка FluidEQ.',
  'config.status.notIncluded':
    'Equalizer APO не подключает эту конфигурацию. Ничего из перечисленного ниже не применяется.',
  'config.status.notIncluded.fluid':
    'Движок FluidEQ не читает эту конфигурацию. Ничего из перечисленного ниже не применяется.',
  'config.status.engineOff':
    'Системный эквалайзер выключен — в этой конфигурации не назван ни один выход, поэтому Equalizer APO ничего из неё не применяет.',
  'config.status.engineOff.fluid':
    'Системный эквалайзер выключен — в этой конфигурации не назван ни один выход, поэтому движок FluidEQ ничего из неё не применяет.',
  'config.status.active': 'Активна — Equalizer APO применяет эту конфигурацию.',
  'config.status.active.fluid':
    'Активна — движок FluidEQ применяет эту конфигурацию.',
  'config.outputsAria': 'Выходы в конфигурации Equalizer APO',
  'config.outputsAria.fluid': 'Выходы в конфигурации движка FluidEQ',
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
  'config.hint.saving.fluid':
    'Сохранение записывает файл; движок FluidEQ его подхватывает.',
  'config.edit': 'Изменить',
  'config.cancel': 'Отмена',
  'config.save': 'Сохранить',
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
  'language.aria': 'Язык интерфейса',
  'theme.aria': 'Тема',
  'motion.aria': 'Анимация',
  'motion.restart': 'Перезапустите FluidEQ, чтобы применить',
  'startup.label': 'Запускать вместе с Windows',
  'startup.blocked': 'Windows отключил это в «Автозагрузке приложений»',
  'startup.failed': 'Windows не разрешил это изменить',
  'theme.ocean': 'Светлая',
  'theme.black': 'Тёмная',
  // The settings a visualizer has, grouped the same way and in the same
  // order wherever they are offered — see `common/settingsGroups.ts`.
  'settings.group.picture': 'Картинка',
  'settings.group.visualizer': 'Визуализатор',
  'settings.group.drawing': 'Как это рисуется',
  'settings.group.thisView': 'Этот вид',
  'settings.group.studioOnly': 'Только здесь, в Студии',

  // Game profiles: the page, its list and what it says.
  'games.add': 'Добавить игру',
  'games.addHint':
    'Выберите игру из своих лаунчеров или программу, открытую сейчас.',
  'games.choose': 'Выбрать программу…',
  'games.group.installed': 'Установленные',
  'games.group.running': 'Открыты сейчас',
  'games.source.steam': 'Steam',
  'games.source.epic': 'Epic Games',
  'games.source.ea': 'EA',
  'games.source.gog': 'GOG',
  'games.source.ubisoft': 'Ubisoft',
  'games.source.battlenet': 'Battle.net',
  'games.source.xbox': 'Xbox',
  'games.source.running': 'Открыта сейчас',
  'games.source.file': 'Выбрано вами',
  'games.front.playing': '{name} на переднем плане, её звук включён.',
  'games.front.sounding': '{name} запущена, её звук включён.',
  'games.toast.loaded': 'Загружено: {preset}',
  'games.toast.forGame': 'для {game}',
  'games.toast.restored': 'Снова: {preset}',
  'games.toast.restoredNone': 'Эффекты снова выключены',
  'games.toast.afterGame': 'после {game}',
  'games.empty.title': 'Игр пока нет',
  'games.empty.more':
    'Добавьте игру, дайте ей звук — и FluidEQ переключится на него, как только игра выйдет на передний план, и вернётся, когда вы закроете игру.',
  'games.preset.none': 'Оставить как есть',
  'games.preset.noneHint':
    'Ничего не меняется, когда эта игра на переднем плане.',
  'games.row.inFront': 'на переднем плане',
  'games.row.sounding': 'звук включён',
  'games.row.sound': 'Звук для {name}',
  'games.row.remove': 'Убрать {name}',
};

export default app;
