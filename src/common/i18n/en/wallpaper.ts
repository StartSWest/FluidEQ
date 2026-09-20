const wallpaper = {
  'wallpaper.action': 'Set as desktop background',
  'wallpaper.actionPlus': 'Set as desktop background, with FluidEQ Plus',
  'wallpaper.title': 'Desktop background',
  'wallpaper.description':
    'Keep this visualizer behind your desktop icons, moving with your music or calmly on its own.',
  'wallpaper.manage.description':
    'What each monitor shows behind your desktop icons.',
  'wallpaper.manage.empty':
    'Every monitor is showing its ordinary Windows background.',
  'wallpaper.monitors': 'Monitors',
  'wallpaper.monitors.hint':
    'Pick where it plays. Each monitor can show a visualizer of its own.',
  'wallpaper.monitors.all': 'All monitors',
  'wallpaper.monitor.name': 'Monitor {number}',
  'wallpaper.monitor.primary': 'Primary',
  'wallpaper.monitor.size': '{width} × {height}',
  'wallpaper.monitor.ordinary': 'Windows background',
  'wallpaper.monitor.disconnected': 'Disconnected monitor',
  'wallpaper.visualizer.unknown': 'Visualizer',
  'wallpaper.pauseOnBattery': 'Pause on battery power',
  'wallpaper.pauseOnBattery.hint':
    'Saves power when this computer is unplugged.',
  'wallpaper.motion': 'Motion',
  'wallpaper.motion.music': 'With the music',
  'wallpaper.motion.music.hint': 'Moves to whatever is playing.',
  'wallpaper.motion.calm': 'Calm',
  'wallpaper.motion.calm.hint':
    'A slow, quiet animation that ignores the music.',
  'wallpaper.cancel': 'Cancel',
  'wallpaper.done': 'Done',
  'wallpaper.start': 'Set background',
  'wallpaper.start.many': 'Set on {count} monitors',
  'wallpaper.retry': 'Try again',
  'wallpaper.stop': 'Stop',
  'wallpaper.stopAll': 'Stop all',
  'wallpaper.manage': 'Manage',
  'wallpaper.phase.playing': 'Playing',
  'wallpaper.phase.starting': 'Starting',
  'wallpaper.phase.paused': 'Paused',
  'wallpaper.phase.stopped': 'Stopped',
  'wallpaper.status.starting': 'Starting desktop background…',
  'wallpaper.status.running': 'Desktop background is playing',
  'wallpaper.status.runningMany': 'Playing on {count} monitors',
  'wallpaper.status.paused': 'Desktop background is paused',
  'wallpaper.status.pausedMany': 'Paused on {count} monitors',
  'wallpaper.status.failedMany': 'Stopped on {count} monitors',
  'wallpaper.status.stopping': 'Stopping desktop background…',
  'wallpaper.pause.locked': 'Paused while Windows is locked',
  'wallpaper.pause.suspended': 'Paused while the computer sleeps',
  'wallpaper.pause.battery': 'Paused to save battery',
  'wallpaper.pause.covered': 'Paused while windows cover this monitor',
  'wallpaper.error.unsupported':
    'Desktop backgrounds are available on Windows.',
  'wallpaper.error.unavailable':
    'The desktop background could not be reached. Try again.',
  'wallpaper.error.notEntitled':
    'Desktop visualizers are included with FluidEQ Plus.',
  'wallpaper.error.missingScene':
    'This visualizer is no longer installed. Add it again and retry.',
  'wallpaper.error.refused':
    "This visualizer failed on this computer's graphics. Set it again to try it once more.",
  'wallpaper.error.missingDisplay':
    'That monitor is disconnected. Its background returns when it is plugged back in.',
  'wallpaper.error.host':
    'Windows could not place the visualizer on the desktop. Try again.',
  'wallpaper.error.renderer':
    'The visualizer could not draw on the desktop. Try again.',
  'wallpaper.error.audio':
    'The desktop visualizer lost its music signal. Try again.',
} as const;

export default wallpaper;
