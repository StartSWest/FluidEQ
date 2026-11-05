/* FluidEQ — GPL-3.0-or-later */

export default {
  'genre.pop.hook': '做得最完整的唱片',
  'genre.pop.story':
    '现代流行乐以紧实的低音和明亮开阔的混音衬托清晰的主唱。歌曲先统一到 −18 LUFS，让响亮的母带和较轻的录音以相同电平进入处理。随后最大化器将结果提升至约 −11 LUFS，把峰值限制在 −1 dBTP，同时保留主歌、副歌和鼓点之间的强弱对比。',
  'genre.pop.pin.50': '流行乐赖以建立的超低音和底鼓',
  'genre.pop.pin.50.why': '感觉多于听见：小音箱最先丢掉的那份重量。',
  'genre.pop.pin.315': '遮住人声的箱体感',
  'genre.pop.pin.315.why': '削掉它，让主唱清楚地站在混音之上。',
  'genre.pop.pin.5000': '临场感与光泽',
  'genre.pop.pin.5000.why': '人声上的打磨，停在刺耳之前。',
  'genre.pop.stage.deEsser':
    '以5至10 kHz范围内最高1.5 dB的窄带频谱衰减，控制中央人声刺耳的S和SH音，保护镲片并保持低音不变。',
  'genre.pop.stage.exciter':
    '给人声少量厚度和温暖。高频段激励器保持关闭，保留录音原有的光泽。',
  'genre.pop.stage.bassPunch':
    '收紧而不是猛击：贝斯线下的底鼓尾音更短，起音只略微抬起。',
  'genre.pop.stage.dimension':
    '140 Hz 以下的低音为单声道，和流行乐母带的做法一样；空气感比唱片略宽一点。',
  'genre.pop.stage.maximizer':
    '输入响度统一后提升 7 dB，以约 −11 LUFS 为目标，峰值上限为 −1 dBTP。Master 保持关闭，只用一个最终限制器保留冲击力。',
  'genre.pop.off': '低音熔炉以“流行”的名义提供，但保持关闭：超低音已在母带里。',

  'genre.indiePop.hook': '比排行榜更轻、更暖',
  'genre.indiePop.story':
    '叮当作响的吉他和层层叠叠的和声围绕着居中的人声，90 到 130 BPM，常常故意录在磁带或卡带上。比排行榜流行更柔和，响度低约 1 dB，超低音也更少：温暖本身就是它的样子。',
  'genre.indiePop.pin.50': '不夸大低音',
  'genre.indiePop.pin.50.why': '保持平直：独立流行从来不是靠超低音搭起来的。',
  'genre.indiePop.pin.315': '去掉混音里的纸板味',
  'genre.indiePop.pin.315.why': '家庭录音里容易堆积的发闷中低频。',
  'genre.indiePop.pin.1250': '叮当声与和声',
  'genre.indiePop.pin.1250.why': '吉他鸣响、和声层叠的地方。',
  'genre.indiePop.pin.12500': '一点空气感',
  'genre.indiePop.pin.12500.why': '轻轻地，加在原本就柔和的高频上。',
  'genre.indiePop.stage.exciter': '只在中低频加温暖：绝不变亮。',
  'genre.indiePop.stage.dimension':
    '保持此曲风在各频段的立体声宽度平衡，不对中央人声添加去相关处理。',
  'genre.indiePop.stage.deEsser':
    '以5至10 kHz范围内最高1.5 dB的窄带频谱衰减，控制中央人声刺耳的S和SH音，保护镲片并保持低音不变。',
  'genre.indiePop.stage.maximizer':
    '将归一化后的输入提升至此曲风实测的聆听音量，峰值限制在 −1 dBTP。限制保持适度，以保留录音的动态；Master 和 Dynamics 保持关闭。',
  'genre.indiePop.off': '没有哪一环去提亮或加低音：低保真的温暖才是重点。',

  'genre.synthPop.hook': '鼓机、音序贝斯和带合唱效果的铺底',
  'genre.synthPop.story':
    'Linn 和 808 鼓机、音序器驱动的贝斯线，加上宽阔的合唱效果铺底，100 到 135 BPM。早期唱片偏薄偏亮；80 年代的母带保留了动态（动态范围 12 到 13），现代母带则没有。',
  'genre.synthPop.pin.125': '早期唱片缺少的厚度',
  'genre.synthPop.pin.125.why': '中低频的温暖，这类混音唯一欢迎的方向。',
  'genre.synthPop.pin.500': '给铺底留出空间',
  'genre.synthPop.pin.500.why': '清理合唱铺底和鼓机挤在一起的中频。',
  'genre.synthPop.pin.12500': '高频放松，而不是抬高',
  'genre.synthPop.pin.12500.why': '早期合成器流行本来就偏亮。',
  'genre.synthPop.stage.exciter': '只在中低频加温暖：不在明亮的高频上加谐波。',
  'genre.synthPop.stage.dimension':
    '保持此曲风在各频段的立体声宽度平衡，不对中央人声添加去相关处理。',
  'genre.synthPop.stage.deEsser':
    '以5至10 kHz范围内最高1.5 dB的窄带频谱衰减，控制中央人声刺耳的S和SH音，保护镲片并保持低音不变。',
  'genre.synthPop.stage.maximizer':
    '将归一化后的输入提升至此曲风实测的聆听音量，峰值限制在 −1 dBTP。限制保持适度，以保留录音的动态；Master 和 Dynamics 保持关闭。较慢的释放时间可避免跟随每个鼓点起伏。',
  'genre.synthPop.off':
    '不用低音冲击，也不用低音熔炉：鼓机的底鼓就该和编程时一模一样。',

  'genre.newWave.hook': '利落的节奏、切分的吉他和精瘦的低频',
  'genre.newWave.story':
    '110 到 160 BPM，快而跳跃：紧实的底鼓、有旋律的贝斯，以及明亮、切分的吉他，底下是精瘦的低频。原版母带留有余量（动态范围 14），再版大多把它丢了。',
  'genre.newWave.pin.125': '给偏薄的原版一点温暖',
  'genre.newWave.pin.125.why': '刚好够让贝斯线立得住的厚度。',
  'genre.newWave.pin.315': '去掉浑浊，让贝斯动起来',
  'genre.newWave.pin.315.why': '有旋律的贝斯需要一条干净的车道。',
  'genre.newWave.pin.1250': '切分的吉他',
  'genre.newWave.pin.1250.why': '节奏吉他的咬劲所在之处。',
  'genre.newWave.stage.exciter':
    '仅在中低频添加少许温暖感。三个谐波频段全部关闭，保持叠加人声清晰。',
  'genre.newWave.stage.dimension':
    '保持此曲风在各频段的立体声宽度平衡，不对中央人声添加去相关处理。',
  'genre.newWave.stage.deEsser':
    '以5至10 kHz范围内最高1.5 dB的窄带频谱衰减，控制中央人声刺耳的S和SH音，保护镲片并保持低音不变。',
  'genre.newWave.stage.maximizer':
    '将归一化后的输入提升至此曲风实测的聆听音量，峰值限制在 −1 dBTP。限制保持适度，以保留录音的动态；Master 和 Dynamics 保持关闭。较慢的释放时间可避免跟随每个鼓点起伏。',
  'genre.newWave.off':
    '不用低音冲击，也不用低音熔炉：精瘦的低频本来就是这么做的。',

  'genre.kPop.hook': '清晰人声、紧实低频与有力的高潮',
  'genre.kPop.story':
    'BTS 的 Dynamite 以迪斯科流行贝斯为特色，BLACKPINK 的 How You Like That 则有厚重的嘻哈段落。两首歌都需要清晰人声、分量和强弱对比。处理前将输入统一到 −18 LUFS。本聆听预设依据两首歌的 Apple 官方试听片段校准，未使用耳机补偿。',
  'genre.kPop.pin.80': '底鼓的冲击，不是超低音',
  'genre.kPop.pin.80.why': '底鼓落下的位置；50 Hz 以下什么都不抬。',
  'genre.kPop.pin.315': '在密集编曲下腾出空间',
  'genre.kPop.pin.315.why': '轻削中低频以分开密集层次，同时保留人声厚度。',
  'genre.kPop.pin.12500': '不额外加空气感',
  'genre.kPop.pin.12500.why': '不再额外提升高频，保留录音本来的空气感。',
  'genre.kPop.stage.deEsser':
    '对中央人声的 5–10 kHz 进行温和的频谱去齿音，最多衰减 1.5 dB，保护镲片且不削减低频。',
  'genre.kPop.stage.exciter':
    '仅在中低频添加少许温暖感。三个谐波频段全部关闭，保持叠加人声清晰。',
  'genre.kPop.stage.dimension':
    '收窄低频，略微展开录音已有的高频侧声道，不扩散中央主唱。',
  'genre.kPop.stage.maximizer':
    '输入归一化至 −18 LUFS 后提升 7 dB，目标约为 −11 LUFS，峰值限制在 −1 dBTP。Dynamics 和 Master 保持关闭。',
  'genre.kPop.off':
    '不用低音冲击，也不用低音熔炉：底鼓的冲击和超低音，唱片里都已经有了。',

  'genre.jPop.hook': '任何速度下都密实明亮的声墙',
  'genre.jPop.story':
    '从 90 BPM 以下的抒情曲，到 150 到 200 甚至更快的乐队、偶像和动漫歌曲，忙碌的贝斯和失真吉他组成一堵又密又宽的墙。母带送来时已削波，峰值高达 +2.3 dBTP。',
  'genre.jPop.pin.125': '中低频一点点温暖',
  'genre.jPop.pin.125.why': '这类混音唯一能好好接受的方向。',
  'genre.jPop.pin.500': '让这堵墙透口气',
  'genre.jPop.pin.500.why': '从拥挤的中频里稍微拿掉一点。',
  'genre.jPop.pin.3150': '中高频保持不动',
  'genre.jPop.pin.3150.why': '已经又亮又靠前，从不再推。',
  'genre.jPop.stage.exciter': '只在中低频加温暖：这么亮的高频上什么都不加。',
  'genre.jPop.stage.dimension':
    '保持此曲风在各频段的立体声宽度平衡，不对中央人声添加去相关处理。',
  'genre.jPop.stage.deEsser':
    '以5至10 kHz范围内最高1.5 dB的窄带频谱衰减，控制中央人声刺耳的S和SH音，保护镲片并保持低音不变。',
  'genre.jPop.stage.maximizer':
    '将归一化后的输入提升至此曲风实测的聆听音量，峰值限制在 −1 dBTP。限制保持适度，以保留录音的动态；Master 和 Dynamics 保持关闭。',
  'genre.jPop.off': '不用低音冲击，也不用低音熔炉：这堵墙送来时就又密又响。',

  'genre.cPop.hook': '抒情歌，人声在前方正中',
  'genre.cPop.story':
    '60 到 90 BPM 的抒情歌和 95 到 120 左右的流行，钢琴和弦乐托着靠前的人声，温暖而顺滑。普通话尖锐的辅音需要的是齿音消除，而不是激励。',
  'genre.cPop.pin.125': '温暖的抒情厚度',
  'genre.cPop.pin.125.why': '经典华语流行里那种调音台的温暖。',
  'genre.cPop.pin.1250': '顺滑，不带鼻音',
  'genre.cPop.pin.1250.why': '稍微收一点，让人声保持柔和。',
  'genre.cPop.pin.12500': '轻柔的空气感',
  'genre.cPop.pin.12500.why': '在辅音之上轻轻抬一点，而不是抬在辅音上。',
  'genre.cPop.stage.exciter': '只加温暖：不在齿音上加谐波。',
  'genre.cPop.stage.dimension':
    '保持此曲风在各频段的立体声宽度平衡，不对中央人声添加去相关处理。',
  'genre.cPop.stage.deEsser':
    '以5至10 kHz范围内最高1.5 dB的窄带频谱衰减，控制中央人声刺耳的S和SH音，保护镲片并保持低音不变。',
  'genre.cPop.stage.maximizer':
    '将归一化后的输入提升至此曲风实测的聆听音量，峰值限制在 −1 dBTP。限制保持适度，以保留录音的动态；Master 和 Dynamics 保持关闭。较慢的释放时间可避免跟随每个鼓点起伏。',
  'genre.cPop.off':
    '不用低音冲击，也不用低音熔炉：钢琴抒情歌底下不凭空造超低音。',

  'genre.ballad.hook': '慢歌，人声高于一切',
  'genre.ballad.story':
    '每个曲库里都有的慢歌，流行、摇滚、灵魂乐和拉丁乐都一样，多在 60 到 85 BPM：《Someone Like You》是 67.5，《November Rain》是 84。主唱最先混，压在一切之上，贴近并加上长长的板式或大厅混响，下面是钢琴、弦乐或收着的乐队；母带比同一张专辑的单曲保留更多动态。',
  'genre.ballad.pin.125': '人声与钢琴的温暖',
  'genre.ballad.pin.125.why': '在抒情歌人声和钢琴温暖的地方，稍添一点厚度。',
  'genre.ballad.pin.500': '减少浑浊',
  'genre.ballad.pin.500.why':
    '钢琴和贴近的人声堆积的中低频，压低一些，让歌词保持清楚。',
  'genre.ballad.pin.3150': '临场感',
  'genre.ballad.pin.3150.why': '在听得清歌词的地方，把人声稍往前推。',
  'genre.ballad.pin.8000': '齿音收敛，不提亮',
  'genre.ballad.pin.8000.why': '贴近的人声把齿音放在这里，一提升每个都会变尖。',
  'genre.ballad.stage.dimension':
    '保持此曲风在各频段的立体声宽度平衡，不对中央人声添加去相关处理。',
  'genre.ballad.stage.deEsser':
    '以5至10 kHz范围内最高1.5 dB的窄带频谱衰减，控制中央人声刺耳的S和SH音，保护镲片并保持低音不变。',
  'genre.ballad.stage.maximizer':
    '将归一化后的输入提升至此曲风实测的聆听音量，峰值限制在 −1 dBTP。限制保持适度，以保留录音的动态；Master 和 Dynamics 保持关闭。较慢的释放时间可避免跟随每个鼓点起伏。',
  'genre.ballad.off':
    '不用激励器、低音熔炉和低音冲击：谐波会落在齿音上，抒情歌只有制作人放了超低音的地方才有，也很少有需要塑形的底鼓。',
};
