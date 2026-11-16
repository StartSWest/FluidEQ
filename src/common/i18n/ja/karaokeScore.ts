/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
import { Dictionary } from '../en';

const karaokeScore: Partial<Dictionary> = {
  'karaoke.score.title': 'スコア',
  'karaoke.score.verdictPerfect': 'パーフェクト',
  'karaoke.score.verdictGood': 'グッド',
  'karaoke.score.verdictLate': '遅れ',
  'karaoke.score.verdictLow': '低め',
  'karaoke.score.verdictHigh': '高め',
  'karaoke.score.verdictMissed': 'ミス',
  'karaoke.score.verdictSkipped': '採点なし',
  'karaoke.score.octaveMark': '{verdict}・8va',
  'karaoke.score.ratingExcellent': 'すばらしい',
  'karaoke.score.ratingGreat': 'とても良い',
  'karaoke.score.ratingGood': '良い',
  'karaoke.score.ratingFair': 'まずまず',
  'karaoke.score.ratingPractice': '要練習',
  'karaoke.score.lineNumber': '{number}行目',
  'karaoke.score.lineWithText': '{line}「{text}」',
  'karaoke.score.practiseLine': '{line}：もう一度歌う',
  'karaoke.score.outOf': '/ {max}',
  'karaoke.score.streak': '連続',
  'karaoke.score.close': '結果を閉じる',
  'karaoke.score.recapTitle': 'まとめ',
  'karaoke.score.bestFirst': 'この曲での初めてのスコアです',
  'karaoke.score.bestNew': '自己ベスト更新 · +{delta}',
  'karaoke.score.bestTied': '自己ベストと同点',
  'karaoke.score.bestBehind': '自己ベストまであと {delta}',
  'karaoke.score.inTune': '音程',
  'karaoke.score.inTuneNote': '音符の中で歌えた時間の割合',
  'karaoke.score.onTime': 'タイミング',
  'karaoke.score.onTimeNote': '{total} 音中 {count} 音が時間どおりに入りました',
  'karaoke.score.notes': '音符',
  'karaoke.score.notesNote': '的中',
  'karaoke.score.hardestTitle': 'いちばん難しかったところ',
  'karaoke.score.hardestLow': '{line}：約 {cents} セント低めでした。',
  'karaoke.score.hardestHigh': '{line}：約 {cents} セント高めでした。',
  'karaoke.score.hardestLate': '{line}：音符への入りが遅れました。',
  'karaoke.score.hardestMissed': '{line}：歌われなかった音符がありました。',
  'karaoke.score.hardestLowest': '{line}がいちばん低く、{percent} でした。',
  'karaoke.score.tipTitle': '次回へのヒント',
  'karaoke.score.tipLow':
    '歌う前に音を少し高めにイメージし、最後まで息を保って音が下がらないようにしましょう。',
  'karaoke.score.tipHigh':
    'のどの力を抜いて少し柔らかく歌いましょう。声量を出そうと押すと音が上ずります。',
  'karaoke.score.tipLate':
    '最初の言葉ではなく行の前で息を吸うと、最初の音が拍どおりに入ります。',
  'karaoke.score.tipMissed':
    '歌えなかった行の歌詞を覚え、全力で歌う前に音源に合わせて小さく歌ってみましょう。',
  'karaoke.score.tipOctave':
    '多くを1オクターブ違いで歌いましたが、それも正解です。音源に合わせるなら、いくつかの行を原曲のオクターブで試してみましょう。',
  'karaoke.score.tipClean':
    '最初から最後まできれいに歌えました。もっと難しい曲か、メロディ音をオフにしてこの曲に挑戦しましょう。',
  'karaoke.score.practisePassage': 'その部分を練習',
  'karaoke.score.singAgain': 'もう一度歌う',
  'karaoke.score.mapTitle': '曲のマップ',
  'karaoke.score.mapSummary': '{points} 点 · 音程 {inTune}',
  'karaoke.score.mapCanvas': '曲のすべての音符を判定の色で表示',
  'karaoke.score.deltaTitle': '自己ベストとの比較',
  'karaoke.score.historyTitle': '最近の挑戦',
  'karaoke.score.historyNow': '今回',
  'karaoke.score.historyBest': 'ベスト',
  'karaoke.score.progressTitle': '上達の記録',
  'karaoke.score.progressFirst':
    'この曲は今回が初めてです。このスコアが次の目標です。',
  'karaoke.score.progressSame': 'どの行も自己ベストと同じ水準でした。',
  'karaoke.score.progressUp':
    '自己ベストからいちばん伸びたのは{line}です（{delta} 点）。',
  'karaoke.score.progressDown':
    '{line}は自己ベストより下がりました（{delta}）。その行だけを2〜3回練習してから、曲全体をもう一度歌いましょう。',
  'karaoke.score.progressUpDown':
    '自己ベストからいちばん伸びたのは{up}です（{delta} 点）。{down}は下がりました。その行だけを2〜3回練習してから、曲全体をもう一度歌いましょう。',
};

export default karaokeScore;
