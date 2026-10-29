/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const engineHealth = {
  'engineHealth.offTitle': 'FluidEQ 引擎未在 {device} 上執行',
  'engineHealth.offBody':
    '沒有 EQ 的情況下，聲音就在此輸出上播放。重新啟動 Windows 音訊通常會使引擎恢復，並且 FluidEQ 中的其他所有內容同時繼續工作。',
  'engineHealth.neverRanTitle': 'Windows 從未啟動過 FluidEQ 引擎',
  'engineHealth.neverRanBody':
    '該引擎已安裝在 {device} 上，並且 Windows 尚未將其載入到此處 - 因此重新啟動音訊不會將其恢復。 FluidEQ 已經把它所能達到的一切都做好了；如果這種情況持續存在，則表示您的安全軟體或音效卡驅動程式正在阻止它。 Equalizer APO 同時處理您的聲音。',
  'engineHealth.bypassedTitle': '您的聲音未通過 {device} 上的 FluidEQ',
  'engineHealth.bypassedBody':
    '引擎已安裝並開啟用於此輸出，Windows 正在播放它後面的音樂 - 它根本沒有聲音。一個輸出有多個位置可以放置效果，Windows 會為每個串流選擇不同的位置； FluidEQ 坐在一首音樂永不過時的音樂中。將其轉移到另一個需要一個 Windows 許可和一秒鐘的沉默。',
  'engineHealth.tryAnotherSlot': '嘗試另一個地方',
  'engineHealth.partlyOff': '部分關閉',
  'engineHealth.problemsTitle': '您的部分聲音未達到 {device}',
  'engineHealth.problem.convolution':
    '卷積關閉：引擎無法載入 脈衝響應。嘗試不同的檔案。',
  'engineHealth.problem.eq-phase':
    '線性相位EQ無法啟動；原始過濾器保持活動狀態。',
  'engineHealth.problem.graphic-eq': '圖形等化器已關閉：引擎無法建立其曲線。',
  'engineHealth.problem.dsp-rack': 'DSP 效果關閉：引擎無法啟動它們。',
  'engineHealth.problem.reload-failed':
    '您的最新更改未載入，因此先前的更改仍在播放。',
  'engineHealth.problem.unwatched': '引擎無法看到您對此輸出所做的變更。',
  'engineHealth.problem.other': '引擎被要求運轉的其他東西沒有運轉。',
  'engineHealth.engineIsOld':
    '此 PC 上安裝的 FluidEQ 引擎並非此版本的 FluidEQ 所攜帶的引擎。',
  'engineHealth.rackNeedsEngine':
    'DSP 效果在引擎本身內部執行，因此重新啟動 Windows 音訊會再次啟動相同的效果。將 FluidEQ 自己的引擎安裝到位可以解決這個問題 - 一個 Windows 許可和一秒鐘的沉默。',
  'engineHealth.useApo': '使用 Equalizer APO...',
  'engineHealth.macPermissionTitle': 'FluidEQ 無法接收 Mac 的聲音',
  'engineHealth.macPermissionBody':
    'macOS 尚未允許 FluidEQ 錄製 Mac 播放的聲音，因此 EQ 無法作用於它。在此期間，聲音照常播放。請在「隱私權與安全性」›「螢幕與系統錄音」中開啟 FluidEQ。',
  'engineHealth.openMacPrivacy': '開啟系統設定',
} satisfies Partial<Dictionary>;

export default engineHealth;
