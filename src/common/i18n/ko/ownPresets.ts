/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The listener's own presets. See `en/ownPresets.ts`. */
export default {
  'eq.own.new': '새 프리셋',
  'eq.own.newHint': '나만의 커브와 랙',
  'eq.own.dialogHint':
    '메인 EQ용 커브와 DSP 페이지용 랙을 내 이름으로 저장합니다.',
  'eq.own.name': '이름',
  'eq.own.defaultName': '내 프리셋',
  'eq.own.defaultFrom': '내 {name}',
  'eq.own.curveFrom': '커브 시작점',
  'eq.own.curveFromHint': '이어서 모양을 다듬습니다',
  'eq.own.fromPlaying': '{name}, 재생 중',
  'eq.own.flat': '플랫',
  'eq.own.rackFrom': '랙 시작점',
  'eq.own.rackOf': '{name}의 랙',
  'eq.own.rackNow': '현재 DSP 페이지',
  'eq.own.rackEmpty': '비어 있음',
  'eq.own.create': '만들고 커브 다듬기',
  'eq.own.editing': '편집 중',
  'eq.own.parts': '프리셋 구성',
  'eq.own.curve': '커브',
  'eq.own.rack': '랙',
  'eq.own.unsaved': '저장 안 됨',
  'eq.own.discard': '버리기',
  'eq.own.save': '프리셋 저장',
  'eq.own.addBand': '밴드 추가',
  'eq.own.curveBands': "'{name}' 커브의 밴드",
  'eq.own.edit': '편집',
  'eq.own.editCopy': '사본 편집',
  'eq.own.copyName': '{name} (사본)',
  'eq.own.more': "'{name}' 더 보기",
  'eq.own.renameLabel': "'{name}'의 새 이름",
  'eq.own.about':
    '내가 만든 프리셋입니다. 커브는 메인 EQ에서, 랙은 DSP 페이지에서 재생됩니다.',
  'eq.own.deleteAsk':
    "'{name}'를 삭제하시겠습니까? 목록에서 사라집니다. 재생 중이면 커브와 랙이 멈춥니다.",
  'eq.own.keep': '유지',
  'eq.own.emptyTitle': '아직 내 프리셋이 없습니다',
  'eq.own.emptyHint':
    '새 프리셋으로 하나 만드세요. 메인 EQ용 커브와 DSP 페이지용 랙입니다.',
} as const;
