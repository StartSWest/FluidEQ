const wallpaper = {
  'wallpaper.action': 'Установить как фон рабочего стола',
  'wallpaper.actionPlus': 'Установить как фон рабочего стола, с FluidEQ Plus',
  'wallpaper.title': 'Фон рабочего стола',
  'wallpaper.description':
    'Оставьте этот визуализатор за значками рабочего стола: он будет двигаться под вашу музыку или спокойно сам по себе.',
  'wallpaper.manage.description':
    'Что показывает каждый монитор за значками рабочего стола.',
  'wallpaper.manage.empty': 'Все мониторы показывают обычный фон Windows.',
  'wallpaper.monitors': 'Мониторы',
  'wallpaper.monitors.hint':
    'Выберите, где он будет играть. На каждом мониторе может быть свой визуализатор.',
  'wallpaper.monitors.all': 'Все мониторы',
  'wallpaper.monitor.name': 'Монитор {number}',
  'wallpaper.monitor.primary': 'Основной',
  'wallpaper.monitor.size': '{width} × {height}',
  'wallpaper.monitor.ordinary': 'Фон Windows',
  'wallpaper.monitor.disconnected': 'Отключённый монитор',
  'wallpaper.visualizer.unknown': 'Визуализатор',
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
    'Показывает Plus-визуализатор, открытый на графике, и меняется вместе с ним — вручную или при автосмене. Пока на графике визуализатор не из Plus, этот экран оставляет последний Plus-визуализатор.',
  'wallpaper.follow.choice':
    'Выбранные мониторы меняются вместе с Plus-визуализатором на графике — вручную или при автосмене — и оставляют последний, пока на графике визуализатор не из Plus.',
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
    'Визуализаторы рабочего стола входят в FluidEQ Plus.',
  'wallpaper.error.missingScene':
    'Этот визуализатор больше не установлен. Добавьте его снова и повторите попытку.',
  'wallpaper.error.refused':
    'Этот визуализатор вызвал сбой графики на этом компьютере. Установите его снова, чтобы попробовать ещё раз.',
  'wallpaper.error.missingDisplay':
    'Этот монитор отключён. Его фон вернётся, когда вы снова его подключите.',
  'wallpaper.error.host':
    'Windows не удалось разместить визуализатор на рабочем столе. Повторите попытку.',
  'wallpaper.error.renderer':
    'Не удалось отобразить визуализатор на рабочем столе. Повторите попытку.',
  'wallpaper.error.audio':
    'Визуализатор рабочего стола потерял музыкальный сигнал. Повторите попытку.',
} as const;

export default wallpaper;
