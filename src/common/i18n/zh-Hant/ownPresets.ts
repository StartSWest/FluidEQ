/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The listener's own presets. See `en/ownPresets.ts`. */
export default {
  'eq.own.new': '新增預設組',
  'eq.own.newHint': '屬於你自己的曲線與效果架',
  'eq.own.dialogHint':
    '一條用於主 EQ 的曲線和一個用於 DSP 頁面的效果架，以你的名稱儲存。',
  'eq.own.name': '名稱',
  'eq.own.defaultName': '我的預設組',
  'eq.own.defaultFrom': '我的 {name}',
  'eq.own.curveFrom': '曲線起點',
  'eq.own.curveFromHint': '接著由你調整',
  'eq.own.fromPlaying': '{name}（播放中）',
  'eq.own.flat': '平直',
  'eq.own.rackFrom': '效果架起點',
  'eq.own.rackOf': '{name} 的效果架',
  'eq.own.rackNow': '目前的 DSP 頁面',
  'eq.own.rackEmpty': '空白',
  'eq.own.create': '建立並調整曲線',
  'eq.own.editing': '正在編輯',
  'eq.own.parts': '預設組組成',
  'eq.own.curve': '曲線',
  'eq.own.rack': '效果架',
  'eq.own.unsaved': '尚未儲存',
  'eq.own.discard': '捨棄',
  'eq.own.save': '儲存預設組',
  'eq.own.addBand': '新增頻段',
  'eq.own.curveBands': '「{name}」曲線的頻段',
  'eq.own.edit': '編輯',
  'eq.own.editCopy': '編輯副本',
  'eq.own.copyName': '{name}（副本）',
  'eq.own.more': '「{name}」的更多操作',
  'eq.own.renameLabel': '「{name}」的新名稱',
  'eq.own.about':
    '你自己的預設組。曲線在主 EQ 中播放，效果架在 DSP 頁面中播放。',
  'eq.own.deleteAsk':
    '要刪除「{name}」嗎？它會從「你的」中移除。若正在播放，它的曲線與效果架會停止。',
  'eq.own.keep': '保留',
  'eq.own.emptyTitle': '還沒有你自己的預設組',
  'eq.own.emptyHint':
    '「新增預設組」會建立一個：用於主 EQ 的曲線和用於 DSP 頁面的效果架。',
} as const;
