/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The De-esser's page. See `en/dspDeEsser.ts`. */
export default {
  'dsp.deEsser.title': '齿音消除',
  'dsp.deEsser.description':
    '只在人声刺耳的 S、T、SH 音出现时把它们压低，不碰镲片和其余高频。',
  'dsp.deEsser.isolate': '独听',
  'dsp.deEsser.isolateHint': '只听齿音消除去掉的部分。',
  'dsp.deEsser.isolateOn':
    '正在只播放齿音消除去掉的部分。如果里面听得到镲片，就是去得太多了。',

  'dsp.deEsser.group.find': '查找',
  'dsp.deEsser.group.findHint':
    '灵敏度以歌曲本身的电平为准，所以安静和响亮的曲目处理方式相同。',
  'dsp.deEsser.group.reduce': '压低',
  'dsp.deEsser.group.timing': '时间',
  'dsp.deEsser.group.timingHint':
    '抓住起音会在每个齿音之前一点点反应，不漏掉它的第一个边沿。释放决定之后高频回来的快慢。',
  'dsp.deEsser.group.where': '位置',

  'dsp.deEsser.sensitivity': '灵敏度',
  'dsp.deEsser.lowHz': '从',
  'dsp.deEsser.highHz': '到',
  'dsp.deEsser.rangeDb': '最多',
  'dsp.deEsser.widthOct': '宽度',
  'dsp.deEsser.attackMs': '抓住起音',
  'dsp.deEsser.releaseMs': '释放',
  'dsp.deEsser.keepCymbals': '保留镲片',

  'dsp.deEsser.mode.label': '压低方式',
  'dsp.deEsser.mode.spectral': '频谱',
  'dsp.deEsser.mode.treble': '高频',
  'dsp.deEsser.mode.whole': '整个人声',
  'dsp.deEsser.mode.spectralHint': '只压低组成齿音的那些频率，并跟随它移动。',
  'dsp.deEsser.mode.trebleHint':
    '和大多数齿音消除器一样，压低齿音以上的全部内容。更稳，略显发闷。',
  'dsp.deEsser.mode.wholeHint':
    '每个齿音都会压低整个声音，连同其下的一切，因此可能产生抽吸感。只适用于单独录制的人声。',

  'dsp.deEsser.where.label': '立体声像的哪一部分',
  'dsp.deEsser.where.centre': '中央',
  'dsp.deEsser.where.all': '全部',
  'dsp.deEsser.where.centreHint':
    '人声位于中间，踩镲通常在两侧，所以它在中央聆听和压低。',
  'dsp.deEsser.where.allHint':
    '聆听整个立体声像。适用于单声道唱片、语音和现场录音。',

  'dsp.deEsser.graph.s': '齿音位于',
  'dsp.deEsser.graph.cut': '压低',
  'dsp.deEsser.graph.isolate': '只有被去掉的部分',
  'dsp.deEsser.graph.spared': '镲片已放过',
  'dsp.deEsser.graph.now': '现在',
  'dsp.deEsser.graph.voice': '人声',
  'dsp.deEsser.graph.notVoice': '非人声',
  'dsp.deEsser.graph.threshold': '起作用处',
  'dsp.deEsser.engineOld':
    '这里安装的 FluidEQ Engine 早于齿音消除，所以这一级还听不到。机架的其余部分照常工作。',
  'dsp.deEsser.upTo': '最多 {db}',
  'dsp.deEsser.lens.trebleNow': '当前高频',
  'dsp.deEsser.lens.underVoice': '比人声低 {db}',
  'dsp.deEsser.lens.ahead': '提前 {ms} 听到',
  'dsp.deEsser.lens.cymbalNeeds': '镲片需再高 {db}',
  'dsp.deEsser.lens.cymbal': '镲片',
  'dsp.deEsser.lens.s': 'S',
  'dsp.deEsser.lens.left': '左',
  'dsp.deEsser.lens.right': '右',

  'dsp.deEsserPresetGroup.music': '音乐',
  'dsp.deEsserPresetGroup.speech': '语音',
  'dsp.deEsserPreset.gentle': '轻柔',
  'dsp.deEsserPreset.vocalMusic': '人声音乐',
  'dsp.deEsserPreset.brightHeadphones': '偏亮的耳机',
  'dsp.deEsserPreset.harshStreams': '刺耳的流媒体',
  'dsp.deEsserPreset.live': '现场录音',
  'dsp.deEsserPreset.podcast': '播客与语音',
} as const;
