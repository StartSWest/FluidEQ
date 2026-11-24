/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.key.now': '현재 밴드',
  'dsp.dynamics.key.lifted': '올림',
  'dsp.dynamics.key.held': '붙잡음',
  'dsp.dynamics.untouched': '그대로',
  'dsp.dynamics.dragHint':
    '점을 드래그하세요: 빈 점은 밴드가 시작하는 곳, 채워진 점은 세기입니다.',
  'dsp.dynamics.idleHint':
    '재생 중인 소리가 없습니다. 소리가 들어오면 각 밴드의 점이 곡선을 따라 움직입니다.',
  'dsp.dynamics.state.lifting': '올리는 중',
  'dsp.dynamics.state.holding': '붙잡는 중',
  'dsp.dynamics.state.silent': '소리 없음',
  'dsp.dynamics.bands': '밴드',
  'dsp.dynamics.axisIn': '입력',
  'dsp.dynamics.axisOut': '출력',
  'dsp.dynamics.table.starts': '시작',
  'dsp.dynamics.table.atMost': '최대',
  'dsp.dynamics.table.liftUnder': '이 아래 올리기',
  'dsp.dynamics.table.holdOver': '이 위 붙잡기',
  'dsp.dynamics.point.liftStart': '올리기가 시작되는 곳',
  'dsp.dynamics.point.liftTop': '올리기의 양',
  'dsp.dynamics.point.liftPull': '올리기 꺼내기',
  'dsp.dynamics.point.holdStart': '붙잡기가 시작되는 곳',
  'dsp.dynamics.point.holdEnd': '붙잡기의 세기',
  'dsp.dynamics.engineLiveOld':
    'Dynamics의 실시간 움직임을 보려면 엔진을 업데이트하세요. 소리는 이미 처리되고 있습니다.',
  'dsp.dynamics.title': '다이내믹스',
  'dsp.dynamics.description':
    '작은 소리는 올리고 큰 소리는 붙잡습니다. 세 개의 대역에서 작동해 속삭임과 폭발이 중간에서 만납니다. 지연은 더하지 않습니다.',
  'dsp.dynamics.engineOld':
    '다이내믹스에는 최신 FluidEQ Engine이 필요합니다. 랙의 나머지는 재생 중이며, 엔진을 업데이트하면 이 필터가 시작됩니다.',
  'dsp.dynamics.graphLabel': '각 대역이 레벨에 하는 일',
  'dsp.dynamics.band.low': '저역',
  'dsp.dynamics.band.lowRange': '150 Hz 미만',
  'dsp.dynamics.band.lowHint': '150 Hz 미만: 폭발의 울림, 킥, 엔진.',
  'dsp.dynamics.band.mid': '중역',
  'dsp.dynamics.band.midRange': '150 Hz~4 kHz',
  'dsp.dynamics.band.midHint': '150 Hz~4 kHz: 목소리, 발소리, 대부분의 소리.',
  'dsp.dynamics.band.high': '고역',
  'dsp.dynamics.band.highRange': '4 kHz 초과',
  'dsp.dynamics.band.highHint': '4 kHz 초과: 디테일, 공기감, 발소리의 윤곽.',
  'dsp.dynamics.lift': '올리기',
  'dsp.dynamics.hold': '붙잡기',
  'dsp.dynamics.upThreshold': '이 아래',
  'dsp.dynamics.upRatio': '비율',
  'dsp.dynamics.upMax': '최대',
  'dsp.dynamics.downThreshold': '이 위',
  'dsp.dynamics.downRatio': '비율',
  'dsp.dynamics.timing': '타이밍과 레벨',
  'dsp.dynamics.timingHint':
    '붙잡기가 얼마나 빨리 들어오고 올리기가 얼마나 빨리 돌아오는지, 그리고 결과의 음량.',
  'dsp.dynamics.attack': '어택',
  'dsp.dynamics.release': '릴리스',
  'dsp.dynamics.makeup': '메이크업',
  'dsp.dynamics.mix': '믹스',
  'dsp.dynamicsPreset.gentle': '부드러운 평준화',
  'dsp.dynamicsPreset.speech': '대화',
  'dsp.gamingPreset.quietLift': '작은 소리 올리기',
  'dsp.gamingPreset.blastGuard': '폭발 가드',
  'dsp.gamingPreset.longSession': '긴 세션',
  'dsp.gamingPreset.competitiveLight': '가벼운 경쟁전',
};
