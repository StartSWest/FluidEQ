/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const announce = {
  'announce.news.title': '應用程式動態',
  'announce.news.description': 'FluidEQ 的公告，隨時可以在這裡檢視。',
  'announce.news.read': '閱讀動態',
  'announce.news.offline': '目前離線。正在顯示仍有效的已儲存動態。',
  'announce.news.empty': '目前沒有有效公告。',

  'announce.eyebrow': '視覺化效果新內容 · {count} 個場景',
  'announce.try': '立即嘗試',
  'announce.later': '稍後',
  'announce.previewNote': '預覽。沒有傳送任何內容，也沒有記錄任何內容。',
} satisfies Partial<Dictionary>;

export default announce;
