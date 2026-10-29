/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const engineUpdate = {
  'engineUpdate.title': '新的 FluidEQ 引擎已準備就緒',
  'engineUpdate.body':
    '此版本的 FluidEQ 配備了更新的音訊引擎。安裝它會請求 Windows 許可並重新啟動音訊幾秒鐘。',
  'engineUpdate.action': '更新引擎',
  'engineUpdate.running': '正在更新引擎...',
  'engineUpdate.doneTitle': 'FluidEQ 引擎是最新的',
  'engineUpdate.doneBody':
    'Windows 音訊重新啟動到新引擎，輸出和平衡器保持原樣。重新開啟任何仍處於靜默狀態的應用程式。',
  'engineUpdate.declined':
    'Windows 許可權被拒絕，因此您擁有的引擎仍然是播放 EQ 的引擎。',
  'engineUpdate.failed': '引擎無法更新，所以你的引擎仍在播放你的 EQ。',
} satisfies Partial<Dictionary>;

export default engineUpdate;
