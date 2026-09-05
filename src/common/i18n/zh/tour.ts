/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
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
  'tour.rail.new': '本版本新增',
  'tour.rail.always': 'FLUIDEQ 还有',
  'tour.newBadge': '新',
  'tour.howTitle': '如何开始',

  'tour.theme.kicker': '全新外观',
  'tour.theme.title': '认识黑色主题',
  'tour.theme.subtitle': '纯黑，为深夜与 OLED 屏幕而生',
  'tour.theme.lead':
    'FluidEQ 现在有了第二副面孔。黑色主题抹去了应用诞生时的石板蓝：面板、菜单和工具栏全部变为单色，强调色保留，频谱成为屋里唯一的色彩。',
  'tour.theme.point1': '纯黑背景：在 OLED 屏幕上，图表周围的像素会直接熄灭。',
  'tour.theme.point2':
    '所有窗口同步：菜单、对话框、卡拉OK 舞台和曲库一起切换。',
  'tour.theme.point3':
    '你的强调色和彩虹模式保持不变。声音没有任何变化，只是换了外衣。',
  'tour.theme.howTitle': '如何切换',
  'tour.theme.how':
    '打开右上角脉冲图标后的菜单，选择“主题 → 黑色”。想换回来时，“海洋”只需一次点击。',
  'tour.theme.tryBlack': '立即切换为黑色',
  'tour.theme.tryOcean': '换回海洋',
  'tour.theme.imageAlt':
    '黑色主题下的 FluidEQ：EQ 标签页显示十五个频段，实时频谱正在播放一首歌曲。',

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
    '在那台电脑上打开 FluidEQ，进入“共享音频”，选择“发送此电脑的音频”，粘贴连接码并按“连接并发送”。它的系统音频即开始传输。',
  'tour.share.step3Title': '选择优先级，开始聆听',
  'tour.share.step3':
    '“音乐”保留更大的安全缓冲，播放不中断；“游戏/视频”以最低延迟运行，保证口型同步。每个发送端都会混入接收端的输出，并由其 EQ 塑形。 接收端的播放栏会显示每个发送端的歌曲，其按钮可通过网络远程操作。',
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
  'tour.library.title': '为你自己的音乐准备的曲库',
  'tour.library.subtitle': '放进文件夹，得到专辑',
  'tour.library.lead':
    '给 FluidEQ 指一个文件夹，它会读取里面的每首歌和每个视频，连同标签与封面，整理成一个可以按专辑、艺人、流派、歌曲或文件夹浏览的收藏。播放走 FluidEQ 自己的播放器，所以 EQ 和 DSP 机架始终在信号链上。',
  'tour.library.point1':
    '同一排书架的三种看法：列表、网格和 Cover Flow，大收藏还能按字母跳转。',
  'tour.library.point2':
    '带“继续播放”的“接下来”队列：列表放完后，继续播放同一流派的更多歌曲。',
  'tour.library.point3':
    '播放列表和一个永久的“收藏”列表。右键任意歌曲即可加入其中，或加入队列。',
  'tour.library.point4':
    '智能 EQ 歌曲记忆：播放时打开“为这首歌保存”，你做的修正就会为这首歌记住。',
  'tour.library.how':
    '打开“曲库”标签页，按“添加文件夹”或把文件夹拖到页面上，等待“已添加歌曲”。选择专辑、艺人、流派、歌曲、文件夹或树形，然后按播放。',
  'tour.library.open': '打开曲库',

  'tour.dsp.kicker': '一座母带机架',
  'tour.dsp.title': 'DSP 机架',
  'tour.dsp.subtitle': '九个环节，各有自己的图表',
  'tour.dsp.lead':
    '曲库播放的一切都可以依次经过一排录音棚级环节：归一化、降噪、激励器、Bass Forge、均衡器、Bass Punch、Dimension、最大化器和母带，外加曲目之间的交叉淡化。每个环节都是一张卡片，有实时图表、预设和一个“独听”按钮，只听它在做什么。',
  'tour.dsp.point1':
    '降噪修复录音本身：嘶声、嗡声、咔嗒声和一个神经网络人声清理器，依据对曲目的扫描测量。',
  'tour.dsp.point2':
    'Bass Forge 在低音之下加上真正的低八度；Bass Punch 塑造它的起音、延音、bloom 和 duck。',
  'tour.dsp.point3':
    '十五段参数均衡器，支持最小相位或线性相位、中侧处理、过采样，以及数十个命名预设。',
  'tour.dsp.point4':
    '母带环节带 LUFS 响度目标和真峰值保护，从流媒体到黑胶的交付预设，以及用于比较音色而非音量的增益匹配。',
  'tour.dsp.how':
    '从曲库播放一首歌，打开 DSP 标签页，在“预设”里选一条链，再在侧边标签中点开一个环节并将其打开。',
  'tour.dsp.open': '打开 DSP',

  'tour.output.kicker': '同时在两处播放',
  'tour.output.title': '第二路输出',
  'tour.output.subtitle': '耳机和音箱同时响，各有各的配置',
  'tour.output.lead':
    '你听到的声音可以同时从第二台设备播出：耳机和房间的音箱，书桌和厨房。镜像在你的 EQ 塑形之后取得声音再送出去，所以第二路输出听到的是同一份调音。装上路由驱动后，两路输出保持同步，而且各自可以带自己的配置，就像 Voicemeeter 这类混音器的做法。',
  'tour.output.point1':
    '在“镜像到”里选任何一路其他输出，它就开始播放你正在听的内容，音量独立。',
  'tour.output.point2': '每路输出保留自己的 EQ 配置，音箱和耳机可以分别调音。',
  'tour.output.point3':
    '同一时间只有一个播放器：在 FluidEQ 里开始播放会暂停机器上的其他播放，反之亦然。',
  'tour.output.point4':
    '镜像的声音大约晚五分之一秒到达：在另一个房间听音乐没问题，看视频或玩游戏则不行。',
  'tour.output.how':
    '在 EQ 标签页，展开右侧面板里的“第二路输出”，在“镜像到”中选一台设备并设置音量。运行时卡片会显示“镜像中”。',
  'tour.output.open': '打开 EQ',

  'tour.looks.kicker': '你自己的可视化',
  'tour.looks.title': '自定义图表外观',
  'tour.looks.subtitle': '五十七种形态，你的颜色，你的律动',
  'tour.looks.lead':
    'EQ 下方的频谱可以按你喜欢的任何方式绘制。从五十七种形态中挑一种，从简单的柱状和线条到山脊、丝绸、天际线和点阵；用单色、按频率、按电平或按热度上色；设定起音多快、峰值停留多久；再用火花、彗星、光环或王冠标记峰值。保存为你自己的外观，并以文件形式分享。',
  'tour.looks.point1':
    '五十七种形态，各有自己的控制项：段数、间距、填充、粗细，以及填充还是描边。',
  'tour.looks.point2':
    '按频率、电平或热度上色，用你自己的颜色渐变，或者只用一种纯色。',
  'tour.looks.point3':
    '起音和释放决定律动；点亮的峰值和十八种峰值标记决定一次击打的样子。',
  'tour.looks.point4':
    '彩虹模式在节拍上加一层光晕，并加一道走完整个色轮的边框。外观可以导出为文件，也可以从文件导入。',
  'tour.looks.how':
    '在 EQ 标签页，按图表工具栏上的“新建外观”。用选择器挑一种形态，或按空格键轮换，在音乐播放时调整颜色和律动，然后保存。',
  'tour.looks.open': '打开 EQ',

  'tour.karaoke.kicker': '家里的舞台',
  'tour.karaoke.title': '带音高引导的卡拉OK',
  'tour.karaoke.subtitle': '你的歌，你的歌词，你的麦克风',
  'tour.karaoke.lead':
    '拖入一首歌，有没有歌词文件都行，FluidEQ 会把它们配成播放列表，在封面或视频上显示同步歌词，监听你的麦克风，并把你的音高画在旋律旁边。一切都留在这台电脑上；麦克风从不被录制或回放。',
  'tour.karaoke.point1':
    '“引导人声”滑块从原唱一直滑到纯伴奏，不需要额外文件就能去掉主唱。',
  'tour.karaoke.point2':
    '音高轨道有“音符”和“曲线”两种视图：歌曲的音符是方块，你的声音是实时的线，并提示偏高、准确或偏低。',
  'tour.karaoke.point3':
    '唱完后有表现回顾，列出需要练习的段落，并有倒数供你再来一次。',
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
    '“自动设置这首歌”：先分离人声，再识别歌词和时间，并可选择在后台继续。',
  'tour.maker.point2':
    '保留分离出的音轨：人声和伴奏，各自可保存，包括保存为 MP3。',
  'tour.maker.point3':
    '细节的手动工具：敲击歌词、录制行进入点、带起点和长度的单词检查器，以及把一个词拆成音节。',
  'tour.maker.point4':
    '在音高网格上绘制旋律，标记金色音符，然后导出为 FluidEQ 项目、UltraStar TXT、LRC、增强 LRC 或伴奏音轨。',
  'tour.maker.how':
    '在卡拉OK 中载入一首歌并按“制作”。在向导中接受“自动设置”，在时间线上修正歌词，然后“在播放器中使用”并“导出”。',
  'tour.maker.open': '打开卡拉OK',

  'tour.media.kicker': '让网络经过你的 EQ',
  'tour.media.title': '在线媒体',
  'tour.media.subtitle': 'YouTube、YouTube Music、Bandcamp、Twitch 和 Suno',
  'tour.media.lead':
    '内置的流媒体网站播放器，让你在线观看和收听的内容经过你的 EQ，而不是另开一个浏览器。已接入五个网站，各有自己的搜索；指向站外的链接会被拦下，并提供“在浏览器中打开”的选择。',
  'tour.media.point1':
    '一个搜索框，搜索当前打开的网站，并保留可清除的最近搜索。',
  'tour.media.point2': '“屏蔽广告”会跳过视频广告并隐藏 YouTube 上的广告位。',
  'tour.media.point3':
    '续播：播放器记住最后一页以及你看到的位置，并带你回到那里。',
  'tour.media.point4':
    '下载带进度提示，完成后可“在文件夹中显示”；还有一个“退出所有网站”按钮，一键清除全部 Cookie 和登录。',
  'tour.media.how':
    '打开“在线媒体”标签页，在顶部一行选一个网站，在搜索框输入并按搜索。后退、前进和重新加载与浏览器一样。',
  'tour.media.open': '打开在线媒体',
};

export default tour;
