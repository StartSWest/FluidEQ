/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const songSound = {
  'songSound.switch': '記住每首歌的聲音',
  'songSound.switchHint':
    '每當此處播放歌曲時，歌曲期間設定的預設、音調或等化器都會返回。',
  'songSound.noticeTitle': '這首歌本身的聲音',
  'songSound.noticeBody': '{title} — {preset}，及其音調和等化器',
  'songSound.noticeBodyNoPreset': '{title} — 其音調和 EQ',
  'songSound.undo': '撤銷',
  'songSound.forget': '忘記這首歌',
  'songSound.willSaveTitle': '為這首歌存錢',
  'songSound.willSaveBody': '{preset} 將會儲存為 {title}。',
  'songSound.willSaveBodyNoPreset': '此聲音將會儲存為 {title}。',
  'songSound.dontSave': '不儲存',
} satisfies Partial<Dictionary>;

export default songSound;
