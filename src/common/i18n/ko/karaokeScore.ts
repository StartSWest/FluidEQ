/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
import { Dictionary } from '../en';

const karaokeScore = {
  'karaoke.score.title': '점수',
  'karaoke.score.verdictPerfect': '퍼펙트',
  'karaoke.score.verdictGood': '좋음',
  'karaoke.score.verdictLate': '늦음',
  'karaoke.score.verdictLow': '낮음',
  'karaoke.score.verdictHigh': '높음',
  'karaoke.score.verdictMissed': '놓침',
  'karaoke.score.verdictSkipped': '채점 안 함',
  'karaoke.score.octaveMark': '{verdict} · 8va',
  'karaoke.score.ratingExcellent': '훌륭해요',
  'karaoke.score.ratingGreat': '아주 좋아요',
  'karaoke.score.ratingGood': '좋아요',
  'karaoke.score.ratingFair': '보통',
  'karaoke.score.ratingPractice': '연습 필요',
  'karaoke.score.lineNumber': '{number}번째 줄',
  'karaoke.score.lineWithText': '{line} “{text}”',
  'karaoke.score.practiseLine': '{line}: 다시 부르기',
  'karaoke.score.outOf': '/ {max}',
  'karaoke.score.streak': '연속',
  'karaoke.score.close': '결과 닫기',
  'karaoke.score.recapTitle': '요약',
  'karaoke.score.bestFirst': '이 곡의 첫 점수입니다',
  'karaoke.score.bestNew': '최고 기록 경신 · +{delta}',
  'karaoke.score.bestTied': '최고 기록과 같아요',
  'karaoke.score.bestBehind': '최고 기록까지 {delta}',
  'karaoke.score.inTune': '음정',
  'karaoke.score.inTuneNote': '음표 안에서 부른 시간의 비율',
  'karaoke.score.onTime': '타이밍',
  'karaoke.score.onTimeNote': '{total}개 중 {count}개 음표를 제때 시작했어요',
  'karaoke.score.notes': '음표',
  'karaoke.score.notesNote': '적중',
  'karaoke.score.hardestTitle': '가장 어려웠던 부분',
  'karaoke.score.hardestLow': '{line}: 약 {cents}센트 낮게 불렀어요.',
  'karaoke.score.hardestHigh': '{line}: 약 {cents}센트 높게 불렀어요.',
  'karaoke.score.hardestLate': '{line}: 음표에 늦게 들어갔어요.',
  'karaoke.score.hardestMissed': '{line}: 부르지 않은 음표가 있었어요.',
  'karaoke.score.hardestLowest': '{line}이(가) {percent}로 가장 낮았어요.',
  'karaoke.score.tipTitle': '다음을 위한 팁',
  'karaoke.score.tipLow':
    '부르기 전에 음을 조금 더 높게 떠올리고, 끝까지 호흡을 유지해 음이 처지지 않게 하세요.',
  'karaoke.score.tipHigh':
    '목의 힘을 빼고 조금 더 부드럽게 부르세요. 크게 내려고 밀어붙이면 음이 올라갑니다.',
  'karaoke.score.tipLate':
    '첫 단어가 아니라 줄이 시작되기 전에 숨을 쉬면 첫 음이 박자에 맞게 들어갑니다.',
  'karaoke.score.tipMissed':
    '부르지 못한 줄의 가사를 익히고, 크게 부르기 전에 음원에 맞춰 작게 따라 불러 보세요.',
  'karaoke.score.tipOctave':
    '많은 부분을 한 옥타브 차이로 불렀고, 그것도 인정됩니다. 음원과 맞추려면 몇 줄을 원곡의 옥타브로 불러 보세요.',
  'karaoke.score.tipClean':
    '처음부터 끝까지 깔끔했어요. 더 어려운 곡이나 멜로디 음을 끈 채로 이 곡에 도전해 보세요.',
  'karaoke.score.practisePassage': '그 구간 연습하기',
  'karaoke.score.singAgain': '다시 부르기',
  'karaoke.score.mapTitle': '곡 지도',
  'karaoke.score.mapSummary': '{points}점 · 음정 {inTune}',
  'karaoke.score.mapCanvas': '곡의 모든 음표를 판정 색으로 표시',
  'karaoke.score.deltaTitle': '최고 기록과 비교',
  'karaoke.score.historyTitle': '최근 도전',
  'karaoke.score.historyNow': '이번',
  'karaoke.score.historyBest': '최고',
  'karaoke.score.progressTitle': '나의 발전',
  'karaoke.score.progressFirst':
    '이 곡은 처음이에요. 이 점수가 넘어야 할 기록입니다.',
  'karaoke.score.progressSame': '모든 줄이 최고 기록 때와 같은 수준이었어요.',
  'karaoke.score.progressUp':
    '최고 기록 이후 가장 많이 좋아진 줄은 {line}이에요({delta}점).',
  'karaoke.score.progressDown':
    '{line}은(는) 최고 기록보다 떨어졌어요({delta}). 그 줄만 두세 번 연습한 뒤 곡 전체를 다시 불러 보세요.',
  'karaoke.score.progressUpDown':
    '최고 기록 이후 가장 많이 좋아진 줄은 {up}이에요({delta}점). {down}은(는) 떨어졌어요. 그 줄만 두세 번 연습한 뒤 곡 전체를 다시 불러 보세요.',
} satisfies Partial<Dictionary>;

export default karaokeScore;
