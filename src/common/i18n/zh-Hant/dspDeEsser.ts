/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const dspDeEsser = {
  'dsp.deEsser.title': '齒音消除器',
  'dsp.deEsser.description':
    '僅在聲音發聲時調低尖銳的 S、T 和 SH，僅保留鈸和其餘高音。',
  'dsp.deEsser.isolate': '隔離',
  'dsp.deEsser.isolateHint': '只聽聽 齒音消除器 帶來的好處。',
  'dsp.deEsser.isolateOn':
    '只播放 齒音消除器 帶走的內容。如果你聽到裡面有鈸聲，那就表示花太多了。',
  'dsp.deEsser.group.find': '尋找',
  'dsp.deEsser.group.findHint':
    '靈敏度是根據歌曲本身的水平來衡量的，因此安靜的曲目和響亮的曲目都會被同等對待。',
  'dsp.deEsser.group.reduce': '減少',
  'dsp.deEsser.group.timing': '時機',
  'dsp.deEsser.group.timingHint':
    '捕獲開始在每個 S 之前做出反應，因此不會錯過其第一個邊緣。放手可設定高音恢復的速度。',
  'dsp.deEsser.group.where': '哪裡',
  'dsp.deEsser.sensitivity': '靈敏度',
  'dsp.deEsser.lowHz': '來自',
  'dsp.deEsser.highHz': '至',
  'dsp.deEsser.rangeDb': '最多',
  'dsp.deEsser.widthOct': '寬度',
  'dsp.deEsser.attackMs': '抓住開始',
  'dsp.deEsser.releaseMs': '放手',
  'dsp.deEsser.keepCymbals': '保留鈸',
  'dsp.deEsser.mode.label': '如何減少',
  'dsp.deEsser.mode.spectral': '光譜',
  'dsp.deEsser.mode.treble': '高音',
  'dsp.deEsser.mode.whole': '全語音',
  'dsp.deEsser.mode.spectralHint': '僅調低 S 的組成頻率，並在其移動時跟隨它。',
  'dsp.deEsser.mode.trebleHint':
    '像大多數 齒音消除器 一樣，調低 S 以上的所有內容。更堅定，更暗淡一些。',
  'dsp.deEsser.mode.wholeHint':
    '降低每個 S 的整個聲音，包括其下的所有內容，以便它可以泵動。僅適用於單獨錄製的聲音。',
  'dsp.deEsser.where.label': '立體圖是哪一部分',
  'dsp.deEsser.where.centre': '中心',
  'dsp.deEsser.where.all': '一切',
  'dsp.deEsser.where.centreHint':
    '人聲位於中間，踩鈸通常位於兩側，因此它在中間聆聽和剪下。',
  'dsp.deEsser.where.allHint':
    '聆聽整個立體聲畫面。用於單聲道唱片、演講和現場錄音。',
  'dsp.deEsser.graph.s': '衛星',
  'dsp.deEsser.graph.cut': '切',
  'dsp.deEsser.graph.isolate': '只有被拿走的東西',
  'dsp.deEsser.graph.spared': '鈸讓通過',
  'dsp.deEsser.graph.now': '現在',
  'dsp.deEsser.graph.voice': '語音',
  'dsp.deEsser.graph.notVoice': '沒有聲音',
  'dsp.deEsser.graph.threshold': '從哪裡開始',
  'dsp.deEsser.engineOld':
    '這裡安裝的 FluidEQ 引擎比 齒音消除器 舊，所以這個階段還沒聽過。機架的其餘部分像以前一樣播放。',
  'dsp.deEsser.upTo': '高達 {db}',
  'dsp.deEsser.lens.trebleNow': '現在高音',
  'dsp.deEsser.lens.underVoice': '{db} 語音下',
  'dsp.deEsser.lens.ahead': '聽到前方有 {ms}',
  'dsp.deEsser.lens.cymbalNeeds': '鈸需要更多 {db}',
  'dsp.deEsser.lens.cymbal': '鈸',
  'dsp.deEsser.lens.s': 'S',
  'dsp.deEsser.lens.left': 'L',
  'dsp.deEsser.lens.right': 'R',
  'dsp.deEsserPresetGroup.music': '音樂',
  'dsp.deEsserPresetGroup.speech': '演講',
  'dsp.deEsserPreset.gentle': '溫柔',
  'dsp.deEsserPreset.vocalMusic': '聲樂',
  'dsp.deEsserPreset.brightHeadphones': '明亮的耳機',
  'dsp.deEsserPreset.harshStreams': '洶湧的溪流',
  'dsp.deEsserPreset.live': '現場錄音',
  'dsp.deEsserPreset.podcast': '播客和演講',
} satisfies Partial<Dictionary>;

export default dspDeEsser;
