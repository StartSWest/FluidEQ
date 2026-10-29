/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const songSound = {
  'songSound.switch': '각 노래의 사운드 기억',
  'songSound.switchHint':
    '노래 중에 설정된 프리셋, 톤 또는 EQ는 해당 노래가 여기에서 재생될 때마다 다시 나타납니다.',
  'songSound.noticeTitle': '이 노래만의 사운드',
  'songSound.noticeBody': '{title} — {preset}, 톤 및 EQ 포함',
  'songSound.noticeBodyNoPreset': '{title} - 톤과 EQ',
  'songSound.undo': '실행 취소',
  'songSound.forget': '이 노래는 잊어버려',
  'songSound.willSaveTitle': '이 노래를 저장 중입니다.',
  'songSound.willSaveBody': '{preset}는 {title}용으로 저장됩니다.',
  'songSound.willSaveBodyNoPreset': '이 사운드는 {title}에 저장됩니다.',
  'songSound.dontSave': '저장하지 않음',
} satisfies Partial<Dictionary>;

export default songSound;
