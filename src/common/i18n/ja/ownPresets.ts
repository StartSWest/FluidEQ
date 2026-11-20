/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The listener's own presets. See `en/ownPresets.ts`. */
export default {
  'eq.own.new': '新しいプリセット',
  'eq.own.newHint': '自分だけのカーブとラック',
  'eq.own.dialogHint':
    'メイン EQ のカーブと DSP ページのラックを、自分の名前で保存します。',
  'eq.own.name': '名前',
  'eq.own.defaultName': 'マイ プリセット',
  'eq.own.defaultFrom': 'マイ {name}',
  'eq.own.curveFrom': 'カーブの出発点',
  'eq.own.curveFromHint': 'このあと形を整えます',
  'eq.own.fromPlaying': '{name}（再生中）',
  'eq.own.flat': 'フラット',
  'eq.own.rackFrom': 'ラックの出発点',
  'eq.own.rackOf': '{name} のラック',
  'eq.own.rackNow': '現在の DSP ページ',
  'eq.own.rackEmpty': '空',
  'eq.own.create': '作成してカーブを整える',
  'eq.own.editing': '編集中',
  'eq.own.parts': 'プリセットの構成',
  'eq.own.curve': 'カーブ',
  'eq.own.rack': 'ラック',
  'eq.own.unsaved': '未保存',
  'eq.own.discard': '破棄',
  'eq.own.save': 'プリセットを保存',
  'eq.own.addBand': 'バンドを追加',
  'eq.own.curveBands': '「{name}」のカーブのバンド',
  'eq.own.edit': '編集',
  'eq.own.more': '「{name}」のその他の操作',
  'eq.own.renameLabel': '「{name}」の新しい名前',
  'eq.own.about':
    '自分のプリセットです。カーブはメイン EQ で、ラックは DSP ページで鳴ります。',
  'eq.own.deleteAsk':
    '「{name}」を削除しますか？「自分の」から消えます。再生中なら、そのカーブとラックは止まります。',
  'eq.own.keep': '残す',
  'eq.own.emptyTitle': 'まだ自分のプリセットはありません',
  'eq.own.emptyHint':
    '「新しいプリセット」で作れます。メイン EQ のカーブと DSP ページのラックです。',
} as const;
