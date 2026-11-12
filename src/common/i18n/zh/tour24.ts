// 2.4 新功能（`renderer/components/featureTour/release24.tsx`）。
const tour24 = {
  'tour.animations.kicker': '工作室 · 动画',
  'tour.animations.title': '会动的图片，逐帧检查',
  'tour.animations.subtitle': '场景里的每段动画，一帧一帧',
  'tour.animations.lead':
    '让场景的聊天把一张图片动起来：它会把图片弯折成照片般真实的帧，或使用你自己的 Claude 能用到的东西，再排成帧图并检查每一帧。',
  'tour.animations.point1':
    '放在地面、天空或水上，上坡或下坡，任意速度，逐帧播放，或在整个工作室上方放大播放。',
  'tour.animations.point2':
    '可导入帧图、图集 JSON、GIF、APNG、WebP、Aseprite 文件或编号图片；添加前会先在标签页里播放。',
  'tour.animations.point3':
    '每个新项目都从球体里的月亮和飞过上方的燕子开始，第一天就能学会图片和动画的用法。',
  'tour.animations.how':
    '打开“可视化”，进入工作室，在舞台下方选择动画。在聊天里让它把场景中的一张图片动起来。',
  'tour.animations.open': '打开“可视化”',
  'tour.animations.imageAlt':
    '工作室的动画标签页：燕子在天空背景上扇动翅膀，它的八帧排成一条；下方是场景的聊天，正在找出跳动的那一帧。',
  'tour.animations.task': '逐帧检查燕子的飞行。',
  'tour.animations.stepLook': '并排查看了全部 {count} 帧',
  'tour.animations.stepJump': '第 {frame} 帧比其他帧跳得更高',
  'tour.animations.stepFix': '把第 {frame} 帧放回与其他帧同一条线上',
  'tour.animations.reply': '现在飞行很流畅：每一帧都在同一条线上。',
  'tour.pictures.kicker': '工作室 · 图片',
  'tour.pictures.title': '看清每张图，标出来，再发回去',
  'tour.pictures.subtitle': '在聊天里放大、复制图片，并在上面画',
  'tour.pictures.lead':
    'AI 打开或处理的每张图片都会直接显示在聊天里。点击即可放大查看，想放多大就放多大。',
  'tour.pictures.point1':
    '就在放大的地方画：圈出一处、用箭头指出、写一个词，或裁剪到要紧的部分，然后附加到下一条消息。',
  'tour.pictures.point2':
    '任何图片都能用按钮、Ctrl+C 或右键复制，粘贴到任何地方。',
  'tour.pictures.point3': '你的标记会随图片一起发送，AI 能准确看懂你的意思。',
  'tour.pictures.how':
    '在工作室的聊天里点击图片打开它。按“画”来标记，再按“附加到聊天”。',
  'tour.pictures.open': '打开“可视化”',
  'tour.pictures.imageAlt':
    '一张放大打开的月亮图片：环形山周围画了一个圈，还有箭头和文字，裁剪框正在收拢，旁边是“复制图片”和“附加到聊天”按钮；下方是图片所在的聊天。',
  'tour.pictures.ask': '把这个月亮放进球体，边缘发光。',
  'tour.pictures.reply': '好了：边缘在发光，它也在“图片”里。',
  'tour.pictures.mark': '再亮一点',
  'tour.pictures.followUp': '让这个环形山随低音发光。',

  'tour.stage.kicker': '工作室 · 舞台',
  'tour.stage.title': '在它真正播放的地方试场景',
  'tour.stage.subtitle': '超宽图表、迷你播放器、平静与音乐',
  'tour.stage.lead':
    '舞台按大家看到的样子展示你的场景：作为超宽图表，或在迷你播放器的一列里，上面叠着歌曲和控制按钮。',
  'tour.stage.point1':
    '可以放大舞台并四处移动。AI 看到的正是舞台显示的内容，所以“这里”就是这里。',
  'tour.stage.point2':
    '在舞台上按一下，就把音乐换成“平静”——桌面背景播放的那种缓慢动画。',
  'tour.stage.point3':
    '没有播放任何内容时，场景会随演示歌曲动起来，工作时它从不会停住。',
  'tour.stage.how':
    '在工作室里，从舞台的尺寸菜单选一个形状。音乐和平静按钮就在舞台上。',
  'tour.stage.open': '打开“可视化”',
  'tour.stage.imageAlt':
    '工作室舞台上的 Alpine 场景，正在放大，一个框标出 AI 看到的范围，还有音乐和平静按钮；旁边是同一场景的超宽图表，以及叠着控制按钮的迷你播放器。',
  'tour.stage.agentSees': 'AI 看到的范围',

  'tour.ai.kicker': '工作室 · 你的 AI',
  'tour.ai.title': '一个照看你所有场景的 AI',
  'tour.ai.subtitle': '同时做多个场景，用你自己的插件，任选模型',
  'tour.ai.lead':
    '你的 AI 现在能同时处理多个场景，每个场景一个聊天，而且消耗的 Claude 套餐额度更少。',
  'tour.ai.point1':
    '它使用你自己的 Claude 拥有的一切：你的插件、工具和命令；用到任何新东西之前都会先询问。',
  'tour.ai.point2':
    'FluidEQ 自带的 3D 世界、3D 照片和动画技能随应用提供，始终保持最新。',
  'tour.ai.point3':
    '为每个聊天选择模型和投入程度。列表跟随 Claude Code，新模型一发布就会出现。',
  'tour.ai.how':
    '在工作室打开一个场景，在它的聊天里输入。模型和投入程度就在输入框下方。',
  'tour.ai.open': '打开“可视化”',
  'tour.ai.imageAlt':
    '同时进行的三个场景，两个仍在处理，一个已保存为版本 7，下方是 FluidEQ 的技能；旁边是 AI 使用的东西，以及模型和投入程度菜单。',
  'tour.ai.skills': 'FluidEQ 的技能',
  'tour.ai.skillWorlds': '3D 世界',
  'tour.ai.skillPhotos': '3D 照片',
  'tour.ai.skillAnimation': '动画',
  'tour.ai.claudeTitle': '使用你自己的 Claude',
  'tour.ai.claudePlugins': '你的插件',
  'tour.ai.claudeTools': '你的工具和命令',
  'tour.ai.claudeAsks': '用新东西前先询问',
  'tour.controls.kicker': '场景',
  'tour.controls.title': '可以按你心意定制的场景',
  'tour.controls.subtitle': '调色板、选项、3D 世界和保留的版本',
  'tour.controls.lead':
    '场景现在可以提供调色板、带图标的选项、单一颜色，以及只在用到它们的选项下才出现的控件。',
  'tour.controls.point1':
    '3D 世界加入了弯曲的圆柱和圆锥以及真正的地面，场景发布时会附带更清晰的白天预览片段，配着演示歌曲。',
  'tour.controls.point2':
    '发布界面会显示场景有多大。版本只在发布时才升高，状态行会告诉你当前是哪个版本。',
  'tour.controls.point3':
    '图库为每个场景保留最近 10 个版本，你可以在场景页面把其中任何一个保存到这台电脑。',
  'tour.controls.how':
    '在工作室打开场景的“调整”标签页。场景的各个版本在图库中它的页面上。',
  'tour.controls.open': '打开“可视化”',
  'tour.controls.imageAlt':
    '“调整”标签页：两个调色板，以及在晴、雨、雪之间切换的天气选项，选雪时才出现降雪滑块；旁边是场景页面，显示大小、版本和保留的版本。',
  'tour.controls.weather': '天气',
  'tour.controls.clear': '晴',
  'tour.controls.rain': '雨',
  'tour.controls.snow': '雪',
  'tour.controls.glow': '月光',
  'tour.controls.snowfall': '降雪',

  'tour.camera.kicker': '可视化',
  'tour.camera.title': '在场景中穿梭，在图表上，也在桌面上',
  'tour.camera.subtitle': '你自己的镜头键，以及响应鼠标的桌面',
  'tour.camera.lead':
    '选择移动 3D 场景镜头的按键——Ctrl、Alt、Shift 或任意键——以及是按住拖动，还是按住移动即可。',
  'tour.camera.point1':
    '打开“跟随鼠标”，场景会朝指针倾斜；也可以让它“自动环绕”。“重置视角”只在按住按键时出现。',
  'tour.camera.point2':
    '桌面上的可视化会响应空白桌面上的鼠标，每台显示器有自己的时间，工作室会把你最新的版本放到桌面上。',
  'tour.camera.point3':
    '节拍闪光落在底鼓上，没有播放时图库预览会随演示歌曲动起来，出错的场景会播放最后一个能用的版本，而不是素色外观。',
  'tour.camera.how': '镜头设置在图表的“视图”菜单中，场景下方。',
  'tour.camera.open': '打开均衡器',
  'tour.camera.imageAlt':
    '两台显示器，每个桌面上都有可视化：第一台上场景朝指针倾斜，按住 Ctrl 时出现“重置视角”；每台都有自己的时间；下方是镜头设置。',

  'tour.v24.also': '2.4 的其他更新',
  'tour.v24.heroes':
    'Heroes of the Storm 有了更饱满的专属混音，可选宽舞台；游戏滤镜在突出提示音的同时让音乐更平稳。',
  'tour.v24.graphSettings': '图表为标准样式和可视化分别保存设置。',
  'tour.v24.colourful': '多彩模式采用图表上场景的颜色。',
  'tour.v24.gallery': '图库打开时显示最新的场景。',
  'tour.v24.credits': '在浏览器里购买的积分会自动到账。',
  'tour.v24.sponsors':
    '可以在“关于”或支持页面通过 GitHub Sponsors 支持 FluidEQ。',
  'tour.v24.crashes':
    '万一 FluidEQ 崩溃，记录只保存在这台电脑上，供你自己决定是否发送的错误报告使用。',
  'tour.visualsTitle': '可视化新功能',
  'tour.rail.alwaysVisuals': '可视化还有',
  'visuals.news.open': '新功能',
  'visuals.news.blurb': '可视化、工作室和灯光',
  'visuals.news.title': '可视化 {version} 新功能',
  'visuals.news.see': '查看新功能',
  'visuals.news.later': '以后再说',

  'tour.level.kicker': 'DSP 预设',
  'tour.level.title': '按歌曲本身音量播放的预设',
  'tour.level.subtitle': '不再突然变响，音量保持稳定',
  'tour.level.lead':
    '出厂 DSP 预设不再在各级处理之前统一歌曲音量：每一级都按音乐到来的原样处理，由最大化器加上固定增益并压住峰值。',
  'tour.level.point1':
    '从播放时会调整增益的预设切换走后，这份提升不会再带到接下来的声音里。',
  'tour.level.point2': '暂停后不会突然变响：静音之后，歌曲以自己的音量回来。',
  'tour.level.point3':
    '均衡器前级的自动归一化在 Windows 重新打开输出时会保持音量，而不是从头开始。',
  'tour.level.how':
    '已有的效果链会保留原有设置，直到你在 DSP 页面重新选择它的出厂预设。',
  'tour.level.open': '打开 DSP',

  'tour.edit.kicker': '工作室 · 编辑模式',
  'tour.edit.title': '亲手移动场景里的东西',
  'tour.edit.subtitle': '一切先锁定，直到你解锁；不按保存，什么都不会留下',
  'tour.edit.lead':
    '在舞台上按“编辑”，选中 3D 场景里的任何东西：形状、灯光、3D 模型或组。一切都从锁定开始，不会被误动；在它的锁上按一下就能解锁。',
  'tour.edit.point1':
    '用控制柄移动、旋转或缩放它，“吸附”让它按四分之一步和 15° 转动。按住空格可以移动画布；编辑模式在舞台的每种视图里都保持打开，包括“超宽图表”和“迷你播放器”。',
  'tour.edit.point2':
    '所有东西都在一个列表里，可以搜索、重命名、编组、锁定、单独显示和隐藏。单独显示和隐藏只用于制作，从不改变听众看到的场景，而且即使在组里也会标出单独显示。',
  'tour.edit.point3':
    '按“保存”之前，场景不会有任何改变。“放弃”丢掉改动，撤销和重做可以来回查看。',
  'tour.edit.how': '在工作室打开一个 3D 场景，在它的舞台上按“编辑”。',
  'tour.edit.open': '打开“可视化”',
  'tour.edit.imageAlt':
    '工作室舞台上的一个场景：选中了一个形状，它的锁已打开、控制柄露出，上方是移动、旋转和大小工具，旁边的列表里其他东西都已锁定，只显示选中的形状。',
  'tour.watch.kicker': '工作室 · 你的 AI',
  'tour.watch.title': '会看场景动起来的 AI',
  'tour.watch.subtitle': '随音乐的画面、三种视图、整首歌',
  'tour.watch.lead':
    '你的 AI 不再凭一张图判断场景。它会看场景怎么动，并按听众看到的样子检查。',
  'tour.watch.point1': '沿着音乐取几帧并排放，看清东西往哪边动、动得是否均匀。',
  'tour.watch.point2':
    '同一时刻的普通图表、超宽图表和紧凑播放器的整列，确保没有被裁掉或留黑。',
  'tour.watch.point3':
    '测试歌曲的六个时刻，从静音到高潮，检查高潮是否看得出来，以及日光为 0 时夜晚有多暗。',
  'tour.watch.how': '在场景的聊天里提出修改。它每次都这样检查自己的成果。',
  'tour.watch.open': '打开“可视化”',
  'tour.watch.imageAlt':
    '一个场景随音乐的五帧画面及其运动方式，场景在普通、超宽和紧凑播放器视图中的样子，以及测试歌曲从静音到高潮的六个时刻。',
  'tour.watch.frames': '随音乐的画面',
  'tour.watch.moves': '向右移动，均匀',
  'tour.watch.standard': '普通',
  'tour.watch.song': '用歌曲检查',
  'tour.watch.silence': '静音',
  'tour.watch.verse': '主歌',
  'tour.watch.build': '铺垫',
  'tour.watch.drop': '高潮',
  'tour.watch.dropShows': '高潮看得出来',
  'tour.watch.night': '夜晚：亮度 {value}%',
  'tour.makers.kicker': '工作室 · 图片',
  'tour.makers.title': '现已集成 Higgsfield',
  'tour.makers.subtitle': '为你的场景生成图片和动画',
  'tour.makers.lead': '工作室的 AI 通过 Higgsfield 为你的场景生成图片和动画。',
  'tour.makers.point1':
    '它使用你自己的 Higgsfield 账号，只需在聊天的“账号”中设置一次。',
  'tour.makers.point2': '生成任何内容之前，它会告诉你费用，并先征求你的同意。',
  'tour.makers.point3': '它生成的视频会成为场景中的动画。',
  'tour.makers.how': '在工作室打开一个场景的聊天，按“账号”。',
  'tour.makers.open': '打开“可视化”',
  'tour.makers.imageAlt':
    '场景聊天在生成动画之前请你允许 Higgsfield，旁边是列有 Claude 和 Higgsfield 的账号列表。',
  'tour.makers.request': '把锦鲤做成游动的动画',
  'tour.code.kicker': '工作室 · 代码',
  'tour.code.title': '在“代码”标签页查看场景的每个文件',
  'tour.code.subtitle': '着色器、世界、材质、动画，以及可编辑的笔记',
  'tour.code.lead':
    '“代码”标签页显示整个场景，而不只是着色器：它的包、3D 世界及其引用的材质、动画，以及笔记。笔记在两个简单的输入框里编辑，按“保存”留下。',
  'tour.code.point1': '每个文件都能折叠成名称和行数，“全部展开”一次全部打开。',
  'tour.code.point2': '它随 AI 保存实时跟进文件，“查看改动”会标出改了哪里。',
  'tour.code.point3':
    'AI 当作普通图片打包的一张帧图，会变成“动画”标签页里真正的动画。',
  'tour.code.how': '在工作室打开一个场景，在舞台下方选择“代码”。',
  'tour.code.open': '打开“可视化”',
  'tour.code.imageAlt':
    '“代码”标签页，场景的文件折叠成名称，其 3D 世界的一个材质处于展开状态。',
  'tour.fullscreen.kicker': '工作室 · 全屏',
  'tour.fullscreen.title': '在全屏下制作场景',
  'tour.fullscreen.subtitle': '工作面板和聊天，叠在正在播放的场景上',
  'tour.fullscreen.lead':
    '全屏时场景铺满整个屏幕并继续播放，工作室也随之而来：工作面板从下方升起，聊天停靠在一侧。',
  'tour.fullscreen.point1':
    '工作面板里有所有标签页，调整、代码等等。拖动它的上边缘即可调高或调低。',
  'tour.fullscreen.point2':
    '两者都可以用全屏控件上各自的按钮打开或收起，也可以用 Ctrl+J 切换工作面板、Ctrl+L 切换聊天。',
  'tour.fullscreen.point3':
    '收起的聊天会在屏幕边缘留下一个标签，下次全屏会按你离开时的样子打开。',
  'tour.fullscreen.how': '在工作室中打开一个场景，在舞台上按“全屏”。',
  'tour.fullscreen.open': '打开“可视化”',
  'tour.fullscreen.imageAlt':
    '一个铺满全屏播放的场景，下方打开着停在“调整”标签页的工作面板，右侧停靠着场景的聊天。',
  'tour.fullscreen.request': '让极光在 drop 时更亮',
  'tour.v25.also': '2.5 的其他更新',
  'tour.v25.recover':
    '桌面背景或紧凑播放器会用你的工作室项目或图库的副本修好无法构建的场景。',
  'tour.v25.never':
    '无法播放的场景绝不会被换成别的外观：图表会说明原因并提供“重试”。',
  'tour.v25.painted':
    '在绘制的场景里，用来向 AI 指出位置的图钉和方框可以手动移动：随意拖动，拉动方框的角和边来调整大小，用它的按钮或 Delete 键删除。',
  'tour.v25.copy':
    '在工作室打开的其他成员的场景是锁定的副本，它的聊天会在每条命令前询问。',
  'tour.v25.review': '未通过审核的场景会在名称旁显示审核者的理由。',
  'tour.v25.publish': '发布不再有每月上限。',
  'tour.signed.kicker': 'FLUIDEQ 2.5',
  'tour.signed.title': '现已签名，免费！',
  'tour.signed.subtitle': '一路走来，以及为所有人签名的 FluidEQ',
  'tour.signed.today':
    '如今，它是电脑上一切声音的均衡器，是你的音乐播放器，也是随音乐律动的可视化效果。',
  'tour.signed.liveFor': 'FluidEQ 已经运行',
  'tour.signed.since': '始于 {date}',
  'tour.signed.roadTitle': '一路走来',
  'tour.signed.intro':
    'FluidEQ 始于 2026年8月2日，两天后发布了第一个版本 0.4.0。从那以后，它有了在 Windows 内运行、属于它自己的音频引擎，处理你听到的一切声音的 DSP 机架，用于你的音乐的媒体库和播放器，带图库的可视化效果，用来制作自己场景的工作室，以及十二种语言。由开发者签名的版本，是这段路上的一个里程碑。',
  'tour.signed.thanks':
    '感谢每一位使用 FluidEQ、反馈问题、发布场景和在论坛发言的人：是你们每一个人让它变得更好。',
  'tour.signed.signedTitle': '由开发者签名',
  'tour.signed.signedBody':
    '运行安装程序时，Windows 会显示发布者：{publisher}。',
  'tour.signed.updatesTitle': '持续自动更新',
  'tour.signed.updatesBody':
    '每个新版本都会自动送达，准备好后 FluidEQ 会告诉你。你的设置会保留。',
  'tour.signed.freeTitle': '人人免费',
  'tour.signed.freeBody':
    'FluidEQ 本身免费，人人都是同一个应用。“可视化”图库里的场景由它们的作者出售。',
  'tour.signed.unit.day.one': '天',
  'tour.signed.unit.day.few': '天',
  'tour.signed.unit.day.many': '天',
  'tour.signed.unit.day.other': '天',
  'tour.signed.unit.hour.one': '小时',
  'tour.signed.unit.hour.few': '小时',
  'tour.signed.unit.hour.many': '小时',
  'tour.signed.unit.hour.other': '小时',
  'tour.signed.unit.minute.one': '分钟',
  'tour.signed.unit.minute.few': '分钟',
  'tour.signed.unit.minute.many': '分钟',
  'tour.signed.unit.minute.other': '分钟',
  'tour.signed.unit.second.one': '秒',
  'tour.signed.unit.second.few': '秒',
  'tour.signed.unit.second.many': '秒',
  'tour.signed.unit.second.other': '秒',
} as const;

export default tour24;
