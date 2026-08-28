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
  'app.menu.fix': 'Исправить',
  'app.menu.reportProblem': 'Сообщить о проблеме',
  'app.menu.about': 'О программе {product}…',
  'app.processes.menu': 'Процессы…',
  'app.processes.eyebrow': 'Процессы',
  'app.processes.hint':
    'Windows называет каждый из них именем приложения, потому что это одна и та же программа. Здесь видно, чем каждый занят на самом деле.',
  'app.processes.process': 'Процесс',
  'app.processes.pid': 'PID',
  'app.processes.memory': 'Память',
  'app.processes.cpu': 'ЦП',
  'app.processes.thisWindow': 'это окно',
  'app.processes.total': 'Всего {megabytes} МБ.',
  'app.processes.kindMain': 'Главный',
  'app.processes.kindWindow': 'Окно',
  'app.processes.kindGpu': 'GPU',
  'app.processes.kindUtility': 'Служба',
  'app.processes.kindDsp': 'Движок DSP (C++)',
  'app.menu.reinstallApp': 'Переустановить {product}…',
  'app.menu.fixAudio': 'Исправить проблемы со звуком…',
  'app.menu.reinstallApo': 'Переустановить Equalizer APO…',
  'whatsNew.eyebrow': 'ЗАМЕТКИ О ВЫПУСКЕ',
  'whatsNew.title': 'Что нового в FluidEQ',
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
  'tabs.voicing': 'Характер',
  'tabs.convolution': 'Свёртка',
  'tabs.config': 'Config',
  'tabs.media': 'Медиа',
  'tabs.karaoke': 'Караоке',
  'tabs.scrollBack': 'Прокрутить вкладки назад',
  'tabs.scrollForward': 'Прокрутить вкладки вперёд',
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
};

export default app;
