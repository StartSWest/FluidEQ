/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

/** Auto EQ on the EQ page: its button, its panel, Manage, and the note that
 * took the Output panel’s old switch’s place. */
const autoEq = {
  'autoEq.title': 'Auto EQ',
  'autoEq.aria': 'Auto EQ: 각 노래의 사운드를 정하는 기능',
  'autoEq.tagline': '노래마다 알맞은 사운드를 골라 드립니다',
  'autoEq.state.measuring': '측정 중',
  'autoEq.state.paused': '일시중지됨',
  'autoEq.state.song': '노래',
  'autoEq.state.album': '앨범',
  'autoEq.state.yours': '내 사운드',
  'autoEq.aside':
    'DSP가 꺼져 있거나 게임 체인이 켜져 있거나 게임이 자체 사운드를 재생하는 동안에는 잠시 물러납니다. 끝나면 그대로 돌아옵니다.',
  'autoEq.now.nothing': '재생 중인 항목 없음',
  'autoEq.now.yours': '내 사운드',
  'autoEq.now.yoursWhy':
    '이 노래에 저장된 것이 없어 마지막으로 고른 사운드로 재생합니다.',
  'autoEq.now.song': '이 노래의 사운드',
  'autoEq.now.songWhy': '이 노래가 재생될 때마다 돌아옵니다.',
  'autoEq.now.album': '{album}의 사운드',
  'autoEq.now.albumUnnamed': '앨범의 사운드',
  'autoEq.now.albumWhy': '라이브러리에서 앨범 전체에 설정했습니다.',
  'autoEq.songs.title': '노래 사운드',
  'autoEq.songs.hint':
    '사운드가 저장된 노래는 그 사운드로 재생됩니다. 재생 중에 바꾸면 노래에 변경 사항이 남습니다. 다른 노래는 내 사운드로 재생됩니다.',
  'autoEq.songs.nothing': '노래를 재생하면 그 사운드를 저장할 수 있습니다',
  'autoEq.songs.saved': '이 노래에 저장됨',
  'autoEq.songs.none': '이 노래에 저장된 것 없음',
  'autoEq.songs.save': '이 노래에 저장',
  'autoEq.songs.forget': '잊기',
  'autoEq.albums.title': '앨범 사운드',
  'autoEq.albums.hint':
    '라이브러리 전용입니다. 앨범의 모든 노래가 이 사운드로 재생되며, 자체 프리셋이 있는 노래는 예외입니다.',
  'autoEq.albums.nothing':
    '라이브러리의 앨범 페이지에서 앨범 사운드를 설정하세요',
  'autoEq.albums.libraryOnly':
    '라이브러리 전용: 다른 플레이어에는 적용되지 않습니다',
  'autoEq.albums.set': '{album}: {preset}',
  'autoEq.albums.none': '이 앨범에는 설정된 사운드가 없습니다',
  'autoEq.smart.title': '스마트 보정',
  'autoEq.smart.hint':
    '각 노래를 소스에서 측정하고 그 보정을 노래별로 보관합니다. 어떤 프리셋 위에도 적용됩니다.',
  'autoEq.smart.modes': '보정 방식',
  'autoEq.smart.waiting': '노래를 기다리는 중',
  'autoEq.smart.willSave': '노래가 끝나면 이 노래에 저장됩니다',
  'autoEq.smart.savesIn': '{remaining} 후 이 노래에 저장됩니다',
  'autoEq.smart.onceHint': '재생 중인 소리를 한 번 측정해 바로 적용',
  'autoEq.smart.once': '한 번 측정',
  'autoEq.savedCount': '저장됨: {songs} · {albums}',
  'autoEq.manage': '관리',
  'autoEq.manage.title': '저장된 사운드',
  'autoEq.manage.back': 'Auto EQ로 돌아가기',
  'autoEq.manage.songs': '노래',
  'autoEq.manage.albums': '앨범',
  'autoEq.manage.search': '저장된 사운드 검색',
  'autoEq.manage.wholeSound': '{preset}, 톤과 EQ 포함',
  'autoEq.manage.forget': '잊기',
  'autoEq.manage.others': '다른 플레이어의 노래: {count}',
  'autoEq.manage.othersHint':
    'Spotify, YouTube, 브라우저. 이름은 저장하지 않습니다.',
  'autoEq.manage.empty': '아직 저장된 것이 없습니다',
  'autoEq.manage.noMatch': '일치하는 항목 없음',
  'autoEq.manage.resetKeeps':
    '모든 설정 재설정을 해도 이 항목은 유지됩니다. 잊기로만 삭제됩니다.',
  'autoEq.manage.forgetAll': '모두 잊기',
  'autoEq.manage.forgetAllConfirm': '모두 영구히 잊기',
  'autoEq.moved.title': '각 노래의 사운드가 이제 Auto EQ에 있습니다',
  'autoEq.moved.body':
    '각 노래의 사운드 기억이 EQ 페이지의 Auto EQ로 옮겨졌습니다. 저장된 노래 {count}곡도 함께 옮겨졌습니다.',
  'autoEq.moved.bodyOne':
    '각 노래의 사운드 기억이 EQ 페이지의 Auto EQ로 옮겨졌습니다. 저장된 노래도 함께 옮겨졌습니다.',
  'autoEq.moved.open': 'Auto EQ 열기',
  'autoEq.moved.dismiss': '알았어요',
} satisfies Partial<Dictionary>;

export default autoEq;
