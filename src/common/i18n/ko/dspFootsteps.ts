/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': '발소리',
  'dsp.footsteps.description':
    '발소리, 재장전, 문 소리처럼 게임의 작은 소리를 나는 순간 끌어올립니다. 총소리, 폭발, 비, 메아리는 그대로 두고, 양쪽 귀에 같은 만큼 끌어올리며, 지연은 생기지 않습니다.',
  'dsp.footsteps.isolate': '격리하다',
  'dsp.footsteps.isolateHint': '발소리가 더하는 소리만 들어보세요.',
  'dsp.footsteps.isolateOn':
    '발소리가 더하는 소리만 재생 중입니다. 발소리와 다른 작은 소리가 들려야 하며, 총소리는 들리지 않아야 합니다.',
  'dsp.footsteps.engineOld':
    '발소리에는 최신 FluidEQ 엔진이 필요합니다. 나머지 랙은 재생 중이며, 엔진을 업데이트하면 이 단계가 시작됩니다.',

  'dsp.footsteps.lift': '끌어올림',
  'dsp.footsteps.liftHint':
    '작은 소리가 들려오는 동안 얼마나 끌어올릴지 정합니다. 이미 큰 소리는 그대로 둡니다.',
  'dsp.footsteps.calm': '억제',
  'dsp.footsteps.calmHint':
    '폭발의 낮은 울림을 얼마나 낮출지 정합니다. 10분의 1초 안에 풀려서 다음 발소리가 들립니다.',
  'dsp.footsteps.upTo': '최대 {db} dB',
  'dsp.footsteps.bands': '끌어올리는 대역',
  'dsp.footsteps.bandsHint':
    '모든 스피커에 같은 만큼 끌어올리므로 소리의 위치가 그대로 유지됩니다.',
  'dsp.footsteps.band.weight': '발걸음의 무게',
  'dsp.footsteps.band.steps': '발소리와 장비',
  'dsp.footsteps.band.detail': '앞뒤와 위아래',

  'dsp.footsteps.graph.now': '지금',
  'dsp.footsteps.graph.lifting': '끌어올림',
  'dsp.footsteps.graph.calming': '억제',
  'dsp.footsteps.graph.background': '배경',
  'dsp.footsteps.graph.isolate': '더한 소리만',
  'dsp.footsteps.graph.everything': '전체',
  'dsp.footsteps.graph.steps': '발소리 대역',
  'dsp.footsteps.graph.lifted': '끌어올린 만큼',
  'dsp.footsteps.graph.calmed': '억제한 만큼',

  'dsp.footstepsPresetGroup.games': '게임 종류별',
  'dsp.footstepsPreset.competitive': '경쟁',
  'dsp.footstepsPreset.competitiveGames': 'CS2, 발로란트, 레인보우 식스',
  'dsp.footstepsPreset.battleRoyale': '배틀로얄',
  'dsp.footstepsPreset.battleRoyaleGames':
    '워존, 에이펙스, 배틀그라운드, 포트나이트',
  'dsp.footstepsPreset.tactical': '전술 생존',
  'dsp.footstepsPreset.tacticalGames': '타르코프, 헌트, 아르마',
  'dsp.footstepsPreset.story': '스토리와 호러',
  'dsp.footstepsPreset.storyGames': '싱글 플레이 게임과 오픈 월드',
};
