/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The memory of each song's sound — the switch and the notice. */
export default {
  'songSound.switch': '记住每首歌的声音',
  'songSound.switchHint':
    '歌曲播放时设置的预设、音色或 EQ，会在这首歌每次在这里播放时回来。',
  'songSound.noticeTitle': '这首歌自己的声音',
  'songSound.noticeBody': '{title} — {preset}，以及它的音色和 EQ',
  'songSound.noticeBodyNoPreset': '{title} — 它的音色和 EQ',
  'songSound.undo': '撤销',
  'songSound.forget': '忘记这首歌',
  'songSound.willSaveTitle': '正在为这首歌保存',
  'songSound.willSaveBody': '{preset} 将为「{title}」保存。',
  'songSound.willSaveBodyNoPreset': '这个声音将为「{title}」保存。',
  'songSound.dontSave': '不保存',
};
