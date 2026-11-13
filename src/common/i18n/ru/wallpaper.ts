const wallpaper = {
  'wallpaper.action': 'Установить как фон рабочего стола',
  'wallpaper.title': 'Фон рабочего стола',
  'wallpaper.description':
    'Оставьте эту сцену за значками рабочего стола: она будет двигаться под вашу музыку или спокойно сама по себе.',
  'wallpaper.manage.description':
    'Что показывает каждый монитор за значками рабочего стола.',
  'wallpaper.manage.empty': 'Все мониторы показывают обычный фон Windows.',
  'wallpaper.monitors': 'Мониторы',
  'wallpaper.monitors.hint':
    'Выберите, где она будет играть. На каждом мониторе может быть своя сцена.',
  'wallpaper.monitors.all': 'Все мониторы',
  'wallpaper.monitor.name': 'Монитор {number}',
  'wallpaper.monitor.primary': 'Основной',
  'wallpaper.monitor.size': '{width} × {height}',
  'wallpaper.monitor.ordinary': 'Фон Windows',
  'wallpaper.monitor.disconnected': 'Отключённый монитор',
  'wallpaper.visualizer.unknown': 'Сцена',
  'wallpaper.pauseOnBattery': 'Приостанавливать при питании от батареи',
  'wallpaper.pauseOnBattery.hint':
    'Экономит заряд, когда компьютер отключён от сети.',
  'wallpaper.motion': 'Движение',
  'wallpaper.motion.music': 'Под музыку',
  'wallpaper.motion.music.hint': 'Движется под то, что сейчас играет.',
  'wallpaper.motion.calm': 'Спокойно',
  'wallpaper.motion.calm.hint':
    'Медленная тихая анимация, которая не слушает музыку.',
  'wallpaper.follow': 'Как на графике',
  'wallpaper.follow.hint':
    'Показывает сцену, открытую на графике, и меняется вместе с ней — вручную или при автосмене. Пока на графике стиль, этот экран оставляет последнюю сцену.',
  'wallpaper.follow.choice':
    'Выбранные мониторы меняются вместе со сценой на графике — вручную или при автосмене — и оставляют последнюю, пока на графике стиль.',
  'wallpaper.daylight': 'Время суток на мониторе',
  'wallpaper.daylight.hint':
    'Для монитора, который не следует за графиком: время суток, заданное вами, яркость приложения или часы компьютера.',
  'wallpaper.daylight.following':
    'Этот монитор следует за графиком, поэтому берёт время суток графика.',
  'wallpaper.interactive': 'Интерактивный',
  'wallpaper.interactive.hint':
    'Отвечает на мышь на пустом рабочем столе, как на графике.',
  'wallpaper.cancel': 'Отмена',
  'wallpaper.done': 'Готово',
  'wallpaper.start': 'Установить фон',
  'wallpaper.start.many': 'Установить на мониторы: {count}',
  'wallpaper.retry': 'Повторить',
  'wallpaper.stop': 'Остановить',
  'wallpaper.stopAll': 'Остановить все',
  'wallpaper.manage': 'Управление',
  'wallpaper.phase.playing': 'Играет',
  'wallpaper.phase.starting': 'Запуск',
  'wallpaper.phase.paused': 'Пауза',
  'wallpaper.phase.stopped': 'Остановлен',
  'wallpaper.status.starting': 'Запуск фона рабочего стола…',
  'wallpaper.status.running': 'Фон рабочего стола работает',
  'wallpaper.status.runningMany': 'Играет на мониторах: {count}',
  'wallpaper.status.paused': 'Фон рабочего стола приостановлен',
  'wallpaper.status.pausedMany': 'Приостановлено на мониторах: {count}',
  'wallpaper.status.failedMany': 'Остановлено на мониторах: {count}',
  'wallpaper.status.stopping': 'Остановка фона рабочего стола…',
  'wallpaper.pause.locked': 'Приостановлено, пока Windows заблокирована',
  'wallpaper.pause.suspended': 'Приостановлено, пока компьютер спит',
  'wallpaper.pause.battery': 'Приостановлено для экономии заряда',
  'wallpaper.pause.game': 'Приостановлено, пока игра на переднем плане',
  'wallpaper.pause.covered': 'Приостановлено, пока окна закрывают этот монитор',
  'wallpaper.error.unsupported': 'Фоны рабочего стола доступны в Windows.',
  'wallpaper.error.unavailable':
    'Не удалось связаться с фоном рабочего стола. Повторите попытку.',
  'wallpaper.error.notEntitled':
    'Эта сцена пока не ваша. Получите её в Галерее, чтобы поставить на рабочий стол.',
  'wallpaper.error.missingScene':
    'Эта сцена больше не установлена. Добавьте её снова и повторите попытку.',
  'wallpaper.error.refused':
    'Эта сцена вызвала сбой графики на этом компьютере. Установите её снова, чтобы попробовать ещё раз.',
  'wallpaper.error.missingDisplay':
    'Этот монитор отключён. Его фон вернётся, когда вы снова его подключите.',
  'wallpaper.error.host':
    'Windows не удалось разместить сцену на рабочем столе. Повторите попытку.',
  'wallpaper.error.renderer':
    'Не удалось отобразить сцену на рабочем столе. Повторите попытку.',
  'wallpaper.error.audio':
    'Сцена рабочего стола потеряла музыкальный сигнал. Повторите попытку.',
} as const;

export default wallpaper;
