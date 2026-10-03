/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The memory of each song's sound — the switch and the notice. */
export default {
  'songSound.switch': '曲ごとのサウンドを記憶',
  'songSound.switchHint':
    '曲の再生中に設定したプリセット、トーン、EQ は、その曲がここで再生されるたびに戻ります。',
  'songSound.noticeTitle': 'この曲専用のサウンド',
  'songSound.noticeBody': '{title} — {preset}、この曲のトーンと EQ',
  'songSound.noticeBodyNoPreset': '{title} — この曲のトーンと EQ',
  'songSound.undo': '元に戻す',
  'songSound.forget': 'この曲の記憶を消す',
  'songSound.willSaveTitle': 'この曲用に保存',
  'songSound.willSaveBody': '{preset} を「{title}」用に保存します。',
  'songSound.willSaveBodyNoPreset': 'このサウンドを「{title}」用に保存します。',
  'songSound.dontSave': '保存しない',
};
