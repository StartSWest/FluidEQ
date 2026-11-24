/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': '动态：安静与响亮的片段',
  'help.dynamics.intro':
    '动态 是三段压缩器，能提升较轻的声音、压住较响的声音，不增加延迟。可用于音乐、电影、人声和每个游戏自己的声音。',
  'help.dynamics.steps':
    '打开 DSP → 动态，启用处理级并选择预设。日常预设在这里，游戏预设在 Gaming Lab。\n低频为 150 Hz 以下，中频为 150 Hz 至 4 kHz，高频为 4 kHz 以上。调整目标声音所在的频段。\n在 提升 中，低于 决定何时提升安静声音，比率 决定强度，最多 限制最大增益。1:1 不作改变。\n在 压住 中，高于 决定何时压低响声，比率 决定力度。降低阈值会更频繁地触发抑制。\n用 起始 和 释放 调整响应，混合 混入原声，补偿 调整最终电平。请在相近音量下比较。\n每个频段都有自己的曲线：横向是输入电平，纵向是输出电平。拖动空心点设置提升或压住从哪里开始，拖动实心点设置力度，也可以在下方表格中输入精确数值。播放声音时，每条曲线上都有一个点随之移动，显示该频段此刻在做什么。引擎更新提示可能只针对实时图形，声音处理可能已经正常工作。',
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
    '打开 DSP → 归一化器，选择关闭、True Peak 或响度。处理外部音频时，同一卡片显示为实时电平控制，提供峰值保护和实时均衡音量模式。\n使用 True Peak 时，设置峰值上限。只有音源峰值超过上限时，此模式才降低电平，不会放大较安静的音源。\n使用响度模式时，设置响度目标和峰值上限。目标针对最响的三秒片段；短于三秒的片段使用综合响度。\n播放媒体库音轨时，等待音源分析完成。查看强声片段响度、综合响度和应用增益。综合响度衡量的是整首音轨。\n实时处理时，在学习音源期间继续播放，并观察保持增益状态。遇到更响的片段时，增益可能降低；安静片段仍保持原有的相对电平。\n提高目标前，先检查应用增益及限制原因。峰值余量和最大提升限制可能使音源无法达到目标。请在相近的聆听音量下比较；强声片段使用同一目标，并不代表所有歌曲的整曲响度完全相同。',
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
  'help.songs.title': '自动均衡：每首歌的声音',
  'help.songs.intro':
    'EQ 页面上的自动均衡决定每首歌的声音：为这首歌保存的声音、来自媒体库的专辑声音，或者你的声音。智能校正会在其上叠加测得的校正。歌曲的声音会跟随它到每个输出；耳机校正仍属于输出。',
  'help.songs.steps':
    '打开自动均衡（“你的均衡”工具中的实心按钮），按需开启“歌曲声音”“专辑声音”和“智能校正”。每一项都可以单独关闭。\n歌曲播放时，按“为这首歌保存”即可保留你听到的声音。这首歌再次播放时，它的声音会回来；接着播放没有保存声音的歌曲时，会恢复你自己的声音。\n保存了声音的歌曲播放时，更改预设、音色或某个频段，立刻就能听到。“保存更改”会把它留给这首歌，“恢复已保存”会重新用上已保存的声音；自动均衡旁边的“保存”不用打开也能做到。没有保存的更改不会保留，下次这首歌仍用已保存的声音播放。在没有保存任何声音的歌曲上做的更改会成为你的声音。\n在媒体库中右键点击一首歌、一组选中的歌曲或一张专辑，或使用专辑的“专辑声音”，即可选择预设或保留当前正在播放的设置。歌曲自己的声音优先于专辑的声音；专辑只能在媒体库中更改。\n“管理”列出所有已保存的歌曲和专辑，并提供“忘记”。“重置所有设置”会关闭自动均衡，但保留这些内容。',
  'help.songs.tip':
    '来自 Spotify、YouTube 或浏览器的歌曲按播放器报告的标题和歌手识别，它们的声音与媒体库的分开保存。电影和视频不会使用歌曲的声音。DSP 关闭、游戏链开启或游戏播放自己的声音时，自动均衡会暂时让开。',
  'help.songs.keywords':
    'auto eq, 自动均衡, 每首歌, 歌曲声音, 专辑声音, 记住歌曲, 为这首歌保存, 智能校正, smart correction, smart eq, 单曲预设, 专辑预设, 忘记, 管理',
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
