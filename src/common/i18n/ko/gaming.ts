/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The Gaming Lab. See `en/gaming.ts`. */
export default {
  'gaming.tab': '게이밍 랩',
  'gaming.view.games': '게임',
  'gaming.view.profiles': '게이밍 프로필',
  'gaming.switch': '게임이 앞에 있으면 전환',
  'gaming.switch.hint':
    '끄면 게임도 음악용 사운드를 그대로 쓰고, 저절로 바뀌는 것은 없습니다.',
  'gaming.add': '게임 추가',
  'gaming.list.show': '게임 목록 표시',
  'gaming.list.hide': '게임 목록 숨기기',
  'gaming.list.resize': '게임 목록 크기 조절',
  'gaming.list.count': '내 게임 · {count}',
  'gaming.list.from': '{profile}에서',
  'gaming.list.tuned': '조정됨',
  'gaming.list.playing': '플레이 중',
  'gaming.empty.title': '아직 게임이 없습니다',
  'gaming.empty.more':
    '게임을 추가하면 그 게임을 위해 만든 게이밍 프로필에서 복사한 전용 사운드가 생깁니다. 여기서 조정하는 것은 복사본이며, 프로필은 그대로입니다.',
  'gaming.game.where': '{source} · {output}에서',
  'gaming.profile.label': '게이밍 프로필',
  'gaming.profile.kind.title': '이 게임용',
  'gaming.profile.kind.kind': '장르별',
  'gaming.profile.kind.yours': '내 프로필',
  'gaming.profile.kind.chain': 'DSP 프리셋',
  'gaming.profile.gone': '더 이상 없는 프로필',
  'gaming.profile.pickHint':
    '다른 프로필을 고르면 이 게임에 그 프로필의 새 복사본이 생깁니다.',
  'gaming.save': '프로필로 저장',
  'gaming.save.new': '새 프로필로 저장…',
  'gaming.save.newHint':
    '내 프로필에 들어가 다른 게임도 여기서 시작할 수 있습니다. 이후 {game}도 여기서 시작합니다.',
  'gaming.save.update': '{profile} 업데이트',
  'gaming.save.updateHint':
    '내 프로필이 이 변경을 받습니다. 여기서 시작한 게임은 각자의 복사본을 유지합니다.',
  'gaming.save.reset': '{profile}(으)로 되돌리기',
  'gaming.save.resetHint':
    '이 게임의 조정을 버리고 프로필에서 다시 시작합니다.',
  'gaming.save.rename': '이 복사본 이름 바꾸기…',
  'gaming.save.delete': '이 복사본 삭제',
  'gaming.save.deleteHint':
    '이 게임과 그 조정을 지웁니다. 프로필은 그대로 남습니다.',
  'gaming.action.unload': '언로드',
  'gaming.action.unloadHint': '음악용 사운드가 지금 돌아옵니다.',
  'gaming.action.try': '지금 사용해 보기',
  'gaming.action.tryHint':
    '{game} 전용 사운드를 지금 켜서 들으며 조정할 수 있게 합니다.',
  'gaming.status.tuned':
    '이 게임용 {profile} 복사본. 조정됨: {parts}. 프로필 자체는 그대로입니다.',
  'gaming.status.tunedNamed':
    '{copy}: 이 게임용 {profile} 복사본. 조정됨: {parts}. 프로필 자체는 그대로입니다.',
  'gaming.status.same':
    '프로필과 같습니다. 여기서 바꾼 것은 이 게임에만 남고, 프로필 자체는 절대 바뀌지 않습니다.',
  'gaming.rail.game': '게임',
  'gaming.rail.sound': '사운드',
  'gaming.rail.dsp': 'DSP',
  'gaming.rail.tuned': '조정됨',
  'gaming.stage.footsteps': '게임 필터',
  'gaming.stage.mainEq': 'EQ',
  'gaming.stage.curve': '커브',
  'gaming.curve.any': '어떤 게임이든',
  'gaming.editor.notLoaded': '{game} 전용 사운드가 재생되고 있지 않습니다',
  'gaming.editor.notLoadedMore':
    '지금 사용해 보면 들으면서 바로 여기서 조정할 수 있습니다. 음악용 사운드는 언로드하거나 게임을 닫으면 돌아옵니다.',
  'gaming.editor.eqNote':
    '이 게임 전용 밴드로, 위 그래프가 보일 때 그 위에 그려집니다.',
  'gaming.editor.curveNote':
    '이 게임이 재생하는 헤드폰 보정(내 커브 또는 헤드폰용)과 함께 적용된 모든 커브. 각각의 ×로 뺄 수 있습니다.',
  'gaming.saveDialog.title': '게이밍 프로필로 저장',
  'gaming.saveDialog.hint':
    '게이밍 프로필 목록에서 다른 게임도 여기서 시작할 수 있습니다.',
  'gaming.saveDialog.placeholder': '프로필 이름',
  'gaming.renameDialog.title': '이 복사본 이름 바꾸기',
  'gaming.renameDialog.hint': '이 게임의 복사본에만 이름이 붙습니다.',
  'gaming.renameDialog.placeholder': '복사본 이름',
  'gaming.addDialog.title': '게임 추가',
  'gaming.addDialog.intro':
    '게임을 고르세요. 게이밍 프로필에서 시작해 전용 복사본을 받습니다. 이 게임용 복사본을 조정하며, 프로필 자체는 절대 바뀌지 않습니다.',
  'gaming.addDialog.running': '실행 중',
  'gaming.addDialog.installed': '이 PC에서 찾음',
  'gaming.addDialog.startsFrom': '시작 프로필',
  'gaming.addDialog.browse': '없나요? 게임 프로그램 찾아보기…',
  'gaming.addDialog.later': '언제든지 다른 게이밍 프로필을 고를 수 있습니다.',
  'gaming.addDialog.add': '{game} 추가',
  'gaming.addDialog.cancel': '취소',
  'gaming.addDialog.loading': '게임을 찾는 중…',
  'gaming.addDialog.none':
    '런처에 아직 여기 없는 게임이 없습니다. 대신 게임 프로그램을 찾아보세요.',
  'gaming.addDialog.close': '닫기',
  'gaming.profiles.intro':
    '게임은 프로필의 전용 복사본을 받습니다. 조정하는 것은 복사본이며, 프로필은 바뀌지 않습니다.',
  'gaming.profiles.search': '프로필과 게임 검색',
  'gaming.profiles.searchClear': '검색 지우기',
  'gaming.profiles.noMatch': '“{query}”와 일치하는 게이밍 프로필이 없습니다.',
  'gaming.profiles.filterLabel': '보기',
  'gaming.profiles.noCurve': '커브 없음: 게임이 믹스된 그대로',
  'gaming.profiles.filter.all': '전체',
  'gaming.profiles.filter.yours': '내 프로필',
  'gaming.profiles.yours': '내 프로필 · 게임 복사본에서 저장',
  'gaming.profiles.yoursEmpty':
    '아직 없습니다. 게임을 조정하고 프로필로 저장을 사용하면 그 사운드를 여기에 남길 수 있습니다.',
  'gaming.profiles.readyGroup': '기본 제공 · {group}',
  'gaming.profiles.savedFrom': '{game} 복사본에서 저장',
  'gaming.profiles.usedBy': '{games}이(가) 여기서 시작함',
  'gaming.profiles.use': '게임에 사용',
  'gaming.profiles.rename': '이름 바꾸기',
  'gaming.profiles.delete': '삭제',
  'gaming.profiles.confirmDelete':
    '삭제할까요? 게임은 각자의 복사본을 유지합니다.',
  'gaming.profiles.keep': '유지',
  'gaming.profiles.renameTitle': '게이밍 프로필 이름 바꾸기',
  'gaming.profiles.renameHint':
    '여기서 시작한 게임은 복사본을 유지하며, 이름만 바뀝니다.',
  'gaming.toast.loaded': '전용 사운드가 켜졌습니다',
  'gaming.toast.restored': '음악용 사운드로 돌아왔습니다',
  'gaming.paused.notice': '일시 중지됨: {game} 전용 사운드 재생 중',
  'gaming.paused.tune': '{game} 조정',
  'gaming.paused.title': '음악용 랙이 기다리고 있습니다',
  'gaming.paused.body':
    '{game}이(가) 실행되는 동안에는 전용 사운드가 켜지고 이 랙은 일시 중지됩니다. 게임을 닫거나 지금 언로드하면 그대로 돌아옵니다.',
  'gaming.paused.stages': '{preset} · 돌아올 것',
  'gaming.paused.none': '모든 단계가 꺼져 있습니다.',
  'gaming.profileSelect.game': '{game} · 게임 사운드',
  'gaming.preset.tuned': '{game} (맞춤)',
  'gaming.preset.openHint':
    '{game} 전용 사운드가 로드되어 있습니다. 프리셋은 게이밍 랩에서 바꿉니다.',
  'gaming.now.hint': '{game} 전용 사운드가 재생 중입니다. 게임을 표시합니다.',
} as const;
