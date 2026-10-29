/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genre = {
  'genre.notes.eyebrow': '文類註釋',
  'genre.notes.about': '關於 {name}',
  'genre.notes.aboutShort': '關於',
  'genre.notes.full': '完整筆記',
  'genre.notes.close': '關閉',
  'genre.notes.sound': '聲音',
  'genre.notes.curve': '為什麼是這條曲線',
  'genre.notes.rack': '機架的作用是什麼',
  'genre.notes.on': '開啟',
  'genre.notes.leftOff': '離開',
  'genre.notes.measured': '在 {count} 歌曲上測量',
  'genre.notes.louder': '比 DSP 關閉時更響亮',
  'genre.notes.quieter': '比 DSP 關閉更安靜',
  'genre.notes.peak': '最高峰，永不剪輯',
  'genre.notes.none': '無',
  'genre.notes.distortion': '增加了失真',
  'genre.notes.byDesign': '按設計',
  'genre.notes.harmonics': '來自 {stage} 的諧波',
  'genre.notes.listen': '聽聽它在',
  'genre.notes.research': '研究：{sources}',
  'genre.notes.curveLabel': '{name}曲線',
  'genre.notes.pinOpen': '點選檢視 {name} 的完整註釋',
  'genre.notes.hint': '指向一種流派，看看為什麼它聽起來是這樣的。',
} satisfies Partial<Dictionary>;

export default genre;
