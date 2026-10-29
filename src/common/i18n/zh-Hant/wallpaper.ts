/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const wallpaper = {
  'wallpaper.action': '設定為桌面背景',
  'wallpaper.title': '桌面背景',
  'wallpaper.description':
    '將此視覺化工具放在桌面圖示後面，隨音樂移動或獨自平靜。',
  'wallpaper.manage.description': '每個顯示器在桌面圖示後面顯示的內容。',
  'wallpaper.manage.empty': '每臺顯示器都顯示其普通的 Windows 背景。',
  'wallpaper.monitors': '顯示器',
  'wallpaper.monitors.hint':
    '選擇它播放的地方。每個監視器都可以顯示自己的視覺化工具。',
  'wallpaper.monitors.all': '所有顯示器',
  'wallpaper.monitor.name': '監視器 {number}',
  'wallpaper.monitor.primary': '小學',
  'wallpaper.monitor.size': '{width} × {height}',
  'wallpaper.monitor.ordinary': '視窗背景',
  'wallpaper.monitor.disconnected': '顯示器斷開連線',
  'wallpaper.visualizer.unknown': '視覺化效果',
  'wallpaper.pauseOnBattery': '暫停電池電量',
  'wallpaper.pauseOnBattery.hint': '當電腦拔掉電源插頭時可節省電力。',
  'wallpaper.motion': '運動',
  'wallpaper.motion.music': '隨著音樂',
  'wallpaper.motion.music.hint': '移動到正在播放的任何內容。',
  'wallpaper.motion.calm': '冷靜',
  'wallpaper.motion.calm.hint': '忽略音樂的緩慢、安靜的動畫。',
  'wallpaper.follow': '跟隨圖',
  'wallpaper.follow.hint':
    '顯示圖表正在顯示的場景並隨之更改，無論您選擇它還是自動切換。雖然圖表顯示了一種樣式，但此畫面保留了最後一個場景。',
  'wallpaper.follow.choice':
    '無論您選擇還是自動切換，所選監視器都會隨著圖形的場景而變化，並在圖形顯示樣式時保留最後一個。',
  'wallpaper.cancel': '取消',
  'wallpaper.done': '完成',
  'wallpaper.start': '設定背景',
  'wallpaper.start.many': '在 {count} 顯示器上設定',
  'wallpaper.retry': '再試一次',
  'wallpaper.stop': '停止',
  'wallpaper.stopAll': '全部停止',
  'wallpaper.manage': '管理',
  'wallpaper.phase.playing': '演奏',
  'wallpaper.phase.starting': '開始',
  'wallpaper.phase.paused': '已暫停',
  'wallpaper.phase.stopped': '已停止',
  'wallpaper.status.starting': '啟動桌面背景...',
  'wallpaper.status.running': '桌面背景正在播放',
  'wallpaper.status.runningMany': '在 {count} 顯示器上播放',
  'wallpaper.status.paused': '桌面背景已暫停',
  'wallpaper.status.pausedMany': '在 {count} 監視器上暫停',
  'wallpaper.status.failedMany': '在 {count} 監視器上停止',
  'wallpaper.status.stopping': '停止桌面背景...',
  'wallpaper.pause.locked': 'Windows 鎖定時暫停',
  'wallpaper.pause.suspended': '電腦休眠時暫停',
  'wallpaper.pause.battery': '暫停以節省電量',
  'wallpaper.pause.game': '比賽正在進行時暫停',
  'wallpaper.pause.covered': '當視窗覆蓋此顯示器時暫停',
  'wallpaper.error.unsupported': 'Windows 和 macOS 上提供桌面背景。',
  'wallpaper.error.unavailable': '無法訪問桌面背景。再試一次。',
  'wallpaper.error.notEntitled':
    '這個場景還不是你的。將其放在相簿中並將其放在桌面上。',
  'wallpaper.error.missingScene': '不再安裝此視覺化工具。再次新增並重試。',
  'wallpaper.error.refused':
    '此視覺化工具在該電腦的圖形上失敗。再次設定以再次嘗試。',
  'wallpaper.error.missingDisplay':
    '該監視器已斷開連線。當它重新插入時，它的背景就會恢復。',
  'wallpaper.error.host': 'Windows 無法將視覺化工具放置在桌面上。再試一次。',
  'wallpaper.error.renderer': '視覺化工具無法在桌面上繪圖。再試一次。',
  'wallpaper.error.audio': '桌面視覺化工具失去了音樂訊號。再試一次。',
} satisfies Partial<Dictionary>;

export default wallpaper;
