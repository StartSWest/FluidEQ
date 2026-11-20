/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

/** Auto EQ’s song and album sounds — the notices. The switch’s two words stay
 * for the 2.1 tour, which shows the Output panel as it was then. */
const songSound = {
  'songSound.switch': '각 노래의 사운드 기억',
  'songSound.forget': '이 노래는 잊어버려',
  'songSound.noticeTitle': '이 노래의 저장된 사운드',
  'songSound.noticeBody': '{title} · {preset}',
  'songSound.albumNoticeTitle': '앨범 사운드: {album}',
  'songSound.albumNoticeBody': '{title}에 앨범의 {preset} 사운드가 적용됩니다',
  'songSound.noPresetName': '내 프리셋',
  'songSound.undo': '실행 취소',
  'songSound.willSaveTitle': '이 노래를 저장 중입니다.',
  'songSound.willSaveBody': '{title}에 {preset} 사운드가 유지됩니다.',
  'songSound.willSaveAlbumTitle': '이 노래에만 저장 중',
  'songSound.willSaveAlbumBody':
    '{title}에 {preset} 사운드가 유지됩니다. 앨범은 자체 사운드를 유지합니다.',
  'songSound.dontSave': '저장하지 않음',
} satisfies Partial<Dictionary>;

export default songSound;
