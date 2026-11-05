/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.appliedGain': '实际增益',
  'dsp.dynamics.graphHint':
    'Dynamics 处理前后的音乐。增益曲线在提升时上升，在压缩时下降。',
  'dsp.dynamics.engineLiveOld':
    '更新引擎以查看 Dynamics 的实时变化。声音处理已经在运行。',
  'dsp.dynamics.title': '动态',
  'dsp.dynamics.description':
    '提升安静的声音、压住响亮的声音，分三个频段工作，让耳语和爆炸在中间相遇。不增加延迟。',
  'dsp.dynamics.engineOld':
    '动态需要最新的 FluidEQ Engine。机架的其余部分正在工作；引擎更新后此滤镜即开始工作。',
  'dsp.dynamics.graphLabel': '每个频段对其电平的作用',
  'dsp.dynamics.band.low': '低频',
  'dsp.dynamics.band.lowHint': '150 Hz 以下：爆炸的轰鸣、底鼓、引擎。',
  'dsp.dynamics.band.mid': '中频',
  'dsp.dynamics.band.midHint': '150 Hz 至 4 kHz：人声、脚步和大部分声音。',
  'dsp.dynamics.band.high': '高频',
  'dsp.dynamics.band.highHint': '4 kHz 以上：细节、空气感、脚步的边缘。',
  'dsp.dynamics.lift': '提升',
  'dsp.dynamics.hold': '压住',
  'dsp.dynamics.upThreshold': '低于',
  'dsp.dynamics.upRatio': '比率',
  'dsp.dynamics.upMax': '最多',
  'dsp.dynamics.downThreshold': '高于',
  'dsp.dynamics.downRatio': '比率',
  'dsp.dynamics.timing': '时间与电平',
  'dsp.dynamics.timingHint': '压住来得多快、提升回得多快，以及结果有多响。',
  'dsp.dynamics.attack': '起始',
  'dsp.dynamics.release': '释放',
  'dsp.dynamics.makeup': '补偿',
  'dsp.dynamics.mix': '混合',
  'dsp.dynamicsPreset.gentle': '轻柔均衡',
  'dsp.dynamicsPreset.speech': '语音',
  'dsp.gamingPreset.quietLift': '提升小声',
  'dsp.gamingPreset.blastGuard': '爆炸防护',
  'dsp.gamingPreset.longSession': '长时间游玩',
  'dsp.gamingPreset.competitiveLight': '轻度竞技',
};
