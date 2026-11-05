/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.appliedGain': '적용 게인',
  'dsp.dynamics.graphHint':
    'Dynamics 처리 전후의 음악입니다. 게인 곡선은 소리를 키울 때 올라가고 압축할 때 내려갑니다.',
  'dsp.dynamics.engineLiveOld':
    'Dynamics의 실시간 움직임을 보려면 엔진을 업데이트하세요. 소리는 이미 처리되고 있습니다.',
  'dsp.dynamics.title': '다이내믹스',
  'dsp.dynamics.description':
    '작은 소리는 올리고 큰 소리는 붙잡습니다. 세 개의 대역에서 작동해 속삭임과 폭발이 중간에서 만납니다. 지연은 더하지 않습니다.',
  'dsp.dynamics.engineOld':
    '다이내믹스에는 최신 FluidEQ Engine이 필요합니다. 랙의 나머지는 재생 중이며, 엔진을 업데이트하면 이 필터가 시작됩니다.',
  'dsp.dynamics.graphLabel': '각 대역이 레벨에 하는 일',
  'dsp.dynamics.band.low': '저역',
  'dsp.dynamics.band.lowHint': '150 Hz 미만: 폭발의 울림, 킥, 엔진.',
  'dsp.dynamics.band.mid': '중역',
  'dsp.dynamics.band.midHint': '150 Hz~4 kHz: 목소리, 발소리, 대부분의 소리.',
  'dsp.dynamics.band.high': '고역',
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
