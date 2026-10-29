/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const remoteAudio = {
  'remoteAudio.group.add': '新增電腦',
  'remoteAudio.group.title': '全團',
  'remoteAudio.group.mix': '我的混音',
  'remoteAudio.group.thisPC': '這臺電腦',
  'remoteAudio.group.receive': '接收',
  'remoteAudio.group.send': '傳送',
  'remoteAudio.group.share': '分享',
  'remoteAudio.group.smooth': '流暢',
  'remoteAudio.group.smoothHint': '適合音樂：永不中斷，約晚半秒播放',
  'remoteAudio.group.options': '{name} 的選項',
  'remoteAudio.group.count.one': '{count}電腦',
  'remoteAudio.group.count.few': '{count} 電腦',
  'remoteAudio.group.count.many': '{count} 電腦',
  'remoteAudio.group.count.other': '{count} 電腦',
  'remoteAudio.group.sourceOff': '共享已關閉',
  'remoteAudio.group.offline': '離線',
  'remoteAudio.group.unavailable': '系統音量不可用',
  'remoteAudio.group.mute': '將這臺電腦靜音',
  'remoteAudio.group.unmute': '取消這臺電腦的靜音',
  'remoteAudio.group.output': '輸出',
  'remoteAudio.group.hint':
    '連結電腦以加入其組。每臺電腦將自己的聲音直接傳送給其他電腦；調整您在混音中聽到的內容。',
  'tabs.share': '分享音訊',
  'remoteAudio.eyebrow': '區域網路音訊',
  'remoteAudio.title': '在電腦之間共享音訊',
  'remoteAudio.security': '連線屬性',
  'remoteAudio.badge.local': '僅專用 LAN',
  'remoteAudio.badge.lossless': '無損 Float32 PCM 傳輸',
  'remoteAudio.badge.encrypted': 'AES-256-GCM 加密',
  'remoteAudio.link.thisComputer': '這臺電腦',
  'remoteAudio.link.thisHint':
    '將此程式碼貼到另一臺電腦上，或將該電腦的程式碼貼到此處。無論哪種方式都有效。',
  'remoteAudio.link.or': '或',
  'remoteAudio.link.otherComputer': '另一臺電腦的程式碼',
  'remoteAudio.link.codeLabel': '連執行緒式碼',
  'remoteAudio.link.placeholder': '貼上 FLUIDEQ-LAN-2…',
  'remoteAudio.link.start': '連線',
  'remoteAudio.link.otherHint':
    '兩臺電腦立即互相玩遊戲。如果您只需要一個方向，請稍後關閉任一方向。',
  'remoteAudio.link.once':
    '做一次。重新啟動後，連結的電腦從任意一側再次找到對方。',
  'remoteAudio.link.many':
    '相同的程式碼可連結任意數量的電腦，取消其中一臺電腦的連結後，其餘電腦仍保持連結狀態。',
  'remoteAudio.rule.echoTitle': '兩邊都沒有迴音',
  'remoteAudio.rule.echo':
    '每臺電腦只傳送它自己播放的內容，而不是它接收到的聲音，因此沒有任何回傳。',
  'remoteAudio.rule.eqTitle': '你聆聽時的EQ',
  'remoteAudio.rule.eq':
    '聲音保持不變。您聽到它的電腦會施加一次 EQ、耳機曲線和 DSP。',
  'remoteAudio.rule.steadyTitle': '穩定播放，不隨時間偏移',
  'remoteAudio.rule.steady':
    '約延遲 30 ms，並持續維持這個延遲。兩端時鐘會保持同步，避免斷音或隨時間逐漸偏移。',
  'remoteAudio.linked.cardLabel': '與 {name} 連結',
  'remoteAudio.linked.bothWays': '兩種方式',
  'remoteAudio.linked.incomingOnly': '僅限傳入',
  'remoteAudio.linked.outgoingOnly': '僅限傳出',
  'remoteAudio.linked.paused': '已暫停',
  'remoteAudio.linked.lossless': '無損',
  'remoteAudio.linked.unlink': '取消連結',
  'remoteAudio.linked.pause': '暫停',
  'remoteAudio.linked.resume': '繼續',
  'remoteAudio.lane.inPaused': '暫停了。在您恢復之前，這裡不會播放任何內容。',
  'remoteAudio.lane.outPaused': '暫停了。在您恢復之前不會傳送任何內容。',
  'remoteAudio.lane.volume': '{name} 的聲音音量',
  'remoteAudio.lane.pausedThere': '{name} 暫停了連結。',
  'remoteAudio.linked.noEcho': '無迴聲：{name} 的聲音永遠不會發送回它。',
  'remoteAudio.linked.untouched':
    '雙向保持不變 - 每臺電腦都套用自己的 EQ 和 DSP。',
  'remoteAudio.lane.from': '來自 {name}',
  'remoteAudio.lane.to': '至 {name}',
  'remoteAudio.lane.playsHere': '在這裡播放',
  'remoteAudio.lane.yourSound': '你的聲音',
  'remoteAudio.lane.playItHere': '在這裡播放',
  'remoteAudio.lane.sendMySound': '傳送我的聲音',
  'remoteAudio.lane.delay': '延遲',
  'remoteAudio.lane.sent': '已傳送',
  'remoteAudio.lane.received': '收到',
  'remoteAudio.lane.milliseconds': '{milliseconds} 毫秒',
  'remoteAudio.lane.megabits': '{megabits} Mb/s',
  'remoteAudio.lane.receiving': '接收',
  'remoteAudio.lane.paused': '已暫停',
  'remoteAudio.lane.inQuiet': '{name} 上沒有播放任何內容',
  'remoteAudio.lane.inOff': '關閉：{name} 的聲音在此電腦上不播放。',
  'remoteAudio.lane.inNotSent': '{name} 已關閉「傳送我的聲音」。',
  'remoteAudio.lane.inOld':
    '{name} 需要最新的 FluidEQ 才能將其聲音傳送到此處。',
  'remoteAudio.lane.inOneWay':
    '兩種方式都需要 Windows 或 Linux 上的 FluidEQ 引擎。',
  'remoteAudio.lane.outQuiet': '這臺電腦上沒有任何遊戲',
  'remoteAudio.lane.outSounding': '這臺電腦上正在播放聲音',
  'remoteAudio.lane.outOff': '不傳送。 {name} 聽不到這臺電腦的聲音。',
  'remoteAudio.lane.outNotPlayed': '{name} 已關閉「在這裡播放」。',
  'remoteAudio.lane.outOld': '{name} 需要最新的 FluidEQ 才能播放此電腦的聲音。',
  'remoteAudio.lane.outOneWay':
    '雙向傳送需要 Windows 或 Linux 上的 FluidEQ 引擎。',
  'remoteAudio.lane.outFailed':
    '無法捕捉該電腦的聲音。關閉並開啟“傳送我的聲音”以重試。',
  'remoteAudio.singlePlayer.title': '一次僅由一個播放器播放',
  'remoteAudio.singlePlayer.body':
    '也涵蓋了連結的電腦：在一臺電腦上啟動某些內容會暫停另一臺電腦上正在播放的內容。',
  'remoteAudio.code.copy': '複製程式碼',
  'remoteAudio.code.copied': '已複製',
  'remoteAudio.code.label': '這臺電腦的程式碼',
  'remoteAudio.status.preparing': '正在準備…',
  'remoteAudio.status.noNetwork': '將這臺電腦連線到網路以取得其程式碼。',
  'remoteAudio.status.playbackBlocked': '按下“繼續”即可聽到音訊',
  'remoteAudio.resume': '恢復音訊',
  'remoteAudio.retry': '再試一次',
  'remoteAudio.monitor.networkHealthy': '網路暢通',
  'remoteAudio.monitor.networkQueued': '{milliseconds} 排隊毫秒數',
  'remoteAudio.note.title': '安靜地開始。',
  'remoteAudio.note.body':
    '兩臺電腦同時玩的話加起來就變多了。在第一個連結之前降低音量。',
  'remoteAudio.error.lan':
    'FluidEQ 無法開啟該本地連線。確保兩臺電腦位於同一專用網路上，並允許 FluidEQ 通過防火牆。',
  'remoteAudio.error.code':
    '這不是 FluidEQ 程式碼，或是這臺電腦自己的程式碼。從另一臺電腦的共享音訊頁面複製程式碼。',
  'remoteAudio.error.capture':
    'FluidEQ 無法擷取該電腦的系統音訊。檢查目前的輸出裝置，然後重試。',
  'remoteAudio.error.playback':
    'FluidEQ 無法啟動無損音訊引擎。重新啟動 FluidEQ 並重試。',
  'remoteAudio.error.connection':
    '加密音訊連線停止。 FluidEQ 不斷尋找另一臺電腦；當該電腦恢復時，它會自行重新連線。',
} satisfies Partial<Dictionary>;

export default remoteAudio;
