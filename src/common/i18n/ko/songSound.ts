/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

/** Auto EQ’s song and album sounds — the notices. The switch’s two words stay
 * for the 2.1 tour, which shows the Output panel as it was then. */
const songSound = {
  'songSound.switch': '각 노래의 사운드 기억',
  'songSound.forget': '이 노래는 잊어버려',
  'songSound.noticeTitle': '이 노래의 저장된 사운드',
  'songSound.noticeBody': '{title} · {preset}',
  'songSound.albumNoticeTitle': '앨범 사운드: {album}',
  'songSound.albumNoticeBody': '{title}에 앨범의 {preset} 사운드가 적용됩니다',
  'songSound.noPresetName': '내 프리셋',
  'songSound.undo': '실행 취소',
} satisfies Partial<Dictionary>;

export default songSound;
