/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const profile = {
  'profile.name.title': '갤러리에 표시되는 방식을 선택하세요.',
  'profile.name.body':
    '핸들과 이름. Visualizers 갤러리는 장면에 이를 표시합니다. 로그인한 모든 사람이 볼 수 있습니다. 아무도 당신의 이메일을 볼 수 없습니다.',
  'profile.name.handle': '손잡이',
  'profile.name.handleHint': '영문, 숫자, _ 3~20자',
  'profile.name.name': '표시 이름',
  'profile.name.previewName': '당신의 이름',
  'profile.name.save': '저장',
  'profile.name.choose': '당신의 이름을 선택하세요',
  'profile.name.error.handleTaken':
    '그 손잡이가 잡혔습니다. 다른 것을 시도해 보세요.',
  'profile.name.error.reserved':
    '해당 이름은 FluidEQ용으로 예약되어 있습니다. 다른 것을 선택하세요.',
  'profile.name.error.unreadable':
    '그 이름에는 볼 수 없는 문자가 있습니다. 다시 입력하세요.',
  'profile.name.error.signedOut': '로그아웃되었습니다. 다시 로그인하세요.',
  'profile.name.error.network':
    '서버에 연결할 수 없습니다. 연결을 확인하고 다시 시도하세요.',
  'profile.name.error.rejected':
    '서버가 그 이름을 거부했습니다. 다른 것을 시도해 보세요.',
} satisfies Partial<Dictionary>;

export default profile;
