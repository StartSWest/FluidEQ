/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The memory of each song's sound — the switch and the notice. */
export default {
  'songSound.switch': 'Запоминать звук каждой песни',
  'songSound.switchHint':
    'Пресет, тембр или EQ, выставленные во время песни, возвращаются каждый раз, когда она звучит здесь.',
  'songSound.noticeTitle': 'Собственный звук этой песни',
  'songSound.noticeBody': '{title} — {preset}, с её тембром и EQ',
  'songSound.noticeBodyNoPreset': '{title} — её тембр и EQ',
  'songSound.undo': 'Отменить',
  'songSound.forget': 'Забыть эту песню',
  'songSound.willSaveTitle': 'Сохранение для этой песни',
  'songSound.willSaveBody': '{preset} сохранится для «{title}».',
  'songSound.willSaveBodyNoPreset': 'Этот звук сохранится для «{title}».',
  'songSound.dontSave': 'Не сохранять',
};
