/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const dspDeEsser = {
  'dsp.deEsser.title': '디에서',
  'dsp.deEsser.description':
    '소리가 나는 동안에만 음성의 날카로운 S, T 및 SH를 낮추고 심벌즈와 나머지 고음은 그대로 둡니다.',
  'dsp.deEsser.isolate': '격리하다',
  'dsp.deEsser.isolateHint': '디에서가 가져가는 것만 들어보세요.',
  'dsp.deEsser.isolateOn':
    '디에서가 가져간 것만 재생합니다. 심벌즈 소리가 들리면 너무 많이 걸리는 것입니다.',
  'dsp.deEsser.group.find': '찾기',
  'dsp.deEsser.group.findHint':
    '감도는 노래 자체의 레벨을 기준으로 측정되므로 조용한 트랙과 시끄러운 트랙이 동일하게 취급됩니다.',
  'dsp.deEsser.group.reduce': '감소',
  'dsp.deEsser.group.timing': '타이밍',
  'dsp.deEsser.group.timingHint':
    '시작이 각 S 직전에 반응하므로 첫 번째 가장자리가 누락되지 않습니다. Let go는 고음이 얼마나 빨리 회복되는지 설정합니다.',
  'dsp.deEsser.group.where': '어디에',
  'dsp.deEsser.sensitivity': '감도',
  'dsp.deEsser.lowHz': '에서',
  'dsp.deEsser.highHz': '받는 사람',
  'dsp.deEsser.rangeDb': '최대',
  'dsp.deEsser.widthOct': '폭',
  'dsp.deEsser.attackMs': '시작을 잡아라',
  'dsp.deEsser.releaseMs': '가자',
  'dsp.deEsser.keepCymbals': '심벌 보존',
  'dsp.deEsser.mode.label': '감소 방법',
  'dsp.deEsser.mode.spectral': '스펙트럼',
  'dsp.deEsser.mode.treble': '고음',
  'dsp.deEsser.mode.whole': '전체 음성',
  'dsp.deEsser.mode.spectralHint':
    'S를 구성하는 주파수만 낮추고 S가 움직일 때 따라갑니다.',
  'dsp.deEsser.mode.trebleHint':
    '대부분의 디에서처럼 S 위의 모든 것을 줄입니다. 더 단단하고 조금 더 둔해졌습니다.',
  'dsp.deEsser.mode.wholeHint':
    '각 S의 전체 사운드를 딥핑하여 그 아래에 있는 모든 것을 펌핑할 수 있습니다. 자체적으로 녹음된 음성에만 해당됩니다.',
  'dsp.deEsser.where.label': '스테레오 영상의 어느 부분',
  'dsp.deEsser.where.centre': '센터',
  'dsp.deEsser.where.all': '모든 것',
  'dsp.deEsser.where.centreHint':
    '보이스는 중앙에 있고 하이햇은 일반적으로 측면에 있으므로 중앙에서 듣고 잘라냅니다.',
  'dsp.deEsser.where.allHint':
    '전체 스테레오 영상을 듣습니다. 모노 녹음, 음성 녹음, 라이브 녹음용입니다.',
  'dsp.deEsser.graph.s': 'S 에',
  'dsp.deEsser.graph.cut': '컷',
  'dsp.deEsser.graph.isolate': '빼앗긴 것만',
  'dsp.deEsser.graph.spared': '심벌즈가 통과하다',
  'dsp.deEsser.graph.now': '지금',
  'dsp.deEsser.graph.voice': '음성',
  'dsp.deEsser.graph.notVoice': '목소리가 아니야',
  'dsp.deEsser.graph.threshold': '그것이 시작되는 곳',
  'dsp.deEsser.engineOld':
    '여기에 설치된 FluidEQ 엔진은 디에서보다 구형이라 이 단계는 아직 들어보지 못했습니다. 나머지 랙은 이전과 같이 재생됩니다.',
  'dsp.deEsser.upTo': '최대 {db}',
  'dsp.deEsser.lens.trebleNow': '지금은 고음',
  'dsp.deEsser.lens.underVoice': '{db} 음성 아래',
  'dsp.deEsser.lens.ahead': '{ms}를 미리 들었습니다',
  'dsp.deEsser.lens.cymbalNeeds': '심벌즈에는 {db}가 더 필요합니다',
  'dsp.deEsser.lens.cymbal': '심벌즈',
  'dsp.deEsser.lens.s': 'S',
  'dsp.deEsser.lens.left': 'L',
  'dsp.deEsser.lens.right': 'R',
  'dsp.deEsserPresetGroup.music': '음악',
  'dsp.deEsserPresetGroup.speech': '연설',
  'dsp.deEsserPreset.gentle': '온화한',
  'dsp.deEsserPreset.vocalMusic': '성악',
  'dsp.deEsserPreset.brightHeadphones': '밝은 헤드폰',
  'dsp.deEsserPreset.harshStreams': '거친 흐름',
  'dsp.deEsserPreset.live': '라이브 녹음',
  'dsp.deEsserPreset.podcast': '팟캐스트 및 연설',
} satisfies Partial<Dictionary>;

export default dspDeEsser;
