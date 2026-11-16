/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
import { Dictionary } from '../en';

const karaokeScore = {
  'karaoke.score.title': '得分',
  'karaoke.score.verdictPerfect': '完美',
  'karaoke.score.verdictGood': '不錯',
  'karaoke.score.verdictLate': '偏晚',
  'karaoke.score.verdictLow': '偏低',
  'karaoke.score.verdictHigh': '偏高',
  'karaoke.score.verdictMissed': '漏唱',
  'karaoke.score.verdictSkipped': '未評分',
  'karaoke.score.octaveMark': '{verdict} · 8va',
  'karaoke.score.ratingExcellent': '出色',
  'karaoke.score.ratingGreat': '很好',
  'karaoke.score.ratingGood': '良好',
  'karaoke.score.ratingFair': '普通',
  'karaoke.score.ratingPractice': '還需練習',
  'karaoke.score.lineNumber': '第 {number} 行',
  'karaoke.score.lineWithText': '{line}「{text}」',
  'karaoke.score.practiseLine': '{line}：再唱一次',
  'karaoke.score.outOf': '/ {max}',
  'karaoke.score.streak': '連擊',
  'karaoke.score.openReport': '查看結果',
  'karaoke.score.close': '關閉結果',
  'karaoke.score.recapTitle': '總結',
  'karaoke.score.bestFirst': '您在這首歌的第一個成績',
  'karaoke.score.bestNew': '新紀錄 · +{delta}',
  'karaoke.score.bestTied': '與您的紀錄持平',
  'karaoke.score.bestBehind': '距您的紀錄還差 {delta}',
  'karaoke.score.inTune': '音準',
  'karaoke.score.inTuneNote': '在音符內演唱的時間比例',
  'karaoke.score.onTime': '節奏',
  'karaoke.score.onTimeNote': '{total} 個音符中有 {count} 個準時進入',
  'karaoke.score.notes': '音符',
  'karaoke.score.notesNote': '命中',
  'karaoke.score.hardestTitle': '最難的地方',
  'karaoke.score.hardestLow': '{line}：您大約低了 {cents} 音分。',
  'karaoke.score.hardestHigh': '{line}：您大約高了 {cents} 音分。',
  'karaoke.score.hardestLate': '{line}：您進入音符的時間偏晚。',
  'karaoke.score.hardestMissed': '{line}：有些音符沒有唱出來。',
  'karaoke.score.hardestLowest': '{line}得分最低，為 {percent}。',
  'karaoke.score.tipTitle': '下次可以試試',
  'karaoke.score.tipLow':
    '唱之前把音想得稍高一點，並把氣息維持到最後，別讓它往下掉。',
  'karaoke.score.tipHigh':
    '放鬆喉嚨，唱得稍輕一些：為了音量而用力，正是讓音偏高的原因。',
  'karaoke.score.tipLate':
    '在這一行開始之前換氣，而不是在第一個字上，這樣第一個音就能踩在拍子上。',
  'karaoke.score.tipMissed':
    '先記熟沒唱出來的那幾行歌詞，跟著原唱輕聲唱幾遍，再放開聲音。',
  'karaoke.score.tipOctave':
    '您有很多地方唱在相差一個八度的位置，這同樣算數。想和原唱一致，可以試著用原曲的八度唱幾行。',
  'karaoke.score.tipClean':
    '從頭到尾都唱得很乾淨。試試更難的歌，或者關掉旋律音再唱這首。',
  'karaoke.score.practisePassage': '練習那一段',
  'karaoke.score.singAgain': '再唱一次',
  'karaoke.score.mapTitle': '歌曲地圖',
  'karaoke.score.mapSummary': '{points} 分 · 音準 {inTune}',
  'karaoke.score.mapCanvas': '歌曲的每個音符，依評判結果著色',
  'karaoke.score.deltaTitle': '與您的最佳成績相比',
  'karaoke.score.historyTitle': '最近幾次演唱',
  'karaoke.score.historyNow': '本次',
  'karaoke.score.historyBest': '最佳',
  'karaoke.score.progressTitle': '您的進步',
  'karaoke.score.progressFirst': '這是您第一次唱這首歌：這就是要超越的成績。',
  'karaoke.score.progressSame': '每一行都和您的最佳成績持平。',
  'karaoke.score.progressUp':
    '與最佳成績相比，進步最大的是{line}（{delta} 分）。',
  'karaoke.score.progressDown':
    '{line}比您的最佳成績有所下降（{delta}）。先單獨練兩三遍，再完整唱一遍。',
  'karaoke.score.progressUpDown':
    '與最佳成績相比，進步最大的是{up}（{delta} 分）。{down}有所下降：先單獨練兩三遍，再完整唱一遍。',
} satisfies Partial<Dictionary>;

export default karaokeScore;
