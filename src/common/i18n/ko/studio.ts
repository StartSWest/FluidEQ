/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const studio = {
  'studio.notes.failed':
    '프로젝트 설명을 저장할 수 없습니다. 다시 시도해 보세요.',
  'studio.stage.loading': '장면 로드 중…',
  'studio.picture.download': '이미지 저장',
  'studio.picture.downloaded': '이미지가 저장되었습니다',
  'studio.picture.downloadFailed': '이미지를 저장할 수 없습니다.',
  'studio.picture.separate': '별도의 이미지({count})',
  'studio.picture.separateHint':
    '이것은 하나의 이미지의 일부입니다. 저장하면 장면이 변경되지 않습니다.',
  'studio.picture.view': '{name} 크게 보기',
  'studio.picture.previous': '이전 이미지',
  'studio.picture.next': '다음 이미지',
  'studio.picture.position': '{count}의 {index}',
  'studio.picture.all': '모든 이미지',
  'studio.picture.close': '닫기',
  'studio.picture.zoomIn': '확대',
  'studio.picture.zoomOut': '축소',
  'studio.picture.fit': '핏',
  'studio.project.previous': '이전 프로젝트',
  'studio.project.next': '다음 프로젝트',
  'studio.title': '스튜디오',
  'studio.description': 'AI로 장면을 만들고 라이브로 시청하세요',
  'studio.rail.blurb': '나만의 장면 만들기',
  'studio.maker.title': 'AI로 만들어 보세요',
  'studio.maker.describe': '장면을 설명하세요',
  'studio.maker.placeholder':
    '그것이 보여주는 것과 비트, 베이스, 트레블에 따라 움직이는 것. 당신의 사진도 생생하게 살아날 수 있습니다.',
  'studio.maker.examples': '또는 다음 중 하나부터 시작하세요.',
  'studio.maker.openTitle': 'AI 도우미에서 프로젝트 폴더를 엽니다.',
  'studio.maker.openBody':
    '파일 작업을 수행하는 모든 도우미: Claude, Cursor, Codex, Copilot. 대신 채팅을 통해 제공되는 파일을 이 폴더에 저장하세요.',
  'studio.maker.openNoProject':
    '먼저 프로젝트를 시작하세요. 해당 폴더는 AI가 작동하는 곳입니다.',
  'studio.maker.copyPath': '경로 복사',
  'studio.maker.pathCopied': '경로가 복사되었습니다.',
  'studio.maker.pathCopyFailed':
    '클립보드를 사용할 수 없습니다. 경로가 선택되었습니다. Ctrl+C를 누릅니다.',
  'studio.maker.pasteTitle': '이 프롬프트를 붙여넣으세요.',
  'studio.maker.pasteBody':
    '마지막에 아이디어와 함께 FluidEQ 장면이 어떻게 만들어지는지 AI에게 알려줍니다. 저장한 모든 파일은 바로 무대에서 재생됩니다.',
  'studio.maker.copied': '복사됨',
  'studio.maker.showPrompt': '프롬프트 보기',
  'studio.maker.hidePrompt': '프롬프트 숨기기',
  'studio.action.copyPrompt': 'AI 프롬프트 복사',
  'studio.action.showFolder': '폴더 표시',
  'studio.action.addToLooks': '내 외모에 추가',
  'studio.action.export': '내보내기…',
  'studio.action.desktop': '데스크탑에 올려보세요...',
  'studio.action.publish': '게시…',
  'studio.action.import': '장면 파일 열기…',
  'studio.project.label': '프로젝트',
  'studio.project.group': '귀하의 프로젝트',
  'studio.project.groupOfficial': 'FluidEQ 내부를 들여다 볼 장면',
  'studio.project.inspect': 'FluidEQ 장면 내부를 살펴보세요…',
  'studio.project.none': '프로젝트를 선택하세요',
  'studio.project.empty': '아직 프로젝트가 없습니다.',
  'studio.project.add': '폴더 열기…',
  'studio.project.forget': '목록에서 {name} 제거',
  'studio.project.new': '새로운 프로젝트…',
  'studio.project.forgetHint': '폴더와 해당 파일은 컴퓨터에 유지됩니다.',
  'studio.project.rename': '{name} 이름 바꾸기…',
  'studio.rename.title': '프로젝트 이름 바꾸기',
  'studio.rename.lead':
    '장면과 해당 폴더 모두 새 이름을 사용합니다. FluidEQ는 폴더 이름이 바뀌는 동안 해당 파일을 놓은 다음 장면을 다시 엽니다.',
  'studio.rename.where': '폴더',
  'studio.rename.save': '이름 바꾸기',
  'studio.rename.saving': '이름을 바꾸는 중…',
  'studio.rename.exists':
    '그 옆에는 이미 {name}라는 폴더가 있습니다. 다른 이름을 선택하세요.',
  'studio.rename.failed':
    '폴더 이름을 바꿀 수 없습니다. 해당 파일을 사용하여 모든 항목을 닫은 후 다시 시도하세요.',
  'studio.new.title': '새 프로젝트',
  'studio.new.lead':
    '이름을 지어주세요. FluidEQ는 이미 움직이는 장면으로 폴더를 만듭니다.',
  'studio.new.name': '이름',
  'studio.new.placeholder': '북극광',
  'studio.new.where': '들어간다',
  'studio.new.change': '변경…',
  'studio.new.create': '프로젝트 생성',
  'studio.new.creating': '만드는 중…',
  'studio.new.cancel': '취소',
  'studio.new.exists':
    '거기에는 이미 {name}라는 폴더가 있습니다. 다른 이름을 선택하세요.',
  'studio.new.invalid':
    '해당 이름은 폴더 이름이 될 수 없습니다. 문자와 숫자를 사용해 보세요.',
  'studio.new.failed':
    '폴더를 만들 수 없습니다. 변경을 통해 다른 장소를 선택하세요.',
  'studio.publish.title': '{name} 게시',
  'studio.publish.titleUpdate': '갤러리에서 {name}를 업데이트하세요.',
  'studio.publish.version': '버전 {version}',
  'studio.publish.publishedVersion': '현재 갤러리에 있음: 버전 {version}',
  'studio.publish.note': '이 버전의 새로운 기능',
  'studio.publish.notePlaceholder':
    '한 줄 청취자는 다음과 같은 내용을 볼 수 있습니다. 넓은 패널에서 피크가 더 이상 잘리지 않습니다.',
  'studio.publish.hears': '그 장면이 들리는 것',
  'studio.publish.yourMusic': '당신의 음악',
  'studio.publish.demo': '데모',
  'studio.publish.capture': '이 순간을 포착하세요',
  'studio.publish.capturing': '캡처 중…',
  'studio.publish.quietTitle': '재생 중인 항목이 없습니다.',
  'studio.publish.quietBody':
    '모든 앱에서 음악을 재생하거나 데모를 사용하세요.',
  'studio.publish.useDemo': '데모 사용',
  'studio.publish.cover': '표지',
  'studio.publish.coverHint':
    '장면이 가장 멋지게 보이는 순간을 포착하세요. 진드기가 있는 표지는 갤러리에서 보여주는 표지입니다.',
  'studio.publish.auto': '자동',
  'studio.publish.shot': '커버 {number}',
  'studio.publish.missed': '그 순간은 포착할 수 없었다. 다시 시도해 보세요.',
  'studio.publish.stageHeavy':
    '여기서 플레이하기에는 장면이 너무 무거워요. 아래 덮개는 여전히 작동합니다.',
  'studio.publish.stageUnavailable':
    '지금은 여기서 장면을 재생할 수 없습니다. 아래 덮개는 여전히 작동합니다.',
  'studio.publish.category': '카테고리',
  'studio.publish.categoryHint': '최대 2개. 카드에 첫 번째가 표시됩니다.',
  'studio.publish.pickCategory': '먼저 카테고리를 선택하세요',
  'studio.publish.needNote': '먼저 이 버전의 새로운 기능을 말해보세요.',
  'studio.publish.noteNeeded': '필요',
  'studio.publish.point1':
    '로그인한 사람은 누구나 Visualizer에서 볼 수 있으며 몇 초 동안 시청하면 크레딧을 받을 수 있습니다. 그것은 당신을 위해 무료로 재생됩니다.',
  'studio.publish.point3':
    '새로운 사람이 얻을 수 없도록 게시를 취소할 수 있습니다. 이미 가지고 있는 사람은 그것을 유지합니다.',
  'studio.publish.point3Update':
    '추가한 회원은 업데이트를 볼 수 있으며, 이를 누를 때까지 이전 버전을 유지합니다.',
  'studio.publish.read': '약관 읽기',
  'studio.publish.cancel': '취소',
  'studio.publish.go': '게시',
  'studio.publish.goUpdate': '업데이트 게시',
  'studio.publish.agree': '동의 및 게시',
  'studio.publish.running': '게시 중…',
  'studio.publish.done': '{name}가 갤러리에 있으며 그래프에서 재생 중입니다.',
  'studio.publish.updated':
    '갤러리에는 {name}의 새 버전이 있으며 그래프도 마찬가지입니다.',
  'studio.publish.noPicture':
    '사진을 촬영할 수 없습니다. 장면을 재생한 후 다시 시도하세요.',
  'studio.publish.offline':
    '게시하려면 연결이 필요합니다. 온라인으로 다시 시도해 보세요.',
  'studio.publish.rateLimited':
    '한 시간 동안 게시하는 데 많은 양이 소요됩니다. 나중에 다시 시도하세요.',
  'studio.publish.tooManyThisMonth':
    '한 달이 허락하는 한 많은 장면을 보내주셨습니다. 다음 달에 다시 게시할 수 있습니다.',
  'studio.publish.tooManyScenes':
    '갤러리에 {count} 장면이 있거나 검토 대기 중입니다. 회원 한 명이 가질 수 있는 최대 장면입니다. 새 장면을 게시하려면 장면에서 게시를 취소하세요.',
  'studio.publish.signedOut': '장면을 게시하려면 로그인하세요.',
  'studio.publish.failed': '장면을 게시할 수 없습니다. 다시 시도해 보세요.',
  'studio.publish.officialCopy':
    '이 장면의 대부분은 FluidEQ의 장면 중 하나입니다. 그들로부터 아이디어를 얻고, 게시하기 전에 장면을 자신만의 것으로 만드십시오.',
  'studio.publish.outdated':
    '약관에 최신 버전이 있습니다. 읽고 게시하려면 FluidEQ를 업데이트하세요.',
  'studio.publish.versionTaken':
    '이 장면은 얼마 전 또 공개됐습니다. 한 번 더 시도하면 다음 버전으로 출시됩니다.',
  'studio.publish.takenDown':
    'FluidEQ가 이 장면을 갤러리에서 내려왔으므로 새 버전을 사용할 수 없습니다. FluidEQ가 복원하는 경우에만 원래대로 돌아올 수 있습니다.',
  'studio.publish.deleted':
    'FluidEQ가 이 장면을 갤러리에서 완전히 삭제했으므로 다시 게시할 수 없습니다.',
  'studio.picture.files': '사진',
  'studio.picture.missing':
    '장면은 귀하의 사진을 사용하며 폴더에는 아직 사진이 없습니다.',
  'studio.picture.hint':
    '아래 장면의 그림에서 선택하세요. 어떤 사진이라도 작동합니다.',
  'studio.picture.title': '현장 사진',
  'studio.picture.lead':
    '장면은 이것을 요구합니다. 각각의 사진을 선택하면 FluidEQ가 그 사진에 맞습니다.',
  'studio.picture.pick': '사진을 선택하세요…',
  'studio.picture.replace': '변경…',
  'studio.picture.empty': '아직 사진이 없습니다',
  'studio.picture.size': '{width} × {height}',
  'studio.picture.unnamed': '사진 {number}',
  'studio.picture.saving': '사진을 저장하는 중…',
  'studio.picture.saved': '귀하의 사진이 현장에 있습니다.',
  'studio.picture.noSlot': '이 장면은 사진을 사용하지 않습니다.',
  'studio.picture.badSlot':
    'pack.json은 FluidEQ가 만들 수 없는 사진을 요청합니다. AI에게 일반 파일 이름과 최대 4096 × 2048 크기를 요청하세요.',
  'studio.picture.tooLarge':
    '해당 파일은 40MB를 초과합니다. 더 작은 사진을 선택하세요.',
  'studio.picture.unreadable':
    'FluidEQ가 해당 사진을 읽을 수 없습니다. JPG 또는 PNG를 사용해 보세요.',
  'studio.picture.failed':
    '사진을 프로젝트 폴더에 저장할 수 없습니다. 다시 시도해 보세요.',
  'studio.notice.copyFailed':
    '클립보드를 사용할 수 없습니다. 아래에서 프롬프트가 선택되었습니다. Ctrl+C를 누릅니다.',
  'studio.notice.added':
    '{name}는 귀하의 외모에 있으며 Made by you 아래에 있습니다.',
  'studio.notice.updated':
    '{name}가 Made by you 아래의 스타일에서 업데이트됩니다.',
  'studio.notice.addFailed': '이 버전은 재생 후 추가할 수 있습니다.',
  'studio.notice.exported':
    '{file}가 준비되었습니다. 누구에게 보내든 FluidEQ에서 열 수 있습니다.',
  'studio.share.title': '당신이 만든 장면을 공유하세요',
  'studio.share.lead':
    '당신의 장면은 당신의 것으로 남습니다. 하나를 내보내면 다른 구성원이 해당 항목을 열 수 있으며, 소유한 후에는 해당 항목을 재생할 수 있습니다.',
  'studio.share.point1':
    '파일을 제공한 사람은 장면을 소유한 후에만 해당 장면을 재생하고 게시된 후에 크레딧을 제공합니다. 그들은 그것을 팔 수 없습니다.',
  'studio.share.point3':
    '주석은 셰이더에서 제거되고 표시 이름은 장면과 함께 사용됩니다.',
  'studio.share.read': '약관 읽기',
  'studio.share.cancel': '지금은 아님',
  'studio.share.agree': '동의하고 내보내기',
  'studio.share.running': '내보내는 중…',
  'studio.export.offline':
    '내보내려면 연결이 필요합니다. 온라인으로 다시 시도해 보세요.',
  'studio.export.rateLimited':
    '한 시간 동안 많은 양의 수출이 이루어졌습니다. 나중에 다시 시도하세요.',
  'studio.export.refused':
    'FluidEQ는 이 버전을 승인할 수 없습니다. 표시되는 내용을 수정하고 저장하세요.',
  'studio.export.signedOut': '장면을 내보내려면 로그인하세요.',
  'studio.export.failed': '장면을 내보낼 수 없습니다. 다시 시도해 보세요.',
  'studio.export.officialCopy':
    '이 장면의 대부분은 FluidEQ의 장면 중 하나입니다. 여기에서 아이디어를 얻고 내보내기 전에 장면을 자신만의 것으로 만드세요.',
  'studio.inspect.title': 'FluidEQ 장면, 내부 살펴보기',
  'studio.inspect.body':
    '어떻게 만들어지는지 확인하고 자신만의 장면에 대한 아이디어를 얻어보세요. 여기에서 원하는 대로 변경해 보세요. 스타일에 추가하거나 게시하거나 내보낼 수 없습니다.',
  'studio.inspect.locked':
    '내부를 보기 위해 열어본 FluidEQ 장면입니다. 스타일에 추가하거나 게시하거나 내보낼 수 없습니다.',
  'studio.export.banned': '이 계정은 더 이상 장면을 공유할 수 없습니다.',
  'studio.export.outdated':
    '약관에 최신 버전이 있습니다. 읽고 내보내려면 FluidEQ를 업데이트하세요.',
  'studio.import.done': '{author}의 {name}가 당신의 모습에 있습니다.',
  'studio.import.doneAnonymous': '{name}가 당신의 모습에 있습니다.',
  'studio.import.own':
    '{name}는 당신의 것입니다. 당신의 모습으로 돌아왔습니다.',
  'studio.import.ownRestored':
    '{name}는 당신의 것입니다. 다시 예전 모습으로 돌아왔습니다. 여기를 열어 계속 작업하세요.',
  'studio.import.unreadable': '해당 파일은 FluidEQ 장면이 아닙니다.',
  'studio.import.signedOut': '장면 파일을 열려면 로그인하세요.',
  'studio.new.signedOut': '프로젝트를 시작하려면 로그인하세요.',
  'studio.import.changed':
    '해당 파일은 내보낸 후 변경되었으므로 FluidEQ는 해당 파일을 재생하지 않습니다.',
  'studio.import.blocked': '해당 장면은 삭제되었습니다.',
  'studio.idea.pet.label': '내 애완동물, 살아있어요',
  'studio.idea.pet.text':
    '음악과 함께 살아있는 내 애완동물의 사진. 베이스와 함께 부드럽게 호흡하고, 부드러운 빛의 테두리가 모든 비트의 윤곽을 추적하고, 색상이 중음과 함께 따뜻하며, 고음과 함께 주변에서 작은 반짝임이 솟아납니다. 중요한 순간마다 그 뒤에는 색종이 조각이 새로운 색상으로 피어납니다. 침묵 속에서 그것은 천천히 숨을 쉴 뿐이다. 빛, 반짝임 및 움직이는 정도에 대한 슬라이더입니다. 대기 모드의 앱 주변에는 작은 발자국과 하트가 떠다닙니다.',
  'studio.idea.city.label': '네온시티',
  'studio.idea.city.text':
    '비 온 뒤 밤의 네온 도시. 스카이라인은 나의 스펙트럼입니다. 각 타워는 음악의 고유한 부분으로 솟아오릅니다. 왼쪽은 저음, 오른쪽은 고음이며, 파도의 높이와 위치에 따라 서 있습니다. 창문은 중간 소리와 함께 깜박이고, 옥상 신호등은 박자에 맞춰 깜박이며, 매 순간마다 기차가 앞쪽의 다리를 건너갑니다. 젖은 거리는 모든 것을 반영하고 파형으로 잔물결을 일으킵니다. 침묵 속에서 오직 교통만이 기어다닌다. 비, 창문 및 네온 불빛을 위한 슬라이더. 주변 모드의 앱 주변: 부드러운 도시의 불빛이 보케처럼 떠다닙니다.',
  'studio.idea.sea.label': '심해',
  'studio.idea.sea.text':
    '밤에는 바다 깊은 곳. 빛나는 해파리가 내 파도 속에 떠다니고, 저음과 함께 종소리가 울리고, 중음과 함께 긴 촉수가 흔들리고, 고음과 함께 반짝이는 플랑크톤과 희미한 광선이 위에서 아래로 표류합니다. 작은 물고기 떼가 비트에 맞춰 빠르게 지나가고, 중요한 순간마다 고래의 그림자가 등을 가로질러 미끄러지듯 움직입니다. 모든 것이 침묵 속에서 잔잔한 표류로 느려집니다. 빛, 깊이 및 해파리 수에 대한 슬라이더입니다. 대기 모드의 앱 주변: 거품이 천천히 올라갑니다.',
  'studio.idea.vinyl.label': '바이닐',
  'studio.idea.vinyl.text':
    '어둡고 따뜻한 방에서 위에서 본 레코드 플레이어. 레코드는 일정한 속도로 회전하며 그루브는 링 모양으로 빛나고 라벨 근처에서는 베이스가, 가장자리에서는 고음이 켜집니다. 스타일러스는 박자마다 빛을 내며 작은 불꽃을 일으키며, 라벨의 색상은 중간 부분에 따라 바뀌고, 고음 부분에서는 램프 조명에 먼지가 떠다닙니다. 매 순간마다 빛의 고리가 음반 전체를 휩쓸고 지나갑니다. 침묵 속에서 그것은 계속 회전하고, 은은한 조명을 받습니다. 회전 속도, 빛 및 먼지를 위한 슬라이더. 대기 모드의 앱 주변: 음표가 위쪽으로 표류합니다.',
  'studio.idea.fire.label': '캠프파이어',
  'studio.idea.fire.text':
    '별빛 아래 소나무 숲에서 캠프파이어를 합니다. 불꽃은 나의 스펙트럼이며, 나의 파도 속에 서 있습니다. 각각의 불의 혀는 음악의 고유한 부분에 맞춰 도약합니다. 하이햇 위에서 불씨가 날아오르고, 베이스와 함께 통나무가 더 깊게 빛나고, 중음과 함께 주위의 나무들이 불빛을 받고, 고음과 함께 별들이 반짝입니다. 매 순간마다 나선형의 불꽃이 밤하늘로 올라갑니다. 침묵 속에서 그것은 낮고 꾸준하게 타오른다. 화재 크기, 불씨 및 연기에 대한 슬라이더입니다. 대기 모드의 앱 주변: 반딧불이가 돌아다니고 몇 개의 불꽃이 솟아오릅니다.',
  'studio.idea.sunset.label': '골든아워',
  'studio.idea.sunset.text':
    '황금시간대의 산골짜기. 먼 능선은 나의 스펙트럼이며, 내 파도 안의 음악의 일부로 상승하고 안정되며, 거리가 멀어짐에 따라 안개로 희미해집니다. 낮은 태양은 저음으로 부드럽게 부풀고, 구름은 중음으로 붉게 물들고, 아래 강은 고음으로 반짝입니다. 매 순간마다 새 떼가 매번 다른 방식으로 태양을 가로질러 날아갑니다. 침묵 속에는 구름만이 떠다닌다. 태양 높이, 안개 및 구름에 대한 슬라이더입니다. 대기 모드의 앱 주변: 가끔 새 몇 마리가 활공합니다.',
  'studio.prompt.label': 'AI 프롬프트',
  'studio.hears.level': '전반적인 음량',
  'studio.hears.beat': '모든 비트의 맥박',
  'studio.hears.bass': '베이스 라인과 킥 드럼',
  'studio.hears.mid': '보이스와 코드',
  'studio.hears.treble': '하이햇과 공기',
  'studio.hears.voice': '노래하는 목소리: 얼마나 개방적이며 음표는',
  'studio.hears.spectrum': '모든 주파수에서 빠르거나 부드럽습니다.',
  'studio.hears.accent': '몇 초마다 드물게 일어나는 큰 순간',
  'studio.hears.balance': '음악이 왼쪽이나 오른쪽으로 기울어지는 곳',
  'studio.hears.width': '스테레오의 폭은 얼마나 됩니까?',
  'studio.hears.tempo': '음악의 시계: 마디의 네 박자, 그 박자, BPM의 템포',
  'studio.hears.sure':
    '시계가 박자에 얼마나 확실한지; 춤을 추면 떨어지면서 진정된다',
  'studio.hears.kick': '킥 드럼, 히트할 때마다',
  'studio.hears.snare': '스네어와 박수, 히트할 때마다',
  'studio.hears.hats': '히트할 때마다 하이햇과 심벌즈',
  'studio.hears.momentum':
    '음악이 회전하는 바퀴: 킥과 시끄러운 부분이 속도를 높이다가 저절로 느려집니다.',
  'studio.hears.intensity': '노래의 이 부분이 얼마나 강렬한지',
  'studio.hears.build': '무언가를 향해 나아가는 노래',
  'studio.hears.drop':
    '낙하 착륙; 숫자는 숫자를 계산하므로 각각 다르게 보일 수 있습니다.',
  'studio.status.live': '마지막 저장에서 업데이트됨',
  'studio.status.problem': '마지막 작업 버전이 아직 재생 중입니다.',
  'studio.status.waiting': '재생되는 버전을 기다리는 중',
  'studio.version.group': '버전',
  'studio.version.looks': 'v{version}처럼 보입니다.',
  'studio.version.looksCurrent': '당신의 외모에는 바로 이 장면이 있습니다.',
  'studio.version.looksBehind':
    '귀하의 외모에는 {version} 버전의 이전 저장 버전이 있습니다. 내 외모에 추가하면 최신 정보를 얻을 수 있습니다.',
  'studio.version.gallery': '갤러리 v{version}',
  'studio.version.label': 'v{version}',
  'studio.version.unpublished':
    '이 장면의 버전 {version}. 출판되지 않았습니다.',
  'studio.version.live':
    '이 장면의 {version} 버전과 사람들이 가지고 있는 버전입니다.',
  'studio.version.ahead':
    '이 장면의 버전 {version}. 버전 {published}는 사람들이 가지고 있는 버전입니다.',
  'studio.empty': '아직 표시할 항목이 없습니다.',
  'studio.stage.label': '{name}, 라이브로 재생 중',
  'studio.stage.resize': '미리보기 크기를 조정하려면 드래그하세요.',
  'studio.stage.startTitle': '여기서 장면이 재생됩니다.',
  'studio.stage.startBody':
    '프로젝트를 시작하면 FluidEQ가 이미 움직이는 장면이 포함된 폴더를 만듭니다. 당신의 AI가 거기에서 그것을 변경합니다.',
  'studio.meters.title': '지금 들리는 것',
  'studio.meters.sound': '소리',
  'studio.meters.rhythm': '리듬',
  'studio.meters.song': '노래',
  'studio.meter.level': '레벨',
  'studio.meter.beat': '비트',
  'studio.meter.bass': '베이스',
  'studio.meter.mid': '미드',
  'studio.meter.treble': '고음',
  'studio.meter.voice': '음성',
  'studio.meter.voiceNotes': 'C C♯ D D♯ E F F♯ G G♯ A A♯ B',
  'studio.meter.accent': '악센트',
  'studio.meter.balance': '잔액',
  'studio.meter.width': '폭',
  'studio.meter.tempo': '템포',
  'studio.meter.sure': '자신감',
  'studio.meter.kick': '킥',
  'studio.meter.snare': '스네어',
  'studio.meter.hats': '모자',
  'studio.meter.momentum': '스핀',
  'studio.meter.intensity': '강도',
  'studio.meter.build': '빌드',
  'studio.meter.drop': '드롭',
  'studio.test.title': '현장을 체험해 보세요',
  'studio.ship.title': '준비가 되면',
  'studio.work.label': '현장에서 일하세요',
  'studio.work.make': 'AI로 만들기',
  'studio.work.pictures': '사진',
  'studio.work.tune': '튜닝',
  'studio.ship.more': '더보기',
  'studio.signals.title': '오디오 미리보기',
  'studio.signals.hint':
    '청취자들은 항상 장면이 자신의 음악에 반응하는 것을 봅니다. 테스트 신호는 이 미리보기만 구동합니다. 이는 저장되거나 게시되지 않으며 오디오를 변경하지 않습니다.',
  'studio.signal.live': '당신의 음악',
  'studio.signal.silence': '침묵',
  'studio.signal.bass': '베이스',
  'studio.signal.mid': '미드',
  'studio.signal.treble': '고음',
  'studio.signal.beat': '비트',
  'studio.signal.accent': '악센트',
  'studio.signal.showcase': '시뮬레이션된 믹스',
  'studio.signalHint.live':
    '이 컴퓨터에서 재생되는 내용은 장면에서 그래프로 들을 수 있습니다.',
  'studio.signalHint.silence':
    '전혀 없습니다. 느린 표류만으로 좋은 장면이 여기에 있습니다.',
  'studio.signalHint.bass':
    '재생되는 것은 베이스뿐입니다. 로우엔드로 움직이는 것을 보여줍니다.',
  'studio.signalHint.mid': '재생되는 것의 중간 부분만: 음색과 코드입니다.',
  'studio.signalHint.treble': '연주되는 것의 고음만: 하이햇과 에어입니다.',
  'studio.signalHint.beat': '118BPM으로 모든 비트를 킥합니다.',
  'studio.signalHint.accent':
    '7.5초마다 한 번씩 큰 순간이 옵니다. 마치 코러스를 치는 것과 같습니다.',
  'studio.signalHint.showcase':
    '표지를 찍을 때처럼 모든 채널이 한꺼번에 바빠집니다.',
  'studio.meters.heard': '연주했다',
  'studio.meters.got': '장면이 얻는 것',
  'studio.settings.title': '장면 설정',
  'studio.settings.controls': '컨트롤',
  'studio.settings.controlsLead':
    '이 장면이 가져오는 슬라이더는 코드 이름으로 명명됩니다.',
  'studio.settings.response': '음악에 어떻게 반응하는가',
  'studio.settings.responseLead':
    '듣기 전에 듣는 것을 구부리십시오. 100%와 0에서는 음악을 있는 그대로 듣습니다.',
  'studio.settings.ambient': '창의 요소',
  'studio.settings.ambientLead':
    '이 장면은 대기 모드에서 앱 주변에 추가되는 것입니다.',
  'studio.settings.ambientOff': '이를 보려면 창 모양을 Ambient로 전환하세요.',
  'studio.settings.sensitivity': '감도',
  'studio.settings.sensitivityHint':
    '얼마나 강하게 반응하는지. 조용한 트랙에는 더 많고, 큰 트랙에 계속 고정되어 있으면 덜합니다.',
  'studio.settings.threshold': '임계값',
  'studio.settings.thresholdHint':
    '그 아래에서는 아무 소리도 들리지 않으므로 조용한 부분을 통해 쉴 수 있습니다.',
  'studio.settings.attack': '어택',
  'studio.settings.attackHint':
    '그것이 듣는 것에 얼마나 빨리 상승하는지. 짧은 것은 펀치감 있고, 긴 것은 부풀어 오른다.',
  'studio.settings.release': '릴리스',
  'studio.settings.releaseHint':
    '얼마나 천천히 뒤로 물러나는지. Long은 적중할 때마다 빛을 남깁니다.',
  'studio.settings.percent': '{percent}%',
  'studio.settings.ms': '{ms}ms',
  'studio.settings.reset': '재설정',
  'studio.settings.resetsToScene':
    '재설정은 이를 장면의 자체 설정으로 되돌립니다.',
  'studio.settings.resetsToPublished':
    '재설정하면 게시한 버전인 {version}로 다시 돌아갑니다.',
  'studio.settings.carries':
    '손을 놓으면 장면에 저장됩니다. 외모와 갤러리에도 저장됩니다.',
  'studio.settings.saving': '장면에 저장 중…',
  'studio.settings.saved': '장면에 저장되었습니다.',
  'studio.settings.savedLook': '장면과 장면에 대한 모습이 저장됩니다.',
  'studio.settings.failed': '설정을 저장할 수 없습니다. 다시 시도해 보세요.',
  'studio.picture.adjust': '프레임…',
  'studio.framing.title': '프레임 “{name}”',
  'studio.framing.hint':
    '드래그하여 사진을 이동하세요. 스크롤하거나 슬라이더를 사용하여 확대/축소합니다.',
  'studio.framing.stage':
    '{name}가 그 자리에 있습니다. 화살표 키는 사진을 이동하고 플러스 및 마이너스 확대/축소를 수행합니다.',
  'studio.framing.role': '사진 프레임',
  'studio.framing.fit': '사진이 어떻게 어울리는지',
  'studio.framing.cover': '공간을 채우다',
  'studio.framing.contain': '전체 사진',
  'studio.framing.zoom': '줌',
  'studio.framing.percent': '{percent}%',
  'studio.framing.reset': '장면에서 알 수 있듯이',
  'studio.framing.another': '또 다른 사진…',
  'studio.framing.cancel': '취소',
  'studio.framing.use': '이 사진을 사용하세요',
  'studio.framing.saving': '저장 중…',
  'studio.size.full': '전체 화면',
  'studio.size.player': '컴팩트 플레이어 뒤에',
  'studio.size.playerHint':
    '컴팩트 플레이어로서의 장면은 열린 모양으로 전체 창 뒤에 표시됩니다. 장면은 좁은 창 자체에서 중요한 부분을 볼 수 있도록 유지합니다.',
  'studio.size.exit': '전체 화면 종료',
  'studio.wave.title': '그래프의 파동',
  'studio.wave.hint':
    '장면에 저장되고 함께 게시되므로 떠날 때 열립니다. 이를 사용하는 사람은 누구나 그래프 보기에서 이를 변경하고 다시 넣을 수 있습니다. 극단적인 방법을 시도해 보세요. 낮은 파도 또는 중간으로 올라간 파도입니다.',
  'studio.tint.label': '이 장면의 FluidEQ',
  'studio.tint.theme': '테마',
  'studio.brightness.hint':
    '전체 앱의 밝기는 창 색상과 동일한 슬라이더입니다. 모든 장면은 밤 0시부터 하루 종일 100시까지 진행됩니다. 게시하기 전에 양쪽에서 시도해 보세요.',
  'studio.tint.hint':
    '여기에서만 작업하는 동안 그래프의 창 색상이 설정한 대로 유지됩니다. 테마는 앱에 있는 창을 그대로 유지합니다. 다른 것들은 이 장면의 색상을 부여하거나 음악과 함께 주변을 부드럽게 빛나게 하여 모든 청취자가 느끼는 대로 보고 느낄 수 있습니다.',
  'studio.grid.label': '그래프 그리드 표시',
  'studio.grid.hint':
    '장면 위의 주파수 및 레벨 선과 그래프에서 공간을 차지하므로 파도와 장면의 각 부분이 어디에 도달하는지 측정할 수 있습니다.',
  'studio.performance.title': '성능',
  'studio.performance.hint':
    '그래프, 이 단계 및 데스크탑에 대한 하나의 선택: 그래프 메뉴와 동일한 행입니다.',
  'studio.cost.full': '원활하게 실행',
  'studio.cost.reading': '{ms} ms · {fps} fps · {size}%',
  'studio.cost.readingRate': '{fps}fps · {size}%',
  'studio.cost.scaled': '{percent}% 크기로 그려짐',
  'studio.cost.heavy': '이 컴퓨터에 사용하기에는 너무 무거움',
  'studio.cost.unavailable': '이 컴퓨터는 지금 장면을 그릴 수 없습니다',
  'studio.file.pack': 'pack.json',
  'studio.file.source': '셰이더',
  'studio.file.artwork': '그림',
  'studio.file.world': '3D 세계',
  'studio.problem.heading': '이 버전은 아직 재생할 수 없습니다',
  'studio.problem.line': '{file}, 라인 {line}',
  'studio.problem.too-large': '셰이더는 256KB를 초과합니다.',
  'studio.problem.unterminated-comment': '/* 주석은 절대 닫히지 않습니다.',
  'studio.problem.preprocessor':
    '#으로 시작하는 줄은 허용되지 않습니다. #define 대신 const를 사용하세요.',
  'studio.problem.non-ascii': '주석 외부에는 일반 ASCII 문자만 허용됩니다.',
  'studio.problem.while':
    'while 루프는 허용되지 않습니다. 고정 개수의 for 루프를 사용하세요.',
  'studio.problem.do':
    'do 루프는 허용되지 않습니다. 고정 개수의 for 루프를 사용하세요.',
  'studio.problem.main':
    '장면은 main()을 정의하면 안 됩니다. FluidEQ가 씁니다.',
  'studio.problem.loop-shape':
    '루프는 하나의 고정 숫자에서 다른 숫자로 계산되어야 합니다.',
  'studio.problem.loop-bound': '루프는 128회 이상 실행됩니다.',
  'studio.problem.loop-assign':
    '루프는 자체 카운터를 변경하거나 이를 out 또는 inout 매개변수가 있는 함수에 전달합니다. 대신 사본을 전달하세요.',
  'studio.problem.loop-budget':
    '루프 내부의 루프와 이들이 호출하는 함수는 픽셀당 너무 많이 실행됩니다. 더 적게 중첩하거나 더 적은 회전을 사용하십시오.',
  'studio.problem.entry-point': 'vec4 sceneColour(vec2 uv) 기능이 없습니다.',
  'studio.problem.not-a-pack': 'FluidEQ가 읽을 수 있는 장면이 아닙니다.',
  'studio.problem.bad-id':
    'ID는 2~48자의 소문자, 숫자, 대시로 구성되어야 합니다.',
  'studio.problem.names-missing': '영어 이름이 필요합니다.',
  'studio.problem.name-too-long': '이름이 40자를 초과합니다.',
  'studio.problem.bad-fallback':
    'fallbackStyle은 FluidEQ의 모양 중 하나가 아닙니다.',
  'studio.problem.bad-swatch':
    '견본에는 #00e5cf와 같이 2~4개의 색상이 필요합니다.',
  'studio.problem.bad-artwork':
    '사진은 pack.json이 제공하는 크기의 WebP가 아닙니다.',
  'studio.problem.bad-param':
    'params의 컨트롤에는 a-z, 0-9 및 _의 ID와 영어 이름, 그리고 최대값 아래에 최소값이 필요합니다.',
  'studio.problem.too-many-params':
    '장면의 매개변수에는 최대 8개의 컨트롤이 있을 수 있습니다.',
  'studio.problem.no-daylight':
    '모든 장면에는 일광 제어(매개변수에 {control})가 필요하며 밤을 0으로, 낮을 100으로 그립니다.',
  'studio.problem.bad-ambient':
    'pack.json의 일부 주변 요소 또는 컨트롤이 생략되었습니다. 모양, 움직임, 색상, 개수 및 각 컨트롤이 움직이는 것을 확인하세요.',
  'studio.problem.bad-world':
    '3D 세계에는 이 버전에서 그릴 수 있는 것이 없습니다. 노드, 재료 및 공식을 확인하십시오.',
  'studio.problem.bad-model':
    '3D 모델은 자체 조명, 인스턴스화 또는 압축 없이 모든 버퍼와 이미지를 내부에 전달하는 .glb여야 합니다.',
  'studio.problem.model-too-heavy':
    '3D 모델에는 총 500,000개 이상의 삼각형 또는 1,600만 개 이상의 픽셀이 포함되어 있습니다.',
  'studio.problem.pack-too-large':
    '전체 장면은 9MB보다 크며, 이는 장면을 공유할 수 있는 최대 크기입니다. 더 가벼운 모델이나 더 작은 사진을 사용하십시오.',
  'studio.problem.bad-json': 'pack.json은 유효한 JSON이 아닙니다.',
  'studio.problem.missing-file': '장면에 필요한 파일이 누락되었습니다.',
  'studio.problem.unsafe-path':
    '파일 이름은 이 폴더에 있는 파일의 일반 이름이어야 합니다.',
  'studio.problem.file-too-large': '파일이 장면에서 허용하는 것보다 큽니다.',
  'studio.world.heading': '3D 세계는 그려지지 않고 하늘만 그려졌네요',
  'studio.world.partial': '3D 세계의 일부가 제외되었습니다.',
  'studio.worldNote.engine-missing':
    'FluidEQ는 여기에서 3D 엔진을 실행할 수 없으므로 하늘이 단독으로 재생됩니다.',
  'studio.worldNote.engine-failed':
    '3D 엔진이 오류로 인해 중지되었습니다: {detail}',
  'studio.worldNote.engine-unsupported':
    '이 컴퓨터의 그래픽은 3D 세계를 장면에 그릴 수 없습니다.',
  'studio.worldNote.material':
    '머티리얼의 GLSL이 컴파일되지 않았습니다. 그래픽 드라이버는 다음과 같이 말합니다.',
  'studio.worldNote.model-refused':
    '모델 “{model}”는 FluidEQ가 읽을 수 있는 모델이 아니므로 제외되었습니다.',
  'studio.worldNote.model-unreadable':
    '모델 “{model}”를 읽을 수 없습니다: {detail}',
  'studio.compile.heading': '셰이더가 컴파일되지 않았습니다.',
  'studio.compile.hint': '문제를 수정하고 AI에 오류를 저장하거나 붙여넣으세요.',
  'studio.heavy.body':
    '크기가 8분의 1이 되어도 부드러운 동작을 유지할 수 없어서 FluidEQ는 화면이 정지되기 전에 이를 중지했습니다. 더 적은 수의 루프 단계, 더 적은 수의 텍스처 읽기 또는 더 적은 수의 레이어를 사용해 보십시오.',
  'studio.code.title': '코드',
  'studio.code.label': '{file}의 코드',
  'studio.code.watching': '저장되면 업데이트됩니다.',
  'studio.code.unsaved': '저장되지 않음',
  'studio.code.save': '저장',
  'studio.code.saving': '저장 중…',
  'studio.code.failed': '저장할 수 없습니다. 다시 시도해 보세요.',
  'studio.code.tooLarge': '장면의 최대 크기는 64KB입니다. 저장되지 않았습니다.',
  'studio.code.changed':
    '여기에 입력하는 동안 Studio 외부에서 파일이 변경되었습니다.',
  'studio.code.load': '새 버전을 로드하세요.',
  'studio.code.keep': '내 수정사항 유지',
  'studio.code.missing': '이 프로젝트에는 아직 표시할 장면 파일이 없습니다.',
  'studio.code.showChanges': '변경사항 표시',
  'studio.code.showCode': '코드로 돌아가기',
  'studio.code.updatedAt': '{time}에서 외부로 변경됨',
  'studio.code.unchanged': '{count} 변경되지 않은 라인',
  'studio.code.delta': '{added} 라인 추가됨, {removed} 제거됨',
  'studio.publish.pointReview':
    'FluidEQ는 갤러리에 표시되기 전에 모든 장면을 검토합니다. 승인되면 알려드리겠습니다.',
  'studio.publish.pointReviewUpdate':
    'FluidEQ는 모든 새 버전도 검토합니다. 장면이 있는 모든 사람은 이 장면이 승인될 때까지 현재 버전을 유지합니다.',
  'studio.publish.goReview': '검토를 위해 보내기',
  'studio.publish.goReviewUpdate': '검토를 위해 업데이트 보내기',
  'studio.publish.agreeReview': '동의하고 검토를 위해 보냅니다.',
  'studio.publish.runningReview': '보내는 중…',
  'studio.publish.submitted':
    '{name}가 그래프에서 재생 중이며 검토를 위해 전송되었습니다. 승인되면 알려드리겠습니다.',
  'studio.publish.submittedUpdate':
    '{name}의 새 버전이 그래프에서 재생 중이며 검토를 위해 전송되었습니다. 다른 모든 사람은 승인될 때까지 현재 버전을 유지합니다.',
  'studio.agent.title': 'AI에게 무대를 보여주세요',
  'studio.agent.body':
    'AI 어시스턴트는 FluidEQ가 그린 장면을 재생하는 그대로 정확하게 보고, 재생할 수 없는 경우 FluidEQ의 자체 이유를 읽어냅니다. 또한 연주하는 노래가 어떻게 움직이는지도 학습하며, 소리 자체나 노래 이름은 학습하지 않습니다. 복사한 프롬프트가 자동으로 연결됩니다. 이 컴퓨터에서만 키와 Studio 프로젝트만 사용할 수 있습니다.',
  'studio.agent.failed':
    'FluidEQ가 이를 켤 수 없습니다. 전원을 껐다가 다시 켜세요.',
  'studio.agent.setupTitle': 'AI를 한 번 연결하세요',
  'studio.agent.byHand': 'AI를 직접 연결하세요',
  'studio.agent.assistant': '당신의 AI 비서',
  'studio.agent.claude': 'Claude Code',
  'studio.agent.codex': '코덱스',
  'studio.agent.other': '기타',
  'studio.agent.claudeHint':
    '터미널에서 이것을 실행한 다음 새로운 Claude Code 세션을 시작하세요.',
  'studio.agent.codexHint':
    '사용자 폴더의 .codex/config.toml 끝에 이를 추가한 다음 새 Codex 세션을 시작하세요.',
  'studio.agent.otherHint':
    '대부분의 AI 도구는 MCP 서버 설정에서 이를 사용합니다. 추가한 후 새 세션을 시작하세요.',
  'studio.agent.copy': '설정 복사',
  'studio.agent.copyFailed':
    '귀하의 컴퓨터는 그것을 복사하지 않습니다. 전체 내용이 표시되며 아래에 선택되어 있습니다. Ctrl+C를 누릅니다.',
  'studio.agent.newKey': '새 키',
  'studio.agent.keyHint':
    '열쇠를 사용하면 AI만 들어갈 수 있습니다. 새 키는 이전 AI에 부여한 모든 AI를 잠급니다.',
  'studio.agent.hearing': 'AI 듣기',
  'studio.agent.hearingIdle': '장면에 원하는 노래를 재생하세요.',
  'studio.agent.hearingSong': '지금까지 이 노래의 {time}',
} satisfies Partial<Dictionary>;

export default studio;
