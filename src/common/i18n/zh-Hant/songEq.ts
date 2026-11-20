/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const songEq = {
  'songEq.saveAria': '記住正在播放內容的智慧校正',
  'songEq.noticeTitle': '使用這首歌曲儲存的 EQ',
  'songEq.noticeBody': '{title} — 透過 {plays} 演奏學習',
  'songEq.noticeBodyOnce': '{title} — 學過一次',
  'songEq.undo': '撤銷',
  'songEq.forget': '忘記這首歌',
  'songEq.badgeAria': '智慧校正正在學習這首歌',
} satisfies Partial<Dictionary>;

export default songEq;
