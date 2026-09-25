/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': '请支持我们',
  'tour.rainbow.title': '欢迎使用彩虹模式',
  'tour.rainbow.subtitle': '一键开启',
  'tour.rainbow.lead':
    '彩虹色、发光点缀和流转整个色谱的边框——还有更流畅的动态：图表、电平表和波形以屏幕的完整刷新率绘制，而不是每秒三十帧。声音始终不变。',
  'tour.rainbow.how':
    '在这里即可立即开启，无需达到 ×10。你的选择会被保存，也可随时关闭。支持完全自愿。',
  'tour.rainbow.enable': '开启彩虹模式',
  'tour.rainbow.disable': '关闭彩虹模式',
  'tour.rainbow.waveform': '顶部波形预览',
  'tour.rainbow.toggleHint':
    '点击上方的“RAINBOW MODE”开关即可开启或关闭彩虹模式。',
  'tour.eyebrow': '本版本新功能',
  'tour.title': 'FluidEQ 新功能',
  'tour.close': '关闭',
  'tour.rail': '新功能',
  'tour.stepOf': '第 {current} 项，共 {total} 项',
  'tour.back': '上一步',
  'tour.next': '下一步',
  'tour.done': '知道了',
  'tour.dontShowAgain': '本版本不再显示',
  'tour.releaseNotes': '完整更新日志',
  'tour.rail.newIn': '{version} 版新功能',
  'tour.rail.always': 'FLUIDEQ 还有',
  'tour.newBadge': '新',
  'tour.howTitle': '如何开始',
  'tour.beta': 'Beta',
  'tour.player.kicker': '迷你播放器',
  'tour.player.title': 'FluidEQ，折叠成一台播放器',
  'tour.player.subtitle': '一个开关，把窗口变成播放器',
  'tour.player.lead':
    '标题栏里的一个开关，就能把窗口变成迷你播放器：歌曲、你的均衡器、可视化效果和“接下来播放”，全都装进窄窄的一列。同一个开关会带你回到离开时的页面。',
  'tour.player.point1':
    '完整的均衡器一并带上：预设、频段布局、EQ 模式、智能均衡，以及低音、中音和高音。',
  'tour.player.point2':
    '把它折叠为一行、置顶在其他窗口之上，或双击可视化效果铺满屏幕。',
  'tour.player.point3':
    '有自己的“浅色”或“深色”主题；拖放到“接下来播放”的歌曲会加入媒体库和队列。',
  'tour.player.how':
    '按下标题栏中“帮助”旁边的“迷你播放器”开关。在播放器上，同一个开关会带回完整界面。',
  'tour.player.open': '试试迷你播放器',
  'tour.player.imageAlt':
    '两个迷你播放器，分别为深色和浅色主题：顶部是歌曲和它的计时，中间是十五个频段的均衡器，下方是“接下来播放”；另有折叠为一行的同一个播放器。',
  'tour.games.kicker': '游戏预设',
  'tour.games.title': '每个游戏，都有自己的音效',
  'tour.games.subtitle': '游戏来到最前面时随即切换',
  'tour.games.lead':
    '每个游戏只需选一次音效。游戏来到最前面时，FluidEQ 会切换到这种音效，无论你按多少次 Alt+Tab 都会一直保持，直到你关闭游戏，然后换回你原来的音效。',
  'tour.games.point1':
    'Steam、Epic Games、EA、GOG、育碧、战网和 Xbox 上的游戏，或任何当前打开的程序。',
  'tour.games.point2':
    '“游戏”预设会开启“游戏模式”，减少 FluidEQ 带来的延迟；页面上还会显示这段延迟的实测值。',
  'tour.games.point3':
    '桌面上的一张卡片会说明切换了什么；游戏关闭时，另一张会说明换回了什么。',
  'tour.games.how':
    '打开“均衡器”，选择“游戏预设”并按“添加游戏”。然后在它那一行的选择器中选好音效。',
  'tour.games.open': '打开游戏预设',
  'tour.games.imageAlt':
    '“游戏预设”页面上有四个游戏，各有自己的音效；另有游戏来到最前面和关闭时，FluidEQ 在桌面上显示的卡片。',
  'tour.presets.kicker': '全新预设',
  'tour.presets.title': '声如其名的预设',
  'tour.presets.subtitle': '整条处理链，响度统一',
  'tour.presets.lead':
    '每个预设都重新测量并统一了响度：切换时改变的是声音的性格，而不是音量；而且现在每个预设在 FluidEQ 引擎下和在 Equalizer APO 下听起来一样清楚。',
  'tour.presets.point1':
    '{chains} 条处理链，其中 {styles} 条是音乐流派，另有“音乐”“影院”和“游戏”的“房间”版本。',
  'tour.presets.point2':
    '预设的曲线会作为单独的一层显示在图表上，强度可以调低。',
  'tour.presets.point3':
    '每种音乐流派都有说明：指向其中一个，说明就会在列表旁打开。',
  'tour.presets.how': '打开“均衡器”并按“预设”，或在 DSP 顶部选一条处理链。',
  'tour.presets.open': '打开均衡器',
  'tour.presets.imageAlt':
    '选中“摇滚”的预设选择器，以及列表旁它的说明：带编号标记点的曲线、每个标记点的作用，以及它的实测响度。',
  'tour.tone.kicker': '音色控制',
  'tour.tone.title': '低音、中音和高音，像功放一样',
  'tour.tone.subtitle': '三个旋钮，自成一条曲线',
  'tour.tone.lead':
    '未选中任何频段时，“低音”“中音”“高音”会作为一条独立的曲线塑造声音，两侧还有低切和高切：想让一首歌更温暖或更明亮，这是最快的办法，你的每个频段都保持原样。',
  'tour.tone.point1': '均衡器一打开就是全部频段，不选中任何一个。',
  'tour.tone.point2': '新增二十段布局，所有布局都采用标准频率。',
  'tour.tone.point3':
    '频段的宽度与间距一致：频段之间没有空隙，也没有两个频段作用在同一个音上。',
  'tour.tone.how':
    '打开“均衡器”，在未选中任何频段时转动“低音”“中音”或“高音”。按住 Ctrl 点击旋钮，可把它负责的那三分之一恢复平直。',
  'tour.tone.open': '打开均衡器',
  'tour.tone.imageAlt':
    '均衡器曲线的低音、中音和高音三段，移动它们的三个旋钮，以及从六段到三十一段的快速布局。',
  'tour.studio.kicker': 'FluidEQ Plus',
  'tour.studio.title': '打造你自己的可视化效果',
  'tour.studio.subtitle': '免费体验 15 天，或换来一个月',
  'tour.studio.lead':
    '工作室能把一个想法变成随你的音乐而动的场景。它现在属于 Plus，新账户可以免费体验十五天，无需银行卡，体验结束时也不会扣费。',
  'tour.studio.point1': '发布一个场景，通过审核后，你下个月的 Plus 就免费。',
  'tour.studio.point2': '每位会员的场景在进入图库前都会经过审核。',
  'tour.studio.point3': '你之前做的一切都会保留，就在工作室标明的文件夹里。',
  'tour.studio.how':
    '打开 Plus，在侧栏中选择“工作室”。没有 Plus 时，那里的页面会提供免费体验。',
  'tour.studio.open': '打开 Plus',
  'tour.studio.imageAlt':
    '在工作室中做出的群山上空的极光、它所源自的想法、十五天免费体验，以及通过审核的场景换来的一个月。',
  'tour.studio.idea': '山间湖泊上空的北极光。低音让极光涌动，星星随节拍闪烁。',
  'tour.studio.earned': '审核通过：下个月免费',
  'tour.help.kicker': '帮助',
  'tour.help.title': '用你自己的话问指南',
  'tour.help.subtitle': '不怕错字和单复数，支持十种语言',
  'tour.help.lead':
    '像问朋友一样搜索指南——“没有声音”、“限制器”、“壁纸”——十种语言任你选用。最相关的章节排在最前，指南会带你直达那个控件，并在截图上把它圈出来。',
  'tour.help.point1': '它能包容错字和单复数，也懂得人们对各种东西的习惯叫法。',
  'tour.help.point2':
    '截图上的每个控件都像印刷版说明书一样编了号，截图也会跟随你的主题。',
  'tour.help.point3':
    '在任何地方按 F1 都能打开它，按 Enter 则跳到下一个匹配项。',
  'tour.help.how':
    '按 F1，或打开标题栏中的书本图标并选择“用户指南”，然后输入你要找的内容。',
  'tour.help.open': '打开帮助',
  'tour.help.imageAlt':
    '在用户指南中搜索“没有声音”：章节按相关度排列，匹配的词已标出，另有一张控件已编号的截图。',
  'tour.help.query': '没有声音',

  'tour.engine.kicker': '自研音频引擎',
  'tour.engine.title': '认识 FluidEQ 引擎',
  'tour.engine.subtitle': '为你听到的一切带来 EQ 和 DSP',
  'tour.engine.lead':
    'FluidEQ 现在有了自己的音频引擎。它在 Windows 音频服务内部运行，排在声卡音效之后，让电脑播放的一切声音都经过你的 EQ 和整套 DSP 机架：游戏、浏览器、流媒体应用——不只是媒体库。',
  'tour.engine.point1':
    'DSP 机架作用于全部系统音频，无需在 FluidEQ 中播放任何内容。',
  'tour.engine.point2':
    '能识别当前歌曲的实时响度调节，以及边播放边清理的降噪。',
  'tour.engine.point3':
    '退出 FluidEQ 后，声音会立即恢复原样，即使是崩溃退出也一样。',
  'tour.engine.how':
    '安装时选择“FluidEQ 引擎”，或打开右上角脉冲图标后的操作菜单，点击最上方的引擎卡片，选择“FluidEQ 引擎”并按“应用”。然后打开 DSP，在任意应用播放时开启一个环节。',
  'tour.engine.open': '打开 DSP',
  'tour.engine.flow.label':
    '电脑播放的一切声音，在到达你的耳机和音箱之前，都会经过 FluidEQ 引擎：先是你的 EQ，然后是 DSP 机架。',
  'tour.engine.flow.games': '游戏',
  'tour.engine.flow.browser': '浏览器',
  'tour.engine.flow.music': '音乐应用',
  'tour.engine.flow.video': '视频',
  'tour.engine.flow.inside': '在 Windows 音频内部',
  'tour.engine.flow.eq': '你的 EQ',
  'tour.engine.flow.rack': 'DSP 机架',
  'tour.engine.flow.headphones': '耳机',
  'tour.engine.flow.speakers': '音箱',

  'tour.room.kicker': '耳机上的环绕声',
  'tour.room.title': '坐进房间',
  'tour.room.subtitle': '二十四个房间，全部免费',
  'tour.room.lead':
    '房间把你的耳机变成一间听音室，每个声道都是站在你周围的一只音箱。十三个新房间加入了十一个经典房间，每一个都经测量确认彼此不同，而且这一切全部免费。',
  'tour.room.point1':
    '立体声变成你面前的两只音箱，想要的话也能充满整个房间；5.1 电影是五只加低音炮；7.1 游戏是整个环绕圈。',
  'tour.room.point2':
    '在“精选”“经典房间”或“我的”下选一个房间；构成房间的一切都在它的页面上。',
  'tour.room.point3':
    '听音测试用五组听感对比，凭耳朵选出把声音放到你面前的那个头部模型。',
  'tour.room.how':
    '打开 DSP，在侧栏选择“房间”并开启。选一个房间，然后拖动音箱或转动旋钮；在“你的头部”下按“开始听音测试”。',
  'tour.room.open': '打开房间',
  'tour.room.imageAlt':
    '俯视的房间：七只音箱和一只低音炮围绕中央的头部，每只都有通往双耳的路径。',

  'tour.plus.kicker': 'FluidEQ Plus',
  'tour.plus.title': '欢迎来到 FluidEQ Plus',
  'tour.plus.subtitle': '可视化、工作室、灯效，还有更多',
  'tour.plus.lead':
    '这是一项可选的会员服务，支持 FluidEQ 持续成长，并拥有一个全新的专属标签页：由显卡绘制的场景、用来创作自己场景的工作室、排行榜、桌面背景和动态灯效。均衡器、机架和播放器一如既往，依然免费。',
  'tour.plus.point1':
    '在操作菜单的“账户”中登录；付款在浏览器中完成，之后 Plus 会自动开启。',
  'tour.plus.point2':
    '按月或按年订阅，付款前就能读到通俗易懂的条款。应用永远不会看到你的银行卡。',
  'tour.plus.point3': '最多可在五台电脑上登录，新的可视化效果也会陆续加入。',
  'tour.plus.how':
    '打开 Plus 标签页：“排行榜”“可视化”“工作室”和“动态灯效”都在它的左侧。',
  'tour.plus.open': '打开 Plus',
  'tour.plus.imageAlt':
    'Plus 标签页：侧边是排行榜、可视化、工作室和动态灯效，另有展示铬光、绽放、极光、阿尔卑斯和霓虹之城的“可视化”图库。',
  'tour.scene.alpine': '阿尔卑斯',
  'tour.scene.aurora': '极光',
  'tour.scene.bloom': '绽放',
  'tour.scene.chrome': '铬光',
  'tour.scene.neonCity': '霓虹之城',

  'tour.visualizers.kicker': '可视化效果',
  'tour.visualizers.title': '随音乐而动的场景',
  'tour.visualizers.subtitle': '由你的显卡绘制',
  'tour.visualizers.lead':
    'Plus 可视化效果是由你的显卡在 EQ 曲线下方绘制的鲜活场景：星空下的群山、极光的光幕、霓虹城市。低音、节拍和高音各自带动不同的部分，周围的窗口也能换上它们的颜色。',
  'tour.visualizers.point1':
    '一个选择器包揽一切：28 种可自行塑形和配色的免费样式，以及按分类排列的 Plus 可视化效果。',
  'tour.visualizers.point2':
    '浏览图库，试看 FluidEQ 的示例场景十秒钟，再添加你喜欢的场景。',
  'tour.visualizers.point3':
    '自动切换外观、全屏显示，还能在“视图”中设置场景的起音和释放。',
  'tour.visualizers.how':
    '点击图表上的外观名称，在“Plus 可视化效果”下选择一个场景，或在“Plus → 可视化”中浏览全部场景。',
  'tour.visualizers.open': '打开均衡器',
  'tour.visualizers.imageAlt':
    '阿尔卑斯：一款描绘夜晚湖上群山的 Plus 可视化效果，正在图表上的 EQ 曲线下方播放，下面还有另外四个场景。',

  'tour.desktop.kicker': '桌面可视化效果',
  'tour.desktop.title': '让音乐在你的桌面背后律动',
  'tour.desktop.subtitle': '每台显示器一个场景',
  'tour.desktop.lead':
    '把 Plus 可视化效果放到桌面图标后面。它会随你正在听的内容而动，也可以独自平静地播放，而且每台显示器都能显示自己的场景。',
  'tour.desktop.point1':
    '在显示器排布图上挑选显示器，每台都能显示自己的可视化效果。',
  'tour.desktop.point2': '窗口盖住显示器、电脑锁定或使用电池供电时，它会暂停。',
  'tour.desktop.point3': '下次启动 FluidEQ 时，它会自动恢复。',
  'tour.desktop.how':
    '图表上显示 Plus 可视化效果时，按下其名称旁的显示器按钮，或选择“视图 → 设为桌面背景”。',
  'tour.desktop.open': '打开均衡器',
  'tour.desktop.imageAlt':
    '三台显示器，各自在桌面图标和任务栏后方显示一个 Plus 可视化效果：极光、阿尔卑斯和霓虹之城。',

  'tour.lighting.kicker': '动态灯效',
  'tour.lighting.title': '你的桌面随场景亮起',
  'tour.lighting.subtitle': 'Beta · 你的 RGB 设备跟随可视化效果',
  'tour.lighting.lead':
    '通过 Windows Dynamic Lighting 和 Razer Chroma，你的键盘、鼠标、鼠标垫、耳机和支架会呈现图表上 Plus 可视化效果的色彩与节奏。',
  'tour.lighting.point1':
    '每个可视化效果有四种风格：“场景”“色彩波浪”“频谱”和“节拍涟漪”。',
  'tour.lighting.point2': '每台设备都能单独调整，还可以选择音乐停止时的效果。',
  'tour.lighting.point3':
    '实时预览会画出你自己的桌面，以及它亮起的样子。它仍处于 Beta 阶段：请告诉我们你的设备表现如何。',
  'tour.lighting.how':
    '打开“Plus → 动态灯效”并开启它，然后在图表上显示一个 Plus 可视化效果。',
  'tour.lighting.open': '打开 Plus',
  'tour.lighting.imageAlt':
    '键盘、鼠标和鼠标垫亮起霓虹之城的粉色、紫色和青色。',

  'tour.theme.kicker': '全新外观',
  'tour.theme.title': '认识深色主题',
  'tour.theme.subtitle': '近乎纯黑，为深夜与 OLED 屏幕而生',
  'tour.theme.lead':
    'FluidEQ 现在有了第二副面孔。深色主题抹去了应用诞生时的石板蓝：面板、菜单和工具栏全部变为单色，强调色保留，频谱成为屋里唯一的色彩。',
  'tour.theme.point1':
    '近乎纯黑的背景：在 OLED 屏幕上，图表周围几乎完全暗下来。',
  'tour.theme.point2':
    '所有页面同步：菜单、对话框、卡拉OK 舞台和媒体库一起切换。迷你播放器则保留自己的主题。',
  'tour.theme.point3':
    '你的强调色和彩虹模式保持不变。声音没有任何变化，只是换了外衣。',
  'tour.theme.howTitle': '如何切换',
  'tour.theme.how':
    '打开右上角脉冲图标后的菜单，在菜单底部的设置里选择“主题”旁边的“深色”。想换回来时，“浅色”只需一次点击。',
  'tour.theme.tryBlack': '立即切换为深色',
  'tour.theme.tryOcean': '换回浅色',
  'tour.theme.imageAlt':
    '深色主题下的 FluidEQ：均衡器标签页显示十五个频段，实时频谱正在播放一首歌曲。',

  'tour.share.kicker': '聆听每一台电脑',
  'tour.share.title': '在你的电脑之间共享音频',
  'tour.share.subtitle': '一副耳机，桌上的每一台机器',
  'tour.share.lead':
    '游戏主机、工作笔记本和媒体盒子，全都播进你正戴着的这副耳机：通过你自己的网络，无损、加密，并经过你已经调好的 EQ。',
  'tour.share.receiverLabel': '接收端',
  'tour.share.receiverName': '接耳机的那台电脑',
  'tour.share.senderLabel': '发送端',
  'tour.share.senderName': '其他所有电脑',
  'tour.share.wireLabel': '无损 · 加密 · 私有局域网',
  'tour.share.stepsTitle': '三步完成设置',
  'tour.share.step1Title': '在耳机电脑上创建连接码',
  'tour.share.step1':
    '打开“共享音频”标签页，选择“在此电脑上播放音频”，按下“创建连接码”。复制对应你网络的那条连接码。',
  'tour.share.step2Title': '在其他每台电脑上粘贴',
  'tour.share.step2':
    '在那台电脑上打开 FluidEQ，进入“共享音频”，选择“发送此电脑的音频”，粘贴连接码并按“连接并发送”。它的系统音频随即原样传输：效果会在你聆听的那台电脑上应用。',
  'tour.share.step3Title': '开始聆听，调好音量',
  'tour.share.step3':
    '每个发送端都以较短的缓冲播放，偶有卡顿后会自行追上。每个发送端都会混入接收端的输出，并由接收端的 EQ 塑形。接收端的播放栏会显示最近一个发送端的歌曲，其按钮可通过网络远程操作。',
  'tour.share.fact1Title': '无损',
  'tour.share.fact1': '端到端 Float32 PCM。没有媒体编解码器，没有转码损失。',
  'tour.share.fact2Title': '加密',
  'tour.share.fact2':
    '每个数据包都经 AES-256-GCM 加密。连接码就是密钥，没有它谁也听不到。',
  'tour.share.fact3Title': '保持配对',
  'tour.share.fact3':
    '配对在关闭应用和重启后依然保留。只有创建新连接码才会断开。',
  'tour.share.tip': '先小声：多台电脑叠加得很快。首次连接前先调低耳机音量。',
  'tour.share.open': '打开共享音频',

  'tour.library.kicker': '你的音乐，你的播放器',
  'tour.library.title': '为你自己的音乐准备的媒体库',
  'tour.library.subtitle': '放进文件夹，得到专辑',
  'tour.library.lead':
    '给 FluidEQ 指一个文件夹，它会读取里面的每首歌和每个视频，连同标签与封面，整理成一个可以按专辑、歌手、流派、歌曲或文件夹浏览的收藏。播放走 FluidEQ 自己的播放器，所以 EQ 和 DSP 机架始终在信号链上。',
  'tour.library.point1':
    '同一排书架的三种看法：列表、网格和 Cover Flow，大收藏还能按字母跳转。',
  'tour.library.point2':
    '带“继续播放”的“接下来播放”队列：列表放完后，继续播放同一流派的更多歌曲。',
  'tour.library.point3':
    '播放列表和一个永久的“收藏”列表。右键任意歌曲即可加入其中，或加入队列。',
  'tour.library.point4':
    '智能均衡歌曲记忆：在智能均衡持续测量时打开“为这首歌保存”，两分钟后，它的校正就会为这首曲目保留，再次播放时自动恢复。',
  'tour.library.how':
    '打开“媒体库”标签页，按“添加文件夹”或把文件夹拖到页面上，等待扫描完成。选择“专辑”“歌手”“流派”“歌曲”“文件夹”或“树状”，然后按“播放”。',
  'tour.library.open': '打开媒体库',

  'tour.dsp.kicker': '一座母带机架',
  'tour.dsp.title': 'DSP 机架',
  'tour.dsp.subtitle': '十个环节，各有自己的页面',
  'tour.dsp.lead':
    '一套录音棚级环节：标准化、降噪、激励器、低音熔炉、均衡器、低音冲击、空间感、房间、最大化器和母带，另有媒体库曲目之间的交叉淡化。使用 FluidEQ 引擎时，它作用于电脑播放的一切声音；使用 Equalizer APO 时，则作用于媒体库。每个环节都有自己的页面和实时视图，大多数带有预设，其中五个还有“独听”开关，可以只听该环节的效果。',
  'tour.dsp.point1':
    '降噪在播放时修复嘶声、哼声和爆音，神经网络人声清理器则用于媒体库曲目。',
  'tour.dsp.point2':
    '低音熔炉在低音之下加上真正的低八度；低音冲击塑造它的起音、延音和绽放，“混合”最高可达 200%。',
  'tour.dsp.point3':
    '6 到 31 段的参数均衡器，默认十五段，支持最小相位或线性相位、中侧处理、过采样，以及一百多个命名预设。',
  'tour.dsp.point4':
    '母带环节带 LUFS 响度目标和真峰值保护，从流媒体到黑胶的交付预设，以及用于比较音色而非音量的增益匹配。',
  'tour.dsp.how':
    '打开 DSP 标签页，在“预设”里选一条链，再在侧边标签中点开一个环节并将其切换为“开启”。使用 Equalizer APO 时，请先从媒体库播放一首歌。',
  'tour.dsp.open': '打开 DSP',

  'tour.output.kicker': '同时在两处播放',
  'tour.output.title': '第二路输出配置',
  'tour.output.subtitle': '耳机和音箱同时响，各有各的配置',
  'tour.output.lead':
    '耳机和音箱可以同时播放，并使用各自的均衡器。第二路输出接收主输出均衡器处理前的声音，再应用自己的已保存配置，无需安装路由驱动。',
  'tour.output.point1': '在第二路输出中开启另一个设备，并设置它自己的音量。',
  'tour.output.point2':
    '使用该设备下方的均衡器配置选择器，选择为它保存的配置。主输出的调音保持不变。',
  'tour.output.point3':
    '同时只播放一处：在 FluidEQ 里开始播放会暂停机器上的其他播放，反之亦然。',
  'tour.output.point4':
    '游戏/视频以约 30 ms 的缓冲开始，在中断后追上进度；音乐以约 100 ms 的缓冲开始，让播放更平稳。设备自身的缓冲还会增加延迟。',
  'tour.output.how':
    '打开均衡器标签页，展开右侧的第二路输出。开启一个设备，在名称下方选择均衡器配置，然后设置音量并选择游戏/视频或音乐。',
  'tour.output.open': '打开均衡器',
  'tour.output.imageAlt':
    '第二路输出面板，已开启 BlackShark V2 Pro，显示均衡器配置选择器、音量滑块以及游戏/视频和音乐模式。',

  'tour.looks.kicker': '你自己的可视化效果',
  'tour.looks.title': '自定义图表外观',
  'tour.looks.subtitle': '二十八种形态，你的颜色，你的律动',
  'tour.looks.lead':
    'EQ 下方的频谱可以按你喜欢的任何方式绘制。从二十八种形态中挑一种，从简单的柱状和线条到梯田、天际线和车流穿行的夜间大桥；用它自己的“自动”配色，或按频率、按电平、按热度上色；设定起音多快、峰值停留多久；再用火花、彗星或涟漪标记峰值。保存为你自己的外观，并以文件形式分享。',
  'tour.looks.point1':
    '二十八种形态，各有自己的控制项：分段、间隔、填充度、粗细，以及填充还是描边。',
  'tour.looks.point2':
    '每种形态都可以用它自己的“自动”配色，也可以按频率、电平或热度，用你自己的颜色渐变上色，或者只用一种纯色。',
  'tour.looks.point3':
    '起音和释放决定律动；峰值高亮、填充峰值和十二种峰值标记决定一次击打的样子。',
  'tour.looks.point4':
    '辉光在所有模式下都可用，彩虹模式还会加上一道走完整个色轮的边框。外观可以导出为文件，也可以从文件导入。',
  'tour.looks.how':
    '在均衡器标签页，按图表工具栏上的“新建外观”。用选择器挑一种形态，或按空格键轮换，在音乐播放时调整颜色和律动，然后保存。',
  'tour.looks.open': '打开均衡器',

  'tour.karaoke.kicker': '家里的舞台',
  'tour.karaoke.title': '带音高引导的卡拉OK',
  'tour.karaoke.subtitle': '你的歌，你的歌词，你的麦克风',
  'tour.karaoke.lead':
    '拖入一首歌，有没有歌词文件都行，FluidEQ 会把它们配成播放列表，在封面或视频上显示同步歌词，监听你的麦克风，并把你的音高画在旋律旁边。一切都留在这台电脑上；麦克风从不被录制或回放。',
  'tour.karaoke.point1':
    '“引导人声”滑块：FluidEQ 在制作器中分离出歌曲的人声后，它可以从仅伴奏一直滑到完整原曲，无需另备伴奏文件。',
  'tour.karaoke.point2':
    '音高轨道：歌曲的音符是方块，你的声音是叠在上面的实时线条，并提示偏高、音准正确或偏低。',
  'tour.karaoke.point3':
    '唱完后有演唱回顾，列出需要练习的段落，并有倒数供你再来一次。',
  'tour.karaoke.point4':
    '可读取 LRC、带逐字时间的增强 LRC 和带音节与音高的 UltraStar，支持 MP3、FLAC、WAV、OGG、M4A 等。还附带翻译歌词和估算的吉他和弦。',
  'tour.karaoke.how':
    '打开“卡拉OK”标签页，按“打开歌曲”或“添加文件夹”，在播放列表中选一首，打开麦克风，显示音高引导，然后按播放。',
  'tour.karaoke.open': '打开卡拉OK',

  'tour.maker.kicker': '自己动手做',
  'tour.maker.title': '卡拉OK 制作器',
  'tour.maker.subtitle': '任何歌曲都能变成卡拉OK 文件',
  'tour.maker.lead':
    '卡拉OK 标签页里的一整套制作工作室。它可以独立完成全部工作：把人声从音乐中分离，用本地语音模型识别歌词及其时间，并检测旋律音符。你也可以在可缩放的时间线上手动敲击、录制和绘制每一个时间点。一切都在这台电脑上运行。',
  'tour.maker.point1':
    '“自动准备这首歌”：先分离人声，再识别歌词和时间，并可选择在后台继续。',
  'tour.maker.point2':
    '保留分离出的音轨：人声和伴奏，各自可保存，包括保存为 MP3。',
  'tour.maker.point3':
    '细节的手动工具：敲击对词、录制歌词行起点、带起点和长度的单词检查器，以及将单词拆分为音节。',
  'tour.maker.point4':
    '在音高网格上绘制旋律，标记金色音符，然后导出为 FluidEQ 项目、UltraStar TXT、LRC、增强 LRC 或伴奏音轨。',
  'tour.maker.how':
    '在卡拉OK 中载入一首歌并按“制作”。在向导中接受“自动准备”，在时间线上修正歌词，然后“在播放器中使用”并“导出”。',
  'tour.maker.open': '打开卡拉OK',

  'tour.media.kicker': '让网络经过你的 EQ',
  'tour.media.title': '在线媒体',
  'tour.media.subtitle': 'YouTube、YouTube Music、Bandcamp、Twitch 和 Suno',
  'tour.media.lead':
    '内置的流媒体网站播放器，让你在线观看和收听的内容经过你的 EQ，而不是另开一个浏览器。已接入五个网站，各有自己的搜索；指向站外的链接会被拦下，并提供“在浏览器中打开”的选择。',
  'tour.media.point1':
    '一个搜索框，搜索当前打开的网站，并保留可清除的最近搜索。',
  'tour.media.point2':
    '只需登录一次：在你退出登录之前，播放器会在每次访问之间保留你的登录状态。',
  'tour.media.point3':
    '续播：播放器记住最后一页以及你看到的位置，并带你回到那里。',
  'tour.media.point4':
    '下载带进度提示，完成后可“在文件夹中显示”；还有一个退出登录按钮——工具栏末端的那扇门——一键清除全部 Cookie 和登录。',
  'tour.media.how':
    '打开“在线媒体”标签页，在顶部一行选一个网站，在搜索框输入并按搜索。后退、前进和刷新与浏览器一样。',
  'tour.media.open': '打开在线媒体',
};

export default tour;
