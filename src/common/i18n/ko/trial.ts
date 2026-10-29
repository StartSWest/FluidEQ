/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const trial = {
  'trial.free.title': 'FluidEQ는 무료입니다. 장면은 영원히 당신의 것입니다.',
  'trial.free.body':
    '이퀄라이저, 음악 재생, 무료 프리셋 및 무료 시각화 기능은 무료로 유지됩니다. Visualizers의 장면은 1크레딧이 필요하며 사용자의 것으로 유지되며, 확인된 계정은 시작 시 {starterCredits} 크레딧을 받습니다.',
  'trial.extras.title': '무료 계정',
  'trial.extras.scenes': '어떤 장면이든 보고, 얻은 장면을 유지하세요.',
  'trial.extras.studio': 'Studio에서 자신만의 장면을 만들고 게시하세요.',
  'trial.extras.desktop': '데스크탑의 장면과 RGB 조명',
  'trial.browse':
    '무료 계정을 사용하면 갤러리를 탐색하고 포럼에 참여할 수 있습니다.',
} satisfies Partial<Dictionary>;

export default trial;
