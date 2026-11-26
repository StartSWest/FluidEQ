// 2.6 新功能（`renderer/components/featureTour/release26.tsx` 和 `release26Visuals.tsx`）。
const tour26 = {
  'tour.v26.window.name': '全新窗口',
  'tour.v26.window.subtitle': '平整安静，深色或白色',
  'tour.v26.window.kicker': 'FLUIDEQ 2.6',
  'tour.v26.window.title': '整个窗口，焕然一新',
  'tour.v26.window.lead':
    '每个页面都平整安静，可从全黑调到全白，“色调”还多了第二种颜色。',
  'tour.v26.window.hint': '在窗口上拖动手柄，就能把它从深色变成白色。',
  'tour.v26.window.seamLabel': '白色与深色的分界',
  'tour.v26.window.seamValue': '白色占 {percent}%',
  'tour.v26.window.white': '白色',
  'tour.v26.window.dark': '深色',

  'tour.v26.autoEq.name': '自动均衡',
  'tour.v26.autoEq.subtitle': '每首歌都有自己的声音',
  'tour.v26.autoEq.kicker': '均衡器 · 自动均衡',
  'tour.v26.autoEq.title': '每首歌都用它该有的声音播放',
  'tour.v26.autoEq.lead':
    '一个面板决定每首歌的声音：保存了声音的歌曲播放它自己的声音，设定了声音的专辑让每首歌都播放那个声音，其他歌曲则按你离开时的样子播放你自己的声音。',
  'tour.v26.autoEq.point1':
    '正在播放的歌曲，以及声音来自哪里：它自己的、专辑的，还是你的。',
  'tour.v26.autoEq.point2':
    '“歌曲声音”和“专辑声音”，各有自己的开关，还有“为这首歌保存”。',
  'tour.v26.autoEq.point3':
    '“智能校正”为每首歌测量一次，稳定下来后保持它的校正，可叠加在任何预设之上。',
  'tour.v26.autoEq.open': '打开均衡器',

  'tour.v26.mic.name': '麦克风',
  'tour.v26.mic.subtitle': '为你的麦克风准备的效果架',
  'tour.v26.mic.kicker': '麦克风',
  'tour.v26.mic.title': '你的声音，在每个应用里都清晰稳定',
  'tour.v26.mic.lead':
    '新的“麦克风”标签页在 FluidEQ Engine 中调整每个麦克风自己的声音，所有使用它的应用都会听到结果。',
  'tour.v26.mic.point1':
    '九个环节，从“低切”“降噪”到“人声电平”“混响”，每个都有自己的开关和预设。',
  'tour.v26.mic.point2':
    '说话时听到的自己：麦克风收到的声音，轻轻垫在别人听到的声音后面。',
  'tour.v26.mic.point3':
    '可以直接上手的配置：直播、播客、游戏语音、唱歌、人声效果等。',
  'tour.v26.mic.open': '打开“麦克风”',

  'tour.v26.eq.name': '均衡器页面',
  'tour.v26.eq.subtitle': '三个标签页和你自己的预设',
  'tour.v26.eq.kicker': '均衡器',
  'tour.v26.eq.title': '均衡器页面，分成三个标签页',
  'tour.v26.eq.lead':
    '“你的均衡”“预设”和“音色”各自把工具放在一行，频段就在图表正下方。每张预设卡片都会画出它的曲线，“新建预设”可以做出你自己的预设。',
  'tour.v26.eq.point1':
    '“你的均衡”“预设”和“音色”，名称旁边显示各自包含的内容。',
  'tour.v26.eq.point2':
    '在“我的”里用“新建预设”创建：在图表上塑造的曲线，以及给 DSP 页面的效果架。',
  'tour.v26.eq.point3': '每张预设卡片都画出曲线，点亮星标就能把它留在收藏里。',
  'tour.v26.eq.open': '打开均衡器',

  'tour.v26.dynamics.name': '动态',
  'tour.v26.dynamics.subtitle': '每个频段一条曲线',
  'tour.v26.dynamics.kicker': 'DSP · 动态',
  'tour.v26.dynamics.title': '看清“动态”对每个频段做了什么',
  'tour.v26.dynamics.lead':
    '每个频段都画出自己的曲线，电平随音乐实时沿曲线移动：安静时抬起，响亮时压住。',
  'tour.v26.dynamics.point1':
    '每个频段此刻在做什么，抬起还是压住，随歌曲实时显示。',
  'tour.v26.dynamics.point2':
    '拖动点来塑造曲线：空心点是频段开始作用的位置，实心点是作用的强度。',
  'tour.v26.dynamics.point3': '需要精确时，在曲线下方输入数值。',
  'tour.v26.dynamics.open': '打开 DSP',

  'tour.v26.library.name': '媒体库',
  'tour.v26.library.subtitle': '歌词、标签和 3D Cover Flow',
  'tour.v26.library.kicker': '媒体库',
  'tour.v26.library.title': '全新的媒体库，每首歌都配上歌词',
  'tour.v26.library.lead':
    '书架里放着文件夹树，专辑像页面一样打开，标签可以修正，还有 3D Cover Flow，以及随演唱逐字点亮的“歌词”标签页。',
  'tour.v26.library.point1':
    '带时间的歌词随歌曲逐字点亮；点击一行即可从那里播放。',
  'tour.v26.library.point2':
    '在浏览器中到 LRCLIB、Genius 或 Musixmatch 查找歌词，或直接导入，歌词会一直跟着这首歌。',
  'tour.v26.library.point3': '“在卡拉OK中打开”会把歌词带到“卡拉OK 制作器”。',
  'tour.v26.library.open': '打开媒体库',

  'tour.v26.karaoke.name': '卡拉OK',
  'tour.v26.karaoke.subtitle': '为你的演唱打分',
  'tour.v26.karaoke.kicker': '卡拉OK',
  'tour.v26.karaoke.title': '唱吧，看看你唱得有多准',
  'tour.v26.karaoke.lead':
    '卡拉OK 会为你唱的每个音打分，按歌曲自己的调来称呼音名，听和弦准确得多，并通过媒体库的播放器播放。',
  'tour.v26.karaoke.point1': '你唱的时候，音高条会被你声音的颜色填满。',
  'tour.v26.karaoke.point2':
    '每个音都有评判，歌词行以一排排格子显示在音高条下方。',
  'tour.v26.karaoke.point3': '边唱边看得分，结束时还有带歌曲地图的总结。',
  'tour.v26.karaoke.open': '打开卡拉OK',

  'tour.v26.also': '2.6 的其他新功能',
  'tour.v26.also.normalizer': '“标准化”由你掌控：DSP 预设不会再打开或关闭它。',
  'tour.v26.also.deEsser':
    '更多 DSP 预设让“s”音更柔和，低切和高切在转动旋钮的瞬间就能听到。',
  'tour.v26.also.wave':
    '标题栏的波形新增十种样式和“录音机”，并显示正在播放的预设名称。',
  'tour.v26.also.notices': '通知集中在一处：播放栏的右下角。',
  'tour.v26.also.lighter': '电脑负担更轻：窗口不再随每个音频块重绘自己。',

  'tour.v26.looks.name': '外观选择器',
  'tour.v26.looks.subtitle': '每种外观都在动，实时绘制',
  'tour.v26.looks.kicker': '场景 · 外观',
  'tour.v26.looks.title': '选择器里的每种外观都在动',
  'tour.v26.looks.lead':
    '外观选择器像媒体库一样排布，打开时停在正在播放的外观上，实时绘制每种标准外观，视野中的每个场景都会播放它的片段。',
  'tour.v26.looks.point1': '和媒体库一样的位置栏：先是样式，再按类别列出场景。',
  'tour.v26.looks.point2':
    '每种标准外观都在自己的方块里实时绘制、动起来，正在播放的会被标出。',
  'tour.v26.looks.point3': '“网格”或“详细信息”，以及覆盖全部内容的搜索。',
  'tour.v26.looks.open': '打开图表',

  'tour.v26.colours.name': '窗口颜色',
  'tour.v26.colours.subtitle': '场景借给窗口的颜色',
  'tour.v26.colours.kicker': '场景 · 窗口颜色',
  'tour.v26.colours.title': '调整场景借给窗口的颜色',
  'tour.v26.colours.lead':
    '每个场景有一套窗口颜色，也就是白天的颜色，入夜后逐渐变暗。“窗口颜色”让你更改它们，“自动”可重新找回，“使用场景的颜色”可还原。',
  'tour.v26.colours.point1': '场景借给窗口的颜色，每种都是一个可以更改的色块。',
  'tour.v26.colours.point2': '窗口本身，以这些颜色呈现的样子。',
  'tour.v26.colours.point3':
    '“自动”重新找回场景自己的颜色，“使用场景的颜色”把它们还原。',
  'tour.v26.colours.open': '打开“场景”',

  'tour.v26.gallery.name': '图库',
  'tour.v26.gallery.subtitle': '像媒体库一样排布',
  'tour.v26.gallery.kicker': '场景 · 图库',
  'tour.v26.gallery.title': '图库，像媒体库一样排布',
  'tour.v26.gallery.lead':
    '搜索在顶部，分类排成一行。新账户从一个免费点数开始，也就是一个可以保留的场景；场景按每日额度下载。',
  'tour.v26.gallery.point1': '搜索在顶部，分类排成一行，和媒体库的工具栏一样。',
  'tour.v26.gallery.point2':
    '视野中的每个场景都会播放它的片段；关闭动画后它们保持静止。',
  'tour.v26.gallery.point3': '保留一个场景需要一个点数，新账户自带一个。',
  'tour.v26.gallery.open': '打开“场景”',

  'tour.v26.publish.name': '一按即发布',
  'tour.v26.publish.subtitle': '预览自动录制',
  'tour.v26.publish.kicker': '工作室 · 发布',
  'tour.v26.publish.title': '点击“提交审核”，预览自动录制',
  'tour.v26.publish.lead':
    '发布时，在你点击“提交审核”的那一刻，会用静音的演示歌曲录下场景的预览；“用 AI 撰写”会根据场景的聊天填写说明。',
  'tour.v26.publish.point1': '说明可以由“用 AI 撰写”填写，也可以自己写。',
  'tour.v26.publish.point2': '你写的一句话会在发出前翻译成每种语言。',
  'tour.v26.publish.point3': '“提交审核”会录下预览片段，无需你另外准备。',
  'tour.v26.publish.open': '打开“场景”',

  'tour.v26.alsoScenes': '2.6 的其他新功能',
  'tour.v26.alsoScenes.auto':
    '“自动”会在当前场景播放时准备好下一个场景并交叉淡入，不再出现加载圈。',
  'tour.v26.alsoScenes.ambient':
    '“氛围”让面板保持平整；在媒体库里，场景在封面后方播放。',
  'tour.v26.alsoScenes.karaoke':
    '卡拉OK 的场景在歌词窗口中播放，有自己的“透明度”和“模糊”。',
  'tour.v26.alsoScenes.studio':
    '工作室始终使用自己的场景，并像媒体库一样排布。',
} as const;

export default tour26;
