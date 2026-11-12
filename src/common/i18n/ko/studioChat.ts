/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const studioChat = {
  'studioChat.label': 'AI로 만들기',
  'studioChat.title': 'AI로 만들기',
  'studioChat.where': '이 컴퓨터의 Claude Code',
  'studioChat.wherePlan': 'Claude Code · {plan} 계획',
  'studioChat.new': '새 채팅',
  'studioChat.otherAi': '다른 AI 사용',
  'studioChat.menu': '채팅 옵션',
  'studioChat.backToChat': '채팅으로 돌아가기',
  'studioChat.fold': '채팅을 접어보세요',
  'studioChat.unfold': 'AI로 만들기',
  'studioChat.inspect':
    'FluidEQ의 장면 중 하나이며, 내부를 들여다 볼 수 있습니다. 클로드와 함께 나만의 프로젝트를 시작해 보세요.',
  'studioChat.noProject':
    '프로젝트를 시작하면 Claude가 여기서 여러분과 함께 장면을 만들 수 있습니다.',
  'studioChat.checking': '이 컴퓨터에서 Claude Code를 찾는 중…',
  'studioChat.missingTitle': 'AI와 채팅하여 장면 만들기',
  'studioChat.missingBody':
    'Studio는 귀하의 Claude 계획에 따라 이 컴퓨터의 Claude Code를 통해 채팅합니다. 아직 설치되지 않았습니다.',
  'studioChat.signInTitle': '클로드에 로그인',
  'studioChat.signInBody':
    'Claude Code가 설치되었지만 로그인되지 않았습니다. 브라우저에서 Anthropic 자체 페이지에 로그인합니다. FluidEQ는 그것을 결코 보지 못합니다.',
  'studioChat.install': 'Claude Code 설치',
  'studioChat.signIn': '로그인',
  'studioChat.signingIn': '로그인을 기다리는 중…',
  'studioChat.checkAgain': '다시 확인',
  'studioChat.plans':
    'Claude Code에는 Claude Pro, Max, Team 또는 Enterprise 요금제가 필요합니다.',
  'studioChat.otherAiNote':
    '대신 다른 AI를 사용하여 ChatGPT, Codex 또는 기타 보조자에 대한 프롬프트를 복사하세요.',
  'studioChat.welcomeTitle': '이 장면은 무엇이어야합니까?',
  'studioChat.welcomeBody':
    '문장으로 설명해보세요. Claude는 그것을 쓰고, 보고, 그것으로 당신의 음악을 듣고, 무대에서 각 버전을 연주합니다.',
  'studioChat.you': '당신',
  'studioChat.claude': '클로드',
  'studioChat.attachedNote': '무대 사진과 함께',
  'studioChat.seenLarger': '이 사진을 더 크게 표시',
  'studioChat.thinking': '생각하다…',
  'studioChat.step.theScene': '장면',
  'studioChat.step.look': '현장을 살펴보니',
  'studioChat.step.lookNow': '현장을 살펴보면…',
  'studioChat.step.animation': '애니메이션 {file}을(를) 살펴봤습니다',
  'studioChat.step.animationNow': '애니메이션 {file}을(를) 살펴보는 중…',
  'studioChat.step.sheet': '{file}의 프레임을 만들었습니다',
  'studioChat.step.sheetNow': '{file}의 프레임을 만드는 중…',
  'studioChat.step.hear': '음악을 들었다',
  'studioChat.step.hearNow': '음악을 듣는다…',
  'studioChat.step.read': '{file} 읽기',
  'studioChat.step.readNow': '{file} 읽는 중…',
  'studioChat.step.write': '{file} 변경됨',
  'studioChat.step.writeNow': '{file} 변경 중…',
  'studioChat.step.search': '프로젝트를 살펴보았습니다',
  'studioChat.step.searchNow': '프로젝트를 살펴보면서…',
  'studioChat.step.other': '현장에서 일한',
  'studioChat.step.otherNow': '현장에서 작업 중…',
  'studioChat.version': '버전 {version}',
  'studioChat.playing': '무대에서 놀기',
  'studioChat.bringBack': '다시 가져와',
  'studioChat.broughtBack': '다시 무대로',
  'studioChat.bringBackFailed': '이 버전을 다시 가져올 수 없습니다.',
  'studioChat.stopped': '중지되었습니다.',
  'studioChat.failed.missing': 'Claude Code는 더 이상 이 컴퓨터에 없습니다.',
  'studioChat.failed.signedOut':
    'Claude Code가 로그아웃되었습니다. 로그인한 다음 메시지를 다시 보내세요.',
  'studioChat.failed.limit':
    'Claude 요금제의 사용량 한도에 도달했습니다. 잠시 후 재설정됩니다. 그럼 다시 메시지를 보내주세요.',
  'studioChat.failed.crashed':
    'Claude Code는 완료되기 전에 중지되었습니다. 계속하려면 메시지를 다시 보내세요.',
  'studioChat.placeholderFirst': '당신의 장면을 묘사하세요…',
  'studioChat.placeholder':
    '"스네어에서 조명을 깜박이게 해 줘"와 같이 변경을 요청하세요.',
  'studioChat.attach': '무대 부착',
  'studioChat.attached': '이미지 첨부됨',
  'studioChat.attachHint': '지금 보이는 현장 사진을 메시지와 함께 보내주세요',
  'studioChat.attachPicture': '이미지 첨부',
  'studioChat.attachPictureHint':
    '컴퓨터에서 이미지를 첨부합니다. Ctrl+V로 붙여넣거나 여기에 끌어다 놓을 수도 있습니다.',
  'studioChat.send': '보내기',
  'studioChat.stop': '정지',
  'studioChat.fine':
    'Claude 계획에 따라 자신만의 Claude Code를 실행합니다. 이 프로젝트의 파일을 변경하고 장면을 보고 들을 수 있습니다. FluidEQ는 귀하의 로그인을 볼 수 없습니다.',
  'studioChat.status.working': '클로드가 현장에서 일하고 있다',
  'studioChat.model': '모델',
  'studioChat.effort': '노력',
  'studioChat.modelDefault': '기본값',
  'studioChat.effortDefault': '기본값',
  'studioChat.effortLow': '낮음',
  'studioChat.effortMedium': '중간',
  'studioChat.effortHigh': '높음',
  'studioChat.effortXhigh': '매우 높음',
  'studioChat.effortMax': '맥스',
  'studioChat.carryOn': '계속하다',
  'studioChat.carryOnMessage': '멈춘 곳에서 계속 진행하세요.',
  'studioChat.resize': '채팅 크기를 조정하려면 드래그하세요.',
  'studioChat.effortHint':
    '클로드가 얼마나 열심히 생각하는지. 중간은 대부분의 변경 사항에 적합합니다.',
  'studioChat.modelHintDefault': 'Claude Code는 무엇으로 설정되어 있나요?',
  'studioChat.modelHintDefaultNamed': 'Claude Code에 설정된 모델: {model}',
  'studioChat.modelUnavailable': 'Claude 요금제에 포함되지 않음',
  'studioChat.modelUnavailableChosen':
    'Claude 요금제에 포함되지 않아 채팅은 기본값을 사용합니다',
  'studioChat.modelHintFable': '가장 어려운 장면을 위한 가장 유능한',
  'studioChat.modelHintOpus': '깊고 세심하게, 큰 변화를 위해',
  'studioChat.modelHintSonnet': '대부분의 변경 사항에 대해 빠르고 유능함',
  'studioChat.modelHintHaiku': '작은 조정을 위한 가장 빠른 속도',
  'studioChat.effortWarning':
    '더 많은 노력을 기울일수록 Claude는 더 오랫동안 생각하게 됩니다. 답변에 더 많은 시간이 걸리고 Claude 계획의 한도를 더 빨리 사용하게 됩니다.',
  'studioChat.step.picture': '{file} 사진을 만들었습니다.',
  'studioChat.step.pack': '사진을 현장에 넣어보세요',
  'studioChat.step.packNow': '사진을 현장에 넣는 중...',
  'studioChat.step.pictureNow': '그림 {file} 만드는 중…',
  'studioChat.step.make': 'Higgsfield로 만들었습니다',
  'studioChat.step.makeNow': 'Higgsfield로 만드는 중…',
  'studioChat.ask.toolTitle': 'Claude가 {tool}을(를) 사용하도록 허용할까요?',
  'studioChat.ask.toolBody':
    '내 Claude Code 도구 또는 플러그인입니다. 허용한 경우에만 이 컴퓨터에서 내 계정으로 실행됩니다.',
  'studioChat.ask.allow': '허용',
  'studioChat.ask.allowAlways': '항상 허용',
  'studioChat.ask.allowAlwaysHint':
    '{tool}에 대해 다시 묻지 않기: 내 Claude Code 설정에 저장됩니다',
  'studioChat.ask.deny': '허용 안 함',
  'studioChat.ask.foreign':
    '이 장면은 FluidEQ 밖에서 왔으므로 AI가 모든 명령 전에 묻습니다.',
  'studioChat.outside.title': '이 장면은 FluidEQ 밖에서 왔습니다',
  'studioChat.outside.body':
    '이 폴더는 FluidEQ가 만든 것이 아니며, 파일 속 텍스트가 AI에게 명령 실행을 지시할 수 있으므로 매번 먼저 묻습니다. 내 장면이거나 누가 만들었는지 안다면 신뢰하세요. 이후에는 내 장면으로 취급됩니다.',
  'studioChat.outside.trust': '이 장면을 신뢰합니다',
  'studioChat.memberCopy.title': '멤버의 장면: AI가 명령마다 먼저 묻습니다',
  'studioChat.memberCopy.body':
    '이 장면의 파일 속 텍스트가 AI에게 무언가를 실행하라고 할 수 있으므로, 명령마다 먼저 묻습니다. 멤버의 장면은 신뢰함으로 표시할 수 없습니다.',
  'studioChat.past.title': '지난 채팅',
  'studioChat.past.empty':
    '아직 이전 채팅이 없습니다. 새 채팅을 시작하면 이 채팅이 여기에 유지됩니다.',
  'studioChat.past.loading': '이전 채팅을 찾는 중…',
  'studioChat.past.fromClaude': '클로드 코드(Claude Code)가 보관함',
  'studioChat.past.fromClaudeHint':
    'Claude Code의 자체 사본에서 발견됨: 메시지는 돌아오지만 가져올 버전은 돌아오지 않습니다.',
  'studioChat.past.delete': '이 채팅 삭제',
  'studioChat.past.busy':
    '다른 채팅을 열기 전에 Claude가 끝날 때까지 기다리세요.',
  'studioChat.zoom.label': '채팅 텍스트 크기',
  'studioChat.zoom.in': '더 큰 텍스트',
  'studioChat.zoom.out': '더 작은 텍스트',
  'studioChat.zoom.reset': '정사이즈로 돌아옴',
  'studioChat.copy': '복사',
  'studioChat.latest': '최신으로 이동',
  'studioChat.latestWriting': 'Claude가 아직 작성 중: 최신으로 이동',
  'studioChat.copied': '복사됨',
  'studioChat.sketch.title': '그림 위에 그림을 그리세요',
  'studioChat.sketch.lead':
    '사물에 동그라미를 치거나 화살표로 가리키거나 옆에 글을 쓰거나 중요한 부분만 잘라내세요. Claude는 그림과 함께 표시를 봅니다. 확대한 그림은 Space를 누른 채 드래그하면 움직일 수 있습니다.',
  'studioChat.sketch.done': '이 그림 사용',
  'studioChat.sketch.attach': '채팅에 첨부',
  'studioChat.viewer.draw': '그리기',
  'studioChat.viewer.drawHint':
    '확대한 곳에서 이 그림 위에 그린 뒤, 다음 메시지에 첨부합니다.',
  'studioChat.sketch.cancel': '취소',
  'studioChat.sketch.undo': '실행 취소',
  'studioChat.sketch.clear': '지우기',
  'studioChat.sketch.ink': '색상',
  'studioChat.sketch.red': '빨간색',
  'studioChat.sketch.yellow': '노란색',
  'studioChat.sketch.cyan': '청록색',
  'studioChat.sketch.white': '화이트',
  'studioChat.sketch.width': '펜',
  'studioChat.sketch.thin': '얇은 펜',
  'studioChat.sketch.thick': '두꺼운 펜',
  'studioChat.sketch.canvas': '무대 그림에 그림을 그리다',
  'studioChat.sketch.open': '그림 위에 그림을 그리세요',
  'studioChat.sketch.remove': '그림 삭제',
  'studioChat.sketch.tool': '도구',
  'studioChat.sketch.pen': '펜',
  'studioChat.sketch.arrow': '화살표',
  'studioChat.sketch.text': '텍스트',
  'studioChat.sketch.textHint': '입력한 다음 Enter를 누르세요.',
  'studioChat.sketch.crop': '자르기',
  'studioChat.sketch.cropApply': '자르기',
  'studioChat.sketch.cropHint': '상자 안의 부분만 남깁니다 (Enter)',
  'studioChat.accounts.title': '계정',
  'studioChat.accounts.open': '채팅에서 사용하는 계정 확인',
  'studioChat.accounts.claude': '클로드',
  'studioChat.accounts.unknown': '로그인됨',
  'studioChat.accounts.switch': '다른 계정 사용',
  'studioChat.accounts.claudeMissing':
    'Claude Code가 이 컴퓨터에 설치되어 있지 않습니다.',
  'studioChat.accounts.claudeOut': 'Claude Code가 로그인되어 있지 않습니다.',
  'studioChat.accounts.fine':
    'FluidEQ는 해당 계정이 어떤 계정인지 표시하며 해당 계정의 로그인은 볼 수 없습니다.',
  'studioChat.welcomeSceneTitle': '{name}에서 무엇을 변경해야 합니까?',
  'studioChat.welcomeSceneBody':
    'Claude에게 무엇을 바꿔야 하는지 알려주세요. 어떻게 보이는지, 음악에 맞춰 움직이는 방법, 색상, 빛 등을 알려주세요. Claude는 이 장면을 편집하고 무대에서 각 버전을 재생합니다.',
  'studioChat.queue.title':
    '대기 중 · Claude는 다음 단계에서 이 내용을 함께 읽습니다.',
  'studioChat.queue.send': '대기열: Claude가 다음 단계에서 대기열을 읽습니다.',
  'studioChat.queue.remove': '회수',
  'studioChat.queue.sent':
    '클로드에게 전달됨: 현재 단계가 완료되면 이를 읽습니다.',
  'studioChat.queue.picture': '무대 사진과 함께',
  'studioChat.step.compact': '대화를 압축했습니다.',
  'studioChat.step.compactNow': '대화를 압축하는 중…',
  'studioChat.step.compactTokens': '{before} → {after} 토큰',
  'studioChat.compact.label': '콤팩트',
  'studioChat.context.share': '{percent}%(컨텍스트)',
  'studioChat.context.detail':
    'Claude의 컨텍스트 창에 있는 {window} 토큰의 {used}. 컴팩트하게 공간을 확보하세요.',
  'studioChat.context.tokens': '{used} 컨텍스트 토큰',
  'studioChat.limits.fiveHour': '현재 세션(5시간)',
  'studioChat.limits.week': '이번주',
  'studioChat.limits.used': '{percent}% 사용됨',
  'studioChat.limits.resets': '{time}를 재설정합니다.',
  'studioChat.limits.asOf': '{time} 기준 · Claude가 답변할 때마다 업데이트됨',
  'studioChat.limits.none':
    'Claude가 메시지에 응답하면 여기에 5시간 및 주간 한도가 표시됩니다.',
  'studioChat.context.tokensOf': '{window} 토큰의 {used}',
  'studioChat.context.explain':
    '모든 메시지는 전체 대화를 전달합니다. Compact는 지금까지의 내용을 요약하므로 이후의 메시지는 더 적게 전달됩니다.',
  'studioChat.queue.sendNow': '지금 보내기',
  'studioChat.queue.sendNowHint':
    'Claude가 진행 중인 단계를 중지하고 이제 이를 하나의 메시지로 읽습니다.',
  'studioChat.step.times': '×{count}',
  'studioChat.picked.lead':
    '장면에서 선택함 (따로 말하지 않으면 이것만 바꿔 줘):',
  'studioChat.picked.label': '장면에서 선택함',
  'studioChat.picked.remove': '{name} 제거',
  'studioChat.accounts.gpt': 'GPT',
  'studioChat.accounts.gptFound': 'Claude Code에 있는 내 GPT 플러그인({name})',
  'studioChat.accounts.higgsfield': 'Higgsfield',
  'studioChat.accounts.higgsfieldReady': '내 Claude Code를 통해 연결됨',
  'studioChat.accounts.higgsfieldNote':
    '내 Higgsfield 크레딧으로 이미지, 애니메이션 프레임, 3D 모델을 만듭니다.',
  'studioChat.accounts.higgsfieldMissing':
    '아직 설정되지 않았습니다. FluidEQ가 Higgsfield의 도구를 내 Claude Code에 추가하고 브라우저에서 로그인 페이지를 열 수 있습니다. Higgsfield는 유료 요금제가 필요하며, 만드는 모든 것에 크레딧이 사용됩니다.',
  'studioChat.accounts.higgsfieldOut':
    'Higgsfield가 Claude Code에 있지만 로그인되어 있지 않습니다.',
  'studioChat.accounts.higgsfieldUnreachable':
    'Claude Code가 지금 Higgsfield에 연결하지 못했습니다.',
  'studioChat.accounts.higgsfieldConnecting':
    '브라우저의 Higgsfield 페이지에서 로그인을 마치세요. 완료되면 이 카드가 업데이트됩니다.',
  'studioChat.accounts.higgsfieldSetUp': 'Higgsfield 설정',
  'studioChat.accounts.higgsfieldSignIn': 'Higgsfield로 로그인',
  'studioChat.accounts.higgsfieldAbout': 'Higgsfield란?',
  'studioChat.accounts.checkAgain': '다시 확인',
  'studioChat.ask.makerFrames': '이 애니메이션 프레임을 무엇으로 만들까요…',
  'studioChat.ask.makerGpt': '내 GPT 플러그인, ChatGPT 요금제 사용',
  'studioChat.ask.makerHiggsfield':
    '내 Higgsfield 크레딧. Claude가 먼저 비용을 알려 줍니다.',
  'studioChat.ask.makerRemember': '선택 기억하기(계정에서 변경)',
} satisfies Partial<Dictionary>;

export default studioChat;
