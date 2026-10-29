/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const troubleshoot = {
  'troubleshoot.title': '오디오 문제 해결',
  'troubleshoot.description':
    '목록을 작성하고 도움이 되는 첫 번째 항목에서 중지하세요. 각각은 마지막 것보다 더 파괴적이며 첫 번째가 대부분의 문제를 해결합니다.',
  'troubleshoot.footer':
    '그 후에도 여전히 틀린가요? 동일한 메뉴에서 **{report}**를 사용하세요. 로그를 수집하고 사용자를 식별하는 모든 항목을 제거하여 다른 곳으로 이동하기 전에 전체 내용을 보여줍니다.',
  'troubleshoot.tried': '시도했다',
  'troubleshoot.restart.title': 'Windows 오디오 다시 시작',
  'troubleshoot.restart.when':
    '소리가 멈추거나 재생 중에 그래프가 멈췄습니다. 이것은 거의 모든 경우에 대한 수정 사항이자 가장 먼저 시도해 볼 수 있는 방법입니다.',
  'troubleshoot.restart.cost':
    '몇 초 동안의 침묵. Windows에서 권한을 요청합니다.',
  'troubleshoot.apo.reselect.title':
    'Equalizer APO에서 장치를 다시 선택하세요.',
  'troubleshoot.apo.reselect.when':
    '한 장치는 이퀄라이징되고 다른 장치는 이퀄라이징되지 않거나 방금 연결한 헤드셋이 무시됩니다. Equalizer APO는 각 출력에 별도로 연결되며, 선택하기 전까지 새 장치는 연결되지 않습니다.',
  'troubleshoot.apo.reselect.cost':
    'Equalizer APO의 장치 선택기를 엽니다. 나중에 다시 시작합니다.',
  'troubleshoot.apo.openSelector': '장치 선택기 열기',
  'troubleshoot.apo.mode.title': '다른 설치 모드를 사용해 보세요',
  'troubleshoot.apo.mode.when':
    '장치 선택기에서 장치를 선택했지만 여전히 효과가 없거나, 선택하면 해당 장치의 재생이 완전히 중지됩니다. Equalizer APO는 두 가지 방법으로 Windows 오디오에 연결할 수 있으며 일부 하드웨어는 그 중 하나만 작동합니다.',
  'troubleshoot.apo.mode.cost':
    '다시 시작합니다. 되돌릴 수 있음 - 같은 방식으로 다시 전환합니다.',
  'troubleshoot.apo.mode.detail':
    '장치 선택기에서 **문제 해결 옵션**을 엽니다. 기본값은 대부분의 컴퓨터에서 작동하는 **APO**로 설치하는 것입니다. **SFX/EFX로 설치**는 대안이며 드라이버가 자체 효과(많은 노트북 및 게임 오디오)를 가져오는 장치에 도달할 수 있는 것입니다. 장치를 선택한 후 작동이 중지된 경우 이퀄라이징할 수 없다고 결론을 내리기 전에 다른 모드를 시도해 보십시오.',
  'troubleshoot.apo.reinstall.title': 'Equalizer APO 재설치',
  'troubleshoot.apo.reinstall.when':
    '처음 두 개는 아무것도 변경되지 않았거나 Windows가 업데이트되었지만 그 이후로 이퀄라이저가 작동하지 않았습니다. 설치 프로그램은 수리 도구이기도 합니다. 오디오 구성 요소를 다시 등록하고 장치 목록을 다시 엽니다.',
  'troubleshoot.apo.reinstall.cost':
    '관리자 권한이 필요하며 나중에 컴퓨터를 다시 시작해야 합니다. FluidEQ 프로필과 프리셋은 건드리지 않습니다.',
  'troubleshoot.apo.readd.title':
    '장치를 제거하고 다시 시작한 후 다시 추가하세요.',
  'troubleshoot.apo.readd.when':
    '재설치 후에도 특정 장치에 문제가 있는 경우에만 해당됩니다. 장치 선택기에서 선택을 취소하고 컴퓨터를 다시 시작한 다음 다시 선택하고 다시 한 번 다시 시작하십시오.',
  'troubleshoot.apo.readd.cost': '두 번 다시 시작합니다.',
  'troubleshoot.apo.readd.detail':
    '두 번의 재시작은 미신이 아닙니다. Equalizer APO는 시스템이 시작될 때 오디오 엔드포인트에 자체적으로 연결되므로 Windows가 실행되는 동안 분리된 장치는 연결이 해제될 때까지 절반 연결 상태를 유지하며, 그런 일이 발생하기 전에 다시 추가하면 손상된 상태가 바로 복구됩니다.',
  'troubleshoot.engine.enable.title': 'FluidEQ 엔진을 출력에 다시 넣습니다.',
  'troubleshoot.engine.enable.when':
    '한 장치는 이퀄라이징되고 다른 장치는 이퀄라이징되지 않거나 방금 연결한 헤드셋이 무시됩니다. 엔진은 각 출력에 개별적으로 연결되며 Windows 업데이트를 통해 이미 있던 출력에서 엔진을 분리할 수 있습니다.',
  'troubleshoot.engine.permission':
    'Windows에서 권한을 요청하고 오디오가 잠시 동안 다시 시작됩니다. 재부팅하지 마십시오.',
  'troubleshoot.engine.remove.title': '이 출력에서 FluidEQ 엔진을 제거합니다.',
  'troubleshoot.engine.remove.when':
    '이 출력 하나는 위의 수정 사항 중 어느 것도 해결되지 않는 방식으로 잘못되었거나 다른 오디오 프로그램으로 다시 전달하려고 합니다. 엔진은 Windows가 지금 재생 중인 출력에서 벗어나고 교체된 모든 내용이 다시 시작됩니다.',
  'troubleshoot.engine.remove.cost':
    'Windows에서 권한을 요청하고 오디오가 잠시 동안 다시 시작됩니다. 다른 출력은 그대로 유지되며 위 단계를 통해 다시 되돌려집니다.',
  'troubleshoot.engine.remove.action': '이 출력에서 제거',
} satisfies Partial<Dictionary>;

export default troubleshoot;
