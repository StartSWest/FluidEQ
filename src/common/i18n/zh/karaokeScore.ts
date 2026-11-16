/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
import { Dictionary } from '../en';

const karaokeScore: Partial<Dictionary> = {
  'karaoke.score.title': '得分',
  'karaoke.score.verdictPerfect': '完美',
  'karaoke.score.verdictGood': '不错',
  'karaoke.score.verdictLate': '偏晚',
  'karaoke.score.verdictLow': '偏低',
  'karaoke.score.verdictHigh': '偏高',
  'karaoke.score.verdictMissed': '漏唱',
  'karaoke.score.verdictSkipped': '未评分',
  'karaoke.score.octaveMark': '{verdict} · 8va',
  'karaoke.score.ratingExcellent': '出色',
  'karaoke.score.ratingGreat': '很好',
  'karaoke.score.ratingGood': '良好',
  'karaoke.score.ratingFair': '一般',
  'karaoke.score.ratingPractice': '还需练习',
  'karaoke.score.lineNumber': '第 {number} 行',
  'karaoke.score.lineWithText': '{line}“{text}”',
  'karaoke.score.practiseLine': '{line}：再唱一遍',
  'karaoke.score.outOf': '/ {max}',
  'karaoke.score.streak': '连击',
  'karaoke.score.close': '关闭结果',
  'karaoke.score.recapTitle': '总结',
  'karaoke.score.bestFirst': '你在这首歌上的第一个成绩',
  'karaoke.score.bestNew': '新纪录 · +{delta}',
  'karaoke.score.bestTied': '与你的纪录持平',
  'karaoke.score.bestBehind': '距你的纪录还差 {delta}',
  'karaoke.score.inTune': '音准',
  'karaoke.score.inTuneNote': '在音符内演唱的时间占比',
  'karaoke.score.onTime': '节奏',
  'karaoke.score.onTimeNote': '{total} 个音符中有 {count} 个准时进入',
  'karaoke.score.notes': '音符',
  'karaoke.score.notesNote': '命中',
  'karaoke.score.hardestTitle': '最难的地方',
  'karaoke.score.hardestLow': '{line}：你大约低了 {cents} 音分。',
  'karaoke.score.hardestHigh': '{line}：你大约高了 {cents} 音分。',
  'karaoke.score.hardestLate': '{line}：你进入音符的时间偏晚。',
  'karaoke.score.hardestMissed': '{line}：有些音符没有唱出来。',
  'karaoke.score.hardestLowest': '{line}得分最低，为 {percent}。',
  'karaoke.score.tipTitle': '下次可以试试',
  'karaoke.score.tipLow':
    '唱之前把音想得稍高一点，并把气息保持到最后，别让它往下掉。',
  'karaoke.score.tipHigh':
    '放松喉咙，唱得稍轻一些：为了音量而用力，正是让音偏高的原因。',
  'karaoke.score.tipLate':
    '在这一行开始之前换气，而不是在第一个字上，这样第一个音就能踩在拍子上。',
  'karaoke.score.tipMissed':
    '先记熟没唱出来的那几行歌词，跟着原唱轻声唱几遍，再放开声音。',
  'karaoke.score.tipOctave':
    '你有很多地方唱在相差一个八度的位置，这同样算数。想和原唱一致，可以试着用原曲的八度唱几行。',
  'karaoke.score.tipClean':
    '从头到尾都唱得很干净。试试更难的歌，或者关掉旋律音再唱这首。',
  'karaoke.score.practisePassage': '练习那一段',
  'karaoke.score.singAgain': '再唱一遍',
  'karaoke.score.mapTitle': '歌曲地图',
  'karaoke.score.mapSummary': '{points} 分 · 音准 {inTune}',
  'karaoke.score.mapCanvas': '歌曲的每个音符，按评判结果着色',
  'karaoke.score.deltaTitle': '与你的最佳成绩相比',
  'karaoke.score.historyTitle': '最近几次演唱',
  'karaoke.score.historyNow': '本次',
  'karaoke.score.historyBest': '最佳',
  'karaoke.score.progressTitle': '你的进步',
  'karaoke.score.progressFirst': '这是你第一次唱这首歌：这就是要超越的成绩。',
  'karaoke.score.progressSame': '每一行都和你的最佳成绩持平。',
  'karaoke.score.progressUp':
    '与最佳成绩相比，进步最大的是{line}（{delta} 分）。',
  'karaoke.score.progressDown':
    '{line}比你的最佳成绩有所下降（{delta}）。先单独练两三遍，再完整唱一遍。',
  'karaoke.score.progressUpDown':
    '与最佳成绩相比，进步最大的是{up}（{delta} 分）。{down}有所下降：先单独练两三遍，再完整唱一遍。',
};

export default karaokeScore;
