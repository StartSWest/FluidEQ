/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.share.title': '在电脑之间共享音频',
  'help.share.intro':
    '共享音频在同一私有网络内的电脑之间传送系统声音。连接耳机或音箱的电脑作为接收端，其他电脑发送。这与同一电脑上的第二输出不同。',
  'help.share.steps':
    '在聆听电脑上打开共享音频，选择在此电脑播放并创建连接码。先调低音量。\n在各个来源电脑上选择发送此电脑的音频，粘贴接收端连接码并连接。两边都要保持 FluidEQ 打开。\n查看连接监视器，用完后停止发送或接收。连接失败时检查共同私有网络和防火墙权限。',
  'help.share.tip':
    '连接码授权配对，请保密。多个发送端会混音，可能提高电平。接收的共享音频不经过音乐库 DSP 机架。',
  'help.menu': '帮助',
  'help.title': '用户指南',
  'help.subtitle': '找到你的声音，轻松上手。',
  'help.intro':
    '这份实用指南使用 FluidEQ 的真实界面截图。从第一次聆听开始，按自己的节奏探索各个工作区。',
  'help.offline': '可离线阅读',
  'help.search': '搜索指南',
  'help.searchHint': '试试：配置、低音、歌词…',
  'help.contents': '指南目录',
  'help.results': '{count} 个章节',
  'help.empty': '没有找到章节。请缩短关键词或清除搜索。',
  'help.clear': '清除搜索',
  'help.close': '关闭指南',
  'help.enlarge': '放大截图：{title}',
  'help.closeImage': '关闭截图',
  'help.captureNote':
    '截图来自真实的 FluidEQ 1.6.x。你的版本在颜色、文字和控件位置上可能有所不同。图中设置仅作示例，并非推荐预设。',
  'help.steps': '动手试试',
  'help.tip': '实用提示',
  'help.back': '返回顶部',
  'help.start.title': '上手的前五分钟',
  'help.start.intro':
    '先播放一首熟悉的歌曲，并保持舒适音量。左侧是系统 EQ 和余量，中央是工作区，右侧是输出设备与配置。播放控制始终位于底部。',
  'help.start.steps':
    '在 Windows 安装程序提示时安装 Equalizer APO，在其设备选择器中勾选聆听设备，并按提示重启。\n在输出设备中选择同一设备。开启系统 EQ，并保持自动标准化开启。\n播放歌曲，打开 EQ → 频段，做一点小调整，再对比系统 EQ 开启与关闭时的声音。',
  'help.start.tip':
    '系统级 EQ 需要 Windows 和 Equalizer APO。macOS 和 Linux 使用演示输出设备；图表在动并不能证明系统声音正在被处理。',
  'help.eq.title': '用 EQ 塑造声音',
  'help.eq.intro':
    '频率决定作用位置，增益决定提升或衰减，Q 决定宽度：Q 越高，频段越窄。低频影响低音，中频承载大量人声，高频增加明亮度。',
  'help.eq.steps':
    '在 EQ → 频段中选择频段。调整频率、增益和 Q，或拖动响应图中的控制点。\n先用宽而轻的调整，比较后再添加频段。滤波器选择可改变峰值、搁架等形状。\n用开关和强度分别对比耳机校正、EQ、音色和 Smart EQ。提升增益时保持自动标准化开启。',
  'help.eq.tip':
    '响应曲线表示滤波器，动态频谱表示测得的信号。Smart EQ 需要可听音频。Detail、Balance 和 Target 的校正方式不同，请逐一比较。',
  'help.headphones.title': '耳机校正与导入',
  'help.headphones.intro':
    '耳机校正补偿已测量型号的响应，可以和自己的频段一起使用。请核对准确型号及测量作者。',
  'help.headphones.steps':
    '打开 EQ → EQ 预设，搜索耳机型号并选择对应测量。\n其他工具的 EQ 文本可通过音频操作中的导入 EQ 设置载入。应用前检查频段和曲线。\n在 Squiglink 导出 EQ 文本，粘贴到导入面板，确认预览后应用导入的 EQ。',
  'help.headphones.tip':
    '标记为尚未应用的预览不会改变声音。避免意外叠加同一耳机的两套完整校正。',
  'help.convolution.title': '使用脉冲响应',
  'help.convolution.intro':
    '卷积将 WAV 脉冲响应作为独立校正层。可以搜索 AutoEq 目录或导入自己的 WAV；参数均衡频段仍保持独立。',
  'help.convolution.steps':
    '打开 EQ → 卷积，按型号或测量作者搜索。\n核对来源和采样率，然后下载并应用，或导入本地 WAV。\n比较卷积层开启和关闭的声音，并调整强度。',
  'help.convolution.tip':
    'Equalizer APO 要求脉冲采样率与输出匹配。目录下载需要联网，指南本身不需要。',
  'help.profiles.title': '设备、配置与第二输出',
  'help.profiles.intro':
    'EQ 会跟随输出设备。自动映射将修改保存到当前设备，命名配置保存不同声音方案。第二输出将音频镜像到其他设备，每个设备有独立音量。',
  'help.profiles.steps':
    '编辑前核对输出。新建配置保存一个方案；更新保存修改，恢复载入已保存的设置。\n打开第二输出，启用可连接的设备并设置音量。当前版本可在其下方直接选择该设备的 EQ 配置。\n游戏/视频使用较小的初始缓冲，音乐保留更多余量。请实际检查同步效果。',
  'help.profiles.tip':
    'Windows 的每个镜像输出使用自己的 APO 配置。镜像需要 FluidEQ 保持打开；切换主输出会停止旧镜像。设备延迟也会影响同步。',
  'help.config.title': '检查与备份处理链',
  'help.config.intro':
    'EQ → Config 显示 Equalizer APO 实际保存在磁盘上的内容。输出卡片和包含文件树显示涉及的设备与层。大幅尝试前先导出。',
  'help.config.steps':
    '打开 EQ → Config，选择输出并查看状态和活动层。\n使用导出处理链保存 .fluideq 文件。\n恢复时先选择目标输出，再导入处理链并检查结果。',
  'help.config.tip':
    '修改设置会重写生成的层文件。需要长期保留的手动 APO 命令应写入每个输出的自定义文件，FluidEQ 不会重写它。',
  'help.online.title': '聆听在线媒体',
  'help.online.intro':
    '在线媒体让支持的网站与 EQ 并排使用。播放和登录仍取决于网站与网络。底部播放控制跟随活动播放器。',
  'help.online.steps':
    '打开在线媒体，选择网站并在页面中播放内容。\n切换到 EQ 边听边调，需要网站自身控件时再返回。\n启用一次一个播放器，避免与其他播放器重叠发声。',
  'help.online.tip':
    'DSP 机架处理音乐库音频，不处理在线媒体。在 Windows 上，系统 EQ 仍可能作用于启用 APO 的输出。',
  'help.library.title': '建立本地音乐库',
  'help.library.intro':
    '音乐库汇集磁盘上的音乐与视频，可按专辑、艺人、歌曲、文件夹或视频浏览。封面和元数据来自文件。',
  'help.library.steps':
    '打开音乐库并添加媒体文件夹，等待索引完成。\n选择艺人或专辑，或搜索歌曲并播放。\n在任何标签页都可用底部控件暂停、定位、切歌和调音量。',
  'help.library.tip':
    '音乐库需要访问原始文件。断开的磁盘应重新连接；移动文件夹后应添加新位置。',
  'help.queue.title': '专辑与播放队列',
  'help.queue.intro':
    '队列决定聆听顺序。打开另一个专辑可以继续浏览，而不替换当前歌曲。活动歌曲和接下来播放帮助你掌握进度。',
  'help.queue.steps':
    '打开专辑，播放想听的歌曲。\n在歌曲菜单中选择下一首播放或加入队列。\n检查接下来播放，按需使用随机播放或重复。',
  'help.queue.tip':
    '启动音乐库播放会接管 FluidEQ 的其他播放器。底部控件显示当前歌曲与来源。',
  'help.dsp.title': '探索 DSP 机架',
  'help.dsp.intro':
    'DSP 仅处理音乐库中的音频歌曲。Karaoke、视频、接收的共享音频和其他应用不会经过此机架。模块包括 Normalizer、Denoise、Exciter、Bass Forge、Equaliser、Bass Punch、Dimension、Maximizer 和 Master。',
  'help.dsp.steps':
    '播放音乐库音频，打开 DSP 并启用机架。从预设或单个模块开始。\n每次改变一个控件，在相近音量下对比模块启用与旁路。\n观察输出电平并保存机架。导出和导入可以交换完整机架。',
  'help.dsp.tip':
    'DSP Equaliser 与系统 EQ 是不同阶段，在 Windows 上可以同时影响音乐库播放。请在相近音量下比较，以免把更响误认为更好。',
  'help.denoise.title': '降噪与来源分析',
  'help.denoise.intro':
    'Denoise 降低音乐库音频中的噪声。图表帮助观察模块反应。过强降噪可能削弱细节或产生抽吸感。',
  'help.denoise.steps':
    '播放带噪声的音乐库歌曲，在 DSP 中选择 Denoise。\n先开启轻度降噪，聆听安静段落和音乐细节。\n逐步增强，再旁路模块进行比较。',
  'help.denoise.tip':
    '它不是麦克风净化开关，也不处理在线媒体。如果没有变化，请核对来源是否为音乐库音频，以及机架和模块是否都开启。',
  'help.visuals.title': '打造自己的播放器外观',
  'help.visuals.intro':
    '响应曲线、频谱和电平表反映不同信息。可视化器的形状、配色与峰值样式只改变外观，不改变 EQ。',
  'help.visuals.steps':
    '开启左侧响应图，在视图中选择尺寸。\n选择可视化形状，打开新外观调整颜色、填充、光晕、间隔和峰值，命名保存。\n在音频操作中更换主题或语言。Ctrl + 加号、减号或 0 可放大、缩小或重置界面缩放。',
  'help.visuals.tip':
    '频谱在动不代表 EQ 已作用于设备。诊断音频时应听感对比并核对输出状态。',
  'help.karaoke.title': '用 Karaoke 歌唱',
  'help.karaoke.intro':
    'Karaoke 配对本地音频与歌词。定时歌词跟随播放；音高目标需要音符数据。配置麦克风后可显示实时演唱音高。',
  'help.karaoke.steps':
    '打开 Karaoke，添加包含匹配音频和歌词的文件或文件夹。\n选择歌曲播放，检查歌词与伴奏是否对应。\n配置麦克风，调整歌词大小，并使用舞台的全屏控制。',
  'help.karaoke.tip':
    '只有歌词的文件不包含目标音符。缺少音高目标本身不说明麦克风故障。',
  'help.maker.title': '在 Karaoke Maker 中制作',
  'help.maker.intro':
    'Maker 将音频转换成可编辑项目，在时间线上组织歌词与音符。自动生成的文字和时间需要人工核对。',
  'help.maker.steps':
    '从 Karaoke 打开制作并载入音频，选择需要的分离或转录工具。\n查看进度；首次使用 AI 可能需要下载模型。检查时间线上的歌词和音符。\n逐段试听，修正文字与时间，保存项目后导出卡拉 OK 文件。',
  'help.maker.tip':
    '下载模型需要联网与磁盘空间，处理时间取决于硬件和歌曲长度。使用你有权处理的音频，分享前检查导出结果。',
  'help.trouble.title': '声音不对时怎么办',
  'help.trouble.intro':
    '先查来源与输出，再逐层排除。图表或已开启的开关不能单独证明声音到达了正确设备。帮助菜单提供音频排障和问题报告。',
  'help.trouble.steps':
    '没有声音：检查播放、输出、音量和连接。一次一个播放器可能暂停了另一来源。\nEQ 没变化：确认系统 EQ 开启，并在 Equalizer APO 中选中了设备。使用修复音频问题；重启会中断音频。\n失真或低音过多：保持自动标准化，减小提升量并逐层旁路。若仍有问题，发送前先检查问题报告。',
  'help.trouble.tip':
    'F1 打开指南。Escape 先关闭放大截图，再关闭指南。Ctrl + 0 重置缩放。测试 DSP 时使用音乐库音频歌曲，不要使用视频或其他播放器。',
};

export default help;
