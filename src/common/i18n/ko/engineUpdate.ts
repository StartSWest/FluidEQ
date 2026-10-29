/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const engineUpdate = {
  'engineUpdate.title': '새로운 FluidEQ 엔진이 준비되었습니다',
  'engineUpdate.body':
    'FluidEQ의 이 버전은 업데이트된 오디오 엔진과 함께 제공됩니다. 설치하면 Windows에 권한을 요청하고 몇 초 동안 오디오를 다시 시작합니다.',
  'engineUpdate.action': '엔진 업데이트',
  'engineUpdate.running': '엔진 업데이트 중…',
  'engineUpdate.doneTitle': 'FluidEQ 엔진이 최신 상태입니다.',
  'engineUpdate.doneBody':
    '출력과 EQ를 그대로 유지하면서 Windows 오디오가 새 엔진에서 다시 시작되었습니다. 여전히 침묵하는 앱을 다시 엽니다.',
  'engineUpdate.declined':
    'Windows 권한이 거부되었으므로 귀하가 보유한 엔진은 여전히 EQ를 재생하는 엔진입니다.',
  'engineUpdate.failed':
    '엔진을 업데이트할 수 없어서 귀하가 가지고 있던 엔진이 여전히 EQ를 재생하고 있습니다.',
} satisfies Partial<Dictionary>;

export default engineUpdate;
