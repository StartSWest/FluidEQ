/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const troubleshoot = {
  'troubleshoot.title': '修復音訊問題',
  'troubleshoot.description':
    '順著清單往下看，停在第一個有幫助的地方。每一個都比前一個更具破壞性，第一個解決了大多數問題。',
  'troubleshoot.footer':
    '說了這麼多之後還是錯了嗎？在同一選單中使用 **{report}** — 它會收集日誌，並刪除任何可以識別您身份的資訊，並在日誌到達任何地方之前向您顯示整個資訊。',
  'troubleshoot.tried': '嘗試過',
  'troubleshoot.restart.title': '重新啟動 Windows 音訊',
  'troubleshoot.restart.when':
    '播放某些內容時聲音已停止，或圖表變得平坦。這是幾乎所有情況下的修復方法，也是首先嘗試的方法。',
  'troubleshoot.restart.cost': '幾秒鐘的沉默。 Windows 請求許可。',
  'troubleshoot.apo.reselect.title': '在 Equalizer APO 中重新選擇您的裝置',
  'troubleshoot.apo.reselect.when':
    '一臺裝置已均衡，而另一臺裝置未均衡，或您剛插入的耳機被忽略。 Equalizer APO 單獨連線到每個輸出，並且在您勾選它之前不會連線新裝置。',
  'troubleshoot.apo.reselect.cost':
    '開啟 Equalizer APO 的裝置選擇器。之後重新啟動。',
  'troubleshoot.apo.openSelector': '開啟裝置選擇器',
  'troubleshoot.apo.mode.title': '嘗試其他安裝方式',
  'troubleshoot.apo.mode.when':
    '在裝置選擇器中勾選了某個裝置，但仍然沒有任何效果，或勾選它會使該裝置完全停止播放。 Equalizer APO 可以透過兩種不同的方式將自身附加到 Windows 音訊，並且某些硬體僅適用於其中一種。',
  'troubleshoot.apo.mode.cost': '重新啟動。可逆 — 以同樣的方式切換回來。',
  'troubleshoot.apo.mode.detail':
    '在裝置選擇器中，開啟 **故障排除選項**。預設安裝為 **APO**，這是適用於大多數電腦的安裝方式。 **安裝為 SFX/EFX** 是另一種選擇，它是在驅動程式自帶效果的裝置上實現的目標 - 許多筆記型電腦和遊戲音訊。如果裝置在您勾選後停止運作，請嘗試其他模式，然後再得出無法均衡的結論。',
  'troubleshoot.apo.reinstall.title': '重新安裝 Equalizer APO',
  'troubleshoot.apo.reinstall.when':
    '前兩者沒有任何改變，或者 Windows 更新後等化器就不再運作了。它的安裝程式也是它的修復工具：它重新註冊音訊元件並重新開啟裝置清單。',
  'troubleshoot.apo.reinstall.cost':
    '管理員許可權，之後需要重新啟動電腦。您的 FluidEQ 設定檔和預設不會受到影響。',
  'troubleshoot.apo.readd.title': '刪除裝置，重新啟動，再增加回來',
  'troubleshoot.apo.readd.when':
    '僅當特定裝置在重新安裝後仍然錯誤時。在裝置選擇器中取消勾選它，重新啟動電腦，然後再次勾選它並再次重新啟動。',
  'troubleshoot.apo.readd.cost': '兩次重啟。',
  'troubleshoot.apo.readd.detail':
    '兩次重啟並不是迷信。 Equalizer APO 在電腦啟動時將自身連線到音訊端點，因此在 Windows 執行時分離的裝置將保持半連線狀態，直到它不再連線為止 - 並且在發生這種情況之前將其添加回來會直接恢復損壞狀態。',
  'troubleshoot.engine.enable.title': '將 FluidEQ 引擎放回您的輸出上',
  'troubleshoot.engine.enable.when':
    '一臺裝置已均衡，而另一臺裝置未均衡，或您剛插入的耳機被忽略。引擎單獨連線到每個輸出，Windows 更新可以將其與現有的輸出分離。',
  'troubleshoot.engine.permission':
    'Windows 請求許可，音訊會重新啟動一會兒。無需重新啟動。',
  'troubleshoot.engine.remove.title': '從此輸出中刪除 FluidEQ 引擎',
  'troubleshoot.engine.remove.when':
    '這個輸出在某種程度上是錯誤的，以上都無法修復，或者您想將其交還給另一個音訊程式。引擎會關閉 Windows 目前正在播放的輸出，並且它所替換的任何內容都會重新啟動。',
  'troubleshoot.engine.remove.cost':
    'Windows 請求許可，音訊會重新啟動一會兒。您的其他輸出保持不變，並且上述步驟將其恢復。',
  'troubleshoot.engine.remove.action': '從此輸出中刪除',
} satisfies Partial<Dictionary>;

export default troubleshoot;
