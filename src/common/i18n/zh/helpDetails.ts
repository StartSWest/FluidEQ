/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': '动态：安静与响亮的片段',
  'help.dynamics.intro':
    '动态 是三段压缩器，能提升较轻的声音、压住较响的声音，不增加延迟。可用于音乐、电影、人声和每个游戏自己的声音。',
  'help.dynamics.steps':
    '打开 DSP → 动态，启用处理级并选择预设。日常预设在这里，游戏预设在 Gaming Lab。\n低频为 150 Hz 以下，中频为 150 Hz 至 4 kHz，高频为 4 kHz 以上。调整目标声音所在的频段。\n在 提升 中，低于 决定何时提升安静声音，比率 决定强度，最多 限制最大增益。1:1 不作改变。\n在 压住 中，高于 决定何时压低响声，比率 决定力度。降低阈值会更频繁地触发抑制。\n用 起始 和 释放 调整响应，混合 混入原声，补偿 调整最终电平。请在相近音量下比较。\n图中显示处理前后声音及实际施加的增益：向上是提升，向下是压低。引擎更新提示可能只针对实时图形，声音处理可能已经正常工作。',
  'help.dynamics.tip':
    '大幅提升也会让底噪更明显。降低混合比例可以保留更多原始起伏。',
  'help.dynamics.keywords':
    'dynamics, compressor, compression, upward compression, downward compression, lift, hold, attack, release, mix, makeup, quiet passages, loud passages',
  'help.deesser.title': '齿音消除：柔化刺耳人声',
  'help.deesser.intro':
    '仅在尖锐的 S、T、SH 等齿音出现时压低它们。四组控制决定监听什么、压低什么、响应速度及立体声中的作用位置。',
  'help.deesser.steps':
    '打开 DSP → 齿音消除，启用它，在有明显齿音的录音上试用预设。\n在 查找 中，用上下限频率框住刺耳声音。提高 灵敏度，但不要让每个明亮音符都触发处理。\n在 压低 中，频谱 只跟踪问题频率；高频 压低整个高频段。整个人声 压低全部声音，适合单独录制的人声。设置最大衰减量及可用的带宽。\n在 时间 中调整开头的捕捉和高频恢复速度。位置 中的 中央 专注中央人声，保留镲片 保护明亮的敲击声。\n启用 独听 只听被移除的部分，然后关闭它来判断整段录音。显示会跟随正在调整的控制。\n在处理级的预设栏保存设置。若要保留整个组合，也保存完整处理链；选择另一条链可能会替换多个处理级。',
  'help.deesser.tip':
    '如果人声变得含糊或音乐失去空气感，请降低灵敏度或最大衰减量。这是播放处理，不是麦克风效果。',
  'help.deesser.keywords':
    'de-esser, deesser, de essing, sibilance, sharp voice, harsh voice, spectral, centre only, center only, cymbals, isolate',
  'help.normalizer.title': '标准化 与实时电平控制',
  'help.normalizer.intro':
    '在创意处理级之前调整音源电平。媒体库文件可以完整分析，其他音源则在播放时学习。',
  'help.normalizer.steps':
    '在 DSP → 归一化器中选择关闭、真峰值或响度。真峰值仅降低峰值，不进行提升。响度以最响的三秒片段为目标；短片段使用综合响度。\n等待音乐库分析完成后，查看强段响度、已应用增益和限制原因。综合响度仍是整首曲目的独立测量值。\n实时模式在播放时学习，遇到更响的片段时可能调整增益。较轻的片段保留相对音量，因此整曲平均响度可能不同。峰值余量和最大提升限制可能导致无法达到目标。',
  'help.normalizer.tip':
    '它不同于左侧为 EQ 留出余量的自动标准化，也不同于调整最终输出的 Master。这些功能都不能修复录音中已有的失真。',
  'help.normalizer.keywords':
    'normalizer, normalisation, normalization, lufs, loudness target, true peak, peak ceiling, applied gain, leveling, live level control, learning source, holding gain',
  'help.crossfade.title': '交叉淡化 与自定义淡化曲线',
  'help.crossfade.intro':
    '让媒体库中连续的歌曲重叠过渡。它属于独立于 DSP 滤波器的播放设置，不会对其他应用或 Karaoke 进行交叉淡化。',
  'help.crossfade.steps':
    '在媒体库队列中放入至少两首歌。在 DSP 的播放选项下选择 交叉淡化 并启用。\n设置时长，选择等功率、平滑或线性。让第一首歌接近结尾，试听重叠部分。\n选择 自定义，拖动淡出和淡入曲线的控制点，也可以聚焦控制点后使用方向键。\n观察两条曲线及合计电平。两者同时保持较高时，过渡可能变响。\n保存曲线 将形状按名称保存，之后可从列表选择。重置形状 将可编辑形状恢复为初始状态。',
  'help.crossfade.tip':
    '如果控件不可用，请先播放媒体库音频。这条曲线改变歌曲之间的过渡，不改变它们的 EQ。',
  'help.crossfade.keywords':
    'crossfade, fade, transition, overlap, dj, equal power, custom curve, save curve, outgoing, incoming',
  'help.gamefilter.title': '游戏 滤波器：脚步、环境与人声',
  'help.gamefilter.intro':
    '每个游戏都可单独调节轻微线索、背景和对白。从该游戏的配置开始，在试听时调整自己的副本。',
  'help.gamefilter.steps':
    '在 Gaming Lab 选择游戏；声音尚未加载时，先试用它。在游戏的各部分中选择 游戏。\n提升较轻的脚步、换弹和开门声。Calm 压住分散注意力的响声；不要未比较就把两个控制都开得很大。\n马蹄和沉重脚步选项加强靴子、马匹及车辆的低频重量。如果线索变得过重，请关闭它。\n环境可降低或提升游戏背景。当脚步或其他明显声音突出时会放开处理，避免把线索与背景一起压低。\n对白把居中的人声带到前面。腾出空间选项会在说话期间稍微压低其余声音。\n用隔离试听变化，再回到完整游戏声音。另存为配置可供其他游戏使用；重置则恢复起始配置。',
  'help.gamefilter.tip':
    '有自带 3D 音频的游戏可使用保持 Room 关闭的配置，避免重复定位。Room 适用于耳机。卸载游戏声音后会恢复音乐声音。',
  'help.gamefilter.keywords':
    'game filter, footsteps, lift, calm, environment, ambience, dialogue, voices, make room, hooves, heavy steps, isolate, hrtf, spatial audio',
  'help.songs.title': '记住每首歌曲的声音',
  'help.songs.intro':
    '歌曲可以按输出设备分别记住预设、Tone 和 EQ。耳机上的调节不会改变扬声器保存的声音。',
  'help.songs.steps':
    '在输出配置下方启用 记住每首歌的声音。默认不启用。\n播放可识别的歌曲，改变预设、Tone 或 EQ。通知会说明即将保存；如果只是试验，请选择不保存。\n歌曲下次在同一输出播放时，会临时恢复其声音。撤销仅跳过本次应用；忘记歌曲还会删除记忆。\n歌曲结束后，输出恢复先前的声音。主动选择其他配置会把控制权交还给您。\nSmart EQ 在测量期间有独立的歌曲保存控制，用于记住测得的校正，与手动预设、Tone 和频段记忆分开。',
  'help.songs.tip':
    '歌曲身份来自文件或播放器的媒体信息。缺少或错误的标题可能无法匹配。前置增益不会按歌曲保存；已加载的游戏声音具有优先权。',
  'help.songs.keywords':
    'per song, song sound, song memory, remember song, save song eq, smart eq, undo, forget this song, preset per song, tone per song',
  'help.mycurves.title': '我的曲线：导入、编辑与分享',
  'help.mycurves.intro':
    '这是测量库旁边的个人曲线集合。检查响应后，可将曲线作为校正层应用，或变成可编辑的 EQ 频段。',
  'help.mycurves.steps':
    '打开 EQ Presets → 我的曲线，搜索或排序已保存的曲线。\n添加曲线可使用当前 EQ、文本文件、测量库项目或粘贴内容。Squiglink 导入使用其导出的 EQ 文本。保存前检查预览。\n作为曲线应用会添加图层并保留现有频段；作为 EQ 应用会在确认后替换所选双耳、左耳或右耳的可编辑频段。\n曲线菜单可重命名、编辑频段、复制、拷贝为文本或删除，无须重新导入就能修改。\n导出列表和导入列表可在电脑之间迁移整个集合。分享测量时保留型号与测量作者信息。',
  'help.mycurves.tip':
    '曲线描述频率响应；输出配置还保存该设备其余声音设置。应用校正前，请检查型号和来源。',
  'help.mycurves.keywords':
    'my curves, custom curve, squiglink, import list, export list, apply as curve, apply as eq, left ear, right ear, curve editor, measurements',
} as const;

export default helpDetails;
