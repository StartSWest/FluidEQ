const wallpaper = {
  'wallpaper.action': 'デスクトップの背景に設定',
  'wallpaper.actionPlus': 'デスクトップの背景に設定（FluidEQ Plus）',
  'wallpaper.title': 'デスクトップの背景',
  'wallpaper.description':
    'このビジュアライザーをデスクトップアイコンの背面に表示し、音楽に合わせて、または穏やかに単独で動かします。',
  'wallpaper.manage.description':
    '各モニターがデスクトップアイコンの背面に表示している内容です。',
  'wallpaper.manage.empty':
    'すべてのモニターに通常の Windows の背景が表示されています。',
  'wallpaper.monitors': 'モニター',
  'wallpaper.monitors.hint':
    '再生するモニターを選びます。モニターごとに別のビジュアライザーを表示できます。',
  'wallpaper.monitors.all': 'すべてのモニター',
  'wallpaper.monitor.name': 'モニター {number}',
  'wallpaper.monitor.primary': 'メイン',
  'wallpaper.monitor.size': '{width} × {height}',
  'wallpaper.monitor.ordinary': 'Windows の背景',
  'wallpaper.monitor.disconnected': '切断されたモニター',
  'wallpaper.visualizer.unknown': 'ビジュアライザー',
  'wallpaper.pauseOnBattery': 'バッテリー使用時に一時停止',
  'wallpaper.pauseOnBattery.hint':
    'コンピューターが電源に接続されていないときに電力を節約します。',
  'wallpaper.motion': '動き',
  'wallpaper.motion.music': '音楽に合わせる',
  'wallpaper.motion.music.hint': '再生中の音楽に合わせて動きます。',
  'wallpaper.motion.calm': '穏やか',
  'wallpaper.motion.calm.hint':
    '音楽に反応しない、ゆっくりとした静かなアニメーションです。',
  'wallpaper.cancel': 'キャンセル',
  'wallpaper.done': '完了',
  'wallpaper.start': '背景に設定',
  'wallpaper.start.many': '{count} 台のモニターに設定',
  'wallpaper.retry': 'もう一度試す',
  'wallpaper.stop': '停止',
  'wallpaper.stopAll': 'すべて停止',
  'wallpaper.manage': '管理',
  'wallpaper.phase.playing': '再生中',
  'wallpaper.phase.starting': '開始中',
  'wallpaper.phase.paused': '一時停止中',
  'wallpaper.phase.stopped': '停止',
  'wallpaper.status.starting': 'デスクトップの背景を開始しています…',
  'wallpaper.status.running': 'デスクトップの背景を再生中',
  'wallpaper.status.runningMany': '{count} 台のモニターで再生中',
  'wallpaper.status.paused': 'デスクトップの背景は一時停止中です',
  'wallpaper.status.pausedMany': '{count} 台のモニターで一時停止中',
  'wallpaper.status.failedMany': '{count} 台のモニターで停止しました',
  'wallpaper.status.stopping': 'デスクトップの背景を停止しています…',
  'wallpaper.pause.locked': 'Windows のロック中は一時停止します',
  'wallpaper.pause.suspended': 'コンピューターのスリープ中は一時停止します',
  'wallpaper.pause.battery': 'バッテリー節約のため一時停止しています',
  'wallpaper.pause.covered':
    'ウィンドウがこのモニターを覆っている間は一時停止します',
  'wallpaper.error.unsupported':
    'デスクトップの背景は Windows で利用できます。',
  'wallpaper.error.unavailable':
    'デスクトップの背景に接続できませんでした。もう一度お試しください。',
  'wallpaper.error.notEntitled':
    'デスクトップ ビジュアライザーは FluidEQ Plus に含まれています。',
  'wallpaper.error.missingScene':
    'このビジュアライザーはインストールされていません。もう一度追加してお試しください。',
  'wallpaper.error.refused':
    'このビジュアライザーはこのコンピューターのグラフィックスで問題を起こしました。もう一度設定すると再試行できます。',
  'wallpaper.error.missingDisplay':
    'そのモニターは切断されています。再接続すると背景が戻ります。',
  'wallpaper.error.host':
    'Windows がビジュアライザーをデスクトップに配置できませんでした。もう一度お試しください。',
  'wallpaper.error.renderer':
    'ビジュアライザーをデスクトップに描画できませんでした。もう一度お試しください。',
  'wallpaper.error.audio':
    'デスクトップ ビジュアライザーが音楽信号を受信できなくなりました。もう一度お試しください。',
} as const;

export default wallpaper;
