/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dictionary } from '../en';

/** `./en.ts` in Korean, in the shared Korean dictionary's own terms. */
const ko: Partial<Dictionary> = {
  'wallpaper.manage.empty':
    '모든 모니터에 원래의 바탕 화면 배경이 표시되고 있습니다.',
  'wallpaper.monitor.ordinary': '바탕 화면 배경',
  'wallpaper.pause.locked': '화면이 잠겨 있는 동안 일시 중지됨',
  'wallpaper.error.unsupported':
    '바탕 화면 배경을 사용하려면 GNOME과 FluidEQ Desktop 확장이 필요합니다.',
  'wallpaper.error.host':
    '시각화 도우미가 바탕 화면에 닿지 못했습니다. 확장에서 FluidEQ Desktop을 켠 다음 다시 시도해 보세요.',
  'app.menu.restartAudio': '오디오 다시 시작',
  'restart.title': '오디오 다시 시작',
  'restart.failed': '오디오를 다시 시작할 수 없습니다.',
  'notice.restartConfirm':
    'FluidEQ 엔진이 다시 시작되는 동안 몇 초간 오디오가 멈춥니다. 계속할까요?',
  'notice.restartDone':
    '오디오가 다시 시작되었습니다. 여전히 소리가 나지 않는 앱은 다시 여세요.',
  'troubleshoot.restart.title': '오디오 다시 시작',
  'troubleshoot.restart.cost':
    'FluidEQ 엔진이 다시 시작되는 동안 몇 초간 소리가 나지 않습니다. 암호는 필요 없습니다.',
  'engine.title': 'FluidEQ가 소리를 처리하는 방식',
  'engine.subtitle':
    'FluidEQ 엔진은 FluidEQ가 열려 있는 동안 사운드 서버(PipeWire 또는 PulseAudio) 옆에서 실행됩니다.',
  'engine.fluid.l1':
    '어떤 배포판에서든 PipeWire 및 PulseAudio와 함께 작동합니다',
  'engine.fluid.l2':
    '다시 시작하지 않아도 EQ와 DSP 랙이 듣는 모든 소리에 적용됩니다',
  'engine.fluid.l3': '설정의 Plugin: 줄과 VST 플러그인은 실행되지 않습니다',
  'output.hint':
    '편집 내용은 현재 켜져 있는 프로필에 저장되며, 이 출력이 재생 중일 때마다 이 출력을 따릅니다.',
  'extraOutput.ambiguous':
    '두 출력이 같은 이름을 쓰고 있어 FluidEQ가 어느 쪽인지 알 수 없습니다. 사운드 설정에서 하나의 이름을 바꾸세요.',
  'extraOutput.unmatched':
    '사운드 설정에는 이 출력이 있지만 FluidEQ가 연결할 수 없어 미러링할 수 없습니다.',
  'convolution.eyebrow': '임펄스 응답',
  'convolution.notice.fluid':
    'AutoEq가 다운로드 가능한 카탈로그를 제공합니다. 각 다운로드는 출력이 실행되는 샘플 레이트에 맞으며, 다른 샘플 레이트는 FluidEQ 엔진이 직접 변환합니다.',
  'graph.scene.gpu.auto': '시스템이 결정',
  'settingsReset.body':
    '그래프와 비주얼라이저, 창 색상, 플레이어, 라이브러리, 언어, 애니메이션, 로그인할 때 시작, 바탕 화면 배경이 FluidEQ를 새로 설치했을 때의 상태로 돌아갑니다.',
  'app.processes.hint':
    '모두 같은 프로그램이기 때문에 시스템은 이들 모두에 앱 이름을 붙입니다. 각각이 FluidEQ를 위해 실제로 하는 일은 다음과 같습니다.',
  'app.processes.what.engine':
    'FluidEQ 자체 엔진입니다. 재생하는 내용을 디코딩하면서 이퀄라이저를 적용합니다. 나머지와 분리된 프로그램이라 창이 바빠도 음악이 멈추지 않습니다.',
  'app.processes.what.devices':
    '앱이 어떤 오디오 장치가 있는지 물을 때 Chromium이 시작하며, 같은 요청으로 비디오 장치도 나열됩니다. 카메라를 열지 않고 아무것도 녹화하지 않습니다.',
  'app.processes.name.systemEngine': 'FluidEQ 엔진(시스템 오디오)',
  'app.processes.what.systemEngine':
    '앱과 사운드 서버 사이에 있는 이퀄라이저로, 듣는 모든 소리에 적용됩니다. FluidEQ가 자신과 함께 시작하고 멈추며, 메모리와 CPU는 표시되지만 합계에는 더해지지 않습니다.',
  'dsp.normalizer.liveGuidance':
    '실시간 레벨링은 재생 중인 곡을 기준으로 동작합니다. 큰 소리가 나오는 구간을 만나면 해당 곡의 나머지 부분에 적용할 게인을 낮춥니다. 다음 곡의 음량이 훨씬 작지 않으면 같은 레벨을 유지합니다. 이전에 들었던 곡에는 처음부터 레벨링을 적용합니다. 피크 헤드룸이 허용하는 범위에서 게인을 최대 6 dB 높이므로 목표 음량에 도달하지 못할 수도 있습니다. 껐다가 다시 켜면 새로 학습합니다. 이미 생긴 왜곡은 복구할 수 없습니다.',
  'dsp.latency.hint':
    '엔진에서 추가되는 처리 지연입니다. 사운드 서버, 장치, 네트워크의 지연 시간은 포함하지 않습니다.',
  'dsp.latency.note':
    '현재 샘플 레이트에서 엔진이 보고한 처리 버퍼입니다. 사운드 서버, 장치, 네트워크의 지연 시간은 포함하지 않습니다.',
  'dsp.surround.onHint':
    '출력 설정에 따라 5.1 또는 7.1 출력의 모든 채널에서 랙을 실행하며, 모든 채널에 하나의 레벨 결정을 적용합니다.',
  'update.mandatory.failedInstall':
    '업데이트가 다운로드되었지만 설치 프로그램이 시작되지 않았습니다. 다운로드한 파일이 손상되었을 수 있습니다.',
  'startup.label': '로그인할 때 시작',
  'startup.blocked': '데스크톱의 시작 앱에서 이 기능이 꺼져 있습니다',
  'startup.failed': '시스템에서 설정을 변경하지 못했습니다',
  'disclaimer.liability':
    'FluidEQ는 컴퓨터에서 오디오가 처리되는 방식을 바꿉니다. 엔진이 앱과 사운드 서버 사이에 위치하여 듣는 모든 소리를 처리합니다. 법률이 허용하는 최대 한도 내에서 {author}는 FluidEQ 사용으로 인해 청각, 스피커, 헤드폰 또는 기타 장비, 데이터 또는 기타 소프트웨어, 그 밖의 모든 것에 생기는 피해에 대해, 예측할 수 없었던 손실을 포함하여 책임을 지지 않습니다.',
  'provenance.body':
    'FluidEQ의 공식 패키지는 fluideq.com을 통해서만 제공됩니다. 소스 빌드는 공식 저장소에서 가져와야 합니다. GPL은 제3자가 FluidEQ를 복사, 수정, 재빌드 및 판매하는 것을 허용하지만, 그들의 빌드는 FluidEQ가 검토, 지원 또는 보증하지 않습니다. 공식이라고 주장하는 다운로드가 fluideq.com이나 공식 저장소에서 온 것이 아니라면 닫고 신고하세요.',
  'engineHealth.offBody':
    '이 출력에서 EQ 없이 소리가 재생되고 있습니다. 오디오를 다시 시작하면 대개 엔진이 돌아오며, 그동안 FluidEQ의 다른 기능은 모두 계속 작동합니다.',
  'engineHealth.rackNeedsEngine':
    'DSP 효과는 엔진 안에서 실행됩니다. 오디오를 다시 시작하면 엔진이 다시 시작되며, 그래도 해결되지 않으면 FluidEQ를 다시 설치하여 자체 엔진을 제자리에 되돌리세요.',
  'tour.engine.lead':
    '이제 FluidEQ에는 자체 오디오 엔진이 있습니다. 사운드 서버(PipeWire 또는 PulseAudio) 옆에서 실행되며, 라이브러리뿐 아니라 게임, 브라우저, 스트리밍 앱 등 컴퓨터가 재생하는 모든 것에 EQ와 전체 DSP 랙을 적용합니다.',
  'tour.engine.flow.inside': '사운드 서버 옆',
  'tour.dsp.lead':
    '스튜디오 효과를 모은 랙입니다. 노멀라이저, 노이즈 제거, 익사이터, Bass Forge, 이퀄라이저, Bass Punch, 스테레오 확장, 룸, 맥시마이저, 마스터와 라이브러리 트랙 사이의 크로스페이드가 있습니다. 컴퓨터에서 재생되는 모든 소리에 적용됩니다. 각 단계에는 실시간 시각화가 있는 전용 페이지가 있고 대부분 프리셋도 제공합니다. 다섯 단계는 분리 듣기를 켜서 해당 효과가 더하는 소리만 들을 수 있습니다.',
  'tour.dsp.how':
    'DSP 탭을 열고 프리셋에서 체인을 선택한 다음 측면 탭에서 단계를 클릭하고 켜기로 전환합니다.',
  'help.start.steps':
    '.deb 또는 AppImage로 FluidEQ를 설치하고 엽니다. FluidEQ 엔진이 함께 시작되며 암호나 재시작이 필요 없습니다.\n출력 장치에서 듣는 장치를 고릅니다. 시스템 EQ를 켜고 자동 정규화는 켜 둡니다.\n노래를 재생하고 EQ → 밴드를 열어 작은 변경을 한 다음, 시스템 EQ를 껐을 때와 켰을 때를 비교합니다.',
  'help.start.tip':
    'Linux에서 시스템 전체 EQ를 쓰려면 PipeWire 또는 PulseAudio가 필요하며, 현재의 모든 데스크톱이 이를 사용합니다. FluidEQ가 열려 있는 동안 재생하는 모든 것이 FluidEQ를 거치며, 종료하면 사운드가 그대로 돌아옵니다.',
  'help.window.tip':
    '도움말에서는 이 가이드, 새로운 소식, 오디오 문제 해결사, 문제 신고를 엽니다. 그 옆의 펄스 버튼에는 엔진 카드, 계정, EQ 설정이나 임펄스 응답 가져오기, 오디오 다시 시작, 그리고 FluidEQ의 각 부분이 무엇을 사용하는지 보여 주는 프로세스가 있고, 맨 아래에는 밝기와 투명성, 애니메이션, 로그인할 때 시작, 언어가 있습니다. 그다음 스위치는 창을 컴팩트 플레이어로 바꿉니다.',
  'help.window.actions':
    '엔진, 계정, EQ 설정 가져오기, 오디오 다시 시작과 프로세스, 그리고 밝기와 투명성, 애니메이션, 로그인할 때 시작, 언어.',
  'help.player.tip':
    '플레이어의 볼륨은 컴퓨터 자체의 볼륨이라 컴퓨터가 재생하는 모든 것의 레벨을 정합니다. 플레이어가 화면 밖으로 나가면 상단 막대의 FluidEQ 아이콘을 마우스 오른쪽 버튼으로 클릭하고 창 복구를 선택하세요.',
  'help.player.volume':
    '컴퓨터의 볼륨으로, 컴퓨터가 재생하는 모든 것의 레벨을 정합니다.',
  'help.requirements.intro':
    'FluidEQ는 최근 몇 년 사이의 모든 64비트 Linux 데스크톱(Ubuntu, Debian, Fedora, Mint, Arch 등)에서 실행됩니다. 두 부분은 나머지보다 더 많은 것을 요구합니다. 비주얼라이저는 그래픽 카드에 그려지고, 노래방 AI는 처음 사용할 때 모델을 다운로드합니다.',
  'help.requirements.steps':
    '시스템을 확인하세요. PipeWire 또는 PulseAudio(현재의 모든 데스크톱에 있음)가 있는 64비트 Linux, 4GB 메모리, 약 600MB 디스크가 필요합니다. .deb는 Ubuntu, Debian 및 그 계열용이고, 나머지에서는 AppImage가 실행됩니다.\n비주얼라이저를 살펴보세요. 2013년 이후의 모든 그래픽 카드 또는 내장 그래픽이면 됩니다. 1080p에서는 내장 그래픽으로 충분하고, 4K에서는 전용 카드가 더 좋습니다. 바쁜 카드에서는 FluidEQ가 장면을 더 작게 그리고 보이지 않는 장면은 놓아 줍니다.\n노래방 AI를 사용해 보세요. 음성을 분리하면 처음에 713MB 모델을 다운로드하고, 피치 모델이 약 180MB, 노이즈 제거가 11MB를 더합니다. 프로세서에서 실행되며 4분짜리 노래를 약 4분 만에 분리합니다. 작업하는 동안 2GB의 메모리를 비워 두세요.\n가능하다면 이 정도를 목표로 하세요: 8GB 메모리, 2018년 이후의 그래픽, AI 기능을 사용한다면 3GB의 여유 디스크 공간.',
  'help.requirements.keywords':
    '시스템 요구 사항, 요구 사항, 사양, 하드웨어, 노트북, GPU, 그래픽 카드, 비디오 카드, CPU, 프로세서, 램, 메모리, 디스크 공간, 저장 공간, linux, ubuntu, debian, fedora, mint, arch, pipewire, pulseaudio, deb, appimage, 최소, 권장, 성능, 느림, 지연, 호환성',
  'help.engine.intro':
    'FluidEQ는 자체 엔진으로 소리를 처리합니다. FluidEQ 엔진은 사운드 서버(PipeWire 또는 PulseAudio) 옆에서 실행되며, 시스템의 출력이 되어 컴퓨터가 재생하는 모든 것에 EQ와 DSP 랙을 적용하고, 그 결과를 실제 출력으로 보내며, FluidEQ가 닫히는 순간 물러납니다.',
  'help.engine.steps':
    '작업 메뉴(오른쪽 위의 펄스 버튼)를 엽니다. 맨 위의 엔진 카드에서 엔진이 실행 중인지 알 수 있습니다.\n출력 패널에서 듣는 출력을 고릅니다. FluidEQ가 그 출력으로 재생하며, 사운드 설정에서 다른 출력을 고르면 따라갑니다.\n엔진이 실행되고 있지 않다는 알림이 나오면 오디오 다시 시작을 누르세요.',
  'help.engine.tip':
    'FluidEQ를 시스템 출력으로 두세요. 사운드 설정에서 스피커나 헤드셋을 골라도 괜찮으며, FluidEQ가 따라갑니다. FluidEQ를 종료하면 모든 앱이 직접 고른 출력으로 돌아갑니다.',
  'help.engine.keywords':
    '오디오 엔진, 드라이버, 시스템 전체, 모든 앱, spotify, 브라우저, discord, pipewire, pulseaudio, 사운드 서버, 출력, 기본 출력, 오디오 다시 시작',
  'help.engine.apo':
    'Linux에는 없음: Equalizer APO는 Windows 프로그램이며, 여기서는 FluidEQ 엔진이 그 일을 합니다.',
  'help.engine.apply':
    'Linux에서는 필요 없음: FluidEQ 엔진이 유일한 엔진이며 이미 사용 중입니다.',
  'help.convolution.tip':
    'FluidEQ 엔진은 임펄스의 샘플 레이트를 직접 변환합니다. 카탈로그 다운로드에는 연결이 필요하지만 가이드는 그렇지 않습니다.',
  'help.profiles.output':
    '듣고 있는 출력과, 블루투스 헤드폰이라면 그 배터리입니다. OFF는 EQ가 닿지 않는다는 뜻이고, ACTIVE는 지금 재생 중인 출력이라는 뜻입니다.',
  'help.config.tip':
    '생성된 레이어 파일은 설정이 바뀌면 다시 작성됩니다. 오래 유지할 수동 줄은 출력별 사용자 정의 파일에 넣으세요. FluidEQ 엔진은 Filter, Preamp, GraphicEQ, Convolution 줄을 읽으며, Plugin: 줄과 VST 플러그인은 Linux에서 실행되지 않습니다.',
  'help.dsp.intro':
    'DSP 랙은 스튜디오 단계의 체인입니다. FluidEQ 엔진에서는 컴퓨터가 재생하는 모든 것을 처리합니다. FluidEQ가 꺼져 있는 동안에는 꺼집니다.',
  'help.room.tip':
    '게임과 영화는 그만큼의 스피커로 설정된 출력에만 서라운드 채널을 보냅니다. 장치에 스피커가 있다면 사운드 설정에서 5.1 또는 7.1을 고르세요.',
  'help.online.tip':
    'FluidEQ 엔진에서 온라인 미디어는 다른 모든 앱과 마찬가지로 EQ와 DSP 랙을 거칩니다.',
  'help.library.tip':
    '라이브러리에는 원본 파일이 필요합니다. 드라이브를 다시 연결하거나 옮긴 폴더를 다시 추가하세요.',
  'help.share.tip':
    '연결 코드는 비공개로 유지하세요. 연결을 허가하는 코드입니다. 이 컴퓨터는 공유하는 동안 DSP를 켜 두며, 소리를 재생하는 컴퓨터가 자체 DSP를 적용합니다. 재생과 전송을 동시에 하려면 그 컴퓨터에 Windows나 Linux의 FluidEQ 엔진이 필요하며, 그 밖에서는 연결이 한 방향으로만 동작합니다.',
  'help.trouble.steps':
    '소리 없음: 재생 중인지, 원하는 출력이 선택되었는지, 볼륨이 올라가 있는지, 장치가 연결되었는지 확인합니다. 한 번에 한 플레이어만 재생이 다른 소스를 일시 정지했는지 확인합니다.\nEQ 변화 없음: 시스템 EQ가 켜져 있고 출력에 OFF 배지가 없는지 확인합니다. 엔진이 실행되고 있지 않다는 알림이 나오면 오디오 다시 시작을 누르세요.\n모든 것이 맞아 보이는데도 EQ가 아무것도 하지 않음: 사운드 설정에서 FluidEQ가 여전히 출력인지 확인하세요. 오디오를 다시 시작하면 되돌아옵니다.\n왜곡이나 과도한 저음: 자동 정규화를 켜 두고, 부스트를 줄이고, 레이어를 하나씩 우회합니다. 계속되면 문제 신고를 사용하고 보내기 전에 보고서를 검토하세요.',
  'troubleshoot.description':
    'Linux에서는 한 단계로 거의 모든 문제가 해결됩니다. 몇 초 걸리는 FluidEQ 엔진 다시 시작입니다.',
  'troubleshoot.footer':
    '그래도 문제가 있나요? 같은 메뉴의 **{report}**를 사용하세요. 사용자를 식별할 수 있는 내용을 지운 로그를 모아, 어디로든 보내기 전에 전체를 보여 줍니다.',
  'help.window.plus': '비주얼라이저, 갤러리, 스튜디오.',
  'help.plus.intro':
    '계정은 선택 사항입니다. 무료였던 모든 것은 계정 없이도 이 컴퓨터에서 실행됩니다. 로그인하면 비주얼라이저 탭에 갤러리와 스튜디오가 있습니다. 갤러리의 장면은 1크레딧이며 영원히 내 것이 됩니다. 확인된 계정은 일부 크레딧을 무료로 받으며, 크레딧 팩은 한 번만 결제합니다.',
  'help.library.steps':
    '라이브러리를 열고 미디어가 있는 폴더를 추가하세요. 무엇이 빠졌는지 판단하기 전에 검색이 끝나기를 기다리세요.\n아티스트나 앨범을 고르거나 노래를 검색하세요. 결과에서 트랙을 시작합니다.\n창 아래쪽 막대로 일시 정지, 탐색, 건너뛰기를 합니다. 볼륨은 컴퓨터 자체의 볼륨입니다.',
};

export default ko;
