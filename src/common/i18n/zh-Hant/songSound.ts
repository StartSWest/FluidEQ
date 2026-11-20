/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

/** Auto EQ’s song and album sounds — the notices. The switch’s two words stay
 * for the 2.1 tour, which shows the Output panel as it was then. */
const songSound = {
  'songSound.switch': '記住每首歌的聲音',
  'songSound.forget': '忘記這首歌',
  'songSound.noticeTitle': '這首歌儲存的聲音',
  'songSound.noticeBody': '{title} · {preset}',
  'songSound.albumNoticeTitle': '專輯聲音：{album}',
  'songSound.albumNoticeBody': '{title} 使用專輯的 {preset}',
  'songSound.noPresetName': '您的預設',
  'songSound.undo': '撤銷',
} satisfies Partial<Dictionary>;

export default songSound;
