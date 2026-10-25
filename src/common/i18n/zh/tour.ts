/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': '请支持我们',
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
    '标题栏里的一个开关，就能把整个 FluidEQ 收成一个播放器。它是经典功放，带 LED 时钟、指示灯和完整的均衡器；在“{backdrop}”模式下、场景之上，它会变成玻璃。同一个开关会带你回到离开时的页面。',
  'tour.player.point1':
    '完整的均衡器一并带上：预设、频段布局、EQ 模式、智能均衡，以及低音、中音和高音。',
  'tour.player.point2':
    '把它折叠为一行、置顶在其他窗口之上，或双击可视化效果铺满屏幕。',
  'tour.player.point3':
    '有自己的主题；拖放到“接下来播放”的歌曲会加入媒体库和队列。',
  'tour.player.how':
    '按下标题栏中“帮助”旁边的“迷你播放器”开关。在播放器上，同一个开关会带回完整界面。',
  'tour.player.open': '试试迷你播放器',
  'tour.player.imageAlt':
    '标题栏一角，“{player}”开关被圈出；以及它打开的两种播放器：带 LED 时钟、指示灯、均衡器和播放队列的经典功放，和在“{backdrop}”模式下、极光之上更宽的玻璃播放器。',
  'tour.player.classic': '经典功放',
  'tour.player.glass': '玻璃，“{backdrop}”模式',
  'tour.look.kicker': '全新外观',
  'tour.look.title': '全新的窗口，全新的颜色',
  'tour.look.subtitle': '一个主题滑块，所有内容背后都能有可视化效果',
  'tour.look.lead':
    '各个面板立在同一块开放的底面上，用的是新图标的配色；一个滑块“{brightness}”就能让整个窗口从近乎黑色过渡到明亮的海洋蓝。图表上有场景时，窗口可以采用它的颜色，也可以让它在所有内容背后播放。',
  'tour.look.point1':
    '“{brightness}”位于脉冲图标后的菜单中，在“{windowColours}”里则与“{transparency}”并排。',
  'tour.look.point2':
    '“{windowColours}”提供“{original}”“{colours}”“{ambient}”和“{backdrop}”，每一项都有一行说明它对窗口的作用。',
  'tour.look.point3':
    '对话框和菜单使用同一种材质，“{rainbow}”会贯穿图标的颜色，或可视化效果自己的颜色。',
  'tour.look.how':
    '在右上角脉冲图标后的操作菜单中拖动“{brightness}”。图表上有场景时，从图表的工具栏打开“{windowColours}”并选择“{backdrop}”。',
  'tour.look.open': '打开均衡器',
  'tour.look.imageAlt':
    '在“均衡器”页面上以自身配色显示的 FluidEQ：“频谱分析仪”在曲线下方描绘一首歌，角落上方打开了脉冲图标后的菜单，“亮度”在一半，“彩虹模式”已开启。',
  'tour.gpu.kicker': '全新可视化引擎',
  'tour.gpu.title': '所有可视化效果都在你的显卡上运行',
  'tour.gpu.subtitle': '四十种样式跟上屏幕刷新率，还有 3D 世界',
  'tour.gpu.lead':
    '图表的四十种样式现在都由场景所用的引擎绘制：在你的显卡上、以你屏幕自己的刷新率运行，频柱、粒子和峰值从过去的跳动变成流畅滑动。场景现在还可以是真正的 3D 世界。',
  'tour.gpu.point1':
    '“{scenes}”里新增十八种样式，包括“{synthwave}”“{horizon}”“{towers}”和“{ledwall}”；没有自带颜色的样式会使用窗口的颜色。',
  'tour.gpu.point2':
    '3D 世界随底鼓踏步、随军鼓摇摆、在 drop 时跃起，并随“{brightness}”从黑夜变为白天；拖动它可以换个角度观看。',
  'tour.gpu.point3':
    '切换样式时会从一种渐变到下一种；窗口被遮挡时，3D 世界会交还显存。',
  'tour.gpu.how': '点击图表上的样式名称，在“{scenes}”中选择一种。',
  'tour.gpu.open': '打开均衡器',
  'tour.gpu.imageAlt':
    '一个呈现夜晚 3D 城市的场景，以及在图表上实拍的四种新样式：“{synthwave}”“{horizon}”“{towers}”和“{ledwall}”，第一张中的样式选择器被圈出。',
  'tour.gpu.world': '3D 世界',
  'tour.sparks.kicker': '指针火花',
  'tour.sparks.title': '会回应鼠标的可视化效果',
  'tour.sparks.subtitle': '从指针洒出火花、花瓣或雪花',
  'tour.sparks.lead':
    '把鼠标移过场景，它会在指针后面拖出一道由自身元素组成的轨迹——火花、花瓣、雪花、余烬——并在你点击的地方迸发。在“{ambient}”和“{backdrop}”模式下，它的飞鸟、花瓣和光点还会飘过整个窗口。',
  'tour.sparks.point1':
    '每个可视化效果洒出的都不一样：冬景下雪，篝火飞出余烬，花园飘落花瓣。',
  'tour.sparks.point2':
    'Studio 的舞台总会显示它们，方便场景作者调整洒出的效果。',
  'tour.sparks.point3':
    '一个开关管所有可视化效果：“{windowColours}”中“{rainbow}”下方的“{sparks}”。',
  'tour.sparks.how':
    '图表上有场景时，把鼠标移到上面并点击。“{sparks}”在“{windowColours}”中，位于“{rainbow}”下方。',
  'tour.sparks.open': '打开均衡器',
  'tour.sparks.imageAlt':
    '一个极光可视化效果，指针后拖着一道发光的火花轨迹，点击处迸出火花；以及“{windowColours}”，其中的“{sparks}”开关被圈出。',
  'tour.sound.kicker': 'FLUIDEQ 引擎',
  'tour.sound.title': '声音完全如你所画',
  'tour.sound.subtitle': '高音如画、切换无声、电平一步到位',
  'tour.sound.lead':
    '在 FluidEQ 引擎上，你的曲线现在一直到 20 kHz 都完全按所画的播放，每次改动都会平滑过渡而不是咔哒一声，“{autoNormalize}”一步就能到达新曲线的电平。高音怎么构建由你决定：“{precise}”或“{classic}”。',
  'tour.sound.point1':
    '“{precise}”按所画的样子构建每个频段；在 48 kHz 输出上，过去高音在 20 kHz 处会低 3.8 dB。“{classic}”则按 Equalizer APO 的方式构建，也就是 AutoEQ 调校校正曲线的方式。',
  'tour.sound.point2':
    '切换预设时会交叉过渡：过去 636 次切换中有 534 次会噼啪作响，现在没有一次超过 −80 dBFS。',
  'tour.sound.point3':
    '每次调整都在你动手的那一刻就能听到，随后“{autoNormalize}”根据最近十秒的音乐，一步到达它所需的电平。',
  'tour.sound.how':
    '打开均衡器，点击“{eqMode}”。在“{treble}”下选择“{precise}”或“{classic}”，你的 EQ 和校正可以分别设置。',
  'tour.sound.open': '打开均衡器',
  'tour.sound.imageAlt':
    '“{eqMode}”菜单在其按钮下展开，“{treble}”设为“{precise}”；一条高音曲线，“{precise}”按所画播放，“{classic}”在 48 kHz 输出上于 20 kHz 处低 3.8 dB；以及切换预设时 5 kHz 以上的声音：2.0 之前有 −26 dBFS 的咔哒声，现在没有任何超过 −80 dBFS 的声音。',
  'tour.sound.trebleChart': '高音，1 到 20 kHz',
  'tour.sound.switchChart': '5 kHz 以上，切换预设时',
  'tour.sound.before': '2.0 之前',
  'tour.sound.now': '2.0',
  'tour.graph.kicker': '录音棚视图',
  'tour.graph.title': '像录音棚一样解读声音的图表',
  'tour.graph.subtitle': '十二种视图，80 dB 分析仪',
  'tour.graph.lead':
    '图表像录音棚的分析仪一样测量正在播放的声音：十二种视图，从声谱图、瀑布图到立体声、响度和相位，刻度在音乐变化时保持不动。',
  'tour.graph.point1':
    '“{analyzer}”“{spectrogram}”“{rta}”“{waterfall}”“{scope}”以及另外七种，都在外观选择器的“{analysis}”下。',
  'tour.graph.point2':
    '实时声音以 80 dB 的深度绘制，低至 10 Hz，每个点是十二分之一倍频程，因此单音会显示在它真实的电平上。',
  'tour.graph.point3':
    '你的均衡器保留 ±20 dB，边缘留有余量给超出范围的曲线；频率按 10、20、50、100 标注，与分析仪的印法一致。',
  'tour.graph.how':
    '点击图表上的外观名称，在“{analysis}”下选择一种视图。双击图表可全屏显示；Ctrl+G 显示或隐藏网格。',
  'tour.graph.open': '打开均衡器',
  'tour.graph.imageAlt':
    '播放歌曲时图表的“频谱分析仪”：80 dB 深度的实时频谱和上方的峰值，最上面是均衡器曲线，角落里是“分析”下的视图列表。',

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
    '桌面上的三个时刻：游戏在最前面，FluidEQ 的卡片说它的音效已加载；同一个游戏最小化后，它的音效仍然开着；游戏关闭后，卡片说之前的音效回来了。',
  'tour.games.stepFront': '在最前面：加载它的音效',
  'tour.games.stepAway': '最小化或 Alt+Tab 切走：音效保持不变',
  'tour.games.stepClosed': '关闭：你自己的音效回来',
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
  'tour.studio.subtitle': '所有账户免费',
  'tour.studio.lead':
    '工作室把一个想法变成随音乐律动的场景。它对所有账户免费：想创作、导出和发布多少场景都可以。',
  'tour.studio.point1':
    '每个场景在进入画廊前都会经过审核，获批后它会在任何地方为你免费播放。',
  'tour.studio.point2':
    '场景可以是真正的 3D 世界，踩着底鼓的节拍，在 drop 时一跃而起。',
  'tour.studio.point3':
    '复制 AI 提示词，你的 AI 助手就能看到你的场景，并听出歌曲如何起伏。',
  'tour.studio.how': '打开“可视化”，在侧栏中选择“工作室”。',
  'tour.studio.open': '打开“可视化”',
  'tour.studio.imageAlt':
    '工作室的舞台上正播放 Alpine：雪峰下的湖泊和极光，下方是用你的 AI 创作场景的三个步骤，以及两条说明：所有账户免费，发布的场景对其作者免费播放。',
  'tour.studio.earned': '已发布：为你免费播放',
  'tour.help.kicker': '帮助',
  'tour.help.title': '用你自己的话问指南',
  'tour.help.subtitle': '不怕错字和单复数，支持十种语言',
  'tour.help.lead':
    '像问朋友一样搜索指南——“没有声音”、“限制器”、“壁纸”——十种语言任你选用。最相关的章节排在最前，指南会带你直达那个控件，并在截图上把它圈出来。',
  'tour.help.point1': '它能包容错字和单复数，也懂得人们对各种东西的习惯叫法。',
  'tour.help.point2': '截图上的每个控件都像印刷版说明书一样编了号。',
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
  'tour.plus.title': '永久归你的场景',
  'tour.plus.subtitle': '可视化、工作室、灯效，还有更多',
  'tour.plus.lead':
    '一整个让 FluidEQ 不断成长的扩展标签页：在显卡上绘制的场景、创作自己场景的工作室、桌面背景和动态灯光。每个场景一点并永久归你，而均衡器、效果架和播放器一如既往保持免费。',
  'tour.plus.point1':
    '从操作菜单中的“账户”登录：已确认的账户可免费获得起步点数。',
  'tour.plus.point2':
    '点数包只需付款一次，付款前有用平实语言写成的条款。不会自动续费，应用也从不接触你的银行卡。',
  'tour.plus.point3':
    '每个场景都可以先观看，你获取的场景会在你登录的每台电脑上播放。',
  'tour.plus.how':
    '打开“可视化”标签页：“图库”“工作室”和“动态灯效”都在它的左侧。',
  'tour.plus.open': '打开“可视化”',
  'tour.plus.imageAlt':
    '“可视化”标签页：侧边是图库、工作室和动态灯效，另有展示铬光、绽放、极光、阿尔卑斯和霓虹之城的图库。',
  'tour.scene.alpine': '阿尔卑斯',
  'tour.scene.aurora': '极光',
  'tour.scene.bloom': '绽放',
  'tour.scene.chrome': '铬光',
  'tour.scene.neonCity': '霓虹之城',

  'tour.visualizers.kicker': '可视化效果',
  'tour.visualizers.title': '随音乐而动的场景',
  'tour.visualizers.subtitle': '由你的显卡绘制',
  'tour.visualizers.lead':
    '场景是由你的显卡在 EQ 曲线下方绘制的鲜活画面：星空下的群山、极光的光幕、霓虹城市。低音、节拍和高音各自带动不同的部分，周围的窗口也能换上它们的颜色。',
  'tour.visualizers.point1':
    '一个选择器包揽一切：{styles} 种可自行塑形和配色的免费样式，以及按分类排列的场景。',
  'tour.visualizers.point2':
    '浏览图库，试看 FluidEQ 的示例场景十秒钟，再添加你喜欢的场景。',
  'tour.visualizers.point3':
    '自动切换外观、全屏显示，还能在“视图”中设置场景的起音和释放。',
  'tour.visualizers.how':
    '点击图表上的外观名称，在“可视化”下选择一个场景，或在“可视化 → 图库”中浏览全部场景。',
  'tour.visualizers.open': '打开均衡器',
  'tour.visualizers.imageAlt':
    '阿尔卑斯：一个描绘夜晚湖上群山的场景，正在图表上的 EQ 曲线下方播放，下面还有另外四个场景。',

  'tour.desktop.kicker': '桌面可视化效果',
  'tour.desktop.title': '让音乐在你的桌面背后律动',
  'tour.desktop.subtitle': '每台显示器一个场景',
  'tour.desktop.lead':
    '把场景放到桌面图标后面。它会随你正在听的内容而动，也可以独自平静地播放，而且每台显示器都能显示自己的场景。',
  'tour.desktop.point1':
    '在显示器排布图上挑选显示器，每台都能显示自己的可视化效果。',
  'tour.desktop.point2': '窗口盖住显示器、电脑锁定或使用电池供电时，它会暂停。',
  'tour.desktop.point3': '下次启动 FluidEQ 时，它会自动恢复。',
  'tour.desktop.how':
    '图表上显示场景时，按下其名称旁的显示器按钮，或选择“视图 → 设为桌面背景”。',
  'tour.desktop.open': '打开均衡器',
  'tour.desktop.imageAlt':
    '三台显示器，各自在桌面图标和任务栏后方显示一个场景：极光、阿尔卑斯和霓虹之城。',

  'tour.lighting.kicker': '动态灯效',
  'tour.lighting.title': '你的桌面随场景亮起',
  'tour.lighting.subtitle': 'Beta · 你的 RGB 设备跟随可视化效果',
  'tour.lighting.lead':
    '通过 Windows Dynamic Lighting 和 Razer Chroma，你的键盘、鼠标、鼠标垫、耳机和支架会呈现图表上场景的色彩与节奏。',
  'tour.lighting.point1':
    '每个可视化效果有四种风格：“场景”“色彩波浪”“频谱”和“节拍涟漪”。',
  'tour.lighting.point2': '每台设备都能单独调整，还可以选择音乐停止时的效果。',
  'tour.lighting.point3':
    '实时预览会画出你自己的桌面，以及它亮起的样子。它仍处于 Beta 阶段：请告诉我们你的设备表现如何。',
  'tour.lighting.how':
    '打开“可视化 → 动态灯效”并开启它，然后在图表上显示一个场景。',
  'tour.lighting.open': '打开“可视化”',
  'tour.lighting.imageAlt':
    '键盘、鼠标和鼠标垫亮起霓虹之城的粉色、紫色和青色。',

  'tour.share.kicker': '每台电脑，双向互通',
  'tour.share.title': '在你的电脑之间共享音频',
  'tour.share.subtitle': '无论坐在哪台电脑前，都能听到两台的声音',
  'tour.share.lead':
    '你的游戏电脑和笔记本互相播放：无论你坐在哪台前，都能听到两台的声音——通过你自己的网络，无损、加密，并经过你在那台电脑上调好的 EQ。',
  'tour.share.pairLabel': '双向',
  'tour.share.pairName': '每台电脑播放对方的声音',
  'tour.share.wireLabel': '无损 · 加密 · 私有局域网',
  'tour.share.stepsTitle': '三步完成设置',
  'tour.share.step1Title': '在一台电脑上复制连接码',
  'tour.share.step1': '打开“共享音频”标签页，按“复制代码”。连接码每次都一样。',
  'tour.share.step2Title': '在另一台上粘贴并链接',
  'tour.share.step2':
    '在另一台电脑上打开“共享音频”，把连接码粘贴到“另一台电脑的连接码”下，然后按“链接”。两台会立即原样互相播放：每台都对自己听到的声音套用自己的 EQ。',
  'tour.share.step3Title': '选择声音的去向',
  'tour.share.step3':
    '每台已链接的电脑都有两个开关：“在此播放”和“发送我的声音”。关闭其中一个即可只单向共享。播放栏会显示另一台电脑的歌曲，其按钮可跨链接使用。“在此播放”旁的滑块可调节音量，“暂停”会停止两个方向，直到你按下“继续”。',
  'tour.share.fact1Title': '无损',
  'tour.share.fact1': '端到端 Float32 PCM。没有媒体编解码器，没有转码损失。',
  'tour.share.fact2Title': '加密',
  'tour.share.fact2':
    '每个数据包都经 AES-256-GCM 加密。连接码就是密钥，没有它谁也听不到。',
  'tour.share.fact3Title': '保持链接',
  'tour.share.fact3':
    '关闭应用或重启后，链接依然保留，哪一边都一样。只有“取消链接”才会结束它。',
  'tour.share.tip':
    '从小音量开始：两台电脑同时播放会叠加音量。首次链接前请先调低音量。',
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
    '在设备下方选择它的一个已保存配置，或点击旁边的“{editSound}”，无需切换主输出就能修改它的声音。主输出的调音保持不变。',
  'tour.output.point3':
    '同时只播放一处：在 FluidEQ 里开始播放会暂停机器上的其他播放，反之亦然。',
  'tour.output.point4':
    '每路输出都会自行保持同步：开始时约落后 30 ms，只有中断后才稍微增加，并以毫秒显示延迟——“共享音频”在此播放另一台电脑的声音时也会一并计入。',
  'tour.output.how':
    '打开均衡器标签页，展开右侧的第二路输出。开启一个设备，在名称下方选择均衡器配置，然后设置音量；其延迟显示在下方。',
  'tour.output.open': '打开均衡器',
  'tour.output.imageAlt':
    '第二路输出面板，已开启 BlackShark V2 Pro，显示均衡器配置选择器、音量滑块和延迟。',

  'tour.outputs.kicker': '每路输出都记得',
  'tour.outputs.title': '每路输出都有自己的声音',
  'tour.outputs.subtitle': '耳机和音箱，各调各的',
  'tour.outputs.lead':
    '从耳机切换到音箱，每路输出都会带回自己的声音：均衡器、预设、音色、低切与高切、DSP 机架、房间和响度调节都随每路输出保存。',
  'tour.outputs.point1':
    '选一路输出，你为它做的设置会立刻回来。耳机和音箱不再共用同一个预设或同一条曲线。',
  'tour.outputs.point2':
    '第二路输出直接从 FluidEQ 引擎播放，拥有自己的声音，主输出从不等它。旁边的“{editSound}”可以修改这份声音，而无需切换主输出。',
  'tour.outputs.point3':
    '蓝牙耳机会在输出旁显示电量，第二路输出会以毫秒显示它落后多少。',
  'tour.outputs.how':
    '打开均衡器，在右侧“{output}”中选择一路输出：之后的所有设置都会留在它那里。第二路输出在“{secondOutput}”中打开，再点击“{editSound}”。',
  'tour.outputs.open': '打开均衡器',
  'tour.outputs.imageAlt':
    '“输出”卡片上有一副耳机和一对音箱，各有自己的预设、曲线和 DSP 环节，轮流播放；旁边的第二路输出同时播放，带着自己的声音、电量和“编辑声音”。',

  'tour.bands.kicker': '均衡器，一目了然',
  'tour.bands.title': '每个频段的数值，直接显示在图上',
  'tour.bands.subtitle': '曲线上有标签，旁边是 EQ 模式',
  'tour.bands.lead':
    '每个频段都可以在自己的点上显示频率、Q 值和增益，标签互不遮挡。EQ 模式现在位于图表旁边而不是盖在上面，你调整曲线的播放方式时，曲线始终可见。',
  'tour.bands.point1':
    '标签总在点的正上方或正下方，从不压住别的标签；拖动频段时它保持不动，一有空间就回到原位。',
  'tour.bands.point2':
    '“{eqMode}”是侧边面板的第一张卡片，“{yourEq}”和“{corrections}”各占一个标签页。图表上方的按钮会把这张卡片带到眼前。',
  'tour.bands.point3':
    '每个控制点、滑块和旋钮都能用键盘操作，移动滑块时曲线会在同一帧重绘。',
  'tour.bands.how':
    '打开均衡器，在图表上方选择“{view}”→“{everything}”（或按 {shortcut}），然后移动一个频段：数值会跟着它走。“{eqMode}”就在右侧面板的最上方。',
  'tour.bands.open': '打开均衡器',
  'tour.bands.imageAlt':
    '均衡器图表上每个频段的点上方显示着频率、Q 值和增益，一个频段正随方向键移动，曲线下方是带有“自定义 EQ”和“校正”标签页的“EQ 模式”卡片。',
  'tour.bands.shortcut': 'Ctrl+W',

  'tour.ears.kicker': '一个频段，两只耳朵',
  'tour.ears.title': '左右耳分别调',
  'tour.ears.subtitle': '在频段自己的菜单里选左 + 右',
  'tour.ears.lead':
    '右键点击一个频段，选择“{split}”：它会在同一频率上变成左右耳各一个频段，你可以分别移动。左耳的曲线画成实线，右耳画成虚线。',
  'tour.ears.point1':
    '“{both}”会把两者在中间重新合并，频率和增益都取一半。“{reset}”和“{clear}”也会合并它们。',
  'tour.ears.point2':
    '“{delete}”就在同一个菜单里，主均衡器和 DSP 机架都有，删除前会请你再按一次确认。',
  'tour.ears.point3':
    'Squiglink 曲线可以只导入一只耳朵：“{importInto}”只填充左耳或右耳，另一只保持原样。',
  'tour.ears.how':
    '打开均衡器，在图上右键点击一个频段，选择“{split}”。DSP 机架的均衡器作用于立体声时，也有同样的菜单。',
  'tour.ears.open': '打开均衡器',
  'tour.ears.imageAlt':
    '均衡器图：一个频段分成左耳和右耳两个频段，分开后又在中间合并，左耳曲线为实线、右耳为虚线，旁边是带有“双耳”和“左 + 右”的频段菜单。',
  // Film voice: generated from .claude/video-kit/films/narration/lines.cjs — edit there.
  'tour.film.eachEar.intro': '现在，FluidEQ 的每个频段都可以在左右耳各自发声。',
  'tour.film.eachEar.menu': '右键点击一个频段，打开它的菜单。',
  'tour.film.eachEar.split': '选择“左 + 右”，频段会一分为二，左右耳各一半。',
  'tour.film.eachEar.lines': '分别拖动每一半。实线是你的左耳，虚线是你的右耳。',
  'tour.film.eachEar.sliders': '每只耳朵也有自己的滑块，标着 L 或 R。',
  'tour.film.eachEar.join': '要重新合并，选择“双耳”，两半会在中间汇合。',
  'tour.film.sound.intro':
    '你在 FluidEQ 里的每一处改动，都会立刻、平滑地听到。',
  'tour.film.sound.glide':
    '在音乐播放时移动一个频段，每次变化都平滑过渡，听不到咔哒声。',
  'tour.film.sound.precise':
    '在 EQ 模式菜单里，高音设为“精确”。每个频段都按画出的样子发声，一直到两万赫兹。',
  'tour.film.sound.classic': '选择“经典”，频段会按 Equalizer APO 的方式构建。',
  'tour.film.games.intro': 'FluidEQ 可以为你的每个游戏设置专属的声音。',
  'tour.film.games.add': '点击“添加游戏”，从启动器已安装的游戏中选择它。',
  'tour.film.games.sound': '然后选择它应有的声音。',
  'tour.film.games.front': '游戏切到前台时，它的声音会自动载入。',
  'tour.film.games.closed': '关闭游戏，你自己的声音就会回来。',
  'tour.film.compact.intro': '只需要控制按钮时，FluidEQ 可以收成一个小播放器。',
  'tour.film.compact.go': '点击顶部的播放器按钮，窗口就变成迷你播放器。',
  'tour.film.compact.eq': '你的 EQ 也一起带过来。转动旋钮，立刻就能听到。',
  'tour.film.compact.back': '一键即可回到完整窗口。',
  'tour.film.deleteImport.intro': '两个小改动，让你的 EQ 更安全。',
  'tour.film.deleteImport.asks':
    '“删除频段”现在会先确认。再点一次才会真正删除。',
  'tour.film.deleteImport.oneEar':
    '导入也可以只填一只耳朵。选择“导入到”，再选“左耳”。',
  'tour.film.deleteImport.otherEar': '只替换左耳，右耳保持原样。',
  'tour.film.outputs.intro': '电脑上的每路输出都保留各自的声音。',
  'tour.film.outputs.each': '从音箱切换到耳机，EQ 就换成耳机自己的。',
  'tour.film.outputs.back': '切回去，音箱的声音和你离开时一模一样。',
  'tour.film.outputs.second': '你也可以同时用第二路输出播放，它有自己的声音。',
  'tour.film.outputs.edit':
    '点击“编辑声音”，就能在这里调整它，主输出照常播放。',
  'tour.film.dsp.intro': 'DSP 机架在 EQ 之后，塑造你听到的一切。',
  'tour.film.dsp.preset': '选一个预设，就能一次设好整个机架。',
  'tour.film.dsp.stages': '每个环节都有自己的页面，所有控件一目了然。',
  'tour.film.dsp.meters': '它的表头随音乐跳动，让你看到它在做什么。',
  'tour.film.deesser.intro': 'DSP 机架新增了齿音消除，专治刺耳的 S 音。',
  'tour.film.deesser.cuts':
    '选一个预设，比如“播客与语音”。每个尖锐的 S 都会被压低并以琥珀色标出，镲片则不受影响。',
  'tour.film.deesser.isolate': '点击“独听”，只听它去掉的部分。',
  'tour.film.headphones.intro': 'FluidEQ 可以用别人做的测量来校正你的耳机。',
  'tour.film.headphones.search':
    '打开“EQ 预设”，在 OPRA 资料库里搜索你的耳机。',
  'tour.film.headphones.measure': '选一个测量，每个都写明了是谁做的。',
  'tour.film.headphones.applied':
    '点击“应用该型号的均衡”，校正会放在单独的一层，你自己的频段保持不变。',
  'tour.film.headphones.paste': '你也可以粘贴从 Squiglink 导出的内容。',
  'tour.film.headphones.ears': '把它作为你的 EQ 应用，双耳或只用一只耳朵都行。',
  'tour.film.headphones.curve': '或者把它作为一条独立的曲线应用。',
  'tour.film.karaoke.intro': '卡拉OK 让 FluidEQ 变成你自己歌曲的舞台。',
  'tour.film.karaoke.open': '点击“打开歌曲”，把歌曲和它的歌词文件一起选中。',
  'tour.film.karaoke.words': '点击播放，每个词会在唱到时亮起。',
  'tour.film.karaoke.pitch':
    '下方的音高引导会显示每个要唱的音。打开麦克风，就能在上面看到自己的声音。',
  'tour.film.maker.intro': '卡拉OK 制作器能把一首歌做成卡拉OK 文件。',
  'tour.film.maker.timeline':
    '载入一首歌，点击“制作”，歌里的每个词和每个音都排在时间线上。',
  'tour.film.maker.play':
    '播放时，播放头会经过每个词和每个音。拖动任何一个，就能修正它的时间或音高。',
  'tour.film.maker.use':
    '制作器也能根据歌手的声音自动做好一首歌。听着没问题，就点“在播放器中使用”。',
  'tour.film.looks.intro': 'EQ 下方的频谱，可以画成你喜欢的任何样子。',
  'tour.film.looks.open': '在图表的工具栏里点击“新建外观”。',
  'tour.film.looks.forms':
    '用箭头切换各种形状：LED 柱、霓虹柱、城市天际线、玻璃塔，还有更多。',
  'tour.film.looks.shape':
    '然后调整它的样子。“分段”决定有多少根柱子，颜色、间隙和动态也都由你决定。',
  'tour.film.looks.save':
    '点击“保存”，把它留作你自己的外观，也可以存成文件分享。',
  'tour.film.engine.intro':
    'FluidEQ 有自己的音频引擎，它把你的 EQ 和 DSP 机架用到电脑播放的一切声音上。',
  'tour.film.engine.choose':
    '打开右上角的操作菜单，点击引擎卡片，选择“FluidEQ 引擎”。',
  'tour.film.engine.rack':
    '然后打开 DSP，选一个预设。游戏、浏览器和音乐应用，都会经过它播放。',
  'tour.film.library.intro': '媒体库用你的 EQ 播放你自己的音乐。',
  'tour.film.library.albums': '你的专辑以封面显示，用箭头翻看。',
  'tour.film.library.album': '点击一张专辑，打开它和里面的所有歌曲。',
  'tour.film.library.play':
    '点击播放，它会经过和其他声音相同的 EQ 与 DSP 机架。',
  // End of film voice.
  'tour.film.soundOn': '打开声音',
  'tour.film.soundOff': '关闭声音',
  'tour.film.watch': '观看视频',
  'tour.film.close': '关闭视频',

  'tour.myCurves.kicker': '你自己的曲线',
  'tour.myCurves.title': '你自己的曲线列表，就在 OPRA 旁边',
  'tour.myCurves.subtitle': '保存、命名并重复使用你的曲线',
  'tour.myCurves.lead':
    '{eqPresets} 现在在 OPRA 库旁边有了 {myCurves}：每一条你想再用的曲线，都带着你起的名字和它的形状图。可以从 Squiglink 导出、.txt 文件、当前的 EQ 或 OPRA 选择中添加。',
  'tour.myCurves.point1':
    '{applyCurve} 把曲线作为耳机校正播放，有自己的强度和开关；{applyEq} 则把它的频段放进你的 EQ。',
  'tour.myCurves.point2':
    '{squiglink} 有了自己的标签页，{save} 一键保存你带来的曲线。',
  'tour.myCurves.point3':
    '{exportList} 把整个列表写进一个文件，用来备份或带到另一台电脑；{importList} 再读回来，并告诉你哪些没有导入。',
  'tour.myCurves.how':
    '在 EQ 中打开 {eqPresets}，选择 {myCurves}，然后按 {add}。',
  'tour.myCurves.open': '打开 EQ 预设',
  'tour.myCurves.imageAlt':
    '“我的曲线”中的 EQ 预设页面：四条耳机曲线的列表，每条都有名称、来源、添加日期和形状图。刚从 Squiglink 保存的曲线出现在最上面，并作为耳机校正播放。',

  'tour.songs.kicker': '每首歌都有自己的声音',
  'tour.songs.title': '记得你喜好的歌曲',
  'tour.songs.subtitle': '调一次，每次都这样听',
  'tour.songs.lead':
    '打开“{songSound}”后，一首歌结束时的预设、音色和均衡器会在它下次播放时回来，就在你调它的那路输出上。',
  'tour.songs.point1':
    '在歌曲播放时改变预设、音色或某个频段，它就会记住这些。你从没动过的歌什么也不会记。',
  'tour.songs.point2':
    '回来时会出现一条通知，写明歌名和带回的内容，旁边就是“{undo}”和“{forget}”。',
  'tour.songs.point3':
    '歌曲结束后，之前的声音会回来；每路输出各记各的：同一首歌在耳机上和音箱上可以听起来不一样。',
  'tour.songs.how':
    '打开均衡器，在右侧“{output}”中打开“{songSound}”。播放一首歌，选一个预设或转动音色，然后让它播完或跳过。',
  'tour.songs.open': '打开均衡器',
  'tour.songs.imageAlt':
    '一个轮流播放的四首歌队列：三首带着各自留下的预设和曲线，一首从未调整过；上方是被记住的歌曲弹出的通知，带有“撤销”和“忘记这首歌”。',

  'tour.deesser.kicker': '更柔和的 S',
  'tour.deesser.title': 'DSP 机架里的齿音消除器',
  'tour.deesser.subtitle': '压低尖锐的 S，镲片不受影响',
  'tour.deesser.lead':
    '“{deEsser}”只在人声尖锐的 S、T、SH 发出时把它们压低，镲片、踩镲和其余高频保持原样。',
  'tour.deesser.point1':
    '它按歌曲自身的电平来找每个 S，所以安静和响亮的曲目一视同仁；你能看到它抓到的每个 S 和压了多少。',
  'tour.deesser.point2':
    '它可以只压低构成 S 的频率、S 以上的全部，或整个人声；“{isolate}”只播放它去掉的部分。',
  'tour.deesser.point3':
    '“{speech}”“{podcast}”和“{audiobook}”会开启它。机架里的每个滤波器现在都能保存你自己的配置。',
  'tour.deesser.how':
    '打开 DSP，在左侧列表中选择“{deEsser}”，或选择“{podcast}”预设。从一个配置开始，再调高“{sensitivity}”，直到每个 S 都被抓到。',
  'tour.deesser.open': '打开 DSP',
  'tour.deesser.imageAlt':
    '齿音消除器的条带滚动而过：人声的每个 S 高出该级开始起作用的线，下方以琥珀色挂着它的削减量，踩镲为灰色、不受影响；上方是选中“频谱”的该级，下方是“语音”“播客”和“有声书”。',

  'tour.chat.kicker': '说一句，场景就变',
  'tour.chat.title': '提出修改，在舞台上看效果',
  'tour.chat.subtitle': '工作室舞台旁的聊天',
  'tour.chat.lead':
    '“{studio}”的舞台旁现在有了聊天。说出要改什么——场景的样子、随音乐的动态、颜色或光线——你自己的 AI 就会编辑场景，并边改边在舞台上播放每个版本。',
  'tour.chat.point1':
    '每条回复都保留它做出的版本，“{bringBack}”可以换回之前的版本。每个场景都保留它的历史聊天。',
  'tour.chat.point2':
    '“{attach}”会把场景的画面随消息一起发送，你还可以在上面画出你的意思。它工作时发送的消息会排队，之后一起发出。',
  'tour.chat.point3':
    '它运行在这台电脑上安装的 Claude Code 上，用你自己的方案，并显示你的额度还剩多少。',
  'tour.chat.how':
    '打开“{plus}”，在侧栏选择“{studio}”，选择一个场景或新建一个，然后在舞台旁的输入框里输入。',
  'tour.chat.open': '打开“可视化”',
  'tour.chat.imageAlt':
    '工作室的舞台和旁边的聊天：一条让舞台灯随军鼓闪烁的请求，回复的步骤逐一打勾，带“恢复”的版本 2 被保留，版本 2 播放时舞台灯开始闪烁。',
  'tour.chat.ask': '让舞台灯随军鼓闪烁。',
  'tour.chat.reply': '完成：两盏聚光灯在每一下军鼓时闪白光，再渐渐回到粉色。',

  'tour.looks.kicker': '你自己的可视化效果',
  'tour.looks.title': '自定义图表外观',
  'tour.looks.subtitle': '你的形态，你的颜色，你的律动',
  'tour.looks.lead':
    'EQ 下方的频谱可以按你喜欢的任何方式绘制。从 {forms} 种形态中挑一种，从 LED 与霓虹频柱到梯田、天际线和玻璃塔；用它自己的“自动”配色，或按频率、按电平、按热度上色；设定起音多快、峰值停留多久；再用火花、彗星或涟漪标记峰值。保存为你自己的外观，并以文件形式分享。',
  'tour.looks.point1':
    '{forms} 种形态，各有自己的控制项：分段、间隔、填充度、粗细，以及填充还是描边。',
  'tour.looks.point2':
    '每种形态都可以用它自己的“自动”配色，也可以按频率、电平或热度，用你自己的颜色渐变上色，或者只用一种纯色。',
  'tour.looks.point3':
    '起音和释放决定律动；峰值高亮、填充峰值和十二种峰值标记决定一次击打的样子。',
  'tour.looks.point4':
    '辉光在所有模式下都可用；外观可以导出为文件，也可以从文件导入。',
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
  'tour.studio.free': '所有账户免费',
};

export default tour;
