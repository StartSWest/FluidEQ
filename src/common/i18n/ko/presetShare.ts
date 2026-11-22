/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Sharing the listener's own presets. See `en/presetShare.ts`. */
export default {
  'presetShare.share': '{name} 공유',
  'presetShare.menu.community': '커뮤니티에 공유…',
  'presetShare.menu.copyLink': '공유 링크 복사',
  'presetShare.menu.export': '내보내기…',
  'presetShare.linkCopied': '공유 링크를 복사했습니다',
  'presetShare.linkMaking': '링크를 만드는 중…',
  'presetShare.linkFailed.signedOut': '링크를 만들려면 로그인하세요',
  'presetShare.linkFailed.suspended': '이 계정은 지금 공유할 수 없습니다',
  'presetShare.linkFailed.rateLimited': '이번 시간 링크가 너무 많습니다',
  'presetShare.linkFailed.tooMany': '링크 한도에 도달했습니다',
  'presetShare.linkFailed.takenDown': '이 링크는 삭제되었습니다',
  'presetShare.linkFailed.offline': 'FluidEQ 서버가 응답하지 않습니다',

  'presetShare.text.title': '{name} · FluidEQ 프리셋',
  'presetShare.text.curve': '커브: {count}개 밴드',
  'presetShare.text.rack': '랙: {stages}',
  'presetShare.text.open': 'FluidEQ에서 열기',

  'presetShare.chip.curve': '커브 · {count}개 밴드',
  'presetShare.chip.flat': '변경 없음',

  'presetShare.export.title': '{name} 내보내기',
  'presetShare.export.hint':
    '커브와 랙의 모든 단계가 담깁니다. 노멀라이저와 룸의 머리는 담기지 않고 내 것으로 남습니다.',
  'presetShare.export.tab.forum': '모든 포럼용',
  'presetShare.export.tab.file': '파일',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit, Discord, GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · 기타 게시판',
  'presetShare.format.plain': '일반 텍스트',
  'presetShare.format.plainFor': '그 밖의 모든 곳',
  'presetShare.export.withLink': 'fluideq.com 페이지로 가는 짧은 링크 추가',
  'presetShare.export.linkSignIn': '로그인하고 짧은 링크 추가',
  'presetShare.export.fits': '{count}자 · Discord 메시지 하나에 들어갑니다',
  'presetShare.export.long':
    '{count}자 · Discord 메시지 하나에는 너무 깁니다. 짧은 링크만 보내세요.',
  'presetShare.export.pasteHint':
    'FluidEQ가 있으면 누구나 가져오기에 붙여 넣을 수 있습니다.',
  'presetShare.export.fileHint':
    '커브와 모든 단계가 담긴 읽기 쉬운 JSON으로, DSP 페이지가 저장하는 파일입니다. 가져오기에 끌어다 놓으면 다시 불러옵니다.',
  'presetShare.export.apoNoCurve':
    '이 프리셋에는 커브가 없습니다. 소리는 모두 랙에 있고, 랙에는 FluidEQ가 필요합니다.',
  'presetShare.export.apoRack':
    '이 형식에는 커브만 담깁니다. {stages}에는 FluidEQ가 필요합니다.',
  'presetShare.export.copy': '복사',
  'presetShare.export.copyCurve': '커브 복사',
  'presetShare.export.save': '파일 저장…',
  'presetShare.export.copied': '복사됨',
  'presetShare.export.saved': '저장됨',
  'presetShare.export.failed': '완료되지 않았습니다. 다시 시도하세요.',

  'presetShare.forum.attached': '첨부된 프리셋',
  'presetShare.forum.remove': '프리셋 제거',
  'presetShare.forum.template':
    '용도: \n들어 본 기기: \n함께 들어 볼 곡: \n\n하는 일: ',

  'presetShare.card.by': '@{author} 님이 공유',
  'presetShare.card.sharedBy': '{author} 님이 공유',
  'presetShare.card.sharedByMember': 'FluidEQ 회원이 공유',
  'presetShare.card.add': '내 프리셋에 추가',
  'presetShare.card.added': "'너의 것'에 있음 · 재생 중",
  'presetShare.card.try': '들어 보기',
  'presetShare.card.stopTrying': '그만 듣기',
  'presetShare.card.tryingNote':
    '멈추거나 게시물을 나갈 때까지 재생됩니다. 그 뒤에는 원래 소리로 돌아옵니다.',

  'presetShare.import.button': '가져오기',
  'presetShare.import.title': '프리셋 가져오기',
  'presetShare.import.hint':
    '포럼 게시물, 공유 링크 또는 프리셋 파일을 붙여 넣으세요. 안에 든 프리셋만 읽습니다.',
  'presetShare.import.placeholder': '여기에 붙여 넣기…',
  'presetShare.import.chooseFile': '파일 선택…',
  'presetShare.import.found': '프리셋 1개를 찾았습니다',
  'presetShare.import.missing':
    '이 텍스트에는 FluidEQ 프리셋이 없습니다. 게시물 전체나 공유 링크를 붙여 넣으세요.',
  'presetShare.import.newer':
    '이 프리셋은 더 새로운 FluidEQ로 만들어졌습니다. 읽으려면 FluidEQ를 업데이트하세요.',
  'presetShare.import.damaged':
    '프리셋 코드가 잘렸거나 손상되었습니다. 처음부터 끝까지 다시 복사하세요.',
  'presetShare.import.gone':
    '이 프리셋은 더 이상 공유되지 않습니다. 대신 코드를 요청하세요.',
  'presetShare.import.offline':
    '이 링크를 열기 위해 FluidEQ 서버에 연결하지 못했습니다. 연결을 확인하고 다시 시도하세요.',

  'presetShare.link.title': '이 프리셋을 추가할까요?',
  'presetShare.link.hint':
    '연 링크에서 왔습니다. 누르기 전에는 아무것도 재생되거나 저장되지 않습니다.',
  'presetShare.link.notNow': '나중에',
  'presetShare.link.fetching': 'FluidEQ에서 프리셋을 가져오는 중…',
} as const;
