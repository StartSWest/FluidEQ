/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const dsp = {
  'dsp.title': 'DSP',
  'dsp.scopeNotice':
    '仅作用于在 FluidEQ 内播放的音乐，不会改变 Spotify、YouTube 或其他应用。',
  'dsp.idle':
    '从音乐库播放时自动启动。它处理的是 FluidEQ 自带的播放器，因此在加载曲目前无事可做。',
  'dsp.unavailable': '音频处理未能启动，播放不受影响。',
  'dsp.presets': '预设',
  'dsp.preset.flat': '关闭',
  'dsp.preset.lossyRepair': '修复压缩音频',
  'dsp.preset.loud': '响亮',
  'dsp.enabled': '开启',

  'dsp.eq.title': '均衡器',
  'dsp.eq.description':
    '六段参量均衡，曲线按滤波器的实际响应绘制，而非按设定值。',
  'dsp.eq.shape': '频段类型',
  'dsp.eq.bandOff': '关闭',
  'dsp.eq.frequency': '频率',
  'dsp.eq.gain': '增益',
  'dsp.eq.quality': '带宽',

  'dsp.exciter.title': '激励器',
  'dsp.exciter.description':
    '生成有损编码器丢弃的高频谐波。它是凭空生成的，不是还原出来的。',
  'dsp.exciter.crossover': '高于',
  'dsp.exciter.drive': '强度',
  'dsp.exciter.mix': '混合量',

  'dsp.compressor.title': '多段压缩器',
  'dsp.compressor.description': '在三个频段中分别平衡音量。',
  'dsp.compressor.band.low': '低频',
  'dsp.compressor.band.mid': '中频',
  'dsp.compressor.band.high': '高频',
  'dsp.compressor.crossoverLow': '低频 / 中频分割点',
  'dsp.compressor.crossoverHigh': '中频 / 高频分割点',
  'dsp.compressor.threshold': '阈值',
  'dsp.compressor.ratio': '压缩比',
  'dsp.compressor.attack': '启动时间',
  'dsp.compressor.release': '释放时间',
  'dsp.compressor.makeup': '补偿增益',

  'dsp.maximizer.title': '最大化器',
  'dsp.maximizer.description': '提升整体音量，同时不让峰值超过上限。',
  'dsp.maximizer.ceiling': '上限',
  'dsp.maximizer.lookAhead': '前瞻',
  'dsp.maximizer.release': '释放时间',
  'dsp.maximizer.headroomHint':
    '上限为输出配置随后添加的 {gain} dB 预留了余量。',

  'tabs.dsp': 'DSP',
};

export default dsp;
