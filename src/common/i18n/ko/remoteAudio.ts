/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const remoteAudio = {
  'remoteAudio.group.add': '컴퓨터 추가',
  'remoteAudio.group.title': '전체 그룹',
  'remoteAudio.group.mix': '내 믹스',
  'remoteAudio.group.thisPC': '이 PC',
  'remoteAudio.group.receive': '수신',
  'remoteAudio.group.send': '보내기',
  'remoteAudio.group.share': '공유',
  'remoteAudio.group.options': '{name} 옵션',
  'remoteAudio.group.count.one': '{count} 컴퓨터',
  'remoteAudio.group.count.few': '{count} 컴퓨터',
  'remoteAudio.group.count.many': '{count} 컴퓨터',
  'remoteAudio.group.count.other': '{count} 컴퓨터',
  'remoteAudio.group.sourceOff': '공유가 꺼졌습니다',
  'remoteAudio.group.offline': '오프라인',
  'remoteAudio.group.unavailable': '시스템 볼륨을 사용할 수 없습니다.',
  'remoteAudio.group.mute': '이 PC 음소거',
  'remoteAudio.group.unmute': '이 PC 음소거 해제',
  'remoteAudio.group.output': '출력',
  'remoteAudio.group.hint':
    '컴퓨터를 연결하여 그룹에 가입하세요. 각 컴퓨터는 자신의 사운드를 다른 컴퓨터에 직접 보냅니다. 믹스에서 듣는 내용을 조정하세요.',
  'tabs.share': '오디오 공유',
  'remoteAudio.eyebrow': 'LAN 오디오',
  'remoteAudio.title': '컴퓨터 간에 오디오 공유',
  'remoteAudio.security': '연결 속성',
  'remoteAudio.badge.local': '사설 LAN만 해당',
  'remoteAudio.badge.lossless': '무손실 Float32 PCM 전송',
  'remoteAudio.badge.encrypted': 'AES-256-GCM 암호화됨',
  'remoteAudio.link.thisComputer': '이 컴퓨터',
  'remoteAudio.link.thisHint':
    '이 코드를 다른 컴퓨터에 붙여넣거나 해당 컴퓨터의 코드를 여기에 붙여넣으세요. 어느 쪽이든 작동합니다.',
  'remoteAudio.link.or': '또는',
  'remoteAudio.link.otherComputer': '다른 컴퓨터의 코드',
  'remoteAudio.link.codeLabel': '연결 코드',
  'remoteAudio.link.placeholder': 'FLUIDEQ-LAN-2를 붙여넣으세요…',
  'remoteAudio.link.start': '연결',
  'remoteAudio.link.otherHint':
    '두 컴퓨터 모두 즉시 서로 플레이합니다. 하나만 원할 경우 나중에 어느 방향이든 끄십시오.',
  'remoteAudio.link.once':
    '한 번 해보세요. 연결된 컴퓨터는 다시 시작한 후 양쪽에서 서로를 다시 찾습니다.',
  'remoteAudio.link.many':
    '동일한 코드는 여러 대의 컴퓨터를 연결하며, 하나의 연결을 해제하면 나머지는 연결된 상태로 유지됩니다.',
  'remoteAudio.rule.echoTitle': '양방향, 에코 없음',
  'remoteAudio.rule.echo':
    '각 컴퓨터는 자신이 재생하는 것만 전송하며 수신되는 사운드는 전송하지 않으므로 아무 것도 다시 돌아오지 않습니다.',
  'remoteAudio.rule.eqTitle': '당신이 듣는 곳의 EQ',
  'remoteAudio.rule.eq':
    '소리는 그대로 유지됩니다. 여러분이 듣는 컴퓨터는 EQ, 헤드폰 곡선 및 DSP를 한 번만 적용합니다.',
  'remoteAudio.rule.steadyTitle': '시간이 지나도 흐트러지지 않는 재생',
  'remoteAudio.rule.steady':
    '약 30ms 뒤에 유지됩니다. 두 시계가 같은 간격으로 유지되므로 드롭아웃이나 느린 드리프트가 없습니다.',
  'remoteAudio.linked.cardLabel': '{name}와 연결',
  'remoteAudio.linked.bothWays': '양방향',
  'remoteAudio.linked.incomingOnly': '수신만',
  'remoteAudio.linked.outgoingOnly': '발신 전용',
  'remoteAudio.linked.paused': '일시중지됨',
  'remoteAudio.linked.lossless': '무손실',
  'remoteAudio.linked.unlink': '연결 해제',
  'remoteAudio.linked.pause': '일시 정지',
  'remoteAudio.linked.resume': '계속',
  'remoteAudio.lane.inPaused':
    '일시중지되었습니다. 재개할 때까지 여기서는 아무것도 재생되지 않습니다.',
  'remoteAudio.lane.outPaused':
    '일시중지되었습니다. 재개할 때까지 아무 것도 전송되지 않습니다.',
  'remoteAudio.lane.volume': '{name}의 사운드 볼륨',
  'remoteAudio.lane.pausedThere': '{name}가 링크를 일시 중지했습니다.',
  'remoteAudio.linked.noEcho':
    '에코 없음: {name}의 사운드가 다시 전송되지 않습니다.',
  'remoteAudio.linked.untouched':
    '양방향으로 그대로 유지됩니다. 각 컴퓨터는 자체 EQ와 DSP를 적용합니다.',
  'remoteAudio.lane.from': '{name}에서',
  'remoteAudio.lane.to': '{name}로',
  'remoteAudio.lane.playsHere': '여기서 재생',
  'remoteAudio.lane.yourSound': '당신의 소리',
  'remoteAudio.lane.playItHere': '여기서 재생',
  'remoteAudio.lane.sendMySound': '내 소리 보내기',
  'remoteAudio.lane.delay': '지연',
  'remoteAudio.lane.sent': '보냈습니다',
  'remoteAudio.lane.received': '받은',
  'remoteAudio.lane.milliseconds': '{milliseconds}ms',
  'remoteAudio.lane.megabits': '{megabits} Mb/s',
  'remoteAudio.lane.receiving': '수신',
  'remoteAudio.lane.paused': '일시중지됨',
  'remoteAudio.lane.inQuiet': '{name}에서 재생 중인 항목이 없습니다.',
  'remoteAudio.lane.inOff':
    '꺼짐: {name}의 사운드가 이 컴퓨터에서 재생되지 않습니다.',
  'remoteAudio.lane.inNotSent': '{name}에는 "내 소리 보내기"가 꺼져 있습니다.',
  'remoteAudio.lane.inOld':
    '{name}에서 사운드를 여기로 전송하려면 최신 FluidEQ가 필요합니다.',
  'remoteAudio.lane.inOneWay':
    '두 가지 방식으로 플레이하려면 Windows 또는 Linux의 FluidEQ 엔진이 필요합니다.',
  'remoteAudio.lane.outQuiet': '이 컴퓨터에서 재생 중인 항목이 없습니다.',
  'remoteAudio.lane.outSounding': '이 컴퓨터에서 재생되는 소리',
  'remoteAudio.lane.outOff':
    '보내지 않습니다. {name}가 이 컴퓨터의 소리를 듣지 못합니다.',
  'remoteAudio.lane.outNotPlayed': "{name}의 '여기서 재생'이 꺼져 있습니다.",
  'remoteAudio.lane.outOld':
    '{name}에서 이 컴퓨터의 사운드를 재생하려면 최신 FluidEQ가 필요합니다.',
  'remoteAudio.lane.outOneWay':
    '양방향으로 보내려면 Windows 또는 Linux의 FluidEQ 엔진이 필요합니다.',
  'remoteAudio.lane.outFailed':
    "이 컴퓨터의 소리를 캡처할 수 없습니다. '내 소리 보내기'를 껐다가 다시 켜서 다시 시도해 보세요.",
  'remoteAudio.singlePlayer.title': '한 번에 한 플레이어만 재생',
  'remoteAudio.singlePlayer.body':
    '연결된 컴퓨터에도 적용됩니다. 한쪽에서 무언가를 시작하면 다른 쪽에서 재생 중이던 것이 일시 중지됩니다.',
  'remoteAudio.code.copy': '코드 복사',
  'remoteAudio.code.copied': '복사됨',
  'remoteAudio.code.label': '이 컴퓨터의 코드',
  'remoteAudio.status.preparing': '준비 중…',
  'remoteAudio.status.noNetwork':
    '코드를 얻으려면 이 컴퓨터를 네트워크에 연결하세요.',
  'remoteAudio.status.playbackBlocked': '오디오를 들으려면 재개를 누르세요.',
  'remoteAudio.resume': '오디오 재개',
  'remoteAudio.retry': '다시 시도',
  'remoteAudio.monitor.networkHealthy': '네트워크 클리어',
  'remoteAudio.monitor.networkQueued': '{milliseconds}ms 대기 중',
  'remoteAudio.note.title': '조용히 시작하세요.',
  'remoteAudio.note.body':
    '동시에 재생되는 두 대의 컴퓨터가 추가됩니다. 첫 번째 링크 전에 볼륨을 낮추세요.',
  'remoteAudio.error.lan':
    'FluidEQ가 해당 로컬 연결을 열 수 없습니다. 두 컴퓨터가 동일한 개인 네트워크에 있고 FluidEQ가 방화벽을 통해 허용되는지 확인하십시오.',
  'remoteAudio.error.code':
    'FluidEQ 코드가 아니거나 이 컴퓨터의 코드입니다. 다른 컴퓨터의 오디오 공유 페이지에서 코드를 복사합니다.',
  'remoteAudio.error.capture':
    'FluidEQ가 이 컴퓨터의 시스템 오디오를 캡처할 수 없습니다. 현재 출력 장치를 확인한 후 다시 시도해 보세요.',
  'remoteAudio.error.playback':
    'FluidEQ가 무손실 오디오 엔진을 시작할 수 없습니다. FluidEQ를 다시 시작하고 다시 시도하십시오.',
  'remoteAudio.error.connection':
    '암호화된 오디오 연결이 중지되었습니다. FluidEQ는 계속해서 다른 컴퓨터를 찾고 있습니다. 해당 컴퓨터가 돌아오면 자동으로 다시 연결됩니다.',
} satisfies Partial<Dictionary>;

export default remoteAudio;
