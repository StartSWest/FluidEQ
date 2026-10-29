/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const tour = {
  'tour.contribute': '기여해주세요',
  'tour.eyebrow': '이 버전의 새로운 기능',
  'tour.title': 'FluidEQ의 새로운 기능',
  'tour.close': '닫기',
  'tour.rail': '새로운 기능',
  'tour.stepOf': '{total}의 {current}',
  'tour.back': '뒤로',
  'tour.next': '다음',
  'tour.done': '알았어요',
  'tour.dontShowAgain': '이 버전에서는 이 항목을 다시 표시하지 않음',
  'tour.releaseNotes': '전체 릴리스 노트',
  'tour.rail.newIn': '{version}의 새로운 기능',
  'tour.rail.always': 'FLUIDEQ에도 있습니다',
  'tour.newBadge': '새로운',
  'tour.howTitle': '시작하는 방법',
  'tour.beta': '베타',
  'tour.player.kicker': '컴팩트 플레이어',
  'tour.player.title': '하나의 열에 전체 앱',
  'tour.player.subtitle': '모든 창 색상에서 동일한 플레이어 1명',
  'tour.player.lead':
    '제목 표시줄에 있는 스위치 중 하나는 FluidEQ를 하나의 열로 접습니다. 상단의 시각화 도우미에는 노래, 컨트롤, 사운드 및 다음에 재생할 내용이 표시됩니다. 모든 창 색상의 동일한 플레이어이며 {backdrop}에서 선택한 장면이 모든 창 뒤에서 재생됩니다.',
  'tour.player.point1':
    '{sound}는 저음, 중음, 고음 노브 또는 EQ 자체 밴드를 보유하고 있으며 그 옆에는 프리셋 Smart EQ 및 EQ 모드가 있습니다.',
  'tour.player.point2':
    '{upNext} 및 {playlists}는 기슭에서 기다립니다. 더 큰 그림을 보려면 양쪽 부분을 접어서 플레이어의 아무 곳에나 음악을 놓아 대기열에 추가하세요.',
  'tour.player.point3':
    '하나의 너비를 유지하며 높이는 위쪽 또는 아래쪽 가장자리부터 사용자의 것입니다. 한 줄로 접어서 위에 놓거나, 그림을 더블클릭해서 화면을 꽉 채워보세요.',
  'tour.player.how':
    '도움말 옆의 제목 표시줄에서 컴팩트 플레이어 스위치를 누릅니다. 플레이어에서 동일한 스위치를 누르면 전체 앱이 다시 표시됩니다.',
  'tour.player.open': '컴팩트 플레이어를 사용해 보세요',
  'tour.player.imageAlt':
    '{player} 스위치가 울리고 컴팩트 플레이어가 두 번 울리는 제목 표시줄 모서리: EQ 밴드가 열려 있고 노래 뒤의 표준 비주얼라이저와 톤 노브가 열려 있는 {backdrop}의 장면 위에 있습니다.',
  'tour.player.scene': '{backdrop}의 장면 포함',
  'tour.player.standard': '표준 비주얼라이저 사용',
  'tour.look.kicker': '새로운 모습',
  'tour.look.title': '새로운 색상의 새 창',
  'tour.look.subtitle': '하나의 테마 슬라이더와 그 뒤에 있는 시각화 도우미',
  'tour.look.lead':
    '유리창은 새 아이콘의 색상으로 열린 바닥에 서 있으며, 하나의 슬라이더 {brightness}는 전체 창을 거의 검은색에서 연한 바다색으로 바꿉니다. 그래프의 장면을 통해 창은 색상을 취하거나 모든 것 뒤에서 재생되도록 할 수 있습니다.',
  'tour.look.point1':
    '{brightness}는 펄스 아이콘 뒤의 메뉴에 있고 {windowColours} 아래의 {transparency} 옆에 있습니다.',
  'tour.look.point2':
    '{windowColours}는 {original}, {colours}, {ambient} 및 {backdrop}를 제공하며 각각 창에 수행되는 작업에 대한 줄이 있습니다.',
  'tour.look.point3':
    '대화 상자와 메뉴는 하나의 자료를 공유하며 {rainbow}는 아이콘의 색상이나 시각화 도우미의 색상을 통해 실행됩니다.',
  'tour.look.how':
    '오른쪽 상단 펄스 아이콘 뒤의 메뉴에서 {brightness}를 이동하세요. 그래프에 장면이 있는 경우 그래프 막대에서 {windowColours}를 열고 {backdrop}를 선택합니다.',
  'tour.look.open': '오픈 EQ',
  'tour.look.imageAlt':
    'EQ 페이지에 자체 색상으로 표시된 FluidEQ, 곡선 아래에 노래를 그리는 분석기, 모서리 위에 열리는 펄스 아이콘 뒤의 메뉴, 밝기가 절반이고 컬러풀 모드가 켜져 있습니다.',
  'tour.gpu.kicker': '새로운 비주얼라이저 엔진',
  'tour.gpu.title': '그래픽 카드의 모든 비주얼라이저',
  'tour.gpu.subtitle': '마흔은 화면 자체의 속도와 3D 세계를 살펴봅니다.',
  'tour.gpu.lead':
    '이제 그래프의 40가지 모양은 장면이 실행되는 엔진에서 그려집니다. 즉, 그래픽 카드에서 화면 자체의 새로 고침 빈도로 막대, 입자 및 피크가 밟았던 위치로 미끄러집니다. 이제 장면은 실제 3D 세계가 될 수 있습니다.',
  'tour.gpu.point1':
    '{scenes}에는 {synthwave}, {horizon}, {towers} 및 {ledwall} 등 18개의 새로운 디자인이 있습니다. 그 자체의 색깔이 없는 모습이 창문을 입고 있다.',
  'tour.gpu.point2':
    '{brightness}를 사용하면 3D 세계가 킥을 밟고, 스네어와 함께 흔들리고, 드롭에서 도약하고 밤낮으로 회전합니다. 다른 쪽에서 보려면 하나를 드래그하세요.',
  'tour.gpu.point3':
    '변화하는 모습은 한 장면에서 다음 장면으로 사라지고, 3D 세계는 창이 가려져 있는 동안 그래픽 메모리를 다시 돌려줍니다.',
  'tour.gpu.how':
    '그래프에서 스타일의 이름을 클릭하고 {scenes}에서 하나를 선택합니다.',
  'tour.gpu.open': '오픈 EQ',
  'tour.gpu.imageAlt':
    '밤의 3D 도시 장면과 그래프에 촬영된 4개의 새로운 모습({synthwave}, {horizon}, {towers} 및 {ledwall})과 첫 번째에 모양 선택기가 울립니다.',
  'tour.gpu.world': '3D 세계',
  'tour.sparks.kicker': '포인터 불꽃',
  'tour.sparks.title': '마우스에 응답하는 비주얼라이저',
  'tour.sparks.subtitle': '포인터에서 나오는 불꽃, 꽃잎 또는 눈',
  'tour.sparks.lead':
    '장면 위로 마우스를 이동하면 포인터 뒤의 흔적에 불꽃, 꽃잎, 눈, 불씨 등 구성 요소가 던져지고 클릭할 때마다 터집니다. {ambient}와 {backdrop}에서는 새, 꽃잎, 빛이 전체 창 위로 떠다닙니다.',
  'tour.sparks.point1':
    '각 비주얼라이저는 겨울 장면의 눈, 캠프파이어의 불씨, 정원의 꽃잎 등 고유한 이미지를 제공합니다.',
  'tour.sparks.point2':
    '스튜디오의 무대에서는 항상 장면을 보여주므로 장면 제작자가 장면의 모양을 만들 수 있습니다.',
  'tour.sparks.point3':
    '모든 비주얼라이저에 대한 하나의 스위치: {sparks}, {rainbow} 아래의 {windowColours}.',
  'tour.sparks.how':
    '그래프의 장면에서 마우스를 해당 장면 위로 이동하고 클릭합니다. {sparks}는 {rainbow} 아래의 {windowColours}에 있습니다.',
  'tour.sparks.open': '오픈 EQ',
  'tour.sparks.imageAlt':
    '포인터 뒤에 빛나는 불꽃의 흔적이 있고 클릭할 때 폭발하는 오로라 비주얼라이저와 {sparks} 스위치가 울리는 {windowColours}.',
  'tour.sound.kicker': 'FLUIDEQ 엔진',
  'tour.sound.title': '당신이 그린 그대로 소리가 나요',
  'tour.sound.subtitle': '그려진 대로 고음, 자동 스위치, 한 단계의 레벨',
  'tour.sound.lead':
    'FluidEQ 엔진에서 곡선은 이제 20kHz까지 그려진 대로 정확히 재생되고 모든 변경 사항은 클릭하는 대신 크로스페이드되며 {autoNormalize}는 한 단계로 새로운 곡선 레벨에 도달합니다. 고음 구성 방법은 {precise} 또는 {classic} 중에서 선택할 수 있습니다.',
  'tour.sound.point1':
    '{precise}는 그려진 대로 각 밴드를 구성합니다. 48kHz 출력에서 고음은 20kHz에서 3.8dB 짧게 도달하는 데 사용되었습니다. {classic}는 Equalizer APO가 수행하는 방식과 AutoEQ가 수정을 조정하는 방식으로 이를 구축합니다.',
  'tour.sound.point2':
    '전환 시 프리셋이 교차됩니다. 636개의 스위치 중 534개가 딱딱거리는 소리를 냈고 이제 −80dBFS 이상으로 올라가는 스위치는 없습니다.',
  'tour.sound.point3':
    '모든 편집 내용은 편집하는 순간 들리며, {autoNormalize}는 음악의 마지막 10초부터 작업한 한 단계로 해당 레벨로 이동합니다.',
  'tour.sound.how':
    'EQ를 열고 {eqMode}를 누릅니다. {treble}에서 EQ 및 수정을 위해 {precise} 또는 {classic}를 별도로 선택하십시오.',
  'tour.sound.open': '오픈 EQ',
  'tour.sound.imageAlt':
    '{eqMode} 메뉴는 {treble}가 {precise}로 설정된 버튼 아래에 열립니다. {precise}가 그려진 대로 재생하고 {classic}가 48kHz 출력에서 20kHz에서 3.8dB 짧게 재생하는 고음 곡선; 프리셋 스위치로 5kHz 이상의 사운드: 2.0 이전에는 -26dBFS 클릭, 현재는 -80dBFS 이상 클릭이 없습니다.',
  'tour.sound.trebleChart': '고음, 1~20kHz',
  'tour.sound.switchChart': '5kHz 이상, 프리셋 스위치로',
  'tour.sound.before': '2.0 이전',
  'tour.sound.now': '2.0',
  'tour.graph.kicker': '스튜디오 뷰',
  'tour.graph.title': '스튜디오 같은 소리를 읽는 그래프',
  'tour.graph.subtitle': '12개 뷰, 80dB 분석기',
  'tour.graph.lead':
    '그래프는 스튜디오 분석기가 수행하는 방식으로 재생되는 내용을 측정합니다. 즉, 스펙트로그램과 워터폴부터 스테레오, 음량 및 위상까지 12개의 보기를 음악이 움직이는 동안 고정되는 스케일로 측정합니다.',
  'tour.graph.point1':
    '{analyzer}, {spectrogram}, {rta}, {waterfall}, {scope} 외 7개, Look Picker의 {analysis} 아래에 있습니다.',
  'tour.graph.point2':
    '라이브 사운드는 80dB 깊이에서 포인트당 1/12옥타브인 10Hz까지 그려지므로 톤이 실제 레벨로 읽혀집니다.',
  'tour.graph.point3':
    'EQ는 ±20dB를 유지하며 가장자리에 더 멀리 가는 곡선을 위한 공간을 두고 분석기가 인쇄할 때 주파수에 10, 20, 50, 100으로 표시됩니다.',
  'tour.graph.how':
    '그래프에서 모양 이름을 클릭하고 {analysis} 아래에서 보기를 선택합니다. 그래프를 두 번 클릭하여 화면을 채웁니다. Ctrl+G는 그리드를 표시하거나 숨깁니다.',
  'tour.graph.open': '오픈 EQ',
  'tour.graph.imageAlt':
    '재생 중인 노래에 대한 그래프의 분석기: 80dB 깊이의 라이브 스펙트럼과 그 위에 피크가 있고 EQ 곡선이 상단에 있고 모서리에는 분석 아래 보기 목록이 있습니다.',
  'tour.games.kicker': '게임 프리셋',
  'tour.games.title': '모든 게임, 고유한 사운드',
  'tour.games.subtitle': '게임이 전면에 나오면 전환됨',
  'tour.games.lead':
    '각 게임마다 한 번씩 사운드를 선택하세요. 게임이 앞으로 나오면 FluidEQ가 해당 게임으로 전환하여 게임을 닫을 때까지 유지합니다. 그러나 종종 Alt 키를 누른 다음 원래 있던 것을 되돌립니다.',
  'tour.games.point1':
    'Steam, Epic Games, EA, GOG, Ubisoft, Battle.net 및 Xbox 게임 또는 열려 있는 모든 프로그램.',
  'tour.games.point2':
    '게임 프리셋은 게임 모드를 켜서 FluidEQ가 추가하는 지연을 줄이고 페이지에 측정된 지연이 표시됩니다.',
  'tour.games.point3':
    '데스크탑의 카드에는 전환된 내용이 표시되고, 다른 카드에는 게임이 종료되었을 때 반환된 내용이 표시됩니다.',
  'tour.games.how':
    'EQ를 열고 게임 프리셋을 선택한 다음 게임 추가를 누릅니다. 그런 다음 해당 행의 선택기에서 사운드를 선택합니다.',
  'tour.games.open': '게임 프리셋 열기',
  'tour.games.imageAlt':
    '데스크탑에서의 세 순간: FluidEQ의 카드가 사운드가 로드되었다고 말하는 앞에 있는 게임, 사운드가 계속 켜져 있는 상태에서 동일한 게임이 최소화되고, 이전 사운드가 돌아왔다는 카드와 함께 게임이 닫혔습니다.',
  'tour.games.stepFront': '전면: 사운드 로드',
  'tour.games.stepAway': '최소화 또는 Alt 키: 소리가 계속 켜져 있습니다.',
  'tour.games.stepClosed': '휴무 : 당신만의 소리가 돌아온다',
  'tour.presets.kicker': '새로운 프리셋',
  'tour.presets.title': '음악처럼 들리는 프리셋',
  'tour.presets.subtitle': '체인 전체를 하나의 음량으로',
  'tour.presets.lead':
    '모든 프리셋이 다시 측정되고 레벨링되었으므로 전환하면 볼륨이 아닌 문자가 변경되며 이제 Equalizer APO에서와 마찬가지로 FluidEQ 엔진에서도 각 사운드가 명확하게 들립니다.',
  'tour.presets.point1':
    '{chains} 체인, {styles} 음악 스타일, 음악, 영화 및 게임의 룸 카피.',
  'tour.presets.point2':
    '프리셋의 곡선은 그래프에 자체 레이어로 표시되며 강도를 낮출 수 있습니다.',
  'tour.presets.point3':
    '모든 스타일은 그 자체로 설명됩니다. 하나를 가리키면 해당 메모가 목록 옆에 열립니다.',
  'tour.presets.how':
    'EQ를 열고 프리셋을 누르거나 DSP 상단에서 체인을 선택합니다.',
  'tour.presets.open': '오픈 EQ',
  'tour.presets.imageAlt':
    '선택한 Rock이 있는 프리셋 선택기 및 목록 옆에 메모: 번호가 매겨진 포인트가 있는 곡선, 각 포인트의 용도 및 재생 정도.',
  'tour.tone.kicker': '톤 컨트롤',
  'tour.tone.title': '베이스, 미드, 트레블, 마치 앰프처럼',
  'tour.tone.subtitle': '세 개의 손잡이, 고유한 곡선',
  'tour.tone.lead':
    '밴드를 선택하지 않으면 베이스, 미드, 트레블이 저음과 고음이 양쪽에 있는 고유한 곡선으로 사운드를 형성합니다. 노래를 따뜻하게 하거나 밝게 하는 가장 빠른 방법이며 모든 밴드는 사용자가 설정한 대로 정확하게 유지됩니다.',
  'tour.tone.point1': '이퀄라이저는 선택된 항목 없이 전체 랙에서 열립니다.',
  'tour.tone.point2': '새로운 20밴드 레이아웃과 표준 주파수의 모든 레이아웃.',
  'tour.tone.point3':
    '밴드는 간격만큼 넓게 열립니다. 밴드 사이에 구멍이 없고 두 밴드가 같은 음을 연주하지 않습니다.',
  'tour.tone.how':
    '밴드를 선택하지 않은 상태에서 EQ를 열고 베이스, 미드 또는 트레블을 설정하세요. 세 번째 손잡이를 다시 평평하게 만들려면 Ctrl 키를 누른 채 손잡이를 클릭하세요.',
  'tour.tone.open': '오픈 EQ',
  'tour.tone.imageAlt':
    '저음, 중음, 고음 3분의 1의 이퀄라이저 곡선, 이를 움직이는 3개의 손잡이, 6개에서 31개 밴드까지의 빠른 레이아웃.',
  'tour.studio.kicker': '플루이드큐 플러스',
  'tour.studio.title': '나만의 비주얼라이저 만들기',
  'tour.studio.subtitle': '모든 계정에 무료',
  'tour.studio.lead':
    'Studio는 아이디어를 음악과 함께 움직이는 장면으로 바꿔줍니다. 모든 계정에 무료입니다. 원하는 만큼 장면을 만들고, 내보내고, 게시할 수 있습니다.',
  'tour.studio.point1':
    '모든 장면은 갤러리에 게시되기 전에 검토되며, 승인되면 어디에서나 무료로 재생됩니다.',
  'tour.studio.point2':
    '장면은 발을 디디고 떨어지면 도약하는 실제 3D 세계가 될 수 있습니다.',
  'tour.studio.point3':
    'AI 프롬프트를 복사하면 AI 도우미가 장면을 보고 노래가 어떻게 움직이는지 들을 수 있습니다.',
  'tour.studio.how': 'Visualizers를 열고 레일에서 Studio를 선택합니다.',
  'tour.studio.open': '시각화 도우미 열기',
  'tour.studio.imageAlt':
    '무대에서 알파인, 눈 덮인 산봉우리와 오로라 아래의 호수를 재생하는 스튜디오에서는 AI가 있는 장면을 만드는 3단계와 두 개의 메모가 포함되어 있습니다. 모든 계정에 무료이며 게시된 장면은 제작자에게 무료로 재생됩니다.',
  'tour.studio.earned': '게시됨: 무료로 재생됩니다',
  'tour.help.kicker': '도움말',
  'tour.help.title': '가이드에게 자신만의 말로 물어보세요',
  'tour.help.subtitle': '오타와 복수형도 이해하는 우리말 가이드',
  'tour.help.lead':
    '친구에게 묻듯이 “소리가 안 나요”, “리미터”, “배경화면”처럼 원하는 내용을 우리말로 검색하세요. 가장 알맞은 장이 먼저 나오며, 그림에서 동그라미로 표시된 해당 조작 항목으로 바로 이동할 수 있습니다.',
  'tour.help.point1':
    '오타와 복수형을 용서하고 사람들이 사물에 사용하는 단어를 알고 있습니다.',
  'tour.help.point2':
    '그림의 모든 컨트롤에는 인쇄된 설명서처럼 번호가 매겨져 있습니다.',
  'tour.help.point3':
    'F1은 어디에서나 열 수 있으며 Enter는 다음 경기로 이동합니다.',
  'tour.help.how':
    'F1을 누르거나 제목 표시줄에서 책을 열고 사용 설명서를 선택한 다음 원하는 내용을 입력하세요.',
  'tour.help.open': '도움말 열기',
  'tour.help.imageAlt':
    '사용자 가이드는 "소리 없음"을 검색했습니다. 해당 장은 표시된 단어로 순위가 매겨져 있고 그림에는 컨트롤 번호가 매겨져 있습니다.',
  'tour.help.query': '소리가 나지 않는다',
  'tour.engine.kicker': '우리만의 오디오 엔진',
  'tour.engine.title': 'FluidEQ 엔진을 만나보세요',
  'tour.engine.subtitle': '듣는 모든 것을 위한 EQ 및 DSP',
  'tour.engine.lead':
    'FluidEQ에는 이제 자체 오디오 엔진이 있습니다. 사운드 카드 효과 후에 Windows 오디오 서비스 내에서 실행되며 라이브러리뿐만 아니라 게임, 브라우저, 스트리밍 앱 등 컴퓨터가 재생하는 모든 것에 EQ와 전체 DSP 랙을 제공합니다.',
  'tour.engine.point1':
    '모든 시스템 오디오의 DSP 랙(FluidEQ에서는 아무것도 재생되지 않음)',
  'tour.engine.point2':
    '노래를 아는 라이브 레벨링, 연주하면서 깔끔하게 정리되는 디노이즈.',
  'tour.engine.point3':
    'FluidEQ를 종료하면 충돌 후에도 사운드가 즉시 정상으로 돌아옵니다.',
  'tour.engine.how':
    '설치할 때 FluidEQ 엔진을 선택하거나 오른쪽 상단의 펄스 아이콘 뒤에 있는 작업 메뉴를 열고 상단의 엔진 카드를 누른 다음 FluidEQ 엔진을 선택하고 적용을 누릅니다. 그런 다음 DSP를 열고 앱이 재생되는 동안 무대를 켜세요.',
  'tour.engine.open': '개방형 DSP',
  'tour.engine.flow.label':
    '컴퓨터에서 재생되는 모든 내용은 FluidEQ 엔진(EQ, DSP 랙)을 거쳐 헤드폰과 스피커로 전달됩니다.',
  'tour.engine.flow.games': '게임',
  'tour.engine.flow.browser': '브라우저',
  'tour.engine.flow.music': '음악 앱',
  'tour.engine.flow.video': '비디오',
  'tour.engine.flow.inside': 'Windows 오디오 내부',
  'tour.engine.flow.eq': '당신의 EQ',
  'tour.engine.flow.rack': 'DSP 랙',
  'tour.engine.flow.headphones': '헤드폰',
  'tour.engine.flow.speakers': '스피커',
  'tour.room.kicker': '헤드폰 서라운드',
  'tour.room.title': '방에 앉아',
  'tour.room.subtitle': '24개 객실, 모두 무료',
  'tour.room.lead':
    'The Room은 헤드폰을 감상실로 바꿔 주며, 모든 채널에는 스피커가 주변에 서 있습니다. 13개의 새로운 객실이 11개의 클래식 객실에 추가되었으며 각 객실은 측정에 따라 구분되며 모두 무료입니다.',
  'tour.room.point1':
    '스테레오는 여러분 앞에 두 개의 스피커가 되거나, 요청하면 방을 가득 채울 수도 있습니다. 5.1 필름 5와 서브; 7.1 게임 전체 링.',
  'tour.room.point2':
    '추천 객실, 클래식 객실 또는 귀하의 객실에서 객실을 선택하세요. 방을 구성하는 모든 것이 해당 페이지에 있습니다.',
  'tour.room.point3':
    '듣기 테스트에서는 귀로 눈앞에 소리를 전달하는 머리를 5쌍으로 선택합니다.',
  'tour.room.how':
    'DSP를 열고 레일에서 Room을 선택한 후 켜세요. 방을 선택한 후 스피커를 드래그하거나 다이얼을 돌리세요. 머리 아래에서 듣기 테스트 시작을 누릅니다.',
  'tour.room.open': '방을 열어라',
  'tour.room.imageAlt':
    '위에서 본 방: 7개의 스피커와 중앙의 머리 주위에 서브가 서 있으며 각각 귀로 향하는 경로가 있습니다.',
  'tour.plus.kicker': '비주얼라이저',
  'tour.plus.title': '영원히 너의 것인 장면들',
  'tour.plus.subtitle': '비주얼라이저, 스튜디오, 조명 등',
  'tour.plus.lead':
    'FluidEQ의 성장을 유지하는 추가 기능의 전체 탭: 그래픽 카드에 그린 장면, 직접 만들 수 있는 스튜디오, 데스크탑 배경 및 동적 조명. 한 장면의 비용은 1크레디트이며 귀하의 것으로 유지되며, 이퀄라이저, 랙 및 플레이어는 항상 그래왔듯이 무료입니다.',
  'tour.plus.point1':
    '작업 메뉴의 계정에서 로그인하세요. 확인된 계정은 시작할 수 있는 무료 크레딧을 받습니다.',
  'tour.plus.point2':
    '크레딧 팩은 한 번만 지불되며 지불하기 전에 일반 용어로 용어가 표시됩니다. 아무것도 갱신되지 않으며 앱에서 카드를 볼 수 없습니다.',
  'tour.plus.point3':
    '모든 장면을 먼저 볼 수 있으며, 로그인한 모든 컴퓨터에서 재생되는 장면을 볼 수 있습니다.',
  'tour.plus.how':
    'Visualizers 탭을 엽니다. 갤러리, 스튜디오 및 동적 조명이 왼쪽 아래에 있습니다.',
  'tour.plus.open': '시각화 도우미 열기',
  'tour.plus.imageAlt':
    '비주얼라이저 탭: 측면 아래에는 갤러리, 스튜디오 및 동적 조명이 있고 Chrome, Bloom, Aurora, Alpine 및 Neon City가 포함된 갤러리가 있습니다.',
  'tour.scene.alpine': '알파인',
  'tour.scene.aurora': '오로라',
  'tour.scene.bloom': '블룸',
  'tour.scene.chrome': '크롬',
  'tour.scene.neonCity': '네온 시티',
  'tour.visualizers.kicker': '비주얼라이저',
  'tour.visualizers.title': '음악과 함께 움직이는 장면',
  'tour.visualizers.subtitle': '그래픽 카드에 그려진',
  'tour.visualizers.lead':
    '장면은 별빛 아래 산, 오로라 커튼, 네온 도시 등 그래픽 카드의 EQ 곡선 아래에 그려진 살아있는 그림입니다. 베이스, 비트, 고음은 각각 다르게 움직이며, 그 주위의 창은 해당 색상을 띌 수 있습니다.',
  'tour.visualizers.point1':
    '모든 것을 위한 하나의 선택기: {styles} 무료 스타일로 모양과 색상, 카테고리별 장면을 선택할 수 있습니다.',
  'tour.visualizers.point2':
    '갤러리를 탐색하고 FluidEQ의 샘플을 10초 동안 사용해 보고 마음에 드는 장면을 추가하세요.',
  'tour.visualizers.point3':
    '보기를 자동으로 전환하고, 전체 화면으로 전환하고, 보기에서 장면의 어택과 릴리스를 설정하세요.',
  'tour.visualizers.how':
    '그래프에서 Look의 이름을 클릭하고 Visualizers에서 하나를 선택하거나 Visualizers → Gallery에서 모두 찾아보세요.',
  'tour.visualizers.open': '오픈 EQ',
  'tour.visualizers.imageAlt':
    '밤에 호수 위에 산이 있는 장면을 EQ 곡선 아래 그래프에서 재생하는 알파인(Alpine)과 그 아래에 4개의 장면이 더 있습니다.',
  'tour.desktop.kicker': '데스크탑 비주얼라이저',
  'tour.desktop.title': '데스크탑 뒤에 있는 음악',
  'tour.desktop.subtitle': '모든 모니터의 장면',
  'tour.desktop.lead':
    '데스크탑 아이콘 뒤에 장면을 추가하세요. 여러분이 듣고 있는 음악과 함께 움직이거나 조용히 저절로 움직이며, 모든 모니터가 그 자체의 장면을 보여줄 수 있습니다.',
  'tour.desktop.point1':
    '책상 지도에서 모니터를 선택하세요. 각 모니터에는 자체 시각화 기능이 있습니다.',
  'tour.desktop.point2':
    'Windows가 모니터를 덮고 있는 동안, PC가 잠겨 있고 배터리가 켜져 있는 동안에는 일시 중지됩니다.',
  'tour.desktop.point3': '다음에 FluidEQ가 시작되면 자동으로 다시 나타납니다.',
  'tour.desktop.how':
    '그래프의 장면에서 이름 옆에 있는 모니터 버튼을 누르거나 보기 → 바탕화면 배경으로 설정을 선택하세요.',
  'tour.desktop.open': '오픈 EQ',
  'tour.desktop.imageAlt':
    '데스크탑 아이콘과 작업 표시줄 뒤에 각각 Aurora, Alpine, Neon City 장면을 표시하는 3개의 모니터가 있습니다.',
  'tour.lighting.kicker': '동적 조명',
  'tour.lighting.title': '장면에 따라 책상이 밝아집니다',
  'tour.lighting.subtitle': '베타 · RGB 장치는 비주얼라이저를 따릅니다.',
  'tour.lighting.lead':
    '키보드, 마우스, 마우스패드, 헤드셋 및 스탠드는 Windows Dynamic Lighting 및 Razer Chroma를 통해 그래프에 표시된 장면의 색상과 리듬을 구현합니다.',
  'tour.lighting.point1':
    '각 시각화 도우미에 대한 4가지 스타일: 장면, 색상 웨이브, 스펙트럼 및 비트 리플.',
  'tour.lighting.point2':
    '모든 장치를 자체적으로 조정하고 음악이 멈출 때 어떤 일이 일어날지 선택하세요.',
  'tour.lighting.point3':
    '실시간 미리보기를 통해 책상이 켜지는 대로 자신만의 책상이 그려집니다. 베타 버전입니다. 장치가 어떻게 작동하는지 알려주세요.',
  'tour.lighting.how':
    'Visualizers → 동적 조명을 열고 스위치를 켠 다음 그래프에 장면을 배치합니다.',
  'tour.lighting.open': '시각화 도우미 열기',
  'tour.lighting.imageAlt':
    '키보드, 마우스, 마우스 패드가 네온 시티의 핑크색, 보라색, 청록색으로 빛났습니다.',
  'tour.share.kicker': '모든 PC에서 양방향으로',
  'tour.share.title': '컴퓨터 간에 오디오 공유',
  'tour.share.subtitle':
    '어느 컴퓨터에 앉아 있든 그룹의 모든 컴퓨터 소리를 듣습니다.',
  'tour.share.lead':
    '게임용 PC, 노트북 및 네트워크의 다른 컴퓨터는 하나의 그룹으로 재생됩니다. 어느 곳에 앉아 있든 다른 컴퓨터의 소리는 무손실로 암호화되어 해당 컴퓨터의 자체 EQ를 통해 듣게 됩니다.',
  'tour.share.pairLabel': '양방향',
  'tour.share.pairName': '각 컴퓨터는 다른 컴퓨터의 소리를 재생합니다.',
  'tour.share.wireLabel': '무손실 · 암호화 · 사설 LAN',
  'tour.share.stepsTitle': '3단계로 설정하세요',
  'tour.share.step1Title': '한 컴퓨터에서 코드를 복사하세요.',
  'tour.share.step1':
    '오디오 공유 탭을 열고 "컴퓨터 추가"를 누른 다음 "코드 복사"를 누릅니다. 코드는 매번 동일하게 유지됩니다.',
  'tour.share.step2Title': '다른쪽에는 붙여넣고 링크하세요',
  'tour.share.step2':
    '거기에서 "컴퓨터 추가"를 누르고 "다른 컴퓨터의 코드" 아래에 코드를 붙여넣은 다음 "링크"를 누릅니다. 나중에 연결한 컴퓨터는 전체 그룹에 합류합니다.',
  'tour.share.step3Title': '어디로 갈지 선택하세요',
  'tour.share.step3':
    '각 컴퓨터에는 "수신"과 "보내기"가 있으며 "공유"는 모든 컴퓨터에 대해 사운드를 끕니다. "Your mix"는 각 레벨을 설정합니다. 일시 중지 및 연결 해제는 각 컴퓨터의 메뉴에 있으며 막대의 버튼은 전선 전체에서 작동합니다.',
  'tour.share.fact1Title': '무손실',
  'tour.share.fact1':
    'Float32 PCM 종단 간. 미디어 코덱이 없고 세대 손실이 없습니다.',
  'tour.share.fact2Title': '암호화됨',
  'tour.share.fact2':
    '모든 패킷의 AES-256-GCM. 코드가 핵심입니다. 그것 없이는 누구도 들을 수 없습니다.',
  'tour.share.fact3Title': '연결된 상태 유지',
  'tour.share.fact3':
    '그룹은 재시작, 절전, 네트워크 중단 또는 엔진 전환 후에 다시 자신을 찾습니다. 자리를 비운 컴퓨터는 목록에 남습니다.',
  'tour.share.tip':
    '조용히 시작하세요. 동시에 재생되는 컴퓨터가 추가됩니다. 첫 번째 링크 전에 볼륨을 낮추세요.',
  'tour.share.open': '오디오 공유 열기',
  'tour.library.kicker': '당신의 음악, 당신의 플레이어',
  'tour.library.title': '소유한 음악을 위한 라이브러리',
  'tour.library.subtitle': '폴더가 들어오고 앨범이 나옴',
  'tour.library.lead':
    '폴더에 FluidEQ를 지정하면 태그 및 커버 아트가 포함된 모든 노래와 비디오를 읽어 앨범, 아티스트, 장르, 노래 또는 폴더별로 탐색할 수 있는 컬렉션으로 변환합니다. 재생은 FluidEQ의 자체 플레이어를 통해 실행되므로 EQ와 DSP 랙은 항상 경로에 있습니다.',
  'tour.library.point1':
    '동일한 책장을 보는 세 가지 방법: 목록, 그리드 및 표지 흐름, 대규모 컬렉션의 경우 문자로 바로 이동.',
  'tour.library.point2':
    '목록이 소진되면 동일한 장르를 더 많이 계속 재생하는 "계속 재생"이 포함된 Up Next 대기열입니다.',
  'tour.library.point3':
    '재생 목록 및 영구 즐겨찾기 목록. 노래를 마우스 오른쪽 버튼으로 클릭하여 대기열에 추가하거나 대기열에 추가하세요.',
  'tour.library.point4':
    'Smart EQ 노래 메모리: Smart EQ가 측정을 계속하는 동안 "이 노래에 저장"을 뒤집고 2분 후에 해당 트랙에 대한 수정 사항이 유지되고 다시 재생할 때 돌아옵니다.',
  'tour.library.how':
    '라이브러리 탭을 열고 "폴더 추가"를 누르거나 페이지에 폴더를 놓은 다음 스캔이 완료되도록 하세요. 앨범, 아티스트, 장르, 노래, 폴더 또는 트리를 선택한 다음 재생을 누릅니다.',
  'tour.library.open': '오픈 라이브러리',
  'tour.dsp.kicker': '마스터링 랙',
  'tour.dsp.title': 'DSP 랙',
  'tour.dsp.subtitle': '10개의 단계, 각 단계는 자체 페이지에 있음',
  'tour.dsp.lead':
    '스튜디오 효과를 모은 랙입니다. 노멀라이저, 노이즈 제거, 익사이터, Bass Forge, 이퀄라이저, Bass Punch, 스테레오 확장, 룸, 맥시마이저, 마스터와 라이브러리 트랙 사이의 크로스페이드가 있습니다. FluidEQ 엔진에서는 컴퓨터에서 재생되는 모든 소리에 적용되며, Equalizer APO에서는 라이브러리 재생에 적용됩니다. 각 단계에는 실시간 시각화가 있는 전용 페이지가 있고 대부분 프리셋도 제공합니다. 다섯 단계는 분리 듣기를 켜서 해당 효과가 더하는 소리만 들을 수 있습니다.',
  'tour.dsp.point1':
    'Denoise는 재생 시 쉿쉿거리는 소리, 윙윙거리는 소리, 딸깍거리는 소리를 교정하고, 신경 음성 클리너는 라이브러리 트랙에서 작동합니다.',
  'tour.dsp.point2':
    'Bass Forge는 베이스 아래에 실제 옥타브를 추가합니다. Bass Punch는 최대 200%의 믹스로 어택, 서스테인 및 블룸을 형성합니다.',
  'tour.dsp.point3':
    '최소 또는 선형 위상, 미드/사이드, 오버샘플링 및 100개 이상의 명명된 프리셋을 갖춘 6~31개 밴드(시작 시 15개)로 구성된 파라메트릭 이퀄라이저입니다.',
  'tour.dsp.point4':
    'LUFS 음량 목표와 진정한 최고 안전성, 스트리밍에서 LP까지의 전달 프리셋, 볼륨이 아닌 사운드를 비교하기 위한 게인 매치로 마스터하세요.',
  'tour.dsp.how':
    'DSP 탭을 열고 프리셋에서 체인을 선택한 다음 측면 탭에서 스테이지를 클릭하고 켜기로 전환합니다. Equalizer APO에서 먼저 라이브러리의 트랙을 재생하십시오.',
  'tour.dsp.open': '개방형 DSP',
  'tour.output.kicker': '두 곳에서 플레이',
  'tour.output.title': '두 번째 출력 프로필',
  'tour.output.subtitle': '각각 고유한 프로필을 갖는 헤드셋과 스피커를 한 번에',
  'tour.output.lead':
    '별도의 EQ를 사용하여 헤드셋과 스피커를 함께 재생합니다. 두 번째 출력은 메인 출력의 EQ 이전에 사운드를 수신한 다음 저장된 자체 프로필을 적용합니다. 라우팅 드라이버가 필요하지 않습니다.',
  'tour.output.point1':
    '두 번째 출력에서 다른 장치를 켜고 자체 볼륨을 설정하십시오.',
  'tour.output.point2':
    '장치 아래에 저장된 프로필 중 하나를 선택하거나 옆에 있는 {editSound}를 눌러 메인 출력을 전환하지 않고 사운드를 변경하세요. 메인 출력은 튜닝을 유지합니다.',
  'tour.output.point3':
    '한 번에 한 명의 플레이어: FluidEQ에서 무언가를 시작하면 나머지 시스템이 일시 중지되고 그 반대의 경우도 마찬가지입니다.',
  'tour.output.point4':
    '각 출력은 시작 시 약 30ms 뒤쳐지고, 드롭아웃 후에만 약간 더 지연되며, 지연 시간은 밀리초 단위로 표시됩니다. 여기에서 오디오 공유가 재생할 때 다른 컴퓨터의 사운드가 포함됩니다.',
  'tour.output.how':
    'EQ 탭을 열고 오른쪽의 두 번째 출력을 확장합니다. 장치를 켜고 이름 아래에서 EQ 프로필을 선택한 다음 볼륨을 설정하십시오. 지연이 아래에 표시됩니다.',
  'tour.output.open': '오픈 EQ',
  'tour.output.imageAlt':
    'BlackShark V2 Pro 헤드셋이 활성화된 두 번째 출력 패널, EQ 프로필 선택기, 볼륨 슬라이더 및 지연.',
  'tour.outputs.kicker': '각 출력은 다음을 기억합니다.',
  'tour.outputs.title': '모든 출력은 자체 사운드를 유지합니다.',
  'tour.outputs.subtitle': '각자 자신만의 방식으로 튜닝된 헤드폰과 스피커',
  'tour.outputs.lead':
    '헤드폰에서 스피커로 전환하면 EQ, 프리셋, 톤, 컷, DSP 랙, Room 및 레벨링이 모든 출력에서 유지됩니다.',
  'tour.outputs.point1':
    '출력을 선택하면 설정한 모든 내용이 한 번에 다시 적용됩니다. 헤드폰과 스피커는 더 이상 하나의 프리셋이나 하나의 곡선을 공유하지 않습니다.',
  'tour.outputs.point2':
    '두 번째 출력은 FluidEQ 엔진에서 자체 사운드로 직접 재생되며 기본 출력은 이를 기다리지 않습니다. 옆에 있는 {editSound}는 메인 출력을 전환하지 않고도 사운드를 변경합니다.',
  'tour.outputs.point3':
    'Bluetooth 헤드폰은 출력 옆에 배터리를 표시하고, 두 번째 출력에는 재생 시간이 밀리초 단위로 표시됩니다.',
  'tour.outputs.how':
    'EQ를 열고 오른쪽의 {output}에서 출력을 선택합니다. 그때부터 설정한 내용은 그대로 유지됩니다. 두 번째 경우에는 {secondOutput}에서 스위치를 켜고 {editSound}를 누르세요.',
  'tour.outputs.open': '오픈 EQ',
  'tour.outputs.imageAlt':
    '헤드셋과 스피커가 포함된 출력 카드는 각각 고유한 프리셋, 곡선 및 DSP 단계에 따라 재생되며 두 번째 출력은 자체 사운드, 배터리 및 편집 사운드와 함께 재생됩니다.',
  'tour.bands.kicker': '숫자로 보는 EQ',
  'tour.bands.title': '그래프에 바로 표시되는 모든 밴드의 번호',
  'tour.bands.subtitle': '곡선의 레이블, 그 옆의 EQ 모드',
  'tour.bands.lead':
    '각 밴드는 해당 주파수, Q 및 자체 포인트에 대한 게인을 표시할 수 있으며 레이블은 서로 방해가 되지 않습니다. EQ 모드는 이제 그래프 위가 아닌 옆에 위치하므로 곡선이 재생 방식을 변경하는 동안 계속 표시됩니다.',
  'tour.bands.point1':
    '라벨은 다른 지점 위에 있지 않고 바로 위 또는 아래에 위치하며, 밴드를 드래그하는 동안 그대로 유지되고 공간이 확보되면 원래 위치로 돌아갑니다.',
  'tour.bands.point2':
    '{eqMode}는 측면 패널의 첫 번째 카드로, {yourEq}와 {corrections}가 각각 탭으로 구성되어 있습니다. 그래프 위의 버튼을 누르면 카드가 표시됩니다.',
  'tour.bands.point3':
    '모든 핸들, 슬라이더 및 손잡이는 키보드에서 작동하며 슬라이더를 움직이면 동일한 프레임에서 곡선이 다시 그려집니다.',
  'tour.bands.how':
    'EQ를 열고 그래프 위의 {view} → {everything}를 선택하고(또는 {shortcut}를 누름) 밴드를 이동하면 숫자가 따라옵니다. {eqMode}는 오른쪽 패널 상단에서 대기합니다.',
  'tour.bands.open': '오픈 EQ',
  'tour.bands.imageAlt':
    '각 밴드의 주파수, Q 및 게인이 해당 지점 위에 쌓여 있고, 한 밴드가 화살표 키 아래로 이동하고, EQ 및 수정 사항이 있는 곡선 아래에 EQ 모드 카드가 있는 EQ 그래프입니다.',
  'tour.bands.shortcut': 'Ctrl+W',
  'tour.ears.kicker': '하나의 밴드, 두 개의 귀',
  'tour.ears.title': '각 귀를 스스로 조정하십시오.',
  'tour.ears.subtitle': '밴드 자체 메뉴의 왼쪽 + 오른쪽',
  'tour.ears.lead':
    '밴드를 마우스 오른쪽 버튼으로 클릭하고 {split}를 선택합니다. 이는 동일한 주파수에서 각 귀에 대해 하나의 밴드가 되며 각 밴드를 자동으로 이동합니다. 왼쪽 귀의 곡선은 실선으로 그려지고 오른쪽 귀의 곡선은 점선으로 그려집니다.',
  'tour.ears.point1':
    '{both}는 주파수와 게인의 중간인 중간에서 두 개를 다시 결합합니다. {reset} 및 {clear}도 이에 합류합니다.',
  'tour.ears.point2':
    '{delete}는 메인 EQ와 DSP 랙의 동일한 메뉴에 있으며 삭제하기 전에 두 번째 누르기를 요청합니다.',
  'tour.ears.point3':
    'Squiglink 곡선을 한쪽 귀로 가져올 수 있습니다. {importInto}는 왼쪽이나 오른쪽만 채우고 다른 쪽 귀는 그대로 둡니다.',
  'tour.ears.how':
    'EQ를 열고 그래프의 밴드를 마우스 오른쪽 버튼으로 클릭한 다음 {split}를 선택합니다. DSP 랙의 EQ는 스테레오에 적용되는 동안 동일한 메뉴를 갖습니다.',
  'tour.ears.open': '오픈 EQ',
  'tour.ears.imageAlt':
    '하나의 밴드가 왼쪽 귀와 오른쪽 귀 밴드로 분할되어 분리되었다가 가운데에서 다시 결합되는 EQ 그래프, 양쪽 귀 및 왼쪽 + 오른쪽이 있는 밴드 메뉴 옆에 왼쪽 귀의 곡선 실선과 오른쪽 파선이 있습니다.',
  'tour.film.eachEar.intro':
    'FluidEQ의 각 밴드를 이제 왼쪽 귀와 오른쪽 귀에 다르게 적용할 수 있습니다.',
  'tour.film.eachEar.menu':
    '밴드를 마우스 오른쪽 버튼으로 클릭하여 메뉴를 여세요.',
  'tour.film.eachEar.split':
    '왼쪽 + 오른쪽을 선택하세요. 밴드가 귀마다 하나씩 두 개로 나뉩니다.',
  'tour.film.eachEar.lines':
    '각 밴드를 따로 드래그하세요. 실선은 왼쪽 귀, 점선은 오른쪽 귀입니다.',
  'tour.film.eachEar.sliders':
    '각 귀에는 L 또는 R로 표시된 별도의 슬라이더도 있습니다.',
  'tour.film.eachEar.join':
    '다시 합치려면 양쪽 귀를 선택하세요. 두 밴드가 중간 지점에서 하나로 합쳐집니다.',
  'tour.film.sound.intro':
    'FluidEQ에서 바꾼 설정은 즉시, 부드럽게 소리에 반영됩니다.',
  'tour.film.sound.glide':
    '음악이 재생되는 동안 밴드를 움직여 보세요. 변화가 부드럽게 이어져 클릭 노이즈가 들리지 않습니다.',
  'tour.film.sound.precise':
    'EQ 모드 메뉴의 고음은 정밀로 설정되어 있습니다. 모든 밴드가 20킬로헤르츠까지 그래프에 그려진 그대로 적용됩니다.',
  'tour.film.sound.classic':
    'Equalizer APO와 같은 방식으로 밴드를 만들려면 클래식을 선택하세요.',
  'tour.film.games.intro':
    'FluidEQ로 게임마다 다른 사운드를 설정할 수 있습니다.',
  'tour.film.games.add':
    '게임 추가를 누르고 게임 런처로 설치한 게임 중에서 선택하세요.',
  'tour.film.games.sound': '그런 다음 해당 게임에 적용할 사운드를 선택하세요.',
  'tour.film.games.front':
    '게임 창이 앞으로 나오면 해당 사운드가 자동으로 적용됩니다.',
  'tour.film.games.closed': '게임을 종료하면 원래 사운드로 돌아옵니다.',
  'tour.film.compact.intro':
    '재생 조작만 필요할 때는 FluidEQ를 작은 플레이어로 접을 수 있습니다.',
  'tour.film.compact.go':
    '상단의 플레이어 버튼을 누르면 창이 컴팩트 플레이어로 바뀝니다.',
  'tour.film.compact.eq':
    'EQ도 함께 사용할 수 있습니다. 노브를 돌리면 즉시 소리가 바뀝니다.',
  'tour.film.compact.back': '한 번 누르면 전체 창으로 돌아옵니다.',
  'tour.film.deleteImport.intro':
    '두 가지 작은 개선으로 EQ를 더 안심하고 편집할 수 있습니다.',
  'tour.film.deleteImport.asks':
    '이제 밴드 삭제를 누르면 먼저 확인합니다. 한 번 더 눌러야 실제로 삭제됩니다.',
  'tour.film.deleteImport.oneEar':
    '한쪽 귀에만 가져올 수도 있습니다. 가져올 대상을 연 뒤 왼쪽 귀를 선택하세요.',
  'tour.film.deleteImport.otherEar':
    '왼쪽 귀만 교체되고 오른쪽 귀는 그대로 유지됩니다.',
  'tour.film.outputs.intro':
    '컴퓨터의 각 출력은 자신만의 사운드 설정을 기억합니다.',
  'tour.film.outputs.each':
    '스피커에서 헤드폰으로 전환하면 헤드폰의 EQ로 바뀝니다.',
  'tour.film.outputs.back':
    '다시 전환하면 스피커가 이전 설정 그대로 재생됩니다.',
  'tour.film.outputs.second':
    '두 번째 출력으로 동시에 재생하면서 별도의 사운드를 적용할 수도 있습니다.',
  'tour.film.outputs.edit':
    '사운드 편집을 누르면 기본 출력의 재생을 유지한 채 여기서 바로 조정할 수 있습니다.',
  'tour.film.dsp.intro': 'DSP 랙은 EQ 뒤에서 모든 소리를 다듬습니다.',
  'tour.film.dsp.preset': '프리셋 하나를 고르면 전체 랙이 한 번에 설정됩니다.',
  'tour.film.dsp.stages':
    '각 단계에는 모든 조작 항목을 볼 수 있는 전용 페이지가 있습니다.',
  'tour.film.dsp.meters':
    '미터가 음악에 맞춰 움직여 효과의 동작을 확인할 수 있습니다.',
  'tour.film.deesser.intro':
    'DSP 랙에 날카로운 S 발음을 줄여 주는 디에서가 추가되었습니다.',
  'tour.film.deesser.cuts':
    '팟캐스트 및 음성 같은 프리셋을 선택하세요. 날카로운 S 발음을 줄이고 주황색으로 표시하며 심벌 소리는 그대로 유지합니다.',
  'tour.film.deesser.isolate':
    '분리 듣기를 누르면 제거되는 소리만 들을 수 있습니다.',
  'tour.film.headphones.intro':
    'FluidEQ는 다른 사람이 측정한 데이터를 이용하여 헤드폰을 보정할 수 있습니다.',
  'tour.film.headphones.search':
    'EQ 프리셋을 열고 OPRA 라이브러리에서 헤드폰을 검색하세요.',
  'tour.film.headphones.measure':
    '측정값을 선택하세요. 각 항목에 측정한 사람이 표시됩니다.',
  'tour.film.headphones.applied':
    '헤드셋 EQ 적용을 누르세요. 보정이 별도의 레이어에 적용되고 기존 밴드는 그대로 유지됩니다.',
  'tour.film.headphones.paste':
    'Squiglink에서 내보낸 내용을 붙여넣을 수도 있습니다.',
  'tour.film.headphones.ears':
    'EQ로 적용하여 양쪽 귀 또는 한쪽 귀에 사용할 수 있습니다.',
  'tour.film.headphones.curve': '또는 별도의 곡선으로 적용할 수 있습니다.',
  'tour.film.karaoke.intro':
    '노래방은 FluidEQ를 내 노래를 위한 무대로 바꿔 줍니다.',
  'tour.film.karaoke.open':
    '노래 열기를 누르고 곡과 가사 파일을 함께 선택하세요.',
  'tour.film.karaoke.words':
    '재생을 누르면 노래에 맞춰 가사가 한 단어씩 강조됩니다.',
  'tour.film.karaoke.pitch':
    '아래의 피치 가이드에는 불러야 할 음표가 표시됩니다. 마이크를 켜면 내 목소리의 음정도 볼 수 있습니다.',
  'tour.film.maker.intro':
    '노래방 제작 도구로 곡을 노래방 파일로 만들 수 있습니다.',
  'tour.film.maker.timeline':
    '곡을 불러온 뒤 만들기를 누르세요. 곡의 모든 가사와 음표가 타임라인에 표시됩니다.',
  'tour.film.maker.play':
    '재생하면 재생 헤드가 가사와 음표를 따라 움직입니다. 원하는 항목을 드래그하여 타이밍이나 음높이를 수정하세요.',
  'tour.film.maker.use':
    '제작 도구가 가수의 목소리를 분석하여 곡을 자동으로 준비할 수도 있습니다. 결과가 만족스러우면 플레이어에서 사용을 누르세요.',
  'tour.film.looks.intro':
    'EQ 아래의 스펙트럼을 원하는 모습으로 꾸밀 수 있습니다.',
  'tour.film.looks.open': '그래프 도구 모음에서 새 스타일을 누르세요.',
  'tour.film.looks.forms':
    '화살표로 LED 막대, 네온 막대, 스카이라인, 유리 타워 등 여러 형태를 살펴보세요.',
  'tour.film.looks.shape':
    '그런 다음 모양을 다듬으세요. 조각 수로 막대 개수를 정하고 색상, 간격, 움직임도 직접 설정할 수 있습니다.',
  'tour.film.looks.save':
    '저장을 누르면 내 스타일로 보관할 수 있고 파일로 공유할 수도 있습니다.',
  'tour.walkthrough.kicker': '전체 둘러보기',
  'tour.walkthrough.title': '비디오 하나로 보는 FluidEQ의 모든 것',
  'tour.walkthrough.subtitle': '처음부터 끝까지 보기',
  'tour.walkthrough.lead':
    '처음 끌어 보는 밴드부터 비주얼라이저까지, FluidEQ가 하는 모든 것을 안내합니다. 각 부분을 쓰는 방법은 음성으로 설명합니다.',
  'tour.film.walkthrough.intro':
    'FluidEQ 2.2입니다. 컴퓨터에서 재생되는 모든 소리를 위한 하나의 이퀄라이저입니다. 함께 둘러보겠습니다.',
  'tour.film.walkthrough.graph':
    '그래프의 아무 점이나 끌어 소리를 다듬으세요. 각 밴드의 주파수와 게인이 곡선 위에 바로 표시됩니다.',
  'tour.film.walkthrough.sliders':
    '슬라이더는 같은 밴드를 움직이고, 곡선이 즉시 따라옵니다. 만진 밴드는 아래에 자체 컨트롤을 엽니다.',
  'tour.film.walkthrough.tone':
    '빈 곳을 클릭하면 톤이 돌아옵니다. 베이스, 미드, 트레블, 그리고 양쪽에 로우 컷과 하이 컷이 있습니다.',
  'tour.film.walkthrough.ears':
    '밴드를 마우스 오른쪽 버튼으로 클릭하고 왼쪽 + 오른쪽을 고르면 양쪽 귀를 따로 조정할 수 있습니다. 실선은 왼쪽 귀, 점선은 오른쪽 귀입니다.',
  'tour.film.walkthrough.eqmode':
    'EQ 모드는 그래프 옆에 있습니다. 곡선이 얼마나 강하게 재생될지 정하며, 정밀은 고음을 그린 그대로 재생합니다.',
  'tour.film.walkthrough.headphones':
    'EQ 프리셋에서 측정된 수천 개의 모델 중 내 헤드폰을 찾아, 한 번에 보정을 적용하세요.',
  'tour.film.walkthrough.mycurves':
    '내 곡선에 저장하세요. OPRA 옆에 있는 나만의 목록이라, 필요할 때 언제든 쓸 수 있습니다.',
  'tour.film.walkthrough.outputs':
    '출력마다 자체 사운드를 유지합니다. 헤드폰으로 바꾸면 두고 간 그대로 돌아옵니다. 두 번째 출력은 다른 장치에서 같은 음악을 재생할 수 있습니다.',
  'tour.film.walkthrough.songs':
    '각 노래의 사운드 기억을 켜면, 모든 노래가 내가 정한 사운드로 돌아옵니다.',
  'tour.film.walkthrough.games':
    '게임 프리셋은 게임이 앞으로 나오는 순간 사운드를 바꾸고, 게임을 닫으면 되돌립니다.',
  'tour.film.walkthrough.dsp':
    'DSP 랙은 듣는 모든 소리를 위한 스튜디오 효과 체인입니다. 음악 장르부터 영화와 게임까지, 랙 전체의 프리셋을 고르세요.',
  'tour.film.walkthrough.deesser':
    '새로운 디에서는 목소리의 날카로운 치찰음만 줄이고 심벌은 그대로 둡니다.',
  'tour.film.walkthrough.character':
    '익사이터는 반짝임을, Bass Forge는 무게감을 더하고, 스테레오 확장은 스테레오를 넓힙니다.',
  'tour.film.walkthrough.room':
    '룸은 헤드폰으로도 실제 공간의 스피커들 사이에 있는 듯한 소리를 들려줍니다.',
  'tour.film.walkthrough.maximizer':
    '그리고 맥시마이저가 클리핑 없이 모든 소리를 크고 깨끗하게 유지합니다.',
  'tour.film.walkthrough.library':
    '라이브러리는 같은 사운드로 내 음악을 재생하며, 앨범과 재생목록, 다음 곡도 있습니다.',
  'tour.film.walkthrough.compact':
    '컴팩트 플레이어는 노래, 컨트롤, EQ를 작은 창 하나에 담습니다.',
  'tour.film.walkthrough.oneline':
    '한 줄로 접으면 방해가 되지 않고, 노래 뒤에서 비주얼라이저가 은은하게 재생됩니다.',
  'tour.film.walkthrough.looks':
    '그래프는 그 자체로 비주얼라이저가 될 수 있습니다. 룩이나 장면 하나를 고르면 창이 그 색을 입습니다.',
  'tour.film.walkthrough.gallery':
    '비주얼라이저의 갤러리에는 FluidEQ와 커뮤니티가 만든 장면이 있습니다. 각 장면은 1크레딧이면 영원히 내 것입니다.',
  'tour.film.walkthrough.studio':
    '스튜디오에서 원하는 변경을 내 말로 설명하고, 무대에서 그대로 이루어지는 것을 보세요.',
  'tour.film.walkthrough.karaoke':
    '노래방은 내 노래를 함께 부를 수 있게 바꿔 줍니다. 시간에 맞춘 가사와 내 음정이 화면에 나옵니다.',
  'tour.film.walkthrough.share':
    '오디오 공유는 집 네트워크의 컴퓨터들을 연결해, 음악이 양방향으로 오가게 합니다.',
  'tour.film.walkthrough.help':
    '그리고 여기 있는 모든 것은 앱에서 직접 가져온 그림과 함께 사용자 가이드에 있습니다.',
  'tour.film.walkthrough.outro':
    '이것이 FluidEQ입니다. 소리도, 모습도 내 것처럼 만드세요.',
  'tour.film.engine.intro':
    'FluidEQ에는 자체 오디오 엔진이 있습니다. 컴퓨터에서 재생되는 모든 소리에 EQ와 DSP 랙을 적용합니다.',
  'tour.film.engine.choose':
    '오른쪽 위의 작업 메뉴를 열고 엔진 카드를 누르세요. FluidEQ 엔진을 선택하면 됩니다.',
  'tour.film.engine.rack':
    '그런 다음 DSP를 열고 프리셋을 선택하세요. 게임, 브라우저, 음악 앱의 소리가 모두 이 랙을 거쳐 재생됩니다.',
  'tour.film.library.intro':
    '라이브러리는 내가 가진 음악을 EQ를 거쳐 재생합니다.',
  'tour.film.library.albums': '앨범이 표지로 표시됩니다. 화살표로 넘겨 보세요.',
  'tour.film.library.album': '앨범을 클릭하면 수록된 모든 곡을 볼 수 있습니다.',
  'tour.film.library.play':
    '재생을 누르면 다른 소리와 동일한 EQ 및 DSP 랙을 거쳐 재생됩니다.',
  'tour.film.soundOn': '소리를 켜세요',
  'tour.film.soundOff': '소리 끄기',
  'tour.film.watch': '비디오 보기',
  'tour.film.close': '비디오 닫기',
  'tour.film.unavailable':
    '지금은 이 동영상을 재생할 수 없습니다. 나중에 다시 시도해 주세요.',
  'tour.deesser.kicker': '더 부드러운 S',
  'tour.deesser.title': 'DSP 랙의 디에서',
  'tour.deesser.subtitle':
    '날카로운 S의 소리는 낮아지고 심벌즈는 홀로 남습니다.',
  'tour.deesser.lead':
    '{deEsser}는 소리가 나는 동안에만 음성의 날카로운 S, T 및 SH를 낮추고 심벌즈, 하이햇 및 나머지 고음은 그대로 유지합니다.',
  'tour.deesser.point1':
    '노래 자체의 레벨에 대해 각 S를 찾으므로 조용한 트랙과 시끄러운 트랙을 동일하게 취급하고 모든 S를 포착하고 소요되는 시간을 확인합니다.',
  'tour.deesser.point2':
    'S를 구성하는 주파수, 그 위의 모든 주파수 또는 전체 음성만 낮추고 {isolate}는 필요한 주파수만 재생합니다.',
  'tour.deesser.point3':
    '{speech}, {podcast} 및 {audiobook}가 켜집니다. 이제 랙의 모든 필터에 자신만의 프로필을 저장할 수 있습니다.',
  'tour.deesser.how':
    'DSP를 열고 왼쪽 목록에서 {deEsser}를 선택하거나 {podcast}를 선택합니다. 프로필에서 시작한 다음 각 S가 포착될 때까지 {sensitivity}를 올립니다.',
  'tour.deesser.open': '개방형 DSP',
  'tour.deesser.imageAlt':
    '디에서의 스트립 스크롤: 무대가 시작되는 라인 위에 서있는 각 S의 목소리는 그 아래에 호박색으로 매달려 있고 하이햇은 회색으로 남겨져 있습니다. 그 위에는 Spectral이 선택된 무대가 있고 그 아래에는 Speech, Podcast 및 Audiobook이 있습니다.',
  'tour.chat.kicker': '질문을 통해 장면을 만들어보세요',
  'tour.chat.title': '변화를 요청하고 무대에서 지켜보세요',
  'tour.chat.subtitle': '스튜디오 무대 옆에서 나누는 대화',
  'tour.chat.lead':
    '이제 {studio}의 무대 옆에 채팅이 있습니다. 장면이 어떻게 보이는지, 음악과 함께 어떻게 움직이는지, 색상이나 조명 등 무엇을 바꿔야 하는지 말하면 AI가 장면을 편집하고 무대에서 각 버전을 재생합니다.',
  'tour.chat.point1':
    '모든 응답은 작성한 버전을 유지하며 {bringBack}는 이전 버전을 다시 넣습니다. 각 장면은 과거 채팅을 유지합니다.',
  'tour.chat.point2':
    '{attach}는 메시지와 함께 현장 사진을 보내며, 그 위에 그림을 그려서 의미를 보여줄 수 있습니다. 작동하는 동안 전송된 메시지는 대기열에서 대기하며 함께 이동됩니다.',
  'tour.chat.point3':
    '이 컴퓨터에 설치된 Claude Code에서 귀하의 계획에 따라 실행되며 한계가 얼마나 남아 있는지 보여줍니다.',
  'tour.chat.how':
    '{plus}를 열고 레일에서 {studio}를 선택한 다음 장면을 선택하거나 시작하고 무대 옆 상자에 입력하세요.',
  'tour.chat.open': '시각화 도우미 열기',
  'tour.chat.imageAlt':
    '채팅 옆에 있는 스튜디오 무대: 스네어에서 무대 조명을 깜박이게 해 달라는 요청, 응답 단계가 똑딱거리고, 버전 2는 Bring back으로 유지되며, 버전 2가 재생될 때 무대 조명이 깜박이기 시작합니다.',
  'tour.chat.ask': '스네어에서 무대 조명이 깜박이도록 하세요.',
  'tour.chat.reply':
    '완료: 두 스포트라이트가 모든 스네어에서 흰색으로 깜박이고 다시 분홍색으로 희미해집니다.',
  'tour.myCurves.kicker': '나만의 곡선',
  'tour.myCurves.title': 'OPRA 옆에 있는 자신만의 곡선 목록',
  'tour.myCurves.subtitle':
    '자신만의 곡선을 유지하고 이름을 지정하고 재사용하세요.',
  'tour.myCurves.lead':
    '{eqPresets}에는 이제 OPRA 라이브러리 옆에 {myCurves}가 있습니다. 다시 돌아가고 싶은 모든 곡선과 사용자가 지정한 이름 및 모양 그림이 포함되어 있습니다. Squiglink 내보내기, .txt 파일, 현재의 EQ 또는 OPRA 선택에서 하나를 추가하세요.',
  'tour.myCurves.point1':
    '{applyCurve}는 자체 강도와 스위치를 사용하여 헤드폰 보정으로 곡선을 재생합니다. {applyEq}는 대신 EQ에 밴드를 넣습니다.',
  'tour.myCurves.point2':
    '{myCurves}의 {squiglink} 바로가기는 가져오기 미리보기를 엽니다. {save}는 나중에 곡선을 유지합니다.',
  'tour.myCurves.point3':
    '{exportList}는 전체 목록을 하나의 파일에 기록하여 백업하거나 다른 컴퓨터로 가져갑니다. {importList}는 그것을 다시 읽고 빠진 내용을 말합니다.',
  'tour.myCurves.how':
    'EQ 아래에서 {eqPresets}를 열고 {myCurves}를 선택한 다음 {add}를 누릅니다.',
  'tour.myCurves.open': 'EQ 프리셋 열기',
  'tour.myCurves.imageAlt':
    '내 곡선의 EQ 프리셋 페이지: 각각 이름, 출처, 추가된 날짜 및 모양 그림이 포함된 4개의 헤드폰 곡선 목록입니다. Squiglink에서 방금 저장한 곡선이 맨 위에 도착하여 헤드폰 보정으로 재생됩니다.',
  'tour.songs.kicker': '모든 노래에 어울리는 사운드',
  'tour.songs.title': '당신이 좋아하는 것을 기억하는 노래',
  'tour.songs.subtitle': '노래를 한 번 튜닝하고 매번 그렇게 들어보세요',
  'tour.songs.lead':
    '{songSound}를 켜고 프리셋, 톤 및 EQ를 켜면 노래가 다음에 재생될 때 다시 돌아올 때 노래가 종료됩니다.',
  'tour.songs.point1':
    '노래가 재생되는 동안 프리셋, 톤 또는 밴드를 변경하면 그대로 유지됩니다. 당신이 만지지 않은 노래는 아무것도 남기지 않습니다.',
  'tour.songs.point2':
    '{undo} 및 {forget}와 함께 노래 이름과 가져온 내용이 포함된 알림과 함께 돌아옵니다.',
  'tour.songs.point3':
    '노래가 끝나면 이전에 들었던 사운드가 반환되고 각 출력은 고유한 내용을 기억합니다. 한 노래는 헤드폰에서 다른 노래는 스피커에서 한 방향으로 들릴 수 있습니다.',
  'tour.songs.how':
    'EQ를 열고 오른쪽 {output}에서 {songSound}를 켭니다. 노래를 재생하고, 프리셋을 선택하거나 톤을 돌린 다음 끝내거나 건너뛰세요.',
  'tour.songs.open': '오픈 EQ',
  'tour.songs.imageAlt':
    '차례로 재생되는 4곡의 대기열(각각 프리셋 및 곡선이 있는 3곡은 남아 있고 한 곡은 조정되지 않았으며 그 위에는 실행 취소 및 이 노래 잊어버리기)와 함께 기억된 노래가 표시됩니다.',
  'tour.looks.kicker': '나만의 비주얼라이저',
  'tour.looks.title': '그래프에 대한 사용자 정의 모양',
  'tour.looks.subtitle': '나만의 형태, 색상, 모션',
  'tour.looks.lead':
    'EQ 아래의 스펙트럼은 원하는 방식으로 그릴 수 있습니다. LED 및 네온 바부터 테라스, 스카이라인 및 유리 타워에 이르기까지 {forms} 형태 중 하나를 선택한 다음 빈도, 레벨 또는 열에 따라 자체 자동 색상으로 색상을 지정하고 공격 속도와 피크가 지속되는 시간을 설정하고 스파크, 혜성 또는 잔물결로 피크를 표시합니다. 나만의 모습으로 저장하고, 파일로 공유해보세요.',
  'tour.looks.point1':
    '{forms} 양식에는 각각 자체 컨트롤(조각, 간격, 채우기, 무게, 채우기 또는 스트로크 여부)이 있습니다.',
  'tour.looks.point2':
    '고유한 색상의 램프를 사용하여 주파수, 레벨 또는 열에 따라 자체 자동 색상 지정 또는 하나의 평면 색상으로 각 형태를 색상화합니다.',
  'tour.looks.point3':
    '공격과 해제가 모션을 설정합니다. 조명이 켜진 피크, 채워진 피크 및 12개의 피크 표시가 히트의 모양을 설정합니다.',
  'tour.looks.point4':
    'Glow는 모든 모드에서 작동하며 파일로 내보내고 파일에서 가져옵니다.',
  'tour.looks.how':
    'EQ 탭의 그래프 툴바에서 "새 모양"을 누르세요. 선택기로 양식을 선택하거나 Space를 눌러 양식을 순환하고 음악이 재생되는 동안 색상과 동작을 조정한 다음 저장하세요.',
  'tour.looks.open': '오픈 EQ',
  'tour.karaoke.kicker': '집에서의 무대',
  'tour.karaoke.title': '피치 가이드가 있는 노래방',
  'tour.karaoke.subtitle': '너의 노래, 너의 가사, 너의 마이크',
  'tour.karaoke.lead':
    '가사 파일이 있거나 없는 노래를 추가하면 FluidEQ가 이를 재생 목록에 연결하고, 커버 아트나 비디오 위에 시간이 지정된 가사를 표시하고, 마이크를 듣고 멜로디에 맞춰 피치를 그립니다. 모든 것이 이 컴퓨터에 유지됩니다. 마이크는 녹음되거나 재생되지 않습니다.',
  'tour.karaoke.point1':
    'FluidEQ가 Maker에서 노래의 음성을 분리한 후 가이드 보컬 슬라이더: 악기 파일이 필요 없이 백킹에서 전체 원본으로만 스윕합니다.',
  'tour.karaoke.point2':
    '피치 레인: 높음, 조정 및 낮음 피드백이 포함된 노래의 음표가 블록으로, 사용자의 목소리가 그 위에 라이브 라인으로 표시됩니다.',
  'tour.karaoke.point3':
    '이후에는 연습할 부분을 나열하고 또 다른 실행을 위한 카운트인을 포함하는 성과 검토입니다.',
  'tour.karaoke.point4':
    'MP3, FLAC, WAV, OGG, M4A 등을 통해 LRC, 단어 타이밍이 있는 향상된 LRC 및 음절과 피치가 있는 UltraStar를 읽습니다. 번역된 가사와 예상 기타 코드가 함께 제공됩니다.',
  'tour.karaoke.how':
    '노래방 탭을 열고 "노래 열기" 또는 "폴더 추가"를 누르고 재생 목록에서 트랙을 선택한 다음 마이크를 켜고 피치 가이드를 표시한 다음 재생을 누르세요.',
  'tour.karaoke.open': '오픈 가라오케',
  'tour.maker.kicker': '나만의 것을 만들어보세요',
  'tour.maker.title': '노래방 제작 도구',
  'tour.maker.subtitle': '어떤 노래든 노래방 파일이 됩니다',
  'tour.maker.lead':
    '노래방 탭 안에 있는 완전한 저작 스튜디오입니다. 음악에서 음성을 분리하고, 로컬 음성 모델을 사용하여 단어와 타이밍을 읽고, 멜로디 음표를 감지하는 등 전체 작업을 자체적으로 수행할 수 있습니다. 또는 확대/축소 가능한 타임라인에서 손으로 모든 타이밍을 탭하고 기록하고 그립니다. 모든 것이 이 컴퓨터에서 실행됩니다.',
  'tour.maker.point1':
    '"이 노래를 자동으로 설정": 음성을 분리한 다음 백그라운드에서 계속 재생 옵션을 사용하여 가사와 타이밍을 읽습니다.',
  'tour.maker.point2':
    '별도의 트랙을 유지하십시오. 음성 및 백킹 트랙은 MP3를 포함하여 각각 저장 가능합니다.',
  'tour.maker.point3':
    '세부 사항을 위한 수공구: 단어 탭, 줄 항목 기록, 시작과 길이가 있는 단어 검사기, 단어를 음절로 분할.',
  'tour.maker.point4':
    '피치 그리드에 멜로디를 칠하고 금색 음표를 표시한 다음 FluidEQ 프로젝트, UltraStar TXT, LRC, 향상된 LRC 또는 백킹 트랙으로 내보냅니다.',
  'tour.maker.how':
    '노래방에서 노래를 로드하고 "만들기"를 누르세요. 마법사에서 "자동 설정"을 수락하고 타임라인의 단어를 수정한 다음 "플레이어에서 사용" 및 "내보내기"를 선택하세요.',
  'tour.maker.open': '오픈 가라오케',
  'tour.media.kicker': 'EQ를 통한 웹',
  'tour.media.title': '온라인 미디어',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch 및 Suno',
  'tour.media.lead':
    '스트리밍 사이트용 플레이어가 내장되어 있어 온라인에서 보고 듣는 내용이 별도의 브라우저 대신 EQ를 통해 실행됩니다. 5개의 사이트가 연결되어 있으며 각 사이트에는 자체 검색 기능이 있으며 외부 사이트로 연결되는 링크는 "브라우저에서 열기" 선택을 통해 억제됩니다.',
  'tour.media.point1':
    '열려 있는 사이트를 검색하는 하나의 검색 필드로, 최근 검색 내용을 지울 수 있습니다.',
  'tour.media.point2':
    '한 번 로그인: 플레이어는 로그아웃할 때까지 방문 사이에 로그인을 유지합니다.',
  'tour.media.point3':
    '이력서: 플레이어는 마지막 페이지와 그 페이지의 위치를 기억하고 다시 그 페이지로 이동합니다.',
  'tour.media.point4':
    '완료되면 진행 상황 알약과 "폴더에 표시"가 표시되고 로그아웃 버튼(도구 모음 끝에 있는 문)을 사용하여 한 번만 누르면 모든 쿠키와 로그인이 지워집니다.',
  'tour.media.how':
    '온라인 미디어 탭을 열고 상단 행에서 사이트를 선택한 다음 검색 필드에 입력하고 검색을 누릅니다. 뒤로, 앞으로 및 다시 로드는 브라우저에서와 같이 작동합니다.',
  'tour.media.open': '온라인 미디어 열기',
  'tour.studio.free': '모든 계정에 무료',
  'tour.film.englishAudio': '영어 음성 · 번역 자막',
  'tour.karaokeBackground.title': '가사 뒤에 펼쳐지는 비주얼라이저',
  'tour.karaokeBackground.subtitle': '선택한 스타일을 노래방 무대에',
  'tour.karaokeBackground.lead':
    '노래방 배경으로 비주얼라이저나 장면을 선택하세요.',
  'tour.karaokeBackground.how':
    'EQ의 {looks}에서 원하는 스타일이나 장면을 선택한 다음, 노래방에서 {showGraph} 버튼을 누르세요.',
  'tour.karaokeBackground.open': '노래방 열기',
  'tour.karaokeBackground.imageAlt':
    '노래방 배경 설정 버튼과 가사 뒤에 펼쳐진 장면.',
  'tour.karaokeBackground.lyric': '우리 노래로 이 밤을 밝혀요',
  'tour.tray.kicker': '로그인부터 조용하게',
  'tour.tray.title': 'FluidEQ가 알림 영역에서 시작합니다',
  'tour.tray.subtitle': '로그인한 순간부터, 창 없이 나만의 소리',
  'tour.tray.lead':
    '‘{startup}’을 켜 두면 FluidEQ는 Windows에 로그인할 때 알림 영역에서 시작해, 창을 띄우지 않고도 첫 순간부터 소리를 다듬습니다.',
  'tour.tray.point1':
    'EQ, 프리셋, 출력마다의 소리가 아무것도 열지 않아도 첫 곡부터 적용됩니다.',
  'tour.tray.point2':
    '알림 영역 아이콘을 누르면 창이 열리고, 창의 닫기 버튼을 누르면 다시 알림 영역으로 돌아갑니다.',
  'tour.tray.point3': 'FluidEQ를 직접 열면 지금처럼 창이 열립니다.',
  'tour.tray.how': '여기서 켜거나, 메뉴(세 줄) 맨 아래에서 켤 수 있습니다:',
  'tour.tray.imageAlt':
    'Windows 작업 표시줄 알림 영역의 FluidEQ 아이콘과, 그 위에 FluidEQ가 소리를 다듬고 있음을 알려 주는 카드.',
  'tour.tray.card': '모든 앱의 소리를 다듬는 중',
  'tour.languages.kicker': '12개 언어',
  'tour.languages.title': '이제 한국어와 번체 중국어로',
  'tour.languages.subtitle': '한국어와 繁體中文이 새로 합류했습니다',
  'tour.languages.lead':
    'FluidEQ는 12개 언어를 지원합니다. 대만, 홍콩, 마카오에서는 번체 중국어가 선택되며, 직접 고른 언어는 언제나 그대로 유지됩니다.',
  'tour.languages.point1':
    '창 전체와 도움말, 새로운 기능 안내, 설치 프로그램이 두 언어를 모두 지원합니다.',
  'tour.languages.point2':
    '목록에서 각 언어가 자기 이름으로 표시되므로 언제든 내 언어를 찾을 수 있습니다.',
  'tour.languages.point3':
    '중국 본토와 싱가포르에서는 간체 중국어가 그대로 쓰입니다.',
  'tour.languages.how': '메뉴(세 줄) 맨 아래에서 고르세요:',
  'tour.languages.imageAlt':
    'FluidEQ가 지원하는 12개 언어를 각자의 문자로 보여 주고, 한국어와 번체 중국어에 새 표시를 한 그림.',
} satisfies Partial<Dictionary>;

export default tour;
