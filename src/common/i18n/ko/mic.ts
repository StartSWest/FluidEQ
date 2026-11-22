/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab: each microphone's own sound, played by the FluidEQ Engine on
 * the microphone itself, so every app hears it (Ivan, 2026-11-20).
 */
export default {
  'mic.tab': '마이크',
  'mic.label': '마이크',
  'mic.pickHint': '조정할 마이크 선택',
  'mic.list.heading': '이 PC의 마이크',
  'mic.list.on': '켜짐',
  'mic.list.off': '설정 안 됨',
  'mic.live': '모든 앱에 적용 중 · 저지연 {ms} ms',
  'mic.notSetUp': '이 마이크는 아직 설정되지 않았습니다',
  'mic.state.opening': '마이크를 여는 중…',
  'mic.state.noInput': '지금 Windows에 이 마이크의 입력이 보이지 않습니다',
  'mic.state.blocked': 'Windows가 FluidEQ의 마이크 열기를 허용하지 않았습니다',
  'mic.state.waiting': '마이크 열림 · 엔진이 시작되기를 기다리는 중',
  'mic.meter.gateOpen': '목소리 통과 중',
  'mic.meter.gateClosed': '게이트 닫힘',
  'mic.meter.compressor': '컴프레서',
  'mic.meter.limiter': '리미터',
  'mic.monitor.label': '내 목소리 듣기',
  'mic.monitor.hint':
    '다른 사람이 듣는 소리를 지금 듣고 있는 출력으로 재생합니다',
  'mic.monitor.warning':
    '헤드폰을 사용하세요. 스피커로 들으면 목소리가 다시 마이크로 들어가 하울링이 생깁니다.',
  'mic.effectsOff.short':
    '이 마이크의 Windows 오디오 향상 기능이 꺼져 있습니다',
  'mic.effectsOff.title': '{mic}의 오디오 향상 기능이 꺼져 있습니다',
  'mic.effectsOff.body':
    '꺼져 있는 동안 Windows는 이 마이크에 어떤 효과도 적용하지 않으므로 FluidEQ가 처리할 수 없습니다. 마이크 속성에서 “오디오 향상”을 켜세요.',
  'mic.effectsOff.button': 'Windows 소리 설정 열기',
  'mic.picture.label':
    '내 목소리: 흐린 선은 마이크가 받은 소리, 밝은 선은 상대가 듣는 소리',
  'mic.picture.raw': '내 마이크',
  'mic.picture.heard': '상대가 듣는 소리',
  'mic.picture.gate': '게이트',
  'mic.profile.label': '마이크 프로필',
  'mic.profile.pickHint': '마이크 사용 방식에 맞춘 프로필로 시작하세요',
  'mic.profile.group.use': '용도별',
  'mic.profile.group.mic': '마이크별',
  'mic.profile.tuned': '조정됨',
  'mic.profile.stream': '스트리밍',
  'mic.profile.stream.hint':
    'Twitch와 YouTube를 위한 따뜻하고 가깝고 안정적인 목소리',
  'mic.profile.podcast': '팟캐스트',
  'mic.profile.podcast.hint': '부드럽게 다듬은 자연스러운 목소리',
  'mic.profile.chat': '게임 채팅',
  'mic.profile.chat.hint':
    'Discord와 팀 채팅에서 또렷하게 앞으로 나오고, 말 사이는 조용하게',
  'mic.profile.sing': '노래',
  'mic.profile.sing.hint':
    '열려 있고 공기감 있는 소리. 펌핑 없이 숨소리까지 그대로',
  'mic.profile.broadcast': '방송',
  'mic.profile.broadcast.hint':
    '라디오 목소리: 묵직한 저음, 단단하고 밀도 있게',
  'mic.profile.noisy': '시끄러운 방',
  'mic.profile.noisy.hint': '팬, 아이들, 차 소리: 클리너와 게이트를 최대로',
  'mic.profile.meet': '회의',
  'mic.profile.meet.hint':
    'Teams와 Zoom: 또렷한 말소리, 잡음 처리는 회의 앱에 맡깁니다',
  'mic.profile.laptop': '노트북 마이크',
  'mic.profile.laptop.hint':
    '얇고 멀고 울리는 소리: 로우 컷은 높게, 클리너는 강하게',
  'mic.profile.headset': '헤드셋 붐 마이크',
  'mic.profile.headset.hint':
    '입 가까이 있는 작은 캡슐: 따뜻함은 살리고 팝 노이즈는 줄입니다',
  'mic.reset': '{profile} 설정으로 초기화',
  'mic.setup.title': '{mic}에 아직 FluidEQ Engine이 설정되지 않았습니다.',
  'mic.setup.body':
    'Windows에서 한 번만 권한을 요청합니다. 설정하는 동안에도 출력은 계속 재생됩니다.',
  'mic.setup.button': '이 마이크에 설정',
  'mic.setup.working': '설정하는 중…',
  'mic.setup.declined':
    'Windows에서 권한을 받지 못해 아무것도 바뀌지 않았습니다.',
  'mic.setup.failed': '이 마이크에 설정하지 못했습니다.',
  'mic.notFluid.title': '마이크별 사운드는 FluidEQ Engine에서 재생됩니다.',
  'mic.notFluid.body':
    '사운드는 저장되어 있으며, FluidEQ Engine을 선택하면 바로 적용됩니다.',
  'mic.empty.title': '마이크를 찾을 수 없음',
  'mic.empty.body':
    '마이크를 연결하거나, 목록을 불러올 수 있도록 FluidEQ Engine을 업데이트하세요.',
  'mic.stage.lowCut': '로우 컷',
  'mic.stage.cleaner': '음성 클리너',
  'mic.stage.gate': '게이트',
  'mic.stage.deEsser': '디에서',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': '컴프레서',
  'mic.stage.limiter': '리미터',
  'mic.lowCut.title': '로우 컷',
  'mic.lowCut.description':
    '목소리 아래의 웅웅거림, 책상 두드림, 팬 소리를 클리너에 닿기 전에 걸러냅니다.',
  'mic.lowCut.group.below': '목소리 아래',
  'mic.lowCut.group.belowHint':
    '근접 보정은 캡슐에서 몇 센티미터 거리에서 목소리에 더해지는 과한 저음을 줄여 줍니다.',
  'mic.lowCut.cut': '컷 주파수',
  'mic.lowCut.proximity': '근접 보정',
  'mic.lowCut.group.pops': '팝 노이즈',
  'mic.lowCut.group.popsHint':
    'ㅍ, ㅂ 소리의 퍽 하는 울림을 부드럽게 하고, 고른 목소리는 그대로 둡니다.',
  'mic.lowCut.plosive': '팝 가드',
  'mic.gate.title': '게이트',
  'mic.gate.description':
    '말 사이에 마이크를 닫아 방 소리, 팬, 키보드 소리가 들어오지 않게 합니다. 범위를 작게 하면 부드러운 익스팬더가 됩니다.',
  'mic.gate.group.level': '열리는 시점',
  'mic.gate.group.levelHint':
    '그림의 점선을 보세요: 목소리는 선을 넘고, 방 소리는 선 아래에 머물러야 합니다.',
  'mic.gate.threshold': '열림 레벨',
  'mic.gate.range': '닫힘 양',
  'mic.gate.group.time': '속도',
  'mic.gate.group.timeHint':
    '홀드는 음절 사이에도 열린 상태를 유지해 말끝이 잘리지 않게 합니다.',
  'mic.gate.attack': '열림 시간',
  'mic.gate.hold': '홀드',
  'mic.gate.release': '닫힘 시간',
};
