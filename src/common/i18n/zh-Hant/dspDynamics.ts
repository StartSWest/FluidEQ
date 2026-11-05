/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.appliedGain': '實際增益',
  'dsp.dynamics.graphHint':
    'Dynamics 處理前後的音樂。增益曲線在提升時上升，在壓縮時下降。',
  'dsp.dynamics.engineLiveOld':
    '更新引擎以查看 Dynamics 的即時變化。聲音處理已在運作。',
  'dsp.dynamics.title': '動態',
  'dsp.dynamics.description':
    '提升安靜的聲音、壓住響亮的聲音，分三個頻段工作，讓耳語和爆炸在中間相遇。不增加延遲。',
  'dsp.dynamics.engineOld':
    '動態需要最新的 FluidEQ Engine。機架的其餘部分正在運作；引擎更新後此濾鏡即開始運作。',
  'dsp.dynamics.graphLabel': '每個頻段對其電平的作用',
  'dsp.dynamics.band.low': '低頻',
  'dsp.dynamics.band.lowHint': '150 Hz 以下：爆炸的轟鳴、大鼓、引擎。',
  'dsp.dynamics.band.mid': '中頻',
  'dsp.dynamics.band.midHint': '150 Hz 至 4 kHz：人聲、腳步和大部分聲音。',
  'dsp.dynamics.band.high': '高頻',
  'dsp.dynamics.band.highHint': '4 kHz 以上：細節、空氣感、腳步的邊緣。',
  'dsp.dynamics.lift': '提升',
  'dsp.dynamics.hold': '壓住',
  'dsp.dynamics.upThreshold': '低於',
  'dsp.dynamics.upRatio': '比率',
  'dsp.dynamics.upMax': '最多',
  'dsp.dynamics.downThreshold': '高於',
  'dsp.dynamics.downRatio': '比率',
  'dsp.dynamics.timing': '時間與電平',
  'dsp.dynamics.timingHint': '壓住來得多快、提升回得多快，以及結果有多響。',
  'dsp.dynamics.attack': '起始',
  'dsp.dynamics.release': '釋放',
  'dsp.dynamics.makeup': '補償',
  'dsp.dynamics.mix': '混合',
  'dsp.dynamicsPreset.gentle': '輕柔均衡',
  'dsp.dynamicsPreset.speech': '語音',
  'dsp.gamingPreset.quietLift': '提升小聲',
  'dsp.gamingPreset.blastGuard': '爆炸防護',
  'dsp.gamingPreset.longSession': '長時間遊玩',
  'dsp.gamingPreset.competitiveLight': '輕度競技',
};
