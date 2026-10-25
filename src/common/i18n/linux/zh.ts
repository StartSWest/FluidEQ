/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dictionary } from '../en';

/** Chinese of `./en.ts`, the Linux wording; see there. */
const zh: Partial<Dictionary> = {
  'wallpaper.manage.empty': '所有显示器都在显示原来的桌面背景。',
  'wallpaper.monitor.ordinary': '桌面背景',
  'wallpaper.pause.locked': '锁屏时暂停',
  'wallpaper.error.unsupported': '桌面背景需要GNOME和FluidEQ Desktop扩展。',
  'wallpaper.error.host':
    '可视化效果无法显示在桌面上。请在“扩展”中启用FluidEQ Desktop，然后重试。',
  'app.menu.restartAudio': '重启音频',
  'restart.title': '重启音频',
  'restart.failed': '无法重启音频。',
  'notice.restartConfirm':
    '在 FluidEQ 引擎重新启动期间，声音会中断几秒。要继续吗？',
  'notice.restartDone': '音频已重启。请重新打开仍然没有声音的程序。',
  'troubleshoot.restart.title': '重启音频',
  'troubleshoot.restart.cost':
    '在 FluidEQ 引擎重新启动期间会静音几秒钟。无需密码。',
  'engine.title': 'FluidEQ 如何处理你的声音',
  'engine.subtitle':
    '只要 FluidEQ 处于打开状态，FluidEQ 引擎就会在你的声音服务器（PipeWire 或 PulseAudio）旁运行。',
  'engine.fluid.l1': '适用于 PipeWire 和 PulseAudio，任何发行版均可',
  'engine.fluid.l2': '均衡器和 DSP 机架作用于你听到的所有声音，无需重启',
  'engine.fluid.l3': '配置中的 Plugin: 行和 VST 插件无法运行',
  'output.hint': '修改会保存到当前启用的配置，并在该输出正在播放时跟着走。',
  'extraOutput.ambiguous':
    '有两个输出同名，FluidEQ 无法判断你指的是哪一个。请在声音设置中重命名其中一个。',
  'extraOutput.unmatched':
    '你的声音设置列出了这个输出，但 FluidEQ 无法访问它，因此不能镜像到它。',
  'convolution.eyebrow': '脉冲响应',
  'convolution.notice.fluid':
    '可下载的目录由 AutoEq 提供。每次下载都与你的输出运行时所用的采样率一致，其他采样率由 FluidEQ 引擎自行转换。',
  'graph.scene.gpu.auto': '由系统决定',
  'settingsReset.body':
    '图表和可视化效果、窗口颜色、播放器、媒体库、语言、动画、登录时启动和桌面背景都会恢复为 FluidEQ 全新安装时的状态。',
  'app.processes.hint':
    '你的系统把它们全部显示为应用名称，因为它们是同一个程序。这里显示每个进程实际为 FluidEQ 做什么。',
  'app.processes.what.engine':
    'FluidEQ 自己的引擎。解码你播放的内容，并顺带应用均衡器。它是独立于其余部分的程序，所以繁忙的窗口不会让音乐卡住。',
  'app.processes.what.devices':
    '当应用询问有哪些音频设备时由 Chromium 启动；同一个请求也会列出视频设备。它不会打开任何摄像头，也不会录制任何内容。',
  'app.processes.name.systemEngine': 'FluidEQ 引擎（系统音频）',
  'app.processes.what.systemEngine':
    '位于你的应用和声音服务器之间的均衡器，作用于你听到的一切声音。FluidEQ 会随自身一起启动和停止它；显示其内存和 CPU，但不计入总计。',
  'dsp.normalizer.liveGuidance':
    '实时响度调节跟随正在播放的歌曲。响亮段落会降低本曲余下部分的增益；下一首保持该电平，除非明显更安静。听过的歌曲从第一秒起调整。增益最多提升 6 dB 且不超出峰值余量；不保证达到目标值。关闭后再启用可重新学习。无法修复已有失真。',
  'dsp.latency.hint': '引擎处理增加的延迟。不包括声音服务器、设备和网络延迟。',
  'dsp.latency.note':
    '引擎在当前采样率下报告的缓冲。不包括声音服务器、设备和网络延迟。',
  'dsp.surround.onHint':
    '按你的输出的设置，在 5.1 或 7.1 输出的每个声道上运行机架，所有声道共用一个电平决策。',
  'update.mandatory.failedInstall':
    '更新已下载，但安装程序没有启动。下载的文件可能已损坏。',
  'startup.label': '登录时启动',
  'startup.blocked': '你的桌面已在其启动应用中关闭它',
  'startup.failed': '你的系统不允许更改',
  'disclaimer.liability':
    'FluidEQ 会改变你电脑上的音频处理方式：它的引擎位于你的应用和声音服务器之间，处理你听到的一切声音。在法律允许的最大范围内，{author} 对使用本软件所引起的损害不承担责任：包括对你的听力、对音箱、耳机或其他设备、对数据或其他软件的损害，以及任何其他损失，也包括你无法预见的损失。',
  'provenance.body':
    'FluidEQ 的官方软件包仅通过 fluideq.com 提供。源码构建应来自官方仓库。GPL 允许第三方复制、修改、重新构建并出售 FluidEQ，但他们的构建不会获得 FluidEQ 的审核、支持或认可。如果某个下载自称是官方版本，却并非来自 fluideq.com 或官方仓库，请关闭它并举报。',
  'engineHealth.offBody':
    '此输出正在播放没有 EQ 的声音。重启音频通常能让引擎恢复，在此期间 FluidEQ 的其他功能照常可用。',
  'engineHealth.rackNeedsEngine':
    'DSP 效果运行在引擎内部。重启音频会让引擎重新启动；如果这样没有用，重新安装 FluidEQ 会把它自带的引擎装回原位。',
  'tour.engine.lead':
    'FluidEQ 现在有了自己的音频引擎。它在你的声音服务器（PipeWire 或 PulseAudio）旁运行，让电脑播放的一切声音都经过你的 EQ 和整套 DSP 机架：游戏、浏览器、流媒体应用——不只是媒体库。',
  'tour.engine.flow.inside': '在声音服务器旁',
  'tour.dsp.lead':
    '一套录音棚级环节：标准化、降噪、激励器、低音熔炉、均衡器、低音冲击、空间感、房间、最大化器和母带，另有媒体库曲目之间的交叉淡化。它作用于电脑播放的一切声音。每个环节都有自己的页面和实时视图，大多数带有预设，其中五个还有“独听”开关，可以只听该环节的效果。',
  'tour.dsp.how':
    '打开 DSP 标签页，在“预设”里选一条链，再在侧边标签中点开一个环节并将其切换为“开启”。',
  'help.start.steps':
    '用 .deb 或 AppImage 安装 FluidEQ 并打开它：FluidEQ 引擎会随它一起启动，无需密码，也无需重启。\n在“输出设备”中选择你的聆听设备。开启“系统均衡”，并保持“自动归一化”开启。\n播放一首歌曲，打开“均衡器 → 频段”，做一点小调整，再对比“系统均衡”关闭与开启时的声音。',
  'help.start.tip':
    'Linux 上的系统级 EQ 需要 PipeWire 或 PulseAudio，当前所有桌面都在使用其中之一。FluidEQ 打开期间，你播放的一切都会经过它；退出后，你的声音会原样归还。',
  'help.window.tip':
    '“帮助”菜单可打开本指南、“更新说明”、音频排障工具和“报告问题”。旁边的脉冲按钮里则有引擎卡片、你的账户、导入均衡设置或脉冲响应、重启音频，以及“进程”——它会显示 FluidEQ 的每个部分正在占用什么；它的菜单底部则是“亮度”和“透明度”、动画、“登录时启动”和语言。这两个按钮之后的开关会把窗口变成迷你播放器。',
  'help.window.actions':
    '引擎、你的账户、导入均衡设置、重启音频，以及“进程”；还有“亮度”和“透明度”、动画、“登录时启动”和语言。',
  'help.player.tip':
    '播放器的音量就是电脑本身的音量，因此它控制着电脑播放的所有声音。如果播放器跑到了屏幕之外，请在顶栏中右键点击 FluidEQ 的图标，然后选择“恢复窗口”。',
  'help.player.volume': '你电脑的音量：它控制着电脑播放的所有声音。',
  'help.requirements.intro':
    'FluidEQ 能在近几年的任何 64 位 Linux 桌面上运行——Ubuntu、Debian、Fedora、Mint、Arch 等等。只有两部分要求更高：Plus 可视化效果由显卡绘制，AI 卡拉OK 会在你第一次使用时下载它的模型。',
  'help.requirements.steps':
    '先看看你的系统：带 PipeWire 或 PulseAudio 的 64 位 Linux（当前所有桌面都有其一），4 GB 内存，约 600 MB 磁盘空间。.deb 适用于 Ubuntu、Debian 及其衍生版；AppImage 可在其余发行版上运行。\n打开一个可视化效果：2013 年以后的任何显卡或核显。1080p 用核显就够；4K 用独立显卡更合适。显卡繁忙时，FluidEQ 会把场景画得更小，并放开你看不到的场景。\n试一次 AI 卡拉OK：分离人声第一次会下载 713 MB 的模型，音高模型再加约 180 MB，降噪模型 11 MB。它在处理器上运行，四分钟的歌大约需要四分钟分离。处理期间请留出 2 GB 内存。\n条件允许就照这个来：8 GB 内存、2018 年以后的显卡；如果使用 AI 功能，再留出 3 GB 磁盘空间。',
  'help.requirements.keywords':
    '系统要求, 配置要求, 硬件要求, 电脑配置, 最低配置, 推荐配置, GPU, 独显, 集显, 集成显卡, 显存, CPU, RAM, 硬盘, 存储空间, 笔记本, 性能, 卡顿, 兼容性, 资源占用, Linux, Ubuntu, Debian, Fedora, Mint, Arch, PipeWire, PulseAudio, deb, AppImage',
  'help.engine.intro':
    'FluidEQ 用自己的引擎处理你的声音。FluidEQ 引擎在你的声音服务器（PipeWire 或 PulseAudio）旁运行：它成为系统的输出，让电脑播放的一切声音都经过你的 EQ 和 DSP 机架，再把结果送到你真正的输出，并在 FluidEQ 关闭的那一刻停止介入。',
  'help.engine.steps':
    '打开操作菜单（右上角的脉冲按钮）。最上方的引擎卡片会显示引擎是否正在运行。\n在“输出”面板中选择你聆听的输出。FluidEQ 会播放到它，并在你于声音设置中选择另一个输出时跟着切换。\n如果提示说引擎没有运行，请按“重启音频”。',
  'help.engine.tip':
    '让 FluidEQ 保持为系统的输出：在声音设置中选择扬声器或耳机都没问题，FluidEQ 会跟着切换。退出 FluidEQ 后，所有应用都会回到你选择的输出。',
  'help.engine.keywords':
    '音频引擎, 驱动, 系统级, 全局, 全局音效, 所有应用, 所有软件, 系统声音, 网易云音乐, QQ音乐, Spotify, 浏览器, PipeWire, PulseAudio, 声音服务器, 输出, 默认输出, 重启音频',
  'help.engine.apo':
    'Linux 上不适用：Equalizer APO 是 Windows 程序，在这里由 FluidEQ 引擎完成它的工作。',
  'help.engine.apply':
    'Linux 上不需要：FluidEQ 引擎是唯一的引擎，并且已经在使用中。',
  'help.convolution.tip':
    'FluidEQ 引擎会自行转换任何脉冲采样率。目录下载需要联网，指南本身不需要。',
  'help.profiles.output':
    '你正在聆听的输出，蓝牙耳机还会显示电量。“已关闭”表示你的 EQ 作用不到它；“使用中”表示它就是当前正在播放的输出。',
  'help.config.tip':
    '生成的层文件会在其设置改变时被重写；需要长期保留的手动配置行，请写入每个输出各自的自定义文件。FluidEQ 引擎会读取其中的 Filter、Preamp、GraphicEQ 和 Convolution 行；Plugin: 行和 VST 插件在 Linux 上无法运行。',
  'help.dsp.intro':
    'DSP 机架是一条由录音棚级环节组成的处理链。使用 FluidEQ 引擎时，它处理电脑播放的一切声音。FluidEQ 关闭期间，它也处于关闭状态。',
  'help.room.tip':
    '游戏和影片只会把环绕声道送到设置了相应扬声器数量的输出：如果你的设备具备这些扬声器，请在声音设置中为它选择 5.1 或 7.1。',
  'help.online.tip':
    '使用 FluidEQ 引擎时，在线媒体会像其他应用一样经过你的 EQ 和 DSP 机架。',
  'help.library.tip':
    '媒体库需要原始文件：请重新连接磁盘，或重新添加移动过的文件夹。',
  'help.share.tip':
    '连接码授权链接，请保密。这台电脑在共享时会保持 DSP 开启，播放其声音的电脑会套用自己的 DSP。同时播放和发送需要那台电脑使用 Windows，或在 Linux 上使用 FluidEQ 引擎；在其他情况下，链接只能单向工作。',
  'help.trouble.steps':
    '没有声音：确认正在播放、选中了预期的输出、音量已调高，并且设备已连接。检查“同时只播放一处”是否暂停了另一个来源。\nEQ 没变化：确认“系统均衡”已开启，并且输出没有显示“已关闭”标记。如果提示说引擎没有运行，请按“重启音频”。\n一切看起来都正常，均衡器却仍然没有作用：请检查 FluidEQ 是否仍是声音设置中的输出；重启音频会把它恢复。\n失真或低音过多：保持“自动归一化”开启，减小提升量，并逐层旁路。如果问题仍然存在，请使用“报告问题”，并在发送前检查报告内容。',
  'troubleshoot.description':
    '在 Linux 上，几乎所有问题一步就能解决：重新启动 FluidEQ 引擎，只需几秒钟。',
  'troubleshoot.footer':
    '试过之后还是不行？请使用同一菜单中的 **{report}**：它会收集日志，去掉任何能识别你的信息，并在发送前把完整内容给你看。',
  'help.window.plus': '可视化、图库和工作室。',
  'help.plus.intro':
    '账户是可选的：原本免费的一切在这台电脑上无需账户即可运行。登录后，Plus 标签页包含“可视化”和工作室。“可视化”中的场景每个一点，并永久归你；已确认的账户可免费获得一些点数，点数包只需付款一次。',
  'help.library.steps':
    '打开“媒体库”并添加存放媒体的文件夹。等扫描完成后，再判断缺了什么。\n选择歌手或专辑，或搜索歌曲，然后从结果中开始播放。\n用窗口底部的播放栏暂停、定位和切歌。它的音量就是电脑本身的音量。',
};

export default zh;
