/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': '게임',
  'dsp.footsteps.description':
    '게임을 제대로 들리게 하는 모든 것: 작은 발소리는 나는 순간 키우고, 목소리는 앞으로 내고, 맵의 날씨와 웅웅거림은 줄이거나 키우고, 세계가 당신을 감쌉니다. 지연은 더하지 않습니다.',
  'dsp.footsteps.isolate': '격리하다',
  'dsp.footsteps.isolateHint': '게임이 바꾸는 소리만 듣기.',
  'dsp.footsteps.isolateOn':
    '게임이 바꾸는 소리만 재생 중입니다. 발소리와 작은 소리가 커지는 것이 들려야 하고, 총소리는 들리지 않아야 합니다.',
  'dsp.footsteps.engineOld':
    '게임에는 최신 FluidEQ Engine이 필요합니다. 랙의 나머지는 재생 중이며, 엔진을 업데이트하면 이 필터가 시작됩니다.',

  'dsp.footsteps.lift': '끌어올림',
  'dsp.footsteps.liftHint':
    '작은 소리가 들려오는 동안 얼마나 끌어올릴지 정합니다. 이미 큰 소리는 그대로 둡니다.',
  'dsp.footsteps.calm': '억제',
  'dsp.footsteps.upTo': '최대 {db} dB',
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

  'dsp.footstepsPreset.competitive': '경쟁',
  'dsp.footstepsPreset.competitiveGames': 'CS2, 발로란트, 레인보우 식스',
  'dsp.footstepsPreset.battleRoyale': '배틀로얄',
  'dsp.footstepsPreset.battleRoyaleGames':
    '워존, 에이펙스, 배틀그라운드, 포트나이트',
  'dsp.footstepsPreset.tactical': '전술 생존',
  'dsp.footstepsPreset.tacticalGames': '타르코프, 헌트, 아르마',
  'dsp.footstepsPreset.story': '스토리와 호러',
  'dsp.footstepsPreset.storyGames': '싱글 플레이 게임과 오픈 월드',

  'dsp.footstepsPresetGroup.kinds': '게임 종류별',
  'dsp.footstepsPresetGroup.competitive': '경쟁 슈터',
  'dsp.footstepsPresetGroup.battle': '배틀로얄과 대규모 전투',
  'dsp.footstepsPresetGroup.tactical': '택티컬과 서바이벌',
  'dsp.footstepsPresetGroup.moba': 'MOBA와 전략',
  'dsp.footstepsPresetGroup.rpg': 'MMO와 RPG',
  'dsp.footstepsPresetGroup.story': '스토리와 호러',
  'dsp.footstepsPreset.immersive': '어떤 게임이든, 주위에 룸',
  'dsp.footstepsPreset.immersiveGames': '헤드폰으로 하는 스테레오 게임',
  'dsp.footstepsPreset.topDown': '탑다운',
  'dsp.footstepsPreset.topDownGames': 'MOBA, RTS, 전략',
  'dsp.footstepsPreset.worlds': '월드',
  'dsp.footstepsPreset.worldsGames': 'MMO, 오픈 월드 RPG',
  'dsp.footstepsPreset.speed': '스피드',
  'dsp.footstepsPreset.speedGames': '레이싱과 드라이빙',
  'dsp.footstepsPreset.impact': '타격감',
  'dsp.footstepsPreset.impactGames': '격투, 액션, 스포츠',
  'dsp.game.hintOwn3d': '자체 3D 사운드',
  'dsp.game.hintRoom': '룸: {room}',
  'dsp.game.noteOwn3d':
    '{game}은(는) 소리를 직접 당신 주위에 배치하므로 룸은 꺼진 채로 둡니다. 둘 다 있으면 발소리가 두 곳에서 들립니다.',
  'dsp.game.noteRoom': '{game}: 헤드폰에서는 룸이 {room}에 둡니다.',
  'dsp.game.engineOld':
    '대화, 환경음, 말발굽에는 최신 FluidEQ Engine이 필요합니다. 발소리는 이미 재생 중이며, 나머지는 엔진을 업데이트하면 시작됩니다.',
  'dsp.game.footsteps': '발소리',
  'dsp.game.heavy': '말발굽과 무거운 발소리',
  'dsp.game.heavyHint': '부츠나 말의 낮은 쿵 소리도 함께 키웁니다.',
  'dsp.game.dialogue': '대화',
  'dsp.game.dialogueHint':
    '장면 가운데에서 누군가 말하는 동안 그 목소리를 앞으로 냅니다.',
  'dsp.game.voices': '목소리',
  'dsp.game.duck': '목소리에 자리 내주기',
  'dsp.game.duckHint': '대사가 나오는 동안 음악과 효과음이 조금 물러납니다.',
  'dsp.game.voiceMeter': '누군가 말하는 중',
  'dsp.game.environment': '환경음',
  'dsp.game.environmentHint':
    '맵의 날씨와 웅웅거림: 비, 바람, 방의 울림. 줄이면 단서가 잘 들리고, 키우면 분위기가 살아납니다.',
  'dsp.game.environmentDial': '앰비언스',
  'dsp.game.environmentDown': '최대 {db} dB 줄임',
  'dsp.game.environmentUp': '최대 {db} dB 키움',
  'dsp.game.environmentLeft': '게임이 만든 그대로',
  'dsp.game.ambienceMeter': '들리는 환경음',

  'dsp.game.hintNoRoom': '룸 없이가 최고',
  'dsp.game.noteNoRoom':
    '{game}은(는) 믹스된 그대로가 가장 무섭기 때문에 룸은 꺼진 채로 둡니다.',

  // The Gaming tab's own presets, on every stage.
  'dsp.eqPresetGroup.gaming': '게임',
  'dsp.deEsserPresetGroup.gaming': '게임',
  'dsp.gamingPreset.tightLows': '단단한 저음',
  'dsp.gamingPreset.impact': '타격감',
  'dsp.gamingPreset.night': '야간',
  'dsp.gamingPreset.positionSafe': '위치 그대로',
  'dsp.gamingPreset.openWorld': '오픈 월드',
  'dsp.gamingPreset.battlefieldView': '전장 시점',
  'dsp.gamingPreset.cleanCeiling': '깨끗한 한계',
  'dsp.gamingPreset.battle': '전투',
  'dsp.gamingPreset.cinematicPunch': '시네마틱 펀치',
  'dsp.gamingPreset.rumble': '작은 드라이버의 울림',
  'dsp.gamingPreset.engineWeight': '엔진의 무게',
  'dsp.gamingPreset.cueDetail': '신호 디테일',
  'dsp.gamingPreset.dullHeadset': '답답한 헤드셋',
  'dsp.gamingPreset.callouts': '팀 콜아웃',
  'dsp.gamingPreset.footstepFocus': '발소리 집중',
  'dsp.gamingPreset.blastTamer': '폭발 억제',
  'dsp.gamingPreset.voicesForward': '목소리 앞으로',
  'dsp.gamingPreset.cinematicWeight': '시네마틱 무게',
  'dsp.gamingPreset.dread': '공포',
  'dsp.gamingPreset.engineTyres': '엔진과 타이어',
  'dsp.gamingPreset.abilityClarity': '스킬 선명하게',

  // The Gaming tab's whole-rack chains.
  'dsp.gamingChain.pinpoint': '핀포인트',
  'dsp.gamingChain.blast': '폭발에서 살아남기',
  'dsp.gamingChain.stealth': '잠입',
  'dsp.gamingChain.cinematic': '시네마틱',
  'dsp.gamingChain.dread': '공포',
  'dsp.gamingChain.topDown': '탑다운',
  'dsp.gamingChain.worlds': '월드',
  'dsp.gamingChain.speed': '스피드',
  'dsp.gamingChain.impact': '타격감',
  'dsp.gamingChain.night': '밤 플레이',
};
