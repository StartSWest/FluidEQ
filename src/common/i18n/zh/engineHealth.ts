const engineHealth = {
  'engineHealth.offTitle': 'FluidEQ 引擎未在 {device} 上运行',
  'engineHealth.offBody':
    '此输出正在播放没有 EQ 的声音。重启 Windows 音频通常能让引擎恢复，在此期间 FluidEQ 的其他功能照常可用。',
  'engineHealth.partlyOff': '部分关闭',
  'engineHealth.problemsTitle': '你的部分声音未到达 {device}',
  'engineHealth.problem.convolution':
    '卷积已关闭：引擎无法加载脉冲响应。请换一个文件试试。',
  'engineHealth.problem.graphic-eq': '图形 EQ 已关闭：引擎无法生成它的曲线。',
  'engineHealth.problem.dsp-rack': 'DSP 效果已关闭：引擎无法启动它们。',
  'engineHealth.problem.reload-failed':
    '你最近的更改未能加载，因此仍在播放之前的设置。',
  'engineHealth.problem.unwatched': '引擎看不到你为此输出所做的更改。',
  'engineHealth.problem.other': '引擎被要求运行的其他内容未在运行。',
  'engineHealth.useApo': '使用 Equalizer APO…',
} as const;

export default engineHealth;
