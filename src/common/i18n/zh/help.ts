/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.menu': '帮助',
  'help.title': '用户指南',
  'help.subtitle': '找到你的声音，轻松上手。',
  'help.intro':
    '这份实用指南使用 FluidEQ 的真实界面截图。从第一次聆听开始，再按自己的节奏探索应用的各个部分。',
  'help.offline': '可离线阅读',
  'help.search': '搜索指南',
  'help.searchHint': '试试：引擎、低音、可视化…',
  'help.contents': '指南目录',
  'help.results': '{count} 个章节',
  'help.empty': '没有找到章节。请缩短关键词或清除搜索。',
  'help.clear': '清除搜索',
  'help.close': '关闭指南',
  'help.enlarge': '放大截图：{title}',
  'help.closeImage': '关闭截图',
  'help.controlsOf': '{title}：各控件的作用',
  'help.captureNote':
    '截图来自真实的 FluidEQ 1.6 和 1.7 版本。你的版本在颜色、文字和控件位置上可能有所不同。图中设置仅作示例，并非推荐预设。',
  'help.steps': '动手试试',
  'help.tip': '实用提示',
  'help.back': '返回顶部',

  'help.group.start': '开始使用',
  'help.group.sound': '塑造你的声音',
  'help.group.visuals': '看见你的音乐',
  'help.group.plus': 'FluidEQ Plus',
  'help.group.listen': '聆听、歌唱与分享',
  'help.group.help': '需要帮助时',

  'help.start.title': '上手的前五分钟',
  'help.start.intro':
    '先用舒适的音量播放一首熟悉的歌曲。左侧栏用于开启 FluidEQ，并提供前级增益；中间是你的工作区；右侧栏跟随你的输出及其配置。窗口底部的播放栏可以控制正在播放的任何内容。',
  'help.start.steps':
    '安装 FluidEQ，当安装程序询问如何处理你的声音时，保持选中“FluidEQ 引擎”。Windows 只会请求一次授权，无需重启电脑。\n在“输出设备”中选择你的聆听设备。开启“系统均衡”，并保持“自动归一化”开启。\n播放一首歌曲，打开“均衡器 → 频段”，做一点小调整，再对比“系统均衡”关闭与开启时的声音。',
  'help.start.tip':
    '系统级 EQ 需要 Windows 和一个音频引擎：FluidEQ 引擎或 Equalizer APO。在 macOS 和 Linux 上，应用显示的是演示输出设备，因此那里的图表在动并不能证明有任何声音被处理。',

  'help.window.title': '窗口导览',
  'help.window.intro':
    '标题栏带你在 FluidEQ 的各个页面之间切换，并实时显示正在播放的声音。左侧栏有整个 EQ 的总开关、前级增益和电平表；右侧栏跟随你的输出及其配置。',
  'help.window.steps':
    '在标题栏中点击要去的页面：音频信号之前是“在线媒体”“共享音频”和“均衡器”，之后是“DSP”“媒体库”“卡拉OK”和“Plus”。\n在左侧栏开启“系统均衡”，并保持“自动归一化”开启，这样任何提升都不会削波。\n点击音频信号或电平表可更改其绘制方式；按“彩虹模式”则会让曲线和电平表以屏幕的完整刷新率绘制。',
  'help.window.tip':
    '“帮助”菜单可打开本指南、“更新说明”、音频排障工具和“报告问题”。旁边的脉冲按钮里则有引擎卡片、导入均衡设置或脉冲响应、重启 Windows 音频，以及“进程”——它会显示 FluidEQ 的每个部分正在占用什么。',
  'help.window.headerLeftCaption': '标题栏，到音频信号为止',
  'help.window.headerRightCaption': '标题栏，音频信号之后',
  'help.window.railCaption': '左侧栏',
  'help.window.media':
    'YouTube、YouTube Music、Bandcamp、Twitch 和 Suno，在 FluidEQ 内播放，并经过你的 EQ 处理。',
  'help.window.share':
    '把这台电脑的声音发送到另一台电脑，或在这里播放另一台电脑的声音。',
  'help.window.eq': '你的频段、预设、耳机校正、游戏预设以及引擎配置。',
  'help.window.waveName': '音频信号',
  'help.window.wave': '正在播放的内容，实时呈现。点击它可更改绘制方式。',
  'help.window.rainbow':
    '给窗口染上彩虹色，并以屏幕的完整刷新率绘制曲线和电平表。',
  'help.window.dsp': '效果机架：预设、“房间”，以及处理链的每个环节。',
  'help.window.library': '你的音乐文件、专辑和播放队列。',
  'help.window.karaoke': '跟着唱，也可以用你自己的歌曲制作卡拉OK。',
  'help.window.plus': '可视化效果、图库、排行榜和工作室。',
  'help.window.support': '支持 FluidEQ 开发工作的几种方式。',
  'help.window.help': '本指南、“更新说明”、音频排障工具和“报告问题”。',
  'help.window.actions': '引擎、导入均衡设置、重启 Windows 音频，以及“进程”。',
  'help.window.systemEq': '为电脑播放的所有声音开启或关闭 FluidEQ 的处理。',
  'help.window.preamp':
    '在 EQ 之前降低电平，给提升留出余量。“自动归一化”会替你设置它。',
  'help.window.autoNormalize':
    '把前级增益保持在刚好够低的位置，让你的任何提升都不会削波。',
  'help.window.responseGraph': '显示或隐藏页面下方的图表。',
  'help.window.meterName': '电平表',
  'help.window.meter': '左右声道的输出电平，以真实分贝显示。点击它可更换样式。',

  'help.requirements.title': '你的电脑需要什么',
  'help.requirements.intro':
    'FluidEQ 能在近十年的任何 Windows 电脑上运行。只有两部分要求更高：Plus 可视化效果由显卡绘制，AI 卡拉 OK 会在你第一次使用时下载它的模型。',
  'help.requirements.steps':
    '先看看你的 Windows：64 位的 Windows 10 1803 版或更高，或 Windows 11，4 GB 内存，约 600 MB 磁盘空间。要处理电脑播放的所有声音，需要 FluidEQ 引擎或 Equalizer APO，安装时 Windows 会请求一次权限。\n打开一个可视化效果：2013 年以后的任何显卡或核显。1080p 用核显就够；4K，或同时在多块屏幕上做桌面背景，独立显卡更合适。显卡繁忙时，FluidEQ 会把场景画得更小，并放开你看不到的场景。\n试一次 AI 卡拉 OK：分离人声第一次会下载 713 MB 的模型，音高模型再加约 180 MB，降噪模型 11 MB。有支持 DirectX 12 的显卡时，四分钟的歌大约半分钟就能分离；只用处理器则约需四分钟。处理期间请留出 2 GB 内存。\n条件允许就照这个来：Windows 11、8 GB 内存、2018 年以后的显卡；如果使用 AI 功能，再留出 3 GB 磁盘空间。',
  'help.requirements.tip':
    '除了 AI 模型，其余都在安装程序里；模型只在你第一次使用该功能时下载。操作菜单中的“进程”会显示 FluidEQ 的每个部分此刻在你电脑上占用了什么。',

  'help.engine.title': 'FluidEQ 引擎',
  'help.engine.intro':
    'FluidEQ 可以用自己的引擎或 Equalizer APO 处理你的声音。FluidEQ 引擎在 Windows 音频服务内部、声卡音效之后运行，让电脑播放的一切声音都经过你的 EQ 和 DSP 机架，并在 FluidEQ 关闭的那一刻停止介入。',
  'help.engine.steps':
    '打开操作菜单（右上角的脉冲按钮），点击最上方的引擎卡片。\n选择“FluidEQ 引擎”并按“应用”。Windows 会请求授权，音频会在重启时暂停几秒钟。\n如果某个输出显示“已关闭”，请在它的提示中按“启用”。如果提示说引擎没有运行，请按“重启 Windows 音频”。',
  'help.engine.tip':
    'Equalizer APO 仍可用于 APO 自定义命令、Peace 和 VST 插件。更新带来新版引擎时，会出现提示并提供“更新引擎”。从托盘退出 FluidEQ 会关闭所有输出上的 EQ。',
  'help.engine.fluid': '推荐。声卡音效继续可用，EQ 和 DSP 机架作用于每个应用。',
  'help.engine.apo':
    '可运行 APO 自定义命令、Peace 和 VST 插件。DSP 机架只作用于媒体库播放。',
  'help.engine.apply': '切换引擎。Windows 会请求一次授权，音频会重启几秒钟。',

  'help.eq.title': '用 EQ 塑造声音',
  'help.eq.intro':
    '频率决定作用位置，增益决定提升或衰减，Q 决定宽度：Q 越高，频段越窄。未选中任何频段时，“低音”“中音”和“高音”会一次移动整条曲线。先从轻微而宽的调整开始，并经常对比。',
  'help.eq.steps':
    '打开“均衡器 → 频段”。未选中任何频段时，转动“低音”“中音”或“高音”，即可快速改变音色。\n点击频段的频率或它在图表上的控制点，即可选中它。转动它的“频率”“增益”和“品质因数 (Q)”旋钮，选择“滤波器”类型，或用“启用”开关关闭它。\n右键点击频段可以重置、停用它，或在它旁边添加频段。按“清空均衡”可将所有增益设为 0 dB，同时保留你的频段。执行前会先请你确认。',
  'help.eq.tip':
    '“同时生效”列出除你的频段之外还在影响这个输出的内容，每一项都有自己的强度和 ×。“游戏模式”会减少 FluidEQ 带来的延迟，适合游戏和通话；“游戏”预设会开启它。',
  'help.eq.bandsCaption': '“频段”页面，未选中任何频段',
  'help.eq.bandCaption': '选中一个频段时',
  'help.eq.gameMode':
    '减少 FluidEQ 带来的延迟，适合游戏和通话。“游戏”预设会开启它。',
  'help.eq.layers':
    '还有什么在影响这个输出——耳机校正、智能均衡、卷积——每一项都有自己的强度、开关和 ×。',
  'help.eq.bandName': '频段',
  'help.eq.band': '拖动它的控制点可提升或衰减。点击它的频率即可选中它。',
  'help.eq.bass': '提升或降低整条曲线的低频部分。',
  'help.eq.mid': '提升或降低中频，也就是人声所在的区域。',
  'help.eq.treble': '提升或降低高频，也就是空气感和细节。',
  'help.eq.selected': '正在编辑的频段。按住 Ctrl 或 Shift 点击可选择多个。',
  'help.eq.filter':
    '它的形状：钟形、低频搁架、高频搁架、陷波，或低通、高通、带通滤波器。',
  'help.eq.voicing':
    '为声音准备好的一整条链，例如“音乐”或某个风格；选“无”则只保留你自己的频段。',
  'help.eq.smart': '聆听正在播放的内容并加以校正：“细节”“平衡”或“目标”。',
  'help.eq.clear': '把所有增益设为 0 dB，并保留你的频段。执行前会先请你确认。',
  'help.eq.mode': '你的 EQ 和曲线的作用强度、频段 Q 以及相位。',
  'help.eq.add': '在所选频段旁边添加一个频段。',
  'help.eq.layouts': '频段数量，以及你保存的频段布局。',
  'help.eq.frequency': '所选频段的作用位置，范围从 1 Hz 到 20 kHz。',
  'help.eq.gain': '提升或衰减的幅度。按住 Ctrl 点击可恢复为 0 dB。',
  'help.eq.q': '频段的宽度：数值越高越窄。',
  'help.eq.delete': '按两次即可删除该频段；按“保留”则取消删除。',
  'help.eq.menuCaption': '频段的右键菜单',
  'help.eq.reset': '增益恢复为 0 dB，Q 恢复为 2。',
  'help.eq.disable': '让该频段不再影响声音，并保留它的设置。',
  'help.eq.addLeft': '在它与较低相邻频段的正中间添加一个频段。',
  'help.eq.addRight': '在它与较高相邻频段的正中间添加一个频段。',

  'help.eqmode.title': 'EQ 模式与频段布局',
  'help.eqmode.intro':
    'EQ 模式改变你的频段和校正曲线的应用方式，而不会修改它们本身。频段布局会记下你喜欢的一套频段的频率和 Q，随时可用于任何输出。',
  'help.eqmode.steps':
    '在“频段”工具栏上打开“EQ 模式”。在音乐播放时试试“强度”“频段 Q”或“曲线平滑”中的选项；面板会保持打开。\n使用 FluidEQ 引擎时，可将“相位”设为“最小”或“线性”。按“重置”可将一切恢复为“普通”。\n打开“添加频段”旁边的布局按钮。选择 6、10、15、20 或 31 个频段，或按“保存布局…”为当前布局命名。',
  'help.eqmode.tip':
    '布局只保存频率和 Q：载入布局后，每个频段都从 0 dB 开始。线性相位会增加延迟，并可能在尖锐的瞬态之前产生振铃。',
  'help.eqmode.modeCaption': 'EQ 模式',
  'help.eqmode.strength':
    '“普通”“录音室 ×1.5”或“×2”，你的 EQ 和曲线可分别设置。',
  'help.eqmode.q':
    '“恒定”保留每个频段的 Q；“比例”和“非对称”会在增益变大时让频段变窄。',
  'help.eqmode.smoothing': '让采样得到的校正曲线更平滑。',
  'help.eqmode.phase': '“最小”或“线性”。仅限 FluidEQ 引擎。',
  'help.eqmode.reset': '全部恢复为“普通”。',
  'help.eqmode.designsCaption': '频段布局',
  'help.eqmode.builtIn': '6、10、15、20 或 31 个频段的标准布局。',
  'help.eqmode.save': '把当前的频率和 Q 命名保存为布局，列在“我的布局”下。',

  'help.games.title': '游戏预设',
  'help.games.intro':
    '为每个游戏设定专属的音效。游戏来到最前面时，FluidEQ 会切换到这种音效，并一直保持到你关闭游戏，其间无论你用 Alt+Tab 切到哪里都不变。之后，它会换回你原来的音效。',
  'help.games.steps':
    '打开“均衡器 → 游戏预设”，按“添加游戏”。从你的启动器中选一个，或选一个当前打开的程序，也可以自己选择它的程序。\n在它那一行的选择器中，选好它该用的音效：某个“游戏”预设，或其他任何预设。\n启动游戏。桌面上会出现一张卡片，说明 FluidEQ 切换到了什么；关闭游戏时，另一张卡片会说明换回了什么。',
  'help.games.tip':
    '游戏掌控音效期间，窗口底部的播放栏会显示它的名字。游戏中另选的音效会保留：FluidEQ 只会撤回自己设置的那一个。“游戏”预设还会开启“游戏模式”。',
  'help.games.tab': '你的游戏，以及每个游戏各自的音效。',
  'help.games.add':
    '从 Steam、Epic、EA、GOG、育碧、战网或 Xbox 添加游戏，或添加任何当前打开的程序。',
  'help.games.gameName': '游戏',
  'help.games.game': '游戏本身，以及 FluidEQ 用来识别它的文件夹。',
  'help.games.soundName': '它的音效',
  'help.games.sound':
    '这个游戏来到最前面时 FluidEQ 切换到的音效，或选“保持不变”。',
  'help.games.removeName': '移除',
  'help.games.remove': '让 FluidEQ 忘掉这个游戏。它用过的预设仍会保留。',

  'help.headphones.title': '耳机校正与导入',
  'help.headphones.intro':
    '耳机校正补偿已测量型号的响应。它是一个起点，可以和自己的频段及预设一起使用。应用结果前，请核对准确型号及测量作者。',
  'help.headphones.steps':
    '打开“均衡器 → EQ 预设”，搜索你的耳机型号。查看可用的测量数据，并选择匹配的条目。\n对于来自其他工具的 EQ 文本，请使用操作菜单中的“导入均衡设置”。应用前先检查解析出的频段和曲线。\n对于 Squiglink，把它的导出内容粘贴到导入面板。“作为 EQ 应用”会替换你的频段；“作为曲线应用”会把它添加为耳机校正，并带有独立的强度。',
  'help.headphones.tip':
    '标记为“未应用”的预览不会改变声音。避免意外叠加同一耳机的两套完整校正。',

  'help.convolution.title': '使用脉冲响应',
  'help.convolution.intro':
    '卷积将 WAV 脉冲响应作为独立校正层。可以搜索 AutoEq 目录或导入自己的 WAV；参数均衡频段仍保持独立。',
  'help.convolution.steps':
    '打开“均衡器 → 卷积”，按型号或测量作者搜索。\n核对来源，然后使用“下载并应用”；下载的文件会匹配你的输出采样率。已有文件时，请使用“导入 WAV”。\n在“同时生效”中开启和关闭卷积层，对比聆听。',
  'help.convolution.tip':
    'FluidEQ 引擎会自行转换任何脉冲采样率。Equalizer APO 需要导入与输出采样率相同的 WAV。目录下载需要联网，指南本身不需要。',

  'help.profiles.title': '设备、配置与第二输出',
  'help.profiles.intro':
    '你的 EQ 会跟随输出设备。“自动绑定”将修改保存到当前输出，“已命名的配置”则让你保留不同的声音方案。“第二路输出”将播放镜像到其他设备，每个设备有独立音量。',
  'help.profiles.steps':
    '编辑前先确认“输出设备”。想保留的声音用“新建配置”保存；“更新”会把修改保存到该命名配置，“还原”则载回它已保存的设置。\n打开“第二路输出”，启用一个可连接的设备并设置音量。在它正下方直接选择该设备已保存的 EQ 配置。\n“游戏/视频”使用较小的初始缓冲，“音乐”保留更多余量。请在你的设备上对比同步效果。',
  'help.profiles.tip':
    '无论使用哪个引擎，每个镜像输出都使用自己的配置。镜像需要 FluidEQ 保持打开；切换主输出会停止旧镜像。设备延迟也会影响同步。',
  'help.profiles.list':
    '你保存的声音。“在用”标出这个输出正在使用的那一个；点击另一个即可切换。',
  'help.profiles.update': '把你的修改保存到当前所在的配置。',
  'help.profiles.new': '用你现在的 EQ 新建一个配置。',
  'help.profiles.restore': '把配置恢复为你上次保存时的样子。',
  'help.profiles.output':
    '你正在聆听的输出。“已关闭”表示你的 EQ 作用不到它；“使用中”表示 Windows 正在通过它播放。',
  'help.profiles.mapping':
    '这个输出所跟随的配置。你做的任何修改都会自动保存到其中。',
  'help.profiles.onePlayer':
    '在 FluidEQ 中开始播放，会暂停电脑上其他地方正在播放的内容，反之亦然。',
  'help.profiles.outputs':
    '你的其他输出。开启其中一个，声音也会在那里播放，并使用它自己的配置。',
  'help.profiles.driver':
    '为你的聆听设备提供一个温和的起点——头戴式耳机、入耳式耳机、单元尺寸或材质。如果声音已经合适，就保持“不做补偿”。',

  'help.config.title': '检查与备份处理链',
  'help.config.intro':
    '“均衡器 → Config”显示音频引擎实际保存在磁盘上的内容。输出卡片和包含文件树帮助你看清涉及哪些设备和层。在大幅尝试之前或迁移设置时，请先导出处理链。',
  'help.config.steps':
    '打开均衡器 → Config，选择输出并查看状态和活动层。\n使用导出链路保存 .fluideq 文件。\n恢复时先选择目标输出，再导入链路并检查结果。',
  'help.config.tip':
    '生成的层文件会在其设置改变时被重写；需要长期保留的手动配置行，请写入每个输出各自的自定义文件。FluidEQ 引擎会读取其中的 Filter、Preamp、GraphicEQ 和 Convolution 行；其他 APO 命令和插件需要 Equalizer APO。',

  'help.dsp.title': '探索 DSP 机架',
  'help.dsp.intro':
    'DSP 机架是一条由录音棚级环节组成的处理链。使用 FluidEQ 引擎时，它处理电脑播放的一切声音；使用 Equalizer APO 时，它处理媒体库中的音频曲目。FluidEQ 关闭期间，它也处于关闭状态。',
  'help.dsp.steps':
    '打开 DSP。在“预设”中选一条处理链，或在侧栏中选择一个环节并将其切换为“开启”。\n每次只改一个控件，并在相近音量下与旁路该环节时对比。“独听”让你只听到某个环节添加的内容。\n保存你喜欢的机架，并用“导出”和“导入”分享它。',
  'help.dsp.tip':
    '更响的声音往往只是因为更响才显得更好，所以请在音量一致时比较。按住 Ctrl 点击旋钮，可将其恢复为默认值。',
  'help.dsp.normalizer': '统一响度。处理实时音频时，它会逐首歌曲调整电平。',
  'help.dsp.denoise':
    '修复嘶声、哼声和爆音。神经网络人声清理器用于媒体库曲目。',
  'help.dsp.exciter': '添加谐波，增加厚度和空气感。',
  'help.dsp.bassForge': '在低音之下加上真正的低八度，或为小音箱加上它的谐波。',
  'help.dsp.equaliser': '十五个参数频段，可选最小相位或线性相位。',
  'help.dsp.bassPunch': '塑造低音的起音、延音和绽放。',
  'help.dsp.dimension': '拓宽立体声声场，而不改变单声道总和。',
  'help.dsp.maximizer': '提高电平，同时不让峰值超过上限。',
  'help.dsp.master': '最终电平、响度目标和峰值保护。',
  'help.dsp.crossfade': '让一首媒体库曲目平滑过渡到下一首。',
  'help.dsp.presets': '针对不同流派、设备和修复需求的整架处理链。',
  'help.dsp.scopeName': '全系统',
  'help.dsp.scope': '机架正在哪里运行，以及线性相位带来的延迟。',

  'help.room.title': '房间：耳机上的环绕声',
  'help.room.intro':
    '房间把耳机变成一间听音室。声音的每个声道都成为你头部周围的一只音箱，经由测量得到的头部模型和你亲手塑造的房间反射渲染，于是电影在你面前，游戏在你四周。它需要 FluidEQ 引擎和耳机；在音箱上没有用处。',
  'help.room.steps':
    '打开 DSP，在侧栏选择“房间”并开启。立体声变成你面前的两只音箱；5.1 电影是五只加低音炮；7.1 游戏是整个环绕圈。开关旁的标记会说明当前是哪一种。\n在顶部选一个房间——录音室、客厅、影院、音乐厅等——或自己转动“大小”“墙面”“距离”，并在环上拖动音箱。播放中的音频流到达不了的音箱会以休眠状态绘制。\n按“开始听音测试”，回答五组短暂的听感对比：房间会采用把声音放到你面前的那个头部模型。也可以手动选择小、中、大。\n把喜欢的房间以名称保存；已保存的房间一按即回，且从不更改你的头部设置。',
  'help.room.tip':
    '游戏和影片只会把环绕声道送到 Windows 认为具备相应扬声器数量的输出：若驱动接受，输出面板会提供一键切换到 7.1。',
  'help.room.picker':
    '起点房间，像其他处理级的配置一样分组；一经修改即为“自定义”。',
  'help.room.picture':
    '从上方看到的房间：随吸收而变淡的墙、环上的扬声器、中间的头部。全部按同一比例绘制，因此比房间还远的扬声器会画在墙外。拖动一只，它的配对会跟着移动；按住 Shift 可单独移动。',
  'help.room.speaker':
    '按下房间里的一只扬声器，这个面板就属于它：以数字表示的角度、它自己的距离、它的电平，以及用于单独试听的静音与独奏。',
  'help.room.speakerName': '选中的扬声器',
  'help.room.dialsName': '房间感、余韵、距离',
  'help.room.dials':
    '你能听到多少墙的声音、其后柔和的余韵，以及扬声器的距离。大小、墙面以及余韵的长度和音色在下方的“房间特性”中。',
  'help.room.fit': '五组听感对比，为你的耳朵选出头部模型。',
  'help.room.head': '房间渲染所用的测量头部模型：小、中或大。',
  'help.room.saved': '为当前房间命名；一按即回。',
  'help.room.liveName': '房间正在做什么',
  'help.room.live':
    '读取自引擎：播放中的音频流到达了哪些音箱，或房间为何闲置。',

  'help.denoise.title': '降噪与来源分析',
  'help.denoise.intro':
    '降噪可以减少嘶声、市电哼声和爆音。使用 FluidEQ 引擎时，它会实时处理电脑播放的任何声音；神经网络人声清理器和扫描得到的底噪只用于媒体库曲目。降噪越强并不一定越好。',
  'help.denoise.steps':
    '播放带有待处理噪声的内容，并在 DSP 中选择“降噪”。\n以较轻的设置开启“嘶声”“哼声”或“爆音”，聆听安静的段落和音乐细节。\n逐步加大降噪量，然后旁路该环节，确认改善是否值得损失一些细节。',
  'help.denoise.tip':
    '留意细节是否变得模糊，以及是否出现水声感或抽吸感。它不是用来清理麦克风声音的。如果听不出变化，请确认机架和该环节都已开启。',

  'help.graph.title': '图表及其控件',
  'help.graph.intro':
    '频响图会在实时声音之上绘制你的 EQ 曲线。它上方的工具条决定画什么、怎么画，并随外观而变化：标准样式或 Plus 可视化效果。',
  'help.graph.steps':
    '点击外观名称，选择样式或可视化效果。名称旁的箭头、Space 和 Ctrl+Space 可以逐个切换。\n打开“视图”，可设置图表的大小、显示内容，以及波形的高度和位置。 帧率也在那里：显示器能提供的每一帧，或 60、30，使用电池时为 60。\nPlus 可视化效果会在「视图」中加入自带控件——作者留给你调整的部分——而「使用它自带的波形」会把波形恢复到该作者所选的高度与位置。\n双击绘图区可全屏。单击则隐藏或显示工具条。',
  'help.graph.tip':
    '这里的一切只改变画面，从不改变你的声音。彩虹模式（在“帮助 → 更新说明”中开启）会让标准样式、电平表和波形以屏幕的完整刷新率绘制，而不是每秒 30 帧。按 Esc 可退出展开视图和全屏视图。',
  'help.graph.stripCaption': '使用标准样式时',
  'help.graph.live': '显示或隐藏实时波形。',
  'help.graph.previous': '切换到上一个外观。',
  'help.graph.picker': '打开所有样式和可视化效果。',
  'help.graph.next': '切换到下一个外观。',
  'help.graph.autoName': '自动',
  'help.graph.auto': '按 10 秒到 2 分钟的间隔自动更换外观。',
  'help.graph.colouring': '为样式着色：“自动”“纯色”“频率”“电平”或“热度”。',
  'help.graph.newLook': '基于此样式设计你自己的外观。',
  'help.graph.bandsName': '听音频段',
  'help.graph.bands': '用底色标出你最常听到的频段。',
  'help.graph.bandsMenu':
    '同样的底色标记；使用 Plus 可视化效果时此项变灰不可用，因为它从不绘制底色。',
  'help.graph.gridName': '网格',
  'help.graph.grid': '显示或隐藏网格和刻度。',
  'help.graph.viewName': '视图',
  'help.graph.view': '大小、绘制内容和波形。',
  'help.graph.plusCaption': '使用 Plus 可视化效果时',
  'help.graph.tintName': '窗口颜色',
  'help.graph.tint':
    '应用主题、可视化效果的颜色，或它的颜色加上环绕的光（“氛围”）。',
  'help.graph.lighting': '用这个场景点亮你的 RGB 设备。',
  'help.graph.desktop': '把这个可视化效果放到桌面图标后面。',
  'help.graph.viewCaption': '“视图”菜单',
  'help.graph.expand': '图表放大，覆盖编辑区。',
  'help.graph.fullscreen': '图表铺满整个屏幕。',
  'help.graph.showingName': '当前显示',
  'help.graph.showing': '依次切换图表显示的内容。',
  'help.graph.waveName': '波形',
  'help.graph.wave': '实时绘制的频谱。',
  'help.graph.topWaveName': '顶部波形',
  'help.graph.topWave': '标题栏里的小波形。',
  'help.graph.meterName': '电平表',
  'help.graph.meter': '左侧栏里的输出电平表。',
  'help.graph.waveHeight': '波形绘制的高度。',
  'help.graph.wavePosition': '从底部边缘到中间。',
  'help.graph.attack': 'Plus 可视化效果随音乐上升的速度。',
  'help.graph.release': '每次击打后它回落得有多慢。',
  'help.graph.ownTiming': '恢复可视化效果自带的节奏。',
  'help.looks.title': '样式与 Plus 可视化效果',
  'help.looks.intro':
    '标准样式是免费的实时声音绘图，你可以自己配色和设计：“线条”和“面积”适合干净的轨迹，“LED 块”和“尖峰”更有冲击力，“桁架”“天际线”和“舞动的火焰”则呈现完整的场景。Plus 可视化效果是由显卡绘制的场景，例如阿尔卑斯、极光、绽放和霓虹之城，其中低音、节拍和高音各自带动不同的部分。',
  'help.looks.steps':
    '点击图表上的外观名称。可以搜索，或按“线条”“填充”“柱条”“点”或“场景”筛选样式。\n在右侧选择一个 Plus 可视化效果。没有 Plus 时它处于锁定状态，选择它会告诉你如何获得。\n在标准样式上按“新建外观”，修改它的颜色、律动和峰值，然后保存；它会出现在“你的”下面。',
  'help.looks.tip':
    'Plus 可视化效果自带颜色：可以在“视图”中设置它的起音和释放。如果某个场景无法在这台电脑上运行，图表会改为绘制一种免费样式，而不是留下空白。',
  'help.looks.searchName': '搜索',
  'help.looks.search': '按名称、作者或分类查找样式和可视化效果。',
  'help.looks.styles': '由 FluidEQ 绘制的免费样式，以及你保存的外观。',
  'help.looks.familiesName': '样式筛选',
  'help.looks.families': '“线条”“填充”“柱条”“点”“场景”和“你的”。',
  'help.looks.plus': '来自 FluidEQ 和会员的场景，每个都附有图片。',
  'help.looks.categoriesName': '分类',
  'help.looks.categories': '“自然”“城市”“抽象”等。',

  'help.plus.title': 'FluidEQ Plus 与你的账户',
  'help.plus.intro':
    '账户是可选的：原本免费的一切，无需账户也能在这台电脑上运行。FluidEQ Plus 按月或按年订阅，增加“可视化”、排行榜、工作室、动态灯效和桌面可视化效果。新账户可以免费试用 Plus 十五天；你发布并获得批准的场景，可以换来一个月。',
  'help.plus.steps':
    '在操作菜单中打开“账户”。登录，或创建账户并输入发送到你邮箱的六位验证码。\n按“升级到 Plus”，阅读条款，勾选同意，然后在浏览器中用同一个邮箱在 Buy Me a Coffee 上付款。\n打开 Plus 标签页。它的侧栏通往“排行榜”“可视化”“工作室”和“动态灯效”。',
  'help.plus.tip':
    '应用永远不会看到你的银行卡；可以通过“管理订阅”更改或取消订阅。免费试用不需要银行卡，结束时也不会扣费。一个账户最多可在五台电脑上保持登录，离线时 Plus 也能继续使用一段时间。',
  'help.plus.leaderboard': '在加入的 Plus 会员中，谁听得最多。',
  'help.plus.visualizers': 'FluidEQ 和会员创作的场景，随你的音乐律动。',
  'help.plus.studio': '用你的 AI 创作自己的场景。',
  'help.plus.lighting': '你的 RGB 设备跟随场景变化。',
  'help.plus.fold': '把侧栏收起，只显示图片；鼠标悬停时会重新展开。',

  'help.gallery.title': '“可视化”图库',
  'help.gallery.intro':
    '“可视化”收录了 FluidEQ 自己的场景和会员发布的场景。任何账户都可以浏览，并试看 FluidEQ 的免费示例十秒钟；有了 Plus，每个场景都能随你的音乐播放，并可添加到你的外观。',
  'help.gallery.steps':
    '打开“Plus → 可视化”。可以搜索，按“最多赞”“本周”或“最新”排序，或选择一个分类。\n打开一个场景，按“添加到我的外观”，再按“在图表上播放”。用箭头按钮或 ← 和 → 在场景之间切换。\n用爱心为会员的场景点赞，并举报不该出现在这里的场景。',
  'help.gallery.tip':
    '你外观中的场景会自动更新，场景页面会说明每个版本的变化。你发布的场景，会在审核员批准后出现。“在工作室中打开”可以查看 FluidEQ 自己的场景是怎么做的。',
  'help.gallery.search': '查找场景和作者。',
  'help.gallery.sortName': '排序',
  'help.gallery.sort': '最多赞、本周获赞最多，或最新。',
  'help.gallery.categoriesName': '分类',
  'help.gallery.categories': '只显示一类场景。',
  'help.gallery.mine': '你发布的场景及其获赞数。',
  'help.gallery.cardName': '场景',
  'help.gallery.card': '点击图片打开场景；“添加”会把它放进你的外观。',
  'help.gallery.manage': '每台显示器作为桌面背景显示的内容。',
  'help.gallery.stop': '停止所有桌面背景。',
  'help.gallery.sceneCaption': '场景页面',
  'help.gallery.back': '回到图库中你离开时的位置。',
  'help.gallery.stepName': '上一个和下一个',
  'help.gallery.step': '在你打开该场景时所在的列表中逐个切换。',
  'help.gallery.play': '把场景添加到你的外观，或在图表上播放它。',
  'help.gallery.desktop': '把场景放到桌面图标后面。',
  'help.gallery.inspect': '在工作室中打开 FluidEQ 的场景，看看它是怎么做的。',

  'help.leaderboard.title': '排行榜',
  'help.leaderboard.intro':
    '排行榜按收听时长和场景获得的点赞，为加入的 Plus 会员排名。除非你加入，否则它处于关闭状态。',
  'help.leaderboard.steps':
    '打开“账户”，按“加入排行榜”。\n打开“Plus → 排行榜”。选择排行榜上显示的用户名和显示名，然后在“全部时间”和“本月”之间切换。\n想停止时，按“退出排行榜”。“删除我的全部数据”会删除你发送过的所有内容。',
  'help.leaderboard.tip':
    '每天只有一个数字离开你的电脑——播放音乐的分钟数——绝不会包含你播放的内容。每个数字都会在服务器上核查。 昵称和名字以后可在“账户 → 更改名字”里修改；排行榜和你发布的场景会一起更新。',
  'help.leaderboard.periodName': '全部时间或本月',
  'help.leaderboard.period': '全部历史记录，或仅限本月。',
  'help.leaderboard.standing': '你的名次和积分，以及距离下一个名次还差多少分。',
  'help.leaderboard.earn':
    '每小时 10 分，每天收听 30 分钟或以上得 20 分，每个赞 5 分。',

  'help.studio.title': '在工作室中创作场景',
  'help.studio.intro':
    '工作室能把一段描述变成可视化效果。你自己的 AI 助手在项目文件夹中编写场景，每个版本一保存，FluidEQ 就会立即随你的音乐播放它。工作室属于 Plus；新账户可以用免费试用打开它。',
  'help.studio.steps':
    '打开“Plus → 工作室”，按“新建项目…”。给它起个名字；FluidEQ 会创建它的文件夹，里面已有一个会动的场景。\n描述你的想法，在你的 AI 助手中打开这个文件夹，然后粘贴用“复制 AI 提示词”复制的提示词。\n保存文件时观察舞台，并试试测试信号。然后选择“添加到我的外观”“发布…”或“导出…”。',
  'help.studio.tip':
    '双击舞台可全屏。“查看 FluidEQ 场景的内部…”会打开 FluidEQ 自己的某个场景供你学习；它不能被发布。闪烁过于强烈或运行过重的场景会被拦下。你发布的场景会先由审核员阅读，获得批准的场景可以换来一个月的 Plus。',
  'help.studio.project': '你的项目，以及可查看内部的 FluidEQ 场景。',
  'help.studio.switchName': '上一个和下一个项目',
  'help.studio.switch': '在你的项目之间前后切换。',
  'help.studio.stageName': '舞台',
  'help.studio.stage': '随你的音乐播放的场景。双击可全屏。',
  'help.studio.code': '场景的代码，实时显示，并在你的 AI 保存时更新。',
  'help.studio.prompt': '复制提示词，告诉你的 AI 场景是怎么做的。',
  'help.studio.hears': '场景接收到的内容：音量、节拍、低音、中音、高音。',
  'help.studio.signals': '只驱动当前预览的测试信号。',
  'help.studio.size': '在图表、窄面板、宽面板或全屏面板上试看场景。',
  'help.studio.wave': '试试听众可以设置的波形高度和位置。',

  'help.desktop.title': '桌面可视化效果',
  'help.desktop.intro':
    '桌面可视化效果会在 FluidEQ 运行期间，把 Plus 可视化效果放到桌面图标后面，可以只放在一台显示器上，也可以放在每一台上。',
  'help.desktop.steps':
    '在图表上显示一个 Plus 可视化效果，按下其名称旁的显示器按钮，或选择“视图 → 设为桌面背景”。\n在排布图上点选显示器，选择“随音乐”或“平静”，然后按“设置背景”。\n要更改或停止它，请打开“Plus → 可视化”，使用顶部的“管理”或“停止”。',
  'help.desktop.tip':
    '窗口盖住显示器、电脑锁定，以及（如果你选择）使用电池时，它会暂停；FluidEQ 启动时它会恢复。退出 FluidEQ 会停止它。仅限 Windows。',
  'help.desktop.monitors':
    '你的显示器，按 Windows 中的排列方式显示。点选要使用的显示器。',
  'help.desktop.music': '随正在播放的内容而动。',
  'help.desktop.calm': '缓慢安静的动画，不受音乐影响。',
  'help.desktop.battery': '电脑未接通电源时节省电量。',
  'help.desktop.start': '在你选择的显示器上启动它。',

  'help.lighting.title': '动态灯效（Beta）',
  'help.lighting.intro':
    '动态灯效通过 Windows Dynamic Lighting 和 Razer Chroma，让你的键盘、鼠标、鼠标垫、耳机和支架随图表上的 Plus 可视化效果亮起。它目前仍是 Beta 版，请告诉我们你的设备表现如何。',
  'help.lighting.steps':
    '打开“Plus → 动态灯效”并开启它，或按图表上 Plus 可视化效果旁边的灯效按钮。\n为这个可视化效果选择灯光风格（“场景”“色彩波浪”“频谱”或“节拍涟漪”），并设置它的亮度和“响应频段”。\n点击“你的设备”下的某台设备可单独调整它；“所有设备”则回到调整全部设备。',
  'help.lighting.tip':
    '如果 Windows 把某台设备留给了另一个应用，页面会指出需要更改的设置，并为你打开它。Razer 设备需要运行 Razer Synapse，并允许 Chroma Apps。',
  'help.lighting.switch': '在 Plus 可视化效果播放时点亮你的设备。',
  'help.lighting.browse': '打开图库选择可视化效果。',
  'help.lighting.previewName': '桌面实时预览',
  'help.lighting.preview': '你自己的桌面，以发送给它的颜色亮起。',
  'help.lighting.devices': '找到的所有设备。点击其中一台可单独调整。',
  'help.lighting.all': '回到同时调整所有设备。',
  'help.lighting.style':
    '“场景”“色彩波浪”“频谱”或“节拍涟漪”，为每个可视化效果分别保存。',

  'help.online.title': '聆听在线媒体',
  'help.online.intro':
    '在线媒体让支持的网站与 EQ 并排使用。播放和登录仍取决于网站与网络。FluidEQ 底部的播放栏跟随活动播放器，它的音量就是网站自身的音量。',
  'help.online.steps':
    '打开在线媒体，选择网站并在页面中播放内容。\n切换到均衡器边听边调，需要网站自身控件时再返回。\n启用“同时只播放一处”，避免与其他播放器重叠发声。',
  'help.online.tip':
    '使用 FluidEQ 引擎时，在线媒体会像其他应用一样经过你的 EQ 和 DSP 机架。使用 Equalizer APO 时，机架仍只作用于媒体库曲目。',

  'help.library.title': '建立本地音乐库',
  'help.library.intro':
    '媒体库汇集你磁盘上的音乐与视频，可按专辑、歌手、流派、歌曲、文件夹、文件夹树或你的播放列表浏览。封面和详细信息来自你的文件，因此同一批收藏可能因标签不同而呈现得不一样。',
  'help.library.steps':
    '打开“媒体库”并添加存放媒体的文件夹。等扫描完成后，再判断缺了什么。\n选择歌手或专辑，或搜索歌曲，然后从结果中开始播放。\n用窗口底部的播放栏暂停、定位和切歌。它的音量是所有播放器共用的同一个音量。',
  'help.library.tip':
    '将鼠标悬停在 Windows 任务栏上的 FluidEQ 按钮上，即使窗口已最小化，也能使用“上一首”“播放”和“下一首”。媒体库需要原始文件：请重新连接磁盘，或重新添加移动过的文件夹。',

  'help.queue.title': '专辑与播放队列',
  'help.queue.intro':
    '队列决定聆听顺序。打开另一个专辑可以继续浏览，而不替换当前歌曲。活动歌曲和接下来播放帮助你掌握进度。',
  'help.queue.steps':
    '打开专辑查看其中的曲目，播放你想听的那一首。\n右键点击歌曲，选择“加入播放队列”“加入收藏”或“加入播放列表”。\n打开“接下来播放”查看之后要播放的内容，并开启“继续播放”，以同一流派的更多音乐接着播放。',
  'help.queue.tip':
    '启动媒体库播放会接管 FluidEQ 的其他播放器。可以通过播放栏中显示的当前曲目，确认是哪个来源在播放。',

  'help.karaoke.title': '用卡拉OK 歌唱',
  'help.karaoke.intro':
    '卡拉OK 配对本地音频与歌词。定时歌词跟随播放；音高目标需要音符数据。配置麦克风后可显示实时演唱音高。',
  'help.karaoke.steps':
    '打开卡拉OK，添加包含匹配音频和歌词的文件或文件夹。\n选择歌曲播放，检查歌词与伴奏是否对应。\n配置麦克风，调整歌词大小，并使用舞台的全屏控制。',
  'help.karaoke.tip':
    '只有歌词的文件不包含目标音符。卡拉OK 跟随应用的“音量”；旋律、伴奏和引导人声的电平在“混音设置”中。',

  'help.maker.title': '在卡拉 OK 制作器中制作',
  'help.maker.intro':
    '制作器将音频转换成可编辑项目，在时间线上组织歌词与音符。自动生成的文字和时间需要人工核对。',
  'help.maker.steps':
    '从卡拉OK 打开制作并载入音频，选择需要的分离或转录工具。\n查看进度；首次使用 AI 可能需要下载模型。检查时间线上的歌词和音符。\n逐段试听，修正文字与时间，保存项目后导出卡拉 OK 文件。',

  'help.maker.lyricsCaption': '歌词，以及每个词何时唱出',
  'help.maker.referenceName': '参考歌词',
  'help.maker.reference':
    '整首歌的文字，一行一句。粘贴进来或载入文件，FluidEQ 会据此找出时间点。',
  'help.maker.timingName': '词语时间',
  'help.maker.timing':
    '按顺序排列的所有词，并显示已定时的数量。点一个即可调整它。',
  'help.maker.wordName': '已选词语',
  'help.maker.word':
    '所选词从哪里开始、持续多久。移动它的边界会把时间让给或取自旁边的词，整行长度不变。',
  'help.maker.toolsCaption': 'AI 工具，以及它们需要的模型',
  'help.maker.separate': '把录音分成人声与伴奏，让卡拉OK不带原唱播放。',
  'help.maker.loadVocals': '使用你已有的纯人声文件，而不在这里做分离。',
  'help.maker.redetectTiming': '重新聆听人声，为已有的词重新定时。',
  'help.maker.redetectNotes': '重新聆听旋律，改写词下方的音符。',
  'help.maker.modelsName': 'AI 模型内存',
  'help.maker.models':
    '每个模型需要什么，以及是否已在这台电脑上。首次使用时会自动下载。',
  'help.maker.idleName': '空闲时',
  'help.maker.idle':
    '模型在两次使用之间是否留在内存中，以及保留多久。释放可腾出内存；保留则下次立即开始。',

  'help.makerBar.caption': '制作器顶部的工具',
  'help.makerBar.import':
    '打开卡拉OK文件或已保存的项目，并保留当前已载入的音频。',
  'help.makerBar.lyrics': '歌词和它们的时间，都在同一个窗口里。',
  'help.makerBar.timing':
    '把词与音符一起移动，适合整首从第一秒起就偏早或偏晚的歌。',
  'help.makerBar.pan': '在时间轴上拖动，即可浏览整首歌而不改动任何东西。',
  'help.makerBar.language':
    '歌词用的是哪种语言，以及旁边的第二种，两种都能唱。',
  'help.makerBar.record':
    '播放歌曲，在每行开始和结束时按键。时间由你的按键决定。',
  'help.makerBar.select': '框选音符，一起移动或删除。',
  'help.makerBar.paint': '直接在音高网格上画出旋律。',
  'help.makerBar.split': '把一个词切成音节，让长词的每个音节各带一个音符。',
  'help.makerBar.repair': '替你聆听的工具，以及它们需要的模型。',
  'help.makerBar.export':
    '把做好的卡拉OK导出为 FluidEQ 项目、UltraStar TXT、LRC 或增强 LRC。',
  'help.maker.tip':
    '下载模型需要联网与磁盘空间，处理时间取决于硬件和歌曲长度。使用你有权处理的音频，分享前检查导出结果。',

  'help.share.title': '在电脑之间共享音频',
  'help.share.intro':
    '共享音频在同一私有网络内的电脑之间传送系统声音。连接耳机或音箱的电脑作为接收端，其他电脑发送。这与同一电脑上的第二输出不同。',
  'help.share.steps':
    '在聆听的电脑上打开“共享音频”，选择“在此电脑上播放音频”并按“创建连接码”。先从低音量开始。\n在每台音源电脑上选择“发送此电脑的音频”，粘贴对应你网络的连接码，然后按“连接并发送”。\n留意连接监视器。用完后按“停止发送”或“停止接收”；“创建新连接码”会断开所有已保存的配对。',
  'help.share.tip':
    '连接码授权配对，请保密。多个发送端会混在一起并提高电平，由接收端的“音量”来控制。使用 FluidEQ 引擎时，接收到的音频也会经过 DSP 机架。',

  'help.trouble.title': '声音不对时怎么办',
  'help.trouble.intro':
    '先查来源与输出，再逐层排除。图表、已保存的预设或已开启的开关，都不能单独证明声音到达了正确的设备。“帮助”菜单还提供音频排障、问题报告和论坛入口。',
  'help.trouble.steps':
    '没有声音：确认正在播放、选中了预期的输出、音量已调高，并且设备已连接。检查“同时只播放一处”是否暂停了另一个来源。\nEQ 没变化：确认“系统均衡”已开启，并且输出没有显示“已关闭”标记；如果有，请按“启用”。如果提示说引擎没有运行，请按“重启 Windows 音频”。\n一切看起来都正常，均衡器却仍然没有作用：Windows 可能绕过引擎在播放音乐。提示会说明这一点，并提供一键把引擎移到 Windows 会使用的位置；这需要一次权限确认和一秒钟的静音。\n失真或低音过多：保持“自动归一化”开启，减小提升量，并逐层旁路。如果问题仍然存在，请使用“报告问题”，并在发送前检查报告内容。',
  'help.trouble.tip':
    'F1 打开本指南。Esc 先关闭放大的截图，再关闭指南。如果界面太大，按 Ctrl + 0 可重置缩放。操作菜单中的“进程”会显示 FluidEQ 各部分正在做什么。',

  'help.forum.title': '在论坛提问',
  'help.forum.intro':
    '论坛把 FluidEQ 的 GitHub Discussions 带进应用：公告、想法、问题，以及大家引以为傲的调音。任何人都可以阅读；发帖使用你的 GitHub 账户，而不是 FluidEQ 账户。',
  'help.forum.steps':
    '打开“帮助 → 论坛”，选择一个版块：“公告”“综合”“想法”“投票”“Q&A”或“作品展示”。\n搜索论坛，或打开一个话题阅读回复。\n按“使用 GitHub 登录”，在浏览器中完成，然后发布“新话题”或回复。',
  'help.forum.tip':
    '发布的所有内容都会以你的 GitHub 名字在 GitHub 上公开。在 Q&A 中，请把有用的回答标记出来，方便后来的人找到。',
};

export default help;
