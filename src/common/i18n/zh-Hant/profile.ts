/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const profile = {
  'profile.name.title': '選擇相簿向您展示的方式',
  'profile.name.body':
    '一個控制程式碼和一個名稱。 Visualizers 畫廊將它們歸功於您的場景。每個登入的人都可以看到它們；沒有人看到你的電子郵件。',
  'profile.name.handle': '手把',
  'profile.name.handleHint': '3 至 20 個字母、數字或 _',
  'profile.name.name': '顯示名稱',
  'profile.name.previewName': '你的名字',
  'profile.name.save': '儲存',
  'profile.name.choose': '選擇你的名字',
  'profile.name.error.handleTaken': '該控制程式碼已被佔用。嘗試另一個。',
  'profile.name.error.reserved': '該名稱是為 FluidEQ 保留的。選擇另一個。',
  'profile.name.error.unreadable': '這個名字裡有看不見的字元。再次鍵入。',
  'profile.name.error.signedOut': '您已退出。再次登入。',
  'profile.name.error.network': '無法到達伺服器。檢查您的連線並重試。',
  'profile.name.error.rejected': '伺服器拒絕使用該名稱。嘗試另一種。',
} satisfies Partial<Dictionary>;

export default profile;
