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
  'dsp.bypassed': '旁通',
  'dsp.enabled': '开启',

  'dsp.eqPreset.custom': '自定义',
  'dsp.eqPreset.label': '预设',
  'dsp.eqPreset.flat': '平直',
  'dsp.eqPreset.vShape': 'V 形',
  'dsp.eqPreset.rock': '摇滚',
  'dsp.eqPreset.pop': '流行',
  'dsp.eqPreset.jazz': '爵士',
  'dsp.eqPreset.classical': '古典',
  'dsp.eqPreset.electronic': '电子',
  'dsp.eqPreset.hiphop': '嘻哈',
  'dsp.eqPreset.acoustic': '原声',
  'dsp.eqPreset.vocal': '人声',
  'dsp.eqPreset.podcast': '播客',
  'dsp.eqPreset.bassBoost': '低频增强',
  'dsp.eqPreset.trebleBoost': '高频增强',
  'dsp.eqPreset.loudness': '等响度',
  'dsp.eqPreset.lateNight': '夜间',
  'dsp.eqPreset.smallSpeakers': '小音箱',
  'dsp.eqPreset.car': '车载',
  'dsp.eqPreset.gaming': '游戏',
  'dsp.eqPreset.movie': '影院',
  'dsp.eqPreset.warm': '温暖',
  'dsp.eqPreset.air': '空气感',

  'dsp.eqPreset.import': '导入',
  'dsp.eqPreset.export': '导出',
  'dsp.eqPreset.imported': '已加载 {count} 个滤波器。',
  'dsp.eqPreset.importSkipped': '已加载 {count} 个滤波器，跳过 {skipped} 个。',
  'dsp.eqPreset.importEmpty': '此均衡器无法从中读取任何滤波器。',
  'dsp.eqPreset.importFailed': '无法读取该文件。',
  'dsp.eqPreset.importPreamp': '前置增益已设为 {gain} dB。',

  'dsp.eq.rack': '频段数',
  'dsp.eqModel.label': '音色',
  'dsp.eqModel.clean': '无',
  'dsp.eqModel.proportional': '聚焦',
  'dsp.eqModel.wide': '宽阔',
  'dsp.eqEngine.label': '引擎',
  'dsp.eqEngine.serial': '串联',
  'dsp.eqEngine.parallel': '并联',
  'dsp.eqStereo.label': '作用于',
  'dsp.eqStereo.stereo': '立体声',
  'dsp.eqStereo.mid': '仅中置',
  'dsp.eqStereo.side': '仅两侧',
  'dsp.eqOversample.label': '过采样',
  'dsp.eqOversample.off': '关',
  'dsp.eqOversample.on': '2x',
  'dsp.eqImport.title': '导入均衡曲线',
  'dsp.eqImport.hint':
    '粘贴来自 Squiglink、AutoEq 或 Equalizer APO 的曲线，或选择包含它的文件。',
  'dsp.eqImport.placeholder':
    'Preamp: -5.4 dB\nFilter: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
  'dsp.eqImport.chooseFile': '选择文件',
  'dsp.eqImport.apply': '导入',
  'dsp.eqImport.cancel': '取消',

  'dsp.eq.title': '均衡器',
  'dsp.eq.description':
    '十五段参量均衡，曲线按滤波器的实际响应绘制，而非按设定值。',
  'dsp.eq.band': '频段',
  'dsp.eq.bands': '频段',
  'dsp.eq.shape': '频段类型',
  'dsp.eq.bandOff': '关闭',
  'dsp.eq.addLeft': '在此频段下方添加一个',
  'dsp.eq.addRight': '在此频段上方添加一个',
  'dsp.eq.type.peak': '钟形',
  'dsp.eq.type.lowShelf': '低频搁架',
  'dsp.eq.type.highShelf': '高频搁架',
  'dsp.eq.type.notch': '陷波',
  'dsp.eq.type.lowPass': '低通',
  'dsp.eq.type.highPass': '高通',
  'dsp.eq.type.bandPass': '带通',
  'dsp.eq.frequency': '频率',
  'dsp.eq.gain': '增益',
  'dsp.eq.preamp': '前置增益',
  'dsp.eq.character': '音色量',
  'dsp.eq.subsonic': '超低频',
  'dsp.eq.fuzz': '失真',
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
