/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const app = {
  'recovery.title': 'FluidEQ가 복구 중입니다.',
  'recovery.working':
    '재생을 중지하고 저장된 설정으로 창을 다시 로드합니다. 저장하지 않은 작업은 손실될 수 있습니다.',
  'recovery.stopped':
    'FluidEQ를 안전하게 복구할 수 없습니다. 자동 재시도가 중지되었습니다. 다시 로드하거나 종료할 수 있습니다. 저장하지 않은 작업은 손실될 수 있습니다.',
  'recovery.reload': 'FluidEQ 다시 로드',
  'recovery.quit': '종료',
  'recovery.copy': '세부정보 복사',
  'recovery.history': '이전 실패',
  'app.tagline': '나만의 소리. 모든 장치에서. 자동으로.',
  'app.knob.type': '값을 입력하려면 클릭하세요.',
  'app.actions': 'FluidEQ 작업',
  'app.actions.title': '오디오 작업',
  'app.status.ready': '오디오 엔진이 연결됨',
  'app.status.checking': '오디오 엔진을 확인하는 중…',
  'app.status.error': '오디오 엔진이 응답하지 않습니다',
  'app.menu.importEq': 'EQ 설정 가져오기…',
  'app.menu.importConvolution': '임펄스 응답 가져오기…',
  'app.menu.restartAudio': 'Windows 오디오 다시 시작',
  'engine.apo.reconfigure': 'Equalizer APO 재구성',
  'engine.apo.settings': 'Equalizer APO 설정',
  'app.menu.support': '개발 후원',
  'app.menu.fix': '문제 해결',
  'app.menu.reportProblem': '문제 신고',
  'app.menu.about': '{product} 소개…',
  'app.processes.menu': '프로세스…',
  'app.menu.resetSettings': '모든 설정 재설정…',
  'settingsReset.title': '모든 설정을 재설정하시겠습니까?',
  'settingsReset.body':
    '그래프 및 비주얼라이저, 창 색상, 플레이어, 각 페이지가 남아 있는 라이브러리, 애니메이션, Windows 시작, 바탕 화면 배경 및 동적 조명은 FluidEQ의 새로운 설치가 시작되는 방식으로 돌아갑니다.',
  'settingsReset.kept':
    'EQ, 프리셋, 곡선 및 DSP는 그대로 유지되며 출력, 오디오 엔진, 언어 및 저장한 모든 것도 그대로 유지됩니다.',
  'settingsReset.action': '설정 재설정',
  'settingsReset.failed': '설정을 재설정할 수 없습니다. 다시 시도해 보세요.',
  'app.processes.eyebrow': '프로세스',
  'app.processes.hint':
    'Windows는 이들 모두가 동일한 프로그램이기 때문에 앱 이름을 따서 명명합니다. 이것이 FluidEQ에 대해 각각이 실제로 수행하는 작업입니다.',
  'app.processes.hintSplit':
    '분할은 의도적입니다. 인터페이스, 그림 및 사운드가 각각 자체적으로 실행되므로 바쁜 창으로 인해 음악이 멈출 수 없으며 한 부분의 결함으로 인해 나머지 부분이 해결되지 않습니다.',
  'app.processes.process': '프로세스',
  'app.processes.pid': 'PID',
  'app.processes.memory': '메모리',
  'app.processes.cpu': 'CPU',
  'app.processes.thisWindow': '이 창',
  'app.processes.total': '총 {megabytes}MB 및 {cpu}% CPU.',
  'app.processes.unmeasured': '대시는 아직 아무것도 측정하지 않은 수치입니다.',
  'app.processes.scene':
    '{place}: {name}, {ms} ms {fps} fps의 프레임, {shown}에 대해 {drawn}에서 그려짐',
  'app.processes.sceneRate':
    '{place}: {fps} fps의 {name}, {shown}의 경우 {drawn}에서 그려짐',
  'app.processes.place.graph': '그래프 비주얼라이저',
  'app.processes.place.studio': '스튜디오 스테이지',
  'app.processes.name.window': '인터페이스',
  'app.processes.what.window':
    '당신이 보고 있는 창: 커브, 라이브러리, 플레이어, 모든 컨트롤. 창당 하나의 프로세스이므로 다시 그려도 소리가 멈출 수 없습니다. 장면은 자체 스레드에서 실행되므로 무거운 장면이 컨트롤을 방해하지 않습니다.',
  'app.processes.name.core': '앱 코어',
  'app.processes.what.core':
    '창문이 없는 부분. 설정을 유지하고, 오디오 장치 및 시스템 이퀄라이저와 통신하고, 업데이트를 확인하고, 이 목록의 다른 모든 것을 시작합니다.',
  'app.processes.name.engine': '오디오 엔진(C++)',
  'app.processes.what.engine':
    'FluidEQ 자체 엔진입니다. 재생하는 내용을 디코딩하고 이퀄라이저를 적용합니다. 나머지 프로그램과 별도의 프로그램이므로 Windows에서 해당 프로그램을 따로 보관합니다.',
  'app.processes.name.graphics': '그래픽',
  'app.processes.what.graphics':
    '스펙트럼, 곡선, 모든 애니메이션 및 장면 등 그래픽 카드의 화면에 모든 것을 그립니다. 무엇이든 움직일 때마다 바쁘다. 모델을 실행하지 않습니다.',
  'app.processes.name.desktop': '데스크탑 비주얼라이저',
  'app.processes.what.desktop':
    '이 창을 제외하고 모니터의 바탕 화면 배경으로 그려진 장면: 각 모니터마다 하나씩 표시됩니다. 모니터가 창을 가리거나 PC가 잠겨 있는 동안에는 일시 정지됩니다.',
  'app.processes.name.desktopHost': '데스크탑 시각화 도우미',
  'app.processes.what.desktopHost':
    '해당 모니터의 데스크탑 시각화 도우미를 아이콘 뒤에 배치하고 창이 화면을 덮을 때 이를 알려줍니다. 각 모니터마다 하나씩 표시됩니다.',
  'app.processes.name.shareCapture': '오디오 캡처',
  'app.processes.what.shareCapture':
    '오디오 공유 탭, 두 번째 출력 및 Smart EQ를 위해 이퀄라이저 이전에 이 PC가 재생하는 내용을 캡처합니다. 둘 중 하나가 사용 중인 동안에만 실행됩니다.',
  'app.processes.name.sharePlayback': '공유 오디오 재생',
  'app.processes.what.sharePlayback':
    '다른 FluidEQ가 이 PC와 공유하는 사운드를 재생하고 오디오 캡처를 시작하므로 이 PC가 전송하는 내용은 해당 사운드를 다시 전달하지 않습니다. 둘 중 하나가 사용 중인 동안에만 실행됩니다.',
  'app.processes.name.volume': '시스템 볼륨',
  'app.processes.what.volume':
    'Windows의 볼륨을 따르고 FluidEQ의 볼륨 슬라이더에 대한 음소거를 수행하고 움직일 때 설정합니다. 슬라이더가 화면에 있는 동안에만 실행됩니다.',
  'app.processes.name.games': '게임 감지',
  'app.processes.what.games':
    'FluidEQ에 어떤 프로그램이 앞에 있는지 알려주므로 해당 프로그램으로 전환하는 순간 게임이 고유한 사운드를 들을 수 있습니다. 게임에 자체 사운드가 있거나 게임 프리셋 페이지가 열려 있는 동안에만 실행됩니다.',
  'app.processes.name.outputs': '출력 감시자',
  'app.processes.what.outputs':
    'Windows에서 출력이 연결되었거나 분리되었거나 변경되었다는 메시지가 들리면 FluidEQ는 창이 숨겨진 동안에도 해당 출력 프로필로 이동합니다. FluidEQ가 실행되는 동안 실행됩니다.',
  'app.processes.name.mediaWatch': '다른 앱의 미디어',
  'app.processes.what.mediaWatch':
    'Spotify, 브라우저 또는 다른 플레이어가 재생 중인 내용을 읽어 플레이어 표시줄에 표시하고 제어할 수 있습니다. FluidEQ가 더 이상 필요하지 않으면 중지됩니다.',
  'app.processes.name.models': '노래방 모델',
  'app.processes.what.models':
    '노래방에서 노래를 준비할 때 음악과 음성을 분리하고 가수의 음높이를 따라갑니다. 처음 필요할 때 시작되어 분리되므로 실패한 모델로 인해 앱이 중단될 수 없습니다.',
  'app.processes.name.libraryScan': '라이브러리 스캔',
  'app.processes.what.libraryScan':
    '라이브러리에서 태그, 길이, 커버 아트 등 음악 폴더를 검색하는 동안 음악 폴더를 읽습니다. 스캔을 시작하고 스캔이 끝나면 닫힙니다.',
  'app.processes.name.sound': '브라우저 소리',
  'app.processes.what.sound':
    '온라인 미디어 탭 및 페이지 재생 사운드를 위한 Chromium 자체 오디오입니다. 당신의 음악은 그것을 거치지 않습니다.',
  'app.processes.name.network': '네트워크',
  'app.processes.what.network':
    '업데이트 확인, 표지 아트 및 온라인 미디어 탭이 로드하는 모든 것. 여기에 있는 다른 어떤 것도 네트워크에 도달하지 않습니다.',
  'app.processes.name.devices': '장치 목록',
  'app.processes.what.devices':
    '앱이 Windows에 어떤 오디오 장치가 있는지 물을 때 Chromium에 의해 시작됩니다. 동일한 요청에는 비디오 장치도 나열됩니다. 카메라가 열리지 않고 아무것도 기록되지 않습니다.',
  'app.processes.name.page': '웹페이지',
  'app.processes.what.page':
    '온라인 미디어 탭에 페이지가 열립니다. 인터페이스와 별도로 자체 프로세스에서 실행됩니다.',
  'app.processes.name.systemEngine': 'FluidEQ 엔진(Windows 오디오)',
  'app.processes.what.systemEngine':
    'Windows 자체 오디오 서비스 내에서 실행되는 이퀄라이저는 듣는 모든 것에 적용됩니다. Windows는 해당 서비스를 사운드 카드 효과와 공유하므로 해당 메모리와 CPU가 표시되지만 전체에 추가되지는 않습니다.',
  'app.processes.name.meter': '프로세스 미터',
  'app.processes.what.meter':
    '작업 관리자와 같은 방식으로 이 목록의 수치를 측정하여 합산합니다. 이 목록이 열려 있는 동안에만 실행됩니다.',
  'app.processes.name.lighting': '동적 조명',
  'app.processes.what.lighting':
    'Windows 동적 조명과 함께 작동하는 장치에 장면의 색상을 전달합니다. 조명이 켜져 있거나 해당 페이지가 열려 있는 동안에만 실행됩니다.',
  'app.processes.name.helper': '도우미',
  'app.processes.what.helper':
    '요청 시 Chromium 서비스가 시작되었습니다. FluidEQ는 절대로 이름을 물어보지 않습니다.',
  'app.menu.reinstallApp': '{product} 다시 설치…',
  'app.menu.fixAudio': '오디오 문제 해결…',
  'engine.apo.reinstall': 'Equalizer APO 다시 설치…',
  'engine.title': 'FluidEQ에서 소리를 어떻게 처리할까요?',
  'engine.subtitle':
    '하나의 엔진이 전체 PC에 대해 실행됩니다. 전환하면 Windows에 한 번 권한을 요청합니다.',
  'engine.now': '현재: {engine}',
  'engine.recommended': '권장',
  'engine.fluid.name': 'FluidEQ 엔진',
  'engine.fluid.l1': '사운드 카드의 자체 효과와 패널이 계속 작동합니다.',
  'engine.fluid.l2':
    '다시 시작하지 않아도 EQ와 DSP 랙이 모든 소리에 적용됩니다',
  'engine.fluid.l3':
    '사용자 정의 APO 명령, Peace 및 VST 플러그인이 실행되지 않습니다.',
  'engine.fluid.l4':
    'Equalizer APO가 실행되는 동안 꺼지고, 스위치로 바꾸면 원래대로 돌아옵니다.',
  'engine.apo.name': 'Equalizer APO',
  'engine.apo.l1': '사용자 정의 명령, Peace, VST 플러그인',
  'engine.apo.l2':
    '사운드 카드의 효과 슬롯을 대신합니다. 공급업체 패널이 통제력을 잃을 수 있음',
  'engine.apo.l3':
    'DSP 랙은 라이브러리 재생에서만 작동합니다. 별도의 설정을 하면 Windows가 다시 시작됩니다.',
  'engine.apply': '적용',
  'engine.cancel': '취소',
  'engine.close': '닫기',
  'engine.switched': '{engine}로 전환됨',
  'engine.installing': '엔진을 바꾸는 중…',
  'engine.declined': 'Windows 권한이 거부되었으므로 변경된 사항이 없습니다.',
  'engine.failed': '엔진을 전환할 수 없습니다. 아무것도 바뀌지 않았습니다.',
  'engine.detachFailed':
    'FluidEQ 엔진을 이 출력에서 제거할 수 없습니다. 아무것도 바뀌지 않았습니다.',
  'engine.unsupported': 'Windows 10 버전 1803 이상이 필요합니다.',
  'prereq.title.apo': 'Equalizer APO에 주의가 필요함',
  'prereq.title.fluid': 'FluidEQ 엔진에 주의가 필요합니다.',
  'prereq.install.apo': 'APO 설치',
  'prereq.install.fluid': 'FluidEQ 엔진 설치',
  'prereq.retry': '다시 시도',
  'prereq.dismiss': '닫기',
  'prereq.credit.apo':
    'Equalizer APO는 {product}에 포함되어 있으므로 아무 것도 다운로드되지 않습니다. 설정 시 이퀄라이징할 오디오 장치를 묻고 나중에 다시 시작해야 합니다. {author}로 별도의 GPLv2 프로젝트가 변경되지 않고 번들로 제공됩니다.',
  'prereq.starting': '시작 중…',
  'prereq.bundleMissing':
    '이 빌드에는 Equalizer APO 사본이 없습니다. 대신 공식 프로젝트를 여세요.',
  'prereq.notStarted':
    'Equalizer APO가 시작되지 않았습니다. 관리자 권한이 필요합니다. 다시 시도하고 Windows 프롬프트를 승인하십시오.',
  'whatsNew.eyebrow': '버전 기록',
  'whatsNew.title': 'FluidEQ 릴리스 노트',
  'whatsNew.loading': '릴리스 노트를 불러오는 중…',
  'whatsNew.missing':
    '이 빌드에서는 릴리스 노트를 찾을 수 없습니다. GitHub에도 있습니다.',
  'whatsNew.ok': '확인',
  'app.menu.whatsNew': '새로운 소식',
  'app.menu.language': '언어',
  'app.window.minimize': '최소화',
  'app.window.maximize': '최대화',
  'app.window.restore': '복원',
  'app.window.close': '닫기',
  'app.tray.open': '{product} 열기',
  'app.tray.recoverWindow': '창 복구',
  'app.tray.quit': '{product} 종료',
  'app.tray.tooltip': '{product} — 아직 실행 중',
  'app.tray.installUpdate': '업데이트 설치 및 다시 시작',
  'app.tray.checkForUpdates': '업데이트 확인',
  'app.tray.tooltip.updateReady': '{product} — 업데이트 설치 준비 완료',
  'app.notification.updateReady.title': 'FluidEQ 업데이트 준비됨',
  'app.notification.updateReady.body':
    '{version} 버전이 준비되었습니다. 클릭하면 FluidEQ를 다시 시작합니다.',
  'app.notification.updateReady.bodyNoVersion':
    '업데이트가 준비되었습니다. FluidEQ를 다시 시작하려면 클릭하세요.',
  'app.notification.upToDate.title': 'FluidEQ가 최신 상태입니다.',
  'app.notification.upToDate.body': '이미 최신 버전이 있습니다.',
  'app.notification.updateFound.title': 'FluidEQ 업데이트 발견',
  'app.notification.updateFound.body':
    '{version} 버전을 다운로드 중입니다. 설치할 준비가 되면 알려줄 것입니다.',
  'app.notification.checkFailed.title': '업데이트를 확인할 수 없습니다.',
  'app.notification.checkFailed.body':
    '업데이트 서버에 연결할 수 없습니다. FluidEQ는 나중에 다시 시도합니다.',
  'app.notification.installFailed.title': '업데이트를 설치할 수 없습니다.',
  'app.notification.installFailed.body':
    'FluidEQ가 설치 프로그램을 시작할 수 없습니다. FluidEQ를 클릭하여 열고 다시 시도하세요.',
  'app.window.minimizeApp': 'FluidEQ 최소화',
  'app.window.maximizeApp': 'FluidEQ 최대화',
  'app.window.restoreApp': 'FluidEQ 복원',
  'app.window.closeApp': 'FluidEQ 닫기',
  'app.media.previous': '이전 트랙',
  'app.media.playPause': '재생 또는 일시중지',
  'app.media.next': '다음 트랙',
  'app.media.previousAria': '이 컴퓨터에서 재생 중인 미디어의 이전 트랙',
  'app.media.playPauseAria':
    '이 컴퓨터에서 재생 중인 미디어 재생 또는 일시 중지',
  'app.media.nextAria': '이 컴퓨터에서 재생 중인 미디어의 다음 트랙',
  'app.dismiss': '닫기',
  'common.search': '검색…',
  'common.recentSearches': '최근 검색어',
  'common.clearRecentSearches': '최근 검색 지우기',
  'common.clearSearch': '검색 지우기',
  'common.noMatches': '일치하는 항목 없음',
  'common.filterOptions': '필터 옵션',
  'common.increase': '{item} 증가',
  'common.decrease': '{item} 감소',
  'common.icon.edit': '편집',
  'common.icon.delete': '삭제',
  'common.icon.trash': '제거',
  'common.icon.accept': '수락',
  'common.icon.cancel': '취소',
  'tabs.aria': '사운드 작업 공간',
  'tabs.eq': 'EQ',
  'tabs.eqMain': '밴드',
  'tabs.presets': 'EQ 프리셋',
  'tabs.convolution': '컨볼루션',
  'tabs.games': '게임 프리셋',
  'tabs.config': '설정 파일',
  'tabs.media': '온라인 미디어',
  'tabs.mediaShort': '미디어',
  'tabs.karaoke': '노래방',
  'tabs.plus': '비주얼라이저',
  'tabs.scrollBack': '탭을 뒤로 스크롤',
  'tabs.scrollForward': '탭을 앞으로 스크롤',
  'notice.apoReconfigured':
    'Equalizer APO가 설치되었거나 재구성되었습니다. 오디오가 누락된 경우 PC를 재부팅하는 대신 Windows 오디오를 다시 로드하세요.',
  'notice.restartNow': '지금 오디오 다시 시작',
  'notice.importComplete': '가져오기 완료',
  'notice.apoReconfiguredTitle': 'Equalizer APO가 변경됨',
  'notice.captureFailed': '라이브 출력을 시작할 수 없습니다',
  'notice.captureFailedBody':
    '현재 그래프의 레벨 미터와 라이브 곡선은 꺼져 있습니다. 다른 모든 것은 정상적으로 작동합니다.',
  'notice.tryAgain': '다시 시도',
  'notice.restartConfirm':
    '오디오가 몇 초 동안 중지되고 Windows에서 관리자 권한을 요청합니다. 계속하다?',
  'restart.title': 'Windows 오디오 다시 시작',
  'restart.action': '오디오 다시 시작',
  'restart.running': '오디오 다시 시작 중…',
  'restart.failed': 'Windows 오디오를 다시 시작할 수 없습니다.',
  'restart.tryAgain': '다시 시도',
  'restart.close': '닫기',
  'restart.declined':
    'Windows 권한이 거부되어 오디오가 다시 시작되지 않았습니다.',
  'update.title': 'FluidEQ 업데이트',
  'update.available':
    '{version} 버전을 사용할 수 있습니다. 지금 다운로드 중입니다.',
  'update.downloading': '업데이트 다운로드 중… {percent}%',
  'update.ready':
    '버전 {version}가 준비되었습니다. 완료하려면 FluidEQ를 다시 시작하세요.',
  'update.restart': '지금 다시 시작',
  'update.restarting': '다시 시작하는 중…',
  'update.mandatory.title': '이 버전을 업데이트해야 합니다',
  'update.mandatory.body':
    '이 릴리스에서는 FluidEQ가 그대로 실행되지 않을 정도로 심각한 문제를 수정합니다. 지금 업데이트를 가져오는 중입니다.',
  'update.mandatory.notOptional':
    '이는 선택적 업데이트가 아닙니다. 이 알림을 닫고 수행 중인 작업을 완료하면 FluidEQ가 업데이트될 때까지 다시 나타납니다.',
  'update.mandatory.later': '지금은 아님',
  'update.mandatory.waiting': '업데이트를 가져오는 중…',
  'update.mandatory.readyPrompt':
    '업데이트가 다운로드되었습니다. FluidEQ는 설치하는 동안 닫혔다가 나중에 다시 열립니다.',
  'update.mandatory.install': '설치 및 다시 시작',
  'update.mandatory.installing': '설치 중…',
  'update.mandatory.failedDownload':
    '업데이트를 다운로드할 수 없습니다. 다운로드 서버에 연결할 수 없거나 연결이 도중에 중단되었습니다.',
  'update.mandatory.failedInstall':
    '업데이트가 다운로드되었지만 설치 프로그램이 시작되지 않았습니다. Windows에서 거부했거나 다운로드한 파일이 손상되었을 수 있습니다.',
  'update.mandatory.manual':
    '대신 직접 설치할 수도 있습니다. 릴리스 페이지에서 최신 버전을 다운로드하여 실행하세요. 귀하의 설정과 프로필은 유지됩니다.',
  'update.mandatory.releasePage': '다운로드 페이지 열기',
  'notice.restartDone':
    'Windows 오디오가 다시 시작되었습니다. 여전히 침묵하는 응용 프로그램을 다시 엽니다.',
  'sidebar.systemEq': '시스템 EQ',
  'sidebar.state.on': '{engine} · 켜짐',
  'sidebar.state.off': '꺼짐',
  'sidebar.state.notOnOutput': '이 출력에는 없음',
  'sidebar.preamp': '프리앰프',
  'sidebar.autoLabel': '자동',
  'sidebar.preampAria': '프리앰프 게인(dB)',
  'sidebar.preampAuto':
    '자동으로 설정됩니다. 직접 조절하려면 자동 정규화를 끄세요.',
  'sidebar.autoPreamp': '자동 정규화',
  'sidebar.graphView': '응답 그래프',
  'sidebar.output': '출력',
  'config.eyebrow': '엔진이 읽는 것',
  'config.title': 'Equalizer APO 구성',
  'config.title.fluid': 'FluidEQ 엔진 구성',
  'config.lede': 'FluidEQ가 의도한 것이 아닌 현재 디스크에 있는 내용입니다.',
  'config.reload': '새로고침',
  'config.reloadTitle': '디스크에서 구성을 다시 읽습니다.',
  'config.reading': '읽는 중…',
  'config.absent': 'FluidEQ는 아직 이 Equalizer APO 설치에 쓰지 않았습니다.',
  'config.absent.fluid':
    'FluidEQ는 아직 FluidEQ 엔진 구성을 작성하지 않았습니다.',
  'config.status.notIncluded':
    'Equalizer APO에는 이 구성이 포함되어 있지 않습니다. 아래에는 아무것도 적용되지 않습니다.',
  'config.status.notIncluded.fluid':
    'FluidEQ 엔진이 이 구성을 읽지 않습니다. 아래에는 아무것도 적용되지 않습니다.',
  'config.status.engineOff':
    '시스템 EQ가 꺼졌습니다. 이 구성은 출력 이름을 지정하지 않으므로 Equalizer APO는 아무 것도 적용하지 않습니다.',
  'config.status.engineOff.fluid':
    '시스템 EQ가 꺼졌습니다. 이 구성은 출력 이름을 지정하지 않으므로 FluidEQ 엔진은 아무 것도 적용하지 않습니다.',
  'config.status.active': '활성 — Equalizer APO가 이 구성을 적용하고 있습니다.',
  'config.status.active.fluid':
    '활성 — FluidEQ 엔진이 이 구성을 적용하고 있습니다.',
  'config.outputsAria': 'Equalizer APO 구성의 출력',
  'config.outputsAria.fluid': 'FluidEQ 엔진 구성의 출력',
  'config.filters.one': '{count} 필터',
  'config.filters.many': '{count} 필터',
  'config.impulse': '임펄스 응답',
  'config.playingNow': '지금 재생 중',
  'config.liveTitle': 'Continuous EQ는 이를 측정 상태로 유지합니다.',
  'config.layer.on': '켜짐',
  'config.layer.off': '꺼짐',
  'config.layers.noFile': '자체 파일 없음',
  'config.layers.inFile': '자체 파일이 아닌 이 파일에 기록됩니다.',
  'config.empty': '아무것도 포함되지 않습니다. 이 출력은 그대로 남아 있습니다.',
  'config.file.missing': '파일 없음',
  'config.export': '효과 체인 내보내기',
  'config.import': '효과 체인 가져오기',
  'config.import.hint': '현재 듣고 있는 출력 장치에 가져온 설정을 적용합니다.',
  'config.import.customSkipped':
    '보낸 사람의 사용자 정의 파일을 건너뛰었습니다. 포함: 또는 플러그인: 줄이 Windows 오디오에 코드를 로드합니다.',
  'config.file.yours': '사용자 파일',
  'config.hint.custom':
    '사용자가 작성한 파일입니다. 자동으로 덮어쓰지 않습니다.',
  'config.hint.generated': '생성됨 - 다음 변경 시 다시 작성됩니다.',
  'config.hint.saving':
    '저장하면 파일이 기록되고 Equalizer APO가 변경 사항을 적용합니다.',
  'config.hint.saving.fluid':
    '저장하면 파일이 기록되고 FluidEQ Engine이 변경 사항을 적용합니다.',
  'config.edit': '편집',
  'config.cancel': '취소',
  'config.save': '저장',
  'disclaimer.heading': '보증도 없고 책임도 없습니다',
  'disclaimer.asIs':
    'FluidEQ는 어떠한 종류의 보증도 없이 있는 그대로 제공됩니다. 아무도 그것이 효과가 있다고, 당신이 원하는 것에 적합하다고, 계속해서 효과가 있을 것이라고 약속하지 않습니다. 이것이 GNU General Public License의 15조와 16조에 명시된 내용이며, 이는 귀하가 이 사본을 받았는지 아니면 비용을 지불했는지에 관계없이 적용됩니다.',
  'disclaimer.liability':
    'FluidEQ는 컴퓨터에서 오디오가 처리되는 방식을 변경하며, 관리자 권한으로 실행되고 Windows 오디오 경로에 있는 별도의 프로그램인 Equalizer APO를 설치하고 구동합니다. 법률이 허용하는 최대 한도 내에서 {author}는 청각, 스피커, 헤드폰 또는 기타 장비, 데이터 또는 기타 소프트웨어 또는 예측할 수 없는 손실을 포함하여 기타 모든 것에 대한 사용으로 인해 발생하는 모든 피해에 대해 책임을 지지 않습니다.',
  'disclaimer.volume':
    '소리는 클 수 있으며 이퀄라이제이션을 사용하면 원래의 소리보다 더 크게 만들 수 있습니다. 설정을 변경하기 전에 볼륨을 낮게 설정하고 나중에 높이십시오.',
  'disclaimer.localLaw':
    '일부 국가에서는 판매자가 특정 보증이나 책임을 배제하는 것을 허용하지 않습니다. 그러한 경우 해당 규칙이 적용되며 본 통지문은 법이 귀하에게 부여한 권리를 박탈하지 않습니다.',
  'disclaimer.accepting': 'FluidEQ를 사용하면 위 내용에 동의하게 됩니다.',
  'disclaimer.language':
    '이 공지는 영어로 작성되었습니다. 번역문이 영어본문과 다른 경우에는 영어본문이 적용됩니다.',
  'disclaimer.accept': '내용을 이해했으며 동의합니다',
  'disclaimer.decline': '종료',
  'provenance.heading': '이 사본의 출처를 확인하세요.',
  'provenance.body':
    'FluidEQ의 공식 서명 설치 프로그램은 fluideq.com을 통해서만 제공됩니다. 소스 빌드는 공식 저장소에서 가져와야 합니다. GPL은 제3자가 FluidEQ를 복사, 수정, 재구축 및 판매하는 것을 허용하지만 해당 빌드는 FluidEQ에 의해 자동으로 서명, 검토, 지원 또는 승인되지 않습니다. 다운로드가 공식적인 것으로 주장하고 유효한 Windows 디지털 서명이 없는 경우 해당 다운로드를 닫고 신고하세요.',
  'provenance.site': '공식 사이트: fluideq.com',
  'provenance.repository': '공식 출처: github.com/StartSWest/FluidEQ',
  'language.aria': '인터페이스 언어',
  'motion.aria': '애니메이션',
  'motion.restart': '적용하려면 FluidEQ를 다시 시작하세요.',
  'startup.label': 'Windows 시작 시 실행',
  'startup.blocked': 'Windows의 시작 앱에서 이 기능이 꺼져 있습니다.',
  'startup.failed': 'Windows에서 설정을 변경하지 못했습니다.',
  'settings.group.picture': '화면',
  'settings.group.visualizer': '비주얼라이저',
  'settings.group.drawing': '렌더링 방식',
  'settings.group.thisView': '이 보기',
  'settings.group.studioOnly': 'Studio에서만 적용',
  'games.add': '게임 추가',
  'games.addHint':
    '런처에서 게임을 선택하거나 현재 열려 있는 프로그램을 선택하세요.',
  'games.choose': '프로그램을 선택하세요…',
  'games.group.installed': '설치됨',
  'games.group.running': '현재 실행 중',
  'games.source.steam': 'Steam',
  'games.source.epic': 'Epic Games',
  'games.source.ea': 'EA',
  'games.source.gog': 'GOG',
  'games.source.ubisoft': 'Ubisoft',
  'games.source.battlenet': 'Battle.net',
  'games.source.xbox': 'Xbox',
  'games.source.running': '현재 실행 중',
  'games.source.file': '직접 선택',
  'games.front.playing': '{name}가 전면에 있고 소리가 켜져 있습니다.',
  'games.front.sounding': '{name}가 실행 중이고 소리가 켜져 있습니다.',
  'games.front.off':
    '게임 프리셋이 꺼져 있습니다. 게임은 자신만의 사운드를 유지합니다.',
  'games.switch.hint':
    '끄기: 어떤 게임도 사운드를 변경하지 않으며 FluidEQ는 어떤 프로그램이 앞에 있는지 관찰을 중지합니다. 귀하의 목록은 그대로 유지됩니다.',
  'games.toast.loaded': '{preset} 로드됨',
  'games.toast.forGame': '{game}의 경우',
  'games.toast.restored': '{preset}로 돌아가기',
  'games.toast.restoredNone': '효과가 다시 꺼짐',
  'games.toast.afterGame': '{game} 이후',
  'games.empty.title': '아직 게임 없음',
  'games.empty.more':
    '게임을 추가하고 소리를 내면 FluidEQ는 게임이 시작되는 순간 해당 게임으로 전환하고 게임을 닫으면 다시 게임으로 전환합니다.',
  'games.preset.none': '그대로 두세요',
  'games.preset.noneHint': '이 게임이 앞에 있어도 달라지는 것은 없습니다.',
  'games.row.inFront': '활성 창',
  'games.row.sounding': '소리 켜짐',
  'games.row.sound': '{name}용 사운드',
  'games.row.remove': '{name} 제거',
  'error.apoMissing': 'Equalizer APO가 설치되지 않았습니다.',
  'error.apoMissing.action': '다시 시도하기 전에 Equalizer APO를 설치하십시오.',
  'error.configMissing': 'Equalizer APO에 대한 구성 파일을 찾을 수 없습니다.',
  'error.configMissing.action':
    'Equalizer APO의 config 폴더에 config.txt 파일이 있는지 확인하세요.',
  'error.invalidParameter': '내부 오류: 잘못된 매개변수입니다.',
  'error.reachOut': '문제를 해결하려면 개발자에게 문의하세요.',
  'error.failure': '내부 오류: 이퀄라이저 설정을 적용하지 못했습니다.',
  'error.failure.action':
    '응용 프로그램을 다시 시작하십시오. 오류가 지속되면 개발자에게 연락하여 문제를 해결해 보세요.',
  'error.presetFile': '내부 오류: 프리셋 파일을 읽거나 수정하지 못했습니다.',
  'error.presetFile.action':
    '프리셋 이름이 파일로 저장 가능한지, 설치 디렉터리가 쓰기 가능한 위치에 있는지 확인하세요. 또한 사용 가능한 저장 공간이 있는지 확인하세요. 오류가 지속되면 개발자에게 연락하여 문제를 해결해 보세요.',
  'error.presetName': '내부 오류: 잘못된 프리셋 이름이 제공되었습니다.',
  'error.presetName.action':
    '다른 프리셋 이름을 입력하세요. 오류가 지속되면 개발자에게 연락하여 문제를 해결해 보세요.',
  'error.opra': '내부 오류: 헤드폰 프리셋 라이브러리를 읽지 못했습니다.',
  'error.convolutionCatalog': '컨볼루션 카탈로그에 접근할 수 없습니다.',
  'error.convolutionCatalog.action': '연결을 확인하고 다시 시도해 주세요.',
  'error.import': '해당 파일을 가져올 수 없습니다.',
  'error.import.action':
    '파일이 Equalizer APO EQ 텍스트 파일, FluidEQ 프로필 또는 WAV 임펄스 응답인지 확인하세요.',
  'error.engineNotChosen': '아직 오디오 엔진이 선택되지 않았습니다.',
  'error.engineNotChosen.action':
    'FluidEQ가 사용해야 하는 오디오 엔진을 선택하세요.',
  'error.engineMissing': 'FluidEQ 엔진이 설치되지 않았습니다.',
  'error.engineMissing.action':
    '다시 시도하기 전에 FluidEQ 엔진을 설치하십시오.',
  'app.apoReinstall.confirm':
    'Equalizer APO를 다시 설치하시겠습니까?\n\n이퀄라이징할 오디오 장치를 다시 선택할 수 있도록 설정이 열립니다. Windows에서는 관리자 권한을 요청하며 이후에는 컴퓨터를 다시 시작해야 합니다.\n\nFluidEQ 설정 및 프로필은 영향을 받지 않습니다.',
  'app.apoReinstall.noBundle':
    '이 FluidEQ 사본에는 Equalizer APO 설치 프로그램이 내부에 없습니다.\n\n대신 Equalizer APO의 자체 다운로드 페이지를 엽니다. 거기에서 설치하면 FluidEQ가 찾을 것입니다.',
  'app.apoReinstall.notStarted':
    'Equalizer APO가 시작되지 않았습니다.\n\n관리자 권한이 필요합니다. 다시 시도하고 Windows 프롬프트를 승인하세요.',
  'app.site.open': '브라우저에서 fluideq.com 열기',
  'config.customCommands': '사용자 소유 사용자 정의 APO 명령',
} satisfies Partial<Dictionary>;

export default app;
