/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const songEq = {
  'songEq.save': '儲存為這首歌',
  'songEq.saveAria': '記住正在播放的內容的 Smart EQ 校正',
  'songEq.waiting': '沒什麼玩的',
  'songEq.listening': '{remaining} 去',
  'songEq.willSave': '將儲存 — {title}',
  'songEq.noticeTitle': '使用這首歌曲儲存的 EQ',
  'songEq.noticeBody': '{title} — 透過 {plays} 演奏學習',
  'songEq.noticeBodyOnce': '{title} — 學過一次',
  'songEq.undo': '撤銷',
  'songEq.forget': '忘記這首歌',
  'songEq.badgeAria': 'Smart EQ 正在學習這首歌',
} satisfies Partial<Dictionary>;

export default songEq;
