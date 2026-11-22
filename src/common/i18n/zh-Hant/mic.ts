/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab: each microphone's own sound, played by the FluidEQ Engine on
 * the microphone itself, so every app hears it (Ivan, 2026-11-20).
 */
export default {
  'mic.tab': '麥克風',
  'mic.label': '麥克風',
  'mic.pickHint': '選擇要調整的麥克風',
  'mic.list.heading': '這台電腦上的麥克風',
  'mic.list.on': '已開啟',
  'mic.list.off': '尚未設定',
  'mic.live': '所有應用程式即時套用 · 低延遲 {ms} ms',
  'mic.notSetUp': '這支麥克風尚未設定',
  'mic.picture.label':
    '你的聲音：淡色線是麥克風收到的聲音，亮色線是別人聽到的聲音',
  'mic.picture.raw': '你的麥克風',
  'mic.picture.heard': '別人聽到的',
  'mic.picture.gate': '噪音門',
  'mic.profile.label': '麥克風設定檔',
  'mic.profile.pickHint': '從符合你使用方式的設定檔開始',
  'mic.profile.group.use': '依用途',
  'mic.profile.group.mic': '依麥克風',
  'mic.profile.tuned': '已調校',
  'mic.profile.stream': '實況',
  'mic.profile.stream.hint': '溫暖、貼近又穩定，適合 Twitch 與 YouTube',
  'mic.profile.podcast': 'Podcast',
  'mic.profile.podcast.hint': '自然的人聲，控制輕柔',
  'mic.profile.chat': '遊戲語音',
  'mic.profile.chat.hint':
    '在 Discord 與隊伍語音中清楚突出，字與字之間乾乾淨淨',
  'mic.profile.sing': '歌唱',
  'mic.profile.sing.hint': '開闊通透，不會有抽吸感，每一口氣息都保留',
  'mic.profile.broadcast': '廣播',
  'mic.profile.broadcast.hint': '電台嗓音：低頻飽滿，紮實厚重',
  'mic.profile.noisy': '吵雜房間',
  'mic.profile.noisy.hint': '風扇、小孩、車聲：淨化與噪音門開到最強',
  'mic.profile.meet': '會議',
  'mic.profile.meet.hint': 'Teams 與 Zoom：咬字清楚，降噪交給它們自己處理',
  'mic.profile.laptop': '筆電麥克風',
  'mic.profile.laptop.hint': '單薄、遙遠、空洞：低切調高，淨化加強',
  'mic.profile.headset': '耳麥收音桿',
  'mic.profile.headset.hint': '貼近嘴邊的小型振膜：找回溫暖，去除噴麥',
  'mic.reset': '重設為 {profile}',
  'mic.setup.title': '{mic} 尚未設定 FluidEQ Engine。',
  'mic.setup.body': 'Windows 只會要求一次權限。設定期間，你的輸出會繼續播放。',
  'mic.setup.button': '在這支麥克風上設定',
  'mic.setup.working': '設定中…',
  'mic.setup.declined': 'Windows 未授予權限，因此沒有做任何變更。',
  'mic.setup.failed': '無法在這支麥克風上完成設定。',
  'mic.notFluid.title': '麥克風的專屬聲音需要 FluidEQ Engine 來播放。',
  'mic.notFluid.body': '聲音設定已保存，只要選用 FluidEQ Engine 就會立即套用。',
  'mic.empty.title': '找不到麥克風',
  'mic.empty.body': '請插入麥克風，或更新 FluidEQ Engine 讓它能列出麥克風。',
  'mic.stage.lowCut': '低切',
  'mic.stage.cleaner': '人聲淨化',
  'mic.stage.gate': '噪音門',
  'mic.stage.deEsser': '齒音消除器',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': '壓縮器',
  'mic.stage.limiter': '限制器',
  'mic.lowCut.title': '低切',
  'mic.lowCut.description':
    '在淨化處理之前，濾掉人聲以下的隆隆聲、敲桌聲與風扇聲。',
  'mic.lowCut.group.below': '人聲以下',
  'mic.lowCut.group.belowHint':
    '「近講補償」會收回離振膜幾公分時人聲多出來的低頻。',
  'mic.lowCut.cut': '切除頻率',
  'mic.lowCut.proximity': '近講補償',
  'mic.lowCut.group.pops': '噴麥',
  'mic.lowCut.group.popsHint': '柔化 P、B 音的「噗」聲，平穩的人聲不受影響。',
  'mic.lowCut.plosive': '防噴麥',
  'mic.gate.title': '噪音門',
  'mic.gate.description':
    '在說話的空檔關閉麥克風，擋住房間聲、風扇與鍵盤聲。範圍調小時，就成了柔和的擴展器。',
  'mic.gate.group.level': '何時開啟',
  'mic.gate.group.levelHint':
    '看圖中的虛線：你的聲音應該超過它，房間的聲音應該留在它下方。',
  'mic.gate.threshold': '開啟電平',
  'mic.gate.range': '衰減量',
  'mic.gate.group.time': '速度',
  'mic.gate.group.timeHint':
    '保持會讓噪音門在音節之間持續開啟，字尾就不會被切掉。',
  'mic.gate.attack': '開啟時間',
  'mic.gate.hold': '保持',
  'mic.gate.release': '關閉時間',
};
