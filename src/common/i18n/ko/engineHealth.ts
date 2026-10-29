/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const engineHealth = {
  'engineHealth.offTitle':
    'FluidEQ 엔진이 {device}에서 실행되고 있지 않습니다.',
  'engineHealth.offBody':
    'EQ 없이 이 출력에서 사운드가 재생됩니다. Windows 오디오를 다시 시작하면 일반적으로 엔진이 다시 작동하며 그동안 FluidEQ의 다른 모든 항목은 계속 작동합니다.',
  'engineHealth.neverRanTitle':
    'Windows가 FluidEQ 엔진을 시작한 적이 없습니다.',
  'engineHealth.neverRanBody':
    '엔진이 {device}에 설치되어 있고 Windows에서 엔진을 한 번도 로드한 적이 없으므로 오디오를 다시 시작해도 엔진이 다시 작동하지 않습니다. FluidEQ는 이미 도달할 수 있는 모든 것을 바로잡았습니다. 이것이 지속되면 보안 소프트웨어나 사운드 카드 드라이버가 이를 중지하고 있는 것입니다. 그 동안 Equalizer APO는 사운드를 처리합니다.',
  'engineHealth.bypassedTitle':
    '사운드가 {device}의 FluidEQ를 통과하지 않습니다.',
  'engineHealth.bypassedBody':
    '이 출력을 위해 엔진이 설치되고 켜져 있으며 Windows는 그 너머로 음악을 재생하고 있습니다. 전혀 소리가 나지 않습니다. 출력에는 효과가 배치될 수 있는 여러 위치가 있으며 Windows는 각 스트림 종류에 대해 서로 다른 위치를 선택합니다. FluidEQ는 결코 지나치지 않는 이 음악에 앉아 있습니다. 다른 항목으로 이동하려면 Windows 권한 1회와 침묵 1초가 필요합니다.',
  'engineHealth.tryAnotherSlot': '다른 곳을 찾아보세요',
  'engineHealth.partlyOff': '부분적으로 꺼짐',
  'engineHealth.problemsTitle': '사운드의 일부가 {device}에 도달하지 않습니다.',
  'engineHealth.problem.convolution':
    '컨볼루션이 꺼졌습니다. 엔진이 임펄스 응답을 로드할 수 없습니다. 다른 파일을 사용해 보세요.',
  'engineHealth.problem.eq-phase':
    '선형 위상 EQ를 시작할 수 없습니다. 원래 필터는 활성 상태로 유지됩니다.',
  'engineHealth.problem.graphic-eq':
    '그래픽 EQ가 꺼져 있습니다. 엔진이 곡선을 만들 수 없습니다.',
  'engineHealth.problem.dsp-rack':
    'DSP 효과가 꺼져 있습니다. 엔진에서 시작할 수 없습니다.',
  'engineHealth.problem.reload-failed':
    '최근 변경사항이 로드되지 않아 이전 변경사항이 아직 재생 중입니다.',
  'engineHealth.problem.unwatched':
    '엔진은 이 출력에 대한 변경 사항을 볼 수 없습니다.',
  'engineHealth.problem.other':
    '엔진이 실행되도록 요청받은 다른 항목이 실행되지 않습니다.',
  'engineHealth.engineIsOld':
    '이 PC에 설치된 FluidEQ 엔진은 이 버전의 FluidEQ에서 제공하는 엔진이 아닙니다.',
  'engineHealth.rackNeedsEngine':
    'DSP 효과는 엔진 자체 내에서 실행되므로 Windows 오디오를 다시 시작하면 동일한 효과가 다시 시작됩니다. FluidEQ의 자체 엔진을 배치하면 이 문제가 해결됩니다. 하나의 Windows 권한과 두 번째 침묵입니다.',
  'engineHealth.useApo': 'Equalizer APO를 사용하세요…',
  'engineHealth.macPermissionTitle':
    'FluidEQ가 Mac의 사운드를 들을 수 없습니다',
  'engineHealth.macPermissionBody':
    'macOS가 Mac에서 재생되는 사운드를 FluidEQ가 녹음하도록 허용하지 않아 EQ가 적용되지 않습니다. 그동안 사운드는 평소대로 재생됩니다. 개인정보 보호 및 보안 › 화면 및 시스템 오디오 녹음에서 FluidEQ를 켜세요.',
  'engineHealth.openMacPrivacy': '시스템 설정 열기',
} satisfies Partial<Dictionary>;

export default engineHealth;
